import 'server-only'

import { getLocale, getTranslations } from 'next-intl/server'

import type { InvoicePreviewModel } from '@/lib/invoice-preview'
import { renderInvoicePdf } from '@/lib/invoice-pdf/render'
import { PDF_META_HEADER, type PdfMeta } from '@/lib/invoice-pdf/types'
import { buildPdfView } from '@/lib/invoice-pdf/view'
import type { LetterheadValues } from '@/lib/letterhead'
import { loadPdfLogo } from '@/lib/letterhead-data'

// Rechnung als PDF-Antwort. Enthält Gästedaten: nie zwischenspeichern.
export async function pdfResponse(p: {
  tenantId: string
  model: InvoicePreviewModel
  letterhead: LetterheadValues
  number: string
  mark: string
}): Promise<Response> {
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
  try {
    const result = await renderInvoicePdf(view)
    const meta: PdfMeta = {
      pages: result.pages,
      footerShare: result.footerShare,
      logoReduced: box?.reduced ?? false,
      logoBlurry: box?.blurry ?? false,
      logoFailed: failed,
      footerReduced: result.footerReduced,
      issuerOverflow: result.issuerOverflow,
      missingChars: result.missingChars,
    }
    return new Response(Buffer.from(result.pdf), {
      headers: { 'content-type': 'application/pdf', 'cache-control': 'no-store', [PDF_META_HEADER]: encodeURIComponent(JSON.stringify(meta)) },
    })
  } catch (e) {
    console.error('[rechnung-pdf] Erzeugung fehlgeschlagen', e instanceof Error ? e.message : e)
    return new Response(null, { status: 500, headers: { 'cache-control': 'no-store' } })
  }
}
