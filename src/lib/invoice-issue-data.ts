import 'server-only'

import { cache } from 'react'

import { todayIso } from '@/lib/bookings'
import { type CreditInput, creditChecks, creditPreviewModel } from '@/lib/invoice-credit'
import { billableCents, invoiceSums, requiredChecks } from '@/lib/invoice-drafts'
import { getDraftPreviewData, getInvoiceDraftView } from '@/lib/invoice-drafts-data'
import { type IssueChecks, issueChecks, type IssuedSnapshot, type NumberedInvoice } from '@/lib/invoice-issue'
import type { NumberingSettings } from '@/lib/invoice-numbering'
import type { PdfMeta, PdfView } from '@/lib/invoice-pdf/types'
import { buildPreviewModel, type InvoicePreviewModel } from '@/lib/invoice-preview'
import { loadInvoiceSettings } from '@/lib/invoice-settings-data'
import { getInvoice } from '@/lib/invoices-data'
import { createClient } from '@/lib/supabase/server'

const PAGE = 1000

// Stand nicht lesbar; Weiterleitungen wie „nicht gefunden“ bleiben davon unberührt
export class IssueDataError extends Error {}

// Alle vergebenen Nummern samt Datum. Seitenweise: Zeilenabfragen kappt PostgREST (BUG-3 aus PROJ-39); Ende ist erst die
// leere Antwort, so spielt die eingestellte Grenze keine Rolle.
export const getNumberedInvoices = cache(async (tenantId: string): Promise<NumberedInvoice[]> => {
  const supabase = await createClient()
  const all: NumberedInvoice[] = []
  for (;;) {
    const { data, error } = await supabase
      .from('invoices')
      .select('number, invoice_date')
      .eq('tenant_id', tenantId)
      .not('number', 'is', null)
      .order('id')
      .range(all.length, all.length + PAGE - 1)
    if (error) throw new IssueDataError(`Rechnungsnummern nicht lesbar: ${error.message}`)
    if (!data?.length) return all
    all.push(...data.map((r) => ({ number: r.number as string, invoiceDate: r.invoice_date })))
  }
})

// Stand für Vorschau und Ausstellen: gespeicherter Entwurf mit dem Datum und der Nummer der Seite. Der Entwurf selbst ändert
// sich dadurch nicht. Fehlt oder ist fremd → „nicht gefunden“ (getInvoiceDraftView).
export async function loadIssueState(tenantId: string, id: string, input: { invoiceDate: string; number: string }) {
  const [view, settings, existing] = await Promise.all([getInvoiceDraftView(id), loadInvoiceSettings(tenantId), getNumberedInvoices(tenantId)])
  if (!settings) throw new IssueDataError('Rechnungseinstellungen nicht lesbar')
  const { draft, booking, others, preview, smallBusiness } = view
  const model = buildPreviewModel({
    kind: draft.kind,
    invoiceDate: input.invoiceDate,
    recipientKind: draft.recipientKind,
    recipient: draft.recipient,
    companySalutation: draft.companySalutation,
    guestNameMode: draft.guestNames,
    lines: draft.lines,
    deductionIds: draft.deductionIds,
    texts: { intro: draft.texts.intro.body, payment: draft.texts.payment.body, closing: draft.texts.closing.body },
    payment: draft.payment,
    booking,
    others,
    preview,
    smallBusiness,
    deductionRemoved: draft.deductionRemoved,
    invoiceNumber: input.number.trim(),
  })
  return { view, model, existing, numbering: settings.numbering as NumberingSettings }
}

// Stand der Buchung; vor dem Laden gelesen, damit eine Änderung danach beim Festschreiben auffällt
export async function getBookingUpdatedAt(tenantId: string, id: string): Promise<string | null> {
  const supabase = await createClient()
  const { data: invoice } = await supabase.from('invoices').select('booking_id').eq('id', id).eq('tenant_id', tenantId).maybeSingle()
  if (!invoice?.booking_id) return null
  const { data } = await supabase.from('bookings').select('updated_at').eq('id', invoice.booking_id).eq('tenant_id', tenantId).maybeSingle()
  return data?.updated_at ?? null
}

