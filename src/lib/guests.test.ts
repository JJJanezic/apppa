import { describe, expect, it } from 'vitest'

import {
  addressLines,
  companyAddressLines,
  countryName,
  countryOptions,
  defaultMergeChoice,
  duplicateReasons,
  type Guest,
  guestDisplayName,
  guestListHref,
  guestSortName,
  hasCompany,
  isPlatformRelayEmail,
  languageName,
  parseGuestFilters,
  phoneDigits,
  privateAddressLines,
  sameMergeValue,
  searchKey,
} from './guests'

const guest = (over: Partial<Guest> = {}): Guest => ({
  id: '00000000-0000-4000-8000-000000000001',
  lastName: 'Huber',
  firstName: 'Anna',
  country: 'AT',
  email: null,
  emailSource: 'direct',
  phone: null,
  phoneSource: 'direct',
  language: null,
  birthDate: null,
  street: null,
  postalCode: null,
  city: null,
  addressCountry: null,
  marketingSource: null,
  marketingCustom: null,
  company: null,
  note: null,
  titlePrefix: null,
  titleSuffix: null,
  gender: 'unspecified',
  documentType: null,
  documentNumber: null,
  documentIssuedOn: null,
  documentAuthority: null,
  documentCountry: null,
  documentFrontPath: null,
  documentBackPath: null,
  documentImages: {},
  anonymizedAt: null,
  updatedAt: '2026-10-20T09:00:00.000Z',
  stays: { count: 0, bookings: 0, invoices: 0, last: null, next: null, channels: [] },
  ...over,
})

describe('Namen', () => {
  it('zeigt „Nachname, Vorname“ in Listen und „Vorname Nachname“ in Überschriften', () => {
    expect(guestSortName({ lastName: 'Huber', firstName: 'Anna' })).toBe('Huber, Anna')
    expect(guestDisplayName({ lastName: 'Huber', firstName: 'Anna' })).toBe('Anna Huber')
  })

  it('kommt ohne Vornamen aus (z. B. „Familie Berger“)', () => {
    expect(guestSortName({ lastName: 'Familie Berger', firstName: null })).toBe('Familie Berger')
    expect(guestDisplayName({ lastName: 'Familie Berger', firstName: null })).toBe('Familie Berger')
  })
  it('Listen: Nachname zuerst, dann Titel und Vorname, nachgestellter Titel am Ende (PROJ-29)', () => {
    expect(guestSortName({ lastName: 'Huber', firstName: 'Anna', titlePrefix: 'Dr.', titleSuffix: 'LL.M.' })).toBe('Huber, Dr. Anna, LL.M.')
    expect(guestSortName({ lastName: 'Huber', firstName: null, titlePrefix: 'Dr.', titleSuffix: null })).toBe('Huber, Dr.')
    expect(guestSortName({ lastName: 'Huber', firstName: null, titlePrefix: null, titleSuffix: 'MSc' })).toBe('Huber, MSc')
    expect(guestSortName({ lastName: 'Huber', firstName: 'Anna', titlePrefix: null, titleSuffix: 'MSc' })).toBe('Huber, Anna, MSc')
  })

  it('stellt akademische Grade voran bzw. nach (PROJ-29)', () => {
    expect(guestDisplayName({ lastName: 'Huber', firstName: 'Anna', titlePrefix: 'Dr.', titleSuffix: 'LL.M.' })).toBe('Dr. Anna Huber, LL.M.')
    expect(guestDisplayName({ lastName: 'Huber', firstName: null, titlePrefix: null, titleSuffix: 'MSc' })).toBe('Huber, MSc')
    expect(guestDisplayName({ lastName: 'Huber', firstName: null, titlePrefix: 'DI Dr.', titleSuffix: null })).toBe('DI Dr. Huber')
  })
})

