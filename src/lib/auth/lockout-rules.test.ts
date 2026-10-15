import { describe, expect, it } from 'vitest'

import { lockState } from './lockout-rules'

const now = new Date('2026-10-15T12:00:00Z')
const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000)

describe('Sperre nach Fehlversuchen', () => {
  it('bis 4 Fehlversuche keine Sperre', () => {
    expect(lockState([1, 2, 3, 4].map(minutesAgo), now)).toEqual({ locked: false })
  })

  it('5 Fehlversuche in 15 Minuten sperren für 15 Minuten ab dem letzten', () => {
    expect(lockState([0, 1, 2, 3, 4].map(minutesAgo), now)).toEqual({ locked: true, retryAfterMinutes: 15 })
    expect(lockState([5, 6, 7, 8, 9].map(minutesAgo), now)).toEqual({ locked: true, retryAfterMinutes: 10 })
  })

  it('Sperre endet 15 Minuten nach dem letzten Fehlversuch', () => {
    expect(lockState([15, 16, 17, 18, 19].map(minutesAgo), now)).toEqual({ locked: false })
  })

  it('5 Fehlversuche über mehr als 15 Minuten verteilt sperren nicht', () => {
    expect(lockState([0, 4, 8, 12, 16].map(minutesAgo), now)).toEqual({ locked: false })
  })

  it('Reihenfolge der Eingabe spielt keine Rolle; zeigt mindestens 1 Minute', () => {
    const failures = [14.9, 14.95, 14.97, 14.98, 14.99].map(minutesAgo).reverse()
    expect(lockState(failures, now)).toEqual({ locked: true, retryAfterMinutes: 1 })
  })
})
