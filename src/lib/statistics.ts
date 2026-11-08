// Statistische Auswertungen (PROJ-18): reine Regeln für Seite, PDF, CSV und Dashboard. Die Datenbank liefert je Wohnung
// und Monat die Grundzahlen (Nächte, Umsatz, USt, Gäste) für den Zeitraum und das Vorjahr; hier entstehen Filter,
// Kacheln, Tabellen, Vorjahresvergleich, Diagramm-Maßstab und CSV.

import {
  csvCents,
  csvText,
  fileNamePart,
  lastMonth,
  lastQuarter,
  lastYear,
  MIN_YEAR,
  periodFileKey,
  type ReportPeriod,
  samePeriod,
  taxReportRange,
} from '@/lib/tourist-tax-report'

// ---- Zeitraum und Filter --------------------------------------------------------------------

export type StatsFilters = ReportPeriod & {
  // null = „Alle Objekte“ bzw. „Alle Wohnungen“
  property: string | null
  apartment: string | null
}

export const STATS_PATH = '/auswertungen'
export const STATS_EXPORT_PATH = '/api/auswertungen'

const pad = (n: number) => String(n).padStart(2, '0')
const yearOf = (today: string) => Number(today.slice(0, 4))
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const thisYear = (today: string): ReportPeriod => ({ year: yearOf(today), from: 1, to: 12 })

export const STATS_QUICK_PICKS = ['thisYear', 'lastYear', 'lastMonth', 'lastQuarter'] as const
export type StatsQuickPick = (typeof STATS_QUICK_PICKS)[number]

const period = ({ year, from, to }: ReportPeriod): ReportPeriod => ({ year, from, to })

export function statsQuickPick(pick: StatsQuickPick, today: string): ReportPeriod {
  if (pick === 'thisYear') return thisYear(today)
  if (pick === 'lastYear') return period(lastYear(today))
  return period(pick === 'lastMonth' ? lastMonth(today) : lastQuarter(today))
}

export function activeStatsQuickPick(f: ReportPeriod, today: string): StatsQuickPick | null {
  return STATS_QUICK_PICKS.find((p) => samePeriod(statsQuickPick(p, today), f)) ?? null
}

type Params = Record<string, string | string[] | undefined>
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
const intIn = (v: string | undefined, min: number, max: number) => (v && /^\d{1,4}$/.test(v) && Number(v) >= min && Number(v) <= max ? Number(v) : null)
const uuid = (v: string | undefined) => (v && UUID.test(v) ? v.toLowerCase() : null)

// Adresse lesen: ?jahr=2026&von=1&bis=12&objekt=<id>&wohnung=<id>. Ungültiger Zeitraum → Standard (laufendes Jahr);
// ob Objekt und Wohnung zum Kunden passen, prüft resolveStatsFilters.
export function parseStatsFilters(params: Params, today: string): StatsFilters {
  const year = intIn(one(params.jahr), MIN_YEAR, yearOf(today) + 5)
  const from = intIn(one(params.von), 1, 12)
  const to = intIn(one(params.bis), 1, 12)
  const scope = { property: uuid(one(params.objekt)), apartment: uuid(one(params.wohnung)) }
  const hasPeriod = one(params.jahr) !== undefined || one(params.von) !== undefined || one(params.bis) !== undefined
  if (!hasPeriod || year === null || from === null || to === null || to < from) return { ...thisYear(today), ...scope }
  return { year, from, to, ...scope }
}

export type StatsApartment = { id: string; name: string; propertyId: string; propertyName: string; archived: boolean }
export type StatsProperty = { id: string; name: string; apartments: StatsApartment[] }

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'de', { numeric: true })

// Objekte mit ihren Wohnungen, alphabetisch (für Auswahl und Gruppierung)
export function groupProperties(apartments: readonly StatsApartment[]): StatsProperty[] {
  const map = new Map<string, StatsProperty>()
  for (const a of apartments) {
    const p = map.get(a.propertyId) ?? { id: a.propertyId, name: a.propertyName, apartments: [] }
    p.apartments.push(a)
    map.set(a.propertyId, p)
  }
  const list = [...map.values()].sort(byName)
  for (const p of list) p.apartments.sort(byName)
  return list
}

