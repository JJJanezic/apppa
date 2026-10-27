import { describe, expect, it } from 'vitest'

import {
  type CalendarApartment,
  calendarCookieValue,
  calendarDays,
  type CalendarEntry,
  calendarHref,
  calendarProperties,
  calendarRange,
  dayAt,
  dayItems,
  layoutRow,
  monthCells,
  parseCalendarState,
  visibleApartments,
  weekdayIndex,
} from '@/lib/calendar'

const TODAY = '2026-10-26'
const P1 = '11111111-1111-1111-1111-111111111111'
const P2 = '22222222-2222-2222-2222-222222222222'
const ENTRY = '33333333-3333-3333-3333-333333333333'

const apt = (id: string, extra: Partial<CalendarApartment> = {}): CalendarApartment => ({
  id,
  name: id,
  propertyId: P1,
  propertyName: 'Haus',
  archived: false,
  ...extra,
})

const entry = (id: string, arrival: string, departure: string, extra: Partial<CalendarEntry> = {}): CalendarEntry => ({
  id,
  apartmentId: 'a1',
  kind: 'booking',
  channel: 'direct',
  source: 'none',
  arrival,
  departure,
  guestLastName: 'Huber',
  guestName: 'Anna Huber',
  persons: 2,
  blockReason: null,
  ...extra,
})

describe('Zustand aus Adresse und Cookie', () => {
  it('ohne Angaben: Zeitleiste ab heute − 2, aktueller Monat, heute gewählt, alle Objekte', () => {
    expect(parseCalendarState({}, undefined, TODAY)).toEqual({
      view: 'timeline',
      start: '2026-10-24',
      month: '2026-10',
      day: TODAY,
      property: null,
      entry: null,
    })
  })

  it('Cookie liefert Ansicht und Objekt, die Adresse gewinnt', () => {
    const cookie = calendarCookieValue('month', P1)
    expect(parseCalendarState({}, cookie, TODAY)).toMatchObject({ view: 'month', property: P1 })
    expect(parseCalendarState({ ansicht: 'zeitleiste', objekt: 'alle' }, cookie, TODAY)).toMatchObject({ view: 'timeline', property: null })
    expect(parseCalendarState({ objekt: P2 }, cookie, TODAY)).toMatchObject({ property: P2 })
  })

  it('ignoriert ungültige Werte', () => {
    const state = parseCalendarState({ ansicht: 'jahr', ab: '2026-02-30', monat: '2026-13', tag: 'x', objekt: 'x', eintrag: '1' }, 'kaputt', TODAY)
    expect(state).toEqual(parseCalendarState({}, undefined, TODAY))
  })

  it('Tag außerhalb des Monats fällt auf den Monatsersten (oder heute im aktuellen Monat)', () => {
    expect(parseCalendarState({ monat: '2026-12', tag: '2026-10-03' }, undefined, TODAY)).toMatchObject({ month: '2026-12', day: '2026-12-01' })
    expect(parseCalendarState({ monat: '2026-10' }, undefined, TODAY)).toMatchObject({ day: TODAY })
    expect(parseCalendarState({ tag: '2026-11-05' }, undefined, TODAY)).toMatchObject({ month: '2026-11', day: '2026-11-05' })
  })

  it('Adresse enthält Ansicht und Objekt immer, Eintrag nur wenn offen', () => {
    const state = parseCalendarState({}, undefined, TODAY)
    expect(calendarHref('dashboard', state)).toBe('/?ansicht=zeitleiste&ab=2026-10-24&objekt=alle')
    expect(calendarHref('full', { ...state, view: 'month', property: P1, entry: ENTRY })).toBe(
      `/belegung?ansicht=monat&monat=2026-10&tag=${TODAY}&objekt=${P1}&eintrag=${ENTRY}`
    )
    expect(parseCalendarState(Object.fromEntries(new URLSearchParams(calendarHref('full', { ...state, entry: ENTRY }).split('?')[1])), undefined, TODAY)).toEqual({
      ...state,
      entry: ENTRY,
    })
  })
})

