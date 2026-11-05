import { Document, Image as PdfImage, Page, StyleSheet, Text, View } from '@react-pdf/renderer'

import type { PdfLine, PdfRow, PdfView } from '@/lib/invoice-pdf/types'
import { LINE_HEIGHT, PAGE_LAYOUT as P, PARAGRAPH_GAP_PT } from '@/lib/letterhead'
import type { RichAttrs, RichDoc, RichFont, RichInline, RichParagraph } from '@/lib/rich-text'

// PDF-Vorlage der Rechnung (PROJ-41). Läuft nur im Arbeitsprozess. Feste Reihenfolge wie PROJ-39 und PROJ-40; Maße aus
// PAGE_LAYOUT. Reichlich absolute Lagen, damit das Adressfeld unabhängig vom Kopf immer an derselben Stelle steht.

const mm = (v: number) => (v * 72) / 25.4
export const PAGE_HEIGHT_PT = 841.89
const HEAD_GAP_PT = 12
const CENTER_GAP_PT = 3

const s = StyleSheet.create({
  rowLine: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 2.5, borderBottomWidth: 0.5, borderBottomColor: '#999999' },
  rowLabel: { flexGrow: 1, flexShrink: 1 },
  rowAmount: { flexShrink: 0 },
  mark: { position: 'absolute', top: mm(120), left: 0, right: 0, textAlign: 'center', fontSize: 84, color: '#e3e3e3', transform: 'rotate(-30deg)' },
})

type FamilyOf = (font: RichFont) => string

function inlineStyle(node: Extract<RichInline, { type: 'text' }>) {
  const marks = node.marks ?? []
  return {
    fontWeight: marks.some((m) => m.type === 'bold') ? 700 : 400,
    fontStyle: marks.some((m) => m.type === 'italic') ? ('italic' as const) : ('normal' as const),
  }
}

function Inline({ nodes }: { nodes: RichInline[] }) {
  return (
    <>
      {nodes.map((n, i) =>
        n.type === 'hardBreak' ? (
          <Text key={i}>{'\n'}</Text>
        ) : (
          <Text key={i} style={inlineStyle(n)}>
            {n.text}
          </Text>
        )
      )}
    </>
  )
}

// baseSize: Schriftgröße, die der Text sonst erbt (Grundgröße des Briefpapiers)
function textStyle(attrs: RichAttrs | undefined, familyOf: FamilyOf, baseSize: number) {
  return {
    ...(attrs?.fontFamily ? { fontFamily: familyOf(attrs.fontFamily) } : {}),
    ...(attrs?.fontSize ? { fontSize: attrs.fontSize } : {}),
    ...(attrs?.textAlign ? { textAlign: attrs.textAlign } : {}),
    // Faktor der Schriftgröße. React-PDF multipliziert jede Zahl bei lineHeight mit der Schriftgröße desselben Stils,
    // ohne Angabe dort mit seinen 18 pt statt der geerbten Größe; darum steht die Größe ausdrücklich dabei. Ohne
    // Zeilenhöhe gilt die des Briefpapiers von der Seite.
    ...(attrs?.lineHeight ? { fontSize: attrs.fontSize ?? baseSize, lineHeight: attrs.lineHeight } : {}),
  }
}

const paragraphText = (p: RichParagraph) => <Inline nodes={p.content?.length ? p.content : [{ type: 'text', text: ' ' }]} />

