import { createTranslator } from 'use-intl/core'
import { describe, expect, it } from 'vitest'

import type { InvoicePreviewModel } from '@/lib/invoice-preview'
import { buildPdfView, pdfDoc } from '@/lib/invoice-pdf/view'
import { DEFAULT_LETTERHEAD } from '@/lib/letterhead'
import { docFromText, emptyDoc } from '@/lib/rich-text'

import messages from '../../../messages/de.json'

const t = (key: string, values?: Record<string, string | number>) => `${key}${values ? JSON.stringify(values) : ''}`

const model = (over: Partial<InvoicePreviewModel> = {}): InvoicePreviewModel =>
  ({
    kind: 'invoice',
    invoiceDate: '2026-11-04',
    issuer: { name: 'Muster GmbH', nameLine2: null, addressLine1: 'Seestraße 12', addressLine2: null, postalCode: '9220', city: 'Velden', country: 'AT', vatId: 'ATU1' },
    recipient: { name: 'Maria', line1: 'Weg 1', line2: '', postalCode: '1010', city: 'Wien', country: 'AT', vatId: '' },
    booking: { apartmentLabel: 'Seeblick', arrival: '2026-10-03', departure: '2026-10-10' },
    guestNames: [],
    partialLabel: null,
    lines: [{ label: 'Übernachtung', amountCents: 10000, vatBp: 1000, source: null }],
    deductions: [],
    missingDeductions: 0,
    totals: { linesCents: 10000, deductionsCents: 0, totalCents: 10000, vatShares: [{ vatBp: 1000, grossCents: 10000, vatCents: 909 }] },
    smallBusiness: false,
    smallBusinessNote: docFromText('Kleinunternehmer'),
    texts: { intro: docFromText('Hallo {Gast}'), payment: null, closing: emptyDoc() },
    values: { Gast: 'Maria' },
    footer: docFromText('Bank'),
    ...over,
  }) as InvoicePreviewModel

const build = (over: Partial<Parameters<typeof buildPdfView>[0]> = {}) =>
  buildPdfView({ model: model(), letterhead: DEFAULT_LETTERHEAD, number: 'Entwurf', mark: 'Entwurf', logo: null, t, pageOf: 'S', locale: 'de', ...over }).view

describe('Aussteller-Block', () => {
  it('neben dem Logo mehrzeilig', () => {
    expect(build().issuer?.map((l) => l.text)).toEqual(['Muster GmbH', 'Seestraße 12', '9220 Velden', 'Österreich', 'vatId{"id":"ATU1"}'])
  })
  it('unter einem mittigen Logo zweizeilig', () => {
    const lines = build({ letterhead: { ...DEFAULT_LETTERHEAD, logoPosition: 'center' } }).issuer
    expect(lines).toHaveLength(2)
    expect(lines?.[1].text).toBe('Seestraße 12 · 9220 Velden · Österreich · vatId{"id":"ATU1"}')
  })
  it('abgeschaltet: keine Angabe, Fußzeile unverändert', () => {
    const view = build({ letterhead: { ...DEFAULT_LETTERHEAD, showIssuer: false } })
    expect(view.issuer).toBeNull()
    expect(view.footer).toEqual(docFromText('Bank'))
  })
})

describe('Inhalte', () => {
  it('ersetzt Platzhalter, leere Texte fallen weg', () => {
    const view = build()
    expect(JSON.stringify(view.intro)).toContain('Hallo Maria')
    expect(view.payment).toBeNull()
    expect(view.closing).toBeNull()
  })
  it('Kleinunternehmer: Hinweis, kein Satz in den Zeilen', () => {
    const view = build({ model: model({ smallBusiness: true, totals: { linesCents: 10000, deductionsCents: 0, totalCents: 10000, vatShares: [] } }) })
    expect(view.smallBusinessNote).not.toBeNull()
    expect(view.services.rows[0].label).toBe('Übernachtung')
    expect(view.services.vatTitle).toBeNull()
  })
  it('negative Beträge behalten das Minus', () => {
    const view = build({ model: model({ lines: [{ label: 'Rabatt', amountCents: -5000, vatBp: 2000, source: null }] }) })
    expect(view.services.rows[0].amount).toMatch(/^-/)
  })
  it('kürzt sehr viele Leerzeilen', () => {
    const doc = { type: 'doc' as const, content: [...Array.from({ length: 100 }, () => ({ type: 'paragraph' as const })), { type: 'paragraph' as const, content: [{ type: 'text' as const, text: 'x' }] }] }
    expect(pdfDoc(doc)?.content).toHaveLength(4)
  })
})

