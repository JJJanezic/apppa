import { describe, expect, it } from 'vitest'

import {
  activeStatsQuickPick,
  averageRate,
  averageStay,
  buildOrigin,
  buildStats,
  buildStatsCsv,
  chartModel,
  currentMonthHref,
  nextApartmentSort,
  niceScale,
  occupancy,
  parseStatsFilters,
  pointChange,
  relativeChange,
  resolveStatsFilters,
  sortApartmentLines,
  type StatsApartment,
  statsExportHref,
  type StatsFilters,
  statsFileName,
  statsHref,
  type StatsMonthRow,
  type StatsOriginRow,
  type StatsTenant,
  groupProperties,
  withTenant,
  statsQuickPick,
  sumRows,
} from './statistics'

const TODAY = '2026-11-08'
const P1 = '11111111-1111-4111-8111-111111111111'
const P2 = '22222222-2222-4222-8222-222222222222'
const A1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
const A2 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
const A3 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3'

const T1 = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc1'
const T2 = 'cccccccc-cccc-4ccc-8ccc-ccccccccccc2'
const TENANTS: StatsTenant[] = [{ id: T1, name: 'Alpenhof GmbH' }]
const APARTMENTS: StatsApartment[] = [
  { id: A2, name: 'Top 2', propertyId: P1, propertyName: 'Haus Alpenblick', archived: false, tenantId: T1, tenantName: 'Alpenhof GmbH' },
  { id: A1, name: 'Top 1', propertyId: P1, propertyName: 'Haus Alpenblick', archived: false, tenantId: T1, tenantName: 'Alpenhof GmbH' },
  { id: A3, name: 'Studio', propertyId: P2, propertyName: 'Zentrum', archived: true, tenantId: T1, tenantName: 'Alpenhof GmbH' },
]

const ALL: StatsFilters = { year: 2026, from: 1, to: 12, tenant: null, property: null, apartment: null }

const row = (apartmentId: string, month: string, over: Partial<StatsMonthRow> = {}): StatsMonthRow => ({
  apartmentId,
  month,
  availableNights: 31,
  occupiedNights: 0,
  blockedNights: 0,
  revenueCents: 0,
  revenueVatCents: 0,
  feeCents: 0,
  feeVatCents: 0,
  guestNights: 0,
  arrivals: 0,
  bookings: 0,
  stayNights: 0,
  ...over,
})

describe('Filter aus der Adresse', () => {
  it('Standard ist das laufende Jahr Jänner bis Dezember', () => {
    expect(parseStatsFilters({}, TODAY)).toEqual(ALL)
  })

  it('liest Zeitraum, Objekt und Wohnung', () => {
    expect(parseStatsFilters({ jahr: '2025', von: '7', bis: '9', objekt: P1, wohnung: A1 }, TODAY)).toEqual({ year: 2025, from: 7, to: 9, tenant: null, property: P1, apartment: A1 })
  })

  it('ungültiger Zeitraum führt auf den Standard zurück, Objekt bleibt', () => {
    expect(parseStatsFilters({ jahr: '2026', von: '13', bis: '12', objekt: P1 }, TODAY)).toEqual({ ...ALL, property: P1 })
    expect(parseStatsFilters({ jahr: '2026', von: '9', bis: '3' }, TODAY)).toEqual(ALL)
    expect(parseStatsFilters({ jahr: '1999', von: '1', bis: '1' }, TODAY)).toEqual(ALL)
  })

  it('verwirft ungültige Kennungen', () => {
    expect(parseStatsFilters({ objekt: 'x; drop', wohnung: '123' }, TODAY)).toEqual(ALL)
  })

  it('Objekt oder Wohnung, die nicht zum Kunden passen, führen auf „Alle“', () => {
    expect(resolveStatsFilters({ ...ALL, property: P2, apartment: A1 }, APARTMENTS, TENANTS)).toEqual({ ...ALL, property: P2, apartment: null })
    expect(resolveStatsFilters({ ...ALL, property: '33333333-3333-4333-8333-333333333333' }, APARTMENTS, TENANTS)).toEqual(ALL)
    expect(resolveStatsFilters({ ...ALL, apartment: A3 }, APARTMENTS, TENANTS)).toEqual({ ...ALL, apartment: A3 })
  })
})

