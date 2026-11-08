import { Document, Page, Text, View } from '@react-pdf/renderer'

import { Head, pageBase } from '@/lib/invoice-pdf/document'
import { PAGE_LAYOUT as P, PARAGRAPH_GAP_PT } from '@/lib/letterhead'
import type { RichFont } from '@/lib/rich-text'
import type { TaxPdfSummaryRow, TaxPdfView } from '@/lib/tourist-tax-pdf/types'

// PDF-Vorlage des Ortstaxen-Berichts (PROJ-16). Läuft nur im Arbeitsprozess. A4 hoch; Kopf (Logo, Aussteller) wie die
// Rechnung nur auf Seite 1; Tabellenkopf der Buchungsliste auf jeder Folgeseite; bei „Alle Gemeinden“ jede Gemeinde auf
// neuer Seite; Fußzeile mit „Stand“ und „Seite X von Y“.

const mm = (v: number) => (v * 72) / 25.4
const PAGE_HEIGHT_PT = 841.89
const FOOTER_LINE_PT = 12
const RULE = '#999999'

// Spaltenbreiten der Buchungsliste in pt (zusammen die Textbreite von 170 mm ≈ 482 pt)
const COLUMNS = [48, 86, 78, 54, 38, 44, 38, 50, 46]
// rechtsbündig: Personen, Personennächte, befreite Personennächte, Betrag
const RIGHT = new Set([4, 5, 6, 7])
// Tabellen enger gesetzt als der Fließtext
const TABLE_LINE_HEIGHT = 1.15
// Übersicht: Werte-Spalten in pt, die Gemeinde nimmt den Rest
const SUMMARY_COLUMNS = [120, 110, 76]

type FamilyOf = (font: RichFont) => string

function SummaryTable({ columns, rows, size }: { columns: string[]; rows: TaxPdfSummaryRow[]; size: number }) {
  return (
    <View style={{ fontSize: size, lineHeight: TABLE_LINE_HEIGHT }}>
      <View wrap={false} style={{ flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: RULE, paddingBottom: 2, fontSize: size - 1 }}>
        <Text style={{ flexGrow: 1, flexShrink: 1 }}>{columns[0]}</Text>
        {SUMMARY_COLUMNS.map((w, i) => (
          <Text key={i} style={{ width: w, paddingLeft: 6, textAlign: 'right' }}>
            {columns[i + 1]}
          </Text>
        ))}
      </View>
      {rows.map((r, i) => (
        <View
          key={i}
          wrap={false}
          style={{ flexDirection: 'row', paddingVertical: 2.5, borderBottomWidth: 0.5, borderBottomColor: RULE, ...(r.bold ? { fontWeight: 700, borderTopWidth: 1, borderTopColor: '#000000' } : {}) }}
        >
          <View style={{ flexGrow: 1, flexShrink: 1 }}>
            <Text>{r.label}</Text>
            {r.note && <Text style={{ fontSize: size - 1.5, fontWeight: 400 }}>{r.note}</Text>}
          </View>
          {r.cells.map((c, j) => (
            <Text key={j} style={{ width: SUMMARY_COLUMNS[j], paddingLeft: 6, textAlign: 'right' }}>
              {c}
            </Text>
          ))}
        </View>
      ))}
    </View>
  )
}

function BookingRow({ cells, header = false }: { cells: string[]; header?: boolean }) {
  return (
    <View wrap={false} style={{ flexDirection: 'row', paddingVertical: 2, borderBottomWidth: 0.5, borderBottomColor: RULE, ...(header ? { fontWeight: 700, fontSize: 7.5 } : {}) }}>
      {COLUMNS.map((w, i) => (
        // Abstand je Spalte zur Nachbarspalte auf der Seite, an der der Text steht
        <Text key={i} style={{ width: w, ...(RIGHT.has(i) ? { paddingLeft: 4, textAlign: 'right' } : { paddingLeft: RIGHT.has(i - 1) ? 6 : 0, paddingRight: 4 }) }}>
          {cells[i] ?? ''}
        </Text>
      ))}
    </View>
  )
}

