import { describe, expect, it } from 'vitest'

import { personPriceGroups } from '@/lib/apartments'
import {
  addDays,
  amountInput,
  billableNights,
  billedNightsCents,
  bookingListHref,
  bookingState,
  type BookingRow,
  filterRows,
  findConflicts,
  formatBookingNumber,
  guestSheetKey,
  isIsoDate,
  monthRange,
  nightsBetween,
  overCapacity,
  parseAmountCents,
  parseBookingFilters,
  rangesOverlap,
  shiftMonth,
  suggestedNightsCents,
  taxNights,
  todayIso,
  totalCents,
  touchesMonth,
} from '@/lib/bookings'

const TODAY = '2026-10-26'

describe('Nächte und Daten', () => {
  it('zählt Nächte zwischen Anreise und Abreise, auch über Monats- und Jahreswechsel und Zeitumstellung', () => {
    expect(nightsBetween('2026-10-24', '2026-10-27')).toBe(3)
    expect(nightsBetween('2026-12-30', '2027-01-02')).toBe(3)
    expect(nightsBetween('2026-03-28', '2026-03-30')).toBe(2)
  })

  it('rechnet Tage weiter', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('erkennt gültige Kalenderdaten', () => {
    expect(isIsoDate('2026-02-28')).toBe(true)
    expect(isIsoDate('2026-02-30')).toBe(false)
    expect(isIsoDate('26-02-01')).toBe(false)
  })

  it('liefert das heutige Datum in Wien', () => {
    // 23:30 UTC am 25. Oktober ist in Wien schon der 26. (Sommerzeit endet erst um 1:00 UTC)
    expect(todayIso(new Date('2026-10-24T22:30:00Z'))).toBe('2026-10-25')
    expect(todayIso(new Date('2026-10-25T23:30:00Z'))).toBe('2026-10-26')
  })
})

describe('Überschneidung', () => {
  const a = { arrival: '2026-11-01', departure: '2026-11-05' }

  it('Abreisetag = Anreisetag ist keine Überschneidung (Wechseltag)', () => {
    expect(rangesOverlap(a, { arrival: '2026-11-05', departure: '2026-11-08' })).toBe(false)
    expect(rangesOverlap(a, { arrival: '2026-10-28', departure: '2026-11-01' })).toBe(false)
  })

  it('erkennt teilweise und vollständige Überschneidungen', () => {
    expect(rangesOverlap(a, { arrival: '2026-11-04', departure: '2026-11-06' })).toBe(true)
    expect(rangesOverlap(a, { arrival: '2026-11-02', departure: '2026-11-03' })).toBe(true)
    expect(rangesOverlap(a, { arrival: '2026-10-01', departure: '2026-12-01' })).toBe(true)
  })

  const entry = (id: string, over: Partial<{ apartmentId: string; arrival: string; departure: string; kind: 'booking' | 'option' | 'block'; cancelledAt: string | null; optionUntil: string | null }>) => ({
    id,
    apartmentId: 'w1',
    arrival: '2026-11-03',
    departure: '2026-11-06',
    kind: 'booking' as const,
    cancelledAt: null,
    optionUntil: null,
    ...over,
  })

  it('zählt nur aktive Einträge derselben Wohnung, ohne den Eintrag selbst', () => {
    const others = [
      entry('b1', {}),
      entry('b2', { apartmentId: 'w2' }),
      entry('b3', { cancelledAt: '2026-10-20T10:00:00Z' }),
      entry('b4', { kind: 'option', optionUntil: '2026-10-25' }),
      entry('b5', { kind: 'option', optionUntil: TODAY }),
      entry('b6', { kind: 'block' }),
      entry('self', {}),
    ]
    const hits = findConflicts({ id: 'self', apartmentId: 'w1', ...a }, others, TODAY).map((o) => o.id)
    expect(hits).toEqual(['b1', 'b5', 'b6'])
  })
})

describe('Zustand', () => {
  it('storniert vor verfallen vor aktiv', () => {
    expect(bookingState({ kind: 'booking', cancelledAt: '2026-10-01T00:00:00Z', optionUntil: null }, TODAY)).toBe('cancelled')
    expect(bookingState({ kind: 'option', cancelledAt: null, optionUntil: '2026-10-25' }, TODAY)).toBe('expired')
    expect(bookingState({ kind: 'option', cancelledAt: null, optionUntil: TODAY }, TODAY)).toBe('active')
    expect(bookingState({ kind: 'block', cancelledAt: null, optionUntil: null }, TODAY)).toBe('active')
  })
})

describe('Personen und Preis', () => {
  it('warnt bei mehr Personen als die Wohnung aufnimmt', () => {
    expect(overCapacity(2, [4], 3)).toBeNull()
    expect(overCapacity(2, [4, 1], 3)).toEqual({ persons: 4, maxGuests: 3, adults: 2, maxAdults: null })
  })

  it('warnt bei mehr Erwachsenen als erlaubt; Kinder dürfen Erwachsenenplätze belegen (PROJ-27)', () => {
    expect(overCapacity(3, [], 4, 2)).toEqual({ persons: 3, maxGuests: 4, adults: 3, maxAdults: 2 })
    expect(overCapacity(1, [3, 5, 8], 4, 2)).toBeNull()
    expect(overCapacity(2, [3, 5], 4, 2)).toBeNull()
    // Kind älter als die letzte Preisstufe zahlt den Erwachsenenpreis, zählt aber als Kind
    expect(overCapacity(2, [14], 4, 2)).toBeNull()
  })

  const flat = { priceMode: 'apartment' as const, priceCents: 12000, adultPriceCents: null, childPrices: [] }
  // Beispiel der Spec: Erwachsene € 50, bis 2 Jahre € 0, bis 11 Jahre € 20
  const perPerson = {
    priceMode: 'person' as const,
    priceCents: 12000,
    adultPriceCents: 5000,
    childPrices: [
      { toAge: 2, priceCents: 0 },
      { toAge: 11, priceCents: 2000 },
    ],
  }

  it('schlägt bei Wohnungspreis Preis × Nächte vor, unabhängig von den Personen', () => {
    expect(suggestedNightsCents(flat, 3, 2, [4])).toBe(36000)
    expect(suggestedNightsCents({ ...flat, priceCents: null }, 3, 2, [])).toBeNull()
    expect(suggestedNightsCents(flat, 0, 2, [])).toBeNull()
  })

  it('liefert keinen Vorschlag über dem Höchstbetrag von € 1.000.000 (QA BUG-2 PROJ-27)', () => {
    expect(suggestedNightsCents({ ...flat, priceCents: 1_000_000 }, 100, 1, [])).toBe(100_000_000)
    expect(suggestedNightsCents({ ...flat, priceCents: 1_000_000 }, 101, 1, [])).toBeNull()
    expect(suggestedNightsCents({ ...perPerson, adultPriceCents: 1_000_000 }, 365, 50, [])).toBeNull()
  })

  it('schlägt bei Personenpreisen Nächte × Summe der Personenpreise vor (PROJ-27)', () => {
    // 3 × (2 × 50 + 0 + 20 + 50) = 510
    expect(suggestedNightsCents(perPerson, 3, 2, [1, 8, 14])).toBe(51000)
    // Altersgrenze einschließlich: 2 → gratis, 11 → Kinderpreis, 12 → Erwachsenenpreis
    expect(suggestedNightsCents(perPerson, 1, 0, [2, 11, 12])).toBe(0 + 2000 + 5000)
    // ohne Stufen zahlen Kinder den Erwachsenenpreis
    expect(suggestedNightsCents({ ...perPerson, childPrices: [] }, 2, 1, [5])).toBe(2 * 10000)
    expect(suggestedNightsCents({ ...perPerson, adultPriceCents: null }, 3, 2, [])).toBeNull()
  })

  it('gruppiert Personen nach Preis für die Anzeige der Rechnung', () => {
    expect(personPriceGroups(perPerson, 2, [1, 8, 14])).toEqual([
      { count: 3, cents: 5000 },
      { count: 1, cents: 0 },
      { count: 1, cents: 2000 },
    ])
  })

  it('Endbetrag = Übernachtungen + Zusatzkosten', () => {
    expect(totalCents({ nightsCents: 36000, charges: [{ label: 'Reinigung', amountCents: 6000 }, { label: 'Haustier', amountCents: 1550 }] })).toBe(43550)
  })

  it('liest Beträge mit Komma, Punkt und Tausenderpunkt', () => {
    expect(parseAmountCents('125')).toBe(12500)
    expect(parseAmountCents('125,5')).toBe(12550)
    expect(parseAmountCents('125.50')).toBe(12550)
    expect(parseAmountCents('1.250')).toBe(125000)
    expect(parseAmountCents('1.250,90')).toBe(125090)
    expect(parseAmountCents('€ 80')).toBe(8000)
    expect(parseAmountCents('')).toBeNull()
    expect(parseAmountCents('-5')).toBeNaN()
    expect(parseAmountCents('12,345')).toBeNaN()
    // PROJ-31: Eingabewert mit Tausenderpunkt und zwei Nachkommastellen
    expect(amountInput(125090)).toBe('1.250,90')
    expect(amountInput(8000)).toBe('80,00')
    expect(amountInput(0)).toBe('0,00')
    expect(amountInput(null)).toBe('')
    expect(parseAmountCents(amountInput(123456789))).toBe(123456789)
  })
})

describe('Buchungsnummer', () => {
  it('JJJJ-NNNN, ab 10.000 fünfstellig', () => {
    expect(formatBookingNumber(2026, 42)).toBe('2026-0042')
    expect(formatBookingNumber(2027, 10001)).toBe('2027-10001')
  })
})

describe('Monat und Filter', () => {
  it('blättert über Jahresgrenzen', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
    expect(monthRange('2026-10')).toEqual({ from: '2026-10-01', to: '2026-11-01' })
  })

  it('ein Eintrag gehört zu jedem Monat, in den eine seiner Nächte fällt', () => {
    expect(touchesMonth({ arrival: '2026-10-30', departure: '2026-11-02' }, '2026-11')).toBe(true)
    expect(touchesMonth({ arrival: '2026-10-28', departure: '2026-11-01' }, '2026-11')).toBe(false)
  })

  it('liest Filter aus der Adresse und ignoriert ungültige Werte', () => {
    expect(parseBookingFilters({}, TODAY)).toEqual({ month: '2026-10', apartment: null, kind: null, state: null, source: null, query: '' })
    expect(parseBookingFilters({ monat: '2027-02', art: 'sperre', zustand: 'storniert', q: ' Huber ' }, TODAY)).toMatchObject({
      month: '2027-02',
      kind: 'block',
      state: 'cancelled',
      query: 'Huber',
    })
    expect(parseBookingFilters({ monat: '2027-13', art: 'x', zustand: 'aktiv', wohnung: 'abc' }, TODAY)).toMatchObject({
      month: '2026-10',
      kind: null,
      state: null,
      apartment: null,
    })
  })

  it('baut die Adresse ohne Standardwerte', () => {
    expect(bookingListHref({ month: '2026-10' }, TODAY)).toBe('/buchungen')
    expect(bookingListHref({ month: '2026-11', kind: 'option', state: 'expired' }, TODAY)).toBe('/buchungen?monat=2026-11&art=option&zustand=verfallen')
  })

  it('zeigt ohne Zustandsfilter nur aktive Einträge des Monats', () => {
    const row = (id: string, over: Partial<BookingRow>): BookingRow => ({
      id,
      kind: 'booking',
      number: null,
      apartmentId: 'w1',
      apartmentLabel: 'Haus · Top 1',
      arrival: '2026-10-10',
      departure: '2026-10-12',
      guestName: null,
      blockReason: null,
      guestSheetNumber: null,
      source: 'none',
      persons: 2,
      state: 'active',
      optionUntil: null,
      totalCents: null,
      overlapping: false,
      priceReview: false,
      ...over,
    })
    const rows = [row('a', {}), row('b', { state: 'cancelled' }), row('c', { arrival: '2026-11-03', departure: '2026-11-05' }), row('d', { apartmentId: 'w2' })]
    const base = parseBookingFilters({}, TODAY)
    expect(filterRows(rows, base, false).map((r) => r.id)).toEqual(['a', 'd'])
    expect(filterRows(rows, { ...base, state: 'cancelled' }, false).map((r) => r.id)).toEqual(['b'])
    expect(filterRows(rows, { ...base, apartment: 'w2' }, false).map((r) => r.id)).toEqual(['d'])
    expect(filterRows(rows, base, true).map((r) => r.id)).toEqual(['a', 'c', 'd'])
  })

  it('filtert nach Buchungsquelle, Sperren nie (PROJ-30)', () => {
    const row = (id: string, over: Partial<BookingRow>): BookingRow => ({
      id,
      kind: 'booking',
      number: null,
      apartmentId: 'w1',
      apartmentLabel: 'Haus · Top 1',
      arrival: '2026-10-10',
      departure: '2026-10-12',
      guestName: null,
      blockReason: null,
      guestSheetNumber: null,
      source: 'none',
      persons: 2,
      state: 'active',
      optionUntil: null,
      totalCents: null,
      overlapping: false,
      priceReview: false,
      ...over,
    })
    const rows = [row('a', { source: 'booking_com' }), row('b', { kind: 'option', source: 'booking_com' }), row('c', {}), row('d', { kind: 'block' })]
    const base = parseBookingFilters({}, TODAY)
    expect(filterRows(rows, { ...base, source: 'booking_com' }, false).map((r) => r.id)).toEqual(['a', 'b'])
    expect(filterRows(rows, { ...base, source: 'none' }, false).map((r) => r.id)).toEqual(['c'])
  })

  it('liest und schreibt die Quelle in der Adresse', () => {
    expect(parseBookingFilters({ quelle: 'booking-com' }, TODAY).source).toBe('booking_com')
    expect(parseBookingFilters({ quelle: 'airbnb' }, TODAY).source).toBeNull()
    expect(bookingListHref({ month: '2026-11', source: 'google_ads', state: 'cancelled' }, TODAY)).toBe(
      '/buchungen?monat=2026-11&zustand=storniert&quelle=google-ads'
    )
  })
})

