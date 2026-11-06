// Zahlungserfassung (PROJ-45): Typen, Grenzen und reine Regeln für Browser und Server, ohne Datenbankzugriff.
// Status, Summen, Guthaben und „überfällig“ bildet die Datenbank (Lesesicht invoice_payment_status). Die gleichlautenden
// Regeln hier liefern Vorschläge und Hinweise im Zahlungs-Dialog und den Stand, solange die Lesesicht fehlt.

import { currentMonth, monthRange, todayIso } from '@/lib/bookings'
import type { BookingSource } from '@/lib/bookings'
import type { InvoiceDocKind, PaymentSchedule } from '@/lib/invoice-drafts'
import type { InvoiceOrigin } from '@/lib/invoices'

export type PaymentErrorCode =
  | 'ownerOnly'
  | 'notFound'
  | 'invoiceNotPayable'
  | 'invoiceCancelled'
  | 'notCreditNote'
  | 'dateInFuture'
  | 'amountInvalid'
  | 'commissionNotAllowed'
  | 'methodInactive'
  | 'receiptMissing'
  | 'stalePayment'
  | 'tenantDeactivated'

export type PaymentMethodErrorCode = 'ownerOnly' | 'nameTaken' | 'methodInUse' | 'lastActive' | 'defaultInactive' | 'staleMethods' | 'tenantDeactivated'

// Eintrag: Zahlung an einer Rechnung oder Rückzahlung an einer Gutschrift
export type PaymentKind = 'payment' | 'refund'

export type PaymentStatus = 'open' | 'partial' | 'paid' | 'overpaid'

export const PAYMENT_LIMITS = {
  noteMax: 300,
  methodNameMax: 50,
  methodsMax: 30,
  receiptPdfMaxBytes: 10 * 1024 * 1024,
  // Höchstbetrag wie bei Buchungen (9.999.999,99 €)
  amountMaxCents: 999_999_999,
} as const

export const PAYMENT_PAGE_SIZE = 50

// Privater Speicherbereich der Belege, ein Ordner je Kunde
export const RECEIPT_BUCKET = 'payment-receipts'
// Platzhalter im Formular, solange ein Beleg hochgeladen wird
export const RECEIPT_UPLOADING = '__uploading__'
// Auswahl im Dateidialog: PDF und alle Bilder, HEIC/HEIF ausdrücklich
export const RECEIPT_ACCEPT = 'application/pdf,.pdf,image/*,.heic,.heif'

// Standard-Zahlungsarten für neue Kunden (legt die Datenbank an; hier nur für Tests und Texte)
export const DEFAULT_PAYMENT_METHODS = ['Überweisung', 'Bar', 'Karte', 'PayPal', 'über booking.com', 'über Airbnb'] as const

export type PaymentMethod = { id: string; name: string; active: boolean; isDefault: boolean }

// Plattform-Buchung (Provision und Zahlungsgebühr möglich): Buchungsquelle booking.com oder Airbnb; nach dem Import
// (PROJ-11) zusätzlich der Kanal
export const PLATFORM_SOURCES: readonly BookingSource[] = ['booking_com', 'airbnb']
export const isPlatformSource = (source: BookingSource | null | undefined) => source !== null && source !== undefined && PLATFORM_SOURCES.includes(source)

