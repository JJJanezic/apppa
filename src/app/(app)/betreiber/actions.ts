'use server'

import { revalidatePath } from 'next/cache'

import type { ActionResult, CommonErrorCode } from '@/lib/auth/result'
import { getSessionUser, pendingMfaStep, type SessionUser } from '@/lib/auth/session'
import { type OperatorErrorCode, tenantHref } from '@/lib/operator'
import { removeTenantDocuments } from '@/lib/guest-documents'
import { removeTenantInvoices } from '@/lib/invoice-files'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { cleanupUnusedAccount, deliverInvitation } from '@/lib/team-invite'
import type { TenantMasterDataErrorCode } from '@/lib/tenant-master-data'
import { saveTenantMasterData } from '@/lib/tenant-master-data-save'
import {
  createTenantSchema,
  ownerInviteSchema,
  type CreateTenantInput,
  type OwnerInviteInput,
} from '@/lib/validation/operator'
import { tenantMasterDataSchema, type TenantMasterDataInput } from '@/lib/validation/tenant'

// Server-Aktionen des Betreiber-Bereichs (PROJ-5), nur für den Admin mit 2FA-bestätigter Sitzung.
// Erste Ebene: Prüfung hier. Zweite Ebene: Jede Änderung läuft über eine Admin-Funktion der Datenbank, die
// Admin + 2FA selbst prüft und den Protokolleintrag schreibt (supabase/migrations/20261024120000_operator_admin.sql).
// Hier bleibt, was die Datenbank nicht kann: Mails verschicken (Ablauf aus PROJ-4) und Login-Konten löschen.

type Result<T = undefined> = ActionResult<T, OperatorErrorCode>
type Failure = { ok: false; error: OperatorErrorCode | CommonErrorCode }

const key = (k: string) => k
const fail = (error: OperatorErrorCode | CommonErrorCode): Failure => ({ ok: false, error })
const isId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value)

// Fehlercodes der Admin-Funktionen → Meldungen
const DB_ERRORS: Record<string, OperatorErrorCode | CommonErrorCode> = {
  '42501': 'sessionExpired',
  P0001: 'lastOwner',
  '23505': 'alreadyInvited',
  P0010: 'duplicateName',
  P0011: 'tenantGone',
  P0012: 'notDeactivated',
  P0013: 'nameMismatch',
  P0014: 'alreadyMember',
  P0015: 'invitationInvalid',
}

function dbFail(error: { code?: string; message?: string }, context: string): Failure {
  const mapped = error.code ? DB_ERRORS[error.code] : undefined
  if (!mapped) console.error(`[betreiber] ${context}`, error.code, error.message)
  return fail(mapped ?? 'unknown')
}

async function requireAdmin(): Promise<{ ok: true; user: SessionUser } | Failure> {
  const user = await getSessionUser()
  if (!user || (await pendingMfaStep(user))) return fail('sessionExpired')
  if (!user.isOperatorAdmin) return fail('unknown')
  return { ok: true, user }
}

function refresh(tenantId?: string) {
  revalidatePath('/betreiber')
  if (tenantId) revalidatePath(tenantHref(tenantId))
}

// Kunde + Inhaber-Einladung in einem Schritt. mailFailed: Kunde steht, Einladung bitte erneut senden
export async function createTenant(values: CreateTenantInput): Promise<Result<{ tenantId: string; mailFailed: boolean }>> {
  const parsed = createTenantSchema(key).safeParse(values)
  if (!parsed.success) return fail('unknown')
  const guard = await requireAdmin()
  if (!guard.ok) return guard
  const { name, email, allowDuplicate } = parsed.data

  const supabase = await createClient()
  const { data, error } = await supabase
    .rpc('admin_create_tenant', { p_name: name, p_email: email, p_allow_duplicate: allowDuplicate ?? false })
    .single()
  if (error || !data) return dbFail(error ?? {}, 'Kunde nicht angelegt')

  const delivered = await deliverInvitation({
    email,
    kind: data.kind as 'new_account' | 'existing_account',
    role: 'owner',
    tenantName: name,
    inviterName: guard.user.displayName,
  })
  refresh()
  return { ok: true, data: { tenantId: data.tenant_id, mailFailed: !delivered && data.kind === 'new_account' } }
}

