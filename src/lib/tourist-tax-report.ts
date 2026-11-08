// Ortstaxen-Berichte (PROJ-16): reine Regeln für Seite, PDF und CSV. Die Zahlen je Buchung liefert die Datenbank
// (gleiche Verteilung wie das Dashboard, PROJ-14); hier werden Zeitraum, Gruppierung, Summen und CSV gebildet.

import { formatDatePlain } from '@/lib/format'

// ---- Zeitraum und Filter --------------------------------------------------------------------

export type TaxReportFilters = {
  year: number
  // Monate 1–12 innerhalb des Jahres, from ≤ to
  from: number
  to: number
  // Gemeindecode; null = „Alle Gemeinden“
  municipality: string | null
}

export const TAX_REPORT_PATH = '/ortstaxe'
export const TAX_REPORT_EXPORT_PATH = '/api/ortstaxe'
export const MIN_YEAR = 2000

const pad = (n: number) => String(n).padStart(2, '0')
const yearOf = (today: string) => Number(today.slice(0, 4))
const monthOf = (today: string) => Number(today.slice(5, 7))
// Gemeindecodes sind Ziffern (Statistik Austria), großzügig geprüft
const MUNICIPALITY = /^[A-Za-z0-9_-]{1,20}$/

export const lastMonth = (today: string): TaxReportFilters => {
  const year = yearOf(today)
  const month = monthOf(today)
  const m = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
  return { year: m.year, from: m.month, to: m.month, municipality: null }
}

export const lastQuarter = (today: string): TaxReportFilters => {
  const year = yearOf(today)
  const quarter = Math.floor((monthOf(today) - 1) / 3)
  const q = quarter === 0 ? { year: year - 1, quarter: 3 } : { year, quarter: quarter - 1 }
  return { year: q.year, from: q.quarter * 3 + 1, to: q.quarter * 3 + 3, municipality: null }
}

export const lastYear = (today: string): TaxReportFilters => ({ year: yearOf(today) - 1, from: 1, to: 12, municipality: null })

export const QUICK_PICKS = ['lastMonth', 'lastQuarter', 'lastYear'] as const
export type QuickPick = (typeof QUICK_PICKS)[number]

export const quickPick = (pick: QuickPick, today: string): TaxReportFilters =>
  pick === 'lastMonth' ? lastMonth(today) : pick === 'lastQuarter' ? lastQuarter(today) : lastYear(today)

// Welche Schnellwahl dem eingestellten Zeitraum entspricht (für die Hervorhebung)
export function activeQuickPick(f: TaxReportFilters, today: string): QuickPick | null {
  return QUICK_PICKS.find((p) => samePeriod(quickPick(p, today), f)) ?? null
}

const samePeriod = (a: TaxReportFilters, b: TaxReportFilters) => a.year === b.year && a.from === b.from && a.to === b.to

// Wählbare Jahre: fünf Jahre zurück bis nächstes Jahr, dazu das eingestellte
export function selectableYears(today: string, selected: number): number[] {
  const year = yearOf(today)
  const years = new Set<number>([selected])
  for (let y = Math.max(MIN_YEAR, year - 5); y <= year + 1; y++) years.add(y)
  return [...years].sort((a, b) => b - a)
}

type Params = Record<string, string | string[] | undefined>
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
const intIn = (v: string | undefined, min: number, max: number) => (v && /^\d{1,4}$/.test(v) && Number(v) >= min && Number(v) <= max ? Number(v) : null)

// Adresse lesen: ?jahr=2026&von=10&bis=10&gemeinde=50621. Ungültiger Zeitraum → Standard (letzter abgelaufener Monat);
// eine ungültige Gemeinde → „Alle Gemeinden“.
export function parseTaxReportFilters(params: Params, today: string): TaxReportFilters {
  const year = intIn(one(params.jahr), MIN_YEAR, yearOf(today) + 5)
  const from = intIn(one(params.von), 1, 12)
  const to = intIn(one(params.bis), 1, 12)
  const raw = one(params.gemeinde)
  const municipality = raw && MUNICIPALITY.test(raw) ? raw : null
  const hasPeriod = one(params.jahr) !== undefined || one(params.von) !== undefined || one(params.bis) !== undefined
  if (!hasPeriod) return { ...lastMonth(today), municipality }
  if (year === null || from === null || to === null || to < from) return lastMonth(today)
  return { year, from, to, municipality }
}

const query = (f: TaxReportFilters) => {
  const q = new URLSearchParams({ jahr: String(f.year), von: String(f.from), bis: String(f.to) })
  if (f.municipality) q.set('gemeinde', f.municipality)
  return q.toString()
}

export const taxReportHref = (f: TaxReportFilters) => `${TAX_REPORT_PATH}?${query(f)}`
export const taxReportExportHref = (kind: 'pdf' | 'csv', f: TaxReportFilters) => `${TAX_REPORT_EXPORT_PATH}/${kind}?${query(f)}`