describe('Schreibweise der USt (PROJ-40, refine 2026-11-06)', () => {
  // echte deutsche Texte, damit die Formulierungen geprüft sind
  const de = createTranslator({ locale: 'de', messages, namespace: 'invoiceDrafts.preview' }) as unknown as (key: string, values?: Record<string, string | number>) => string
  const view = (over: Partial<InvoicePreviewModel> = {}) =>
    buildPdfView({ model: model(over), letterhead: DEFAULT_LETTERHEAD, number: 'Entwurf', mark: null, logo: null, t: de, pageOf: 'S', locale: 'de' }).view
  const norm = (s: string | undefined) => s?.replace(/\u00a0/g, ' ')
  const shares = (s: { vatBp: number; grossCents: number; vatCents: number }[], linesCents: number, deductionsCents = 0) => ({
    linesCents,
    deductionsCents,
    totalCents: linesCents - deductionsCents,
    vatShares: s,
  })

  it('Zeilen „· (inkl. 10 % USt.)“, auch 0 %; Rechnungsbetrag „(inkl. USt.)“; Tabelle „10 % aus € 409,09“', () => {
    const v = view({
      lines: [
        { label: 'Übernachtung', amountCents: 39000, vatBp: 1000, source: null },
        { label: 'Endreinigung', amountCents: 6000, vatBp: 1000, source: null },
        { label: 'Nächtigungsabgabe', amountCents: 1200, vatBp: 0, source: null },
      ],
      totals: shares([{ vatBp: 1000, grossCents: 45000, vatCents: 4091 }], 46200),
    } as Partial<InvoicePreviewModel>)
    expect(v.services.rows.map((r) => norm(r.label))).toEqual([
      'Übernachtung · (inkl. 10 % USt.)',
      'Endreinigung · (inkl. 10 % USt.)',
      'Nächtigungsabgabe · (inkl. 0 % USt.)',
    ])
    expect(v.services.totals.map((r) => r.label)).toEqual(['Rechnungsbetrag (inkl. USt.)'])
    expect(v.services.vatTitle).toBe('Darin enthaltene Umsatzsteuer')
    expect(v.services.vatRows.map((r) => [norm(r.label), norm(r.amount)])).toEqual([['10 % aus € 409,09', '€ 40,91']])
  })

  it('Teilrechnung: „Anteil (inkl. 10 % USt.)“', () => {
    const v = view({
      kind: 'partial',
      partialLabel: 'Anzahlung für Aufenthalt',
      lines: [
        { label: 'Anteil', amountCents: 9000, vatBp: 1000, source: null },
        { label: 'Anteil', amountCents: 1000, vatBp: 2000, source: null },
      ],
      totals: shares([{ vatBp: 1000, grossCents: 9000, vatCents: 818 }, { vatBp: 2000, grossCents: 1000, vatCents: 167 }], 10000),
    } as Partial<InvoicePreviewModel>)
    expect(v.services.rows.slice(1).map((r) => norm(r.label))).toEqual(['Anteil (inkl. 10 % USt.)', 'Anteil (inkl. 20 % USt.)'])
    expect(v.services.vatRows.map((r) => norm(r.label))).toEqual(['10 % aus € 81,82', '20 % aus € 8,33'])
  })

  it('Schlussrechnung mit Abzug: beide Summen mit „(inkl. USt.)“, Netto nach Abzug', () => {
    const v = view({
      kind: 'final',
      deductions: [{ id: 'd', number: 'R-1', invoiceDate: '2026-10-01', kind: 'partial', origin: 'issued', totalCents: 10000, vatShares: [{ vatBp: 1000, grossCents: 10000, vatCents: 909 }] }],
      lines: [{ label: 'Übernachtung', amountCents: 45000, vatBp: 1000, source: null }],
      totals: shares([{ vatBp: 1000, grossCents: 35000, vatCents: 3182 }], 45000, 10000),
    } as Partial<InvoicePreviewModel>)
    expect(v.services.totals[0].label).toBe('Summe der Leistungen (inkl. USt.)')
    expect(v.services.totals.at(-1)?.label).toBe('Rechnungsbetrag (inkl. USt.)')
    expect(norm(v.services.vatRows[0].label)).toBe('10 % aus € 318,18')
  })

  it('Kleinunternehmer und nur 0 %: Summen ohne Zusatz, keine Tabelle', () => {
    const small = view({ smallBusiness: true, totals: shares([], 10000) })
    expect(small.services.rows[0].label).toBe('Übernachtung')
    expect(small.services.totals.map((r) => r.label)).toEqual(['Rechnungsbetrag'])
    expect(small.services.vatRows).toEqual([])
    const zero = view({ lines: [{ label: 'Nächtigungsabgabe', amountCents: 1200, vatBp: 0, source: null }], totals: shares([], 1200) } as Partial<InvoicePreviewModel>)
    expect(norm(zero.services.rows[0].label)).toBe('Nächtigungsabgabe · (inkl. 0 % USt.)')
    expect(zero.services.totals.map((r) => r.label)).toEqual(['Rechnungsbetrag'])
    expect(zero.services.vatTitle).toBeNull()
  })
})

