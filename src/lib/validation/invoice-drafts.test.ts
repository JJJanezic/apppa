import { describe, expect, it } from 'vitest'

import { docFromText, emptyDoc } from '@/lib/rich-text'
import { type DraftInput, draftSchema, liveDraftPayment, parsePartialPercent } from '@/lib/validation/invoice-drafts'

const t = (key: string, values?: Record<string, string | number>) => (values?.token ? `${key}:${values.token}` : key)
const CHARGE = '11111111-2222-3333-4444-555555555555'

const input = (o: Partial<DraftInput> = {}): DraftInput => ({
  kind: 'invoice',
  recipientKind: 'guest',
  companySalutation: 'generic',
  recipientName: 'Maria Huber',
  recipientLine1: '',
  recipientLine2: '',
  recipientPostalCode: '',
  recipientCity: '',
  recipientCountry: 'at',
  recipientVatId: 'atu 123',
  invoiceDate: '2026-10-31',
  guestNames: 'none',
  lines: [
    { selected: true, source: 'nights', label: 'Übernachtung', amount: '900,00', vat: '10' },
    { selected: true, source: `charge:${CHARGE}`, label: 'Rabatt', amount: '-50', vat: '20' },
    // abgewählt: wird weder geprüft noch gespeichert
    { selected: false, source: '', label: '', amount: 'x', vat: '' },
  ],
  partialMode: 'percent',
  partialPercent: '',
  partialAmount: '',
  deductionIds: [],
  intro: { blockId: '', body: emptyDoc() },
  payment: { blockId: '', body: emptyDoc() },
  closing: { blockId: '', body: emptyDoc() },
  deposit: false,
  depositPercent: '',
  depositDays: '',
  dueDays: '0',
  dueBasis: 'after_invoice',
  ...o,
})

const errors = (r: ReturnType<ReturnType<typeof draftSchema>['safeParse']>) =>
  r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}=${i.message}`)

describe('draftSchema', () => {
  it('übernimmt nur angewählte Positionen mit Herkunft', () => {
    const r = draftSchema(t).parse(input())
    expect(r.lines).toEqual([
      { source: 'nights', label: 'Übernachtung', amountCents: 90_000, vatBp: 1000 },
      { source: `charge:${CHARGE}`, label: 'Rabatt', amountCents: -5_000, vatBp: 2000 },
    ])
    expect(r.recipient).toMatchObject({ country: 'AT', vatId: 'ATU123' })
    expect(r.partial).toBeNull()
    expect(r.texts.intro).toEqual({ blockId: null, body: null })
    expect(r.payment).toEqual({ depositPercent: null, depositDays: null, dueDays: 0, dueBasis: 'after_invoice' })
  })

  it('alle Positionen abgewählt: Speichern möglich (Pflichtangaben zeigen den Fehler)', () => {
    expect(draftSchema(t).safeParse(input({ lines: [] })).success).toBe(true)
  })

  it('angewählte Position ohne Betrag', () => {
    const r = draftSchema(t).safeParse(input({ lines: [{ selected: true, source: '', label: 'Extra', amount: '', vat: '20' }] }))
    expect(errors(r)).toEqual(['lines.0.amount=amountRequired'])
  })

  it('Teilrechnung: Prozent in Betrag umgerechnet', () => {
    const r = draftSchema(t, { partialBaseCents: 100_000 }).parse(input({ kind: 'partial', partialPercent: '20' }))
    expect(r.partial).toEqual({ mode: 'percent', percentBp: 2000, amountCents: 20_000 })
    expect(r.lines).toEqual([])
  })

  it('Teilrechnung: Betrag', () => {
    const r = draftSchema(t, { partialBaseCents: 100_000 }).parse(input({ kind: 'partial', partialMode: 'amount', partialAmount: '250' }))
    expect(r.partial).toEqual({ mode: 'amount', percentBp: null, amountCents: 25_000 })
  })

  it('Teilbetrag 0 oder leer → Fehler', () => {
    expect(errors(draftSchema(t, { partialBaseCents: 100_000 }).safeParse(input({ kind: 'partial', partialPercent: '' })))).toEqual(['partialPercent=partialRequired'])
    expect(errors(draftSchema(t).safeParse(input({ kind: 'partial', partialMode: 'amount', partialAmount: '0' })))).toEqual(['partialAmount=partialRequired'])
    expect(errors(draftSchema(t, { partialBaseCents: 100_000 }).safeParse(input({ kind: 'partial', partialPercent: '120' })))).toEqual([
      'partialPercent=partialPercentInvalid',
    ])
  })

  it('unbekannter Platzhalter verhindert das Speichern', () => {
    const r = draftSchema(t).safeParse(input({ intro: { blockId: '', body: docFromText('Hallo {Gastname}') } }))
    expect(errors(r)).toEqual(['intro.body=placeholder.unknown:{Gastname}'])
  })

  it('{Anzahlung} ohne Anzahlung verhindert das Speichern, mit Anzahlung nicht', () => {
    const body = docFromText('Bitte {Anzahlung} bis {Anzahlung fällig}')
    expect(errors(draftSchema(t).safeParse(input({ payment: { blockId: '', body } })))).toEqual([
      'payment.body=placeholder.depositOnly:{Anzahlung} placeholder.depositOnly:{Anzahlung fällig}',
    ])
    const ok = draftSchema(t).safeParse(input({ payment: { blockId: '', body }, deposit: true, depositPercent: '20', depositDays: '3' }))
    expect(ok.success).toBe(true)
  })

  it('Zahlungsregeln mit Grenzen aus PROJ-39', () => {
    expect(errors(draftSchema(t).safeParse(input({ dueDays: '400' })))).toEqual(['dueDays=daysRange'])
    expect(errors(draftSchema(t).safeParse(input({ deposit: true, depositPercent: '0', depositDays: '' })))).toEqual([
      'depositPercent=percentRange',
      'depositDays=daysRequired',
    ])
  })

  it('Abzüge nur bei der Schlussrechnung', () => {
    const id = '99999999-2222-3333-4444-555555555555'
    expect(draftSchema(t).parse(input({ deductionIds: [id] })).deductionIds).toEqual([])
    expect(draftSchema(t).parse(input({ kind: 'final', deductionIds: [id, id] })).deductionIds).toEqual([id])
  })
})

describe('Hilfen', () => {
  it('parsePartialPercent', () => {
    expect(parsePartialPercent('12,5')).toBe(1250)
    expect(parsePartialPercent('')).toBeNull()
    expect(parsePartialPercent('abc')).toBeNaN()
  })

  it('liveDraftPayment: unvollständige Anzahlung zählt nicht', () => {
    expect(liveDraftPayment({ deposit: true, depositPercent: '20', depositDays: '', dueDays: '14', dueBasis: 'after_invoice' })).toEqual({
      depositPercent: null,
      depositDays: null,
      dueDays: 14,
      dueBasis: 'after_invoice',
    })
  })
})
