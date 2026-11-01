import { describe, expect, it } from 'vitest'

import {
  ageOn,
  computeTouristTax,
  currentRate,
  duplicateTaxLabels,
  isFutureRate,
  rateFromRow,
  rateOn,
  ratesByApartment,
  sameTaxLines,
  sortRates,
  type TouristTaxInput,
  type TouristTaxRate,
} from '@/lib/tourist-tax'

// Beispielfälle der Spec (Akzeptanzkriterien PROJ-15). Dieselben Fälle prüfen die Integrationstests der
// Datenbank-Fassung, damit beide Fassungen gleich rechnen.

const perPerson = (validFrom: string, amountCents: number, extra: Partial<TouristTaxRate> = {}): TouristTaxRate => ({
  validFrom,
  label: 'Nächtigungsabgabe',
  method: 'per_person_night',
  amountCents,
  percentBp: null,
  base: null,
  exemptUnderAge: null,
  vatBp: 0,
  ...extra,
})

const percentRate = (validFrom: string, percentBp: number, base: 'net' | 'gross', extra: Partial<TouristTaxRate> = {}): TouristTaxRate => ({
  validFrom,
  label: 'Ortstaxe',
  method: 'percent',
  amountCents: null,
  percentBp,
  base,
  exemptUnderAge: null,
  vatBp: 0,
  ...extra,
})

const stay = (overrides: Partial<TouristTaxInput>): TouristTaxInput => ({
  kind: 'booking',
  rates: [],
  arrival: '2026-07-01',
  departure: '2026-07-05',
  billableNights: 4,
  billedNightsCents: 40_000,
  nightsVatBp: 1000,
  smallBusiness: false,
  residenceRegistered: false,
  persons: 2,
  childCount: 0,
  people: [{ birthDate: '1980-05-01', exempt: false }],
  ...overrides,
})

const amounts = (input: TouristTaxInput) => computeTouristTax(input).lines.map((l) => l.amountCents)