describe('Bereich je Ansicht', () => {
  const state = parseCalendarState({}, undefined, TODAY)
  it('Zeitleiste 14 bzw. 28 Tage', () => {
    expect(calendarRange(state, 'dashboard')).toEqual({ from: '2026-10-24', to: '2026-11-07' })
    expect(calendarRange(state, 'full')).toEqual({ from: '2026-10-24', to: '2026-11-21' })
  })
  it('Monat vom Ersten bis zum Ersten des Folgemonats', () => {
    expect(calendarRange({ ...state, view: 'month', month: '2026-12' }, 'dashboard')).toEqual({ from: '2026-12-01', to: '2027-01-01' })
  })
})

describe('Wohnungen und Objekte', () => {
  const apartments = [apt('a1'), apt('a2', { propertyId: P2, propertyName: 'See' }), apt('a3', { archived: true, propertyId: P2 }), apt('a4', { archived: true, propertyId: 'p3' })]

  it('Objekte nur mit aktiven Wohnungen, in Reihenfolge', () => {
    expect(calendarProperties(apartments)).toEqual([
      { id: P1, name: 'Haus' },
      { id: P2, name: 'See' },
    ])
  })

  it('archivierte nur mit Einträgen, Objektfilter', () => {
    const entries = [entry('e1', '2026-10-25', '2026-10-27', { apartmentId: 'a3' })]
    expect(visibleApartments(apartments, entries, null).map((a) => a.id)).toEqual(['a1', 'a2', 'a3'])
    expect(visibleApartments(apartments, [], null).map((a) => a.id)).toEqual(['a1', 'a2'])
    expect(visibleApartments(apartments, entries, P2).map((a) => a.id)).toEqual(['a2', 'a3'])
  })
})

describe('Zeitleiste', () => {
  it('Tage mit Wochenende und heute', () => {
    expect(weekdayIndex('2026-10-26')).toBe(0)
    expect(weekdayIndex('2026-10-25')).toBe(6)
    const days = calendarDays('2026-10-24', 3, TODAY)
    expect(days.map((d) => [d.date, d.weekend, d.today])).toEqual([
      ['2026-10-24', true, false],
      ['2026-10-25', true, false],
      ['2026-10-26', false, true],
    ])
  })

  it('Balken von Mitte Anreisetag bis Mitte Abreisetag', () => {
    const { bars, lanes, overlapping } = layoutRow([entry('e1', '2026-10-25', '2026-10-28')], '2026-10-24', 10)
    expect(bars[0].left).toBeCloseTo(0.15)
    expect(bars[0].width).toBeCloseTo(0.3)
    expect([bars[0].clippedStart, bars[0].clippedEnd, lanes, overlapping]).toEqual([false, false, 1, false])
  })

  it('schneidet am Rand ab; Abreise am ersten Tag bleibt als halber Tag sichtbar', () => {
    const { bars } = layoutRow(
      [entry('vorher', '2026-10-20', '2026-10-24'), entry('lang', '2026-10-01', '2026-12-01', { apartmentId: 'a1' })],
      '2026-10-24',
      10
    )
    const lang = bars.find((b) => b.entry.id === 'lang')!
    expect([lang.left, lang.width, lang.clippedStart, lang.clippedEnd]).toEqual([0, 1, true, true])
    const vorher = bars.find((b) => b.entry.id === 'vorher')!
    expect(vorher.left).toBe(0)
    expect(vorher.width).toBeCloseTo(0.05)
  })

  it('Wechseltag: gleiche Spur, keine Überschneidung', () => {
    const row = layoutRow([entry('e2', '2026-10-27', '2026-10-30'), entry('e1', '2026-10-25', '2026-10-27')], '2026-10-24', 14)
    expect(row.bars.map((b) => [b.entry.id, b.lane])).toEqual([
      ['e1', 0],
      ['e2', 0],
    ])
    expect(row.overlapping).toBe(false)
  })

  it('Überschneidungen in eigenen Spuren (2 und 3 Ebenen)', () => {
    const two = layoutRow([entry('e1', '2026-10-25', '2026-10-29'), entry('e2', '2026-10-27', '2026-10-31')], '2026-10-24', 14)
    expect([two.lanes, two.overlapping, two.bars.map((b) => b.lane)]).toEqual([2, true, [0, 1]])
    const three = layoutRow(
      [entry('e1', '2026-10-25', '2026-11-02'), entry('e2', '2026-10-26', '2026-10-28'), entry('e3', '2026-10-27', '2026-10-30'), entry('e4', '2026-10-28', '2026-10-29')],
      '2026-10-24',
      14
    )
    expect(three.lanes).toBe(3)
    expect(three.bars.map((b) => b.lane)).toEqual([0, 1, 2, 1])
  })

  it('Tag unter dem Klick', () => {
    expect(dayAt(0, '2026-10-24', 14)).toBe('2026-10-24')
    expect(dayAt(0.5, '2026-10-24', 14)).toBe('2026-10-31')
    expect(dayAt(1, '2026-10-24', 14)).toBe('2026-11-06')
  })
})

