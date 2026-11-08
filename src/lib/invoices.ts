// Rechnungen (PROJ-37 „Rechnungen nacherfassen“; PROJ-40 bis PROJ-42 bauen darauf auf): Typen, Grenzen und reine Regeln
// für Browser und Server, ohne Datenbankzugriff.

import { addDays, isIsoDate, LIMITS as BOOKING_LIMITS, todayIso } from '@/lib/bookings'
import type { InvoiceButtonState, InvoiceDocKind, InvoiceKind } from '@/lib/invoice-drafts'
import type { IssuedSnapshot } from '@/lib/invoice-issue'
import type { PaymentState } from '@/lib/payments'
import { vatBreakdown, type VatShare } from '@/lib/vat'

export type InvoiceErrorCode =
  // PROJ-50: gewählte Firma des neuen Gastes gibt es nicht mehr
  | 'companyMissing'
  | 'ownerOnly'
  | 'notFound'
  | 'staleInvoice'
  | 'numberTaken'
  | 'backfillDisabled'
  | 'dateInFuture'
  | 'pdfMissing'
  | 'bookingInvalid'
  | 'guestInvalid'
  | 'guestAnonymized'
  | 'tenantDeactivated'
  | 'documentImageMissing'
  // Entwurf (PROJ-40)
  | 'nothingToBill'
  | 'deductionInvalid'
  | 'contentInvalid'
  | 'notDraft'
  // Ausstellen (PROJ-42)
  | 'deductedByIssued'
  // Zahlungen hängen an der Rechnung (PROJ-45): Löschen gesperrt
  | 'invoiceHasPayments'
  | 'alreadyPaidInvalid'

// Herkunft: nacherfasst (PROJ-37), Entwurf ohne Nummer (PROJ-40), ausgestellt (PROJ-41)
export type InvoiceOrigin = 'backfilled' | 'draft' | 'issued'

// „Verrechnet“ zählt nacherfasste und ausgestellte Rechnungen, nicht Entwürfe
export const isBilled = (origin: InvoiceOrigin) => origin !== 'draft'

export const invoiceOriginFromDb = (value: string): InvoiceOrigin => (value === 'draft' || value === 'issued' ? value : 'backfilled')
export const invoiceKindFromDb = (value: string | null): InvoiceKind | null =>
  value === 'invoice' || value === 'partial' || value === 'final' ? value : null
// Art eines Belegs in Listen und Detail: auch die Gutschrift (PROJ-44)
export const invoiceDocKindFromDb = (value: string | null): InvoiceDocKind | null => (value === 'credit_note' ? value : invoiceKindFromDb(value))

// Verweis zwischen Rechnung und Gutschrift (PROJ-44): Nummer und Link
export type DocLink = { id: string; number: string }

export const INVOICE_LIMITS = {
  numberMax: 30,
  recipientMax: 200,
  lineLabelMax: BOOKING_LIMITS.chargeLabelMax,
  linesMax: 50,
  amountMaxCents: BOOKING_LIMITS.amountMaxCents,
  pdfMaxBytes: 10 * 1024 * 1024,
  // Ältere Rechnungsdaten: nur ein Hinweis (Aufbewahrungsfrist 7 Jahre)
  oldYears: 7,
} as const

export const INVOICE_PAGE_SIZE = 50

// Privater Speicherbereich der Rechnungs-PDFs, ein Ordner je Kunde
export const INVOICE_BUCKET = 'invoices'

// Platzhalter im Formular, solange ein PDF hochgeladen wird
export const PDF_UPLOADING = '__uploading__'

export type InvoiceLine = { label: string; amountCents: number; vatBp: number }

// Zeile der Rechnungsliste
export type InvoiceRow = {
  id: string
  // Entwürfe haben keine Nummer (Anzeige „–“)
  number: string | null
  invoiceDate: string
  recipient: string
  totalCents: number
  origin: InvoiceOrigin
  // Art bei Entwürfen und ausgestellten Rechnungen
  kind: InvoiceDocKind | null
  hasPdf: boolean
  booking: { id: string; number: string | null } | null
  // Gutschrift, die diese Rechnung storniert (PROJ-44)
  cancelledBy: DocLink | null
  // Zahlungsstand (PROJ-45), in der Liste gesetzt
  payment?: PaymentState
}

export type InvoiceButtonBlockReason = Extract<InvoiceButtonState, { enabled: false }>['reason']

// ---- Filter der Rechnungsliste (PROJ-43) ----------------------------------------------------------

