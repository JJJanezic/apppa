import { fireEvent, render, screen, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { describe, expect, it } from 'vitest'

import messages from '../../../messages/de.json'
import { buildOrigin, buildStats, type StatsApartment, type StatsMonthRow, type StatsOriginRow } from '@/lib/statistics'

import { StatsApartmentTable } from './stats-apartment-table'
import { StatsChart } from './stats-chart'
import { StatsKpis } from './stats-kpis'
import { StatsMonthTable } from './stats-month-table'
import { StatsOriginTable } from './stats-origin-table'

const P1 = '11111111-1111-4111-8111-111111111111'
const A1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
const A2 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
const APARTMENTS: StatsApartment[] = [
  { id: A1, name: 'Top 1', propertyId: P1, propertyName: 'Haus Alpenblick', archived: false },
  { id: A2, name: 'Top 2', propertyId: P1, propertyName: 'Haus Alpenblick', archived: true },
]

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

const ROWS = [
  row(A1, '2026-10', { occupiedNights: 20, blockedNights: 2, revenueCents: 220000, revenueVatCents: 20000, guestNights: 40, arrivals: 4, bookings: 2, stayNights: 20 }),
  row(A2, '2026-10', { occupiedNights: 11, revenueCents: 110000, revenueVatCents: 10000, guestNights: 22, arrivals: 2, bookings: 1, stayNights: 11 }),
  row(A1, '2025-10', { occupiedNights: 15, revenueCents: 150000, revenueVatCents: 13636 }),
]
const VIEW = buildStats(ROWS, APARTMENTS, { year: 2026, from: 10, to: 10, property: null, apartment: null })

const wrap = (ui: React.ReactNode) => render(<NextIntlClientProvider locale="de-AT" messages={messages}>{ui}</NextIntlClientProvider>)

describe('Kacheln', () => {
  it('zeigt Auslastung, Umsatz mit USt und Vorjahr mit Veränderung', () => {
    wrap(<StatsKpis totals={VIEW.totals} />)
    const kpis = screen.getByLabelText('Kennzahlen')
    expect(kpis).toHaveTextContent('50 %')
    expect(kpis).toHaveTextContent('31 von 62 Nächten, 2 gesperrt')
    expect(kpis).toHaveTextContent('inkl. € 300,00 USt')
    expect(kpis).toHaveTextContent('Vorjahr 48 %')
    expect(kpis).toHaveTextContent('+2 Pp.')
    expect(kpis).toHaveTextContent('+120 %')
    expect(kpis).toHaveTextContent('Ø 10,3 Nächte')
    expect(kpis).toHaveTextContent('6 Ankünfte')
  })

  it('ohne Vorjahresdaten „Vorjahr –“', () => {
    const v = buildStats([ROWS[0]], APARTMENTS, { year: 2026, from: 10, to: 10, property: null, apartment: null })
    wrap(<StatsKpis totals={v.totals} />)
    expect(screen.getAllByText('Vorjahr –')).toHaveLength(5)
  })
})

describe('Diagramm', () => {
  it('Umschalter und Werte beim Antippen', () => {
    wrap(<StatsChart view={VIEW} year={2026} />)
    expect(screen.getByRole('img', { name: /Auslastung je Monat/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Umsatz' }))
    expect(screen.getByRole('button', { name: 'Umsatz' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('img', { name: /Umsatz je Monat/ })).toBeInTheDocument()
    expect(screen.getByText('Vorjahr (2025)')).toBeInTheDocument()
  })
})

describe('Tabellen', () => {
  it('je Monat ohne Summenzeile bei einem Monat', () => {
    wrap(<StatsMonthTable view={VIEW} year={2026} />)
    const table = screen.getByRole('region', { name: 'Werte je Monat' })
    expect(within(table).getByRole('rowheader', { name: 'Oktober 2026' })).toBeInTheDocument()
    expect(within(table).queryByRole('rowheader', { name: 'Gesamt' })).toBeNull()
  })

  it('je Wohnung gruppiert, nach Klick sortiert', () => {
    wrap(<StatsApartmentTable lines={VIEW.apartments} />)
    expect(screen.getByText('Haus Alpenblick')).toBeInTheDocument()
    expect(screen.getByText('archiviert')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Umsatz/ }))
    expect(screen.getByRole('columnheader', { name: /Umsatz/ })).toHaveAttribute('aria-sort', 'descending')
    const names = screen.getAllByRole('rowheader').map((r) => r.textContent)
    expect(names[0]).toContain('Top 1')
  })

  it('Gästeherkunft mit „Übrige Länder“ aufklappbar', () => {
    const codes = ['AT', 'DE', 'CH', 'IT', 'NL', 'BE', 'FR', 'GB', 'US', 'CZ', 'HU', 'PL']
    const rows: StatsOriginRow[] = codes.map((country, i) => ({ apartmentId: A1, country, previous: false, arrivals: 1, guestNights: 50 - i, revenueCents: 1000 }))
    const view = buildOrigin(rows, new Set([A1]), (c) => c)
    wrap(<StatsOriginTable view={view} />)
    expect(screen.getByText('Österreich')).toBeInTheDocument()
    const toggle = screen.getByRole('button', { name: /Übrige Länder \(2\)/ })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Polen')).not.toBeVisible()
    fireEvent.click(toggle)
    expect(screen.getByText('Polen')).toBeVisible()
  })
})