describe('Betrag pro Person und Nacht', () => {
  it('2 Erwachsene + 1 Kind, 4 Nächte, € 2,50 → € 30,00 mit 0 % USt', () => {
    const r = computeTouristTax(stay({ rates: [perPerson('2026-01-01', 250)], persons: 3, childCount: 1 }))
    expect(r.lines).toEqual([
      { rateId: null, validFrom: '2026-01-01', label: 'Nächtigungsabgabe', amountCents: 3000, vatBp: 0, personNights: 12 },
    ])
  })

  it('befreit unter 15: Kind (10) mit Geburtsdatum zahlt nicht, Erwachsener ohne Namen zahlt → € 20,00', () => {
    const r = computeTouristTax(
      stay({
        rates: [perPerson('2026-01-01', 250, { exemptUnderAge: 15 })],
        persons: 3,
        childCount: 1,
        people: [
          { birthDate: '1980-05-01', exempt: false },
          { birthDate: '2016-03-01', exempt: false },
        ],
      })
    )
    expect(r.lines[0].amountCents).toBe(2000)
    // Der Erwachsene ohne Namen zahlt ohnehin: kein Hinweis
    expect(r.missingBirthDates).toBe(0)
  })

  it('15. Geburtstag am 3. Tag: Nächte 1–2 frei, ab der 3. Nacht abgabepflichtig', () => {
    const r = computeTouristTax(
      stay({
        rates: [perPerson('2026-01-01', 100, { exemptUnderAge: 15 })],
        arrival: '2026-07-01',
        departure: '2026-07-06',
        persons: 1,
        childCount: 1,
        people: [{ birthDate: '2011-07-03', exempt: false }],
      })
    )
    expect(r.lines[0].personNights).toBe(3)
    expect(r.lines[0].amountCents).toBe(300)
  })

  it('Geburtstag am Anreisetag: zahlt ab der ersten Nacht', () => {
    const input = stay({
      rates: [perPerson('2026-01-01', 100, { exemptUnderAge: 15 })],
      persons: 1,
      childCount: 1,
      people: [{ birthDate: '2011-07-01', exempt: false }],
    })
    expect(computeTouristTax(input).lines[0].personNights).toBe(4)
  })

  it('Kind (4) ohne Geburtsdatum zahlt den normalen Tarif, mit Hinweis', () => {
    const r = computeTouristTax(
      stay({ rates: [perPerson('2026-01-01', 250, { exemptUnderAge: 15 })], persons: 2, childCount: 1 })
    )
    expect(r.lines[0].amountCents).toBe(2000)
    expect(r.missingBirthDates).toBe(1)
  })

  it('Hinweis zählt nur Kinder (QA BUG-1): 2 Erwachsene + 1 Kind ohne Geburtsdatum → 1 Person; ohne Hauptgast-Geburtsdatum ebenso', () => {
    const rates = [perPerson('2026-01-01', 250, { exemptUnderAge: 15 })]
    expect(computeTouristTax(stay({ rates, persons: 3, childCount: 1 })).missingBirthDates).toBe(1)
    expect(computeTouristTax(stay({ rates, persons: 3, childCount: 1, people: [{ birthDate: null, exempt: false }] })).missingBirthDates).toBe(1)
    expect(computeTouristTax(stay({ rates, persons: 4, childCount: 2 })).missingBirthDates).toBe(2)
  })

  it('Geburtsdatum nachgetragen: Abgabe sinkt, Hinweis verschwindet', () => {
    const r = computeTouristTax(
      stay({
        rates: [perPerson('2026-01-01', 250, { exemptUnderAge: 15 })],
        persons: 2,
        childCount: 1,
        people: [
          { birthDate: '1980-05-01', exempt: false },
          { birthDate: '2022-01-01', exempt: false },
        ],
      })
    )
    expect(r.lines[0].amountCents).toBe(1000)
    expect(r.missingBirthDates).toBe(0)
  })

  it('ohne Altersgrenze oder ohne Kinder kein Hinweis zum Geburtsdatum', () => {
    expect(computeTouristTax(stay({ rates: [perPerson('2026-01-01', 250)], persons: 3, childCount: 1 })).missingBirthDates).toBe(0)
    expect(computeTouristTax(stay({ rates: [perPerson('2026-01-01', 250, { exemptUnderAge: 15 })] })).missingBirthDates).toBe(0)
  })

  it('frühere Abreise: nur die Nächte bis zur tatsächlichen Abreise', () => {
    const input = stay({ rates: [perPerson('2026-01-01', 100)], departure: '2026-07-03', billableNights: 4, persons: 1 })
    expect(amounts(input)).toEqual([200])
  })
})

describe('Persönliche Befreiung', () => {
  const rates = [perPerson('2026-01-01', 250)]

  it('Hauptgast befreit: € 20,00 → € 10,00', () => {
    expect(amounts(stay({ rates }))).toEqual([2000])
    expect(amounts(stay({ rates, people: [{ birthDate: '1980-05-01', exempt: true }] }))).toEqual([1000])
  })

  it('befreiter Mitreisender über der Altersgrenze zählt nie', () => {
    const r = computeTouristTax(
      stay({
        rates: [perPerson('2026-01-01', 250, { exemptUnderAge: 15 })],
        people: [
          { birthDate: '1980-05-01', exempt: false },
          { birthDate: '1950-01-01', exempt: true },
        ],
      })
    )
    expect(r.lines[0].amountCents).toBe(1000)
  })

  it('befreiter Mitreisender ohne Geburtsdatum: zählt nicht, kein Hinweis für ihn', () => {
    const r = computeTouristTax(
      stay({
        rates: [perPerson('2026-01-01', 250, { exemptUnderAge: 15 })],
        childCount: 1,
        people: [
          { birthDate: '1980-05-01', exempt: false },
          { birthDate: null, exempt: true },
        ],
      })
    )
    expect(r.lines[0].amountCents).toBe(1000)
    expect(r.missingBirthDates).toBe(0)
  })

  it('alle befreit: keine Position', () => {
    const r = computeTouristTax(
      stay({
        rates,
        persons: 2,
        people: [
          { birthDate: null, exempt: true },
          { birthDate: null, exempt: true },
        ],
      })
    )
    expect(r.lines).toEqual([])
  })

  it('bei Prozent wirkt das Häkchen nicht', () => {
    const input = stay({ rates: [percentRate('2026-01-01', 320, 'gross')], billedNightsCents: 44_000 })
    expect(amounts(input)).toEqual(amounts({ ...input, people: [{ birthDate: null, exempt: true }] }))
  })
})