describe('Schnellwahl', () => {
  it('am 08.11.2026', () => {
    expect(statsQuickPick('thisYear', TODAY)).toEqual({ year: 2026, from: 1, to: 12 })
    expect(statsQuickPick('lastYear', TODAY)).toEqual({ year: 2025, from: 1, to: 12 })
    expect(statsQuickPick('lastMonth', TODAY)).toEqual({ year: 2026, from: 10, to: 10 })
    expect(statsQuickPick('lastQuarter', TODAY)).toEqual({ year: 2026, from: 7, to: 9 })
  })

  it('im Jänner über den Jahreswechsel', () => {
    expect(statsQuickPick('lastMonth', '2027-01-05')).toEqual({ year: 2026, from: 12, to: 12 })
    expect(statsQuickPick('lastQuarter', '2027-01-05')).toEqual({ year: 2026, from: 10, to: 12 })
  })

  it('erkennt die aktive Schnellwahl', () => {
    expect(activeStatsQuickPick({ year: 2026, from: 1, to: 12 }, TODAY)).toBe('thisYear')
    expect(activeStatsQuickPick({ year: 2026, from: 7, to: 9 }, TODAY)).toBe('lastQuarter')
    expect(activeStatsQuickPick({ year: 2026, from: 2, to: 3 }, TODAY)).toBeNull()
  })
})

describe('Adressen und Dateinamen', () => {
  it('Seite und Export', () => {
    expect(statsHref({ ...ALL, property: P1 })).toBe(`/auswertungen?jahr=2026&von=1&bis=12&objekt=${P1}`)
    expect(statsExportHref('csv', { year: 2026, from: 10, to: 10, tenant: null, property: null, apartment: A1 })).toBe(`/api/auswertungen/csv?jahr=2026&von=10&bis=10&wohnung=${A1}`)
    expect(currentMonthHref(TODAY)).toBe('/auswertungen?jahr=2026&von=11&bis=11')
    expect(currentMonthHref(TODAY, T2)).toBe(`/auswertungen?jahr=2026&von=11&bis=11&kunde=${T2}`)
  })

  it('Dateiname mit Zeitraum, Filter und Stand', () => {
    expect(statsFileName('pdf', ALL, APARTMENTS, TENANTS, TODAY)).toBe('Auswertung_2026_Alle_Stand-2026-11-08.pdf')
    expect(statsFileName('csv', { ...ALL, from: 7, to: 9, property: P1 }, APARTMENTS, TENANTS, TODAY)).toBe('Auswertung_2026-07-bis-09_Haus-Alpenblick_Stand-2026-11-08.csv')
    expect(statsFileName('csv', { ...ALL, from: 10, to: 10, apartment: A1 }, APARTMENTS, TENANTS, TODAY)).toBe('Auswertung_2026-10_Haus-Alpenblick-Top-1_Stand-2026-11-08.csv')
  })
})

describe('Kennzahlen', () => {
  it('Auslastung, Durchschnittspreis ohne Stornogebühren, Aufenthaltsdauer', () => {
    const t = sumRows([
      row(A1, '2026-10', { availableNights: 30, occupiedNights: 10, blockedNights: 1, revenueCents: 100000, revenueVatCents: 9091, feeCents: 8000 }),
      row(A2, '2026-10', { availableNights: 31, occupiedNights: 0, bookings: 3, stayNights: 14 }),
    ])
    expect(t.revenueCents).toBe(108000)
    expect(t.vatCents).toBe(9091)
    expect(occupancy(t)).toBeCloseTo(10 / 61)
    expect(averageRate(t)).toBe(10000)
    expect(averageStay(t)).toBeCloseTo(14 / 3)
  })

  it('ohne Nächte bzw. Buchungen „–“', () => {
    const t = sumRows([row(A1, '2026-10', { availableNights: 0 })])
    expect(occupancy(t)).toBeNull()
    expect(averageRate(t)).toBeNull()
    expect(averageStay(t)).toBeNull()
  })

  it('Veränderung zum Vorjahr', () => {
    expect(pointChange(0.62, 0.58)).toEqual({ value: 4, unit: 'pp' })
    expect(pointChange(0.5, 0.5)).toEqual({ value: 0, unit: 'pp' })
    expect(pointChange(0.5, null)).toBeNull()
    expect(relativeChange(11200, 10000)).toEqual({ value: 12, unit: 'percent' })
    expect(relativeChange(9000, 10000)).toEqual({ value: -10, unit: 'percent' })
    expect(relativeChange(100, 0)).toBeNull()
    expect(relativeChange(null, 100)).toBeNull()
  })
})

