'use server'

import { revalidatePath } from 'next/cache'

import type { ActionResult, CommonErrorCode } from '@/lib/auth/result'
import { getSessionUser, pendingMfaStep } from '@/lib/auth/session'
import { type DuplicateMatch, type DuplicateReason, type Guest, type GuestErrorCode, type GuestRow, MERGE_FIELDS, type MergeChoice } from '@/lib/guests'
import { GUEST_COLUMNS, toGuest, toRow } from '@/lib/guests-data'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext, type TenantSummary } from '@/lib/tenant'
import { guestSchema, type GuestInput, type GuestValues } from '@/lib/validation/guests'

// Server-Aktionen der Gäste-Datenbank (PROJ-7). Lesen: alle Mitglieder; Anlegen, Ändern, Zusammenführen und
// Löschen: nur Inhaber (Mitarbeiter legen Gäste nur zusammen mit einer Buchung an, PROJ-8).
// Alle Änderungen laufen im Namen der Person: Die Datenbank-Regeln (RLS, Funktionen mit Rollenprüfung)
// entscheiden zusätzlich und liefern die Fehler, die hier in Meldungen übersetzt werden.

type Result<T = undefined> = ActionResult<T, GuestErrorCode>
type Failure = { ok: false; error: GuestErrorCode | CommonErrorCode }
type DbError = { code?: string; message?: string }

const key = (k: string) => k
const fail = (error: GuestErrorCode | CommonErrorCode): Failure => ({ ok: false, error })
const isId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value)
const SEARCH_LIMIT = 10
const LIST = '/gaeste'

async function requireMember(): Promise<{ ok: true; tenant: TenantSummary } | Failure> {
  const user = await getSessionUser()
  if (!user || (await pendingMfaStep(user))) return fail('sessionExpired')
  const { active } = await getTenantContext()
  if (!active) return fail('unknown')
  return { ok: true, tenant: active }
}

async function requireOwner(): Promise<{ ok: true; tenant: TenantSummary } | Failure> {
  const guard = await requireMember()
  if (!guard.ok) return guard
  return guard.tenant.role === 'owner' ? guard : fail('ownerOnly')
}

// Fehler der Datenbank → Meldung (Codes siehe supabase/migrations/20261026120000_guests.sql)
function dbFail(error: DbError, context: string): Failure {
  switch (error.code) {
    case 'P0701':
    case '42501':
      return fail('ownerOnly')
    case 'P0702':
      return fail('notFound')
    case 'P0703':
      return fail('guestAnonymized')
    case 'P0704':
      return fail('mergeInvalid')
  }
  console.error(`[gaeste] ${context}`, error.code, error.message)
  return fail('unknown')
}

const columns = (v: GuestValues) => ({
  last_name: v.lastName,
  first_name: v.firstName,
  country: v.country,
  email: v.email,
  phone: v.phone,
  language: v.language,
  birth_date: v.birthDate,
  street: v.street,
  postal_code: v.postalCode,
  city: v.city,
  address_country: v.addressCountry,
  marketing_source: v.marketingSource,
  marketing_custom: v.marketingCustom,
  company_name: v.companyName,
  company_vat_id: v.companyVatId,
  company_billing_address: v.companyBillingAddress,
  note: v.note,
})

const revalidate = (id?: string) => {
  revalidatePath(LIST)
  if (id) revalidatePath(`${LIST}/${id}`)
}

