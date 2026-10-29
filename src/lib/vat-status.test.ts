import { describe, expect, it } from 'vitest'

import {
  isPlannedChange,
  sortVatStatus,
  vatStatusDay,
  vatStatusForBooking,
  vatStatusFromRows,
  vatStatusOn,
  type VatStatusChange,
} from '@/lib/vat-status'

const KU_FROM_JULY: VatStatusChange[] = [{ validFrom: '2026-07-01', smallBusiness: true }]
const TWO_SWITCHES: VatStatusChange[] = [
  { validFrom: '2026-08-15', smallBusiness: false },
  { validFrom: '2026-01-01', smallBusiness: true },
]

describe('vatStatusOn', () => {
  it('ohne Einträge gilt „mit Umsatzsteuer“', () => {
    expect(vatStatusOn([], '2026-10-29')).toEqual({ smallBusiness: false, since: null })
  })

  it('vor dem Stichtag gilt der Ausgangszustand, am Stichtag der neue Status', () => {
    expect(vatStatusOn(KU_FROM_JULY, '2026-06-30')).toEqual({ smallBusiness: false, since: null })
    expect(vatStatusOn(KU_FROM_JULY, '2026-07-01')).toEqual({ smallBusiness: true, since: '2026-07-01' })
  })

  it('mehrere Wechsel: der jüngste Eintrag am oder vor dem Tag gilt, unabhängig von der Reihenfolge', () => {
    expect(vatStatusOn(TWO_SWITCHES, '2026-08-10').smallBusiness).toBe(true)
    expect(vatStatusOn(TWO_SWITCHES, '2026-08-20')).toEqual({ smallBusiness: false, since: '2026-08-15' })
    expect(vatStatusOn([...TWO_SWITCHES].reverse(), '2026-08-20').since).toBe('2026-08-15')
  })

  it('gleicher Status hintereinander ist ohne Wirkung', () => {
    const same: VatStatusChange[] = [
      { validFrom: '2026-01-01', smallBusiness: true },
      { validFrom: '2026-05-01', smallBusiness: true },
    ]
    expect(vatStatusOn(same, '2026-06-01').smallBusiness).toBe(true)
  })

  it('erster Eintrag „mit Umsatzsteuer“ ändert nichts am Ausgangszustand', () => {
    expect(vatStatusOn([{ validFrom: '2026-01-01', smallBusiness: false }], '2026-06-01').smallBusiness).toBe(false)
  })
})

describe('vatStatusForBooking', () => {
  it('maßgeblich ist die Abreise; ein Aufenthalt über den Stichtag gilt als Ganzes', () => {
    expect(vatStatusForBooking(KU_FROM_JULY, { departure: '2026-06-30' }).smallBusiness).toBe(false)
    expect(vatStatusForBooking(KU_FROM_JULY, { departure: '2026-07-03' }).smallBusiness).toBe(true)
  })

  it('bei Storno zählt der Stornotag', () => {
    const booking = { departure: '2026-08-20', cancelledAt: '2026-08-05T09:00:00Z' }
    expect(vatStatusForBooking(TWO_SWITCHES, booking).smallBusiness).toBe(true)
    expect(vatStatusForBooking(TWO_SWITCHES, { departure: '2026-08-20', cancelledAt: null }).smallBusiness).toBe(false)
  })

  it('Stornotag in österreichischer Zeit: 23:30 am 31.07. zählt als 31.07.', () => {
    // 21:30 UTC = 23:30 Sommerzeit Wien
    expect(vatStatusDay({ departure: '2026-09-01', cancelledAt: '2026-07-31T21:30:00Z' })).toBe('2026-07-31')
    // 22:30 UTC = 00:30 am Folgetag
    expect(vatStatusDay({ departure: '2026-09-01', cancelledAt: '2026-07-31T22:30:00Z' })).toBe('2026-08-01')
  })
})

describe('Liste', () => {
  it('Zeilen aus der Datenbank, neueste zuerst', () => {
    expect(
      vatStatusFromRows([
        { valid_from: '2026-01-01', small_business: true },
        { valid_from: '2026-08-15', small_business: false },
      ])
    ).toEqual(TWO_SWITCHES)
    expect(sortVatStatus([])).toEqual([])
  })

  it('künftige Einträge sind „geplant“, der heutige nicht', () => {
    expect(isPlannedChange({ validFrom: '2027-01-01' }, '2026-10-29')).toBe(true)
    expect(isPlannedChange({ validFrom: '2026-10-29' }, '2026-10-29')).toBe(false)
  })
})
