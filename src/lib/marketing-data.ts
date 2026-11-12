import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import {
  dropMissingPlaces,
  filtersOf,
  MARKETING_PAGE_SIZE,
  type MarketingFilters,
  type MarketingPage,
  type MarketingRow,
  type MarketingView,
  parseSegmentFilters,
  type Segment,
} from '@/lib/marketing'
import { createClient } from '@/lib/supabase/server'

// Lesefunktionen der Seite „Marketing“ (PROJ-52) für den gewählten Kunden, im Namen der Person. Die Datenbank-Abfrage
// marketing_guest_list prüft die Inhaber-Rolle selbst und gibt nur Gäste mit Einwilligung „Erteilt“ und eigener
// Kontaktmöglichkeit heraus, ohne Plattform-E-Mail und -Telefon. Fehlt sie (bis /backend), meldet die Seite „ready: false“.

const MISSING = new Set(['42P01', '42703', '42883', 'PGRST200', 'PGRST202', 'PGRST204', 'PGRST205'])
export const isMissingRelation = (error: { code?: string } | null) => Boolean(error?.code && MISSING.has(error.code))

const untyped = async () => (await createClient()) as unknown as SupabaseClient

// Objekte mit ihren Wohnungen (Auswahl im Filter); archivierte Wohnungen gekennzeichnet
export type MarketingProperty = { id: string; name: string; apartments: { id: string; name: string; archived: boolean }[] }

type ApartmentDb = { id: string; name: string; archived_at: string | null; property: { id: string; name: string } }

export async function getMarketingPlaces(tenantId: string): Promise<MarketingProperty[]> {
  const supabase = await untyped()
  const { data, error } = await supabase
    .from('apartments')
    .select('id, name, archived_at, property:properties!inner(id, name)')
    .eq('tenant_id', tenantId)
    .order('name')
    .limit(2000)
  if (error) {
    console.error('[marketing] Wohnungen nicht lesbar', error.message)
    return []
  }
  const byProperty = new Map<string, MarketingProperty>()
  for (const a of (data ?? []) as unknown as ApartmentDb[]) {
    const p = byProperty.get(a.property.id) ?? { id: a.property.id, name: a.property.name, apartments: [] }
    p.apartments.push({ id: a.id, name: a.name, archived: a.archived_at !== null })
    byProperty.set(a.property.id, p)
  }
  return [...byProperty.values()].sort((a, b) => a.name.localeCompare(b.name, 'de'))
}

type SegmentDb = { id: string; name: string; filters: unknown; updated_at: string }

// Segmente des Kunden, alphabetisch; null = Tabelle fehlt noch (bis /backend)
export async function getSegments(tenantId: string): Promise<Segment[] | null> {
  const supabase = await untyped()
  const { data, error } = await supabase
    .from('marketing_segments')
    .select('id, name, filters, updated_at')
    .eq('tenant_id', tenantId)
    .order('name')
    .limit(500)
  if (error) {
    if (!isMissingRelation(error)) console.error('[marketing] Segmente nicht lesbar', error.message)
    return null
  }
  return ((data ?? []) as SegmentDb[]).map((s) => ({ id: s.id, name: s.name, filters: parseSegmentFilters(s.filters), updatedAt: s.updated_at }))
}

// Filter für die Datenbank (jsonb); dieselbe Form speichern Segmente
export const filtersPayload = (f: MarketingFilters) => ({
  from: f.from,
  to: f.to,
  minStays: f.minStays,
  properties: f.properties,
  apartments: f.apartments,
  sources: f.sources,
  countries: f.countries,
  languages: f.languages,
  reach: f.reach,
})

type RowDb = {
  id: string
  last_name: string
  first_name: string | null
  title_prefix: string | null
  title_suffix: string | null
  gender: string | null
  company_name: string | null
  email: string | null
  phone: string | null
  street: string | null
  postal_code: string | null
  city: string | null
  address_country: string | null
  language: string | null
  stay_count: number
  last_stay: string | null
  consent_on: string
}
type ListDb = { total: number; without_contact: number; rows: RowDb[] }

export const toMarketingRow = (r: RowDb): MarketingRow => ({
  id: r.id,
  lastName: r.last_name,
  firstName: r.first_name,
  titlePrefix: r.title_prefix,
  titleSuffix: r.title_suffix,
  gender: r.gender,
  companyName: r.company_name,
  email: r.email,
  phone: r.phone,
  street: r.street,
  postalCode: r.postal_code,
  city: r.city,
  country: r.address_country,
  language: r.language,
  stayCount: r.stay_count,
  lastStay: r.last_stay,
  consentOn: r.consent_on,
})

// Eine Seite Treffer samt Gesamtzahl und Zahl der Gäste ohne eigene Kontaktdaten. limit null = alle (Export).
export async function queryMarketingGuests(
  supabase: SupabaseClient,
  tenantId: string,
  filters: MarketingFilters,
  page: { limit: number | null; offset: number }
): Promise<{ ok: true; data: ListDb } | { ok: false; missing: boolean }> {
  const { data, error } = await supabase.rpc('marketing_guest_list', {
    p_tenant_id: tenantId,
    p_filters: filtersPayload(filters),
    p_limit: page.limit,
    p_offset: page.offset,
  })
  if (error) {
    if (!isMissingRelation(error)) console.error('[marketing] Gäste nicht lesbar', error.code, error.message)
    return { ok: false, missing: isMissingRelation(error) }
  }
  return { ok: true, data: data as ListDb }
}

export async function getMarketingPage(tenantId: string, view: MarketingView): Promise<MarketingPage> {
  const supabase = await untyped()
  const empty = { rows: [], total: 0, withoutContact: 0, page: 1, pageCount: 1 }
  const load = (page: number) =>
    queryMarketingGuests(supabase, tenantId, filtersOf(view), { limit: MARKETING_PAGE_SIZE, offset: (page - 1) * MARKETING_PAGE_SIZE })
  let page = view.page
  let result = await load(page)
  if (!result.ok) return { ...empty, ready: !result.missing }
  const pageCount = Math.max(1, Math.ceil(result.data.total / MARKETING_PAGE_SIZE))
  // Seite hinter dem Ende (alter Link, Filter geändert): letzte Seite zeigen
  if (page > pageCount) {
    page = pageCount
    result = await load(page)
    if (!result.ok) return { ...empty, ready: !result.missing }
  }
  return {
    rows: (result.data.rows ?? []).map(toMarketingRow),
    total: result.data.total,
    withoutContact: result.data.without_contact,
    page,
    pageCount,
    ready: true,
  }
}

// Objekte und Wohnungen, die es nicht mehr gibt, aus den Filtern entfernen
export function cleanPlaces(view: MarketingView, places: MarketingProperty[]): { view: MarketingView; dropped: boolean } {
  const known = {
    properties: new Set(places.map((p) => p.id)),
    apartments: new Set(places.flatMap((p) => p.apartments.map((a) => a.id))),
  }
  const { filters, dropped } = dropMissingPlaces(filtersOf(view), known)
  return { view: { ...view, ...filters }, dropped }
}
