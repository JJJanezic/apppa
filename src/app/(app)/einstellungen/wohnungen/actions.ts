'use server'

import { revalidatePath } from 'next/cache'

import {
  type ApartmentErrorCode,
  type FederalState,
  type Municipality,
  municipalitySearchKey,
} from '@/lib/apartments'
import type { ActionResult, CommonErrorCode } from '@/lib/auth/result'
import { getSessionUser, pendingMfaStep } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext, type TenantSummary } from '@/lib/tenant'
import {
  apartmentSchema,
  NEW_PROPERTY,
  propertySchema,
  type ApartmentInput,
  type PropertyInput,
} from '@/lib/validation/apartments'

// Server-Aktionen für „Einstellungen → Wohnungen“ (PROJ-6), nur für Inhaber des gewählten Kunden.
// Alle Änderungen laufen im Namen der Person: Die Datenbank-Regeln (RLS, Eindeutigkeit, Fremdschlüssel)
// entscheiden zusätzlich und liefern die Fehler, die hier in Meldungen übersetzt werden.

type Result<T = undefined> = ActionResult<T, ApartmentErrorCode>
type Failure = { ok: false; error: ApartmentErrorCode | CommonErrorCode }
type DbError = { code?: string; message?: string }

const key = (k: string) => k
const fail = (error: ApartmentErrorCode | CommonErrorCode): Failure => ({ ok: false, error })
const isId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value)
const PAGE = '/einstellungen/wohnungen'

async function requireOwner(): Promise<{ ok: true; tenant: TenantSummary } | Failure> {
  const user = await getSessionUser()
  if (!user || (await pendingMfaStep(user))) return fail('sessionExpired')
  const { active } = await getTenantContext()
  if (!active || active.role !== 'owner') return fail('unknown')
  return { ok: true, tenant: active }
}

// Fehler der Datenbank → Meldung (Namen der Regeln siehe supabase/migrations/20261024140000_properties_apartments.sql)
function dbFail(error: DbError, context: string): Failure {
  const message = error.message ?? ''
  if (error.code === '23505' && message.includes('apartments_property_name_key')) return fail('duplicateApartmentName')
  if (error.code === '23505' && message.includes('properties_tenant_name_key')) return fail('duplicatePropertyName')
  if (error.code === '23503' && message.includes('municipality')) return fail('municipalityInvalid')
  if (error.code === '23503' && message.includes('apartments_property_fkey')) return fail('propertyInUse')
  // Ab PROJ-8: Buchungen verweisen auf die Wohnung
  if (error.code === '23503' && message.includes('apartment')) return fail('apartmentHasBookings')
  console.error(`[wohnungen] ${context}`, error.code, message)
  return fail('unknown')
}

// Nur aktuelle Gemeinden (nicht aufgelöste) dürfen neu zugeordnet werden
async function isCurrentMunicipality(code: string): Promise<boolean> {
  const supabase = await createClient()
  const { data } = await supabase.from('municipalities').select('code').eq('code', code).is('valid_until', null).maybeSingle()
  return Boolean(data)
}

const apartmentColumns = (v: {
  name: string
  maxGuests: number
  kind: 'holiday' | 'service'
  price: number | null
  checkIn: string
  checkOut: string
  note: string | null
}) => ({
  name: v.name,
  max_guests: v.maxGuests,
  kind: v.kind,
  price_cents: v.price,
  check_in: v.checkIn,
  check_out: v.checkOut,
  note: v.note,
})

// Wohnung anlegen, bei „Neues Objekt“ samt Objekt in einem Datenbankvorgang
export async function createApartment(values: ApartmentInput): Promise<Result<{ id: string }>> {
  const parsed = apartmentSchema(key).safeParse(values)
  if (!parsed.success) return fail('unknown')
  const guard = await requireOwner()
  if (!guard.ok) return guard
  const v = parsed.data
  const supabase = await createClient()

  if (v.propertyId === NEW_PROPERTY && v.newProperty) {
    const p = v.newProperty
    if (!(await isCurrentMunicipality(p.municipalityCode))) return fail('municipalityInvalid')
    const { data, error } = await supabase.rpc('create_apartment_with_property', {
      p_tenant_id: guard.tenant.id,
      p_property_name: p.name,
      p_street: p.street,
      p_postal_code: p.postalCode,
      p_city: p.city,
      p_municipality_code: p.municipalityCode,
      p_name: v.name,
      p_max_guests: v.maxGuests,
      p_kind: v.kind,
      p_price_cents: v.price as number,
      p_check_in: v.checkIn,
      p_check_out: v.checkOut,
      p_note: v.note as string,
    })
    if (error || !data) return dbFail(error ?? {}, 'Wohnung mit Objekt nicht angelegt')
    revalidatePath(PAGE)
    return { ok: true, data: { id: data } }
  }

  const { data, error } = await supabase
    .from('apartments')
    .insert({ tenant_id: guard.tenant.id, property_id: v.propertyId, ...apartmentColumns(v) })
    .select('id')
    .single()
  if (error || !data) return dbFail(error ?? {}, 'Wohnung nicht angelegt')
  revalidatePath(PAGE)
  return { ok: true, data: { id: data.id } }
}

