import { describe, expect, it } from 'vitest'

import { formatCents } from '@/lib/format'
import {
  allowedPlaceholders,
  docPlaceholderIssues,
  fillPlaceholders,
  paymentFigures,
  placeholderIssues,
  placeholderValues,
  salutation,
  SAMPLE_TEXT_CONTEXT,
  sortTextBlocks,
} from '@/lib/invoice-texts'
import { docFromText } from '@/lib/rich-text'

const common = ['Anrede', 'Gast', 'Wohnung', 'Anreise', 'Abreise', 'Nächte', 'Rechnungsnummer', 'Rechnungsdatum', 'Betrag']

describe('allowedPlaceholders', () => {
  it('Einleitung und Abschluss: nur die allgemeinen', () => {
    expect(allowedPlaceholders({ kind: 'intro', deposit: false })).toEqual(common)
    expect(allowedPlaceholders({ kind: 'closing', deposit: true })).toEqual(common)
  })

  it('Zahlungsmodalitäten: Fälligkeit, mit Anzahlung auch die Anzahlungs-Platzhalter', () => {
    expect(allowedPlaceholders({ kind: 'payment', deposit: false })).toEqual([...common, 'Fälligkeitsdatum'])
    expect(allowedPlaceholders({ kind: 'payment', deposit: true })).toEqual([
      ...common,
      'Fälligkeitsdatum',
      'Anzahlung',
      'Anzahlung fällig',
      'Restbetrag',
    ])
  })

  it('feste Texte: keine', () => {
    expect(allowedPlaceholders('fixed')).toEqual([])
  })
})

describe('placeholderIssues', () => {
  it('meldet unbekannte, hier unzulässige und anzahlungsgebundene Platzhalter', () => {
    expect(placeholderIssues('Hallo {Gastname}, {Wohnung}', { kind: 'intro', deposit: false })).toEqual([
      { token: '{Gastname}', problem: 'unknown' },
    ])
    expect(placeholderIssues('bis {Fälligkeitsdatum}', { kind: 'intro', deposit: false })).toEqual([
      { token: '{Fälligkeitsdatum}', problem: 'notHere' },
    ])
    expect(placeholderIssues('{Anzahlung} bis {Anzahlung fällig}', { kind: 'payment', deposit: false })).toEqual([
      { token: '{Anzahlung}', problem: 'depositOnly' },
      { token: '{Anzahlung fällig}', problem: 'depositOnly' },
    ])
    expect(placeholderIssues('{Anzahlung}', { kind: 'payment', deposit: true })).toEqual([])
  })

  it('in festen Texten gilt jeder Platzhalter als unbekannt', () => {
    expect(placeholderIssues('IBAN {Wohnung}', 'fixed')).toEqual([{ token: '{Wohnung}', problem: 'unknown' }])
  })

  it('jeder Platzhalter nur einmal, auch über Absätze', () => {
    const doc = docFromText('{X} und {X}\n\n{X}')
    expect(docPlaceholderIssues(doc, { kind: 'intro', deposit: false })).toEqual([{ token: '{X}', problem: 'unknown' }])
  })
})

describe('salutation', () => {
  const g = { lastName: 'Huber', firstName: 'Maria', titlePrefix: 'Dr.', titleSuffix: null }
  it('Frau, Herr, sonst neutral mit Vorname', () => {
    expect(salutation({ ...g, gender: 'female' })).toBe('Sehr geehrte Frau Dr. Huber')
    expect(salutation({ ...g, gender: 'male', titlePrefix: null })).toBe('Sehr geehrter Herr Huber')
    expect(salutation({ ...g, gender: 'unspecified', titlePrefix: null })).toBe('Sehr geehrte/r Maria Huber')
  })
})

describe('paymentFigures', () => {
  it('20 % binnen 3 Tagen, Rest 1 Tag vor Anreise', () => {
    expect(
      paymentFigures({ depositPercent: 20, depositDays: 3, dueDays: 1, dueBasis: 'before_arrival' }, 45000, '2026-10-01', '2026-10-14')
    ).toEqual({ depositCents: 9000, depositDue: '2026-10-04', remainderCents: 36000, due: '2026-10-13' })
  })

  it('ohne Anzahlung: Fälligkeit nach Rechnungsdatum', () => {
    expect(paymentFigures({ depositPercent: null, depositDays: null, dueDays: 14, dueBasis: 'after_invoice' }, 45000, '2026-10-01', '2026-10-14')).toEqual({
      depositCents: null,
      depositDue: null,
      remainderCents: null,
      due: '2026-10-15',
    })
  })

  it('rundet auf Cent; 100 % ergibt Rest 0', () => {
    expect(paymentFigures({ depositPercent: 33.33, depositDays: 0, dueDays: 0, dueBasis: 'after_invoice' }, 10001, '2026-10-01', '2026-10-14').depositCents).toBe(3333)
    expect(paymentFigures({ depositPercent: 100, depositDays: 0, dueDays: 0, dueBasis: 'after_invoice' }, 45000, '2026-10-01', '2026-10-14').remainderCents).toBe(0)
  })
})

describe('placeholderValues / fillPlaceholders', () => {
  it('füllt die Beispieldaten ohne Wochentag; unbekannte bleiben stehen', () => {
    const values = placeholderValues({
      ...SAMPLE_TEXT_CONTEXT,
      invoiceNumber: '2026-0012',
      payment: { depositPercent: 20, depositDays: 3, dueDays: 1, dueBasis: 'before_arrival' },
    })
    expect(
      fillPlaceholders('{Anrede}, {Wohnung} vom {Anreise} bis {Abreise}: {Anzahlung} bis {Anzahlung fällig}, Rest {Restbetrag} bis {Fälligkeitsdatum}. {Gastname}', values)
    ).toBe(
      `Sehr geehrte Frau Mag. Muster, Top 1 vom 14.10.2026 bis 17.10.2026: ${formatCents(9000)} bis 04.10.2026, Rest ${formatCents(36000)} bis 13.10.2026. {Gastname}`
    )
    // Betrag wie PROJ-31: „€ 90,00“ (geschütztes Leerzeichen)
    expect(formatCents(9000).replace(/\s/g, ' ')).toBe('€ 90,00')
  })
})

describe('sortTextBlocks', () => {
  it('Standard zuerst, dann nach Name', () => {
    const blocks = [
      { name: 'b', isDefault: false },
      { name: 'Z', isDefault: true },
      { name: 'A', isDefault: false },
    ]
    expect(sortTextBlocks(blocks).map((b) => b.name)).toEqual(['Z', 'A', 'b'])
  })
})
