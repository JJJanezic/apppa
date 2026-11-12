import { describe, expect, it } from 'vitest'

import {
  dropMissingPlaces,
  EMPTY_FILTERS,
  fileNamePart,
  filtersOf,
  hasAnyFilter,
  marketingExportHref,
  marketingFileName,
  marketingHref,
  phoneCell,
  parseMarketingView,
  parseSegmentFilters,
  reachOf,
  salutation,
  sameFilters,
} from '@/lib/marketing'

const A = '11111111-1111-4111-8111-111111111111'
const B = '22222222-2222-4222-8222-222222222222'

describe('Marketing-Filter in der Adresse (PROJ-52)', () => {
  it('liest alle Filter und schreibt sie unverändert zurück', () => {
    const view = parseMarketingView({
      von: '2026-06',
      bis: '2026-08',
      aufenthalte: '2',
      objekt: A,
      wohnung: B,
      quelle: 'website,booking_com',
      land: 'DE,AT',
      sprache: 'de,none',
      erreichbar: 'email',
      segment: A,
      seite: '3',
    })
    expect(view).toEqual({
      from: '2026-06',
      to: '2026-08',
      minStays: 2,
      properties: [A],
      apartments: [B],
      sources: ['website', 'booking_com'],
      countries: ['DE', 'AT'],
      languages: ['de', 'none'],
      reach: 'email',
      segment: A,
      page: 3,
    })
    expect(parseMarketingView(Object.fromEntries(new URL(`http://x${marketingHref(view)}`).searchParams))).toEqual(view)
  })

  it('verwirft Unbekanntes und Unsinniges', () => {
    const view = parseMarketingView({ von: '2026-13', bis: 'x', aufenthalte: '0', objekt: 'kein-uuid', quelle: 'fax', land: 'XX', sprache: 'tlh', erreichbar: 'brief', seite: '-1' })
    expect(filtersOf(view)).toEqual(EMPTY_FILTERS)
    expect(view.page).toBe(1)
    expect(parseMarketingView({ aufenthalte: '11' }).minStays).toBeNull()
  })

  it('„bis“ vor „von“ zählt nicht', () => {
    expect(parseMarketingView({ von: '2026-08', bis: '2026-06' })).toMatchObject({ from: '2026-08', to: null })
  })

  it('ohne Filter ist die Adresse leer; der Export trägt keine Seite', () => {
    expect(marketingHref({ ...EMPTY_FILTERS, page: 1 })).toBe('/marketing')
    expect(hasAnyFilter(EMPTY_FILTERS)).toBe(false)
    const view = parseMarketingView({ land: 'DE', seite: '4' })
    expect(marketingExportHref(view)).toBe('/api/marketing/csv?land=DE')
  })
})

describe('Segmente (PROJ-52)', () => {
  it('gleiche Filter unabhängig von der Reihenfolge', () => {
    const a = { ...EMPTY_FILTERS, countries: ['DE', 'AT'] }
    expect(sameFilters(a, { ...EMPTY_FILTERS, countries: ['AT', 'DE'] })).toBe(true)
    expect(sameFilters(a, { ...EMPTY_FILTERS, countries: ['AT'] })).toBe(false)
    expect(sameFilters(a, { ...a, reach: 'post' })).toBe(false)
  })

  it('liest gespeicherte Filter und lässt Unbekanntes weg', () => {
    expect(parseSegmentFilters({ from: '2026-06', minStays: 2, countries: ['DE', 'ZZ'], reach: 'post', extra: 1 })).toEqual({
      ...EMPTY_FILTERS,
      from: '2026-06',
      minStays: 2,
      countries: ['DE'],
      reach: 'post',
    })
    expect(parseSegmentFilters(null)).toEqual(EMPTY_FILTERS)
  })

  it('entfernt Objekte und Wohnungen, die es nicht mehr gibt', () => {
    const f = { ...EMPTY_FILTERS, properties: [A], apartments: [A, B] }
    expect(dropMissingPlaces(f, { properties: new Set([A]), apartments: new Set([B]) })).toEqual({
      filters: { ...f, apartments: [B] },
      dropped: true,
    })
    expect(dropMissingPlaces(f, { properties: new Set([A]), apartments: new Set([A, B]) }).dropped).toBe(false)
  })
})

describe('Export (PROJ-52)', () => {
  it('Anrede aus dem Geschlecht', () => {
    expect(salutation('female')).toBe('Frau')
    expect(salutation('male')).toBe('Herr')
    expect(salutation('diverse')).toBe('')
    expect(salutation(null)).toBe('')
  })

  it('Dateiname gaeste_[Kunde]_[JJJJ-MM-TT_HH-MM].csv in Wiener Zeit', () => {
    expect(marketingFileName('Pichler Ferienwohnungen', new Date('2026-11-12T13:30:00Z'))).toBe('gaeste_Pichler-Ferienwohnungen_2026-11-12_14-30.csv')
    // Sommerzeit
    expect(marketingFileName('Gästehaus Müller', new Date('2026-07-01T22:05:00Z'))).toBe('gaeste_Gästehaus-Müller_2026-07-02_00-05.csv')
    expect(fileNamePart('A/B: C*D?  "E"')).toBe('A-B-C-D-E')
    expect(fileNamePart('  ')).toBe('Kunde')
  })

  it('Telefonnummern ohne Hochkomma, alles andere gegen Formeln geschützt (QA BUG-2)', () => {
    expect(phoneCell('+43 1 234')).toBe('+43 1 234')
    expect(phoneCell('+49 (0)30 123-45/6')).toBe('+49 (0)30 123-45/6')
    expect(phoneCell('0664 1234567')).toBe('0664 1234567')
    expect(phoneCell('-5+5')).toBe("'-5+5")
    expect(phoneCell('+1;=cmd')).toBe(`"'+1;=cmd"`)
    expect(phoneCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`)
    expect(phoneCell(null)).toBe('')
  })

  it('erreichbar per E-Mail bzw. Post (Anschrift: Straße und PLZ oder Ort)', () => {
    expect(reachOf({ email: 'a@b.at', street: null, postalCode: null, city: null })).toEqual({ email: true, post: false })
    expect(reachOf({ email: null, street: 'Weg 1', postalCode: null, city: 'Graz' })).toEqual({ email: false, post: true })
    expect(reachOf({ email: null, street: 'Weg 1', postalCode: null, city: null })).toEqual({ email: false, post: false })
  })
})
