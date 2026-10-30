// Rechnungen (PROJ-37 „Rechnungen nacherfassen“; PROJ-38/39 bauen darauf auf): Typen, Grenzen und reine Regeln
// für Browser und Server, ohne Datenbankzugriff.

import { addDays, isIsoDate, LIMITS as BOOKING_LIMITS, todayIso } from '@/lib/bookings'
import { vatBreakdown, type VatShare } from '@/lib/vat'

export type InvoiceErrorCode =
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

// Herkunft: nacherfasst (PROJ-37); „ausgestellt“ kommt mit PROJ-38
export type InvoiceOrigin = 'backfilled'

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
  number: string
  invoiceDate: string
  recipient: string
  totalCents: number
  origin: InvoiceOrigin
  hasPdf: boolean
  booking: { id: string; number: string | null } | null
}

export type InvoiceFilters = { query: string; page: number }

export type InvoicePage = InvoiceFilters & { rows: InvoiceRow[]; total: number; pageCount: number }

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
  recipient: string
  smallBusiness: boolean
  totalCents: number
  lines: InvoiceLine[]
  guest: InvoiceGuest | null
  booking: InvoiceBookingRef | null
  pdfPath: string | null
  pdf: InvoicePdfLinks | null
  updatedAt: string
}

// Abschnitt „Rechnungen“ im Buchungsdetail: Rechnungen, verrechnete Summe und Gesamtpreis (auch für Mitarbeiter)
export type BookingInvoices = {
  invoices: Pick<InvoiceRow, 'id' | 'number' | 'invoiceDate' | 'recipient' | 'totalCents' | 'origin' | 'hasPdf'>[]
  billedCents: number
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

export type InvoiceBookingDetails = {
  guest: InvoiceGuest | null
  amounts: BookingAmountsForInvoice | null
}

export const invoiceHref = (id: string) => `/rechnungen/${id}`

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
export function parseInvoiceFilters(params: Record<string, string | string[] | undefined>): InvoiceFilters {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''
  return {
    query: first(params.q).trim().slice(0, 100),
    page: Math.max(1, Math.floor(Number(first(params.seite)) || 1)),
  }
}

export function invoiceListHref(filters: Partial<InvoiceFilters>): string {
  const params = new URLSearchParams()
  if (filters.query) params.set('q', filters.query)
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
