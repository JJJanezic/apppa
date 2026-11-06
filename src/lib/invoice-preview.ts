// Vorschau eines Rechnungsentwurfs (PROJ-40): alle Inhalte der Rechnung in der Reihenfolge aus PROJ-39, berechnet aus
// Entwurf (gespeichert oder ungespeicherter Formularstand), Buchung und Vorschau-Daten. Reine Regel für Server und
// Browser; das PDF (PROJ-41) baut darauf auf.

import {
  type BookingInvoiceSummary,
  type CompanySalutation,
  type DraftBooking,
  type DraftLine,
  type DraftPreviewData,
  type DraftRecipient,
  draftPlaceholderValues,
  draftTotals,
  type DraftTotals,
  type GuestNameMode,
  guestNames,
  type InvoiceKind,
  partialLabel,
  paymentSchedule,
  type PaymentSchedule,
  type RecipientKind,
} from '@/lib/invoice-drafts'
import type { PaymentRules, PlaceholderValues, TextBlockKind } from '@/lib/invoice-texts'
import type { RichDoc } from '@/lib/rich-text'
import { vatBreakdown, type VatShare } from '@/lib/vat'

export type PreviewDeduction = Pick<BookingInvoiceSummary, 'id' | 'number' | 'origin' | 'kind' | 'invoiceDate' | 'totalCents'> & {
  vatShares: VatShare[]
}

export type InvoicePreviewModel = {
  kind: InvoiceKind
  invoiceDate: string
  issuer: DraftPreviewData['issuer']
  recipient: DraftRecipient
  booking: Pick<DraftBooking, 'apartmentLabel' | 'arrival' | 'departure'>
  guestNames: string[]
  // Teilrechnung: Zeile „Anzahlung für Aufenthalt …“; die Zeilen je Satz stehen in lines
  partialLabel: string | null
  lines: DraftLine[]
  deductions: PreviewDeduction[]
  // Abgezogene Rechnungen, die es nicht mehr gibt (Hinweis): beim Laden fehlend oder beim Löschen entfernt
  missingDeductions: number
  totals: DraftTotals
  smallBusiness: boolean
  smallBusinessNote: RichDoc | null
  texts: Record<TextBlockKind, RichDoc | null>
  values: PlaceholderValues
  payment: PaymentRules
  schedule: PaymentSchedule
  footer: RichDoc | null
  // Gutschrift (PROJ-44): Verweis auf die stornierte Rechnung und Grund; Beträge im Modell sind schon gespiegelt
  credit?: { invoiceNumber: string; invoiceDate: string; reason: string | null }
}

export type PreviewInput = {
  kind: InvoiceKind
  invoiceDate: string
  recipientKind: RecipientKind
  recipient: DraftRecipient
  companySalutation: CompanySalutation
  guestNameMode: GuestNameMode
  lines: DraftLine[]
  deductionIds: string[]
  texts: Record<TextBlockKind, RichDoc | null>
  payment: PaymentRules
  booking: DraftBooking
  others: BookingInvoiceSummary[]
  preview: Omit<DraftPreviewData, 'letterhead'>
  smallBusiness: boolean
  // Gespeicherter Entwurf: eine abgezogene Rechnung wurde gelöscht bzw. ist keine Teilrechnung mehr (deduction_removed)
  deductionRemoved?: boolean
  // Vorgesehene Nummer auf der Seite „Rechnung ausstellen“ (PROJ-42); sonst ergibt {Rechnungsnummer} „Entwurf“
  invoiceNumber?: string
}

export function buildPreviewModel(p: PreviewInput): InvoicePreviewModel {
  const byId = new Map(p.others.map((o) => [o.id, o]))
  const deducted = p.kind === 'final' ? p.deductionIds.map((id) => byId.get(id)).filter((o): o is BookingInvoiceSummary => Boolean(o)) : []
  const totals = draftTotals({ kind: p.kind, lines: p.lines, deductions: deducted, smallBusiness: p.smallBusiness })
  return {
    kind: p.kind,
    invoiceDate: p.invoiceDate,
    issuer: p.preview.issuer,
    recipient: p.recipient,
    booking: p.booking,
    guestNames: guestNames(p.guestNameMode, p.booking),
    partialLabel: p.kind === 'partial' ? partialLabel(p.booking) : null,
    lines: p.lines,
    deductions: deducted.map((d) => ({
      id: d.id,
      number: d.number,
      origin: d.origin,
      kind: d.kind,
      invoiceDate: d.invoiceDate,
      totalCents: d.totalCents,
      vatShares: p.smallBusiness ? [] : vatBreakdown(d.lines),
    })),
    missingDeductions: p.kind === 'final' ? p.deductionIds.length - deducted.length + (p.deductionRemoved ? 1 : 0) : 0,
    totals,
    smallBusiness: p.smallBusiness,
    smallBusinessNote: p.preview.smallBusinessNote,
    texts: p.texts,
    values: draftPlaceholderValues({
      booking: p.booking,
      recipientKind: p.recipientKind,
      companySalutation: p.companySalutation,
      invoiceDate: p.invoiceDate,
      totalCents: totals.totalCents,
      payment: p.payment,
      invoiceNumber: p.invoiceNumber,
    }),
    payment: p.payment,
    schedule: paymentSchedule(p.payment, totals.totalCents, p.invoiceDate, p.booking.arrival),
    footer: p.preview.footer,
  }
}
