import { createTranslator } from 'use-intl/core'
import { describe, expect, it } from 'vitest'

import { cleanCreditReason, creditChecks, type CreditChecksInput, creditEntry, creditPreviewModel, creditSnapshot, mirrorAmounts } from '@/lib/invoice-credit'
import { deductionCandidates } from '@/lib/invoice-drafts'
import type { IssuedSnapshot } from '@/lib/invoice-issue'
import { DEFAULT_NUMBERING } from '@/lib/invoice-numbering'
import { buildPdfView } from '@/lib/invoice-pdf/view'
import { DEFAULT_LETTERHEAD } from '@/lib/letterhead'
import { docFromText } from '@/lib/rich-text'
import { vatBreakdown } from '@/lib/vat'

import messages from '../../messages/de.json'

const lines = [
  { label: 'Übernachtung', amountCents: 39000, vatBp: 1000, source: 'nights' as const },
  { label: 'Endreinigung', amountCents: 6000, vatBp: 1000, source: null },
]

const snapshot = (over: Partial<IssuedSnapshot> = {}): IssuedSnapshot => ({
  kind: 'invoice',
  issuer: { name: 'Alt GmbH', nameLine2: null, addressLine1: 'Altweg 1', addressLine2: null, postalCode: '9220', city: 'Velden', country: 'AT', vatId: 'ATU1' },
  recipient: { name: 'Maria Huber', line1: 'Weg 1', line2: '', postalCode: '1010', city: 'Wien', country: 'AT', vatId: '' },
  recipientKind: 'guest',
  period: { apartmentLabel: 'Seeblick', arrival: '2026-10-03', departure: '2026-10-10' },
  guestNames: ['Maria Huber'],
  partialLabel: null,
  lines,
  deductions: [],
  totals: { linesCents: 45000, totalCents: 45000, vatShares: vatBreakdown(lines) },
  smallBusiness: false,
  schedule: { due: '2026-11-14', depositCents: null, depositDue: null, remainderCents: null, dueClamped: false, depositClamped: false },
  texts: { intro: docFromText('Einleitung'), smallBusinessNote: null, payment: docFromText('Zahlung'), closing: docFromText('Schluss'), footer: docFromText('Alte Fußzeile') },
  ...over,
})

const input = (s: IssuedSnapshot = snapshot(), reason = '') => ({
  invoice: { id: 'r1', number: '2026-0007', invoiceDate: '2026-10-12', snapshot: s },
  creditDate: '2026-11-06',
  reason,
  issuer: { name: 'Neu GmbH', nameLine2: null, addressLine1: 'Neuweg 2', addressLine2: null, postalCode: '9220', city: 'Velden', country: 'AT', vatId: 'ATU1' },
  footer: docFromText('Neue Fußzeile'),
})

// Beträge mit geschütztem Leerzeichen („€ 1,00“) als gewöhnliches Leerzeichen vergleichen
const plain = (v: string) => v.replace(/\u00a0/g, ' ')

const t = createTranslator({ locale: 'de', messages, namespace: 'invoiceDrafts.preview' })
const pdf = (s: IssuedSnapshot, reason = '') =>
  buildPdfView({
    model: creditPreviewModel(input(s, reason)),
    letterhead: DEFAULT_LETTERHEAD,
    number: '2026-0012',
    mark: null,
    logo: null,
    t: (key, values) => t(key as never, values as never),
    pageOf: 'S',
    locale: 'de',
  }).view