// Objekt und Wohnung gegen die Wohnungen des Kunden prüfen: unbekanntes Objekt → „Alle Objekte“; eine Wohnung, die es
// nicht gibt oder die nicht zum gewählten Objekt gehört → „Alle Wohnungen“
export function resolveStatsFilters(f: StatsFilters, apartments: readonly StatsApartment[]): StatsFilters {
  const property = f.property && apartments.some((a) => a.propertyId === f.property) ? f.property : null
  const apt = apartments.find((a) => a.id === f.apartment)
  const apartment = apt && (property === null || apt.propertyId === property) ? apt.id : null
  return { ...f, property, apartment }
}

// Wohnungen im Filter
export function filteredApartmentIds(f: StatsFilters, apartments: readonly StatsApartment[]): Set<string> {
  return new Set(apartments.filter((a) => (f.apartment ? a.id === f.apartment : f.property ? a.propertyId === f.property : true)).map((a) => a.id))
}

const query = (f: StatsFilters) => {
  const q = new URLSearchParams({ jahr: String(f.year), von: String(f.from), bis: String(f.to) })
  if (f.property) q.set('objekt', f.property)
  if (f.apartment) q.set('wohnung', f.apartment)
  return q.toString()
}

export const statsHref = (f: StatsFilters) => `${STATS_PATH}?${query(f)}`
export const statsExportHref = (kind: 'pdf' | 'csv', f: StatsFilters) => `${STATS_EXPORT_PATH}/${kind}?${query(f)}`

// Abfragebereich des gewählten Zeitraums; die Datenbank liefert dieselben Monate des Vorjahres mit
export const statsRange = (f: ReportPeriod) => taxReportRange(f)

// Monatsschlüssel „2026-10“
export const monthKey = (year: number, month: number) => `${year}-${pad(month)}`

// Teil des Dateinamens für den Filter: „Alle“, Objektname oder „Objekt-Wohnung“
export function scopeFileKey(f: StatsFilters, apartments: readonly StatsApartment[]): string {
  const apt = f.apartment ? apartments.find((a) => a.id === f.apartment) : null
  if (apt) return `${fileNamePart(apt.propertyName)}-${fileNamePart(apt.name)}`
  const prop = f.property ? apartments.find((a) => a.propertyId === f.property) : null
  return prop ? fileNamePart(prop.propertyName) : 'Alle'
}

export const statsFileName = (kind: 'pdf' | 'csv', f: StatsFilters, apartments: readonly StatsApartment[], today: string) =>
  `Auswertung_${periodFileKey(f)}_${scopeFileKey(f, apartments)}_Stand-${today}.${kind}`

// ---- Grundzahlen ----------------------------------------------------------------------------

// Eine Zeile je Wohnung und Monat aus der Datenbank (Zeitraum und Vorjahr)
export type StatsMonthRow = {
  apartmentId: string
  // „2026-10“
  month: string
  availableNights: number
  occupiedNights: number
  blockedNights: number
  // Umsatz aus Buchungen (ohne Ortstaxe, ohne Stornogebühren), brutto, und die darin enthaltene USt
  revenueCents: number
  revenueVatCents: number
  // Stornogebühren (im Anreisemonat), brutto, und die darin enthaltene USt
  feeCents: number
  feeVatCents: number
  guestNights: number
  // Personen der Buchungen mit Anreise im Monat
  arrivals: number
  // Buchungen mit Anreise im Monat und deren Nächte (ganzer Aufenthalt)
  bookings: number
  stayNights: number
}

export type StatsTotals = {
  availableNights: number
  occupiedNights: number
  blockedNights: number
  // Umsatz gesamt (Buchungen + Stornogebühren) und darin enthaltene USt
  revenueCents: number
  vatCents: number
  // nur Buchungen, für den Durchschnittspreis je Nacht
  nightsRevenueCents: number
  guestNights: number
  arrivals: number
  bookings: number
  stayNights: number
}

