// Dashboard (PROJ-14): Typen und reine Regeln für Browser und Server.
// Lesefunktionen: src/lib/dashboard-data.ts (nur Server), Oberfläche: src/components/dashboard/.

import type { BookingKind, BookingSource } from '@/lib/bookings'

// ---- Kundenfilter ---------------------------------------------------------------------------

// Kundenfilter je Gerät (Cookie) und in der Adresse (?kunde=<id> bzw. „alle“); die Adresse gewinnt
export const DASHBOARD_COOKIE = 'apppa-dashboard-kunde'
export const ALL_TENANTS = 'alle'
const UUID = /^[0-9a-f-]{36}$/i

// Hinweis nach einem Klick auf einen Kunden, zu dem die Person nicht mehr gehört (?hinweis=…)
export const NO_ACCESS_NOTICE = 'kein-zugriff'

// Adresse des Kundenwechsels (PROJ-4); mit Ziel „weiter“ öffnet er danach die Zeile (PROJ-14)
export const SWITCH_PATH = '/kunde-wechseln'

// Gewählter Kunde des Filters oder null („Alle Kunden“). Unbekannte oder fremde Kunden zählen als „Alle Kunden“.
export function parseTenantFilter(param: string | string[] | undefined, cookie: string | undefined, tenantIds: readonly string[]): string | null {
  const value = (Array.isArray(param) ? param[0] : param) ?? cookie ?? ALL_TENANTS
  if (value === ALL_TENANTS || !UUID.test(value)) return null
  return tenantIds.includes(value) ? value : null
}

// ---- Abrechnungsstand je Buchung -----------------------------------------------------------

// billed: Rechnung oder Schlussrechnung (nicht storniert) oder nacherfasste Rechnung; final_missing: nur Teilrechnungen
export type BillingState = 'billed' | 'missing' | 'final_missing'

// ---- Heute ----------------------------------------------------------------------------------

export type TodayRow = {
  id: string
  tenantId: string
  // Kundenname nur bei mehreren Kunden im Filter
  tenantName: string | null
  kind: Exclude<BookingKind, 'block'>
  source: BookingSource
  guestName: string | null
  apartmentLabel: string
  persons: number
  nights: number
  // null: nicht bekannt (Option oder Abrechnungsstand nicht lesbar)
  billing: BillingState | null
}

export type TodayOverview = {
  arrivals: TodayRow[]
  departures: TodayRow[]
  // Personen der heutigen Anreisen
  arrivingGuests: number
  // Belegte bzw. alle aktiven Wohnungen
  occupied: number
  apartments: number
  // Abreisen heute ohne (Schluss-)Rechnung; null, wenn nicht für den Inhaber bestimmt oder nicht lesbar
  departuresUnbilled: number | null
  failed: boolean
}

// Sortierung wie im Kalender: Kunde, dann „Objekt · Wohnung“
export const byApartment = (a: Pick<TodayRow, 'tenantName' | 'apartmentLabel'>, b: Pick<TodayRow, 'tenantName' | 'apartmentLabel'>) =>
  (a.tenantName ?? '').localeCompare(b.tenantName ?? '', 'de') || a.apartmentLabel.localeCompare(b.apartmentLabel, 'de', { numeric: true })

// Unterzeile unter dem Gruß: welcher Satz gilt
export type LeadKind = 'none' | 'noMovement' | 'movement'
export function leadKind(t: Pick<TodayOverview, 'arrivals' | 'departures' | 'apartments'>): LeadKind {
  if (t.apartments === 0) return 'none'
  return t.arrivals.length === 0 && t.departures.length === 0 ? 'noMovement' : 'movement'
}

// ---- Noch nicht abgerechnet ------------------------------------------------------------------

export const UNBILLED_SHOWN = 5

export type UnbilledRow = {
  id: string
  tenantId: string
  tenantName: string | null
  guestName: string | null
  apartmentLabel: string
  // Abreise bzw. bei stornierten Buchungen das Stornodatum
  date: string
  cancelled: boolean
  billing: Exclude<BillingState, 'billed'>
}

// ---- Offene Rechnungen ----------------------------------------------------------------------

export const OPEN_INVOICES_SHOWN = 5

export type OpenInvoiceRow = {
  id: string
  tenantId: string
  tenantName: string | null
  number: string | null
  recipient: string
  invoiceDate: string
  apartmentLabel: string | null
  openCents: number
  overdue: boolean
  // Nächste Fälligkeit (in der App ausgestellte Rechnungen); null bei nacherfassten
  nextDue: string | null
}