describe('Spiegelung', () => {
  it('Beträge und USt je Satz genau umgekehrt, Summe mit der Rechnung € 0,00', () => {
    const s = snapshot()
    const m = mirrorAmounts(s)
    expect(m.lines.map((l) => l.amountCents)).toEqual([-39000, -6000])
    expect(m.lines.every((l) => l.vatBp === 1000 && l.source === null)).toBe(true)
    expect(m.totals.totalCents).toBe(-45000)
    expect(m.totals.vatShares).toEqual([{ vatBp: 1000, grossCents: -45000, vatCents: -4091 }])
    expect(s.totals.vatShares[0].vatCents + m.totals.vatShares[0].vatCents).toBe(0)
  })

  it('0 bleibt 0 (kein „-0“)', () => {
    const zero = [{ label: 'Rabatt', amountCents: 0, vatBp: 2000, source: null }]
    const m = mirrorAmounts(snapshot({ lines: zero, totals: { linesCents: 0, totalCents: 0, vatShares: [] } }))
    expect(Object.is(m.lines[0].amountCents, 0)).toBe(true)
    expect(Object.is(m.totals.totalCents, 0)).toBe(true)
  })

  it('Schlussrechnung: Positionen, Abzüge und Summe gespiegelt; Gutschriftsbetrag = −Rechnungsbetrag', () => {
    const s = snapshot({
      kind: 'final',
      deductions: [{ number: '2026-0003', origin: 'issued', invoiceDate: '2026-09-01', totalCents: 10000, vatShares: [{ vatBp: 1000, grossCents: 10000, vatCents: 909 }] }],
      totals: { linesCents: 45000, totalCents: 35000, vatShares: [{ vatBp: 1000, grossCents: 35000, vatCents: 3182 }] },
    })
    const m = creditPreviewModel(input(s))
    expect(m.totals).toEqual({ linesCents: -45000, deductionsCents: -10000, totalCents: -35000, vatShares: [{ vatBp: 1000, grossCents: -35000, vatCents: -3182 }] })
    expect(m.deductions[0]).toMatchObject({ number: '2026-0003', kind: 'partial', totalCents: -10000, vatShares: [{ vatBp: 1000, grossCents: -10000, vatCents: -909 }] })
  })

  it('aus der Rechnung: Empfänger, Zeitraum, Gastnamen, Kleinunternehmer; aktuell: Aussteller und Fußzeile; keine Bausteine', () => {
    const m = creditPreviewModel(input(snapshot({ smallBusiness: true, texts: { ...snapshot().texts, smallBusinessNote: docFromText('KU-Hinweis') } })))
    expect(m.recipient.name).toBe('Maria Huber')
    expect(m.booking).toEqual(snapshot().period)
    expect(m.guestNames).toEqual(['Maria Huber'])
    expect(m.issuer?.name).toBe('Neu GmbH')
    expect(m.footer).toEqual(docFromText('Neue Fußzeile'))
    expect(m.smallBusiness).toBe(true)
    expect(m.smallBusinessNote).toEqual(docFromText('KU-Hinweis'))
    expect(m.texts).toEqual({ intro: null, payment: null, closing: null })
    expect(m.invoiceDate).toBe('2026-11-06')
  })

  it('Fassung der Gutschrift: Verweis, Grund (eine Zeile), Texte nur Kleinunternehmer-Hinweis und Fußzeile', () => {
    const snap = creditSnapshot(input(snapshot(), '  falscher\nEmpfänger '), { smallBusinessNote: null, footer: docFromText('Neue Fußzeile') })
    expect(snap.credit).toEqual({ invoiceId: 'r1', number: '2026-0007', invoiceDate: '2026-10-12', reason: 'falscher Empfänger' })
    expect(snap.totals.totalCents).toBe(-45000)
    expect(snap.texts).toEqual({ intro: null, smallBusinessNote: null, payment: null, closing: null, footer: docFromText('Neue Fußzeile') })
    expect(creditSnapshot(input(snapshot(), '   '), { smallBusinessNote: null, footer: null }).credit?.reason ?? null).toBeNull()
  })
})

