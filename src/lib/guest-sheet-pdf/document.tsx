import { Document, Image as PdfImage, Line, Page, Svg, Text, View } from '@react-pdf/renderer'

import type { GuestSheetPdfView, PdfDay } from '@/lib/guest-sheet-pdf/types'
import { RichDocPdf } from '@/lib/invoice-pdf/document'
import type { RichFont } from '@/lib/rich-text'

// PDF-Vorlage des Gästeblatts (PROJ-26). Läuft nur im Arbeitsprozess. Seite 1 im Querformat als Nachbau des amtlichen
// Gästeverzeichnisblatts (docs/design/gaesteblatt-leer.png, ohne Reisegruppen), Seite 2 im Hochformat mit den
// Datenschutz-Texten, dem Kästchen und der zweiten Unterschrift.

type FamilyOf = (font: RichFont) => string

const BASE_FONT: RichFont = 'arimo'
const LINE = 0.75
const INK = '#000000'
const LABEL = 7
const VALUE = 10.5
const MARGIN = 28
// A4 in pt: Querformat (Seite 1) ist 595 hoch, Hochformat (Seite 2) 842
const A4_SHORT = 595.28
const A4_LONG = 841.89

const box = { borderColor: INK, borderWidth: LINE } as const

function Cell({ label, value, flex, width, minHeight = 34, children }: { label: string; value?: string; flex?: number; width?: number; minHeight?: number; children?: React.ReactNode }) {
  return (
    <View style={{ ...box, flex, width, minHeight, padding: 4, marginLeft: -LINE, marginTop: -LINE }}>
      {label ? <Text style={{ fontSize: LABEL }}>{label}</Text> : null}
      {value !== undefined && <Text style={{ fontSize: VALUE, marginTop: 3 }}>{value || ' '}</Text>}
      {children}
    </View>
  )
}

// Kästchen mit Kreuz als Linien (ein „X“ als Text passt nicht sicher in das kleine Kästchen und fiel weg)
export function Box({ checked, size }: { checked: boolean; size: number }) {
  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Line x1={0.4} y1={0.4} x2={size - 0.4} y2={0.4} stroke={INK} strokeWidth={LINE} />
      <Line x1={size - 0.4} y1={0.4} x2={size - 0.4} y2={size - 0.4} stroke={INK} strokeWidth={LINE} />
      <Line x1={size - 0.4} y1={size - 0.4} x2={0.4} y2={size - 0.4} stroke={INK} strokeWidth={LINE} />
      <Line x1={0.4} y1={size - 0.4} x2={0.4} y2={0.4} stroke={INK} strokeWidth={LINE} />
      {checked && <Line x1={1.5} y1={1.5} x2={size - 1.5} y2={size - 1.5} stroke={INK} strokeWidth={1.2} />}
      {checked && <Line x1={size - 1.5} y1={1.5} x2={1.5} y2={size - 1.5} stroke={INK} strokeWidth={1.2} />}
    </Svg>
  )
}

function CheckBox({ checked, label }: { checked: boolean; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginRight: 10 }}>
      <Box checked={checked} size={8} />
      <Text style={{ fontSize: 8 }}>{label}</Text>
    </View>
  )
}

function Day({ label, day, labels }: { label: string; day: PdfDay | null; labels: Record<string, string> }) {
  return (
    <Cell label="" flex={1} minHeight={46}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <Text style={{ fontSize: LABEL, fontWeight: 700, flex: 1 }}>{label}</Text>
        <Text style={{ fontSize: LABEL, width: 26 }}>{labels.day}</Text>
        <Text style={{ fontSize: LABEL, width: 30 }}>{labels.month}</Text>
        <Text style={{ fontSize: LABEL, width: 30 }}>{labels.year}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 'auto', paddingTop: 4 }}>
        <View style={{ flex: 1 }} />
        <Text style={{ fontSize: VALUE, width: 26 }}>{day?.day ?? ''}</Text>
        <Text style={{ fontSize: VALUE, width: 30 }}>{day?.month ?? ''}</Text>
        <Text style={{ fontSize: VALUE, width: 30 }}>{day?.year ?? ''}</Text>
      </View>
    </Cell>
  )
}