export type Payment = {
  id: string
  kind: PaymentKind
  invoiceId: string
  paidOn: string
  amountCents: number
  commissionCents: number
  feeCents: number
  method: { id: string; name: string; active: boolean } | null
  note: string | null
  receipt: { path: string; type: 'pdf' | 'image' } | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

// Beglichen je Zahlung = Betrag + Provision + Zahlungsgebühr
export const settledOf = (p: Pick<Payment, 'amountCents' | 'commissionCents' | 'feeCents'>) => p.amountCents + p.commissionCents + p.feeCents

// Zahlungsstand einer Rechnung, wie ihn Rechnungsdetail, Buchungsdetail und Rechnungsliste zeigen
export type PaymentState = {
  // none: Entwurf, nacherfasste Rechnung mit Betrag ≤ 0; payable: zahlbare Rechnung; cancelled: stornierte Rechnung;
  // credit: Gutschrift (nimmt Rückzahlungen)
  mode: 'none' | 'payable' | 'cancelled' | 'credit'
  status: PaymentStatus | null
  totalCents: number
  receivedCents: number
  commissionCents: number
  feeCents: number
  settledCents: number
  // Rechnungsbetrag − Beglichen (negativ bei Überzahlung); nur bei „payable“ sinnvoll
  openCents: number
  overdue: boolean
  // cancelled: Guthaben (eingegangen − Rückzahlungen); credit: Rückzahlung offen
  balanceCents: number
  // cancelled/credit: Summe der Rückzahlungen
  refundedCents: number
}

export const EMPTY_STATE: PaymentState = {
  mode: 'none',
  status: null,
  totalCents: 0,
  receivedCents: 0,
  commissionCents: 0,
  feeCents: 0,
  settledCents: 0,
  openCents: 0,
  overdue: false,
  balanceCents: 0,
  refundedCents: 0,
}

export function statusOf(totalCents: number, settledCents: number): PaymentStatus {
  if (settledCents <= 0) return 'open'
  if (settledCents < totalCents) return 'partial'
  return settledCents === totalCents ? 'paid' : 'overpaid'
}

// Bis heute fälliger Betrag nach dem Zahlungsplan der ausgestellten Rechnung. Fällig ist ein Betrag erst nach seinem
// Fälligkeitstag (am Tag selbst noch nicht überfällig).
export function dueByToday(schedule: PaymentSchedule | null, totalCents: number, today: string): number {
  if (!schedule) return 0
  if (today > schedule.due) return totalCents
  if (schedule.depositCents !== null && schedule.depositDue && today > schedule.depositDue) return schedule.depositCents
  return 0
}

export const isOverdue = (schedule: PaymentSchedule | null, totalCents: number, settledCents: number, today: string) =>
  settledCents < dueByToday(schedule, totalCents, today)

type Sums = { receivedCents: number; commissionCents: number; feeCents: number }
const sums = (payments: readonly Pick<Payment, 'amountCents' | 'commissionCents' | 'feeCents'>[]): Sums =>
  payments.reduce(
    (s, p) => ({ receivedCents: s.receivedCents + p.amountCents, commissionCents: s.commissionCents + p.commissionCents, feeCents: s.feeCents + p.feeCents }),
    { receivedCents: 0, commissionCents: 0, feeCents: 0 }
  )

export type PaymentStateInput = {
  origin: InvoiceOrigin
  kind: InvoiceDocKind | null
  totalCents: number
  cancelled: boolean
  // Zahlungen an dieser Rechnung (bei Gutschriften: Rückzahlungen an ihr)
  payments: readonly Pick<Payment, 'amountCents' | 'commissionCents' | 'feeCents'>[]
  // stornierte Rechnung: Rückzahlungen an ihrer Gutschrift; Gutschrift: eingegangen an der stornierten Rechnung
  linkedCents?: number
  schedule?: PaymentSchedule | null
  today?: string
}

// Gleiche Regel wie die Lesesicht der Datenbank (siehe Spec „Zahlungsstatus je Rechnung“, „Storno, Umhängen und Rückzahlung“)
export function computePaymentState(input: PaymentStateInput): PaymentState {
  const { origin, kind, totalCents, cancelled, payments, linkedCents = 0, schedule = null, today = todayIso() } = input
  const s = sums(payments)
  const settledCents = s.receivedCents + s.commissionCents + s.feeCents
  const base = { ...EMPTY_STATE, totalCents, ...s, settledCents }
  if (origin === 'draft') return { ...EMPTY_STATE, totalCents }
  if (kind === 'credit_note') {
    // Rückzahlung offen = eingegangen an der Rechnung (ohne Provision und Gebühr) − Rückzahlungen
    return { ...base, mode: 'credit', refundedCents: s.receivedCents, balanceCents: linkedCents - s.receivedCents }
  }
  if (cancelled) return { ...base, mode: 'cancelled', refundedCents: linkedCents, balanceCents: s.receivedCents - linkedCents }
  if (origin === 'backfilled' && totalCents <= 0) return { ...EMPTY_STATE, totalCents }
  return {
    ...base,
    mode: 'payable',
    status: statusOf(totalCents, settledCents),
    openCents: totalCents - settledCents,
    overdue: origin === 'issued' && isOverdue(schedule, totalCents, settledCents, today),
  }
}

// Kann man an dieser Rechnung eine Zahlung (bzw. bei Gutschriften eine Rückzahlung) erfassen?
export const canRecordPayment = (state: PaymentState) => state.mode === 'payable'
export const canRecordRefund = (state: PaymentState) => state.mode === 'credit' && state.balanceCents > 0

// Anzeige der Gutschrift: „Rückzahlung offen“, „erstattet“ oder nichts
export function refundLabel(state: PaymentState): 'refundOpen' | 'refunded' | null {
  if (state.mode !== 'credit') return null
  if (state.balanceCents > 0) return 'refundOpen'
  return state.refundedCents > 0 ? 'refunded' : null
}

// Vorschlag für „Betrag“ bzw. „Ausbezahlt“: Offen-Betrag minus eingetragener Provision und Gebühr; leer, wenn nichts offen ist
export function suggestedAmountCents(openCents: number, commissionCents = 0, feeCents = 0): number | null {
  const value = openCents - commissionCents - feeCents
  return value > 0 ? value : null
}

// Hinweise vor dem Speichern (die Datenbank prüft dasselbe beim Speichern erneut)
export function overpaidByCents(openCents: number, settledCents: number): number {
  return Math.max(0, settledCents - Math.max(0, openCents))
}

// ---- Zahlungsliste ------------------------------------------------------------------------------

export type PaymentFilters = {
  // Monat „2026-11“ oder null für „Alle Monate“
  month: string | null
  methodId: string | null
  query: string
  page: number
}

export type PaymentListRow = {
  id: string
  kind: PaymentKind
  paidOn: string
  amountCents: number
  commissionCents: number
  feeCents: number
  methodName: string
  receiptType: 'pdf' | 'image' | null
  invoice: { id: string; number: string | null; recipient: string }
  booking: { id: string; number: string | null } | null
}

export type PaymentTotals = { receivedCents: number; commissionCents: number; feeCents: number }

export type PaymentPage = PaymentFilters & { rows: PaymentListRow[]; total: number; pageCount: number; totals: PaymentTotals }

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/
const ALL_MONTHS = 'alle'
const isId = (v: string) => /^[0-9a-f-]{36}$/i.test(v)

// ?monat=2026-10|alle, art=<Zahlungsart>, q, seite – ungültige Werte werden ignoriert; Standard: aktueller Monat
export function parsePaymentFilters(params: Record<string, string | string[] | undefined>, today: string = todayIso()): PaymentFilters {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''
  const month = first(params.monat)
  const method = first(params.art)
  return {
    month: month === ALL_MONTHS ? null : MONTH.test(month) ? month : currentMonth(today),
    methodId: isId(method) ? method : null,
    query: first(params.q).trim().slice(0, 100),
    page: Math.max(1, Math.floor(Number(first(params.seite)) || 1)),
  }
}

export function paymentListHref(filters: Partial<PaymentFilters>, today: string = todayIso()): string {
  const params = new URLSearchParams()
  if (filters.month === null) params.set('monat', ALL_MONTHS)
  else if (filters.month && filters.month !== currentMonth(today)) params.set('monat', filters.month)
  if (filters.methodId) params.set('art', filters.methodId)
  if (filters.query) params.set('q', filters.query)
  if (filters.page && filters.page > 1) params.set('seite', String(filters.page))
  const search = params.toString()
  return search ? `/zahlungen?${search}` : '/zahlungen'
}

// Zeitraum der Liste: [von, bis) oder null für alle Monate
export const paymentRange = (filters: Pick<PaymentFilters, 'month'>) => (filters.month ? monthRange(filters.month) : null)

// Betrag einer Zeile mit Vorzeichen: Rückzahlungen zählen negativ
export const signedCents = (kind: PaymentKind, cents: number) => (kind === 'refund' ? -cents : cents)

// ---- Belege -------------------------------------------------------------------------------------

export type ReceiptErrorCode = 'receiptUnsupported' | 'receiptTooLarge'

export const isPdfFile = (file: { name: string; type: string }) =>
  file.type === 'application/pdf' || ((file.type === '' || file.type === 'application/octet-stream') && /\.pdf$/i.test(file.name))

// PDFs werden unverändert hochgeladen (bis 10 MB); Bilder vorher umgewandelt (Prüfung dort)
export function checkReceiptPdf(file: { name: string; type: string; size: number }): ReceiptErrorCode | null {
  if (!isPdfFile(file)) return 'receiptUnsupported'
  return file.size > PAYMENT_LIMITS.receiptPdfMaxBytes ? 'receiptTooLarge' : null
}

export const receiptTypeOf = (path: string): 'pdf' | 'image' => (/\.pdf$/i.test(path) ? 'pdf' : 'image')