describe('Abreise geplant / tatsächlich (PROJ-30)', () => {
  const stay = { arrival: '2026-11-01', plannedDeparture: '2026-11-06' }

  it('rechnet bis zur späteren Abreise ab, die Ortstaxe bis zur tatsächlichen', () => {
    expect(billableNights({ ...stay, departure: '2026-11-06' })).toBe(5)
    expect(billableNights({ ...stay, departure: '2026-11-07' })).toBe(6)
    expect(billableNights({ ...stay, departure: '2026-11-04' })).toBe(5)
    expect(taxNights({ arrival: stay.arrival, departure: '2026-11-04' })).toBe(3)
  })

  it('rechnet den vereinbarten Preis bei Verlängerung anteilig hoch, sonst bleibt er', () => {
    expect(billedNightsCents(50000, 5, 6)).toBe(60000)
    expect(billedNightsCents(50000, 5, 5)).toBe(50000)
    expect(billedNightsCents(33333, 3, 4)).toBe(44444)
    expect(billedNightsCents(10000, 3, 4)).toBe(13333)
    expect(billedNightsCents(0, 3, 5)).toBe(0)
  })

  it('vergleicht Gästeblattnummern ohne Groß/Klein und Rand-Leerzeichen', () => {
    expect(guestSheetKey(' a-123 ')).toBe(guestSheetKey('A-123'))
    expect(guestSheetKey(null)).toBe('')
  })
})
