import { join } from 'node:path'
import { parentPort, workerData } from 'node:worker_threads'

import { Document, Font, Page, renderToBuffer, View } from '@react-pdf/renderer'
import { createElement } from 'react'

import { FooterPdf, footerGap, InvoiceDocument, issuerMaxHeightPt, issuerWidthPt, Lines, PAGE_HEIGHT_PT, pageBase } from '@/lib/invoice-pdf/document'
import type { PdfResult, PdfView } from '@/lib/invoice-pdf/types'
import { TaxReportDocument } from '@/lib/tourist-tax-pdf/document'
import { TAX_REPORT_PDF_KIND, type TaxPdfResult, type TaxPdfView } from '@/lib/tourist-tax-pdf/types'
import { PAGE_LAYOUT as P } from '@/lib/letterhead'
import type { RichDoc, RichFont } from '@/lib/rich-text'

// PDF-Arbeitsprozess (PROJ-41): Jede Erzeugung läuft in einem eigenen, kurzlebigen Prozess. Wurde im selben Prozess zuvor
// ein anderes Dokument mit denselben Schriften erzeugt, fehlten im Vorab-Versuch Buchstaben. Darum auch hier zwei
// Durchgänge mit je frisch geladenen Schriften. Gebaut mit scripts/build-pdf-worker.mjs.

// Ab dieser Länge passt ein Wort bei üblichen Größen kaum noch sicher in eine Spalte
const LONG_WORD = 30

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
  return registerFontFiles(usedFonts(view), pass)
}

function registerFontFiles(fonts: RichFont[], pass: string): (font: RichFont) => string {
  const dir = join(process.cwd(), 'src', 'lib', 'invoice-pdf', 'fonts')
  for (const font of fonts) {
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

// Größen, in denen der Aussteller-Block und eine zu lange Fußzeile versucht werden (größte zuerst)
const SMALLEST_PT = 6
// Darüber bleibt auf Seite 1 neben Kopf und Adressfeld kaum Platz für den Inhalt
const FOOTER_MAX_SHARE = 0.4

function sizesFrom(start: number, min: number): number[] {
  const sizes = [start]
  for (let s = Math.floor(start) - 1; s >= min; s--) sizes.push(s)
  return sizes
}

const withFontSize = (doc: RichDoc, fontSize: number): RichDoc => ({ ...doc, attrs: { ...doc.attrs, fontSize } })

type Measured = { footer: RichDoc | null; footerHeightPt: number; footerReduced: boolean; footerCut: boolean; issuerSize: number; issuerOverflow: boolean; missingChars: string[] }

function textsByFont(view: PdfView): Map<RichFont, string> {
  const base = view.letterhead.fontFamily
  const out = new Map<RichFont, string>()
  const add = (font: RichFont, text: string) => out.set(font, (out.get(font) ?? '') + text)
  const s = view.services
  add(base, [view.mark, view.heading, view.numberLine, view.periodLine, view.guestsLine, view.placeDate, ...(view.issuer ?? []).map((l) => l.text), ...view.recipient.map((l) => l.text), ...[...s.rows, ...s.totals].flatMap((r) => [r.label, r.amount, r.note]), s.note, s.vatTitle].filter(Boolean).join(''))
  for (const doc of [view.intro, view.smallBusinessNote, view.payment, view.closing, view.footer]) {
    if (!doc) continue
    const font = doc.attrs?.fontFamily ?? base
    for (const block of doc.content) {
      const paragraphs = block.type === 'paragraph' ? [block] : block.content.flatMap((item) => item.content)
      for (const p of paragraphs) for (const n of p.content ?? []) if (n.type === 'text') add(font, n.text)
    }
  }
  return out
}

// Zeichen ohne Entsprechung in der Schrift (QA BUG-6); die Einstellungen und der Entwurf weisen darauf hin
function findMissingChars(view: PdfView, familyOf: (font: RichFont) => string): string[] {
  const missing = new Set<string>()
  for (const [font, text] of textsByFont(view)) {
    const face = Font.getFont({ fontFamily: familyOf(font), fontWeight: 400, fontStyle: 'normal' }) as unknown as { data?: { hasGlyphForCodePoint?: (c: number) => boolean } } | undefined
    const has = face?.data?.hasGlyphForCodePoint?.bind(face.data)
    if (!has) continue
    for (const ch of text) {
      if (ch.trim() && !has(ch.codePointAt(0) as number)) missing.add(ch)
    }
  }
  return [...missing].slice(0, 10)
}

// Wiederholte Fußzeilen reservieren in React-PDF keinen Platz, und die Höhe des Aussteller-Blocks hängt vom Umbruch ab:
// erst messen, dann setzen. Fehlt eine Messung (andere Bibliotheksversion), lieber abbrechen als Text überdecken.
async function measure(view: PdfView): Promise<Measured> {
  const familyOf = registerFonts(view, 'measure')
  const issuerStart = Math.min(view.letterhead.fontSize, P.issuerMaxPt)
  const issuerSizes = view.issuer ? sizesFrom(issuerStart, SMALLEST_PT) : []
  const footer = view.footer
  const footerStart = footer ? (footer.attrs?.fontSize ?? view.letterhead.fontSize) : 0
  const footerSizes = footer ? sizesFrom(footerStart, SMALLEST_PT) : []
  let layout: LayoutNode | undefined
  const width = (P.textWidthMm * 72) / 25.4
  await renderToBuffer(
    createElement(
      Document,
      { onRender: (r: { _INTERNAL__LAYOUT__DATA_?: LayoutNode }) => { layout = r._INTERNAL__LAYOUT__DATA_ } } as never,
      createElement(
        Page,
        { size: 'A4', style: { ...pageBase(view, familyOf), paddingHorizontal: (P.marginXMm * 72) / 25.4 } },
        ...issuerSizes.map((size) => createElement(View, { key: `i${size}`, id: `issuer-${size}`, wrap: false, style: { width: issuerWidthPt(view) } } as never, createElement(Lines, { lines: view.issuer ?? [], size, width: issuerWidthPt(view) }))),
        ...footerSizes.map((size) =>
          createElement(View, { key: `f${size}`, id: `footer-${size}`, wrap: false, style: { width } } as never, createElement(FooterPdf, { doc: size === footerStart ? (footer as RichDoc) : withFontSize(footer as RichDoc, size), gap: footerGap(view), familyOf, baseSize: view.letterhead.fontSize }))
        )
      )
    )
  )
  const height = (id: string): number => {
    const h = findHeight(layout, id)
    if (h === null) throw new Error('Nicht messbar')
    return h
  }

  const maxIssuer = issuerMaxHeightPt(view)
  const issuerSize = issuerSizes.find((size) => height(`issuer-${size}`) <= maxIssuer) ?? issuerSizes.at(-1) ?? issuerStart
  const issuerOverflow = issuerSizes.length > 0 && height(`issuer-${issuerSize}`) > maxIssuer

  const maxFooter = PAGE_HEIGHT_PT * FOOTER_MAX_SHARE
  const footerSize = footerSizes.find((size) => height(`footer-${size}`) <= maxFooter) ?? footerSizes.at(-1)
  const footerReduced = footer !== null && footerSize !== footerStart
  return {
    footer: footer && footerSize !== undefined && footerReduced ? withFontSize(footer, footerSize) : footer,
    footerHeightPt: footerSize !== undefined ? Math.min(height(`footer-${footerSize}`), maxFooter) : 0,
    footerReduced: footerReduced || (footerSize !== undefined && height(`footer-${footerSize}`) > maxFooter),
    footerCut: footerSize !== undefined && height(`footer-${footerSize}`) > maxFooter,
    issuerSize,
    issuerOverflow,
    missingChars: findMissingChars(view, familyOf),
  }
}

// Unsichtbare Steuerzeichen aus eingefügten Texten (weiches Trennzeichen, Nullbreite) fallen weg: Die Schriften kennen sie
// teils nicht, und ein Hinweis auf ein unsichtbares Zeichen hilft niemandem (QA BUG-7)
function withoutInvisible<T>(value: T): T {
  if (typeof value === 'string') return value.replace(/\p{Cf}/gu, '') as T
  if (Array.isArray(value)) return value.map(withoutInvisible) as T
  if (value && typeof value === 'object' && !ArrayBuffer.isView(value)) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, withoutInvisible(v)])) as T
  }
  return value
}

