import { describe, expect, it } from 'vitest'

import {
  DEFAULT_MARKETING_TEXT,
  DEFAULT_PRIVACY_TEXT,
  emptyPlaceholders,
  filledTexts,
  guestSheetExpected,
  guestSheetListUrl,
  needsTravelDocument,
  parseGuestSheetFilters,
  type SheetGuest,
  sheetComplete,
  sheetDeparture,
  sheetGaps,
  sheetPlaceholderValues,
} from '@/lib/guest-sheet'
import { docPlaceholderIssues } from '@/lib/invoice-texts'
import { docPlainText } from '@/lib/rich-text'

const guest = (over: Partial<SheetGuest> = {}): SheetGuest => ({
  lastName: 'Huber',
  firstName: 'Anna',
  titlePrefix: null,
  titleSuffix: null,
  gender: 'female',
  birthDate: '1980-05-01',
  country: 'AT',
  documentType: null,
  documentNumber: null,
  documentIssuedOn: null,
  documentAuthority: null,
  documentCountry: null,
  street: 'Hauptplatz 1',
  postalCode: '6020',
  city: 'Innsbruck',
  addressCountry: 'AT',
  documentFrontPath: null,
  documentBackPath: null,
  ...over,
})

const companion = { lastName: 'Huber', firstName: 'Max', birthDate: '2015-03-02' }

describe('Gästeblatt vorgesehen', () => {
  it('nur bei Buchungen, nicht storniert, ohne „Wohnsitz angemeldet“', () => {
    expect(guestSheetExpected({ kind: 'booking', cancelledAt: null, residenceRegistered: false })).toBe(true)
    expect(guestSheetExpected({ kind: 'option', cancelledAt: null, residenceRegistered: false })).toBe(false)
    expect(guestSheetExpected({ kind: 'block', cancelledAt: null, residenceRegistered: false })).toBe(false)
    expect(guestSheetExpected({ kind: 'booking', cancelledAt: '2026-11-01T10:00:00Z', residenceRegistered: false })).toBe(false)
    expect(guestSheetExpected({ kind: 'booking', cancelledAt: null, residenceRegistered: true })).toBe(false)
  })
})

describe('Pflichtangaben', () => {
  it('vollständiger österreichischer Gast ohne Mitreisende', () => {
    const gaps = sheetGaps(guest(), [], 1)
    expect(gaps).toEqual({ guest: [], companions: [], companionsMissing: 0, companionsTooMany: false })
    expect(sheetComplete(gaps)).toBe(true)
  })

  it('fehlendes Geburtsdatum und leere Adresse werden markiert', () => {
    const gaps = sheetGaps(guest({ birthDate: null, street: ' ', postalCode: null }), [], 1)
    expect(gaps.guest).toEqual(['birthDate', 'street', 'postalCode'])
    expect(sheetComplete(gaps)).toBe(false)
  })

  it('„keine Angabe“ beim Geschlecht zählt als Angabe', () => {
    expect(sheetGaps(guest({ gender: 'unspecified' }), [], 1).guest).toEqual([])
  })

  it('Reisedokument nur bei Staatsangehörigkeit nicht Österreich', () => {
    expect(needsTravelDocument({ country: 'AT' })).toBe(false)
    expect(needsTravelDocument({ country: 'IT' })).toBe(true)
    expect(sheetGaps(guest({ country: 'IT' }), [], 1).guest).toEqual([
      'documentType',
      'documentNumber',
      'documentIssuedOn',
      'documentAuthority',
      'documentCountry',
    ])
  })

  it('Mitreisende: Anzahl = Personen − 1, je Person Name und Geburtsdatum', () => {
    const missing = sheetGaps(guest(), [companion], 4)
    expect(missing.companionsMissing).toBe(2)
    expect(sheetComplete(missing)).toBe(false)
    const incomplete = sheetGaps(guest(), [{ ...companion, birthDate: null }], 2)
    expect(incomplete.companions).toEqual([['birthDate']])
    expect(sheetComplete(sheetGaps(guest(), [companion], 2))).toBe(true)
  })

  it('mehr Mitreisende als Personen − 1 sperren', () => {
    const gaps = sheetGaps(guest(), [companion, companion], 2)
    expect(gaps.companionsTooMany).toBe(true)
    expect(sheetComplete(gaps)).toBe(false)
  })
})

