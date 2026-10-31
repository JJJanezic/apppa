'use server'

import { revalidatePath } from 'next/cache'

import type { ActionResult, CommonErrorCode } from '@/lib/auth/result'
import { getSessionUser, pendingMfaStep, type SessionUser } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { MAX_INVITES_PER_HOUR, type TeamErrorCode } from '@/lib/team'
import { cleanupUnusedAccount, deliverInvitation, invitationKindFor } from '@/lib/team-invite'
import { belongsToDeactivatedTenant, getTenantContext, rememberTenant, type TenantSummary } from '@/lib/tenant'
import { saveTenantMasterData } from '@/lib/tenant-master-data-save'
import { prepareLogoUploadFor } from '@/lib/tenant-logo-data'
import type { TenantMasterDataErrorCode } from '@/lib/tenant-master-data'
import { inviteSchema, type InviteInput } from '@/lib/validation/team'
import { tenantMasterDataSchema, type TenantMasterDataInput } from '@/lib/validation/tenant'

// Server-Aktionen für „Einstellungen → Team / Stammdaten“ (PROJ-4), nur für Inhaber des gewählten Kunden.
// Änderungen an Mitgliedschaften laufen im Namen der Person: Die Datenbank-Regeln (RLS + Trigger) entscheiden
// zusätzlich. Einladungsmails verschickt der Server (Supabase-Einladung bzw. Hinweis-Mail über Brevo).

type Result = ActionResult<undefined, TeamErrorCode>
type Guard = { ok: true; user: SessionUser; tenant: TenantSummary } | { ok: false; result: Result }

const key = (k: string) => k
const fail = (error: TeamErrorCode | CommonErrorCode): Result => ({ ok: false, error })

async function requireOwner(): Promise<Guard> {
  const user = await getSessionUser()
  if (!user || (await pendingMfaStep(user))) return { ok: false, result: fail('sessionExpired') }
  const { active } = await getTenantContext()
  if (!active || active.role !== 'owner') return { ok: false, result: fail('unknown') }
  return { ok: true, user, tenant: active }
}

async function requireMember(): Promise<Guard> {
  const user = await getSessionUser()
  if (!user || (await pendingMfaStep(user))) return { ok: false, result: fail('sessionExpired') }
  const { active } = await getTenantContext()
  if (!active) return { ok: false, result: fail('unknown') }
  return { ok: true, user, tenant: active }
}

// „mindestens ein Inhaber“ (Trigger aus PROJ-1) meldet sich mit diesem Code
const isLastOwnerError = (error: { code?: string } | null) => error?.code === 'P0001'

async function invitesInLastHour(tenantId: string): Promise<number> {
  const supabase = await createClient()
  const { count } = await supabase
    .from('invitations')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .gte('sent_at', new Date(Date.now() - 60 * 60_000).toISOString())
  return count ?? 0
}

// Einladen: neue Person per Einladungsmail, bestehendes Konto per Hinweis-Mail + Einladung in der App
export async function inviteMember(values: InviteInput): Promise<Result> {
  const parsed = inviteSchema(key).safeParse(values)
  if (!parsed.success) return fail('unknown')
  const guard = await requireOwner()
  if (!guard.ok) return guard.result
  const { user, tenant } = guard
  const { email, role } = parsed.data

  if (user.email && email === user.email.toLowerCase()) return fail('inviteSelf')
  const kind = await invitationKindFor(email, tenant.id)
  if (kind === 'member') return fail('alreadyMember')
  if ((await invitesInLastHour(tenant.id)) >= MAX_INVITES_PER_HOUR) return fail('tooManyInvites')

  const supabase = await createClient()
  const { data: invitation, error } = await supabase
    .from('invitations')
    .insert({ tenant_id: tenant.id, email, role, kind, invited_by: user.userId, expires_at: expiryFor(kind) })
    .select('id')
    .single()
  if (error) return fail(error.code === '23505' ? 'alreadyInvited' : 'unknown')

  const delivered = await deliverInvitation({ email, kind, role, tenantName: tenant.name, inviterName: user.displayName })
  if (!delivered && kind === 'new_account') {
    // Ohne Einladungsmail kann die Person nicht beitreten: Einladung wieder schließen
    await supabase.from('invitations').update({ status: 'revoked', closed_at: new Date().toISOString() }).eq('id', invitation.id)
    return fail('unknown')
  }

  revalidatePath('/einstellungen/team')
  return { ok: true }
}

