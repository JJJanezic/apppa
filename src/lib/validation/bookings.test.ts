import { describe, expect, it } from 'vitest'

import { blockSchema, type BookingInput, bookingSchema, cancelSchema, companionsSchema } from '@/lib/validation/bookings'

const t = (key: string) => key
const TODAY = '2026-10-26'
const APARTMENT = '11111111-1111-4111-8111-111111111111'
const GUEST = '22222222-2222-4222-8222-222222222222'

const valid: BookingInput = {
  kind: 'booking',
  apartmentId: APARTMENT,
  arrival: '2026-11-01',
  plannedDeparture: '2026-11-04',
  departure: '2026-11-04',
  checkIn: '15:00',
  checkOut: '10:00',
  guestSheetNumber: '',
  residenceRegistered: false,
  source: 'none',
  sourceCustom: '',
  guestMode: 'existing',
  guestId: GUEST,
  adults: '2',
  children: [{ age: '4' }],
  optionUntil: '',
  nightsPrice: '360',
  nightsVat: '10,00',
  charges: [{ label: 'Reinigung', amount: '60', vat: '10,00' }],
  note: '',
}

const messages = (input: unknown, owner = true) => {
  const result = bookingSchema(t, { owner, today: TODAY }).safeParse(input)
  return result.success ? [] : result.error.issues.map((i) => `${i.path.join('.')}:${i.message}`)
}