describe('Monatsansicht', () => {
  const apartments = [apt('a1'), apt('a2'), apt('a3'), apt('alt', { archived: true })]
  const entries = [
    entry('b1', '2026-10-01', '2026-10-05'),
    entry('s1', '2026-10-03', '2026-10-06', { apartmentId: 'a2', kind: 'block', guestLastName: null, guestName: null, persons: 0, blockReason: 'owner_use' }),
    entry('o1', '2026-10-03', '2026-10-04', { apartmentId: 'a3', kind: 'option' }),
    entry('alt1', '2026-10-03', '2026-10-10', { apartmentId: 'alt' }),
    entry('vorher', '2026-09-28', '2026-10-01', { apartmentId: 'a3' }),
  ]

  it('Raster beginnt am Montag', () => {
    expect(monthCells('2026-10', apartments, entries, TODAY).leadBlanks).toBe(3)
    expect(monthCells('2026-10', apartments, entries, TODAY).cells).toHaveLength(31)
  })

  it('belegt x/y zählt Buchungen, Optionen und Sperren, ohne archivierte Wohnungen', () => {
    const third = monthCells('2026-10', apartments, entries, TODAY).cells[2]
    expect([third.date, third.occupied, third.total]).toEqual(['2026-10-03', 3, 3])
    const fifth = monthCells('2026-10', apartments, entries, TODAY).cells[4]
    expect([fifth.occupied, fifth.total]).toEqual([1, 3])
  })

  it('An/Ab ohne Sperren; Abreise am Monatsersten zählt', () => {
    const cells = monthCells('2026-10', apartments, entries, TODAY).cells
    expect([cells[0].arrivals, cells[0].departures]).toEqual([1, 1])
    expect([cells[2].arrivals, cells[2].departures]).toEqual([2, 0])
    expect([cells[5].arrivals, cells[5].departures]).toEqual([0, 0])
  })

  it('Objektfilter: nur übergebene Wohnungen zählen', () => {
    const cell = monthCells('2026-10', [apt('a1')], entries, TODAY).cells[2]
    expect([cell.occupied, cell.total, cell.arrivals]).toEqual([1, 1, 0])
  })

  it('Tagesliste mit Anreise, Abreise und „bis“', () => {
    expect(dayItems('2026-10-03', entries).map((i) => [i.entry.id, i.tag])).toEqual([
      ['b1', 'until'],
      ['o1', 'arrival'],
      ['s1', 'arrival'],
      ['alt1', 'arrival'],
    ])
    expect(dayItems('2026-10-05', entries).map((i) => [i.entry.id, i.tag])).toEqual([
      ['b1', 'departure'],
      ['s1', 'until'],
      ['alt1', 'until'],
    ])
    expect(dayItems('2026-10-20', entries)).toEqual([])
  })
})
