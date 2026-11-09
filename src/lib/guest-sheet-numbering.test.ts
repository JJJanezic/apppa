import { describe, expect, it } from 'vitest'

import {
  canIssueSheet,
  checkRange,
  countBetween,
  incrementSheetNumber,
  inRange,
  numberingState,
  parseSheetNumber,
  sameSheetNumber,
} from '@/lib/guest-sheet-numbering'

// Dieselben Paare prüft der Integrationstest gegen die Regel der Datenbank
const INCREMENT_CASES: [string, string][] = [
  ['0042', '0043'],
  ['0099', '0100'],
  ['A-0099', 'A-0100'],
  ['9999', '10000'],
  ['1', '2'],
  ['2026/0017', '2026/0018'],
  ['b.009', 'b.010'],
]

describe('parseSheetNumber', () => {
  it('zerlegt in Vorsatz und Ziffern am Ende', () => {
    expect(parseSheetNumber('A-0042')).toEqual({ prefix: 'A-', digits: '0042', value: BigInt(42) })
    expect(parseSheetNumber(' 0007 ')).toEqual({ prefix: '', digits: '0007', value: BigInt(7) })
  })

  it('lehnt Nummern ohne Ziffer am Ende, Leerzeichen, andere Zeichen und zu lange ab', () => {
    expect(parseSheetNumber('12A')).toBeNull()
    expect(parseSheetNumber('')).toBeNull()
    expect(parseSheetNumber('A 12')).toBeNull()
    expect(parseSheetNumber('A_12')).toBeNull()
    expect(parseSheetNumber('1'.repeat(31))).toBeNull()
  })
})

describe('incrementSheetNumber', () => {
  it.each(INCREMENT_CASES)('%s → %s', (from, to) => {
    expect(incrementSheetNumber(from)).toBe(to)
  })

  it('liefert null bei ungültiger Nummer', () => {
    expect(incrementSheetNumber('12A')).toBeNull()
  })
})

describe('sameSheetNumber', () => {
  it('ignoriert Groß-/Kleinschreibung, nicht aber führende Nullen', () => {
    expect(sameSheetNumber('a-0042', 'A-0042')).toBe(true)
    expect(sameSheetNumber('042', '0042')).toBe(false)
  })
})

describe('inRange und countBetween', () => {
  it('prüft Vorsatz und Zahlenwert', () => {
    const range = { from: 'B-0001', to: 'B-0100' }
    expect(inRange('b-0050', range)).toBe(true)
    expect(inRange('B-0101', range)).toBe(false)
    expect(inRange('0050', range)).toBe(false)
  })

  it('zählt die Nummern einschließlich der Grenzen', () => {
    expect(countBetween('0001', '0500')).toBe(500)
    expect(countBetween('0042', '0042')).toBe(1)
    expect(countBetween('0043', '0042')).toBe(0)
  })
})

describe('checkRange', () => {
  it('nimmt einen gültigen Bereich an', () => {
    expect(checkRange({ from: '0001', to: '0500', next: '0042' }, [])).toBeNull()
  })

  it('meldet ungültige Grenzen, anderen Vorsatz und von > bis', () => {
    expect(checkRange({ from: '12A', to: '0500' }, [])).toEqual({ field: 'from', issue: 'fromInvalid' })
    expect(checkRange({ from: '0001', to: '' }, [])).toEqual({ field: 'to', issue: 'toInvalid' })
    expect(checkRange({ from: 'A-0001', to: 'B-0500' }, [])).toEqual({ field: 'to', issue: 'prefixDiffers' })
    expect(checkRange({ from: '0500', to: '0001' }, [])).toEqual({ field: 'to', issue: 'fromAfterTo' })
  })

  it('meldet Überschneidungen nur bei gleichem Vorsatz', () => {
    const others = [{ from: '0001', to: '0500' }]
    expect(checkRange({ from: '0400', to: '0600' }, others)).toEqual({ field: 'from', issue: 'overlaps' })
    expect(checkRange({ from: '0501', to: '0600' }, others)).toBeNull()
    expect(checkRange({ from: 'B-0001', to: 'B-0500' }, others)).toBeNull()
  })

  it('prüft die nächste Nummer und die zuletzt vergebene', () => {
    expect(checkRange({ from: '0001', to: '0500', next: '0501' }, [])).toEqual({ field: 'next', issue: 'nextOutside' })
    expect(checkRange({ from: '0001', to: '0500', next: 'x' }, [])).toEqual({ field: 'next', issue: 'nextInvalid' })
    expect(checkRange({ from: '0001', to: '0040' }, [], '0042')).toEqual({ field: 'to', issue: 'toBelowUsed' })
  })
})

describe('numberingState und canIssueSheet', () => {
  it('leitet den Zustand aus den freien Nummern ab', () => {
    expect(numberingState(0, false)).toBe('unset')
    expect(numberingState(0, true)).toBe('exhausted')
    expect(numberingState(10, true)).toBe('low')
    expect(numberingState(11, true)).toBe('ok')
  })

  it('erlaubt das Blatt mit vorhandener Nummer oder freier Nummer', () => {
    expect(canIssueSheet('0007', 'exhausted')).toBe(true)
    expect(canIssueSheet(null, 'low')).toBe(true)
    expect(canIssueSheet(null, 'unset')).toBe(false)
    expect(canIssueSheet(null, null)).toBe(false)
  })
})
