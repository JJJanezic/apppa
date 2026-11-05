import 'server-only'

import { getLocale, getTranslations } from 'next-intl/server'

import type { InvoicePreviewModel } from '@/lib/invoice-preview'
import { renderInvoicePdf } from '@/lib/invoice-pdf/render'
import { PDF_META_HEADER, type PdfMeta, type PdfView } from '@/lib/invoice-pdf/types'
import { buildPdfView } from '@/lib/invoice-pdf/view'
import type { LetterheadValues } from '@/lib/letterhead'
import { loadPdfLogo } from '@/lib/letterhead-data'

type PdfRequest = {
  tenantId: string
  model: InvoicePreviewModel
  letterhead: LetterheadValues
  number: string
  // Aufdruck „Entwurf“; null nur bei der ausgestellten Rechnung (PROJ-42)
  mark: string | null
}

// Erzeugt die Rechnung als PDF samt Meldungen; wirft, wenn die Erzeugung scheitert
export async function renderInvoice(p: PdfRequest): Promise<{ pdf: Uint8Array; meta: PdfMeta; view: PdfView }> {
  const [tp, tl, locale, { logo, failed }] = await Promise.all([
    getTranslations('invoiceDrafts.preview'),
    getTranslations('letterhead.pdf'),
    getLocale(),
    loadPdfLogo(p.tenantId),
  ])
  const { view, logo: box } = buildPdfView({
    model: p.model,
    letterhead: p.letterhead,
    number: p.number,
    mark: p.mark,
    logo,
    t: (key, values) => tp(key as never, values as never),
    // Platzhalter füllt erst die Vorlage: Die Seitenzahl steht vorher nicht fest
    pageOf: tl.raw('pageOf') as string,
    locale,
  })
  const result = await renderInvoicePdf(view)
  return {
    pdf: result.pdf,
    view,
    meta: {
      pages: result.pages,
      footerShare: result.footerShare,
      logoReduced: box?.reduced ?? false,
      logoBlurry: box?.blurry ?? false,
      logoFailed: failed,
      footerReduced: result.footerReduced,
      footerCut: result.footerCut,
      issuerOverflow: result.issuerOverflow,
      missingChars: result.missingChars,
    },
  }
}

// Rechnung als PDF-Antwort. Enthält Gästedaten: nie zwischenspeichern. extend ergänzt die Meldungen (Prüfliste, PROJ-42).
export async function pdfResponse(p: PdfRequest, extend?: (meta: PdfMeta) => PdfMeta): Promise<Response> {
  try {
    const { pdf, meta } = await renderInvoice(p)
    const full = extend ? extend(meta) : meta
    return new Response(Buffer.from(pdf), {
      headers: { 'content-type': 'application/pdf', 'cache-control': 'no-store', [PDF_META_HEADER]: encodeURIComponent(JSON.stringify(full)) },
    })
  } catch (e) {
    console.error('[rechnung-pdf] Erzeugung fehlgeschlagen', e instanceof Error ? e.message : e)
    return new Response(null, { status: 500, headers: { 'cache-control': 'no-store' } })
  }
}
