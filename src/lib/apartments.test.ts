import { describe, expect, it } from 'vitest'

import {
  type Apartment,
  apartmentLabel,
  municipalitySearchKey,
  parsePriceCents,
  priceInput,
  type Property,
  sameName,
  stateOfMunicipality,
  visibleProperties,
} from './apartments'

describe('Gemeinde-Suchname', () => {
  it('findet St./Sankt, Umlaute und Satzzeichen gleichermaßen', () => {
    expect(municipalitySearchKey('St. Gilgen')).toBe('sankt gilgen')
    expect(municipalitySearchKey('Sankt Gilgen')).toBe('sankt gilgen')
    expect(municipalitySearchKey('Mönchhof')).toBe('moenchhof')
    expect(municipalitySearchKey('Großarl')).toBe('grossarl')
    expect(municipalitySearchKey('Zell am See')).toBe('zell am see')
    expect(municipalitySearchKey('St.Johann im Pongau')).toBe('st johann im pongau')
  })

  it('ändert Wörter, die nur mit „st“ beginnen, nicht', () => {
    expect(municipalitySearchKey('Stainz')).toBe('stainz')
    expect(municipalitySearchKey('Steyr')).toBe('steyr')
  })
})

describe('Bundesland aus der Gemeindekennziffer', () => {
  it('liest die erste Ziffer', () => {
    expect(stateOfMunicipality('50408')).toBe('salzburg')
    expect(stateOfMunicipality('90001')).toBe('wien')
    expect(stateOfMunicipality('00001')).toBeNull()
  })
})

describe('Preis', () => {
  it('liest Euro mit Komma oder Punkt in Cent', () => {
    expect(parsePriceCents('125')).toBe(12500)
    expect(parsePriceCents('125,5')).toBe(12550)
    expect(parsePriceCents('99.99')).toBe(9999)
    expect(parsePriceCents(' ')).toBeNull()
    expect(parsePriceCents('12,345')).toBeNaN()
    expect(parsePriceCents('-5')).toBeNaN()
  })

  it('zeigt Cent wieder als Eingabe', () => {
    expect(priceInput(12500)).toBe('125')
    expect(priceInput(12550)).toBe('125,50')
    expect(priceInput(null)).toBe('')
  })
})

describe('Anzeige und Namen', () => {
  it('„Objekt · Wohnung“', () => {
    expect(apartmentLabel('Haus Seeblick', 'Top 1')).toBe('Haus Seeblick · Top 1')
  })

  it('vergleicht ohne Groß-/Kleinschreibung und Rand-Leerzeichen', () => {
    expect(sameName(' top 1 ', 'Top 1')).toBe(true)
    expect(sameName('Top 1', 'Top 2')).toBe(false)
  })
})

describe('Sichtbare Objekte', () => {
  const apt = (id: string, archived: boolean): Apartment => ({
    id,
    propertyId: 'p',
    name: id,
    maxGuests: 2,
    maxAdults: null,
    kind: 'holiday',
    priceMode: 'apartment',
    priceCents: null,
    adultPriceCents: null,
    childPrices: [],
    cleaningFeeCents: null,
    checkIn: '15:00',
    checkOut: '10:00',
    note: null,
    archivedAt: archived ? '2026-10-24T10:00:00Z' : null,
    hasBookings: false,
    futureStays: [],
  })
  const prop = (id: string, apartments: Apartment[]): Property => ({
    id,
    name: id,
    street: 'Weg 1',
    postalCode: '5340',
    city: 'St. Gilgen',
    municipality: { code: '50408', name: 'St. Gilgen', state: 'salzburg' },
    apartments,
  })

  it('blendet archivierte Wohnungen und Objekte nur mit archivierten aus', () => {
    const list = [prop('a', [apt('1', false), apt('2', true)]), prop('b', [apt('3', true)]), prop('c', [])]
    const visible = visibleProperties(list, false)
    expect(visible.map((p) => p.id)).toEqual(['a', 'c'])
    expect(visible[0].apartments.map((a) => a.id)).toEqual(['1'])
    expect(visibleProperties(list, true)).toHaveLength(3)
  })
})
