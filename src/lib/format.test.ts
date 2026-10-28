import { createFormatter } from 'next-intl'
import { describe, expect, it } from 'vitest'

import {
  formatCents,
  formatCurrency,
  formatDate,
  formatDatePlain,
  formatDateTime,
  formatDayOfMonth,
  formatNumber,
  formatPercent,
  formatPeriod,
  formatWeekday,
} from './format'
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

  it('Euro immer mit zwei Nachkommastellen (PROJ-31)', () => {
    expect(plain(formatCurrency(17480))).toBe('€ 17.480,00')
    expect(plain(formatCurrency(1179.8))).toBe('€ 1.179,80')
    expect(plain(formatCurrency(1234567.5))).toBe('€ 1.234.567,50')
    expect(plain(formatCents(36000))).toBe('€ 360,00')
    expect(plain(formatCents(0))).toBe('€ 0,00')
    expect(plain(formatCents(100000000))).toBe('€ 1.000.000,00')
  })

  it('kein Leerzeichen als Tausendertrenner', () => {
    for (const s of [formatNumber(1234567), formatPercent(123.45), formatCurrency(1234567)]) {
      expect(s).not.toMatch(/\d[   ]\d/)
    }
  })
})

describe('Datum einheitlich (PROJ-31)', () => {
  it('Standard: Wochentag mit 2 Buchstaben, Beistrich, TT.MM.JJJJ', () => {
    expect(formatDate('2026-10-28')).toBe('Mi, 28.10.2026')
    expect(formatDate('2026-11-03')).toBe('Di, 03.11.2026')
    expect(['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07'].map(formatWeekday)).toEqual([
      'So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa',
    ])
  })

  it('Jahreswechsel und Schalttag', () => {
    expect(formatPeriod('2026-12-30', '2027-01-02')).toBe('Mi, 30.12.2026 – Sa, 02.01.2027')
    expect(formatDate('2028-02-29')).toBe('Di, 29.02.2028')
  })

  it('ohne Wochentag und enge Stellen', () => {
    expect(formatDatePlain('1978-05-15')).toBe('15.05.1978')
    expect(formatDayOfMonth('2026-11-03')).toBe('3')
  })

  it('Zeitpunkte in Wiener Zeit, auch über Mitternacht und Sommerzeit', () => {
    expect(formatDateTime('2026-10-27T13:35:00Z')).toBe('Di, 27.10.2026, 14:35')
    expect(formatDateTime('2026-07-14T22:30:00Z')).toBe('Mi, 15.07.2026, 00:30')
    expect(formatDate('2026-10-05T22:30:00Z')).toBe('Di, 06.10.2026')
    expect(formatDate(new Date('2026-10-28T08:00:00Z'))).toBe('Mi, 28.10.2026')
  })
})