// Status: Herkunft bzw. Art; „ausgestellt“ und „nacherfasst“ ohne stornierte, „storniert“ ohne die Gutschriften
export const INVOICE_STATUS_FILTERS = ['draft', 'issued', 'backfilled', 'cancelled', 'credit_note'] as const
export type InvoiceStatusFilter = (typeof INVOICE_STATUS_FILTERS)[number]

// Zahlung (PROJ-45): „unpaid“ = offen und teilweise; „overdue“ = überfällig (offen oder teilweise)
export const INVOICE_PAYMENT_FILTERS = ['unpaid', 'open', 'partial', 'paid', 'overpaid', 'overdue'] as const
export type InvoicePaymentFilter = (typeof INVOICE_PAYMENT_FILTERS)[number]

// Freie Jahreseingabe: vierstellig, 1990 bis 2099; Auswahl: 7 Jahre zurück bis 5 voraus
export const INVOICE_YEAR_MIN = 1990
export const INVOICE_YEAR_MAX = 2099
const YEARS_BACK = 7
const YEARS_AHEAD = 5

export type InvoiceFilters = {
  query: string
  page: number
  year: number | null
  status: InvoiceStatusFilter | null
  payment: InvoicePaymentFilter | null
  // Rechnungsbetrag brutto in Cent, Grenzen inklusive; null = ohne Grenze
  minCents: number | null
  maxCents: number | null
}

export const EMPTY_INVOICE_FILTERS: InvoiceFilters = { query: '', page: 1, year: null, status: null, payment: null, minCents: null, maxCents: null }

// Summen über alle Seiten der gefilterten Liste (Entwürfe ohne; „Offen“ nur positive offene Beträge zahlbarer Rechnungen)
export type InvoiceTotals = { totalCents: number; paidCents: number; openCents: number }

export type InvoicePage = InvoiceFilters & {
  rows: InvoiceRow[]
  total: number
  pageCount: number
  // null, solange die Datenbank die Summen noch nicht liefert (Umgebung ohne Migration)
  totals: InvoiceTotals | null
  // false: Status „storniert“/„ausgestellt“/„nacherfasst“ und der Zahlungsfilter wirken erst mit der Migration
  ready: boolean
}

// Auswahl im Jahresfilter: aktuelles Jahr + 5 bis aktuelles Jahr − 7, absteigend
export function invoiceYearOptions(today: string = todayIso()): number[] {
  const current = Number(today.slice(0, 4))
  return Array.from({ length: YEARS_BACK + YEARS_AHEAD + 1 }, (_, i) => current + YEARS_AHEAD - i)
}

// Frei eingegebenes Jahr: vierstellig und in den Grenzen, sonst null
export function parseInvoiceYear(input: string): number | null {
  const value = input.trim()
  if (!/^\d{4}$/.test(value)) return null
  const year = Number(value)
  return year >= INVOICE_YEAR_MIN && year <= INVOICE_YEAR_MAX ? year : null
}

// Beträge in der Adresse: Euro mit Punkt und höchstens zwei Nachkommastellen, auch negativ („-450“, „1200.5“)
const URL_AMOUNT = /^-?\d{1,7}(\.\d{1,2})?$/
function amountFromUrl(value: string): number | null {
  if (!URL_AMOUNT.test(value)) return null
  const cents = Math.round(Number(value) * 100)
  return cents === 0 ? 0 : cents
}
function amountToUrl(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const euros = Math.floor(abs / 100)
  const rest = abs % 100
  return `${sign}${euros}${rest ? `.${String(rest).padStart(2, '0')}` : ''}`
}

// Sind Filter oder Suche gesetzt? („Filter zurücksetzen“, Anzahl am Handy ohne Suche)
export function activeInvoiceFilterCount(f: Pick<InvoiceFilters, 'year' | 'status' | 'payment' | 'minCents' | 'maxCents'>): number {
  return [f.year, f.status, f.payment].filter((v) => v !== null).length + (f.minCents !== null || f.maxCents !== null ? 1 : 0)
}

export type InvoiceGuest = {
  id: string
  lastName: string
  firstName: string | null
  titlePrefix: string | null
  titleSuffix: string | null
  country: string
  companyName: string | null
  anonymized: boolean
}

export type InvoiceBookingRef = {
  id: string
  kind: 'booking' | 'option'
  number: string | null
  guestName: string | null
  apartmentLabel: string
  arrival: string
  departure: string
  cancelled: boolean
}

export type InvoicePdfLinks = { view: string; download: string }

