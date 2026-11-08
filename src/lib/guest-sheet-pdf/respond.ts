import 'server-only'

import { getLocale, getTranslations } from 'next-intl/server'

import { GUEST_SHEET_BUCKET, type GuestSheetSnapshot, type SheetDeparture } from '@/lib/guest-sheet'
import { buildGuestSheetPdfView } from '@/lib/guest-sheet-pdf/view'
import { renderGuestSheetPdf } from '@/lib/invoice-pdf/render'
import { createAdminClient } from '@/lib/supabase/admin'

// Gästeblatt als PDF erzeugen (PROJ-26): beim Fertigstellen das Original, beim Ansehen mit eingesetzter Abreise.
export async function renderGuestSheet(p: { snapshot: GuestSheetSnapshot; departure: SheetDeparture; signatures: { first: string; second: string } }) {
  const [t, tg, tdt, locale] = await Promise.all([
    getTranslations('guestSheets.pdf'),
    getTranslations('guests.gender'),
    getTranslations('guests.documentType'),
    getLocale(),
  ])
  const view = buildGuestSheetPdfView({
    ...p,
    t: (key, values) => t(key as never, values as never),
    genderLabel: (g) => tg(g as never),
    documentTypeLabel: (d) => tdt(d as never),
    locale,
  })
  return renderGuestSheetPdf(view)
}

// Unterschrift aus dem Speicher als data:-Adresse für die Vorlage
export async function loadSignature(path: string): Promise<string | null> {
  const { data, error } = await createAdminClient().storage.from(GUEST_SHEET_BUCKET).download(path)
  if (error || !data) {
    console.error('[gaesteblatt] Unterschrift nicht lesbar', error?.message)
    return null
  }
  return `data:image/png;base64,${Buffer.from(await data.arrayBuffer()).toString('base64')}`
}

// PDF-Antwort; enthält Gästedaten: nie zwischenspeichern
export const pdfAnswer = (pdf: Uint8Array, fileName: string) =>
  new Response(Buffer.from(pdf), {
    headers: {
      'content-type': 'application/pdf',
      'cache-control': 'no-store',
      'content-disposition': `inline; filename="${fileName.replace(/[^\w.-]/g, '_')}"`,
    },
  })
