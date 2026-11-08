import { describe, expect, it } from 'vitest'

import {
  activeQuickPick,
  buildTaxReport,
  buildTaxReportCsv,
  csvCents,
  csvText,
  fileNamePart,
  parseTaxReportFilters,
  periodFileKey,
  periodKind,
  periodOpen,
  quickPick,
  rowNotes,
  selectableYears,
  type TaxReportRow,
  taxReportExportHref,
  taxReportFileName,
  taxReportHref,
  taxReportRange,
} from './tourist-tax-report'

const TODAY = '2026-11-08'

const row = (over: Partial<TaxReportRow> = {}): TaxReportRow => ({
  bookingId: 'b1',
  bookingNumber: '2026-001',
  guestName: 'Muster Max',
  anonymized: false,
  apartment: 'Haus · Top 1',
  municipalityId: '50618',
  municipalityName: 'Saalbach',
  arrival: '2026-10-01',
  departure: '2026-10-04',
  persons: 3,
  amountCents: 1500,
  taxableNights: 6,
  knownTaxableNights: 6,
  exemptNights: 3,
  unknownPositions: 0,
  partial: false,
  legacy: false,
  percent: false,
  ...over,
})

describe('Zeitraum und Filter', () => {
  it('Standard ist der letzte abgelaufene Monat', () => {
    expect(parseTaxReportFilters({}, TODAY)).toEqual({ year: 2026, from: 10, to: 10, municipality: null })
  })

  it('Standard im Jänner ist der Dezember des Vorjahres', () => {
    expect(parseTaxReportFilters({}, '2027-01-15')).toEqual({ year: 2026, from: 12, to: 12, municipality: null })
  })

  it('liest Jahr, Monate und Gemeinde aus der Adresse', () => {
    expect(parseTaxReportFilters({ jahr: '2026', von: '3', bis: '5', gemeinde: '50618' }, TODAY)).toEqual({ year: 2026, from: 3, to: 5, municipality: '50618' })
  })

  it('Gemeinde ohne Zeitraum behält den Standardzeitraum', () => {
    expect(parseTaxReportFilters({ gemeinde: '50618' }, TODAY)).toEqual({ year: 2026, from: 10, to: 10, municipality: '50618' })
  })

  it.each([
    { jahr: '2026', von: '13', bis: '13' },
    { jahr: '2026', von: '5', bis: '3' },
    { jahr: '1999', von: '1', bis: '1' },
    { jahr: 'abc', von: '1', bis: '1' },
    { jahr: '2026', von: '1' },
    { jahr: '2026', von: '0', bis: '2' },
  ])('ungültiger Zeitraum %o führt auf den Standard', (params) => {
    expect(parseTaxReportFilters(params, TODAY)).toEqual({ year: 2026, from: 10, to: 10, municipality: null })
  })

  it('verwirft eine ungültige Gemeinde', () => {
    expect(parseTaxReportFilters({ jahr: '2026', von: '1', bis: '1', gemeinde: "x'; drop" }, TODAY).municipality).toBeNull()
  })

  it('nimmt bei mehrfachen Werten den ersten', () => {
    expect(parseTaxReportFilters({ jahr: ['2025', '2026'], von: '1', bis: '2' }, TODAY).year).toBe(2025)
  })

  it('Schnellwahl am 08.11.2026', () => {
    expect(quickPick('lastMonth', TODAY)).toMatchObject({ year: 2026, from: 10, to: 10 })
    expect(quickPick('lastQuarter', TODAY)).toMatchObject({ year: 2026, from: 7, to: 9 })
    expect(quickPick('lastYear', TODAY)).toMatchObject({ year: 2025, from: 1, to: 12 })
  })

  it('Schnellwahl über den Jahreswechsel', () => {
    expect(quickPick('lastMonth', '2027-01-15')).toMatchObject({ year: 2026, from: 12, to: 12 })
    expect(quickPick('lastQuarter', '2027-02-01')).toMatchObject({ year: 2026, from: 10, to: 12 })
    expect(quickPick('lastQuarter', '2026-04-01')).toMatchObject({ year: 2026, from: 1, to: 3 })
  })

  it('erkennt die passende Schnellwahl', () => {
    expect(activeQuickPick({ year: 2026, from: 7, to: 9, municipality: '1' }, TODAY)).toBe('lastQuarter')
    expect(activeQuickPick({ year: 2026, from: 3, to: 5, municipality: null }, TODAY)).toBeNull()
  })

  it('wählbare Jahre enthalten das eingestellte Jahr', () => {
    expect(selectableYears(TODAY, 2026)).toEqual([2027, 2026, 2025, 2024, 2023, 2022, 2021])
    expect(selectableYears(TODAY, 2015)).toContain(2015)
  })

  it('bildet Adresse und Export-Adresse', () => {
    const f = { year: 2026, from: 7, to: 9, municipality: '50618' }
    expect(taxReportHref(f)).toBe('/ortstaxe?jahr=2026&von=7&bis=9&gemeinde=50618')
    expect(taxReportExportHref('csv', { ...f, municipality: null })).toBe('/api/ortstaxe/csv?jahr=2026&von=7&bis=9')
  })

  it('Abfragebereich bis zum Monatsletzten (auch Februar im Schaltjahr)', () => {
    expect(taxReportRange({ year: 2026, from: 7, to: 9, municipality: null })).toEqual({ from: '2026-07-01', to: '2026-09-30' })
    expect(taxReportRange({ year: 2028, from: 2, to: 2, municipality: null })).toEqual({ from: '2028-02-01', to: '2028-02-29' })
  })

  it('laufender oder künftiger Zeitraum ist nicht abgeschlossen', () => {
    expect(periodOpen({ year: 2026, from: 10, to: 10, municipality: null }, TODAY)).toBe(false)
    expect(periodOpen({ year: 2026, from: 10, to: 11, municipality: null }, TODAY)).toBe(true)
    expect(periodOpen({ year: 2027, from: 1, to: 1, municipality: null }, TODAY)).toBe(true)
    expect(periodOpen({ year: 2026, from: 1, to: 12, municipality: null }, TODAY)).toBe(true)
  })

  it('Art und Dateischlüssel des Zeitraums', () => {
    expect(periodKind({ year: 2026, from: 10, to: 10, municipality: null })).toBe('month')
    expect(periodKind({ year: 2025, from: 1, to: 12, municipality: null })).toBe('year')
    expect(periodKind({ year: 2026, from: 7, to: 9, municipality: null })).toBe('range')
    expect(periodFileKey({ year: 2026, from: 10, to: 10, municipality: null })).toBe('2026-10')
    expect(periodFileKey({ year: 2025, from: 1, to: 12, municipality: null })).toBe('2025')
    expect(periodFileKey({ year: 2026, from: 7, to: 9, municipality: null })).toBe('2026-07-bis-09')
  })

  it('Dateinamen', () => {
    const f = { year: 2026, from: 10, to: 10, municipality: null }
    expect(taxReportFileName('pdf', f, 'Saalbach', TODAY)).toBe('Ortstaxe_2026-10_Saalbach.pdf')
    expect(taxReportFileName('pdf', { ...f, from: 7, to: 9 }, null, TODAY)).toBe('Ortstaxe_2026-07-bis-09_Alle.pdf')
    expect(taxReportFileName('csv', f, null, TODAY)).toBe('Ortstaxe_2026-10_Alle_Stand-2026-11-08.csv')
    expect(fileNamePart('Zell am See')).toBe('Zell-am-See')
    expect(fileNamePart('St. Johann/Pongau')).toBe('St-JohannPongau')
    expect(fileNamePart('Wörgl')).toBe('Wörgl')
    expect(fileNamePart('***')).toBe('Gemeinde')
  })
})