export async function inviteOwner(values: { tenantId: string } & OwnerInviteInput): Promise<Result> {
  const parsed = ownerInviteSchema(key).safeParse(values)
  if (!isId(values?.tenantId) || !parsed.success) return fail('unknown')
  const guard = await requireAdmin()
  if (!guard.ok) return guard
  const { email } = parsed.data

  const supabase = await createClient()
  const [{ data: kind, error }, { data: tenant }] = await Promise.all([
    supabase.rpc('admin_invite_owner', { p_tenant_id: values.tenantId, p_email: email }),
    supabase.from('tenants').select('name').eq('id', values.tenantId).maybeSingle(),
  ])
  if (error || !kind) return dbFail(error ?? {}, 'Inhaber nicht eingeladen')

  const delivered = await deliverInvitation({
    email,
    kind: kind as 'new_account' | 'existing_account',
    role: 'owner',
    tenantName: tenant?.name ?? '',
    inviterName: guard.user.displayName,
  })
  refresh(values.tenantId)
  // Die Einladung bleibt offen; über „Erneut senden“ lässt sie sich nochmals verschicken
  if (!delivered && kind === 'new_account') return fail('mailFailed')
  return { ok: true }
}

export async function resendOwnerInvitation(values: { tenantId: string; invitationId: string }): Promise<Result> {
  if (!isId(values?.tenantId) || !isId(values?.invitationId)) return fail('unknown')
  const guard = await requireAdmin()
  if (!guard.ok) return guard

  const supabase = await createClient()
  const { data, error } = await supabase
    .rpc('admin_resend_invitation', { p_tenant_id: values.tenantId, p_invitation_id: values.invitationId })
    .single()
  if (error || !data) {
    // z. B. Person inzwischen Mitglied: Einladung wurde geschlossen → Liste aktualisieren (nicht bei gelöschtem Kunden)
    if (error?.code !== 'P0011') refresh(values.tenantId)
    return dbFail(error ?? {}, 'Einladung nicht erneut gesendet')
  }

  const delivered = await deliverInvitation({
    email: data.email,
    kind: data.kind as 'new_account' | 'existing_account',
    role: data.role,
    tenantName: data.tenant_name,
    inviterName: guard.user.displayName,
  })
  refresh(values.tenantId)
  if (!delivered && data.kind === 'new_account') return fail('mailFailed')
  return { ok: true }
}

export async function revokeOwnerInvitation(values: { tenantId: string; invitationId: string }): Promise<Result> {
  if (!isId(values?.tenantId) || !isId(values?.invitationId)) return fail('unknown')
  const guard = await requireAdmin()
  if (!guard.ok) return guard

  const supabase = await createClient()
  const { data, error } = await supabase
    .rpc('admin_revoke_invitation', { p_tenant_id: values.tenantId, p_invitation_id: values.invitationId })
    .single()
  if (error || !data) return dbFail(error ?? {}, 'Einladung nicht zurückgezogen')

  // Ungenutztes Login-Konto entfernen, damit der alte Mail-Link ins Leere führt (wie PROJ-4)
  if (data.kind === 'new_account') await cleanupUnusedAccount(data.email)
  refresh(values.tenantId)
  return { ok: true }
}

