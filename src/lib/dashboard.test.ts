import { describe, expect, it } from 'vitest'

import { byApartment, leadKind, parseTenantFilter, sortOpenInvoices, type TaxMonthRow, taxPeriods, touristTaxTable } from '@/lib/dashboard'

const A = '11111111-1111-1111-1111-111111111111'
const B = '22222222-2222-2222-2222-222222222222'
const C = '33333333-3333-3333-3333-333333333333'

describe('Kundenfilter', () => {
  it('Adresse gewinnt vor dem Cookie', () => {
    expect(parseTenantFilter(B, A, [A, B])).toBe(B)
    expect(parseTenantFilter('alle', A, [A, B])).toBeNull()
  })
  it('ohne Adresse gilt das Cookie', () => {
    expect(parseTenantFilter(undefined, A, [A, B])).toBe(A)
  })
  it('fremde oder ungültige Kunden zählen als „Alle Kunden“', () => {
    expect(parseTenantFilter(C, undefined, [A, B])).toBeNull()
    expect(parseTenantFilter(undefined, C, [A, B])).toBeNull()
    expect(parseTenantFilter('xyz', undefined, [A, B])).toBeNull()
    expect(parseTenantFilter(undefined, undefined, [A, B])).toBeNull()
  })
})

describe('Zeiträume der Ortstaxe', () => {
  it('am 07.11.2026: Nov/Q4/2026 laufend, Okt/Q3/2025 abgelaufen', () => {
    const p = taxPeriods('2026-11-07')
    expect(p.current.map((x) => [x.kind, x.year, x.index])).toEqual([
      ['month', 2026, 11],
      ['quarter', 2026, 4],
      ['year', 2026, 0],
    ])
    expect(p.past.map((x) => [x.kind, x.year, x.index])).toEqual([
      ['month', 2026, 10],
      ['quarter', 2026, 3],
      ['year', 2025, 0],
    ])
    expect(p.past[1].months).toEqual(['2026-07', '2026-08', '2026-09'])
    expect(p.from).toBe('2025-01-01')
    expect(p.to).toBe('2026-12-31')
  })
  it('am 01.01.2027: Jän/Q1/2027 laufend, Dez/Q4/2026 abgelaufen', () => {
    const p = taxPeriods('2027-01-01')
    expect(p.current[0].months).toEqual(['2027-01'])
    expect(p.current[1].months).toEqual(['2027-01', '2027-02', '2027-03'])
    expect(p.past[0].months).toEqual(['2026-12'])
    expect(p.past[1].months).toEqual(['2026-10', '2026-11', '2026-12'])
    expect(p.past[2].year).toBe(2026)
  })
  it('am 01.04.2026: abgelaufenes Quartal ist Q1', () => {
    const p = taxPeriods('2026-04-01')
    expect(p.current[1].index).toBe(2)
    expect(p.past[1].index).toBe(1)
    expect(p.past[0].months).toEqual(['2026-03'])
  })
})

describe('Ortstaxe-Tabelle', () => {
  const periods = taxPeriods('2026-11-07')
  const row = (tenantId: string, municipalityId: string, name: string, month: string, amountCents: number): TaxMonthRow => ({
    tenantId,
    municipalityId,
    municipalityName: name,
    month,
    amountCents,
  })
  const tenants = [
    { id: B, name: 'Kunde B' },
    { id: A, name: 'Kunde A' },
  ]

  it('verteilt Monatssummen auf die sechs Zeiträume', () => {
    const [block] = touristTaxTable([row(A, 'g1', 'Saalbach', '2026-09', 500), row(A, 'g1', 'Saalbach', '2026-10', 1000)], periods, tenants)
    expect(block.municipalities[0].current).toEqual([0, 1000, 1500])
    expect(block.municipalities[0].past).toEqual([1000, 500, 0])
    expect(block.total).toBeNull()
  })

  it('Kunden und Gemeinden alphabetisch, „Gesamt“ nur bei mehreren Gemeinden, ohne Betrag fällt weg', () => {
    const blocks = touristTaxTable(
      [
        row(B, 'g3', 'Saalbach', '2026-11', 100),
        row(A, 'g2', 'Zell am See', '2026-11', 200),
        row(A, 'g1', 'Kaprun', '2025-03', 300),
        row(A, 'g4', 'Leogang', '2023-01', 999),
      ],
      periods,
      tenants
    )
    expect(blocks.map((b) => b.tenantName)).toEqual(['Kunde A', 'Kunde B'])
    expect(blocks[0].municipalities.map((m) => m.name)).toEqual(['Kaprun', 'Zell am See'])
    expect(blocks[0].total?.current).toEqual([200, 200, 200])
    expect(blocks[0].total?.past).toEqual([0, 0, 300])
    expect(blocks[1].total).toBeNull()
  })

  it('ohne Beträge keine Blöcke', () => {
    expect(touristTaxTable([], periods, tenants)).toEqual([])
  })
})

describe('Offene Rechnungen', () => {
  it('überfällige zuerst, dann nach Fälligkeit bzw. Rechnungsdatum', () => {
    const rows = sortOpenInvoices([
      { number: '3', overdue: false, nextDue: '2026-12-01', invoiceDate: '2026-11-01' },
      { number: '1', overdue: false, nextDue: null, invoiceDate: '2026-10-01' },
      { number: '2', overdue: true, nextDue: '2026-11-01', invoiceDate: '2026-10-20' },
    ])
    expect(rows.map((r) => r.number)).toEqual(['2', '1', '3'])
  })
})

describe('Heute', () => {
  it('sortiert nach Kunde, dann Wohnung (Zahlen natürlich)', () => {
    const rows = [
      { tenantName: 'B', apartmentLabel: 'Haus · Top 1' },
      { tenantName: 'A', apartmentLabel: 'Haus · Top 10' },
      { tenantName: 'A', apartmentLabel: 'Haus · Top 2' },
    ].sort(byApartment)
    expect(rows.map((r) => `${r.tenantName} ${r.apartmentLabel}`)).toEqual(['A Haus · Top 2', 'A Haus · Top 10', 'B Haus · Top 1'])
  })
  it('Unterzeile', () => {
    expect(leadKind({ arrivals: [], departures: [], apartments: 0 })).toBe('none')
    expect(leadKind({ arrivals: [], departures: [], apartments: 3 })).toBe('noMovement')
    expect(leadKind({ arrivals: [{} as never], departures: [], apartments: 3 })).toBe('movement')
  })
})