describe('Gruppierung und Summen', () => {
  const rows = [
    row({ bookingId: 'z1', municipalityId: '2', municipalityName: 'Zell am See', amountCents: 400 }),
    row({ bookingId: 's2', bookingNumber: '2026-010', arrival: '2026-10-05' }),
    row({ bookingId: 's1', bookingNumber: '2026-009', arrival: '2026-10-05' }),
    row({ bookingId: 's0', bookingNumber: '2026-002', arrival: '2026-10-01' }),
  ]

  it('je Gemeinde alphabetisch, darin nach Anreise und Nummer', () => {
    const v = buildTaxReport(rows, null)
    expect(v.groups.map((g) => g.name)).toEqual(['Saalbach', 'Zell am See'])
    expect(v.groups[0].rows.map((r) => r.bookingId)).toEqual(['s0', 's1', 's2'])
  })

  it('Nummern numerisch sortiert', () => {
    const v = buildTaxReport([row({ bookingId: 'a', bookingNumber: '2026-10' }), row({ bookingId: 'b', bookingNumber: '2026-9' })], null)
    expect(v.groups[0].rows.map((r) => r.bookingId)).toEqual(['b', 'a'])
  })

  it('Summen je Gemeinde und Gesamt bei mehreren Gemeinden', () => {
    const v = buildTaxReport(rows, null)
    expect(v.groups[0].sum).toEqual({ taxableNights: 18, exemptNights: 9, amountCents: 4500, unknownPositions: 0 })
    expect(v.total).toEqual({ taxableNights: 24, exemptNights: 12, amountCents: 4900, unknownPositions: 0 })
  })

  it('kein Gesamt bei einer Gemeinde', () => {
    expect(buildTaxReport([row()], null).total).toBeNull()
  })

  it('Gemeindefilter wirkt, Auswahl enthält alle Gemeinden', () => {
    const v = buildTaxReport(rows, '2')
    expect(v.groups.map((g) => g.id)).toEqual(['2'])
    expect(v.total).toBeNull()
    expect(v.municipalities.map((m) => m.name)).toEqual(['Saalbach', 'Zell am See'])
    expect(v.municipality).toBe('2')
  })

  it('Gemeinde ohne Ortstaxe im Zeitraum fällt auf „Alle Gemeinden“ zurück', () => {
    const v = buildTaxReport(rows, '999')
    expect(v.municipality).toBeNull()
    expect(v.groups).toHaveLength(2)
  })

  it('unbekannte Personennächte zählen nicht, werden aber gezählt', () => {
    const v = buildTaxReport([row(), row({ bookingId: 'alt', taxableNights: null, knownTaxableNights: 0, exemptNights: null, unknownPositions: 1, legacy: true, amountCents: 999 })], null)
    expect(v.groups[0].sum).toEqual({ taxableNights: 6, exemptNights: 3, amountCents: 2499, unknownPositions: 1 })
  })

  it('leer ohne Zeilen', () => {
    expect(buildTaxReport([], null)).toEqual({ groups: [], total: null, municipalities: [], municipality: null })
  })

  it('Hinweise je Zeile', () => {
    expect(rowNotes(row({ partial: true, legacy: true }))).toEqual(['partial', 'legacy'])
    expect(rowNotes(row())).toEqual([])
  })
})