export function GuestSheetDocument({ view, familyOf, onPages }: { view: GuestSheetPdfView; familyOf: FamilyOf; onPages: (pages: number) => void }) {
  const l = view.labels
  const g = view.guest
  // Mindestens fünf Zeilen wie auf dem Formular, bei mehr Mitreisenden entsprechend mehr
  const companionRows = [...view.companions, ...Array.from({ length: Math.max(0, 5 - view.companions.length) }, () => null)]
  // Mit „bottom“ setzt React-PDF Text mit render gar nicht (Version 4.9.0), mit „top“ schon (wie Rechnung und Bericht)
  const footer = (pageHeight: number) => (
    <Text
      fixed
      style={{ position: 'absolute', left: MARGIN, right: MARGIN, top: pageHeight - 22, fontSize: 7, textAlign: 'right', color: '#444444' }}
      render={({ pageNumber, totalPages }) => {
        if (totalPages) onPages(totalPages)
        return view.footer.replace('{page}', String(pageNumber)).replace('{pages}', String(totalPages))
      }}
    />
  )
  const base = { fontFamily: familyOf(BASE_FONT), fontSize: VALUE, lineHeight: 1.25, color: INK }

  return (
    <Document title={view.title}>
      <Page size="A4" orientation="landscape" style={{ ...base, padding: MARGIN, paddingBottom: MARGIN + 6 }}>
        {/* Kopf: Titel, Kennzahl, Name des Beherbergungsbetriebes, Lfd.-Nr. */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginBottom: 4 }}>
          <Text style={{ fontSize: 18, fontWeight: 700, width: 250 }}>{l.title}</Text>
          <Text style={{ fontSize: 9, width: 150, paddingTop: 5 }}>{l.kennzahl}</Text>
          <Text style={{ fontSize: 9, flex: 1, paddingTop: 5 }}>
            {l.establishment} <Text style={{ fontWeight: 700 }}>{view.establishment}</Text>
          </Text>
        </View>
        <Text style={{ fontSize: 9, marginBottom: 8 }}>
          {l.sheetNumber} <Text style={{ fontWeight: 700 }}>{view.sheetNumber}</Text>
        </Text>

        <View style={{ paddingLeft: LINE, paddingTop: LINE }}>
          <View style={{ flexDirection: 'row' }} wrap={false}>
            <Cell label={l.lastName} value={g.lastName} flex={1} minHeight={42} />
            <Cell label="" width={430} minHeight={42}>
              <View style={{ flexDirection: 'row' }}>
                <Text style={{ fontSize: LABEL, width: 60 }}>{l.gender}</Text>
                <Text style={{ fontSize: LABEL, flex: 1 }}>{l.genderHint}</Text>
                <Text style={{ fontSize: LABEL, width: 92 }}>{l.genderNone}</Text>
              </View>
              <View style={{ flexDirection: 'row', marginTop: 9, flexWrap: 'wrap' }}>
                {view.genders.map((o) => (
                  <View key={o.value} style={o.value === 'unspecified' ? { marginLeft: 'auto' } : undefined}>
                    <CheckBox checked={o.value === g.gender} label={o.label} />
                  </View>
                ))}
              </View>
            </Cell>
          </View>
          <View style={{ flexDirection: 'row' }} wrap={false}>
            <Cell label={l.firstNames} value={g.firstNames} flex={1.1} />
            <Cell label={l.birthDate} value={g.birthDate} flex={1.25} />
            <Cell label={l.nationality} value={g.nationality} flex={1} />
          </View>
          <View style={{ flexDirection: 'row' }} wrap={false}>
            <Cell label={l.document} value={g.document} flex={1} minHeight={38} />
          </View>
          <View style={{ flexDirection: 'row' }} wrap={false}>
            <Cell label={`${l.address}\n\n${l.addressHint}`} width={150} minHeight={74} />
            <View style={{ flex: 1 }}>
              <Cell label={l.street} value={g.street} minHeight={37} />
              <View style={{ flexDirection: 'row' }}>
                <Cell label={l.postalCode} value={g.postalCode} width={110} minHeight={37} />
                <Cell label={l.city} value={g.city} flex={1.4} minHeight={37} />
                <Cell label={l.country} value={g.country} flex={1} minHeight={37} />
              </View>
            </View>
          </View>
          <View style={{ flexDirection: 'row' }}>
            <View style={{ ...box, width: 230, padding: 4, marginLeft: -LINE, marginTop: -LINE, justifyContent: 'center' }}>
              <Text style={{ fontSize: 8 }}>
                <Text style={{ fontWeight: 700 }}>{l.companions}</Text> {l.companionsHint}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              {companionRows.map((c, i) => (
                <View key={i} style={{ flexDirection: 'row' }} wrap={false}>
                  <Cell label={i === 0 ? l.lastName : ''} value={c?.lastName ?? ''} flex={1.2} minHeight={i === 0 ? 30 : 22} />
                  <Cell label={i === 0 ? l.firstNames : ''} value={c?.firstNames ?? ''} flex={1} minHeight={i === 0 ? 30 : 22} />
                  <Cell label={i === 0 ? l.birthDate : ''} value={c?.birthDate ?? ''} flex={1} minHeight={i === 0 ? 30 : 22} />
                </View>
              ))}
            </View>
          </View>
          <View style={{ flexDirection: 'row' }} wrap={false}>
            <Day label={l.arrival} day={view.arrival} labels={l} />
            <Day label={l.plannedDeparture} day={view.plannedDeparture} labels={l} />
            <Day label={l.actualDeparture} day={view.actualDeparture} labels={l} />
            <Cell label="" flex={1.1} minHeight={46}>
              <Text style={{ fontSize: LABEL, fontWeight: 700 }}>{l.signature}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 4, marginTop: 2 }}>
                <Text style={{ fontSize: 7 }}>{view.signature1.signedAt}</Text>
                <PdfImage src={view.signature1.image} style={{ height: 34, maxWidth: 140, objectFit: 'contain' }} />
              </View>
            </Cell>
          </View>
        </View>
        {view.departureNote && <Text style={{ fontSize: 7.5, marginTop: 4 }}>{view.departureNote}</Text>}
        {footer(A4_SHORT)}
      </Page>

      <Page size="A4" style={{ ...base, padding: 56, paddingBottom: 56 }}>
        <Text style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2, marginBottom: 4 }}>{l.privacyPage}</Text>
        <Text style={{ fontSize: 9, marginBottom: 16 }}>{l.privacyRef}</Text>
        <Text style={{ fontSize: 11.5, fontWeight: 700, marginBottom: 6 }}>{view.privacyTitle}</Text>
        <RichDocPdf doc={view.privacy} gap={5} familyOf={familyOf} baseSize={10} />
        <Text style={{ fontSize: 11.5, fontWeight: 700, marginTop: 18, marginBottom: 6 }} minPresenceAhead={60}>
          {view.marketingTitle}
        </Text>
        <RichDocPdf doc={view.marketing} gap={5} familyOf={familyOf} baseSize={10} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }} wrap={false}>
          <Box checked={view.consent} size={11} />
          <Text style={{ fontSize: 10.5, fontWeight: 700 }}>{view.consentLabel}</Text>
        </View>
        <View style={{ marginTop: 28, width: 260 }} wrap={false}>
          <PdfImage src={view.signature2.image} style={{ height: 54, maxWidth: 240, objectFit: 'contain', objectPosition: 'left' }} />
          <View style={{ borderTopWidth: LINE, borderTopColor: INK, paddingTop: 3 }}>
            <Text style={{ fontSize: 8 }}>{view.signature2.label}</Text>
            <Text style={{ fontSize: 8 }}>{view.signature2.signedAt}</Text>
          </View>
        </View>
        {footer(A4_LONG)}
      </Page>
    </Document>
  )
}