// Bearbeiten, auch Verschieben in ein anderes Objekt desselben Kunden (Fremdschlüssel prüft den Kunden)
export async function updateApartment(values: { id: string } & ApartmentInput): Promise<Result> {
  const parsed = apartmentSchema(key).safeParse(values)
  if (!isId(values?.id) || !parsed.success || parsed.data.propertyId === NEW_PROPERTY) return fail('unknown')
  const guard = await requireOwner()
  if (!guard.ok) return guard

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('apartments')
    .update({ property_id: parsed.data.propertyId, ...apartmentColumns(parsed.data) })
    .eq('id', values.id)
    .eq('tenant_id', guard.tenant.id)
    .select('id')
  if (error) return dbFail(error, 'Wohnung nicht geändert')
  if (!data?.length) return fail('notFound')
  revalidatePath(PAGE)
  return { ok: true }
}

export async function setApartmentArchived(values: { id: string; archived: boolean }): Promise<Result> {
  if (!isId(values?.id) || typeof values?.archived !== 'boolean') return fail('unknown')
  const guard = await requireOwner()
  if (!guard.ok) return guard

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('apartments')
    .update({ archived_at: values.archived ? new Date().toISOString() : null })
    .eq('id', values.id)
    .eq('tenant_id', guard.tenant.id)
    .select('id')
  if (error) return dbFail(error, 'Archivieren fehlgeschlagen')
  if (!data?.length) return fail('notFound')
  revalidatePath(PAGE)
  return { ok: true }
}

// Endgültig löschen; hat die Wohnung Buchungen (ab PROJ-8), verhindert es die Datenbank
export async function deleteApartment(values: { id: string }): Promise<Result> {
  if (!isId(values?.id)) return fail('unknown')
  const guard = await requireOwner()
  if (!guard.ok) return guard

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('apartments')
    .delete()
    .eq('id', values.id)
    .eq('tenant_id', guard.tenant.id)
    .select('id')
  if (error) return dbFail(error, 'Wohnung nicht gelöscht')
  if (!data?.length) return fail('notFound')
  revalidatePath(PAGE)
  return { ok: true }
}

export async function updateProperty(values: { id: string } & PropertyInput): Promise<Result> {
  const parsed = propertySchema(key).safeParse(values)
  if (!isId(values?.id) || !parsed.success) return fail('unknown')
  const guard = await requireOwner()
  if (!guard.ok) return guard
  const p = parsed.data

  const supabase = await createClient()
  // Bisherige Gemeinde darf bleiben, auch wenn sie inzwischen aufgelöst ist; eine neue muss aktuell sein
  const { data: current } = await supabase.from('properties').select('municipality_code').eq('id', values.id).maybeSingle()
  if (current?.municipality_code !== p.municipalityCode && !(await isCurrentMunicipality(p.municipalityCode))) {
    return fail('municipalityInvalid')
  }
  const { data, error } = await supabase
    .from('properties')
    .update({ name: p.name, street: p.street, postal_code: p.postalCode, city: p.city, municipality_code: p.municipalityCode })
    .eq('id', values.id)
    .eq('tenant_id', guard.tenant.id)
    .select('id')
  if (error) return dbFail(error, 'Objekt nicht geändert')
  if (!data?.length) return fail('notFound')
  revalidatePath(PAGE)
  return { ok: true }
}

// Nur ohne zugeordnete Wohnungen (auch archivierte) – sonst verhindert es die Datenbank
export async function deleteProperty(values: { id: string }): Promise<Result> {
  if (!isId(values?.id)) return fail('unknown')
  const guard = await requireOwner()
  if (!guard.ok) return guard

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('properties')
    .delete()
    .eq('id', values.id)
    .eq('tenant_id', guard.tenant.id)
    .select('id')
  if (error) return dbFail(error, 'Objekt nicht gelöscht')
  if (!data?.length) return fail('notFound')
  revalidatePath(PAGE)
  return { ok: true }
}

