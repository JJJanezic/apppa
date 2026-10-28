import { describe, expect, it } from 'vitest'

import { apartmentSchema, NEW_PROPERTY, propertySchema, withExistingProperty } from './apartments'

const key = (k: string) => k

const base = {
  propertyId: '5b1d7a0e-0000-4000-8000-000000000001',
  name: ' Top 1 ',
  maxGuests: '4',
  maxAdults: '',
  kind: 'holiday' as const,
  priceMode: 'apartment' as const,
  price: '125,50',
  adultPrice: '',
  childPrices: [] as { toAge: string; price: string }[],
  cleaningFee: '',
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

  it('liest die Reinigungsgebühr (PROJ-8), leer = keine', () => {
    expect(apartmentSchema(key).parse(base).cleaningFee).toBeNull()
    expect(apartmentSchema(key).parse({ ...base, cleaningFee: '60' }).cleaningFee).toBe(6000)
    expect(apartmentSchema(key).safeParse({ ...base, cleaningFee: 'x' }).success).toBe(false)
  })

  it('lehnt negative Preise und Gebühren weiterhin ab (PROJ-32)', () => {
    for (const input of [
      { price: '-50' },
      { cleaningFee: '-60' },
      { priceMode: 'person' as const, price: '', adultPrice: '-40' },
      { priceMode: 'person' as const, price: '', adultPrice: '40', childPrices: [{ toAge: '5', price: '−10' }] },
    ])
      expect(apartmentSchema(key).safeParse({ ...base, ...input }).success).toBe(false)
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

describe('Kapazität und Personenpreise (PROJ-27)', () => {
  const issues = (input: object) =>
    (withExistingProperty(key).safeParse({ ...base, ...input }).error?.issues ?? []).map((i) => `${i.path.join('.')}:${i.message}`)

  it('Erwachsenen-Grenze optional, 1 bis Personenzahl', () => {
    expect(apartmentSchema(key).parse(base).maxAdults).toBeNull()
    expect(apartmentSchema(key).parse({ ...base, maxAdults: '2' }).maxAdults).toBe(2)
    expect(issues({ maxAdults: '0' })).toContain('maxAdults:adultsInvalid')
    expect(issues({ maxAdults: '5' })).toContain('maxAdults:adultsTooMany')
  })

  it('Personenpreise verlangen den Erwachsenenpreis; Wohnungspreis-Felder bleiben unabhängig', () => {
    expect(issues({ priceMode: 'person', adultPrice: '' })).toContain('adultPrice:adultPriceRequired')
    const r = apartmentSchema(key).parse({ ...base, priceMode: 'person', adultPrice: '50', childPrices: [{ toAge: '2', price: '0' }] })
    expect(r).toMatchObject({ priceMode: 'person', adultPrice: 5000, price: 12550, childPrices: [{ toAge: '2', price: 0 }] })
  })

  it('Kinderstufen: Alter 0–17 aufsteigend, Preis Pflicht (0 = gratis), höchstens 3', () => {
    const tiers = (...t: [string, string][]) => ({ priceMode: 'person', adultPrice: '50', childPrices: t.map(([toAge, price]) => ({ toAge, price })) })
    expect(issues(tiers(['2', '0'], ['11', '20']))).toEqual([])
    expect(issues(tiers(['18', '10']))).toContain('childPrices.0.toAge:childAgeInvalid')
    expect(issues(tiers(['11', '20'], ['2', '0']))).toContain('childPrices.1.toAge:childAgesAscending')
    expect(issues(tiers(['2', '0'], ['2', '5']))).toContain('childPrices.1.toAge:childAgesAscending')
    expect(issues(tiers(['2', '']))).toContain('childPrices.0.price:childPriceRequired')
    expect(issues(tiers(['1', '0'], ['5', '0'], ['9', '0'], ['12', '0'])).length).toBeGreaterThan(0)
  })
})

describe('Objekt', () => {
  it('verlangt vierstellige PLZ und eine gewählte Gemeinde', () => {
    expect(propertySchema(key).safeParse(property).success).toBe(true)
    const r = propertySchema(key).safeParse({ ...property, postalCode: '534', municipalityCode: '' })
    expect((r.error?.issues ?? []).map((i) => i.message).sort()).toEqual(['municipalityRequired', 'postalCodeInvalid'])
  })
})
