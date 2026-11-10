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
  DEFAULT_LENGTH,
  layoutRow,
  parseCalendarState,
  timelineStep,
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
  tenantId: 't1',
  tenantName: null,
  ...extra,
})

const entry = (id: string, arrival: string, departure: string, extra: Partial<CalendarEntry> = {}): CalendarEntry => ({
  id,
  tenantId: 't1',
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
  it('ohne Angaben: 14 Tage ab heute − 2, alle Objekte', () => {
    expect(DEFAULT_LENGTH).toBe(14)
    expect(parseCalendarState({}, undefined, TODAY)).toEqual({ length: 14, start: '2026-10-24', property: null, entry: null, create: null })
  })

  it('„neu“ öffnet das Formular vorbelegt (PROJ-14), ungültige Werte zählen nicht', () => {
    expect(parseCalendarState({ neu: `${P1}_2026-11-02` }, undefined, TODAY).create).toEqual({ apartmentId: P1, arrival: '2026-11-02' })
    expect(parseCalendarState({ neu: `${P1}_2026-02-30` }, undefined, TODAY).create).toBeNull()
    expect(parseCalendarState({ neu: 'x_2026-11-02' }, undefined, TODAY).create).toBeNull()
    const state = parseCalendarState({}, undefined, TODAY)
    expect(calendarHref({ ...state, create: { apartmentId: P1, arrival: '2026-11-02' } })).toBe(`/?tage=14&ab=2026-10-24&objekt=alle&neu=${P1}_2026-11-02`)
  })

  it('Cookie liefert Länge und Objekt, die Adresse gewinnt', () => {
    const cookie = calendarCookieValue(28, P1)
    expect(cookie).toBe(`28.${P1}`)
    expect(parseCalendarState({}, cookie, TODAY)).toMatchObject({ length: 28, property: P1 })
    expect(parseCalendarState({ tage: '14', objekt: 'alle' }, cookie, TODAY)).toMatchObject({ length: 14, property: null })
    expect(parseCalendarState({ objekt: P2 }, cookie, TODAY)).toMatchObject({ property: P2 })
  })

  it('alte Cookie-Werte der Monatsansicht: 14 Tage, das gemerkte Objekt bleibt (refine 2026-11-10)', () => {
    expect(parseCalendarState({}, `monat.${P1}`, TODAY)).toMatchObject({ length: 14, property: P1 })
    expect(parseCalendarState({}, 'zeitleiste.alle', TODAY)).toMatchObject({ length: 14, property: null })
  })

  it('ignoriert ungültige und alte Adressangaben (ansicht, monat, tag)', () => {
    const state = parseCalendarState({ tage: '30', ab: '2026-02-30', ansicht: 'monat', monat: '2026-12', tag: '2026-12-03', objekt: 'x', eintrag: '1' }, 'kaputt', TODAY)
    expect(state).toEqual(parseCalendarState({}, undefined, TODAY))
  })

  it('Adresse enthält Länge, Start und Objekt immer, Eintrag nur wenn offen', () => {
    const state = parseCalendarState({}, undefined, TODAY)
    expect(calendarHref(state)).toBe('/?tage=14&ab=2026-10-24&objekt=alle')
    expect(calendarHref({ ...state, length: 28, property: P1, entry: ENTRY })).toBe(`/?tage=28&ab=2026-10-24&objekt=${P1}&eintrag=${ENTRY}`)
    expect(parseCalendarState(Object.fromEntries(new URLSearchParams(calendarHref({ ...state, length: 28, entry: ENTRY }).split('?')[1])), undefined, TODAY)).toEqual({
      ...state,
      length: 28,
      entry: ENTRY,
    })
  })
})

describe('Bereich und Blättern je Länge', () => {
  const state = parseCalendarState({}, undefined, TODAY)
  it('14 bzw. 28 Tage ab dem Start', () => {
    expect(calendarRange(state)).toEqual({ from: '2026-10-24', to: '2026-11-07' })
    expect(calendarRange({ ...state, length: 28 })).toEqual({ from: '2026-10-24', to: '2026-11-21' })
  })
  it('blättert um 7 bzw. 14 Tage', () => {
    expect(timelineStep(14)).toBe(7)
    expect(timelineStep(28)).toBe(14)
  })
})

describe('Wohnungen und Objekte', () => {
  const apartments = [apt('a1'), apt('a2', { propertyId: P2, propertyName: 'See' }), apt('a3', { archived: true, propertyId: P2 }), apt('a4', { archived: true, propertyId: 'p3' })]

  it('Objekte nur mit aktiven Wohnungen, in Reihenfolge', () => {
    expect(calendarProperties(apartments)).toEqual([
      { id: P1, name: 'Haus', tenantName: null },
      { id: P2, name: 'See', tenantName: null },
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