describe('Aufbau der Seite', () => {
  const rows = [
    row(A1, '2026-10', { occupiedNights: 20, revenueCents: 200000 }),
    row(A1, '2026-11', { availableNights: 30, occupiedNights: 15, revenueCents: 150000 }),
    row(A2, '2026-10', { occupiedNights: 31, revenueCents: 310000 }),
    row(A1, '2025-10', { occupiedNights: 10, revenueCents: 90000 }),
    row(A3, '2025-10', { occupiedNights: 5, revenueCents: 50000 }),
    // außerhalb des Zeitraums
    row(A1, '2026-09', { occupiedNights: 30 }),
  ]
  const f: StatsFilters = { ...ALL, from: 10, to: 11 }

  it('Summen und Monate mit Vorjahr', () => {
    const v = buildStats(rows, APARTMENTS, f, TENANTS)
    expect(v.months.map((m) => m.month)).toEqual([10, 11])
    expect(v.totals.current.occupiedNights).toBe(66)
    expect(v.totals.current.availableNights).toBe(92)
    expect(v.totals.previous.occupiedNights).toBe(15)
    expect(v.totals.previousKnown).toBe(true)
    expect(v.months[1].previous.availableNights).toBe(0)
    expect(v.empty).toBe(false)
  })

  it('Gesamt-Auslastung aus den Summen, nicht als Mittel der Monate', () => {
    const v = buildStats(rows, APARTMENTS, f, TENANTS)
    expect(occupancy(v.totals.current)).toBeCloseTo(66 / 92)
  })

  it('je Wohnung nach Objekt und Wohnung, nur mit Daten im Zeitraum', () => {
    const v = buildStats(rows, APARTMENTS, f, TENANTS)
    expect(v.apartments.map((l) => l.apartment.id)).toEqual([A1, A2])
  })

  it('Objektfilter wirkt auch auf das Vorjahr', () => {
    const v = buildStats(rows, APARTMENTS, { ...f, property: P1 }, TENANTS)
    expect(v.totals.previous.occupiedNights).toBe(10)
  })

  it('einzelne Wohnung: keine Tabelle je Wohnung', () => {
    const v = buildStats(rows, APARTMENTS, { ...f, apartment: A1 }, TENANTS)
    expect(v.apartments).toEqual([])
    expect(v.totals.current.occupiedNights).toBe(35)
  })

  it('leer ohne verfügbare Nächte und Umsatz; Vorjahr unbekannt', () => {
    const v = buildStats([], APARTMENTS, f, TENANTS)
    expect(v.empty).toBe(true)
    expect(v.totals.previousKnown).toBe(false)
  })

  it('Stornogebühr ohne Nächte zählt als Daten', () => {
    const v = buildStats([row(A1, '2026-12', { availableNights: 0, feeCents: 8000 })], APARTMENTS, { ...ALL, from: 12, to: 12 }, TENANTS)
    expect(v.empty).toBe(false)
    expect(v.totals.current.revenueCents).toBe(8000)
    expect(averageRate(v.totals.current)).toBeNull()
  })
})