describe('PDF der Gutschrift', () => {
  it('Überschrift, Nummer, Verweis und Grund', () => {
    const view = pdf(snapshot(), 'falscher Empfänger')
    expect(view.heading).toBe('Gutschrift')
    expect(view.title).toBe('Gutschrift 2026-0012')
    expect(view.numberLine).toBe('Gutschriftsnummer: 2026-0012')
    expect(view.references).toEqual(['zu Rechnung 2026-0007 vom 12.10.2026', 'Grund: falscher Empfänger'])
    expect(pdf(snapshot()).references).toEqual(['zu Rechnung 2026-0007 vom 12.10.2026'])
  })

  it('Zeilen, Summe und USt-Tabelle negativ (Beispiel aus der Spec)', () => {
    const view = pdf(snapshot())
    expect(view.services.rows.map((r) => [r.label, plain(r.amount)])).toEqual([
      ['Übernachtung · (inkl. 10 % USt.)', '-€ 390,00'],
      ['Endreinigung · (inkl. 10 % USt.)', '-€ 60,00'],
    ])
    expect(view.services.totals.map((r) => [r.label, plain(r.amount)])).toEqual([['Gutschriftsbetrag (inkl. USt.)', '-€ 450,00']])
    expect(view.services.vatRows.map((r) => [plain(r.label), plain(r.amount)])).toEqual([['10 % aus -€ 409,09', '-€ 40,91']])
  })

  it('Kleinunternehmer: Hinweis, ohne USt-Tabelle und ohne „(inkl. … USt.)“', () => {
    const view = pdf(
      snapshot({ smallBusiness: true, totals: { linesCents: 45000, totalCents: 45000, vatShares: [] }, texts: { ...snapshot().texts, smallBusinessNote: docFromText('KU') } }),
    )
    expect(view.services.rows[0].label).toBe('Übernachtung')
    expect(view.services.totals[0].label).toBe('Gutschriftsbetrag')
    expect(view.services.vatRows).toEqual([])
    expect(view.smallBusinessNote).toEqual(docFromText('KU'))
  })

  it('keine Einleitung, keine Zahlungsmodalitäten, kein Schlusstext', () => {
    const view = pdf(snapshot())
    expect([view.intro, view.payment, view.closing]).toEqual([null, null, null])
  })

  it('Teilrechnung nach Betrag: Anzahlungszeile und Anteile je Satz gespiegelt', () => {
    const share = [{ label: 'Anteil', amountCents: 10000, vatBp: 1000, source: null }]
    const view = pdf(snapshot({ kind: 'partial', partialLabel: 'Anzahlung für Aufenthalt in Seeblick', lines: share, totals: { linesCents: 10000, totalCents: 10000, vatShares: vatBreakdown(share) } }))
    expect(view.services.rows.map((r) => [r.label, plain(r.amount)])).toEqual([
      ['Anzahlung für Aufenthalt in Seeblick', ''],
      ['Anteil (inkl. 10 % USt.)', '-€ 100,00'],
    ])
  })

  it('Schlussrechnung: Abzugszeile mit umgekehrtem Vorzeichen', () => {
    const view = pdf(
      snapshot({
        kind: 'final',
        deductions: [{ number: '2026-0003', origin: 'issued', invoiceDate: '2026-09-01', totalCents: 10000, vatShares: [{ vatBp: 1000, grossCents: 10000, vatCents: 909 }] }],
        totals: { linesCents: 45000, totalCents: 35000, vatShares: [{ vatBp: 1000, grossCents: 35000, vatCents: 3182 }] },
      }),
    )
    expect(view.services.totals.map((r) => [r.label, plain(r.amount)])).toEqual([
      ['Summe der Leistungen (inkl. USt.)', '-€ 450,00'],
      ['abzüglich Teilrechnung 2026-0003 vom 01.09.2026', '€ 100,00'],
      ['Gutschriftsbetrag (inkl. USt.)', '-€ 350,00'],
    ])
  })
})

const checks = (over: Partial<CreditChecksInput> = {}) =>
  creditChecks({
    number: '2026-0012',
    creditDate: '2026-11-06',
    today: '2026-11-06',
    invoiceDate: '2026-10-12',
    reason: '',
    numbering: DEFAULT_NUMBERING,
    existing: Array.from({ length: 11 }, (_, i) => ({ number: `2026-${String(i + 1).padStart(4, '0')}`, invoiceDate: '2026-10-01' })),
    cancelledBy: null,
    deductedBy: null,
    totalCents: -45000,
    pdf: { missingChars: [], issuerOverflow: false, footerCut: false, footerReduced: false, logoFailed: false, logoBlurry: false },
    ...over,
  })

