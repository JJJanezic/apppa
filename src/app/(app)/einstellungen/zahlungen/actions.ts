'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

import type { ActionResult, CommonErrorCode } from '@/lib/auth/result'
import { getSessionUser, pendingMfaStep } from '@/lib/auth/session'
import type { PaymentMethodErrorCode } from '@/lib/payments'
import { isMissingRelation } from '@/lib/payments-data'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext } from '@/lib/tenant'
import { paymentMethodNameSchema } from '@/lib/validation/payments'

// Server-Aktionen für Einstellungen → Zahlungen (PROJ-45), nur für Inhaber des gewählten Kunden (kein Betreiber-Zugriff).
// Anlegen, Umbenennen, Aktiv-Schalter und Löschen gehen direkt an die Tabelle (Zugriffsregeln: nur Inhaber); Reihenfolge und
// Standard über Datenbank-Funktionen, damit sie in einem Schritt wechseln. Die Datenbank prüft „Name eindeutig“,
// „mindestens eine aktiv“, „Standard nicht deaktivierbar“ und „löschen nur unbenutzt“ selbst.

type Result<T = undefined> = ActionResult<T, PaymentMethodErrorCode>
type Failure = { ok: false; error: PaymentMethodErrorCode | CommonErrorCode }
const fail = (error: PaymentMethodErrorCode | CommonErrorCode): Failure => ({ ok: false, error })
const key = (k: string) => k
const isId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value)
const untyped = async () => (await createClient()) as unknown as SupabaseClient

const DB_ERRORS: Record<string, PaymentMethodErrorCode | CommonErrorCode> = {
  '42501': 'ownerOnly',
  // eindeutiger Name je Kunde (ohne Groß-/Kleinschreibung)
  '23505': 'nameTaken',
  // Zahlungen verweisen auf die Art
  '23503': 'methodInUse',
  P0016: 'tenantDeactivated',
  P0962: 'lastActive',
  P0963: 'defaultInactive',
  P0964: 'staleMethods',
}

function dbFail(error: { code?: string; message?: string }, context: string): Failure {
  if (isMissingRelation(error)) return fail('notImplemented')
  const mapped = error.code ? DB_ERRORS[error.code] : undefined
  if (!mapped) console.error(`[zahlungsarten] ${context}`, error.code, error.message)
  return fail(mapped ?? 'unknown')
}

async function requireOwner(): Promise<{ ok: true; tenantId: string } | Failure> {
  const user = await getSessionUser()
  if (!user || (await pendingMfaStep(user))) return fail('sessionExpired')
  const { active } = await getTenantContext()
  if (!active) return fail('unknown')
  return active.role === 'owner' ? { ok: true, tenantId: active.id } : fail('ownerOnly')
}

const revalidate = () => {
  revalidatePath('/einstellungen/zahlungen')
  revalidatePath('/zahlungen')
}

export async function createPaymentMethod(input: { name: string }): Promise<Result<{ id: string }>> {
  const guard = await requireOwner()
  if (!guard.ok) return guard
  const name = paymentMethodNameSchema(key).safeParse(input?.name)
  if (!name.success) return fail('unknown')
  const supabase = await untyped()
  const { data, error } = await supabase.from('payment_methods').insert({ tenant_id: guard.tenantId, name: name.data }).select('id').single()
  if (error) return dbFail(error, 'anlegen')
  revalidate()
  return { ok: true, data: { id: (data as { id: string }).id } }
}

export async function renamePaymentMethod(input: { id: string; name: string }): Promise<Result> {
  const guard = await requireOwner()
  if (!guard.ok) return guard
  const name = paymentMethodNameSchema(key).safeParse(input?.name)
  if (!isId(input?.id) || !name.success) return fail('unknown')
  const supabase = await untyped()
  const { error } = await supabase.from('payment_methods').update({ name: name.data }).eq('id', input.id).eq('tenant_id', guard.tenantId)
  if (error) return dbFail(error, 'umbenennen')
  revalidate()
  return { ok: true }
}

export async function setPaymentMethodActive(input: { id: string; active: boolean }): Promise<Result> {
  const guard = await requireOwner()
  if (!guard.ok) return guard
  if (!isId(input?.id) || typeof input.active !== 'boolean') return fail('unknown')
  const supabase = await untyped()
  const { error } = await supabase.from('payment_methods').update({ active: input.active }).eq('id', input.id).eq('tenant_id', guard.tenantId)
  if (error) return dbFail(error, 'aktiv')
  revalidate()
  return { ok: true }
}

export async function setDefaultPaymentMethod(input: { id: string }): Promise<Result> {
  const guard = await requireOwner()
  if (!guard.ok) return guard
  if (!isId(input?.id)) return fail('unknown')
  const supabase = await untyped()
  const { error } = await supabase.rpc('set_default_payment_method', { p_tenant_id: guard.tenantId, p_method_id: input.id })
  if (error) return dbFail(error, 'Standard')
  revalidate()
  return { ok: true }
}

// Neue Reihenfolge: alle IDs des Kunden in der gewünschten Folge
export async function reorderPaymentMethods(input: { ids: string[] }): Promise<Result> {
  const guard = await requireOwner()
  if (!guard.ok) return guard
  if (!Array.isArray(input?.ids) || !input.ids.every(isId)) return fail('unknown')
  const supabase = await untyped()
  const { error } = await supabase.rpc('reorder_payment_methods', { p_tenant_id: guard.tenantId, p_ids: input.ids })
  if (error) return dbFail(error, 'ordnen')
  revalidate()
  return { ok: true }
}

export async function deletePaymentMethod(input: { id: string }): Promise<Result> {
  const guard = await requireOwner()
  if (!guard.ok) return guard
  if (!isId(input?.id)) return fail('unknown')
  const supabase = await untyped()
  const { error } = await supabase.from('payment_methods').delete().eq('id', input.id).eq('tenant_id', guard.tenantId)
  if (error) return dbFail(error, 'löschen')
  revalidate()
  return { ok: true }
}