export const emptyTotals = (): StatsTotals => ({
  availableNights: 0,
  occupiedNights: 0,
  blockedNights: 0,
  revenueCents: 0,
  vatCents: 0,
  nightsRevenueCents: 0,
  guestNights: 0,
  arrivals: 0,
  bookings: 0,
  stayNights: 0,
})

function addRow(t: StatsTotals, r: StatsMonthRow): StatsTotals {
  return {
    availableNights: t.availableNights + r.availableNights,
    occupiedNights: t.occupiedNights + r.occupiedNights,
    blockedNights: t.blockedNights + r.blockedNights,
    revenueCents: t.revenueCents + r.revenueCents + r.feeCents,
    vatCents: t.vatCents + r.revenueVatCents + r.feeVatCents,
    nightsRevenueCents: t.nightsRevenueCents + r.revenueCents,
    guestNights: t.guestNights + r.guestNights,
    arrivals: t.arrivals + r.arrivals,
    bookings: t.bookings + r.bookings,
    stayNights: t.stayNights + r.stayNights,
  }
}

export const sumRows = (rows: readonly StatsMonthRow[]) => rows.reduce(addRow, emptyTotals())

// Auslastung als Anteil (0–1); null ohne verfügbare Nächte
export const occupancy = (t: Pick<StatsTotals, 'availableNights' | 'occupiedNights'>) => (t.availableNights > 0 ? t.occupiedNights / t.availableNights : null)
// Durchschnittspreis je belegter Nacht in Cent (ohne Stornogebühren); null ohne belegte Nächte
export const averageRate = (t: StatsTotals) => (t.occupiedNights > 0 ? Math.round(t.nightsRevenueCents / t.occupiedNights) : null)
// Durchschnittliche Aufenthaltsdauer der Buchungen mit Anreise; null ohne Buchungen
export const averageStay = (t: StatsTotals) => (t.bookings > 0 ? t.stayNights / t.bookings : null)
// Gab es überhaupt etwas zu zählen? (Vorjahr „nicht bestimmbar“, leerer Zustand)
export const hasData = (t: StatsTotals) => t.availableNights > 0 || t.revenueCents !== 0

// ---- Vorjahresvergleich ---------------------------------------------------------------------

export type Change = { value: number; unit: 'pp' | 'percent' } | null

// Auslastung: Veränderung in Prozentpunkten (aus den genauen Anteilen, dann gerundet)
export function pointChange(current: number | null, previous: number | null): Change {
  if (current === null || previous === null) return null
  return { value: Math.round((current - previous) * 100) || 0, unit: 'pp' }
}

// Sonst: Veränderung in Prozent; keine, wenn das Vorjahr 0 oder unbekannt ist
export function relativeChange(current: number | null, previous: number | null): Change {
  if (current === null || previous === null || previous === 0) return null
  return { value: Math.round(((current - previous) / Math.abs(previous)) * 100) || 0, unit: 'percent' }
}

export type Compared = { current: StatsTotals; previous: StatsTotals; previousKnown: boolean }

const compared = (current: StatsTotals, previous: StatsTotals): Compared => ({ current, previous, previousKnown: hasData(previous) })

// ---- Aufbau der Seite -----------------------------------------------------------------------

export type StatsMonth = Compared & { month: number }
export type StatsApartmentLine = Compared & { apartment: StatsApartment }

export type StatsView = {
  totals: Compared
  months: StatsMonth[]
  // Wohnungen mit verfügbaren Nächten oder Umsatz im Zeitraum, nach Objekt und Wohnung; leer bei einzelner Wohnung
  apartments: StatsApartmentLine[]
  empty: boolean
}