// Mögliche Doppeleinträge vor dem Anlegen (Warnung mit „Bestehenden Gast öffnen“ / „Trotzdem anlegen“)
export async function checkGuestDuplicates(values: GuestInput): Promise<Result<DuplicateMatch[]>> {
  const parsed = guestSchema(key).safeParse(values)
  if (!parsed.success) return fail('unknown')
  const guard = await requireOwner()
  if (!guard.ok) return guard
  const v = parsed.data
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('guest_duplicate_candidates', {
    p_tenant_id: guard.tenant.id,
    p_last_name: v.lastName,
    p_first_name: v.firstName ?? '',
    p_email: v.email ?? '',
    p_phone: v.phone ?? '',
  })
  if (error) return dbFail(error, 'Dublettenprüfung')
  if (!data?.length) return { ok: true, data: [] }
  const { data: guests } = await supabase.from('guests').select(GUEST_COLUMNS).in('id', data.map((d) => d.id))
  const byId = new Map((guests ?? []).map((g) => [g.id, toRow(toGuest(g))]))
  return {
    ok: true,
    data: data.filter((d) => byId.has(d.id)).map((d) => ({ guest: byId.get(d.id)!, reasons: d.reasons as DuplicateReason[] })),
  }
}

export async function createGuest(values: GuestInput): Promise<Result<{ id: string }>> {
  const parsed = guestSchema(key).safeParse(values)
  if (!parsed.success) return fail('unknown')
  const guard = await requireOwner()
  if (!guard.ok) return guard
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('guests')
    .insert({ tenant_id: guard.tenant.id, ...columns(parsed.data) })
    .select('id')
    .single()
  if (error || !data) return dbFail(error ?? {}, 'Gast nicht angelegt')
  revalidate()
  return { ok: true, data: { id: data.id } }
}

// updatedAt: Stand beim Öffnen des Formulars. Wurde der Gast seitdem geändert → „staleGuest“
export async function updateGuest(values: { id: string; updatedAt: string } & GuestInput): Promise<Result> {
  const parsed = guestSchema(key).safeParse(values)
  if (!isId(values?.id) || typeof values?.updatedAt !== 'string' || !parsed.success) return fail('unknown')
  const guard = await requireOwner()
  if (!guard.ok) return guard
  const supabase = await createClient()
  // Selbst geänderte Kontaktangaben gelten als „direkt erfasst“, auch wenn der alte Wert von der Plattform kam
  const { data: before } = await supabase
    .from('guests')
    .select('email, phone')
    .eq('id', values.id)
    .eq('tenant_id', guard.tenant.id)
    .maybeSingle()
  const sources = {
    ...(before && before.email !== parsed.data.email ? { email_source: 'direct' } : {}),
    ...(before && before.phone !== parsed.data.phone ? { phone_source: 'direct' } : {}),
  }
  const { data, error } = await supabase
    .from('guests')
    .update({ ...columns(parsed.data), ...sources })
    .eq('id', values.id)
    .eq('tenant_id', guard.tenant.id)
    .eq('updated_at', values.updatedAt)
    .select('id')
  if (error) return dbFail(error, 'Gast nicht geändert')
  if (!data?.length) {
    // Kein Treffer: inzwischen geändert, anonymisiert oder gelöscht?
    const { data: current } = await supabase
      .from('guests')
      .select('anonymized_at')
      .eq('id', values.id)
      .eq('tenant_id', guard.tenant.id)
      .maybeSingle()
    if (!current) return fail('notFound')
    return fail(current.anonymized_at ? 'guestAnonymized' : 'staleGuest')
  }
  revalidate(values.id)
  return { ok: true }
}

// Ohne Buchungen endgültig löschen, mit Buchungen anonymisieren (die Datenbank entscheidet)
export async function deleteGuest(values: { id: string }): Promise<Result<{ mode: 'deleted' | 'anonymized' }>> {
  if (!isId(values?.id)) return fail('unknown')
  const guard = await requireOwner()
  if (!guard.ok) return guard
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('delete_guest', { p_guest_id: values.id })
  if (error) return dbFail(error, 'Gast nicht gelöscht')
  if (data === 'anonymized') {
    revalidate(values.id)
    return { ok: true, data: { mode: 'anonymized' } }
  }
  // Endgültig gelöscht: nichts neu laden – die Detailseite würde sonst „Seite nicht gefunden“ zeigen.
  // Die Oberfläche wechselt mit frischem Laden zur Liste (wie BUG-4 aus QA PROJ-5).
  return { ok: true, data: { mode: 'deleted' }, redirectTo: `${LIST}?geloescht=1` }
}

