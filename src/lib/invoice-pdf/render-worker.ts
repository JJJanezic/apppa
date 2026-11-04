import { join } from 'node:path'
import { parentPort, workerData } from 'node:worker_threads'

import { Document, Font, Page, renderToBuffer, View } from '@react-pdf/renderer'
import { createElement } from 'react'

import { FooterPdf, footerGap, InvoiceDocument, PAGE_HEIGHT_PT, pageBase } from '@/lib/invoice-pdf/document'
import type { PdfResult, PdfView } from '@/lib/invoice-pdf/types'
import { PAGE_LAYOUT as P } from '@/lib/letterhead'
import type { RichDoc, RichFont } from '@/lib/rich-text'

// PDF-Arbeitsprozess (PROJ-41): Jede Erzeugung läuft in einem eigenen, kurzlebigen Prozess. Wurde im selben Prozess zuvor
// ein anderes Dokument mit denselben Schriften erzeugt, fehlten im Vorab-Versuch Buchstaben. Darum auch hier zwei
// Durchgänge mit je frisch geladenen Schriften. Gebaut mit scripts/build-pdf-worker.mjs.

const FONT_FILES: Record<RichFont, string> = {
  arimo: 'Arimo',
  tinos: 'Tinos',
  carlito: 'Carlito',
  'source-sans': 'SourceSans3',
  'source-serif': 'SourceSerif4',
  'open-sans': 'OpenSans',
}

function usedFonts(view: PdfView): RichFont[] {
  const docs: (RichDoc | null)[] = [view.intro, view.smallBusinessNote, view.payment, view.closing, view.footer]
  const fonts = new Set<RichFont>([view.letterhead.fontFamily])
  for (const d of docs) if (d?.attrs?.fontFamily) fonts.add(d.attrs.fontFamily)
  return [...fonts]
}

// Schriften unter eigenem Namen je Durchgang: So teilen sich die Durchgänge keinen Schriftzustand
function registerFonts(view: PdfView, pass: string): (font: RichFont) => string {
  const dir = join(process.cwd(), 'src', 'lib', 'invoice-pdf', 'fonts')
  for (const font of usedFonts(view)) {
    const file = FONT_FILES[font]
    Font.register({
      family: `${pass}-${font}`,
      fonts: [
        { src: join(dir, `${file}-Regular.ttf`) },
        { src: join(dir, `${file}-Bold.ttf`), fontWeight: 700 },
        { src: join(dir, `${file}-Italic.ttf`), fontStyle: 'italic' },
        { src: join(dir, `${file}-BoldItalic.ttf`), fontWeight: 700, fontStyle: 'italic' },
      ],
    })
  }
  return (font) => `${pass}-${font}`
}

type LayoutNode = { box?: { height?: number }; props?: { id?: string }; children?: LayoutNode[] }

function findHeight(node: LayoutNode | undefined, id: string): number | null {
  if (!node) return null
  if (node.props?.id === id && node.box?.height !== undefined) return node.box.height
  for (const child of node.children ?? []) {
    const found = findHeight(child, id)
    if (found !== null) return found
  }
  return null
}

// Wiederholte Fußzeilen reservieren in React-PDF keinen Platz: erst messen, dann den Rand danach setzen
async function measureFooter(view: PdfView): Promise<number> {
  if (!view.footer) return 0
  const familyOf = registerFonts(view, 'measure')
  let height: number | null = null
  const doc = createElement(
    Document,
    { onRender: (r: { _INTERNAL__LAYOUT__DATA_?: LayoutNode }) => { height = findHeight(r._INTERNAL__LAYOUT__DATA_, 'footer') } } as never,
    createElement(
      Page,
      { size: 'A4', style: { ...pageBase(view, familyOf), paddingHorizontal: (P.marginXMm * 72) / 25.4 } },
      createElement(View, { id: 'footer', wrap: false } as never, createElement(FooterPdf, { doc: view.footer, gap: footerGap(view), familyOf }))
    )
  )
  await renderToBuffer(doc)
  // Fehlt die Messung (andere Bibliotheksversion), lieber abbrechen als Text überdecken
  if (height === null) throw new Error('Fußzeile nicht messbar')
  return height
}

async function render(view: PdfView): Promise<PdfResult> {
  Font.registerHyphenationCallback((word) => [word])
  const measured = await measureFooter(view)
  // Eine überlange Fußzeile darf den Inhalt nicht ganz verdrängen; die Einstellungen weisen darauf hin
  const footerHeightPt = Math.min(measured, PAGE_HEIGHT_PT * 0.6)
  let pages = 1
  const pdf = await renderToBuffer(
    createElement(InvoiceDocument, {
      view,
      familyOf: registerFonts(view, 'final'),
      footerHeightPt,
      onPages: (n: number) => {
        pages = n
      },
    }) as never
  )
  return { pdf: new Uint8Array(pdf), pages, footerShare: measured / PAGE_HEIGHT_PT }
}

render(workerData as PdfView).then(
  (result) => parentPort?.postMessage({ ok: true, result }),
  (e: unknown) => parentPort?.postMessage({ ok: false, message: e instanceof Error ? e.message : String(e) })
)