describe('searchKey', () => {
  it('ignoriert Groß-/Kleinschreibung und Akzente', () => {
    expect(searchKey('René MÜLLER')).toBe('rene muller')
    expect(searchKey('Søren Łukasz')).toBe('soren lukasz')
    expect(searchKey('Straße')).toBe('strasse')
  })

  it('fasst Leerraum zusammen', () => {
    expect(searchKey('  Anna   Huber ')).toBe('anna huber')
  })
})

describe('phoneDigits', () => {
  it('behält nur Ziffern', () => {
    expect(phoneDigits('+43 (664) 123-45 67')).toBe('436641234567')
  })
})

describe('isPlatformRelayEmail', () => {
  it('erkennt Relay-Adressen von booking.com und Airbnb', () => {
    expect(isPlatformRelayEmail('a.huber-4821@guest.booking.com')).toBe(true)
    expect(isPlatformRelayEmail('x@guest.airbnb.com')).toBe(true)
    expect(isPlatformRelayEmail('anna@booking.com')).toBe(false)
    expect(isPlatformRelayEmail('anna.huber@example.at')).toBe(false)
  })
})

describe('duplicateReasons', () => {
  const a = { lastName: 'Huber', firstName: 'Anna', email: null, phone: null }

  it('findet gleiche E-Mail ohne Groß-/Kleinschreibung', () => {
    expect(duplicateReasons({ ...a, email: 'Anna@Example.at' }, { ...a, firstName: 'X', email: 'anna@example.at' })).toEqual(['email'])
  })

  it('ignoriert Relay-Adressen der Plattformen', () => {
    const relay = 'abc@guest.booking.com'
    expect(duplicateReasons({ ...a, firstName: 'X', email: relay }, { ...a, email: relay })).toEqual([])
  })

  it('vergleicht Telefonnummern über die Ziffern (ab 6 Ziffern)', () => {
    expect(duplicateReasons({ ...a, firstName: 'X', phone: '+43 664 123456' }, { ...a, phone: '+43664123456' })).toEqual(['phone'])
    expect(duplicateReasons({ ...a, firstName: 'X', phone: '123' }, { ...a, phone: '123' })).toEqual([])
  })

  it('findet gleichen Vor- und Nachnamen, aber nicht bei fehlendem Vornamen', () => {
    expect(duplicateReasons(a, { ...a, firstName: 'anna', lastName: 'HUBER' })).toEqual(['name'])
    expect(duplicateReasons({ ...a, firstName: null }, { ...a, firstName: null })).toEqual([])
  })
})

describe('Länder und Sprachen', () => {
  it('liefert deutsche Namen über die eingebaute Sprachfunktion', () => {
    expect(countryName('AT')).toBe('Österreich')
    expect(countryName('DE')).toBe('Deutschland')
    expect(languageName('it')).toBe('Italienisch')
  })

  it('stellt häufige Länder vor die übrigen und doppelt keine', () => {
    const { common, others } = countryOptions()
    expect(common[0].code).toBe('AT')
    expect(others.some((c) => c.code === 'AT')).toBe(false)
    expect(others.length).toBeGreaterThan(150)
  })
})

describe('Filter in der Adresse', () => {
  it('liest gültige Werte und ignoriert ungültige', () => {
    expect(parseGuestFilters({ q: ' huber ', land: 'de', quelle: 'instagram', sortierung: 'aufenthalt', seite: '3' })).toEqual({
      query: 'huber',
      country: 'DE',
      marketing: 'instagram',
      sort: 'lastStay',
      page: 3,
    })
    expect(parseGuestFilters({ land: 'XX', quelle: 'tiktok', seite: '-2' })).toEqual({
      query: '',
      country: null,
      marketing: null,
      sort: 'name',
      page: 1,
    })
  })

  it('baut die Adresse ohne Standardwerte', () => {
    expect(guestListHref({ query: '', sort: 'name', page: 1 })).toBe('/gaeste')
    expect(guestListHref({ query: 'anna', country: 'AT', marketing: 'custom', sort: 'lastStay', page: 2 })).toBe(
      '/gaeste?q=anna&land=AT&quelle=custom&sortierung=aufenthalt&seite=2'
    )
  })
})