// Abfragebereich für die Datenbank: erster Tag von „von“ bis letzter Tag von „bis“
export function taxReportRange(f: TaxReportFilters): { from: string; to: string } {
  const lastDay = new Date(Date.UTC(f.year, f.to, 0)).getUTCDate()
  return { from: `${f.year}-${pad(f.from)}-01`, to: `${f.year}-${pad(f.to)}-${pad(lastDay)}` }
}

// Zeitraum reicht in den laufenden Monat oder in die Zukunft
export const periodOpen = (f: TaxReportFilters, today: string) => f.year * 12 + f.to >= yearOf(today) * 12 + monthOf(today)

// Art der Zeitraumbezeichnung: „Oktober 2026“, „2025“ (ganzes Jahr), „Juli – September 2026“
export type PeriodKind = 'month' | 'year' | 'range'
export const periodKind = (f: TaxReportFilters): PeriodKind => (f.from === f.to ? 'month' : f.from === 1 && f.to === 12 ? 'year' : 'range')

// Zeitraum in Worten mit den Texten aus „touristTaxReport.period“: „Oktober 2026“, „Juli – September 2026“, „2025“
export function periodLabel(t: (key: string, values: Record<string, string>) => string, f: TaxReportFilters): string {
  const kind = periodKind(f)
  if (kind === 'month') return t('period.month', { month: String(f.from), year: String(f.year) })
  if (kind === 'year') return t('period.year', { year: String(f.year) })
  return t('period.range', { from: String(f.from), to: String(f.to), year: String(f.year) })
}

// Teil des Dateinamens: 2026-10, 2025, 2026-07-bis-09
export function periodFileKey(f: TaxReportFilters): string {
  const kind = periodKind(f)
  if (kind === 'month') return `${f.year}-${pad(f.from)}`
  if (kind === 'year') return String(f.year)
  return `${f.year}-${pad(f.from)}-bis-${pad(f.to)}`
}

// Gemeindename für Dateinamen: Leerraum → „-“, nur Buchstaben, Ziffern und „-“
export const fileNamePart = (name: string) =>
  name
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')
    .replace(/-+/g, '-') || 'Gemeinde'

export function taxReportFileName(kind: 'pdf' | 'csv', f: TaxReportFilters, municipalityName: string | null, today: string): string {
  const base = `Ortstaxe_${periodFileKey(f)}_${municipalityName ? fileNamePart(municipalityName) : 'Alle'}`
  return kind === 'pdf' ? `${base}.pdf` : `${base}_Stand-${today}.csv`
}

// ---- Zeilen und Gruppierung -----------------------------------------------------------------

// Eine Zeile je Buchung und Gemeinde, Werte im gewählten Zeitraum (aus der Berichtsfunktion der Datenbank)
export type TaxReportRow = {
  bookingId: string
  bookingNumber: string | null
  // „Nachname Vorname“; null ohne Hauptgast
  guestName: string | null
  anonymized: boolean
  apartment: string
  municipalityId: string
  municipalityName: string
  arrival: string
  // tatsächliche Abreise
  departure: string
  persons: number
  amountCents: number
  // null: mindestens eine Position ohne bekannte Personennächte
  taxableNights: number | null
  // bekannter Teil der abgabepflichtigen Personennächte (für die Gemeindesumme)
  knownTaxableNights: number
  // null: nicht bestimmbar (Alt-Position, Prozent-Tarif)
  exemptNights: number | null
  // Positionen ohne bekannte Personennächte
  unknownPositions: number
  partial: boolean
  legacy: boolean
  percent: boolean
}

export type TaxReportSum = {
  taxableNights: number
  // nur bekannte Werte
  exemptNights: number
  amountCents: number
  // Positionen ohne bekannte abgabepflichtige Personennächte
  unknownPositions: number
  // Buchungen ohne bestimmbare befreite Personennächte (Alt-Position, Prozent-Tarif; QA BUG-2)
  exemptUnknown: number
}
export type TaxReportGroup = { id: string; name: string; rows: TaxReportRow[]; sum: TaxReportSum }
export type TaxReportView = {
  groups: TaxReportGroup[]
  // nur bei mehr als einer Gemeinde
  total: TaxReportSum | null
  // alle Gemeinden mit Ortstaxe im Zeitraum (für die Auswahl), alphabetisch
  municipalities: { id: string; name: string }[]
  // tatsächlich wirksamer Gemeindefilter (null, wenn die gewählte Gemeinde im Zeitraum keine Ortstaxe hat)
  municipality: string | null
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'de')

