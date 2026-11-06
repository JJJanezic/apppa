// Von den Inhalten der Rechnung (Regel aus PROJ-40) zu den fertigen Daten der PDF-Vorlage (PROJ-41). Reine Regel.

import { formatCents } from '@/lib/format'
import { countryName } from '@/lib/guests'
import type { InvoicePreviewModel, PreviewDeduction } from '@/lib/invoice-preview'
import { fillPlaceholders, type PlaceholderValues, textDate } from '@/lib/invoice-texts'
import type { PdfLine, PdfRow, PdfView } from '@/lib/invoice-pdf/types'
import { type LetterheadValues, logoBox, type LogoBox } from '@/lib/letterhead'
import { isDocEmpty, type RichBlock, type RichDoc, type RichInline } from '@/lib/rich-text'
import { formatVatRate } from '@/lib/vat'

type T = (key: string, values?: Record<string, string | number>) => string

// Mehr aufeinanderfolgende Leerzeilen setzt die Vorlage nicht: Sie würden nur Seiten füllen und die Erzeugung bremsen
const MAX_EMPTY_PARAGRAPHS = 3

function fillInline(node: RichInline, values?: PlaceholderValues): RichInline {
  return node.type === 'text' && values ? { ...node, text: fillPlaceholders(node.text, values) } : node
}

// Platzhalter ersetzt, leere Texte fallen weg
export function pdfDoc(doc: RichDoc | null | undefined, values?: PlaceholderValues): RichDoc | null {
  if (!doc || isDocEmpty(doc)) return null
  let empties = 0
  const content: RichBlock[] = []
  for (const block of doc.content) {
    if (block.type === 'paragraph') {
      empties = block.content?.length ? 0 : empties + 1
      if (empties > MAX_EMPTY_PARAGRAPHS) continue
      content.push(block.content ? { ...block, content: block.content.map((n) => fillInline(n, values)) } : block)
    } else {
      empties = 0
      content.push({
        ...block,
        content: block.content.map((item) => ({
          ...item,
          content: item.content.map((p) => (p.content ? { ...p, content: p.content.map((n) => fillInline(n, values)) } : p)),
        })),
      })
    }
  }
  return { ...doc, content }
}

const place = (postalCode: string | null | undefined, city: string | null | undefined) => [postalCode, city].filter(Boolean).join(' ')

function issuerLines(m: InvoicePreviewModel, v: LetterheadValues, t: T, locale: string): PdfLine[] | null {
  if (!v.showIssuer) return null
  const i = m.issuer
  if (!i) return [{ text: t('issuerMissing') }]
  const rest = [
    i.nameLine2,
    i.addressLine1,
    i.addressLine2,
    place(i.postalCode, i.city),
    i.country ? countryName(i.country, locale) : null,
    i.vatId ? t('vatId', { id: i.vatId }) : null,
  ].filter((x): x is string => Boolean(x))
  // Unter einem mittigen Logo zweizeilig: Mehr hat im Kopf keinen Platz
  if (v.logoPosition === 'center') return [{ text: i.name, bold: true }, ...(rest.length ? [{ text: rest.join(' · ') }] : [])]
  return [{ text: i.name, bold: true }, ...rest.map((text) => ({ text }))]
}

function recipientLines(m: InvoicePreviewModel, t: T, locale: string): PdfLine[] {
  const r = m.recipient
  const lines: PdfLine[] = r.name ? [{ text: r.name, bold: true }] : [{ text: t('recipientMissing') }]
  for (const text of [r.line1, r.line2, place(r.postalCode, r.city), r.country ? countryName(r.country, locale) : null, r.vatId ? t('vatId', { id: r.vatId }) : null]) {
    if (text) lines.push({ text })
  }
  return lines
}

function deductionRow(d: PreviewDeduction, t: T): PdfRow {
  const what = d.origin === 'backfilled' ? 'invoice' : d.kind === 'partial' ? 'partial' : 'invoice'
  const label = t(d.number ? `deduction.${what}` : `deduction.${what}Draft`, { number: d.number ?? '', date: textDate(d.invoiceDate) })
  const note = d.vatShares.map((s) => `${t('deductionVat', { rate: formatVatRate(s.vatBp) })} ${formatCents(-s.vatCents)}`).join(' · ')
  return { label, amount: formatCents(-d.totalCents), note: note || undefined }
}

