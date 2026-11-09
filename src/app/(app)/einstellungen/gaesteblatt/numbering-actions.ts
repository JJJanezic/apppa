'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

import type { ActionResult, CommonErrorCode } from '@/lib/auth/result'
import { getSessionUser, pendingMfaStep } from '@/lib/auth/session'
import type { GuestSheetErrorCode } from '@/lib/guest-sheet'
import { isMissingRelation } from '@/lib/guest-sheets-data'
import { tenantHref } from '@/lib/operator'
import { createClient } from '@/lib/supabase/server'
import { belongsToDeactivatedTenant, getTenantContext } from '@/lib/tenant'
import { establishmentNumbersSchema, type EstablishmentNumbersInput, sheetRangeSchema, type SheetRangeInput } from '@/lib/validation/guest-sheet'

// Kennzahl und Gästeblattnummer je Gemeinde (PROJ-26, Erweiterung 2026-11-09): Kennzahlen (Einstellungen → Stammdaten),
// Nummernbereiche und Schalter „Gästeblätter nacherfassen“ (Einstellungen → Gästeblatt). Für Inhaber (gewählter Kunde)
// und Betreiber (Kunden-Detailseite). Gespeichert wird nur über Datenbank-Funktionen; sie prüfen Rolle, 2FA des
// Betreibers, Aktiv-Status, Stand, Überschneidungen und Nummernregel selbst.

type ErrorCode = GuestSheetErrorCode | CommonErrorCode | 'tenantDeactivated'
type Result<T = undefined> = ActionResult<T, ErrorCode>
const fail = (error: ErrorCode): { ok: false; error: ErrorCode } => ({ ok: false, error })
const key = (k: string) => k
const isId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value)
const isStamp = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length < 64
const isCode = (value: unknown): value is string => typeof value === 'string' && /^[1-9][0-9]{4}$/.test(value)

const DB_ERRORS: Record<string, ErrorCode> = {
  '42501': 'sessionExpired',
  P0016: 'tenantDeactivated',
  P0982: 'staleRange',
  P0983: 'rangeOverlaps',
  P0984: 'rangeInvalid',
  P0985: 'rangeLocked',
}

function dbFail(error: { code?: string; message?: string }, context: string) {
  if (isMissingRelation(error)) return fail('notImplemented')
  const mapped = error.code ? DB_ERRORS[error.code] : undefined
  if (!mapped) console.error(`[gaesteblatt] ${context}`, error.code, error.message)
  return fail(mapped ?? 'unknown')
}

async function guard(tenantId: unknown): Promise<{ ok: true; tenantId: string; operator: boolean } | ReturnType<typeof fail>> {
  if (!isId(tenantId)) return fail('unknown')
  const user = await getSessionUser()
  if (!user || (await pendingMfaStep(user))) return fail('sessionExpired')
  if (user.isOperatorAdmin) return { ok: true, tenantId, operator: true }
  const { active } = await getTenantContext()
  if (!active || active.role !== 'owner' || active.id !== tenantId) {
    return fail((await belongsToDeactivatedTenant()) ? 'tenantDeactivated' : 'unknown')
  }
  return { ok: true, tenantId, operator: false }
}

const untyped = async () => (await createClient()) as unknown as SupabaseClient

function refresh(tenantId: string, operator: boolean) {
  if (operator) revalidatePath(tenantHref(tenantId))
  revalidatePath('/einstellungen/stammdaten')
  revalidatePath('/einstellungen/gaesteblatt')
  // Hinweise im Dashboard und im Buchungsdetail, Feld im Buchungsformular
  revalidatePath('/')
  revalidatePath('/buchungen', 'layout')
}

// Kennzahlen aller angezeigten Gemeinden auf einmal; leere Kennzahl = keine
export async function saveEstablishmentNumbers(values: { tenantId: string; data: EstablishmentNumbersInput }): Promise<Result> {
  const parsed = establishmentNumbersSchema(key).safeParse(values?.data)
  if (!parsed.success) return fail('unknown')
  const g = await guard(values.tenantId)
  if (!g.ok) return g
  const supabase = await untyped()
  const { error } = await supabase.rpc('save_establishment_numbers', {
    p_tenant_id: g.tenantId,
    p_items: parsed.data.items.map((i) => ({ municipality_code: i.code, establishment_number: i.number })),
  })
  if (error) return dbFail(error, 'Kennzahlen speichern')
  refresh(g.tenantId, g.operator)
  return { ok: true }
}

// Anlegen (id null, hinten angereiht) oder Ändern (id + Stand). „Nächste Nummer“ nur beim ersten bzw. laufenden Bereich;
// die Datenbank prüft Überschneidungen und Grenzen erneut (die Prüfung im Formular kennt nur den geladenen Stand)
export async function saveSheetNumberRange(values: {
  tenantId: string
  municipalityCode: string
  id: string | null
  updatedAt: string | null
  range: SheetRangeInput
}): Promise<Result> {
  const parsed = sheetRangeSchema(key).safeParse(values?.range)
  const editing = values?.id !== null
  if (!parsed.success || !isCode(values?.municipalityCode) || (editing && (!isId(values?.id) || !isStamp(values?.updatedAt)))) return fail('unknown')
  const g = await guard(values.tenantId)
  if (!g.ok) return g
  const supabase = await untyped()
  const { error } = await supabase.rpc('save_guest_sheet_number_range', {
    p_input: {
      tenant_id: g.tenantId,
      municipality_code: values.municipalityCode,
      id: values.id,
      updated_at: values.updatedAt,
      range_from: parsed.data.from,
      range_to: parsed.data.to,
      next_number: parsed.data.next || null,
    },
  })
  if (error) return dbFail(error, 'Nummernbereich speichern')
  refresh(g.tenantId, g.operator)
  return { ok: true }
}

// Nur folgende Bereiche (noch keine Nummer vergeben) lassen sich löschen
export async function deleteSheetNumberRange(values: { tenantId: string; id: string; updatedAt: string }): Promise<Result> {
  if (!isId(values?.id) || !isStamp(values?.updatedAt)) return fail('unknown')
  const g = await guard(values.tenantId)
  if (!g.ok) return g
  const supabase = await untyped()
  const { error } = await supabase.rpc('delete_guest_sheet_number_range', { p_id: values.id, p_expected_updated_at: values.updatedAt })
  if (error) return dbFail(error, 'Nummernbereich löschen')
  refresh(g.tenantId, g.operator)
  return { ok: true }
}

// Schalter „Gästeblätter nacherfassen“: Feld „Gästeblattnummer“ im Buchungsformular und „Gästeblatt hochladen“
export async function saveGuestSheetBackfill(values: { tenantId: string; enabled: boolean }): Promise<Result> {
  if (typeof values?.enabled !== 'boolean') return fail('unknown')
  const g = await guard(values.tenantId)
  if (!g.ok) return g
  const supabase = await untyped()
  const { error } = await supabase.rpc('save_guest_sheet_backfill', { p_tenant_id: g.tenantId, p_enabled: values.enabled })
  if (error) return dbFail(error, 'Schalter speichern')
  refresh(g.tenantId, g.operator)
  return { ok: true }
}