describe('Sortierung je Wohnung', () => {
  const v = buildStats(
    [
      row(A1, '2026-10', { occupiedNights: 10, revenueCents: 300000 }),
      row(A2, '2026-10', { occupiedNights: 20, revenueCents: 100000 }),
      row(A3, '2026-10', { availableNights: 0, revenueCents: 5000 }),
    ],
    APARTMENTS,
    { ...ALL, from: 10, to: 10 },
    TENANTS
  )

  it('Standard nach Objekt und Wohnung', () => {
    expect(sortApartmentLines(v.apartments, null).map((l) => l.apartment.id)).toEqual([A1, A2, A3])
  })

  it('nach Umsatz absteigend und aufsteigend', () => {
    expect(sortApartmentLines(v.apartments, { key: 'revenue', dir: 'desc' }).map((l) => l.apartment.id)).toEqual([A1, A2, A3])
    expect(sortApartmentLines(v.apartments, { key: 'revenue', dir: 'asc' }).map((l) => l.apartment.id)).toEqual([A3, A2, A1])
  })

  it('unbekannte Auslastung immer am Ende', () => {
    expect(sortApartmentLines(v.apartments, { key: 'occupancy', dir: 'asc' }).map((l) => l.apartment.id)).toEqual([A1, A2, A3])
    expect(sortApartmentLines(v.apartments, { key: 'occupancy', dir: 'desc' }).map((l) => l.apartment.id)).toEqual([A2, A1, A3])
  })

  it('Klickfolge absteigend, aufsteigend, zurück', () => {
    expect(nextApartmentSort(null, 'revenue')).toEqual({ key: 'revenue', dir: 'desc' })
    expect(nextApartmentSort({ key: 'revenue', dir: 'desc' }, 'revenue')).toEqual({ key: 'revenue', dir: 'asc' })
    expect(nextApartmentSort({ key: 'revenue', dir: 'asc' }, 'revenue')).toBeNull()
    expect(nextApartmentSort({ key: 'revenue', dir: 'asc' }, 'rate')).toEqual({ key: 'rate', dir: 'desc' })
  })
})

describe('Gästeherkunft', () => {
  const origin = (country: string, guestNights: number, over: Partial<StatsOriginRow> = {}): StatsOriginRow => ({
    apartmentId: A1,
    country,
    previous: false,
    arrivals: 1,
    guestNights,
    revenueCents: guestNights * 1000,
    ...over,
  })
  const name = (c: string) => c

  it('Top 10 nach Gästenächten, Rest als „Übrige Länder“', () => {
    const codes = ['AT', 'DE', 'CH', 'IT', 'NL', 'BE', 'FR', 'GB', 'US', 'CZ', 'HU', 'PL', 'SK']
    const rows = codes.map((c, i) => origin(c, 100 - i))
    const v = buildOrigin(rows, new Set([A1]), name)
    expect(v.top).toHaveLength(10)
    expect(v.top[0].country).toBe('AT')
    expect(v.rest.map((l) => l.country)).toEqual(['HU', 'PL', 'SK'])
    expect(v.restSum?.current.guestNights).toBe(88 + 89 + 90)
    expect(v.total.current.guestNights).toBe(codes.reduce((s, _, i) => s + 100 - i, 0))
  })

  it('Anteil an den Gästenächten; Vorjahr je Land; Länder nur im Vorjahr fehlen', () => {
    const v = buildOrigin([origin('DE', 30), origin('AT', 10), origin('DE', 20, { previous: true }), origin('NL', 5, { previous: true })], new Set([A1]), name)
    expect(v.top.map((l) => l.country)).toEqual(['DE', 'AT'])
    expect(v.top[0].share).toBeCloseTo(0.75)
    expect(v.top[0].previous.guestNights).toBe(20)
    expect(v.restSum).toBeNull()
    expect(v.previousKnown).toBe(true)
  })

  it('Wohnungsfilter wirkt', () => {
    const v = buildOrigin([origin('DE', 30), origin('AT', 10, { apartmentId: A2 })], new Set([A2]), name)
    expect(v.top.map((l) => l.country)).toEqual(['AT'])
  })

  it('Ankünfte ohne Gästenächte (Anreise im Zeitraum) zählen', () => {
    const v = buildOrigin([origin('DE', 0, { arrivals: 2, revenueCents: 0 })], new Set([A1]), name)
    expect(v.top).toHaveLength(1)
    expect(v.top[0].share).toBeNull()
  })
})