describe('Prüfliste', () => {
  it('Vorschlag aus dem gemeinsamen Nummernkreis: alles in Ordnung', () => {
    expect(checks()).toEqual({ number: '2026-0012', invoiceDate: '2026-11-06', blocks: [], acks: [], notes: [] })
  })
  it('Datum vor dem Rechnungsdatum oder in der Zukunft sperrt', () => {
    expect(checks({ creditDate: '2026-10-11' }).blocks).toContainEqual({ key: 'dateBeforeInvoice', date: '2026-10-12' })
    expect(checks({ creditDate: '2026-11-07' }).blocks).toContainEqual({ key: 'futureDate' })
    expect(checks({ creditDate: '2026-10-12' }).blocks).toEqual([])
  })
  it('Grund über 300 Zeichen sperrt, 300 nicht', () => {
    expect(checks({ reason: 'x'.repeat(301) }).blocks).toEqual([{ key: 'reasonTooLong' }])
    expect(checks({ reason: 'x'.repeat(300) }).blocks).toEqual([])
  })
  it('vergebene Nummer sperrt; Nummer über dem Vorschlag braucht das Häkchen', () => {
    expect(checks({ number: '2026-0011' }).blocks).toEqual([{ key: 'numberTaken', number: '2026-0011' }])
    expect(checks({ number: '2026-0015' }).acks).toEqual([{ id: 'number:2026-0015', key: 'numberAbove', next: '2026-0016' }])
  })
  it('storniert oder in gültiger Schlussrechnung abgezogen sperrt', () => {
    expect(checks({ cancelledBy: { id: 'g1', number: '2026-0011' } }).blocks).toEqual([{ key: 'alreadyCredited', id: 'g1', number: '2026-0011' }])
    expect(checks({ deductedBy: { id: 's1', number: '2026-0010' } }).blocks).toEqual([{ key: 'deductedByFinal', id: 's1', number: '2026-0010' }])
  })
  it('Gutschriftsbetrag 0 oder positiv: nur Hinweis', () => {
    expect(checks({ totalCents: 0 }).notes).toEqual([{ key: 'creditNotNegative' }])
    expect(checks({ totalCents: 0 }).blocks).toEqual([])
  })
  it('PDF-Meldungen wie beim Ausstellen', () => {
    const c = checks({ pdf: { missingChars: ['✓'], issuerOverflow: false, footerCut: true, footerReduced: true, logoFailed: true, logoBlurry: false } })
    expect(c.blocks).toEqual([{ key: 'missingChars', chars: '✓' }, { key: 'footerCut' }])
    expect(c.acks).toEqual([{ id: 'logo', key: 'logo' }])
  })
  it('Grund: Leerzeichen und Zeilenumbrüche zusammengefasst', () => {
    expect(cleanCreditReason('  a \n\t b ')).toBe('a b')
  })
})

describe('Einstieg', () => {
  const base = { origin: 'issued', kind: 'invoice', cancelledBy: null, deductedBy: null }
  it('ausgestellte Rechnung: Knopf', () => expect(creditEntry(base)).toEqual({ state: 'available' }))
  it('Entwurf, nacherfasst, storniert, Gutschrift: kein Knopf', () => {
    expect(creditEntry({ ...base, origin: 'draft' }).state).toBe('none')
    expect(creditEntry({ ...base, origin: 'backfilled', kind: null }).state).toBe('none')
    expect(creditEntry({ ...base, cancelledBy: { id: 'g', number: '1' } }).state).toBe('none')
    expect(creditEntry({ ...base, kind: 'credit_note' }).state).toBe('none')
  })
  it('abgezogene Teilrechnung: gesperrt mit Schlussrechnung', () => {
    expect(creditEntry({ ...base, kind: 'partial', deductedBy: { id: 's', number: '2026-0010' } })).toEqual({ state: 'deducted', final: { id: 's', number: '2026-0010' } })
  })
})

describe('Abziehbar in neuen Schlussrechnungen', () => {
  const summary = { invoiceDate: '2026-09-01', totalCents: 10000, lines: [] }
  it('stornierte Teilrechnungen und Gutschriften nicht', () => {
    const ids = deductionCandidates([
      { ...summary, id: 'a', number: '1', origin: 'issued', kind: 'partial' },
      { ...summary, id: 'b', number: '2', origin: 'issued', kind: 'partial', cancelled: true },
      { ...summary, id: 'c', number: '3', origin: 'issued', kind: 'credit_note' },
    ]).map((c) => c.id)
    expect(ids).toEqual(['a'])
  })
})