describe('Tarifwechsel während des Aufenthalts', () => {
  it('€ 2,00 ab 2026, € 2,50 ab 2027, 2 Personen 29.12.–03.01. → € 12,00 und € 10,00', () => {
    const r = computeTouristTax(
      stay({
        rates: [perPerson('2027-01-01', 250), perPerson('2026-01-01', 200)],
        arrival: '2026-12-29',
        departure: '2027-01-03',
        billableNights: 5,
      })
    )
    expect(r.lines.map((l) => [l.validFrom, l.amountCents, l.personNights])).toEqual([
      ['2026-01-01', 1200, 6],
      ['2027-01-01', 1000, 4],
    ])
  })

  it('erster Tarif erst ab 01.01.: 3 Nächte ohne Tarif', () => {
    const r = computeTouristTax(
      stay({ rates: [perPerson('2027-01-01', 250)], arrival: '2026-12-29', departure: '2027-01-03', billableNights: 5 })
    )
    expect(r.nightsWithoutRate).toBe(3)
    expect(r.lines.map((l) => l.amountCents)).toEqual([1000])
  })

  it('verschiedene Bezeichnungen und Sätze bleiben je Position erhalten', () => {
    const r = computeTouristTax(
      stay({
        rates: [perPerson('2027-01-01', 250, { label: 'Ortstaxe', vatBp: 1000, id: 'b' }), perPerson('2026-01-01', 200, { id: 'a' })],
        arrival: '2026-12-30',
        departure: '2027-01-02',
        billableNights: 3,
      })
    )
    expect(r.lines.map((l) => [l.rateId, l.label, l.vatBp])).toEqual([
      ['a', 'Nächtigungsabgabe', 0],
      ['b', 'Ortstaxe', 1000],
    ])
  })
})

describe('Prozent vom Übernachtungspreis', () => {
  it('3,20 % netto von € 440,00 brutto mit 10 % USt → € 12,80', () => {
    expect(amounts(stay({ rates: [percentRate('2026-01-01', 320, 'net')], billedNightsCents: 44_000 }))).toEqual([1280])
  })

  it('3,20 % brutto → € 14,08', () => {
    expect(amounts(stay({ rates: [percentRate('2026-01-01', 320, 'gross')], billedNightsCents: 44_000 }))).toEqual([1408])
  })

  it('Kleinunternehmer: netto = brutto', () => {
    expect(amounts(stay({ rates: [percentRate('2026-01-01', 320, 'net')], billedNightsCents: 44_000, smallBusiness: true }))).toEqual([1408])
  })

  it('frühere Abreise: Basis bleibt der ganze abgerechnete Preis', () => {
    const input = stay({ rates: [percentRate('2026-01-01', 1000, 'gross')], departure: '2026-07-04', billableNights: 5, billedNightsCents: 50_000 })
    expect(amounts(input)).toEqual([5000])
  })

  it('Wechsel nach der 2. von 5 Nächten: 2/5 und 3/5 der Basis, je Position gerundet', () => {
    const r = computeTouristTax(
      stay({
        rates: [percentRate('2026-07-03', 500, 'gross'), percentRate('2026-01-01', 320, 'gross')],
        departure: '2026-07-06',
        billableNights: 5,
        billedNightsCents: 50_001,
      })
    )
    // 50.001 × 2/5 × 3,2 % = 640,0128 → 640; 50.001 × 3/5 × 5 % = 1.500,03 → 1.500
    expect(r.lines.map((l) => l.amountCents)).toEqual([640, 1500])
    expect(r.lines.every((l) => l.personNights === null)).toBe(true)
  })

  it('Übernachtung € 0: keine Position', () => {
    expect(amounts(stay({ rates: [percentRate('2026-01-01', 320, 'gross')], billedNightsCents: 0 }))).toEqual([])
  })

  it('große Beträge rechnen exakt', () => {
    const input = stay({ rates: [percentRate('2026-01-01', 10_000, 'net')], billedNightsCents: 100_000_000, nightsVatBp: 1000, billableNights: 365 })
    expect(amounts(input)).toEqual([90_909_091])
  })
})