// Vollständige Rechnung (Detailseite, Formular „Bearbeiten“)
export type Invoice = {
  id: string
  number: string
  invoiceDate: string
  origin: InvoiceOrigin
  kind: InvoiceDocKind | null
  recipient: string
  smallBusiness: boolean
  totalCents: number
  lines: InvoiceLine[]
  guest: InvoiceGuest | null
  booking: InvoiceBookingRef | null
  pdfPath: string | null
  pdf: InvoicePdfLinks | null
  updatedAt: string
  // Nur bei ausgestellten Rechnungen (PROJ-42)
  issued: { at: string; byName: string | null; withoutLogo: boolean; snapshot: IssuedSnapshot } | null
  // Gutschrift, die diese Rechnung storniert (PROJ-44)
  cancelledBy: DocLink | null
  // Gültige (ausgestellte, nicht stornierte) Schlussrechnung, die diese Teilrechnung abzieht (PROJ-44)
  deductedBy: DocLink | null
}

// Abschnitt „Rechnungen“ im Buchungsdetail: Rechnungen, verrechnete Summe, Summe der Entwürfe und Gesamtpreis
// (auch für Mitarbeiter)
export type BookingInvoices = {
  invoices: Pick<InvoiceRow, 'id' | 'number' | 'invoiceDate' | 'recipient' | 'totalCents' | 'origin' | 'kind' | 'hasPdf' | 'cancelledBy'>[]
  // nacherfasst und ausgestellt
  billedCents: number
  // Entwürfe (PROJ-40)
  draftCents: number
  bookingTotalCents: number | null
}

// Beträge einer Buchung, aus denen die Positionen übernommen werden
export type BookingAmountsForInvoice = {
  cancelled: boolean
  billedNightsCents: number
  nightsVatBp: number
  charges: InvoiceLine[]
  cancellationFeeCents: number | null
  cancellationFeeVatBp: number
}

// Treffer der Buchungsauswahl im Formular samt Daten zum Vorbelegen
export type InvoiceBookingOption = InvoiceBookingRef

// Treffer der Suche „Rechnung erstellen“ (PROJ-43): wählbar, wenn der Knopf „Rechnung“ der Buchung aktiv wäre
export type DraftBookingOption = InvoiceBookingOption & { blocked: InvoiceButtonBlockReason | null }

export type InvoiceBookingDetails = {
  guest: InvoiceGuest | null
  amounts: BookingAmountsForInvoice | null
  // Buchung über booking.com oder Airbnb: „Bereits bezahlt“ mit Provision und Zahlungsgebühr (PROJ-45)
  platform: boolean
}

export const invoiceHref = (id: string) => `/rechnungen/${id}`

// Entwurf aus der Rechnungsliste (PROJ-43): „Abbrechen“ und der Rückweg führen zur Liste statt zur Buchung
export const newDraftFromListHref = (bookingId: string) => `/rechnungen/neu?buchung=${encodeURIComponent(bookingId)}&von=liste`
// Seite „Gutschrift ausstellen“ zu einer Rechnung (PROJ-44)
export const creditNoteHref = (invoiceId: string) => `/rechnungen/${invoiceId}/gutschrift`

// Vergleichsschlüssel der Rechnungsnummer: ohne Rand-Leerzeichen, Kleinschreibung (gleiche Regel in der Datenbank)
export const invoiceNumberKey = (value: string) => value.trim().toLocaleLowerCase('de')

// Empfänger-Vorschlag: Firma des Gastes, sonst „Nachname Vorname“
export function recipientFor(g: { lastName: string; firstName: string | null; companyName: string | null }): string {
  const company = g.companyName?.trim()
  if (company) return company
  return [g.lastName, g.firstName].filter(Boolean).join(' ')
}

// Treffer der Buchungssuche: „Huber Maria“
export const bookingGuestName = (g: { lastName: string; firstName: string | null } | null) =>
  g ? [g.lastName, g.firstName].filter(Boolean).join(' ') : null

// Positionen einer Buchung für die Rechnung (Kopie): aktiv → abgerechnete Übernachtung und Zusatzkosten in der
// Reihenfolge aus PROJ-34; storniert → nur die Stornogebühr (falls vorhanden)
export function linesFromBooking(a: BookingAmountsForInvoice, labels: { nights: string; cancellationFee: string }): InvoiceLine[] {
  if (a.cancelled) {
    return a.cancellationFeeCents === null ? [] : [{ label: labels.cancellationFee, amountCents: a.cancellationFeeCents, vatBp: a.cancellationFeeVatBp }]
  }
  return [{ label: labels.nights, amountCents: a.billedNightsCents, vatBp: a.nightsVatBp }, ...a.charges]
}