export function TaxReportDocument({ view, familyOf, onPages }: { view: TaxPdfView; familyOf: FamilyOf; onPages: (pages: number) => void }) {
  const v = view.letterhead
  const gap = PARAGRAPH_GAP_PT[v.paragraphSpacing]
  const section = gap * 2
  const tableSize = Math.min(v.fontSize, 9)
  const issuerSize = Math.min(v.fontSize, P.issuerMaxPt)
  return (
    <Document title={view.title}>
      <Page
        size="A4"
        style={{
          ...pageBase(view, familyOf),
          paddingTop: mm(P.pageTopMm),
          paddingHorizontal: mm(P.marginXMm),
          paddingBottom: mm(P.footerBottomMm) + FOOTER_LINE_PT + 10,
        }}
      >
        <Head view={view} issuerSize={issuerSize} />

        {/* Inhalt beginnt auf Seite 1 unter dem Kopf, auf Folgeseiten oben */}
        <View style={{ height: mm(P.addressTopMm - P.pageTopMm) }} />

        <View style={{ marginBottom: section, gap: 2 }}>
          <Text style={{ fontSize: v.fontSize * 1.6, fontWeight: 700, marginBottom: 4 }}>{view.heading}</Text>
          {view.meta.map((line, i) => (
            <Text key={i}>{line}</Text>
          ))}
          {view.notice && <Text style={{ marginTop: 4, fontStyle: 'italic' }}>{view.notice}</Text>}
        </View>

        <View style={{ marginBottom: section }}>
          <Text style={{ fontSize: v.fontSize * 1.2, fontWeight: 700, marginBottom: 4 }}>{view.summary.title}</Text>
          <SummaryTable columns={view.summary.columns} rows={view.summary.rows} size={tableSize} />
        </View>

        {view.sections.map((s, i) => (
          <View key={i} break={view.pagePerSection || undefined} style={{ marginBottom: section }}>
            <Text style={{ fontSize: v.fontSize * 1.2, fontWeight: 700, marginBottom: 4 }} minPresenceAhead={60}>
              {view.pagePerSection ? s.title : `${view.bookingsTitle} · ${s.title}`}
            </Text>
            {s.summary && (
              <View style={{ marginBottom: gap }}>
                <SummaryTable columns={view.summary.columns} rows={[s.summary]} size={tableSize} />
              </View>
            )}
            {view.pagePerSection && <Text style={{ fontWeight: 700, marginBottom: 2 }}>{view.bookingsTitle}</Text>}
            <View style={{ fontSize: tableSize, lineHeight: TABLE_LINE_HEIGHT }}>
              {/* Tabellenkopf wiederholt sich auf jeder Seite, über die die Liste läuft */}
              <View fixed>
                <BookingRow cells={view.columns} header />
              </View>
              {s.rows.map((cells, j) => (
                <BookingRow key={j} cells={cells} />
              ))}
            </View>
          </View>
        ))}

        <Text
          fixed
          // Mit „bottom“ setzt React-PDF Text mit render gar nicht (Version 4.9.0), mit „top“ schon (wie die Rechnung)
          style={{ position: 'absolute', left: mm(P.marginXMm), right: mm(P.marginXMm), top: PAGE_HEIGHT_PT - mm(P.footerBottomMm) - FOOTER_LINE_PT, fontSize: 8, textAlign: 'right' }}
          render={({ pageNumber, totalPages }) => {
            if (totalPages) onPages(totalPages)
            return view.pageOf.replace('{page}', String(pageNumber)).replace('{pages}', String(totalPages))
          }}
        />
        <Text fixed style={{ position: 'absolute', left: mm(P.marginXMm), top: PAGE_HEIGHT_PT - mm(P.footerBottomMm) - FOOTER_LINE_PT, fontSize: 8 }}>
          {view.stand}
        </Text>
      </Page>
    </Document>
  )
}