// keepId bleibt mit den gewählten Werten, removeId wird entfernt (seine Buchungen gehen auf keepId über)
export async function mergeGuests(values: { keepId: string; removeId: string; choice: MergeChoice }): Promise<Result> {
  const choice = values?.choice
  const validChoice =
    choice && typeof choice === 'object' && MERGE_FIELDS.every((f) => choice[f] === 'a' || choice[f] === 'b')
  if (!isId(values?.keepId) || !isId(values?.removeId) || !validChoice) return fail('unknown')
  if (values.keepId === values.removeId) return fail('mergeInvalid')
  const guard = await requireOwner()
  if (!guard.ok) return guard
  const supabase = await createClient()
  const cleanChoice = Object.fromEntries(MERGE_FIELDS.map((f) => [f, choice[f]]))
  const { error } = await supabase.rpc('merge_guests', { p_keep: values.keepId, p_remove: values.removeId, p_choice: cleanChoice })
  if (error) return dbFail(error, 'Zusammenführen fehlgeschlagen')
  revalidate(values.keepId)
  revalidatePath(`${LIST}/dubletten`)
  return { ok: true }
}

// „Kein Doppeleintrag“: Vorschlag dauerhaft ausblenden
export async function dismissDuplicate(values: { aId: string; bId: string }): Promise<Result> {
  if (!isId(values?.aId) || !isId(values?.bId) || values.aId === values.bId) return fail('unknown')
  const guard = await requireOwner()
  if (!guard.ok) return guard
  // Paar in fester Reihenfolge (wie in der Datenbank verlangt)
  const [a, b] = [values.aId, values.bId].sort()
  const supabase = await createClient()
  const { error } = await supabase.from('guest_duplicate_dismissals').insert({ tenant_id: guard.tenant.id, guest_a: a, guest_b: b })
  // Schon abgelehnt (z. B. Doppelklick): kein Fehler
  if (error && error.code !== '23505') return dbFail(error, 'Vorschlag nicht ausgeblendet')
  revalidatePath(`${LIST}/dubletten`)
  revalidatePath(LIST)
  return { ok: true }
}

// Gastsuche (Auswahl des zweiten Gastes beim Zusammenführen; später auch im Buchungsformular, PROJ-8)
export async function searchGuests(values: { query: string; excludeId?: string }): Promise<Result<GuestRow[]>> {
  const guard = await requireMember()
  if (!guard.ok) return guard
  const query = String(values?.query ?? '').slice(0, 200)
  if (query.trim().length < 2) return { ok: true, data: [] }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('guest_list', {
    p_tenant_id: guard.tenant.id,
    p_query: query,
    p_limit: SEARCH_LIMIT + 1,
    p_offset: 0,
  })
  if (error) return dbFail(error, 'Gastsuche')
  const rows = (data ?? [])
    .filter((r) => r.id !== values?.excludeId && r.anonymized_at === null)
    .slice(0, SEARCH_LIMIT)
    .map(
      (r): GuestRow => ({
        id: r.id,
        lastName: r.last_name,
        firstName: r.first_name,
        companyName: r.company_name,
        country: r.country,
        stayCount: r.stay_count,
        lastStay: r.last_stay,
        anonymized: false,
      })
    )
  return { ok: true, data: rows }
}

// Vollständige Angaben eines Gastes (zweiter Gast im Zusammenführen-Dialog)
export async function loadGuest(values: { id: string }): Promise<Result<Guest>> {
  if (!isId(values?.id)) return fail('unknown')
  const guard = await requireOwner()
  if (!guard.ok) return guard
  const supabase = await createClient()
  const { data, error } = await supabase.from('guests').select(GUEST_COLUMNS).eq('id', values.id).eq('tenant_id', guard.tenant.id).maybeSingle()
  if (error) return dbFail(error, 'Gast nicht lesbar')
  return data ? { ok: true, data: toGuest(data) } : fail('notFound')
}