async function render(input: PdfView): Promise<PdfResult> {
  const view = withoutInvisible(input)
  // Keine Silbentrennung. Nur sehr lange Wörter dürfen an jeder Stelle umbrechen, React-PDF setzt dort einen Trennstrich
  Font.registerHyphenationCallback((word) => (word.length > LONG_WORD ? Array.from(word) : [word]))
  const m = await measure(view)
  let pages = 1
  const pdf = await renderToBuffer(
    createElement(InvoiceDocument, {
      view: { ...view, footer: m.footer },
      familyOf: registerFonts(view, 'final'),
      footerHeightPt: m.footerHeightPt,
      issuerSize: m.issuerSize,
      onPages: (n: number) => {
        pages = n
      },
    }) as never
  )
  return {
    pdf: new Uint8Array(pdf),
    pages,
    footerShare: m.footerHeightPt / PAGE_HEIGHT_PT,
    footerReduced: m.footerReduced,
    footerCut: m.footerCut,
    issuerOverflow: m.issuerOverflow,
    missingChars: m.missingChars,
  }
}

// Ortstaxen-Bericht (PROJ-16): nur die Grundschrift des Briefpapiers, keine Fußzeile und kein Aussteller zu vermessen
async function renderTaxReport(input: TaxPdfView): Promise<TaxPdfResult> {
  const view = withoutInvisible(input)
  Font.registerHyphenationCallback((word) => (word.length > LONG_WORD ? Array.from(word) : [word]))
  let pages = 1
  const pdf = await renderToBuffer(
    createElement(TaxReportDocument, {
      view,
      familyOf: registerFontFiles([view.letterhead.fontFamily], 'report'),
      onPages: (n: number) => {
        pages = n
      },
    }) as never
  )
  return { pdf: new Uint8Array(pdf), pages }
}

const job = workerData as PdfView | TaxPdfView
const run: Promise<PdfResult | TaxPdfResult> = 'kind' in job && job.kind === TAX_REPORT_PDF_KIND ? renderTaxReport(job) : render(job as PdfView)
run.then(
  (result) => parentPort?.postMessage({ ok: true, result }),
  (e: unknown) => parentPort?.postMessage({ ok: false, message: e instanceof Error ? e.message : String(e) })
)