// Überfällige zuerst, dann nach nächster Fälligkeit bzw. Rechnungsdatum (älteste zuerst)
export function sortOpenInvoices<T extends Pick<OpenInvoiceRow, 'overdue' | 'nextDue' | 'invoiceDate' | 'number'>>(rows: readonly T[]): T[] {
  return [...rows].sort(
    (a, b) =>
      Number(b.overdue) - Number(a.overdue) ||
      (a.nextDue ?? a.invoiceDate).localeCompare(b.nextDue ?? b.invoiceDate) ||
      (a.number ?? '').localeCompare(b.number ?? '', 'de', { numeric: true })
  )
}

// ---- Ortstaxe -------------------------------------------------------------------------------

// Zeitraum aus ganzen Monaten (JJJJ-MM)
export type TaxPeriod = { kind: 'month' | 'quarter' | 'year'; year: number; index: number; months: string[] }

const pad = (n: number) => String(n).padStart(2, '0')
const monthKey = (year: number, month: number) => `${year}-${pad(month)}`
const monthsOfQuarter = (year: number, quarter: number) => [1, 2, 3].map((i) => monthKey(year, quarter * 3 + i))
const monthsOfYear = (year: number) => Array.from({ length: 12 }, (_, i) => monthKey(year, i + 1))

// Laufend: Monat, Quartal, Jahr von heute; abgelaufen: letzter ganzer Monat, letztes ganzes Quartal, Vorjahr
export function taxPeriods(today: string): { current: TaxPeriod[]; past: TaxPeriod[]; from: string; to: string } {
  const year = Number(today.slice(0, 4))
  const month = Number(today.slice(5, 7))
  const quarter = Math.floor((month - 1) / 3)
  const lastMonth = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
  const lastQuarter = quarter === 0 ? { year: year - 1, quarter: 3 } : { year, quarter: quarter - 1 }
  return {
    current: [
      { kind: 'month', year, index: month, months: [monthKey(year, month)] },
      { kind: 'quarter', year, index: quarter + 1, months: monthsOfQuarter(year, quarter) },
      { kind: 'year', year, index: 0, months: monthsOfYear(year) },
    ],
    past: [
      { kind: 'month', year: lastMonth.year, index: lastMonth.month, months: [monthKey(lastMonth.year, lastMonth.month)] },
      { kind: 'quarter', year: lastQuarter.year, index: lastQuarter.quarter + 1, months: monthsOfQuarter(lastQuarter.year, lastQuarter.quarter) },
      { kind: 'year', year: year - 1, index: 0, months: monthsOfYear(year - 1) },
    ],
    // Abfragebereich: Jänner des Vorjahres bis Dezember des laufenden Jahres (deckt alle sechs Zeiträume)
    from: `${year - 1}-01-01`,
    to: `${year}-12-31`,
  }
}

// Monatssumme der Ortstaxe je Kunde und Gemeinde (aus der Datenbank, anteilig je Nacht)
export type TaxMonthRow = { tenantId: string; municipalityId: string; municipalityName: string; month: string; amountCents: number }

export type TaxLine = { id: string; name: string; current: number[]; past: number[] }
export type TaxTenantBlock = { tenantId: string; tenantName: string; municipalities: TaxLine[]; total: TaxLine | null }

const sumFor = (rows: readonly TaxMonthRow[], period: TaxPeriod) => {
  const months = new Set(period.months)
  return rows.reduce((sum, r) => (months.has(r.month) ? sum + r.amountCents : sum), 0)
}

// Tabelle je Kunde (alphabetisch) und Gemeinde (alphabetisch); Gemeinden ohne Betrag in allen sechs Zeiträumen fallen weg;
// „Gesamt“ nur bei mehr als einer Gemeinde; Kunden ohne Gemeinde fallen weg
export function touristTaxTable(
  rows: readonly TaxMonthRow[],
  periods: { current: TaxPeriod[]; past: TaxPeriod[] },
  tenants: readonly { id: string; name: string }[]
): TaxTenantBlock[] {
  const blocks: TaxTenantBlock[] = []
  for (const tenant of [...tenants].sort((a, b) => a.name.localeCompare(b.name, 'de'))) {
    const own = rows.filter((r) => r.tenantId === tenant.id)
    const names = new Map(own.map((r) => [r.municipalityId, r.municipalityName]))
    const municipalities = [...names.entries()]
      .map(([id, name]): TaxLine => {
        const mine = own.filter((r) => r.municipalityId === id)
        return { id, name, current: periods.current.map((p) => sumFor(mine, p)), past: periods.past.map((p) => sumFor(mine, p)) }
      })
      .filter((l) => [...l.current, ...l.past].some((v) => v !== 0))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'))
    if (municipalities.length === 0) continue
    const add = (key: 'current' | 'past') => periods[key].map((_, i) => municipalities.reduce((s, l) => s + l[key][i], 0))
    blocks.push({
      tenantId: tenant.id,
      tenantName: tenant.name,
      municipalities,
      total: municipalities.length > 1 ? { id: 'gesamt', name: '', current: add('current'), past: add('past') } : null,
    })
  }
  return blocks
}