describe('Tatsächliche Abreise auf dem Blatt', () => {
  it('vor dem Abreisetag leer, ab dem Abreisetag automatisch', () => {
    expect(sheetDeparture({ departure: '2026-11-10', noted: null, today: '2026-11-09' })).toBeNull()
    expect(sheetDeparture({ departure: '2026-11-10', noted: null, today: '2026-11-10' })).toEqual({ date: '2026-11-10', noted: null, automatic: true })
  })

  it('nachgetragen: Datum der Buchung mit Vermerk, auch vor dem Abreisetag', () => {
    const noted = { at: '2026-11-08T09:00:00Z', by: 'Eva Pichler' }
    expect(sheetDeparture({ departure: '2026-11-12', noted, today: '2026-11-09' })).toEqual({ date: '2026-11-12', noted, automatic: false })
  })
})

describe('Liste: Filter in der Adresse', () => {
  it('liest Monat, Suche, „fehlt“ und Seite; Standard aktueller Monat', () => {
    expect(parseGuestSheetFilters({}, '2026-11-09')).toEqual({ month: '2026-11', query: '', missing: false, page: 1 })
    expect(parseGuestSheetFilters({ monat: 'alle', q: ' Huber ', fehlt: '1', seite: '3' }, '2026-11-09')).toEqual({
      month: null,
      query: 'Huber',
      missing: true,
      page: 3,
    })
    expect(parseGuestSheetFilters({ monat: '2026-13' }, '2026-11-09').month).toBe('2026-11')
  })

  it('schreibt nur Abweichungen vom Standard', () => {
    expect(guestSheetListUrl({ month: '2026-11', query: '', missing: false, page: 1 }, '2026-11-09')).toBe('/gaesteblaetter')
    expect(guestSheetListUrl({ month: null, query: 'A-1', missing: true, page: 2 }, '2026-11-09')).toBe('/gaesteblaetter?monat=alle&q=A-1&fehlt=1&seite=2')
  })
})

describe('Datenschutz-Texte', () => {
  const issuer = {
    name: 'Pichler Ferienwohnungen',
    addressLine1: 'Dorfstraße 3',
    addressLine2: null,
    postalCode: '6020',
    city: 'Innsbruck',
    country: 'AT',
    email: 'office@pichler.at',
    phone: null,
  }

  it('Standardtexte nutzen nur Gästeblatt-Platzhalter', () => {
    for (const text of [DEFAULT_PRIVACY_TEXT, DEFAULT_MARKETING_TEXT]) {
      expect(docPlaceholderIssues({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }, 'guestSheet')).toEqual([])
    }
  })

  it('Rechnungs-Platzhalter sind im Gästeblatt unbekannt und umgekehrt', () => {
    const doc = (text: string) => ({ type: 'doc' as const, content: [{ type: 'paragraph' as const, content: [{ type: 'text' as const, text }] }] })
    expect(docPlaceholderIssues(doc('{Gast}'), 'guestSheet')).toEqual([{ token: '{Gast}', problem: 'unknown' }])
    expect(docPlaceholderIssues(doc('{Kundenname}'), { kind: 'intro', deposit: false })).toEqual([{ token: '{Kundenname}', problem: 'unknown' }])
  })

  it('Werte aus den Stammdaten; Anschrift in einer Zeile', () => {
    expect(sheetPlaceholderValues(issuer)).toEqual({
      Kundenname: 'Pichler Ferienwohnungen',
      Anschrift: 'Dorfstraße 3, 6020 Innsbruck, Österreich',
      'E-Mail': 'office@pichler.at',
      Telefon: '',
    })
  })

  it('weist auf verwendete, aber leere Platzhalter hin', () => {
    const values = sheetPlaceholderValues(issuer)
    expect(emptyPlaceholders(['Telefon: {Telefon}'], values)).toEqual(['Telefon'])
    expect(emptyPlaceholders(['ohne Telefon'], values)).toEqual([])
  })

  it('füllt Platzhalter; leere Angaben werden „–“', () => {
    const texts = filledTexts({ privacy: null, marketing: null }, issuer)
    const privacy = docPlainText(texts.privacy)
    expect(privacy).toContain('Pichler Ferienwohnungen, Dorfstraße 3, 6020 Innsbruck, Österreich, E-Mail: office@pichler.at, Telefon: –.')
    expect(docPlainText(texts.marketing)).toContain('per E-Mail an office@pichler.at')
  })
})