// Festgeschriebene Fassung aus dem Modell und den fertigen Texten des PDFs
export function issuedSnapshot(state: Awaited<ReturnType<typeof loadIssueState>>, view: PdfView): IssuedSnapshot {
  const m = state.model
  return {
    kind: m.kind,
    issuer: m.issuer,
    recipient: m.recipient,
    recipientKind: state.view.draft.recipientKind,
    period: { apartmentLabel: m.booking.apartmentLabel, arrival: m.booking.arrival, departure: m.booking.departure },
    guestNames: m.guestNames,
    partialLabel: m.partialLabel,
    lines: m.lines,
    deductions: m.deductions.map((d) => ({ number: d.number, origin: d.origin, invoiceDate: d.invoiceDate, totalCents: d.totalCents, vatShares: d.vatShares })),
    totals: { linesCents: m.totals.linesCents, totalCents: m.totals.totalCents, vatShares: m.totals.vatShares },
    smallBusiness: m.smallBusiness,
    schedule: m.schedule,
    texts: { intro: view.intro, smallBusinessNote: view.smallBusinessNote, payment: view.payment, closing: view.closing, footer: view.footer },
  }
}

// Prüfliste aus dem Stand und den Meldungen des tatsächlich erzeugten PDFs
export function checksFor(state: Awaited<ReturnType<typeof loadIssueState>>, model: InvoicePreviewModel, number: string, meta: PdfMeta): IssueChecks {
  const { view, existing, numbering } = state
  const { draft, booking, others, preview, smallBusiness, bookingChanged } = view
  return issueChecks({
    number,
    invoiceDate: model.invoiceDate,
    today: todayIso(),
    numbering,
    existing,
    required: requiredChecks({
      issuer: preview.issuer,
      smallBusiness,
      kind: draft.kind,
      invoiceDate: model.invoiceDate,
      booking,
      lineCount: draft.lines.length,
      partialCents: draft.kind === 'partial' ? model.totals.linesCents : 0,
      totalCents: model.totals.totalCents,
      recipient: draft.recipient,
    }),
    bookingChanged,
    bookingCancelled: booking.cancelledAt !== null,
    bookingIsOption: booking.kind === 'option',
    smallBusiness,
    deductions: model.deductions.map((d) => ({ id: d.id, origin: d.origin, number: d.number, smallBusiness: others.find((o) => o.id === d.id)?.smallBusiness })),
    missingDeductions: model.missingDeductions,
    billedCents: invoiceSums(others).billedCents,
    totalCents: model.totals.totalCents,
    billableCents: billableCents(booking.lines ?? []),
    pdf: meta,
  })
}

// ---- Gutschrift (PROJ-44) -----------------------------------------------------------------------

// Stand für Vorschau und Ausstellen einer Gutschrift: festgeschriebene Rechnung, aktueller Aussteller, Fußzeile und Briefpapier,
// Nummern samt Datum. null: Zu dieser Rechnung gibt es keine Gutschrift aus der App (Entwurf, nacherfasst, selbst eine Gutschrift).
// Storniert oder abgezogen sind Sperren der Prüfliste, damit Seite und Server dieselbe Meldung zeigen.
export async function loadCreditState(tenantId: string, invoiceId: string, input: { creditDate: string; number: string; reason: string }) {
  const [invoice, settings, existing, preview] = await Promise.all([getInvoice(invoiceId), loadInvoiceSettings(tenantId), getNumberedInvoices(tenantId), getDraftPreviewData()])
  if (!settings) throw new IssueDataError('Rechnungseinstellungen nicht lesbar')
  if (invoice.origin !== 'issued' || invoice.kind === 'credit_note' || !invoice.issued || invoice.issued.snapshot.credit) return null
  const credit: CreditInput = {
    invoice: { id: invoice.id, number: invoice.number, invoiceDate: invoice.invoiceDate, snapshot: invoice.issued.snapshot },
    creditDate: input.creditDate,
    reason: input.reason,
    issuer: preview.issuer,
    footer: preview.footer,
  }
  return { invoice, credit, model: creditPreviewModel(credit), letterhead: preview.letterhead, existing, numbering: settings.numbering as NumberingSettings }
}

// Prüfliste der Gutschrift aus dem Stand und den Meldungen des tatsächlich erzeugten PDFs
export function creditChecksFor(state: NonNullable<Awaited<ReturnType<typeof loadCreditState>>>, number: string, meta: PdfMeta): IssueChecks {
  return creditChecks({
    number,
    creditDate: state.credit.creditDate,
    today: todayIso(),
    invoiceDate: state.invoice.invoiceDate,
    reason: state.credit.reason,
    numbering: state.numbering,
    existing: state.existing,
    cancelledBy: state.invoice.cancelledBy,
    deductedBy: state.invoice.deductedBy,
    totalCents: state.model.totals.totalCents,
    pdf: meta,
  })
}
