import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { cache } from 'react'

import { apartmentLabel } from '@/lib/apartments'
import { type BookingKind, type BookingSource, bookingState, nightsBetween, personCount } from '@/lib/bookings'
import {
  type BillingState,
  byApartment,
  DASHBOARD_COOKIE,
  type OpenInvoiceRow,
  parseTenantFilter,
  sortOpenInvoices,
  type TaxMonthRow,
  taxPeriods,
  type TodayOverview,
  type TodayRow,
  UNBILLED_SHOWN,
  type UnbilledRow,
} from '@/lib/dashboard'
import { guestDisplayName } from '@/lib/guests'
import { isMissingRelation } from '@/lib/payments-data'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext, type TenantSummary } from '@/lib/tenant'

// Lesefunktionen des Dashboards (PROJ-14) über alle Kunden der Person. Die App fragt nur Kunden ab, bei denen die Person
// Mitglied (bzw. für Inhaber-Abschnitte Inhaber) ist; die Datenbank prüft das zusätzlich selbst (RLS bzw. Prüfung in den
// Funktionen). Fehlen die Datenbank-Funktionen (Umgebung ohne Migration), melden die Abschnitte „ready: false“.

const untyped = async () => (await createClient()) as unknown as SupabaseClient

export type DashboardScope = {
  // Alle aktiven Kunden der Person (alphabetisch) und der gewählte Kunde der übrigen Seiten
  tenants: TenantSummary[]
  activeTenantId: string | null
  // Kundenfilter des Dashboards; null = „Alle Kunden“
  filter: string | null
  // Kunden im Filter bzw. davon die, bei denen die Person Inhaber ist
  scope: TenantSummary[]
  owned: TenantSummary[]
  // Kundennamen anzeigen (mehr als ein Kunde im Filter)
  showTenant: boolean
}

export const getDashboardScope = cache(async (param: string | string[] | undefined): Promise<DashboardScope> => {
  const { list, active } = await getTenantContext()
  const filter = parseTenantFilter(
    param,
    (await cookies()).get(DASHBOARD_COOKIE)?.value,
    list.map((t) => t.id)
  )
  const scope = filter ? list.filter((t) => t.id === filter) : list
  return {
    tenants: list,
    activeTenantId: active?.id ?? null,
    filter,
    scope,
    owned: scope.filter((t) => t.role === 'owner'),
    showTenant: scope.length > 1,
  }
})

const ids = (tenants: readonly TenantSummary[]) => tenants.map((t) => t.id)
const nameOf = (s: DashboardScope, tenantId: string) => (s.showTenant ? (s.tenants.find((t) => t.id === tenantId)?.name ?? null) : null)

type GuestDb = { last_name: string; first_name: string | null; title_prefix: string | null; title_suffix: string | null } | null
const guestName = (g: GuestDb) =>
  g ? guestDisplayName({ lastName: g.last_name, firstName: g.first_name, titlePrefix: g.title_prefix, titleSuffix: g.title_suffix }) : null

// ---- Abrechnungsstand ----------------------------------------------------------------------

// Abrechnungsstand je Buchung (Datenbank-Funktion dashboard_billing_states); null, wenn nicht lesbar
async function billingStates(bookingIds: string[]): Promise<Map<string, BillingState> | null> {
  if (bookingIds.length === 0) return new Map()
  const supabase = await untyped()
  const { data, error } = await supabase.rpc('dashboard_billing_states', { p_booking_ids: bookingIds })
  if (error) {
    if (!isMissingRelation(error)) console.error('[dashboard] Abrechnungsstand nicht lesbar', error.message)
    return null
  }
  return new Map(((data ?? []) as { booking_id: string; billing: BillingState }[]).map((r) => [r.booking_id, r.billing]))
}

// ---- Heute und Kacheln ---------------------------------------------------------------------

type TodayDb = {
  id: string
  tenant_id: string
  kind: string
  source: string
  arrival: string
  departure: string
  adults: number | null
  child_ages: number[]
  option_until: string | null
  cancelled_at: string | null
  apartment_id: string
  guest: GuestDb
  apartment: { name: string; archived_at: string | null; property: { name: string } }
}

