import { describe, expect, it } from 'vitest'

import { EMPTY_GUEST_INPUT, guestSchema } from './guests'

const schema = guestSchema((key) => key)
const valid = { ...EMPTY_GUEST_INPUT, lastName: 'Huber', country: 'AT' }
const errors = (input: Partial<typeof valid>) => {
  const result = schema.safeParse({ ...valid, ...input })
  return result.success ? [] : result.error.issues.map((i) => i.message)
}

describe('guestSchema', () => {
  it('verlangt nur Nachname und Herkunftsland', () => {
    const result = schema.parse(valid)
    expect(result.lastName).toBe('Huber')
    expect(result.firstName).toBeNull()
    expect(result.email).toBeNull()
    expect(result.marketingSource).toBeNull()
    expect(result.marketingCustom).toBeNull()
  })

  it('meldet fehlenden Nachnamen und fehlendes Land', () => {
    expect(errors({ lastName: '  ', country: '' })).toEqual(['lastNameRequired', 'countryRequired'])
  })

  it('lehnt unbekannte Ländercodes ab', () => {
    expect(errors({ country: 'XX' })).toEqual(['countryRequired'])
  })

  it('prüft das E-Mail-Format und speichert Kleinbuchstaben', () => {
    expect(errors({ email: 'keine-adresse' })).toEqual(['emailInvalid'])
    expect(schema.parse({ ...valid, email: ' Anna@Example.AT ' }).email).toBe('anna@example.at')
  })

  it('prüft die Telefonnummer grob', () => {
    expect(errors({ phone: 'abc' })).toEqual(['phoneInvalid'])
    expect(errors({ phone: '+43 (664) 123-45 67' })).toEqual([])
  })

  it('lehnt Geburtsdaten in der Zukunft ab', () => {
    expect(errors({ birthDate: '2999-01-01' })).toEqual(['birthDateFuture'])
    expect(errors({ birthDate: '1988-04-17' })).toEqual([])
    expect(errors({ birthDate: '1800-01-01' })).toEqual(['birthDateInvalid'])
  })

  it('übernimmt eine Standard-Quelle ohne Freitext', () => {
    const result = schema.parse({ ...valid, marketing: 'instagram', marketingCustom: 'egal' })
    expect(result.marketingSource).toBe('instagram')
    expect(result.marketingCustom).toBeNull()
  })

  it('übernimmt eine eigene Angabe; leerer Freitext gilt als keine Angabe', () => {
    expect(schema.parse({ ...valid, marketing: 'custom', marketingCustom: ' Messe Graz 2026 ' }).marketingCustom).toBe('Messe Graz 2026')
    const empty = schema.parse({ ...valid, marketing: 'custom', marketingCustom: '' })
    expect(empty.marketingSource).toBeNull()
    expect(empty.marketingCustom).toBeNull()
  })

  it('begrenzt die Notiz auf 2.000 Zeichen', () => {
    expect(errors({ note: 'x'.repeat(2001) })).toEqual(['tooLong'])
  })
})
