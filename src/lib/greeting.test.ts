import { describe, expect, it } from 'vitest'

import { greetingFor, hourIn } from './greeting'

// Zeitpunkte in UTC; Wien ist im Oktober UTC+2 (Sommerzeit), im Jänner UTC+1
describe('Begrüßung nach Tageszeit (Europe/Vienna)', () => {
  it('rechnet die Stunde in Wiener Zeit, nicht in Serverzeit', () => {
    expect(hourIn(new Date('2026-10-05T04:30:00Z'))).toBe(6)
    expect(hourIn(new Date('2026-01-15T04:30:00Z'))).toBe(5)
  })

  it.each([
    ['2026-10-05T03:00:00Z', 'greetingMorning'], // 05:00
    ['2026-10-05T08:59:00Z', 'greetingMorning'], // 10:59
    ['2026-10-05T09:00:00Z', 'greetingDay'], // 11:00
    ['2026-10-05T15:59:00Z', 'greetingDay'], // 17:59
    ['2026-10-05T16:00:00Z', 'greetingEvening'], // 18:00
    ['2026-10-05T22:30:00Z', 'greetingEvening'], // 00:30
    ['2026-10-05T02:59:00Z', 'greetingEvening'], // 04:59
  ])('%s → %s', (iso, expected) => {
    expect(greetingFor(new Date(iso))).toBe(expected)
  })

  it('um Mitternacht UTC ist es in Wien schon der nächste Tag – Begrüßung „Guten Abend“', () => {
    expect(greetingFor(new Date('2026-10-05T23:00:00Z'))).toBe('greetingEvening')
  })
})