describe('Buchung', () => {
  it('nimmt eine gültige Buchung an und rechnet in Cent', () => {
    const result = bookingSchema(t, { owner: true, today: TODAY }).parse(valid)
    expect(result).toMatchObject({
      guestId: GUEST,
      adults: 2,
      childAges: [4],
      optionUntil: null,
      amounts: { nightsCents: 36000, nightsVatBp: 1000, charges: [{ label: 'Reinigung', amountCents: 6000, vatBp: 1000 }] },
      note: null,
    })
  })

  it('verlangt Pflichtfelder beim leeren Formular', () => {
    const empty = { ...valid, apartmentId: '', arrival: '', plannedDeparture: '', departure: '', guestId: '', nightsPrice: '' }
    expect(messages(empty)).toEqual(
      expect.arrayContaining([
        'apartmentId:apartmentRequired',
        'arrival:arrivalRequired',
        'plannedDeparture:plannedDepartureRequired',
        'departure:departureRequired',
        'nightsPrice:nightsPriceRequired',
      ])
    )
  })

  it('prüft den Zeitraum', () => {
    expect(messages({ ...valid, departure: '2026-11-01' })).toContain('departure:departureBeforeArrival')
    expect(messages({ ...valid, departure: '2027-11-02' })).toContain('departure:tooManyNights')
    expect(messages({ ...valid, arrival: '2029-12-01', plannedDeparture: '2029-12-03', departure: '2029-12-03' })).toEqual(['arrival:arrivalTooFar'])
    // Nachtragen vergangener Buchungen ist erlaubt
    expect(messages({ ...valid, arrival: '2025-01-01', plannedDeparture: '2025-01-03', departure: '2025-01-03' })).toEqual([])
  })

  it('prüft geplante und tatsächliche Abreise je für sich (PROJ-30)', () => {
    expect(messages({ ...valid, plannedDeparture: '2026-10-31' })).toEqual(['plannedDeparture:plannedDepartureBeforeArrival'])
    expect(messages({ ...valid, departure: '2026-11-01' })).toEqual(['departure:departureBeforeArrival'])
    // frühere und spätere tatsächliche Abreise sind erlaubt
    expect(messages({ ...valid, departure: '2026-11-02' })).toEqual([])
    expect(messages({ ...valid, departure: '2026-11-08' })).toEqual([])
    const result = bookingSchema(t, { owner: true, today: TODAY }).parse({ ...valid, departure: '2026-11-05' })
    expect(result).toMatchObject({ plannedDeparture: '2026-11-04', departure: '2026-11-05' })
  })

  it('Gästeblattnummer: optional, höchstens 30 Zeichen, ohne Rand-Leerzeichen (PROJ-30)', () => {
    const parse = (guestSheetNumber: string) => bookingSchema(t, { owner: true, today: TODAY }).parse({ ...valid, guestSheetNumber }).guestSheetNumber
    expect(parse('')).toBeNull()
    expect(parse('   ')).toBeNull()
    expect(parse(' A-123 ')).toBe('A-123')
    expect(messages({ ...valid, guestSheetNumber: 'x'.repeat(30) })).toEqual([])
    expect(messages({ ...valid, guestSheetNumber: 'x'.repeat(31) })).toEqual(['guestSheetNumber:guestSheetNumberTooLong'])
  })

  it('Buchungsquelle: Freitext Pflicht bei „Eigene Angabe“, sonst verworfen (PROJ-30)', () => {
    expect(messages({ ...valid, source: 'custom', sourceCustom: '  ' })).toEqual(['sourceCustom:sourceCustomRequired'])
    expect(messages({ ...valid, source: 'custom', sourceCustom: 'x'.repeat(101) })).toEqual(['sourceCustom:tooLong'])
    expect(messages({ ...valid, source: 'airbnb' })).toHaveLength(1)
    const parse = (input: Partial<BookingInput>) => bookingSchema(t, { owner: true, today: TODAY }).parse({ ...valid, ...input })
    expect(parse({ source: 'custom', sourceCustom: ' Messe ' })).toMatchObject({ source: 'custom', sourceCustom: 'Messe' })
    expect(parse({ source: 'booking_com', sourceCustom: 'Messe' })).toMatchObject({ source: 'booking_com', sourceCustom: null })
    expect(parse({ residenceRegistered: true })).toMatchObject({ residenceRegistered: true })
  })

  it('verlangt einen Gast und mindestens einen Erwachsenen', () => {
    expect(messages({ ...valid, guestId: '' })).toContain('guestId:guestRequired')
    expect(messages({ ...valid, guestMode: 'new', guestId: '' })).toEqual([])
    expect(messages({ ...valid, adults: '0' })).toContain('adults:adultsInvalid')
  })

  it('prüft das Alter der Kinder (0–17)', () => {
    expect(messages({ ...valid, children: [{ age: '' }] })).toContain('children.0.age:childAgeInvalid')
    expect(messages({ ...valid, children: [{ age: '18' }] })).toContain('children.0.age:childAgeInvalid')
    expect(messages({ ...valid, children: [{ age: '0' }] })).toEqual([])
  })

  it('verlangt bei Optionen ein Ablaufdatum ab heute', () => {
    expect(messages({ ...valid, kind: 'option', optionUntil: '' })).toContain('optionUntil:optionUntilRequired')
    expect(messages({ ...valid, kind: 'option', optionUntil: '2026-10-25' })).toContain('optionUntil:optionUntilPast')
    expect(messages({ ...valid, kind: 'option', optionUntil: TODAY })).toEqual([])
    expect(messages({ ...valid, kind: 'option', optionUntil: '2029-12-01' })).toContain('optionUntil:optionUntilTooFar')
  })

  it('Check-in- und Check-out-Zeit sind optional, aber im Format hh:mm (BUG-2)', () => {
    const result = bookingSchema(t, { owner: true, today: TODAY }).parse({ ...valid, checkIn: '', checkOut: '' })
    expect(result).toMatchObject({ checkIn: null, checkOut: null })
    expect(messages({ ...valid, checkIn: '25:00' })).toContain('checkIn:timeInvalid')
  })

  it('prüft Beträge und Zusatzkosten nur für Inhaber', () => {
    expect(messages({ ...valid, nightsPrice: 'abc' })).toContain('nightsPrice:amountInvalid')
    expect(messages({ ...valid, charges: [{ label: '', amount: '--5' }] })).toEqual(
      expect.arrayContaining(['charges.0.label:chargeLabelRequired', 'charges.0.amount:amountInvalid'])
    )
    // Mitarbeiter: kein Preis nötig, Beträge werden nicht übernommen
    const staff = bookingSchema(t, { owner: false, today: TODAY }).parse({ ...valid, nightsPrice: '' })
    expect(staff.amounts).toBeNull()
  })
})

describe('Sperre', () => {
  const block = { apartmentId: APARTMENT, arrival: '2026-11-01', departure: '2026-11-03', reason: 'renovation' as const, note: '' }

  it('nimmt eine gültige Sperre an', () => {
    expect(blockSchema(t, { today: TODAY }).safeParse(block).success).toBe(true)
  })

  it('verlangt bei „Sonstiges“ eine Notiz', () => {
    const result = blockSchema(t, { today: TODAY }).safeParse({ ...block, reason: 'other' })
    expect(result.success ? [] : result.error.issues.map((i) => i.message)).toContain('blockNoteRequired')
  })
})

