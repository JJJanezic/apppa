import { describe, expect, it } from 'vitest'

import {
  DEFAULT_NUMBERING,
  formatInvoiceNumber,
  nextInvoiceNumber,
  type NumberingSettings,
  parseInvoiceNumber,
  sameNumbering,
} from '@/lib/invoice-numbering'

const fmt = (over: Partial<NumberingSettings> = {}): NumberingSettings => ({ ...DEFAULT_NUMBERING, ...over })
const TODAY = '2026-10-31'

describe('formatInvoiceNumber', () => {
  it('baut Präfix, Jahr, Trennzeichen und laufende Nummer zusammen', () => {
    expect(formatInvoiceNumber(fmt(), 2026, 12)).toBe('2026-0012')
    expect(formatInvoiceNumber(fmt({ prefix: 'R-', separator: '/' }), 2026, 12)).toBe('R-2026/0012')
    expect(formatInvoiceNumber(fmt({ prefix: 'R-', withYear: false, yearlyReset: false, digits: 5 }), 2026, 123)).toBe('R-00123')
    expect(formatInvoiceNumber(fmt({ separator: '' }), 2026, 7)).toBe('20260007')
  })

  it('wächst über die Stellenzahl hinaus', () => {
    expect(formatInvoiceNumber(fmt({ digits: 3 }), 2026, 1000)).toBe('2026-1000')
  })
})

describe('parseInvoiceNumber', () => {
  it('erkennt nur Nummern im Format, auch mit anderer Stellenzahl', () => {
    expect(parseInvoiceNumber(fmt(), '2026-0042')).toEqual({ year: 2026, seq: 42 })
    expect(parseInvoiceNumber(fmt(), '2026-12')).toEqual({ year: 2026, seq: 12 })
    expect(parseInvoiceNumber(fmt(), 'ALT-17')).toBeNull()
    expect(parseInvoiceNumber(fmt(), '2026/0042')).toBeNull()
    expect(parseInvoiceNumber(fmt(), '2026-00a1')).toBeNull()
  })

  it('vergleicht das Präfix ohne Rücksicht auf Groß-/Kleinschreibung', () => {
    expect(parseInvoiceNumber(fmt({ prefix: 'R-' }), 'r-2026-0005')).toEqual({ year: 2026, seq: 5 })
  })

  it('ohne Jahreszahl: Präfix + Ziffern; Nummern mit Jahreszahl zählen nicht', () => {
    const s = fmt({ prefix: 'R-', withYear: false, yearlyReset: false, digits: 5 })
    expect(parseInvoiceNumber(s, 'R-00123')).toEqual({ year: null, seq: 123 })
    expect(parseInvoiceNumber(s, 'R-2026-0001')).toBeNull()
  })

  it('Sonderzeichen im Präfix wirken nicht als Muster', () => {
    expect(parseInvoiceNumber(fmt({ prefix: 'R.' }), 'RX2026-0001')).toBeNull()
    expect(parseInvoiceNumber(fmt({ prefix: 'R.' }), 'R.2026-0001')).toEqual({ year: 2026, seq: 1 })
  })
})

describe('nextInvoiceNumber', () => {
  it('ohne Rechnungen: Startnummer im Format', () => {
    expect(nextInvoiceNumber(fmt(), [], TODAY)).toEqual({ number: '2026-0001', startIgnored: false })
  })

  it('höchste passende Nummer + 1, unabhängig von der Startnummer', () => {
    const s = fmt({ startNumber: 100, startYear: 2026 })
    expect(nextInvoiceNumber(s, ['2026-0041', '2026-0042'], TODAY)).toEqual({ number: '2026-0043', startIgnored: true })
  })

  it('fremde Formate zählen nicht; dann gilt die Startnummer', () => {
    expect(nextInvoiceNumber(fmt({ startNumber: 7, startYear: 2026 }), ['ALT-17'], TODAY).number).toBe('2026-0007')
  })

  it('jährlich neu: das Vorjahr zählt nicht, die Folge beginnt bei 1', () => {
    expect(nextInvoiceNumber(fmt(), ['2025-0118'], TODAY).number).toBe('2026-0001')
  })

  it('jährlich neu: Startnummer nur im Jahr, in dem sie eingetragen wurde', () => {
    expect(nextInvoiceNumber(fmt({ startNumber: 50, startYear: 2026 }), ['2025-0118'], TODAY).number).toBe('2026-0050')
    expect(nextInvoiceNumber(fmt({ startNumber: 50, startYear: 2025 }), [], '2026-01-05').number).toBe('2026-0001')
  })

  it('nicht jährlich neu: Folge läuft über die Jahre weiter', () => {
    const s = fmt({ yearlyReset: false })
    expect(nextInvoiceNumber(s, ['2025-0118'], TODAY).number).toBe('2026-0119')
  })

  it('ohne Jahreszahl mit Präfix und 5 Stellen', () => {
    const s = fmt({ prefix: 'R-', withYear: false, yearlyReset: false, digits: 5 })
    expect(nextInvoiceNumber(s, ['R-00123', 'R-00009', '2026-0500'], TODAY).number).toBe('R-00124')
  })

  it('3 Stellen: nach 999 folgt 1000', () => {
    expect(nextInvoiceNumber(fmt({ digits: 3 }), ['2026-999'], TODAY).number).toBe('2026-1000')
  })
})

describe('sameNumbering', () => {
  it('ignoriert das Jahr der Startnummer', () => {
    expect(sameNumbering(fmt({ startYear: 2025 }), fmt({ startYear: 2026 }))).toBe(true)
    expect(sameNumbering(fmt(), fmt({ digits: 5 }))).toBe(false)
  })
})