// An- und Abreisen heute, belegte Wohnungen und Abrechnungsstand der Abreisen (Buchungen und Optionen, keine Sperren)
export const getTodayOverview = cache(async (s: DashboardScope, today: string): Promise<TodayOverview> => {
  const empty: TodayOverview = { arrivals: [], departures: [], arrivingGuests: 0, occupied: 0, apartments: 0, departuresUnbilled: null, failed: false }
  if (s.scope.length === 0) return empty
  const supabase = await createClient()
  const [bookings, apartments] = await Promise.all([
    supabase
      .from('bookings')
      .select(
        'id, tenant_id, kind, source, arrival, departure, adults, child_ages, option_until, cancelled_at, apartment_id, guest:guests(last_name, first_name, title_prefix, title_suffix), apartment:apartments!inner(name, archived_at, property:properties!inner(name))'
      )
      .in('tenant_id', ids(s.scope))
      .is('cancelled_at', null)
      .neq('kind', 'block')
      .lte('arrival', today)
      .gte('departure', today)
      .limit(2000),
    supabase.from('apartments').select('id', { count: 'exact', head: true }).in('tenant_id', ids(s.scope)).is('archived_at', null),
  ])
  if (bookings.error) console.error('[dashboard] Buchungen von heute nicht lesbar', bookings.error.message)
  if (apartments.error) console.error('[dashboard] Wohnungen nicht lesbar', apartments.error.message)
  if (bookings.error || apartments.error) return { ...empty, failed: true }

  const active = ((bookings.data ?? []) as unknown as TodayDb[]).filter(
    (b) => bookingState({ kind: b.kind as BookingKind, cancelledAt: b.cancelled_at, optionUntil: b.option_until }, today) === 'active'
  )
  const row = (b: TodayDb): TodayRow => ({
    id: b.id,
    tenantId: b.tenant_id,
    tenantName: nameOf(s, b.tenant_id),
    kind: b.kind as TodayRow['kind'],
    source: b.source as BookingSource,
    guestName: guestName(b.guest),
    apartmentLabel: apartmentLabel(b.apartment.property.name, b.apartment.name),
    persons: personCount(b.adults ?? 0, b.child_ages ?? []),
    nights: nightsBetween(b.arrival, b.departure),
    billing: null,
  })
  const arrivals = active.filter((b) => b.arrival === today).map(row).sort(byApartment)
  let departures = active.filter((b) => b.departure === today).map(row).sort(byApartment)

  // Hinweis „Rechnung fehlt“ für alle Rollen (Rechnungen sehen auch Mitarbeiter); Optionen werden nicht abgerechnet
  const billing = await billingStates(departures.filter((d) => d.kind === 'booking').map((d) => d.id))
  if (billing) departures = departures.map((d) => (d.kind === 'booking' ? { ...d, billing: billing.get(d.id) ?? 'missing' } : d))
  const owned = new Set(ids(s.owned))
  const departuresUnbilled =
    billing && owned.size > 0 ? departures.filter((d) => owned.has(d.tenantId) && d.billing !== null && d.billing !== 'billed').length : null

  // Wie die Gesamtzahl nur aktive Wohnungen (archivierte können noch laufende Buchungen haben, PROJ-6; BUG-1)
  const occupied = new Set(active.filter((b) => b.apartment.archived_at === null && b.arrival <= today && today < b.departure).map((b) => b.apartment_id))
  return {
    arrivals,
    departures,
    arrivingGuests: arrivals.reduce((sum, a) => sum + a.persons, 0),
    occupied: occupied.size,
    apartments: apartments.count ?? 0,
    departuresUnbilled,
    failed: false,
  }
})

// ---- Noch nicht abgerechnet ------------------------------------------------------------------

export type UnbilledResult = { ready: boolean; failed: boolean; rows: UnbilledRow[]; count: number }

type UnbilledDb = {
  booking_id: string
  tenant_id: string
  last_name: string | null
  first_name: string | null
  title_prefix: string | null
  title_suffix: string | null
  apartment_name: string
  property_name: string
  due_date: string
  cancelled: boolean
  billing: Exclude<BillingState, 'billed'>
  total_count: number | string
}