describe('Mitreisende', () => {
  const person = { firstName: 'Max', lastName: 'Huber', birthDate: '1985-03-12' }

  it('erlaubt höchstens Personen minus Hauptgast', () => {
    expect(companionsSchema(t, { max: 1, today: TODAY }).safeParse({ companions: [person] }).success).toBe(true)
    expect(companionsSchema(t, { max: 1, today: TODAY }).safeParse({ companions: [person, person] }).success).toBe(false)
  })

  it('verlangt Vor- und Nachnamen; Geburtsdatum optional, nicht in der Zukunft', () => {
    const issues = (c: object) => {
      const r = companionsSchema(t, { max: 3, today: TODAY }).safeParse({ companions: [c] })
      return r.success ? [] : r.error.issues.map((i) => i.message)
    }
    expect(issues({ ...person, firstName: ' ' })).toContain('firstNameRequired')
    expect(issues({ ...person, birthDate: '' })).toEqual([])
    expect(issues({ ...person, birthDate: '2026-10-27' })).toContain('birthDateFuture')
  })
})

describe('Storno', () => {
  it('Grund und Gebühr sind optional', () => {
    expect(cancelSchema(t).parse({ reason: '', fee: '', feeVat: '0,00' })).toEqual({ reason: null, fee: null, feeVat: 0 })
    expect(cancelSchema(t).parse({ reason: 'Krankheit', fee: '50', feeVat: '20' })).toEqual({ reason: 'Krankheit', fee: 5000, feeVat: 2000 })
    expect(cancelSchema(t).safeParse({ reason: '', fee: 'x' }).success).toBe(false)
  })

  it('lehnt eine negative Stornogebühr ab (PROJ-32)', () => {
    expect(cancelSchema(t).safeParse({ reason: '', fee: '-50', feeVat: '0' }).success).toBe(false)
  })
})

describe('Negative Zusatzkosten (PROJ-32)', () => {
  const parse = (input: Partial<BookingInput>) => bookingSchema(t, { owner: true, today: TODAY }).parse({ ...valid, ...input })

  it('nimmt negative Positionen an, Endbetrag darf unter 0 fallen', () => {
    expect(parse({ nightsPrice: '100', charges: [{ label: 'Gutschrift', amount: '-150', vat: '20' }] }).amounts).toMatchObject({
      nightsCents: 10000,
      charges: [{ label: 'Gutschrift', amountCents: -15000 }],
    })
    expect(parse({ charges: [{ label: 'Rabatt', amount: '-1.000.000,00', vat: '20' }] }).amounts?.charges[0].amountCents).toBe(-100000000)
  })

  it('meldet Beträge unter -1.000.000,00 und kaputte Minus-Eingaben', () => {
    for (const amount of ['-1.000.000,01', '-', '--5', '5-'])
      expect(messages({ ...valid, charges: [{ label: 'Rabatt', amount, vat: '20' }] })).toEqual(['charges.0.amount:amountInvalid'])
  })

  it('lehnt einen negativen Übernachtungspreis ab', () => {
    expect(messages({ ...valid, nightsPrice: '-50' })).toEqual(['nightsPrice:amountInvalid'])
  })
})

describe('Umsatzsteuersatz (PROJ-35)', () => {
  const parse = (input: Partial<BookingInput>) => bookingSchema(t, { owner: true, today: TODAY }).parse({ ...valid, ...input })

  it('liest Sätze mit Komma, Punkt und Prozentzeichen', () => {
    const r = parse({ nightsVat: '13', charges: [{ label: 'Parkplatz', amount: '30', vat: '5,5 %' }] })
    expect(r.amounts).toMatchObject({ nightsVatBp: 1300, charges: [{ vatBp: 550 }] })
    expect(parse({ nightsVat: '0', charges: [{ label: 'Abgabe', amount: '12', vat: '100' }] }).amounts).toMatchObject({
      nightsVatBp: 0,
      charges: [{ vatBp: 10000 }],
    })
  })

  it('meldet leere, ungültige und zu genaue Sätze am Feld', () => {
    expect(messages({ ...valid, nightsVat: '' })).toEqual(['nightsVat:vatRequired'])
    for (const vat of ['abc', '-1', '100,01', '10,555'])
      expect(messages({ ...valid, nightsVat: vat, charges: [{ label: 'X', amount: '1', vat }] })).toEqual([
        'charges.0.vat:vatInvalid',
        'nightsVat:vatInvalid',
      ])
    expect(messages({ ...valid, charges: [{ label: 'X', amount: '1', vat: '' }] })).toEqual(['charges.0.vat:vatRequired'])
  })

  it('Mitarbeiter: Satz der Übernachtung wird nicht geprüft', () => {
    expect(bookingSchema(t, { owner: false, today: TODAY }).safeParse({ ...valid, nightsPrice: '', nightsVat: '' }).success).toBe(true)
  })

  it('Stornogebühr: Satz Pflicht und gültig', () => {
    expect(cancelSchema(t).safeParse({ reason: '', fee: '', feeVat: '' }).success).toBe(false)
    expect(cancelSchema(t).safeParse({ reason: '', fee: '50', feeVat: '101' }).success).toBe(false)
  })
})
