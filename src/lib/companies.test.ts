import { describe, expect, it } from 'vitest'

import {
  type Company,
  companyDetailLine,
  companyListHref,
  defaultCompanyMergeChoice,
  parseCompanyFilters,
  sameCompanyMergeValue,
  websiteHref,
} from './companies'

const company = (over: Partial<Company> = {}): Company => ({
  id: '00000000-0000-4000-8000-0000000000c1',
  name: 'Muster GmbH',
  nameMissing: false,
  vatId: null,
  addressLine1: null,
  addressLine2: null,
  postalCode: null,
  city: null,
  country: null,
  email: null,
  website: null,
  contact: null,
  updatedAt: '2026-11-08T10:00:00Z',
  guestCount: 0,
  ...over,
})

describe('companyDetailLine (PROJ-50)', () => {
  it('zeigt UID, „PLZ Ort“ und Adresszeile 1', () => {
    expect(companyDetailLine({ vatId: 'ATU12345678', postalCode: '1010', city: 'Wien', addressLine1: 'Hauptstraße 1' })).toBe(
      'ATU12345678 · 1010 Wien · Hauptstraße 1'
    )
  })

  it('lässt leere Teile ohne Trennzeichen weg', () => {
    expect(companyDetailLine({ vatId: null, postalCode: null, city: 'Wien', addressLine1: null })).toBe('Wien')
    expect(companyDetailLine({ vatId: null, postalCode: null, city: null, addressLine1: null })).toBe('')
  })
})

describe('websiteHref', () => {
  it('ergänzt https:// und lässt http(s) unverändert', () => {
    expect(websiteHref('www.firma.at')).toBe('https://www.firma.at')
    expect(websiteHref('http://firma.at')).toBe('http://firma.at')
    expect(websiteHref('HTTPS://firma.at')).toBe('HTTPS://firma.at')
  })

  it('liefert für andere Schemata und Leeres keinen Link', () => {
    expect(websiteHref('javascript:alert(1)')).toBeNull()
    expect(websiteHref('mailto:a@b.at')).toBeNull()
    expect(websiteHref('  ')).toBeNull()
  })
})

describe('Filter der Firmenliste', () => {
  it('liest Suche und Seite aus der Adresse', () => {
    expect(parseCompanyFilters({ q: ' muster ', seite: '3' })).toEqual({ query: 'muster', page: 3 })
    expect(parseCompanyFilters({ seite: 'x' })).toEqual({ query: '', page: 1 })
  })

  it('baut die Adresse ohne Standardwerte', () => {
    expect(companyListHref({ query: '', page: 1 })).toBe('/gaeste/firmen')
    expect(companyListHref({ query: 'muster gmbh', page: 2 })).toBe('/gaeste/firmen?q=muster+gmbh&seite=2')
  })
})

describe('Firmen zusammenführen', () => {
  it('wählt die Rechnungsadresse als Ganzes', () => {
    const a = company({ city: 'Wien', addressLine1: 'Ring 1' })
    expect(sameCompanyMergeValue(a, company({ city: 'Wien', addressLine1: 'Ring 1' }), 'address')).toBe(true)
    expect(sameCompanyMergeValue(a, company({ city: 'Wien', addressLine1: 'Ring 2' }), 'address')).toBe(false)
  })

  it('nimmt Werte von B, wenn A leer ist oder nur den Platzhalternamen trägt', () => {
    const choice = defaultCompanyMergeChoice(
      company({ name: 'Firma ohne Namen', nameMissing: true, vatId: 'ATU1' }),
      company({ name: 'Muster GmbH', email: 'office@muster.at' })
    )
    expect(choice).toEqual({ name: 'b', vatId: 'a', address: 'a', email: 'b', website: 'a', contact: 'a' })
  })
})
