'use server'

import type { ActionResult, CommonErrorCode } from '@/lib/auth/result'
import { getSessionUser, pendingMfaStep } from '@/lib/auth/session'
import type { OperatorErrorCode } from '@/lib/operator'
import {
  createTenantSchema,
  ownerInviteSchema,
  type CreateTenantInput,
  type OwnerInviteInput,
} from '@/lib/validation/operator'

// Server-Aktionen des Betreiber-Bereichs (PROJ-5), nur für den Admin mit 2FA-bestätigter Sitzung.
// Vorläufig (Frontend): Eingaben und Admin werden geprüft, die Ausführung folgt mit dem Backend
// (Datenbankfunktionen mit eigener Admin-Prüfung + Protokoll, Mailversand wie PROJ-4).

type Result<T = undefined> = ActionResult<T, OperatorErrorCode>

const key = (k: string) => k
const fail = (error: OperatorErrorCode | CommonErrorCode): { ok: false; error: OperatorErrorCode | CommonErrorCode } => ({
  ok: false,
  error,
})
const isId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value)

async function requireAdmin(): Promise<{ ok: true } | { ok: false; error: CommonErrorCode }> {
  const user = await getSessionUser()
  if (!user || (await pendingMfaStep(user))) return { ok: false, error: 'sessionExpired' }
  if (!user.isOperatorAdmin) return { ok: false, error: 'unknown' }
  return { ok: true }
}

// Kunde + Inhaber-Einladung in einem Schritt. mailFailed: Kunde steht, Einladung bitte erneut senden
export async function createTenant(values: CreateTenantInput): Promise<Result<{ tenantId: string; mailFailed: boolean }>> {
  if (!createTenantSchema(key).safeParse(values).success) return fail('unknown')
  const guard = await requireAdmin()
  if (!guard.ok) return guard
  return fail('notImplemented')
}

export async function inviteOwner(values: { tenantId: string } & OwnerInviteInput): Promise<Result> {
  if (!isId(values?.tenantId) || !ownerInviteSchema(key).safeParse(values).success) return fail('unknown')
  const guard = await requireAdmin()
  if (!guard.ok) return guard
  return fail('notImplemented')
}

export async function resendOwnerInvitation(values: { tenantId: string; invitationId: string }): Promise<Result> {
  if (!isId(values?.tenantId) || !isId(values?.invitationId)) return fail('unknown')
  const guard = await requireAdmin()
  if (!guard.ok) return guard
  return fail('notImplemented')
}

export async function revokeOwnerInvitation(values: { tenantId: string; invitationId: string }): Promise<Result> {
  if (!isId(values?.tenantId) || !isId(values?.invitationId)) return fail('unknown')
  const guard = await requireAdmin()
  if (!guard.ok) return guard
  return fail('notImplemented')
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
  return fail('notImplemented')
}

export async function setTenantActive(values: { tenantId: string; active: boolean }): Promise<Result> {
  if (!isId(values?.tenantId) || typeof values?.active !== 'boolean') return fail('unknown')
  const guard = await requireAdmin()
  if (!guard.ok) return guard
  return fail('notImplemented')
}

// Nur deaktivierte Kunden, nur mit exakt eingetipptem Namen. accountsLeft: Login-Konten, die nicht gelöscht werden konnten
export async function deleteTenant(values: { tenantId: string; confirmName: string }): Promise<Result<{ accountsLeft: number }>> {
  if (!isId(values?.tenantId) || typeof values?.confirmName !== 'string') return fail('unknown')
  const guard = await requireAdmin()
  if (!guard.ok) return guard
  return fail('notImplemented')
}