// Nach Anreise, bei gleicher Anreise nach Buchungsnummer (numerisch, wo möglich)
export function compareRows(a: TaxReportRow, b: TaxReportRow): number {
  if (a.arrival !== b.arrival) return a.arrival < b.arrival ? -1 : 1
  return (a.bookingNumber ?? '').localeCompare(b.bookingNumber ?? '', 'de', { numeric: true })
}

const emptySum = (): TaxReportSum => ({ taxableNights: 0, exemptNights: 0, amountCents: 0, unknownPositions: 0, exemptUnknown: 0 })

function addRow(s: TaxReportSum, r: TaxReportRow): TaxReportSum {
  return {
    taxableNights: s.taxableNights + r.knownTaxableNights,
    exemptNights: s.exemptNights + (r.exemptNights ?? 0),
    amountCents: s.amountCents + r.amountCents,
    unknownPositions: s.unknownPositions + r.unknownPositions,
    exemptUnknown: s.exemptUnknown + (r.exemptNights === null ? 1 : 0),
  }
}

const addSum = (a: TaxReportSum, b: TaxReportSum): TaxReportSum => ({
  taxableNights: a.taxableNights + b.taxableNights,
  exemptNights: a.exemptNights + b.exemptNights,
  amountCents: a.amountCents + b.amountCents,
  unknownPositions: a.unknownPositions + b.unknownPositions,
  exemptUnknown: a.exemptUnknown + b.exemptUnknown,
})

export function buildTaxReport(rows: readonly TaxReportRow[], municipality: string | null): TaxReportView {
  const all = new Map<string, TaxReportGroup>()
  for (const r of rows) {
    const g = all.get(r.municipalityId) ?? { id: r.municipalityId, name: r.municipalityName, rows: [], sum: emptySum() }
    g.rows.push(r)
    g.sum = addRow(g.sum, r)
    all.set(r.municipalityId, g)
  }
  const sorted = [...all.values()].sort(byName)
  for (const g of sorted) g.rows.sort(compareRows)
  const effective = municipality && all.has(municipality) ? municipality : null
  const groups = effective ? sorted.filter((g) => g.id === effective) : sorted
  return {
    groups,
    total: groups.length > 1 ? groups.reduce((s, g) => addSum(s, g.sum), emptySum()) : null,
    municipalities: sorted.map((g) => ({ id: g.id, name: g.name })),
    municipality: effective,
  }
}

export type RowNote = 'partial' | 'legacy' | 'percent'
// „Alt-Position“ auch, wenn nur die befreiten Personennächte fehlen: Ohne Prozent-Tarif und mit bekannten abgabepflichtigen
// Personennächten liegt das immer an einer Alt-Position (QA BUG-2), sonst stünde in der Zeile ein unerklärtes „–“
export const rowNotes = (r: Pick<TaxReportRow, 'partial' | 'legacy' | 'percent' | 'exemptNights'>): RowNote[] => {
  const legacy = r.legacy || (r.exemptNights === null && !r.percent)
  return (['partial', 'legacy', 'percent'] as const).filter((n) => (n === 'legacy' ? legacy : r[n]))
}

// ---- CSV ------------------------------------------------------------------------------------

export type CsvLabels = {
  columns: readonly string[]
  notes: Record<RowNote, string>
  anonymized: string
}

// Text, den Excel als Formel lesen würde, mit vorangestelltem Hochkomma entschärfen
export function csvText(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[;"\r\n]/.test(safe) || safe !== safe.trim() ? `"${safe.replace(/"/g, '""')}"` : safe
}

// Betrag ohne „€“ und ohne Tausendertrennung: 1030,00 bzw. -5,00
export const csvCents = (cents: number) => `${cents < 0 ? '-' : ''}${Math.floor(Math.abs(cents) / 100)},${pad(Math.abs(cents) % 100)}`

const csvNumber = (n: number | null) => (n === null ? '' : String(n))

// Eine Zeile je Buchung und Gemeinde, ohne Summen; Strichpunkt, Komma, UTF-8 mit BOM, Zeilenende CRLF
export function buildTaxReportCsv(groups: readonly TaxReportGroup[], labels: CsvLabels): string {
  const lines = [labels.columns.map(csvText).join(';')]
  for (const g of groups) {
    for (const r of g.rows) {
      lines.push(
        [
          csvText(g.name),
          csvText(r.bookingNumber ?? ''),
          csvText(r.anonymized ? labels.anonymized : (r.guestName ?? '')),
          csvText(r.apartment),
          formatDatePlain(r.arrival),
          formatDatePlain(r.departure),
          String(r.persons),
          csvNumber(r.taxableNights),
          csvNumber(r.exemptNights),
          csvCents(r.amountCents),
          csvText(rowNotes(r).map((n) => labels.notes[n]).join(', ')),
        ].join(';')
      )
    }
  }
  return `﻿${lines.join('\r\n')}\r\n`
}
