import 'server-only'

import { cache } from 'react'

import { todayIso } from '@/lib/bookings'
import { billableCents, invoiceSums, requiredChecks } from '@/lib/invoice-drafts'
import { getInvoiceDraftView } from '@/lib/invoice-drafts-data'
import { type IssueChecks, issueChecks, type NumberedInvoice } from '@/lib/invoice-issue'
import type { NumberingSettings } from '@/lib/invoice-numbering'
import type { PdfMeta } from '@/lib/invoice-pdf/types'
import { buildPreviewModel, type InvoicePreviewModel } from '@/lib/invoice-preview'
import { loadInvoiceSettings } from '@/lib/invoice-settings-data'
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