// promote: Mitarbeiter → Inhaber; demote: Inhaber → Mitarbeiter; remove: Inhaber entfernen (nie der letzte)
export async function changeMember(values: {
  tenantId: string
  userId: string
  action: 'promote' | 'demote' | 'remove'
}): Promise<Result> {
  if (!isId(values?.tenantId) || !isId(values?.userId) || !['promote', 'demote', 'remove'].includes(values?.action)) {
    return fail('unknown')
  }
  const guard = await requireAdmin()
  if (!guard.ok) return guard

  const supabase = await createClient()
  const { error } = await supabase.rpc('admin_change_member', {
    p_tenant_id: values.tenantId,
    p_user_id: values.userId,
    p_action: values.action,
  })
  if (error) return dbFail(error, 'Mitgliedschaft nicht geändert')
  refresh(values.tenantId)
  return { ok: true }
}

export async function setTenantActive(values: { tenantId: string; active: boolean }): Promise<Result> {
  if (!isId(values?.tenantId) || typeof values?.active !== 'boolean') return fail('unknown')
  const guard = await requireAdmin()
  if (!guard.ok) return guard

  const supabase = await createClient()
  const { error } = await supabase.rpc('admin_set_tenant_status', { p_tenant_id: values.tenantId, p_active: values.active })
  if (error) return dbFail(error, 'Status nicht geändert')
  refresh(values.tenantId)
  return { ok: true }
}

// Nur deaktivierte Kunden, nur mit exakt eingetipptem Namen. Danach die verwaisten Login-Konten löschen
// und die unbenutzten Konten offener Einladungen an neue Personen entfernen (wie beim Zurückziehen, PROJ-4);
// accountsLeft: Konten, bei denen das Löschen nicht geklappt hat (Runbook Abschnitt 12)
export async function deleteTenant(values: { tenantId: string; confirmName: string }): Promise<Result<{ accountsLeft: number }>> {
  if (!isId(values?.tenantId) || typeof values?.confirmName !== 'string') return fail('unknown')
  const guard = await requireAdmin()
  if (!guard.ok) return guard

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('admin_delete_tenant', {
    p_tenant_id: values.tenantId,
    p_confirm_name: values.confirmName,
  })
  if (error) return dbFail(error, 'Kunde nicht gelöscht')
  // Ausweisbilder der Gäste (PROJ-29) und Rechnungs-PDFs (PROJ-37); Reste entfernt die tägliche Bereinigung
  await Promise.all([removeTenantDocuments(values.tenantId), removeTenantInvoices(values.tenantId)])

  const admin = createAdminClient()
  let accountsLeft = 0
  for (const { user_id, invited_email } of data ?? []) {
    if (invited_email) {
      await cleanupUnusedAccount(invited_email)
      continue
    }
    if (!user_id) continue
    const { error: deleteError } = await admin.auth.admin.deleteUser(user_id)
    if (deleteError) {
      accountsLeft++
      console.error('[betreiber] Login-Konto nicht gelöscht', user_id, deleteError.code ?? deleteError.status)
    }
  }
  refresh()
  return { ok: true, data: { accountsLeft } }
}

// Stammdaten eines Kunden ändern (PROJ-28); dieselbe Datenbank-Funktion wie für Inhaber, sie prüft Admin + 2FA selbst
export async function adminUpdateTenantMasterData(
  values: TenantMasterDataInput & { tenantId: string; updatedAt: string }
): Promise<ActionResult<undefined, TenantMasterDataErrorCode>> {
  const parsed = tenantMasterDataSchema(key).safeParse(values)
  if (!isId(values?.tenantId) || typeof values?.updatedAt !== 'string' || !parsed.success) return { ok: false, error: 'unknown' }
  const guard = await requireAdmin()
  if (!guard.ok) return { ok: false, error: guard.error === 'sessionExpired' ? 'sessionExpired' : 'unknown' }

  const supabase = await createClient()
  const result = await saveTenantMasterData(supabase, values.tenantId, values.updatedAt, parsed.data)
  if (!result.ok) return result

  refresh(values.tenantId)
  revalidatePath('/', 'layout')
  return { ok: true }
}