export const linesTotal = (lines: readonly Pick<InvoiceLine, 'amountCents'>[]) => lines.reduce((sum, l) => sum + l.amountCents, 0)

// Enthaltene USt je Satz; bei Kleinunternehmern keine
export const invoiceVatShares = (lines: readonly InvoiceLine[], smallBusiness: boolean): VatShare[] => (smallBusiness ? [] : vatBreakdown(lines))

// Rechnungsdatum älter als 7 Jahre → Hinweis (Speichern bleibt möglich)
export function isOldInvoiceDate(date: string, today: string = todayIso()): boolean {
  if (!isIsoDate(date)) return false
  const limit = `${Number(today.slice(0, 4)) - INVOICE_LIMITS.oldYears}${today.slice(4)}`
  // 29. Februar → 1. März des Vergleichsjahres
  return date < (isIsoDate(limit) ? limit : addDays(`${limit.slice(0, 8)}28`, 1))
}

// Datei-Prüfung vor dem Hochladen: nur PDF (Typ oder Endung), höchstens 10 MB
export type PdfErrorCode = 'pdfNotPdf' | 'pdfTooLarge'

export function checkPdfFile(file: { name: string; type: string; size: number }): PdfErrorCode | null {
  const isPdf = file.type === 'application/pdf' || ((file.type === '' || file.type === 'application/octet-stream') && /\.pdf$/i.test(file.name))
  if (!isPdf) return 'pdfNotPdf'
  if (file.size > INVOICE_LIMITS.pdfMaxBytes) return 'pdfTooLarge'
  return null
}

// Suchbegriff und Seite stehen in der Adresse (?q=…&seite=2)
// Filter aus der Adresse; ungültige Werte fallen weg (alte oder von Hand geänderte Links führen nicht zu Fehlern).
// „von“ größer als „bis“ verwirft beide Betragsgrenzen.
export function parseInvoiceFilters(params: Record<string, string | string[] | undefined>): InvoiceFilters {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''
  const status = first(params.status)
  const payment = first(params.zahlung)
  let minCents = amountFromUrl(first(params.von))
  let maxCents = amountFromUrl(first(params.bis))
  if (minCents !== null && maxCents !== null && minCents > maxCents) minCents = maxCents = null
  return {
    query: first(params.q).trim().slice(0, 100),
    page: Math.max(1, Math.floor(Number(first(params.seite)) || 1)),
    year: parseInvoiceYear(first(params.jahr)),
    status: (INVOICE_STATUS_FILTERS as readonly string[]).includes(status) ? (status as InvoiceStatusFilter) : null,
    payment: (INVOICE_PAYMENT_FILTERS as readonly string[]).includes(payment) ? (payment as InvoicePaymentFilter) : null,
    minCents,
    maxCents,
  }
}

export function invoiceListHref(filters: Partial<InvoiceFilters>): string {
  const params = new URLSearchParams()
  if (filters.query) params.set('q', filters.query)
  if (filters.year) params.set('jahr', String(filters.year))
  if (filters.status) params.set('status', filters.status)
  if (filters.payment) params.set('zahlung', filters.payment)
  if (filters.minCents !== null && filters.minCents !== undefined) params.set('von', amountToUrl(filters.minCents))
  if (filters.maxCents !== null && filters.maxCents !== undefined) params.set('bis', amountToUrl(filters.maxCents))
  if (filters.page && filters.page > 1) params.set('seite', String(filters.page))
  const search = params.toString()
  return search ? `/rechnungen?${search}` : '/rechnungen'
}

// Suchbegriff für die Datenbank-Abfrage: ohne Zeichen, die PostgREST bzw. LIKE als Steuerzeichen lesen
export const cleanInvoiceQuery = (value: string) =>
  value
    .replace(/["\\,()%*_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100)

// Suchmuster der Rechnungsliste (ilike, Wert in Anführungszeichen): „%“ und „_“ kommen in Rechnungsnummern vor und
// werden als Zeichen gesucht, nicht als Platzhalter. Anführungszeichen, Backslash und „*“ (Platzhalter bei PostgREST)
// fallen weg. Ein Backslash im Anführungszeichen-Wert maskiert das nächste Zeichen, darum doppelt („\\_“ → LIKE „\_“).
// Leerer Suchbegriff → null.
export function invoiceSearchPattern(value: string): string | null {
  const query = value
    .replace(/["\\*]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 100)
  return query ? `%${query.replace(/[%_]/g, (c) => `\\\\${c}`)}%` : null
}