export function RichDocPdf({ doc, gap, familyOf, baseSize }: { doc: RichDoc; gap: number; familyOf: FamilyOf; baseSize: number }) {
  const style = textStyle(doc.attrs, familyOf, baseSize)
  return (
    <View style={{ gap }}>
      {doc.content.map((block, i) => {
        if (block.type === 'paragraph') {
          return (
            <Text key={i} style={style}>
              {paragraphText(block)}
            </Text>
          )
        }
        return (
          <View key={i} style={{ gap: gap / 2 }}>
            {block.content.map((item, j) => (
              <View key={j} style={{ flexDirection: 'row', gap: 6 }} wrap={false}>
                <Text style={{ ...style, textAlign: 'left', width: 14 }}>{block.type === 'bulletList' ? '•' : `${j + 1}.`}</Text>
                <View style={{ flex: 1, gap: gap / 2 }}>
                  {item.content.map((p, k) => (
                    <Text key={k} style={{ ...style, textAlign: 'left' }}>
                      {paragraphText(p)}
                    </Text>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )
      })}
    </View>
  )
}

export const Lines = ({ lines, size, align, width, maxWidth }: { lines: PdfLine[]; size: number; align?: 'center' | 'left'; width?: number; maxWidth?: number }) => (
  <View style={{ fontSize: size, lineHeight: 1.2, textAlign: align, width, maxWidth }}>
    {lines.map((l, i) => (
      <Text key={i} style={l.bold ? { fontWeight: 700 } : undefined}>
        {l.text}
      </Text>
    ))}
  </View>
)

// Breite des Aussteller-Blocks: Ohne Grenze bricht React-PDF lange Zeilen nicht um, sondern schneidet sie ab (QA BUG-2)
export function issuerWidthPt(view: PdfView): number {
  if (view.letterhead.logoPosition === 'center' || !view.logo) return mm(P.textWidthMm)
  return mm(P.textWidthMm - view.logo.widthMm) - HEAD_GAP_PT
}

// Platz für den Aussteller-Block im Kopf; unter einem mittigen Logo nur, was das Logo übrig lässt
export function issuerMaxHeightPt(view: PdfView): number {
  const logo = view.letterhead.logoPosition === 'center' && view.logo ? mm(view.logo.heightMm) + CENTER_GAP_PT : 0
  return mm(P.headHeightMm) - logo
}

function Head({ view, issuerSize }: { view: PdfView; issuerSize: number }) {
  const v = view.letterhead
  const logo = view.logo && <PdfImage src={{ data: Buffer.from(view.logo.data), format: 'png' }} style={{ width: mm(view.logo.widthMm), height: mm(view.logo.heightMm) }} />
  const box = { position: 'absolute' as const, top: mm(P.headTopMm), left: mm(P.marginXMm), right: mm(P.marginXMm), height: mm(P.headHeightMm), overflow: 'hidden' as const }
  const width = issuerWidthPt(view)
  if (v.logoPosition === 'center') {
    return (
      <View style={{ ...box, alignItems: 'center', gap: CENTER_GAP_PT }}>
        {logo}
        {view.issuer && <Lines lines={view.issuer} size={issuerSize} align="center" width={width} />}
      </View>
    )
  }
  const issuer = view.issuer ? <Lines lines={view.issuer} size={issuerSize} maxWidth={width} /> : <View />
  return (
    <View style={{ ...box, flexDirection: 'row', justifyContent: 'space-between', gap: HEAD_GAP_PT }}>
      {v.logoPosition === 'left' ? logo || <View /> : issuer}
      {v.logoPosition === 'left' ? issuer : logo || <View />}
    </View>
  )
}

function Row({ row }: { row: PdfRow }) {
  return (
    <View wrap={false} style={s.rowLine}>
      <View style={{ ...s.rowLabel, paddingLeft: row.indent ? 12 : 0 }}>
        <Text style={row.bold ? { fontWeight: 700 } : undefined}>{row.label}</Text>
        {row.note && <Text style={{ fontSize: 8.5 }}>{row.note}</Text>}
      </View>
      {row.amount ? <Text style={{ ...s.rowAmount, ...(row.bold ? { fontWeight: 700 } : {}) }}>{row.amount}</Text> : null}
    </View>
  )
}

export function FooterPdf({ doc, gap, familyOf, baseSize }: { doc: RichDoc; gap: number; familyOf: FamilyOf; baseSize: number }) {
  return (
    <View style={{ borderTopWidth: 0.5, borderTopColor: '#999999', paddingTop: 4 }}>
      <RichDocPdf doc={doc} gap={gap} familyOf={familyOf} baseSize={baseSize} />
    </View>
  )
}

export function pageBase(view: PdfView, familyOf: FamilyOf) {
  const v = view.letterhead
  return { fontFamily: familyOf(v.fontFamily), fontSize: v.fontSize, lineHeight: LINE_HEIGHT[v.lineSpacing], color: '#000000' }
}

export function footerGap(view: PdfView) {
  return Math.min(PARAGRAPH_GAP_PT[view.letterhead.paragraphSpacing], 4)
}

export function InvoiceDocument({
  view,
  familyOf,
  footerHeightPt,
  issuerSize,
  onPages,
}: {
  view: PdfView
  familyOf: FamilyOf
  footerHeightPt: number
  issuerSize: number
  onPages: (pages: number) => void
}) {
  const v = view.letterhead
  const gap = PARAGRAPH_GAP_PT[v.paragraphSpacing]
  const section = gap * 2
  const pageLinePt = 12
  const page = pageBase(view, familyOf)
  const texts = [view.intro]
  const rows = view.services.rows
  const lastRow = rows.at(-1)
  return (
    <Document title={view.title}>
      <Page
        size="A4"
        style={{
          ...page,
          paddingTop: mm(P.pageTopMm),
          paddingHorizontal: mm(P.marginXMm),
          paddingBottom: mm(P.footerBottomMm) + footerHeightPt + pageLinePt + 8,
        }}
      >
        {view.mark && (
          <Text fixed style={s.mark}>
            {view.mark}
          </Text>
        )}

        {/* Rechnungsnummer ab Seite 2 */}
        <Text
          fixed
          style={{ position: 'absolute', top: mm(P.headTopMm), left: mm(P.marginXMm), right: mm(P.marginXMm), fontSize: Math.min(v.fontSize, P.issuerMaxPt), textAlign: 'right' }}
          render={({ pageNumber }) => (pageNumber > 1 ? view.numberLine : ' ')}
        />

        <Head view={view} issuerSize={issuerSize} />

        {/* Bis zum Adressfeld; es steht damit immer an derselben Stelle */}
        <View style={{ height: mm(P.addressTopMm - P.pageTopMm) }} />
        <View style={{ height: mm(P.addressHeightMm), width: mm(P.addressWidthMm) }}>
          <Lines lines={view.recipient} size={Math.min(v.fontSize, P.addressMaxPt)} />
        </View>

        {view.placeDate ? <Text style={{ textAlign: 'right', marginBottom: section }}>{view.placeDate}</Text> : null}

        <View style={{ marginBottom: section, gap: 2 }}>
          <Text style={{ fontSize: v.fontSize * 1.6, fontWeight: 700, marginBottom: 4 }}>{view.heading}</Text>
          <Text>{view.numberLine}</Text>
          <Text>{view.periodLine}</Text>
          {view.guestsLine && <Text>{view.guestsLine}</Text>}
        </View>

        {texts.map(
          (doc, i) =>
            doc && (
              <View key={i} style={{ marginBottom: section }}>
                <RichDocPdf doc={doc} gap={gap} familyOf={familyOf} baseSize={v.fontSize} />
              </View>
            )
        )}

        {/* Block 5: Die Gesamtsumme bleibt mit der letzten Zeile zusammen */}
        <View style={{ marginBottom: section }}>
          {rows.slice(0, -1).map((r, i) => (
            <Row key={i} row={r} />
          ))}
          <View wrap={false}>
            {lastRow && <Row row={lastRow} />}
            {view.services.totals.map((r, i) => (
              <Row key={i} row={r} />
            ))}
            {view.services.note && <Text style={{ marginTop: 3 }}>{view.services.note}</Text>}
          </View>
          {view.services.vatTitle && (
            <View wrap={false} style={{ marginTop: gap, fontSize: Math.max(v.fontSize - 1, 8) }}>
              <Text style={{ fontWeight: 700 }}>{view.services.vatTitle}</Text>
              {view.services.vatRows.map((r, i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text>{r.label}</Text>
                  <Text>{r.amount}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {[view.smallBusinessNote, view.payment, view.closing].map(
          (doc, i) =>
            doc && (
              <View key={i} style={{ marginBottom: section }}>
                <RichDocPdf doc={doc} gap={gap} familyOf={familyOf} baseSize={v.fontSize} />
              </View>
            )
        )}

        {view.footer && (
          <View fixed style={{ position: 'absolute', left: mm(P.marginXMm), right: mm(P.marginXMm), bottom: mm(P.footerBottomMm) + pageLinePt, maxHeight: footerHeightPt, overflow: 'hidden' }}>
            <FooterPdf doc={view.footer} gap={footerGap(view)} familyOf={familyOf} baseSize={v.fontSize} />
          </View>
        )}
        <Text
          fixed
          // Mit „bottom“ setzt React-PDF Text mit render gar nicht (Version 4.9.0), mit „top“ schon
          style={{ position: 'absolute', left: mm(P.marginXMm), right: mm(P.marginXMm), top: PAGE_HEIGHT_PT - mm(P.footerBottomMm) - pageLinePt, fontSize: 8, textAlign: 'right' }}
          render={({ pageNumber, totalPages }) => {
            if (totalPages) onPages(totalPages)
            return totalPages === 1 ? ' ' : view.pageOf.replace('{page}', String(pageNumber)).replace('{pages}', String(totalPages))
          }}
        />
      </Page>
    </Document>
  )
}