function expiryFor(kind: 'new_account' | 'existing_account'): string {
  const days = kind === 'new_account' ? 1 : 14
  return new Date(Date.now() + days * 24 * 60 * 60_000).toISOString()
}

// Frischer Link (alter wird ungültig) bzw. erneute Hinweis-Mail; Gültigkeit beginnt neu
export async function resendInvitation(values: { invitationId: string }): Promise<Result> {
  if (typeof values?.invitationId !== 'string') return fail('unknown')
  const guard = await requireOwner()
  if (!guard.ok) return guard.result
  const { user, tenant } = guard

  const supabase = await createClient()
  const { data: invitation } = await supabase
    .from('invitations')
    .select('id, email, role, status')
    .eq('id', values.invitationId)
    .eq('tenant_id', tenant.id)
    .maybeSingle()
  if (!invitation || invitation.status !== 'open') return fail('invitationInvalid')
  if ((await invitesInLastHour(tenant.id)) >= MAX_INVITES_PER_HOUR) return fail('tooManyInvites')

  // Hat die Person inzwischen ein Konto (oder ist schon Mitglied)? Dann passt sich die Art an.
  const kind = await invitationKindFor(invitation.email, tenant.id)
  if (kind === 'member') {
    await supabase.from('invitations').update({ status: 'accepted', closed_at: new Date().toISOString() }).eq('id', invitation.id)
    return fail('alreadyMember')
  }

  const delivered = await deliverInvitation({
    email: invitation.email,
    kind,
    role: invitation.role,
    tenantName: tenant.name,
    inviterName: user.displayName,
  })
  if (!delivered && kind === 'new_account') return fail('unknown')

  const { error } = await supabase
    .from('invitations')
    .update({ kind, sent_at: new Date().toISOString(), expires_at: expiryFor(kind) })
    .eq('id', invitation.id)
  if (error) return fail('unknown')

  revalidatePath('/einstellungen/team')
  return { ok: true }
}

export async function revokeInvitation(values: { invitationId: string }): Promise<Result> {
  if (typeof values?.invitationId !== 'string') return fail('unknown')
  const guard = await requireOwner()
  if (!guard.ok) return guard.result

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('invitations')
    .update({ status: 'revoked', closed_at: new Date().toISOString() })
    .eq('id', values.invitationId)
    .eq('tenant_id', guard.tenant.id)
    .eq('status', 'open')
    .select('email, kind')
  if (error) return fail('unknown')
  if (!data?.length) return fail('invitationInvalid')

  // Ungenutztes Login-Konto entfernen, damit der alte Mail-Link ins Leere führt
  if (data[0].kind === 'new_account') await cleanupUnusedAccount(data[0].email)

  revalidatePath('/einstellungen/team')
  return { ok: true }
}

// Mitarbeiter → Inhaber. Andere Inhaber sind geschützt (die Datenbank ändert dann keine Zeile)
export async function promoteMember(values: { userId: string }): Promise<Result> {
  if (typeof values?.userId !== 'string') return fail('unknown')
  const guard = await requireOwner()
  if (!guard.ok) return guard.result

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('memberships')
    .update({ role: 'owner' })
    .eq('tenant_id', guard.tenant.id)
    .eq('user_id', values.userId)
    .eq('role', 'staff')
    .select('id')
  if (error) return fail('unknown')
  if (!data?.length) return fail('otherOwner')

  revalidatePath('/', 'layout')
  return { ok: true }
}

// Nur Mitarbeiter; andere Inhaber kann nur der Betreiber entfernen
export async function removeMember(values: { userId: string }): Promise<Result> {
  if (typeof values?.userId !== 'string') return fail('unknown')
  const guard = await requireOwner()
  if (!guard.ok) return guard.result
  if (values.userId === guard.user.userId) return fail('unknown')

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('memberships')
    .delete()
    .eq('tenant_id', guard.tenant.id)
    .eq('user_id', values.userId)
    .eq('role', 'staff')
    .select('id')
  if (error) return fail(isLastOwnerError(error) ? 'lastOwner' : 'unknown')
  if (!data?.length) return fail('otherOwner')

  revalidatePath('/', 'layout')
  return { ok: true }
}

