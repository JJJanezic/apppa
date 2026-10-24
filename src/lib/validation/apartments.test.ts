import { describe, expect, it } from 'vitest'

import { apartmentSchema, NEW_PROPERTY, propertySchema, withExistingProperty } from './apartments'

const key = (k: string) => k

const base = {
  propertyId: '5b1d7a0e-0000-4000-8000-000000000001',
  name: ' Top 1 ',
  maxGuests: '4',
  kind: 'holiday' as const,
  price: '125,50',
  checkIn: '15:00',
  checkOut: '10:00',
  note: '  ',
}
const property = { name: 'Haus Seeblick', street: 'Seeweg 1', postalCode: '5340', city: 'St. Gilgen', municipalityCode: '50408' }

describe('Wohnung', () => {
  it('wandelt Preis, Personen und leere Notiz um', () => {
    const r = apartmentSchema(key).parse(base)
    expect(r).toMatchObject({ name: 'Top 1', maxGuests: 4, price: 12550, note: null })
  })

  it('erlaubt einen leeren Preis', () => {
    expect(apartmentSchema(key).parse({ ...base, price: '' }).price).toBeNull()
  })

  it('weist ungültige Werte mit Meldung je Feld ab', () => {
    const r = withExistingProperty(key).safeParse({ ...base, name: '', maxGuests: '0', price: '12,345', checkIn: '25:00' })
    expect(r.success).toBe(false)
    const fields = Object.fromEntries((r.error?.issues ?? []).map((i) => [i.path[0], i.message]))
    expect(fields).toEqual({
      name: 'apartmentNameRequired',
      maxGuests: 'guestsInvalid',
      price: 'priceInvalid',
      checkIn: 'timeInvalid',
    })
  })

  it('Preis höchstens 10.000 €', () => {
    expect(apartmentSchema(key).safeParse({ ...base, price: '10000' }).success).toBe(true)
    expect(apartmentSchema(key).safeParse({ ...base, price: '10000,01' }).success).toBe(false)
  })

  it('„Neues Objekt“ verlangt die Objektangaben', () => {
    expect(apartmentSchema(key).safeParse({ ...base, propertyId: NEW_PROPERTY }).success).toBe(false)
    expect(apartmentSchema(key).safeParse({ ...base, propertyId: 'irgendwas' }).success).toBe(false)
    expect(apartmentSchema(key).safeParse({ ...base, propertyId: NEW_PROPERTY, newProperty: property }).success).toBe(true)
  })
})

describe('Objekt', () => {
  it('verlangt vierstellige PLZ und eine gewählte Gemeinde', () => {
    expect(propertySchema(key).safeParse(property).success).toBe(true)
    const r = propertySchema(key).safeParse({ ...property, postalCode: '534', municipalityCode: '' })
    expect((r.error?.issues ?? []).map((i) => i.message).sort()).toEqual(['municipalityRequired', 'postalCodeInvalid'])
  })
})