describe('Zusammenführen', () => {
  it('erkennt gleiche Angaben', () => {
    expect(sameMergeValue(guest(), guest({ id: 'b' }), 'name')).toBe(true)
    expect(sameMergeValue(guest({ email: 'a@x.at' }), guest({ email: 'b@x.at' }), 'email')).toBe(false)
  })

  it('wählt vorab den Wert von A, außer A ist leer', () => {
    const choice = defaultMergeChoice(guest({ phone: '+43 1' }), guest({ email: 'anna@example.at', phone: '+43 2' }))
    expect(choice.email).toBe('b')
    expect(choice.phone).toBe('a')
    expect(choice.name).toBe('a')
  })
  it('wählt das Reisedokument als Ganzes und das Geschlecht nur, wenn angegeben (PROJ-29)', () => {
    const doc = { documentType: 'passport', documentNumber: 'P1' } as const
    expect(sameMergeValue(guest(doc), guest({ ...doc, documentFrontPath: 'x' }), 'document')).toBe(false)
    const choice = defaultMergeChoice(guest(), guest({ ...doc, gender: 'female' }))
    expect(choice.document).toBe('b')
    expect(choice.gender).toBe('b')
    expect(defaultMergeChoice(guest({ gender: 'male' }), guest({ gender: 'female' })).gender).toBe('a')
  })
})

// Firma eines Gastes (PROJ-50: verknüpfte Firma statt Felder am Gast)
const company = (over: Partial<NonNullable<Guest['company']>> = {}): NonNullable<Guest['company']> => ({
  id: '00000000-0000-4000-8000-0000000000c1',
  name: 'Muster GmbH',
  nameMissing: false,
  vatId: null,
  addressLine1: null,
  addressLine2: null,
  postalCode: null,
  city: null,
  country: null,
  ...over,
})

describe('Anschrift als Zeilen (PROJ-33, PROJ-50)', () => {
  it('zeigt Zeile 1, Zeile 2, „PLZ Ort“ und Staat der Firma untereinander', () => {
    const g = guest({ company: company({ addressLine1: 'Musterstraße 1', addressLine2: 'Top 5', postalCode: '1010', city: 'Wien', country: 'AT' }) })
    expect(companyAddressLines(g)).toEqual(['Musterstraße 1', 'Top 5', '1010 Wien', 'Österreich'])
  })

  it('lässt leere Teile ohne Leerzeilen weg', () => {
    expect(companyAddressLines(guest({ company: company({ city: 'Wien' }) }))).toEqual(['Wien'])
    expect(companyAddressLines(guest({ company: company({ country: 'DE' }) }))).toEqual(['Deutschland'])
    expect(companyAddressLines(guest({ company: company() }))).toEqual([])
    expect(companyAddressLines(guest())).toEqual([])
    expect(addressLines({ lines: [null, ''], postalCode: '1010', city: null, country: null })).toEqual(['1010'])
  })

  it('formatiert die Privatadresse gleich', () => {
    expect(privateAddressLines(guest({ street: 'Hauptplatz 2', postalCode: '8010', city: 'Graz' }))).toEqual(['Hauptplatz 2', '8010 Graz'])
  })

  it('zeigt den Abschnitt Firma, sobald eine Firma verknüpft ist', () => {
    expect(hasCompany(guest())).toBe(false)
    expect(hasCompany(guest({ company: company() }))).toBe(true)
  })

  it('wählt beim Zusammenführen die Verknüpfung als Ganzes', () => {
    const a = guest({ company: company() })
    expect(sameMergeValue(a, guest({ id: 'b', company: company() }), 'company')).toBe(true)
    expect(sameMergeValue(a, guest({ id: 'b', company: company({ id: '00000000-0000-4000-8000-0000000000c2' }) }), 'company')).toBe(false)
    expect(defaultMergeChoice(guest(), guest({ id: 'b', company: company() })).company).toBe('b')
    expect(defaultMergeChoice(a, guest({ id: 'b' })).company).toBe('a')
  })
})