function serviceRows(m: InvoicePreviewModel, t: T): { rows: PdfRow[]; totals: PdfRow[] } {
  const rate = (bp: number) => (m.smallBusiness ? null : formatVatRate(bp))
  const rows: PdfRow[] = []
  if (m.partialLabel) {
    rows.push({ label: m.partialLabel, amount: '' })
    for (const l of m.lines) {
      const r = rate(l.vatBp)
      rows.push({ label: r ? t('partialShare', { rate: r }) : t('partialAmount'), amount: formatCents(l.amountCents), indent: true })
    }
  } else if (m.lines.length) {
    for (const l of m.lines) {
      const r = rate(l.vatBp)
      rows.push({ label: r ? t('lineVat', { label: l.label, rate: r }) : l.label, amount: formatCents(l.amountCents) })
    }
  } else {
    rows.push({ label: t('noLines'), amount: '' })
  }
  // „(inkl. USt.)“ an den Summen nur, wenn USt enthalten ist: nicht bei Kleinunternehmern und nicht, wenn keine
  // Position mehr als 0 % hat (PROJ-40, refine 2026-11-06)
  const withVat = !m.smallBusiness && m.lines.some((l) => l.vatBp > 0)
  const totals: PdfRow[] = []
  if (m.deductions.length) {
    totals.push({ label: t(withVat ? 'subtotalVat' : 'subtotal'), amount: formatCents(m.totals.linesCents), bold: true })
    totals.push(...m.deductions.map((d) => deductionRow(d, t)))
  }
  // Gutschrift (PROJ-44): „Gutschriftsbetrag“ nach derselben Regel
  const total = m.credit ? (withVat ? 'credit.totalVat' : 'credit.total') : withVat ? 'totalVat' : 'total'
  totals.push({ label: t(total), amount: formatCents(m.totals.totalCents), bold: true })
  return { rows, totals }
}

export type PdfViewInput = {
  model: InvoicePreviewModel
  letterhead: LetterheadValues
  number: string
  mark: string | null
  logo: { data: Uint8Array; widthPx: number; heightPx: number } | null
  // Übersetzungen des Bereichs „invoiceDrafts.preview“
  t: T
  pageOf: string
  locale: string
}

export function buildPdfView(p: PdfViewInput): { view: PdfView; logo: LogoBox | null } {
  const { model: m, letterhead: v, t, locale } = p
  const box = p.logo ? logoBox({ widthPx: p.logo.widthPx, heightPx: p.logo.heightPx }, v) : null
  const { rows, totals } = serviceRows(m, t)
  const c = m.credit
  const heading = c ? t('credit.title') : t(`title.${m.kind}`)
  const period = { apartment: m.booking.apartmentLabel, arrival: textDate(m.booking.arrival), departure: textDate(m.booking.departure) }
  return {
    logo: box,
    view: {
      title: `${heading} ${p.number}`,
      letterhead: v,
      mark: p.mark,
      logo: p.logo && box ? { data: p.logo.data, widthMm: box.widthMm, heightMm: box.heightMm } : null,
      issuer: issuerLines(m, v, t, locale),
      recipient: recipientLines(m, t, locale),
      placeDate: [m.issuer?.city, m.invoiceDate ? textDate(m.invoiceDate) : null].filter(Boolean).join(', '),
      heading,
      numberLine: c ? t('credit.number', { number: p.number }) : t('number', { number: p.number }),
      references: c ? [t('credit.reference', { number: c.invoiceNumber, date: textDate(c.invoiceDate) }), ...(c.reason ? [t('credit.reason', { reason: c.reason })] : [])] : undefined,
      periodLine: c ? t('credit.period', period) : t('period', period),
      guestsLine: m.guestNames.length ? t('guests', { names: m.guestNames.join(', ') }) : null,
      intro: pdfDoc(m.texts.intro, m.values),
      services: {
        rows,
        totals,
        note: m.missingDeductions > 0 ? t('deductionMissing') : null,
        vatTitle: m.totals.vatShares.length ? t('vatIncluded') : null,
        // links „10 % aus € 409,09“: Nettobetrag je Satz = Brutto minus enthaltene USt (bei Schlussrechnungen nach Abzug)
        vatRows: m.totals.vatShares.map((s) => ({
          label: t('vatBase', { rate: formatVatRate(s.vatBp), net: formatCents(s.grossCents - s.vatCents) }),
          amount: formatCents(s.vatCents),
        })),
      },
      smallBusinessNote: m.smallBusiness ? pdfDoc(m.smallBusinessNote) : null,
      payment: pdfDoc(m.texts.payment, m.values),
      closing: pdfDoc(m.texts.closing, m.values),
      footer: pdfDoc(m.footer),
      pageOf: p.pageOf,
    },
  }
}
