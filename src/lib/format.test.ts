import { createFormatter } from 'next-intl'
import { describe, expect, it } from 'vitest'

import { formatCurrency, formatNumber, formatPercent } from './format'
import { LOCALE, TIME_ZONE } from './locale'

// Österreichische Formate wie im Entwurf, mit fester Zeitzone Europe/Vienna
const format = createFormatter({ locale: LOCALE, timeZone: TIME_ZONE })
const plain = (s: string) => s.replace(/[  ]/g, ' ')

describe('Datum de-AT', () => {
  it('Datum wie im Seitenkopf', () => {
    const d = new Date('2026-10-05T08:00:00Z')
    expect(format.dateTime(d, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })).toBe(
      'Montag, 5. Oktober 2026'
    )
  })

  it('Datum kurz nach Mitternacht Wiener Zeit gehört zum neuen Tag', () => {
    const d = new Date('2026-10-05T22:30:00Z')
    expect(format.dateTime(d, { day: 'numeric', month: 'long' })).toBe('6. Oktober')
  })

  it('Monate österreichisch', () => {
    expect(format.dateTime(new Date('2026-01-15T10:00:00Z'), { month: 'long' })).toBe('Jänner')
  })
})

describe('Zahlen: Tausenderpunkt immer', () => {
  it.each([
    [145, '145'],
    [1234, '1.234'],
    [12345, '12.345'],
    [1234567, '1.234.567'],
    [-1234, '-1.234'],
  ])('formatNumber(%s) → %s', (value, expected) => {
    expect(formatNumber(value)).toBe(expected)
  })

  it('Dezimalstellen mit Komma', () => {
    expect(formatNumber(1179.8, { minimumFractionDigits: 2 })).toBe('1.179,80')
  })

  it('Prozent', () => {
    expect(plain(formatPercent(0.58))).toBe('58 %')
    expect(plain(formatPercent(12.345))).toBe('1.235 %')
  })

  it('Euro ohne und mit Cent', () => {
    expect(plain(formatCurrency(17480))).toBe('€ 17.480')
    expect(plain(formatCurrency(1179.8, { cents: true }))).toBe('€ 1.179,80')
    expect(plain(formatCurrency(1234567.5, { cents: true }))).toBe('€ 1.234.567,50')
  })

  it('kein Leerzeichen als Tausendertrenner', () => {
    for (const s of [formatNumber(1234567), formatPercent(123.45), formatCurrency(1234567)]) {
      expect(s).not.toMatch(/\d[   ]\d/)
    }
  })
})