describe('Diagramm', () => {
  it('schöne Achse für Beträge', () => {
    expect(niceScale(843200)).toEqual({ max: 1000000, ticks: [0, 250000, 500000, 750000, 1000000] })
    expect(niceScale(0).max).toBeGreaterThan(0)
  })

  it('Auslastung mit fester Achse, Vorjahr nur wenn bekannt', () => {
    const v = buildStats([row(A1, '2026-10', { occupiedNights: 31 }), row(A1, '2026-11', { availableNights: 30, occupiedNights: 15 })], APARTMENTS, { ...ALL, from: 10, to: 11 }, TENANTS)
    const c = chartModel(v, 'occupancy')
    expect(c.scale.max).toBe(1)
    expect(c.bars.map((b) => b.currentShare)).toEqual([1, 0.5])
    expect(c.bars[0].previous).toBeNull()
    expect(c.previousKnown).toBe(false)
  })

  it('negativer Umsatz als leerer Balken', () => {
    const v = buildStats([row(A1, '2026-10', { revenueCents: -5000 })], APARTMENTS, { ...ALL, from: 10, to: 10 }, TENANTS)
    expect(chartModel(v, 'revenue').bars[0].currentShare).toBe(0)
  })
})

describe('CSV', () => {
  const labels = { columns: ['Kunde', 'Monat', 'Objekt', 'Wohnung', 'Verfügbare Nächte', 'Belegte Nächte', 'Gesperrte Nächte', 'Auslastung (%)', 'Umsatz brutto', 'USt', 'Gästenächte', 'Ankünfte'] }

  it('eine Zeile je Wohnung und Monat, sortiert, ohne Summen und Vorjahr', () => {
    const csv = buildStatsCsv(
      [
        row(A2, '2026-10', { occupiedNights: 31, revenueCents: 103000, revenueVatCents: 9364, guestNights: 62, arrivals: 2 }),
        row(A1, '2026-10', { occupiedNights: 10 }),
        row(A1, '2026-11', { availableNights: 30, occupiedNights: 0 }),
        row(A1, '2025-10', { occupiedNights: 5 }),
        row(A3, '2026-10', { availableNights: 0 }),
      ],
      APARTMENTS,
      { ...ALL, from: 10, to: 11 },
      labels
    )
    const lines = csv.slice(1).trimEnd().split('\r\n')
    expect(csv.startsWith('﻿')).toBe(true)
    expect(lines).toEqual([
      'Kunde;Monat;Objekt;Wohnung;Verfügbare Nächte;Belegte Nächte;Gesperrte Nächte;Auslastung (%);Umsatz brutto;USt;Gästenächte;Ankünfte',
      'Alpenhof GmbH;2026-10;Haus Alpenblick;Top 1;31;10;0;32,3;0,00;0,00;0;0',
      'Alpenhof GmbH;2026-10;Haus Alpenblick;Top 2;31;31;0;100,0;1030,00;93,64;62;2',
      'Alpenhof GmbH;2026-11;Haus Alpenblick;Top 1;30;0;0;0,0;0,00;0,00;0;0',
    ])
  })

  it('Formelschutz und Strichpunkt im Namen', () => {
    const apts: StatsApartment[] = [{ id: A1, name: '=Top;1', propertyId: P1, propertyName: 'Haus', archived: false, tenantId: T1, tenantName: 'Alpenhof GmbH' }]
    const csv = buildStatsCsv([row(A1, '2026-10')], apts, { ...ALL, from: 10, to: 10 }, labels)
    expect(csv).toContain(`"'=Top;1"`)
  })
})