export function buildStats(rows: readonly StatsMonthRow[], apartments: readonly StatsApartment[], f: StatsFilters): StatsView {
  const inScope = filteredApartmentIds(f, apartments)
  const current = new Map<string, StatsMonthRow[]>()
  const previous = new Map<string, StatsMonthRow[]>()
  const currentKeys = new Set<string>()
  const previousKeys = new Set<string>()
  for (let m = f.from; m <= f.to; m++) {
    currentKeys.add(monthKey(f.year, m))
    previousKeys.add(monthKey(f.year - 1, m))
  }
  const push = (map: Map<string, StatsMonthRow[]>, key: string, r: StatsMonthRow) => map.set(key, [...(map.get(key) ?? []), r])
  const byApartmentCurrent = new Map<string, StatsMonthRow[]>()
  const byApartmentPrevious = new Map<string, StatsMonthRow[]>()
  for (const r of rows) {
    if (!inScope.has(r.apartmentId)) continue
    if (currentKeys.has(r.month)) {
      push(current, r.month, r)
      push(byApartmentCurrent, r.apartmentId, r)
    } else if (previousKeys.has(r.month)) {
      push(previous, r.month, r)
      push(byApartmentPrevious, r.apartmentId, r)
    }
  }

  const months: StatsMonth[] = []
  for (let m = f.from; m <= f.to; m++) {
    months.push({ month: m, ...compared(sumRows(current.get(monthKey(f.year, m)) ?? []), sumRows(previous.get(monthKey(f.year - 1, m)) ?? [])) })
  }
  const totals = compared(sumRows([...current.values()].flat()), sumRows([...previous.values()].flat()))

  const lines: StatsApartmentLine[] = f.apartment
    ? []
    : groupProperties(apartments.filter((a) => inScope.has(a.id)))
        .flatMap((p) => p.apartments)
        .map((apartment) => ({ apartment, ...compared(sumRows(byApartmentCurrent.get(apartment.id) ?? []), sumRows(byApartmentPrevious.get(apartment.id) ?? [])) }))
        .filter((l) => hasData(l.current))

  return { totals, months, apartments: lines, empty: !hasData(totals.current) }
}

// Sortierung der Tabelle „Je Wohnung“; null = nach Objekt und Wohnung (gruppiert)
export const APARTMENT_SORT_KEYS = ['occupancy', 'occupied', 'blocked', 'revenue', 'rate'] as const
export type ApartmentSortKey = (typeof APARTMENT_SORT_KEYS)[number]
export type ApartmentSort = { key: ApartmentSortKey; dir: 'asc' | 'desc' } | null

const sortValue = (l: StatsApartmentLine, key: ApartmentSortKey): number | null => {
  const t = l.current
  if (key === 'occupancy') return occupancy(t)
  if (key === 'occupied') return t.occupiedNights
  if (key === 'blocked') return t.blockedNights
  if (key === 'revenue') return t.revenueCents
  return averageRate(t)
}

// Unbekannte Werte („–“) stehen immer am Ende; bei Gleichstand nach Objekt und Wohnung
export function sortApartmentLines(lines: readonly StatsApartmentLine[], sort: ApartmentSort): StatsApartmentLine[] {
  if (!sort) return [...lines]
  const sign = sort.dir === 'asc' ? 1 : -1
  return lines
    .map((l, i) => ({ l, i, v: sortValue(l, sort.key) }))
    .sort((a, b) => {
      if (a.v === null || b.v === null) return a.v === b.v ? a.i - b.i : a.v === null ? 1 : -1
      return (a.v - b.v) * sign || a.i - b.i
    })
    .map((x) => x.l)
}

// Klick auf eine Spalte: erst absteigend (größte Werte oben), dann aufsteigend, dann zurück zur Gruppierung
export function nextApartmentSort(current: ApartmentSort, key: ApartmentSortKey): ApartmentSort {
  if (!current || current.key !== key) return { key, dir: 'desc' }
  return current.dir === 'desc' ? { key, dir: 'asc' } : null
}

// ---- Gästeherkunft --------------------------------------------------------------------------

// Eine Zeile je Wohnung, Land und Zeitraum (gewählter Zeitraum bzw. Vorjahr) aus der Datenbank
export type StatsOriginRow = {
  apartmentId: string
  // ISO 3166-1 alpha-2
  country: string
  previous: boolean
  arrivals: number
  guestNights: number
  revenueCents: number
}