// Eigene Rolle Inhaber → Mitarbeiter (nicht als letzter Inhaber). Danach keine Einstellungen mehr → Dashboard
export async function demoteSelf(): Promise<Result> {
  const guard = await requireOwner()
  if (!guard.ok) return guard.result

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('memberships')
    .update({ role: 'staff' })
    .eq('tenant_id', guard.tenant.id)
    .eq('user_id', guard.user.userId)
    .select('id')
  if (error) return fail(isLastOwnerError(error) ? 'lastOwner' : 'unknown')
  if (!data?.length) return fail('unknown')

  revalidatePath('/', 'layout')
  return { ok: true, redirectTo: '/' }
}

// Team des gewählten Kunden verlassen (nicht als letzter Inhaber); danach der nächste Kunde bzw. „keinem zugeordnet“
export async function leaveTenant(): Promise<Result> {
  const guard = await requireMember()
  if (!guard.ok) return guard.result

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('memberships')
    .delete()
    .eq('tenant_id', guard.tenant.id)
    .eq('user_id', guard.user.userId)
    .select('id')
  if (error) return fail(isLastOwnerError(error) ? 'lastOwner' : 'unknown')
  if (!data?.length) return fail('unknown')

  await rememberTenant(null)
  revalidatePath('/', 'layout')
  return { ok: true, redirectTo: '/' }
}

// Stammdaten speichern (PROJ-28): eine Datenbank-Funktion prüft Rolle, Aktiv-Status und Stand und schreibt das Protokoll
// tenantId: Kunde, dessen Formular offen ist. Wurde er inzwischen deaktiviert, fehlt er in der Kundenauswahl;
// ohne diesen Abgleich würde die Aktion sonst den nächsten aktiven Kunden der Person treffen.
export async function updateTenantMasterData(
  values: TenantMasterDataInput & { tenantId: string; updatedAt: string }
): Promise<ActionResult<undefined, TeamErrorCode | TenantMasterDataErrorCode>> {
  const parsed = tenantMasterDataSchema(key).safeParse(values)
  if (!parsed.success || typeof values?.updatedAt !== 'string' || typeof values?.tenantId !== 'string') return fail('unknown')
  const guard = await requireOwner()
  if (!guard.ok && !guard.result.ok && guard.result.error === 'sessionExpired') return guard.result
  if (!guard.ok || guard.tenant.id !== values.tenantId) {
    return { ok: false, error: (await belongsToDeactivatedTenant()) ? 'tenantDeactivated' : 'unknown' }
  }

  const supabase = await createClient()
  const result = await saveTenantMasterData(supabase, guard.tenant.id, values.updatedAt, parsed.data)
  if (!result.ok) return result

  revalidatePath('/', 'layout')
  return { ok: true }
}

// Logo hochladen vorbereiten (PROJ-38): Speicherort im Ordner des gewählten Kunden. Eingetragen wird das Logo erst
// beim Speichern der Stammdaten. tenantId wie beim Speichern: Formular und gewählter Kunde müssen übereinstimmen.
export async function prepareLogoUpload(values: {
  tenantId: string
}): Promise<ActionResult<{ path: string; token: string }, TeamErrorCode | TenantMasterDataErrorCode>> {
  if (typeof values?.tenantId !== 'string') return fail('unknown')
  const guard = await requireOwner()
  if (!guard.ok && !guard.result.ok && guard.result.error === 'sessionExpired') return guard.result
  if (!guard.ok || guard.tenant.id !== values.tenantId) {
    return { ok: false, error: (await belongsToDeactivatedTenant()) ? 'tenantDeactivated' : 'unknown' }
  }
  const prepared = await prepareLogoUploadFor(guard.tenant.id)
  return prepared ? { ok: true, data: prepared } : fail('unknown')
}
