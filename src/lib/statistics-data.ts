import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { isMissingRelation } from '@/lib/payments-data'
import { currentMonth, monthKey, type StatsApartment, type StatsMonthRow, type StatsFilters, type StatsOriginRow, statsRange, type StatsTenant } from '@/lib/statistics'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext } from '@/lib/tenant'

// Lesefunktionen der Auswertungen (PROJ-18). Seite, Exporte und Dashboard: nur Kunden, bei denen die Person Inhaber ist
// (refine 2026-11-08: alle Inhaber-Kunden oder ein einzelner). Die Datenbankfunktionen prüfen die Rolle zusätzlich selbst.
// Fehlen sie (Umgebung ohne Migration), melden die Abrufe „ready: false“.

const untyped = async () => (await createClient()) as unknown as SupabaseClient

// Höchstzahl je Abruf der Datenschnittstelle (Supabase „max rows“) und Obergrenze
const PAGE = 1000
const MAX_ROWS = 50_000

type Rpc = (offset: number) => PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }>
type Paged<T> = { ready: boolean; failed: boolean; rows: T[] }

// Seitenweise laden, bis eine Seite nicht voll ist
async function loadPaged<T>(page: Rpc, label: string): Promise<Paged<T>> {
  const rows: T[] = []
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE) {
    const { data, error } = await page(offset)
    if (error) {
      if (isMissingRelation(error)) return { ready: false, failed: false, rows: [] }
      console.error(`[auswertungen] ${label} nicht lesbar`, error.message)
      return { ready: true, failed: true, rows: [] }
    }
    const part = (data ?? []) as T[]
    rows.push(...part)
    if (part.length < PAGE) break
  }
  return { ready: true, failed: false, rows }
}

// ---- Inhaber-Kunden und ihre Wohnungen (Auswahl, Gruppierung) ----------------------------------

// Aktive Kunden, bei denen die Person Inhaber ist, alphabetisch
export async function getOwnedTenants(): Promise<StatsTenant[]> {
  const { list } = await getTenantContext()
  return list.filter((t) => t.role === 'owner').map((t) => ({ id: t.id, name: t.name }))
}

type ApartmentDb = { id: string; name: string; tenant_id: string; archived_at: string | null; property: { id: string; name: string } }

export async function getStatsApartments(tenants: readonly StatsTenant[]): Promise<StatsApartment[]> {
  if (tenants.length === 0) return []
  const names = new Map(tenants.map((t) => [t.id, t.name]))
  const supabase = await untyped()
  const { data, error } = await supabase
    .from('apartments')
    .select('id, name, tenant_id, archived_at, property:properties!inner(id, name)')
    .in('tenant_id', [...names.keys()])
    .limit(2000)
  if (error) {
    console.error('[auswertungen] Wohnungen nicht lesbar', error.message)
    return []
  }
  return ((data ?? []) as unknown as ApartmentDb[]).map((a) => ({
    id: a.id,
    name: a.name,
    propertyId: a.property.id,
    propertyName: a.property.name,
    archived: a.archived_at !== null,
    tenantId: a.tenant_id,
    tenantName: names.get(a.tenant_id) ?? '',
  }))
}

// ---- Grundzahlen je Wohnung und Monat -------------------------------------------------------

type MonthDb = {
  apartment_id: string
  // erster Tag des Monats
  month: string
  available_nights: number
  occupied_nights: number
  blocked_nights: number
  revenue_cents: number | string
  revenue_vat_cents: number | string
  fee_cents: number | string
  fee_vat_cents: number | string
  guest_nights: number
  arrivals: number
  bookings: number
  stay_nights: number
}

export const mapMonthRow = (r: MonthDb): StatsMonthRow => ({
  apartmentId: r.apartment_id,
  month: r.month.slice(0, 7),
  availableNights: r.available_nights,
  occupiedNights: r.occupied_nights,
  blockedNights: r.blocked_nights,
  revenueCents: Number(r.revenue_cents),
  revenueVatCents: Number(r.revenue_vat_cents),
  feeCents: Number(r.fee_cents),
  feeVatCents: Number(r.fee_vat_cents),
  guestNights: r.guest_nights,
  arrivals: r.arrivals,
  bookings: r.bookings,
  stayNights: r.stay_nights,
})

