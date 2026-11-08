import { Document, Page, Text, View } from '@react-pdf/renderer'

import { Head, pageBase } from '@/lib/invoice-pdf/document'
import { PAGE_LAYOUT as P, PARAGRAPH_GAP_PT } from '@/lib/letterhead'
import type { RichFont } from '@/lib/rich-text'
import type { StatsPdfChart, StatsPdfTable, StatsPdfView } from '@/lib/statistics-pdf/types'

// PDF-Vorlage der Auswertung (PROJ-18). Läuft nur im Arbeitsprozess. A4 hoch; Kopf (Logo, Aussteller) wie die Rechnung
// nur auf Seite 1; Kennzahlen, zwei Balkendiagramme (Auslastung, Umsatz), Tabellen „Je Monat“, „Je Wohnung“ und
// „Gästeherkunft“ mit Tabellenkopf auf Folgeseiten; Fußzeile mit „Stand“ und „Seite X von Y“.

const mm = (v: number) => (v * 72) / 25.4
const PAGE_HEIGHT_PT = 841.89
const FOOTER_LINE_PT = 12
const RULE = '#999999'
// Textbreite 170 mm
const TEXT_WIDTH_PT = 482
const TABLE_LINE_HEIGHT = 1.15
// Diagrammfarben wie am Bildschirm: gewähltes Jahr Akzent, Vorjahr Grau
const CURRENT = '#0088b0'
const PREVIOUS = '#9b9797'
const GRID = '#d7d3d3'
const CHART_HEIGHT_PT = 96
const AXIS_WIDTH_PT = 46

type FamilyOf = (font: RichFont) => string

function Kpis({ view, size }: { view: StatsPdfView; size: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      {view.kpis.map((k, i) => (
        <View key={i} wrap={false} style={{ flex: 1, borderWidth: 0.5, borderColor: RULE, padding: 5, gap: 2, fontSize: size - 1.5, lineHeight: TABLE_LINE_HEIGHT }}>
          <Text>{k.label}</Text>
          <Text style={{ fontSize: size + 4, fontWeight: 700, lineHeight: 1.25, marginVertical: 1 }}>{k.value}</Text>
          {k.sub && <Text>{k.sub}</Text>}
          <Text>{k.previous}</Text>
        </View>
      ))}
    </View>
  )
}

function Chart({ chart, size }: { chart: StatsPdfChart; size: number }) {
  return (
    <View wrap={false} style={{ marginBottom: 8 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text style={{ fontWeight: 700 }}>{chart.title}</Text>
        <View style={{ flexDirection: 'row', gap: 10, fontSize: size - 1.5 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
            <View style={{ width: 7, height: 7, backgroundColor: CURRENT }} />
            <Text>{chart.legend.current}</Text>
          </View>
          {chart.legend.previous && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
              <View style={{ width: 7, height: 7, backgroundColor: PREVIOUS }} />
              <Text>{chart.legend.previous}</Text>
            </View>
          )}
        </View>
      </View>
      {/* Abstand nach oben, damit die oberste Achsenbeschriftung nicht an die Überschrift stößt */}
      <View style={{ flexDirection: 'row', marginTop: 8 }}>
        {/* Achse */}
        <View style={{ width: AXIS_WIDTH_PT, height: CHART_HEIGHT_PT, position: 'relative', fontSize: 6.5 }}>
          {chart.ticks.map((tick, i) => (
            <Text key={i} style={{ position: 'absolute', right: 4, bottom: tick.share * CHART_HEIGHT_PT - 3, textAlign: 'right' }}>
              {tick.label}
            </Text>
          ))}
        </View>
        <View style={{ flexGrow: 1 }}>
          <View style={{ height: CHART_HEIGHT_PT, position: 'relative' }}>
            {chart.ticks.map((tick, i) => (
              <View
                key={i}
                style={{ position: 'absolute', left: 0, right: 0, bottom: tick.share * CHART_HEIGHT_PT, borderTopWidth: 0.5, borderTopColor: tick.share === 0 ? RULE : GRID }}
              />
            ))}
            <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, flexDirection: 'row' }}>
              {chart.bars.map((b, i) => (
                <View key={i} style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 1.5 }}>
                  {b.previous !== null && <View style={{ width: '32%', height: b.previous * CHART_HEIGHT_PT, backgroundColor: PREVIOUS }} />}
                  <View style={{ width: '32%', height: b.current * CHART_HEIGHT_PT, backgroundColor: CURRENT }} />
                </View>
              ))}
            </View>
          </View>
          <View style={{ flexDirection: 'row', fontSize: 6.5, marginTop: 2 }}>
            {chart.bars.map((b, i) => (
              <Text key={i} style={{ flex: 1, textAlign: 'center' }}>
                {b.label}
              </Text>
            ))}
          </View>
        </View>
      </View>
    </View>
  )
}