describe('Keine Abgabe', () => {
  const rates = [perPerson('2026-01-01', 250)]

  it('„Wohnsitz angemeldet“, Sperre, Wohnung ohne Tarif: keine Position und kein Hinweis', () => {
    for (const input of [stay({ rates, residenceRegistered: true }), stay({ rates, kind: 'block' }), stay({ rates: [] })]) {
      expect(computeTouristTax(input)).toEqual({ lines: [], missingBirthDates: 0, nightsWithoutRate: 0 })
    }
  })

  it('Tarif mit € 0,00: keine Position für diese Nächte', () => {
    const input = stay({ rates: [perPerson('2026-07-03', 0), perPerson('2026-01-01', 250)] })
    expect(computeTouristTax(input).lines.map((l) => [l.validFrom, l.amountCents])).toEqual([['2026-01-01', 1000]])
  })

  it('Option wird wie eine Buchung berechnet', () => {
    expect(amounts(stay({ rates, kind: 'option' }))).toEqual([2000])
  })

  it('lange Aufenthalte (180 Nächte) sind schnell', () => {
    const input = stay({ rates, arrival: '2026-01-01', departure: '2026-06-30', billableNights: 180, persons: 6 })
    const start = performance.now()
    expect(amounts(input)).toEqual([180 * 6 * 250])
    expect(performance.now() - start).toBeLessThan(50)
  })
})

describe('Hilfsfunktionen', () => {
  it('Alter am Tag: Geburtstag zählt schon, 29. Februar in Nicht-Schaltjahren ab 1. März', () => {
    expect(ageOn('2011-07-03', '2026-07-02')).toBe(14)
    expect(ageOn('2011-07-03', '2026-07-03')).toBe(15)
    expect(ageOn('2012-02-29', '2027-02-28')).toBe(14)
    expect(ageOn('2012-02-29', '2027-03-01')).toBe(15)
  })

  it('Tarif am Tag, aktueller Tarif, künftige Einträge, Sortierung', () => {
    const rates = [perPerson('2026-01-01', 200), perPerson('2027-01-01', 250)]
    expect(rateOn(rates, '2025-12-31')).toBeNull()
    expect(rateOn(rates, '2027-01-01')?.amountCents).toBe(250)
    expect(currentRate(rates, '2026-11-01')?.validFrom).toBe('2026-01-01')
    expect(isFutureRate(rates[1], '2026-11-01')).toBe(true)
    expect(sortRates(rates).map((r) => r.validFrom)).toEqual(['2027-01-01', '2026-01-01'])
  })

  it('Vergleich gespeichert/berechnet ohne Reihenfolge; Doppelung nach Bezeichnung', () => {
    const a = [
      { label: 'Nächtigungsabgabe', amountCents: 1200, vatBp: 0 },
      { label: 'Nächtigungsabgabe ', amountCents: 1000, vatBp: 0 },
    ]
    expect(sameTaxLines(a, [...a].reverse())).toBe(true)
    expect(sameTaxLines(a, a.slice(1))).toBe(false)
    expect(duplicateTaxLabels([{ label: 'nächtigungsabgabe' }, { label: 'Reinigung' }], a)).toEqual(['nächtigungsabgabe'])
  })

  it('Zeilen aus der Datenbank', () => {
    const rows = [
      { id: '1', apartment_id: 'x', valid_from: '2026-01-01', label: 'Ortstaxe', method: 'percent', amount_cents: null, percent_rate: '3.20', base: 'net', exempt_under_age: null, vat_rate: '0.00' },
      { id: '2', apartment_id: 'x', valid_from: '2027-01-01', label: 'N', method: 'per_person_night', amount_cents: 250, percent_rate: null, base: null, exempt_under_age: 15, vat_rate: 0 },
    ]
    expect(rateFromRow(rows[0])).toMatchObject({ method: 'percent', percentBp: 320, base: 'net', vatBp: 0 })
    expect(ratesByApartment(rows).get('x')?.map((r) => r.id)).toEqual(['2', '1'])
  })
})
