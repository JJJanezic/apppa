import { createFormatter } from 'next-intl'
import { describe, expect, it } from 'vitest'

import { formatDecimal } from './format'
import { LOCALE, TIME_ZONE } from './locale'

// Österreichische Formate wie im Entwurf, mit fester Zeitzone Europe/Vienna
const format = createFormatter({ locale: LOCALE, timeZone: TIME_ZONE })
const nbsp = (s: string) => s.replace(/[  ]/g, ' ')

describe('Formate de-AT', () => {
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

  it('Euro ohne und mit Cent', () => {
    expect(nbsp(format.number(17480, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }))).toBe('€ 17.480')
    expect(nbsp(format.number(1179.8, { style: 'currency', currency: 'EUR' }))).toBe('€ 1.179,80')
  })

  it('Zahlen mit Tausenderpunkt und Komma (formatDecimal)', () => {
    expect(formatDecimal(1179.8, { minimumFractionDigits: 2 })).toBe('1.179,80')
    expect(formatDecimal(145)).toBe('145')
    expect(formatDecimal(12345)).toBe('12.345')
  })

  it('Monate österreichisch', () => {
    expect(format.dateTime(new Date('2026-01-15T10:00:00Z'), { month: 'long' })).toBe('Jänner')
  })
})