function Table({ table, size }: { table: StatsPdfTable; size: number }) {
  const others = table.columns.length - 1
  const width = (i: number) => (i === 0 ? table.firstWidth : (TEXT_WIDTH_PT - table.firstWidth) / others)
  const cell = (i: number) => ({ width: width(i), ...(i === 0 ? { paddingRight: 4 } : { paddingLeft: 4, textAlign: 'right' as const }) })
  return (
    <View style={{ fontSize: size, lineHeight: TABLE_LINE_HEIGHT }}>
      {/* Tabellenkopf wiederholt sich auf jeder Seite, über die die Tabelle läuft */}
      <View fixed style={{ flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: RULE, paddingBottom: 2, fontSize: size - 1, fontWeight: 700 }}>
        {table.columns.map((c, i) => (
          <Text key={i} style={cell(i)}>
            {c}
          </Text>
        ))}
      </View>
      {table.rows.map((r, j) => (
        <View key={j} wrap={false}>
          {table.groups[j] && <Text style={{ fontWeight: 700, paddingTop: 5, paddingBottom: 1 }}>{table.groups[j]}</Text>}
          <View
            style={{ flexDirection: 'row', paddingVertical: 2.5, borderBottomWidth: 0.5, borderBottomColor: RULE, ...(r.bold ? { fontWeight: 700, borderTopWidth: 1, borderTopColor: '#000000' } : {}) }}
          >
            {r.cells.map((c, i) => (
              <View key={i} style={cell(i)}>
                <Text>{c.main}</Text>
                {c.small.map((s, k) => (
                  <Text key={k} style={{ fontSize: size - 2, fontWeight: 400 }}>
                    {s}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  )
}

export function StatsDocument({ view, familyOf, onPages }: { view: StatsPdfView; familyOf: FamilyOf; onPages: (pages: number) => void }) {
  const v = view.letterhead
  const gap = PARAGRAPH_GAP_PT[v.paragraphSpacing]
  const section = gap * 2
  const tableSize = Math.min(v.fontSize, 9)
  const issuerSize = Math.min(v.fontSize, P.issuerMaxPt)
  const heading = { fontSize: v.fontSize * 1.2, fontWeight: 700 as const, marginBottom: 4 }
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

        {/* Inhalt beginnt auf Seite 1 unter dem Kopf */}
        <View style={{ height: mm(P.addressTopMm - P.pageTopMm) }} />

        <View style={{ marginBottom: section, gap: 2 }}>
          <Text style={{ fontSize: v.fontSize * 1.6, fontWeight: 700, marginBottom: 4 }}>{view.heading}</Text>
          {view.meta.map((line, i) => (
            <Text key={i}>{line}</Text>
          ))}
          {view.notice && <Text style={{ marginTop: 4, fontStyle: 'italic' }}>{view.notice}</Text>}
        </View>

        <View style={{ marginBottom: section }}>
          <Kpis view={view} size={tableSize} />
        </View>

        <View style={{ marginBottom: section }}>
          {view.charts.map((c, i) => (
            <Chart key={i} chart={c} size={tableSize} />
          ))}
        </View>

        {view.tables.map((table, i) => (
          <View key={i} style={{ marginBottom: section }}>
            <Text style={heading} minPresenceAhead={60}>
              {table.title}
            </Text>
            {table.note && <Text style={{ fontSize: tableSize - 1, marginBottom: 3 }}>{table.note}</Text>}
            <Table table={table} size={tableSize} />
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