describe('CSV', () => {
  const labels = {
    columns: ['Gemeinde', 'Nr.', 'Hauptgast', 'Wohnung', 'Anreise', 'Abreise', 'Personen', 'Abgabepflichtige Personennächte', 'Befreite Personennächte', 'Betrag', 'Hinweis'],
    notes: { partial: 'anteilig', legacy: 'Alt-Position', percent: 'Prozent-Tarif' },
    anonymized: 'Anonymisiert',
  }

  it('Beträge mit Komma, ohne Tausendertrennung', () => {
    expect(csvCents(103000)).toBe('1030,00')
    expect(csvCents(5)).toBe('0,05')
    expect(csvCents(-500)).toBe('-5,00')
  })

  it('Anführungszeichen bei Strichpunkt, Anführungszeichen und Zeilenumbruch', () => {
    expect(csvText('Muster; Max')).toBe('"Muster; Max"')
    expect(csvText('Der "Chef"')).toBe('"Der ""Chef"""')
    expect(csvText('a\nb')).toBe('"a\nb"')
    expect(csvText('Saalbach')).toBe('Saalbach')
  })

  it.each(['=SUMME(A1)', '+43', '-1', '@cmd', '\tx'])('entschärft Formeln: %s', (v) => {
    expect(csvText(v).replace(/^"/, '').startsWith("'")).toBe(true)
  })

  it('BOM, Kopfzeile, eine Zeile je Buchung, keine Summen, CRLF', () => {
    const v = buildTaxReport(
      [
        row(),
        row({ bookingId: 'x', bookingNumber: '2026-002', guestName: null, anonymized: true, partial: true, legacy: true, taxableNights: null, knownTaxableNights: 0, exemptNights: null, unknownPositions: 1 }),
      ],
      null
    )
    const csv = buildTaxReportCsv(v.groups, labels)
    expect(csv.startsWith('﻿Gemeinde;Nr.;Hauptgast;')).toBe(true)
    const lines = csv.slice(1).split('\r\n')
    expect(lines).toHaveLength(4)
    expect(lines[1]).toBe('Saalbach;2026-001;Muster Max;Haus · Top 1;01.10.2026;04.10.2026;3;6;3;15,00;')
    expect(lines[2]).toBe('Saalbach;2026-002;Anonymisiert;Haus · Top 1;01.10.2026;04.10.2026;3;;;15,00;anteilig, Alt-Position')
    expect(lines[3]).toBe('')
  })
})