export type OriginValues = { arrivals: number; guestNights: number; revenueCents: number }
export type OriginLine = { country: string; current: OriginValues; previous: OriginValues; share: number | null }
export type OriginView = {
  // die ersten ORIGIN_SHOWN Länder einzeln
  top: OriginLine[]
  // alle übrigen (aufklappbar) und ihre Summe; null, wenn es keine gibt
  rest: OriginLine[]
  restSum: OriginLine | null
  total: OriginLine
  previousKnown: boolean
}

export const ORIGIN_SHOWN = 10
const emptyOrigin = (): OriginValues => ({ arrivals: 0, guestNights: 0, revenueCents: 0 })
const addOrigin = (a: OriginValues, b: OriginValues): OriginValues => ({
  arrivals: a.arrivals + b.arrivals,
  guestNights: a.guestNights + b.guestNights,
  revenueCents: a.revenueCents + b.revenueCents,
})
const anyOrigin = (v: OriginValues) => v.arrivals > 0 || v.guestNights > 0 || v.revenueCents !== 0

// Länder des gewählten Zeitraums nach Gästenächten (bei Gleichstand nach Ländername); Länder nur mit Vorjahreswerten
// erscheinen nicht. Anteil = Gästenächte des Landes ÷ alle Gästenächte.
export function buildOrigin(rows: readonly StatsOriginRow[], inScope: ReadonlySet<string>, name: (code: string) => string, shown = ORIGIN_SHOWN): OriginView {
  const map = new Map<string, { current: OriginValues; previous: OriginValues }>()
  for (const r of rows) {
    if (!inScope.has(r.apartmentId)) continue
    const e = map.get(r.country) ?? { current: emptyOrigin(), previous: emptyOrigin() }
    const v = { arrivals: r.arrivals, guestNights: r.guestNights, revenueCents: r.revenueCents }
    if (r.previous) e.previous = addOrigin(e.previous, v)
    else e.current = addOrigin(e.current, v)
    map.set(r.country, e)
  }
  const all = [...map.entries()].map(([country, v]) => ({ country, ...v }))
  const totalCurrent = all.reduce((s, l) => addOrigin(s, l.current), emptyOrigin())
  const totalPrevious = all.reduce((s, l) => addOrigin(s, l.previous), emptyOrigin())
  const share = (v: OriginValues) => (totalCurrent.guestNights > 0 ? v.guestNights / totalCurrent.guestNights : null)
  const lines = all
    .filter((l) => anyOrigin(l.current))
    .map((l) => ({ ...l, share: share(l.current) }))
    .sort((a, b) => b.current.guestNights - a.current.guestNights || name(a.country).localeCompare(name(b.country), 'de'))
  const top = lines.slice(0, shown)
  const rest = lines.slice(shown)
  const restSum: OriginLine | null = rest.length
    ? {
        country: '',
        current: rest.reduce((s, l) => addOrigin(s, l.current), emptyOrigin()),
        previous: rest.reduce((s, l) => addOrigin(s, l.previous), emptyOrigin()),
        share: null,
      }
    : null
  if (restSum) restSum.share = share(restSum.current)
  return {
    top,
    rest,
    restSum,
    total: { country: '', current: totalCurrent, previous: totalPrevious, share: totalCurrent.guestNights > 0 ? 1 : null },
    previousKnown: anyOrigin(totalPrevious),
  }
}

// ---- Diagramm -------------------------------------------------------------------------------

export type ChartMode = 'occupancy' | 'revenue'
export type ChartScale = { max: number; ticks: number[] }

// „Schöne“ Obergrenze für Beträge: 1, 2, 2,5 oder 5 × Zehnerpotenz, vier Abschnitte
export function niceScale(maxValue: number, steps = 4): ChartScale {
  if (!(maxValue > 0)) return { max: steps, ticks: Array.from({ length: steps + 1 }, (_, i) => i) }
  const raw = maxValue / steps
  const power = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((f) => f * power).find((s) => s >= raw) ?? 10 * power
  return { max: step * steps, ticks: Array.from({ length: steps + 1 }, (_, i) => step * i) }
}