describe('Mehrere Kunden (refine 2026-11-08)', () => {
  const P3 = '44444444-4444-4444-8444-444444444444'
  const B1 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1'
  const TWO: StatsTenant[] = [
    { id: T1, name: 'Alpenhof GmbH' },
    { id: T2, name: 'Bergblick KG' },
  ]
  const APTS: StatsApartment[] = [...APARTMENTS, { id: B1, name: 'Top 1', propertyId: P3, propertyName: 'Haus Berg', archived: false, tenantId: T2, tenantName: 'Bergblick KG' }]
  const rows = [row(A1, '2026-10', { occupiedNights: 10, revenueCents: 100000 }), row(B1, '2026-10', { occupiedNights: 20, revenueCents: 200000 }), row(B1, '2025-10', { occupiedNights: 5 })]
  const OCT: StatsFilters = { ...ALL, from: 10, to: 10 }

  it('Kunde aus der Adresse; fremder Kunde → alle; bei nur einem Inhaber-Kunden immer alle', () => {
    expect(parseStatsFilters({ kunde: T2 }, TODAY).tenant).toBe(T2)
    expect(resolveStatsFilters({ ...ALL, tenant: T2 }, APTS, TWO).tenant).toBe(T2)
    expect(resolveStatsFilters({ ...ALL, tenant: '55555555-5555-4555-8555-555555555555' }, APTS, TWO).tenant).toBeNull()
    expect(resolveStatsFilters({ ...ALL, tenant: T1 }, APTS, TENANTS).tenant).toBeNull()
    expect(statsHref({ ...ALL, tenant: T2 })).toBe(`/auswertungen?jahr=2026&von=1&bis=12&kunde=${T2}`)
  })

  it('Objekt eines anderen Kunden als des gewählten → alle Objekte', () => {
    expect(resolveStatsFilters({ ...ALL, tenant: T2, property: P1 }, APTS, TWO).property).toBeNull()
    expect(resolveStatsFilters({ ...ALL, tenant: T2, property: P3 }, APTS, TWO).property).toBe(P3)
  })

  it('alle Kunden: Summe, Je Kunde mit Vorjahr, Kundenname anzeigen', () => {
    const v = buildStats(rows, APTS, OCT, TWO)
    expect(v.multiTenant).toBe(true)
    expect(v.totals.current.occupiedNights).toBe(30)
    expect(v.tenants.map((l) => [l.tenant.name, l.current.occupiedNights, l.previous.occupiedNights])).toEqual([
      ['Alpenhof GmbH', 10, 0],
      ['Bergblick KG', 20, 5],
    ])
    // nur Wohnungen mit Daten, nach Kunde geordnet
    expect(v.apartments.map((l) => `${l.apartment.tenantName}/${l.apartment.name}`)).toEqual(['Alpenhof GmbH/Top 1', 'Bergblick KG/Top 1'])
  })

  it('einzelner Kunde: nur dessen Zahlen, kein Je Kunde; mit Objektfilter ebenfalls kein Je Kunde', () => {
    const v = buildStats(rows, APTS, { ...OCT, tenant: T2 }, TWO)
    expect(v.multiTenant).toBe(false)
    expect(v.tenants).toEqual([])
    expect(v.totals.current.occupiedNights).toBe(20)
    expect(buildStats(rows, APTS, { ...OCT, property: P1 }, TWO).tenants).toEqual([])
  })

  it('Kunden ohne Daten stehen in Je Kunde mit 0', () => {
    const v = buildStats([row(A1, '2026-10', { occupiedNights: 10 })], APTS, OCT, TWO)
    expect(v.tenants.find((l) => l.tenant.id === T2)?.current.occupiedNights).toBe(0)
  })

  it('Gruppierung nach Kunde, dann Objekt', () => {
    expect(groupProperties(APTS).map((p) => `${p.tenantName}/${p.name}`)).toEqual(['Alpenhof GmbH/Haus Alpenblick', 'Alpenhof GmbH/Zentrum', 'Bergblick KG/Haus Berg'])
    expect(withTenant('Haus Berg', 'Bergblick KG', true)).toBe('Haus Berg (Bergblick KG)')
    expect(withTenant('Haus Berg', 'Bergblick KG', false)).toBe('Haus Berg')
  })

  it('Dateiname: Alle-Kunden, Kundenname bzw. wie bisher', () => {
    expect(statsFileName('pdf', OCT, APTS, TWO, TODAY)).toBe('Auswertung_2026-10_Alle-Kunden_Stand-2026-11-08.pdf')
    expect(statsFileName('pdf', { ...OCT, tenant: T2 }, APTS, TWO, TODAY)).toBe('Auswertung_2026-10_Bergblick-KG_Stand-2026-11-08.pdf')
    expect(statsFileName('csv', { ...OCT, tenant: T2, property: P3 }, APTS, TWO, TODAY)).toBe('Auswertung_2026-10_Haus-Berg_Stand-2026-11-08.csv')
  })

  it('CSV sortiert nach Monat, Kunde, Objekt, Wohnung mit Kunde zuerst', () => {
    const csv = buildStatsCsv(rows, APTS, OCT, { columns: ['Kunde', 'Monat'] })
    const lines = csv.slice(1).trimEnd().split('\r\n').slice(1)
    expect(lines.map((l) => l.split(';').slice(0, 4).join(';'))).toEqual(['Alpenhof GmbH;2026-10;Haus Alpenblick;Top 1', 'Bergblick KG;2026-10;Haus Berg;Top 1'])
  })
})