// Abgereiste bzw. stornierte Buchungen mit Stornogebühr ohne (Schluss-)Rechnung, nur Inhaber-Kunden; die ältesten zuerst
export async function getUnbilled(s: DashboardScope, today: string): Promise<UnbilledResult> {
  if (s.owned.length === 0) return { ready: true, failed: false, rows: [], count: 0 }
  const supabase = await untyped()
  const { data, error } = await supabase.rpc('dashboard_unbilled', { p_tenant_ids: ids(s.owned), p_today: today, p_limit: UNBILLED_SHOWN })
  if (error) {
    if (isMissingRelation(error)) return { ready: false, failed: false, rows: [], count: 0 }
    console.error('[dashboard] Nicht abgerechnete Buchungen nicht lesbar', error.message)
    return { ready: true, failed: true, rows: [], count: 0 }
  }
  const rows = (data ?? []) as UnbilledDb[]
  return {
    ready: true,
    failed: false,
    count: Number(rows[0]?.total_count ?? 0),
    rows: rows.map((r) => ({
      id: r.booking_id,
      tenantId: r.tenant_id,
      tenantName: nameOf(s, r.tenant_id),
      guestName: r.last_name ? guestName({ last_name: r.last_name, first_name: r.first_name, title_prefix: r.title_prefix, title_suffix: r.title_suffix }) : null,
      apartmentLabel: apartmentLabel(r.property_name, r.apartment_name),
      date: r.due_date,
      cancelled: r.cancelled,
      billing: r.billing,
    })),
  }
}

// ---- Offene Rechnungen ----------------------------------------------------------------------

export type OpenInvoicesResult = { ready: boolean; failed: boolean; rows: OpenInvoiceRow[]; count: number; overdue: number; totalCents: number }

type OpenInvoiceDb = {
  invoice_id: string
  tenant_id: string
  number: string | null
  recipient: string
  invoice_date: string
  apartment_name: string | null
  property_name: string | null
  open_cents: number | string
  overdue: boolean
  next_due: string | null
}

// Offene und teilweise bezahlte Rechnungen der Kunden im Filter (ohne stornierte und Gutschriften)
export const getOpenInvoices = cache(async (s: DashboardScope): Promise<OpenInvoicesResult> => {
  const none: OpenInvoicesResult = { ready: true, failed: false, rows: [], count: 0, overdue: 0, totalCents: 0 }
  if (s.scope.length === 0) return none
  const supabase = await untyped()
  const { data, error } = await supabase.rpc('dashboard_open_invoices', { p_tenant_ids: ids(s.scope) })
  if (error) {
    if (isMissingRelation(error)) return { ...none, ready: false }
    console.error('[dashboard] Offene Rechnungen nicht lesbar', error.message)
    return { ...none, failed: true }
  }
  const rows = sortOpenInvoices(
    ((data ?? []) as OpenInvoiceDb[]).map(
      (r): OpenInvoiceRow => ({
        id: r.invoice_id,
        tenantId: r.tenant_id,
        tenantName: nameOf(s, r.tenant_id),
        number: r.number,
        recipient: r.recipient,
        invoiceDate: r.invoice_date,
        apartmentLabel: r.apartment_name && r.property_name ? apartmentLabel(r.property_name, r.apartment_name) : null,
        openCents: Number(r.open_cents),
        overdue: r.overdue,
        nextDue: r.next_due,
      })
    )
  )
  return {
    ready: true,
    failed: false,
    rows,
    count: rows.length,
    overdue: rows.filter((r) => r.overdue).length,
    totalCents: rows.reduce((sum, r) => sum + r.openCents, 0),
  }
})

// ---- Ortstaxe -------------------------------------------------------------------------------

export type TouristTaxResult = { ready: boolean; failed: boolean; rows: TaxMonthRow[] }

type TaxDb = { tenant_id: string; municipality_id: string; municipality_name: string; month: string; amount_cents: number | string }

// Monatssummen je Kunde und Gemeinde über 24 Monate (Jänner Vorjahr bis Dezember), nur Inhaber-Kunden
export async function getTouristTaxMonths(s: DashboardScope, today: string): Promise<TouristTaxResult> {
  if (s.owned.length === 0) return { ready: true, failed: false, rows: [] }
  const { from, to } = taxPeriods(today)
  const supabase = await untyped()
  const { data, error } = await supabase.rpc('tourist_tax_monthly', { p_tenant_ids: ids(s.owned), p_from: from, p_to: to })
  if (error) {
    if (isMissingRelation(error)) return { ready: false, failed: false, rows: [] }
    console.error('[dashboard] Ortstaxe nicht lesbar', error.message)
    return { ready: true, failed: true, rows: [] }
  }
  return {
    ready: true,
    failed: false,
    rows: ((data ?? []) as TaxDb[]).map((r) => ({
      tenantId: r.tenant_id,
      municipalityId: r.municipality_id,
      municipalityName: r.municipality_name,
      // Monat als JJJJ-MM (die Funktion liefert den Monatsersten)
      month: r.month.slice(0, 7),
      amountCents: Number(r.amount_cents),
    })),
  }
}
