import { describe, expect, it } from 'vitest'

import type { InvoicePreviewModel } from '@/lib/invoice-preview'
import { buildPdfView, pdfDoc } from '@/lib/invoice-pdf/view'
import { DEFAULT_LETTERHEAD } from '@/lib/letterhead'
import { docFromText, emptyDoc } from '@/lib/rich-text'

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