type OriginDb = { apartment_id: string; country: string; previous: boolean; arrivals: number; guest_nights: number; revenue_cents: number | string }

export const mapOriginRow = (r: OriginDb): StatsOriginRow => ({
  apartmentId: r.apartment_id,
  country: r.country,
  previous: r.previous,
  arrivals: r.arrivals,
  guestNights: r.guest_nights,
  revenueCents: Number(r.revenue_cents),
})

export type StatsData = {
  ready: boolean
  failed: boolean
  // Inhaber-Kunden der Person (Auswahl)
  tenants: StatsTenant[]
  apartments: StatsApartment[]
  rows: StatsMonthRow[]
  origin: StatsOriginRow[]
}

// Alles für Seite, PDF und CSV: Inhaber-Kunden, deren Wohnungen, Zeilen je Wohnung und Monat (Zeitraum und Vorjahr) und
// Herkunft. Abgefragt werden der gewählte Kunde (wenn er ein Inhaber-Kunde ist) bzw. alle Inhaber-Kunden; Objekt- und
// Wohnungsfilter wendet die Regeldatei an (gleiche Daten für Auswahl und Anzeige).
export async function getStatsData(filters: StatsFilters, { origin = true }: { origin?: boolean } = {}): Promise<StatsData> {
  const tenants = await getOwnedTenants()
  if (tenants.length === 0) return { ready: true, failed: false, tenants, apartments: [], rows: [], origin: [] }
  const ids = filters.tenant && tenants.some((t) => t.id === filters.tenant) ? [filters.tenant] : tenants.map((t) => t.id)
  const { from, to } = statsRange(filters)
  const supabase = await untyped()
  const args = { p_tenant_ids: ids, p_from: from, p_to: to }
  const [apartments, months, countries] = await Promise.all([
    getStatsApartments(tenants),
    loadPaged<MonthDb>((offset) => supabase.rpc('statistics_tenant_rows', args).range(offset, offset + PAGE - 1), 'Zeilen je Wohnung und Monat'),
    origin
      ? loadPaged<OriginDb>((offset) => supabase.rpc('statistics_tenant_origin', args).range(offset, offset + PAGE - 1), 'Gästeherkunft')
      : Promise.resolve<Paged<OriginDb>>({ ready: true, failed: false, rows: [] }),
  ])
  return {
    ready: months.ready && countries.ready,
    failed: months.failed || countries.failed,
    tenants,
    apartments,
    rows: months.rows.map(mapMonthRow),
    origin: countries.rows.map(mapOriginRow),
  }
}

// ---- Dashboard ------------------------------------------------------------------------------

export type DashboardStats = {
  ready: boolean
  failed: boolean
  availableNights: number
  occupiedNights: number
  revenueCents: number
  vatCents: number
}

type DashboardDb = { tenant_id: string; available_nights: number; occupied_nights: number; revenue_cents: number | string; vat_cents: number | string }

// Auslastung und Umsatz des laufenden Monats über die angegebenen Kunden (nur solche, bei denen die Person Inhaber ist)
export async function getDashboardStats(ownedTenantIds: readonly string[], today: string): Promise<DashboardStats> {
  const empty: DashboardStats = { ready: true, failed: false, availableNights: 0, occupiedNights: 0, revenueCents: 0, vatCents: 0 }
  if (ownedTenantIds.length === 0) return empty
  const supabase = await untyped()
  const month = `${monthKey(Number(today.slice(0, 4)), currentMonth(today))}-01`
  const { data, error } = await supabase.rpc('dashboard_statistics', { p_tenant_ids: ownedTenantIds, p_month: month })
  if (error) {
    if (isMissingRelation(error)) return { ...empty, ready: false }
    console.error('[dashboard] Auslastung und Umsatz nicht lesbar', error.message)
    return { ...empty, failed: true }
  }
  return ((data ?? []) as DashboardDb[]).reduce(
    (s, r) => ({
      ...s,
      availableNights: s.availableNights + r.available_nights,
      occupiedNights: s.occupiedNights + r.occupied_nights,
      revenueCents: s.revenueCents + Number(r.revenue_cents),
      vatCents: s.vatCents + Number(r.vat_cents),
    }),
    empty
  )
}