const MAX_RESULTS = 20

type MunicipalityRow = { code: string; name: string; state: string }
const toMunicipality = (m: MunicipalityRow): Municipality => ({ code: m.code, name: m.name, state: m.state as FederalState })

// Gemeindesuche: zuerst die Gemeinden zur eingegebenen PLZ, dann Treffer nach Name bzw. PLZ-Anfang (ab 2 Zeichen).
// Nur aktuelle Gemeinden; Namen, die mit dem Suchbegriff beginnen, stehen vorne.
export async function searchMunicipalities(values: {
  query: string
  postalCode?: string
}): Promise<Result<{ byPostalCode: Municipality[]; results: Municipality[] }>> {
  const guard = await requireOwner()
  if (!guard.ok) return guard
  const needle = municipalitySearchKey(String(values?.query ?? '').slice(0, 100))
  const postalCode = /^\d{4}$/.test(values?.postalCode ?? '') ? values.postalCode! : null
  const supabase = await createClient()

  const [byPostal, byName, byPostalPrefix] = await Promise.all([
    postalCode
      ? supabase
          .from('municipality_postal_codes')
          .select('municipality:municipalities!inner(code, name, state, valid_until)')
          .eq('postal_code', postalCode)
          .is('municipality.valid_until', null)
          .limit(MAX_RESULTS)
      : Promise.resolve({ data: [], error: null }),
    needle.length >= 2
      ? supabase
          .from('municipalities')
          .select('code, name, state')
          .is('valid_until', null)
          // needle enthält nur a–z, 0–9 und Leerzeichen (municipalitySearchKey) – keine Platzhalterzeichen
          .like('search_key', `%${needle}%`)
          .limit(100)
      : Promise.resolve({ data: [], error: null }),
    /^\d{2,4}$/.test(needle)
      ? supabase
          .from('municipality_postal_codes')
          .select('municipality:municipalities!inner(code, name, state, valid_until)')
          .like('postal_code', `${needle}%`)
          .is('municipality.valid_until', null)
          .limit(MAX_RESULTS)
      : Promise.resolve({ data: [], error: null }),
  ])
  for (const r of [byPostal, byName, byPostalPrefix]) {
    if (r.error) console.error('[wohnungen] Gemeindesuche', r.error.message)
  }

  const unique = (list: Municipality[]) => [...new Map(list.map((m) => [m.code, m])).values()]
  const sortByRelevance = (list: Municipality[]) =>
    list.sort((a, b) => {
      const aStarts = municipalitySearchKey(a.name).startsWith(needle) ? 0 : 1
      const bStarts = municipalitySearchKey(b.name).startsWith(needle) ? 0 : 1
      return aStarts - bStarts || a.name.localeCompare(b.name, 'de')
    })

  const postalMatches = unique((byPostal.data ?? []).map((r) => toMunicipality(r.municipality as MunicipalityRow))).sort((a, b) =>
    a.name.localeCompare(b.name, 'de')
  )
  const results = sortByRelevance(
    unique([
      ...(byName.data ?? []).map(toMunicipality),
      ...(byPostalPrefix.data ?? []).map((r) => toMunicipality(r.municipality as MunicipalityRow)),
    ])
  ).slice(0, MAX_RESULTS)

  return { ok: true, data: { byPostalCode: postalMatches, results } }
}

// Passt die PLZ laut Gemeindeliste zur gewählten Gemeinde? Nur ein Hinweis in der Oberfläche (BUG-2 aus QA) –
// es gibt Grenzfälle (Adressen nahe der Gemeindegrenze), daher kein Speicherverbot.
export async function postalCodeMatchesMunicipality(values: { postalCode: string; municipalityCode: string }): Promise<Result<boolean>> {
  if (!/^\d{4}$/.test(values?.postalCode ?? '') || !/^\d{5}$/.test(values?.municipalityCode ?? '')) return fail('unknown')
  const guard = await requireOwner()
  if (!guard.ok) return guard
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('municipality_postal_codes')
    .select('postal_code', { count: 'exact', head: true })
    .eq('postal_code', values.postalCode)
    .eq('municipality_code', values.municipalityCode)
  if (error) return dbFail(error, 'PLZ-Prüfung')
  return { ok: true, data: (count ?? 0) > 0 }
}