export type ChartBar = { month: number; current: number | null; previous: number | null; currentShare: number; previousShare: number }
export type ChartModel = { mode: ChartMode; scale: ChartScale; bars: ChartBar[]; previousKnown: boolean }

// Werte je Monat und Balkenhöhe als Anteil der Achse (0–1, negative Werte als 0). Auslastung: Achse fest 0–100 %.
// Umsatz in Cent. Gleich für Bildschirm und PDF.
export function chartModel(view: Pick<StatsView, 'months' | 'totals'>, mode: ChartMode): ChartModel {
  const value = (t: StatsTotals, known: boolean) => (!known ? null : mode === 'occupancy' ? occupancy(t) : t.revenueCents)
  const raw = view.months.map((m) => ({ month: m.month, current: value(m.current, true), previous: value(m.previous, view.totals.previousKnown) }))
  const scale =
    mode === 'occupancy'
      ? { max: 1, ticks: [0, 0.25, 0.5, 0.75, 1] }
      : niceScale(Math.max(0, ...raw.flatMap((r) => [r.current ?? 0, r.previous ?? 0])))
  const share = (v: number | null) => (v === null || v <= 0 ? 0 : Math.min(1, v / scale.max))
  return {
    mode,
    scale,
    bars: raw.map((r) => ({ ...r, currentShare: share(r.current), previousShare: share(r.previous) })),
    previousKnown: view.totals.previousKnown,
  }
}

// ---- CSV ------------------------------------------------------------------------------------

export type StatsCsvLabels = { columns: readonly string[] }

// Auslastung in Prozent mit einer Nachkommastelle: „62,1“; leer ohne verfügbare Nächte
const csvPercent = (t: Pick<StatsTotals, 'availableNights' | 'occupiedNights'>) => {
  const o = occupancy(t)
  return o === null ? '' : (Math.round(o * 1000) / 10).toFixed(1).replace('.', ',')
}

// Eine Zeile je Wohnung und Monat des gewählten Zeitraums (nur mit verfügbaren Nächten oder Umsatz), ohne Summen und
// ohne Vorjahr; nach Monat, Objekt und Wohnung. Format wie die Ortstaxe (Strichpunkt, Komma, BOM, CRLF).
export function buildStatsCsv(rows: readonly StatsMonthRow[], apartments: readonly StatsApartment[], f: StatsFilters, labels: StatsCsvLabels): string {
  const inScope = filteredApartmentIds(f, apartments)
  const order = new Map(groupProperties(apartments).flatMap((p) => p.apartments).map((a, i) => [a.id, i]))
  const byId = new Map(apartments.map((a) => [a.id, a]))
  const months = new Set<string>()
  for (let m = f.from; m <= f.to; m++) months.add(monthKey(f.year, m))
  const lines = [labels.columns.map(csvText).join(';')]
  const selected = rows
    .filter((r) => inScope.has(r.apartmentId) && months.has(r.month) && hasData(addRow(emptyTotals(), r)))
    .sort((a, b) => a.month.localeCompare(b.month) || (order.get(a.apartmentId) ?? 0) - (order.get(b.apartmentId) ?? 0))
  for (const r of selected) {
    const a = byId.get(r.apartmentId)
    if (!a) continue
    lines.push(
      [
        r.month,
        csvText(a.propertyName),
        csvText(a.name),
        String(r.availableNights),
        String(r.occupiedNights),
        String(r.blockedNights),
        csvPercent(r),
        csvCents(r.revenueCents + r.feeCents),
        csvCents(r.revenueVatCents + r.feeVatCents),
        String(r.guestNights),
        String(r.arrivals),
      ].join(';')
    )
  }
  return `﻿${lines.join('\r\n')}\r\n`
}

// ---- Dashboard ------------------------------------------------------------------------------

// Laufender Monat (1–12) aus dem heutigen Datum
export const currentMonth = (today: string) => Number(today.slice(5, 7))

// Auswertung für den laufenden Monat (Ziel der Dashboard-Kacheln)
export const currentMonthHref = (today: string) => statsHref({ year: yearOf(today), from: currentMonth(today), to: currentMonth(today), property: null, apartment: null })
