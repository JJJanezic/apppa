// Belegungskalender (PROJ-9): Typen und reine Regeln für Browser und Server.
// Lesefunktion: src/lib/calendar-data.ts (nur Server), Oberfläche: src/components/calendar/.

import { addDays, type BlockReason, type BookingChannel, type BookingKind, currentMonth, isIsoDate, monthRange, nightsBetween } from '@/lib/bookings'

export type CalendarView = 'timeline' | 'month'
// Dashboard-Abschnitt oder Vollbild-Seite /belegung
export type CalendarVariant = 'dashboard' | 'full'

export const TIMELINE_DAYS: Record<CalendarVariant, number> = { dashboard: 14, full: 28 }
// Blättern um eine Woche; beim Öffnen beginnt die Zeitleiste zwei Tage vor heute (Entwurf)
export const TIMELINE_STEP = 7
export const TIMELINE_LEAD = 2

export const CALENDAR_PATH: Record<CalendarVariant, string> = { dashboard: '/', full: '/belegung' }

// Ansicht und Objektfilter je Gerät (Cookie, gemeinsam für Dashboard und Vollbild)
export const CALENDAR_COOKIE = 'apppa-belegung'

export type CalendarApartment = { id: string; name: string; propertyId: string; propertyName: string; archived: boolean }

// Aktiver Eintrag (Buchung, Option, Sperre) ohne Beträge
export type CalendarEntry = {
  id: string
  apartmentId: string
  kind: BookingKind
  channel: BookingChannel
  // ISO-Datum; die Abreise ist nicht mehr belegt (Wechseltag)
  arrival: string
  departure: string
  // Nachname für den Balken, voller Name für Tooltip und Tagesliste; null bei Sperren
  guestLastName: string | null
  guestName: string | null
  persons: number
  blockReason: BlockReason | null
}

export type CalendarState = {
  view: CalendarView
  // Erster Tag der Zeitleiste
  start: string
  // JJJJ-MM der Monatsansicht und darin gewählter Tag
  month: string
  day: string
  // Objektfilter; null = alle
  property: string | null
  // Offener Eintrag im Detailpanel
  entry: string | null
}

const UUID = /^[0-9a-f-]{36}$/i
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

// Adresswerte (deutsch) ↔ interne Werte
const VIEW_PARAM: Record<CalendarView, string> = { timeline: 'zeitleiste', month: 'monat' }
const ALL_PROPERTIES = 'alle'
const viewFromParam = (value: string): CalendarView | null =>
  (Object.entries(VIEW_PARAM) as [CalendarView, string][]).find(([, v]) => v === value)?.[0] ?? null

// Cookie „zeitleiste.alle“ bzw. „monat.<Objekt-ID>“
export const calendarCookieValue = (view: CalendarView, property: string | null) => `${VIEW_PARAM[view]}.${property ?? ALL_PROPERTIES}`

function parseCookie(value: string | undefined): { view: CalendarView | null; property: string | null | undefined } {
  const [view, property] = (value ?? '').split('.')
  return {
    view: viewFromParam(view ?? ''),
    property: property === ALL_PROPERTIES ? null : property && UUID.test(property) ? property : undefined,
  }
}

const sameMonth = (iso: string, month: string) => iso.slice(0, 7) === month

// Zustand aus Adresse (?ansicht, ab, monat, tag, objekt, eintrag) und Cookie; die Adresse gewinnt, ungültige Werte zählen nicht
export function parseCalendarState(
  params: Record<string, string | string[] | undefined>,
  cookie: string | undefined,
  today: string
): CalendarState {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''
  const remembered = parseCookie(cookie)
  const objekt = first(params.objekt)
  const ab = first(params.ab)
  const tag = first(params.tag)
  const monat = first(params.monat)
  const eintrag = first(params.eintrag)

  const month = MONTH.test(monat) ? monat : isIsoDate(tag) ? tag.slice(0, 7) : currentMonth(today)
  return {
    view: viewFromParam(first(params.ansicht)) ?? remembered.view ?? 'timeline',
    start: isIsoDate(ab) ? ab : addDays(today, -TIMELINE_LEAD),
    month,
    day: isIsoDate(tag) && sameMonth(tag, month) ? tag : sameMonth(today, month) ? today : `${month}-01`,
    property: objekt === ALL_PROPERTIES ? null : UUID.test(objekt) ? objekt : (remembered.property ?? null),
    entry: UUID.test(eintrag) ? eintrag : null,
  }
}

// Adresse des Kalenders; Ansicht und Objekt stehen immer drin, damit die Adresse für sich allein gilt
export function calendarHref(variant: CalendarVariant, state: CalendarState): string {
  const params = new URLSearchParams()
  params.set('ansicht', VIEW_PARAM[state.view])
  if (state.view === 'timeline') params.set('ab', state.start)
  else {
    params.set('monat', state.month)
    params.set('tag', state.day)
  }
  params.set('objekt', state.property ?? ALL_PROPERTIES)
  if (state.entry) params.set('eintrag', state.entry)
  return `${CALENDAR_PATH[variant]}?${params.toString()}`
}

// Geladener Bereich: Einträge mit Anreise vor `to` und Abreise ab `from` (auch Abreisen am ersten Tag sind sichtbar)
export function calendarRange(state: CalendarState, variant: CalendarVariant): { from: string; to: string } {
  if (state.view === 'timeline') return { from: state.start, to: addDays(state.start, TIMELINE_DAYS[variant]) }
  return monthRange(state.month)
}

// ---- Wohnungen und Objekte ------------------------------------------------------------------

export type CalendarProperty = { id: string; name: string }

// Objekte mit mindestens einer aktiven Wohnung, in der Reihenfolge der Wohnungen
export function calendarProperties(apartments: CalendarApartment[]): CalendarProperty[] {
  const seen = new Map<string, CalendarProperty>()
  for (const a of apartments) if (!a.archived && !seen.has(a.propertyId)) seen.set(a.propertyId, { id: a.propertyId, name: a.propertyName })
  return [...seen.values()]
}

// Sichtbare Wohnungen: aktive immer, archivierte nur mit Einträgen im Bereich; dazu der Objektfilter
export function visibleApartments(apartments: CalendarApartment[], entries: CalendarEntry[], property: string | null): CalendarApartment[] {
  const withEntries = new Set(entries.map((e) => e.apartmentId))
  return apartments.filter((a) => (!a.archived || withEntries.has(a.id)) && (property === null || a.propertyId === property))
}

// ---- Zeitleiste -----------------------------------------------------------------------------

export type CalendarDay = { date: string; weekend: boolean; today: boolean }

// Wochentag 0 = Montag … 6 = Sonntag
export const weekdayIndex = (iso: string) => (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7

export function calendarDays(from: string, count: number, today: string): CalendarDay[] {
  return Array.from({ length: count }, (_, i) => {
    const date = addDays(from, i)
    return { date, weekend: weekdayIndex(date) >= 5, today: date === today }
  })
}

export type CalendarBar = {
  entry: CalendarEntry
  // Anteile der Zeilenbreite (0–1)
  left: number
  width: number
  // Spur bei Überschneidungen (0 = oben)
  lane: number
  // Beginnt bzw. endet außerhalb des sichtbaren Bereichs
  clippedStart: boolean
  clippedEnd: boolean
}

export type CalendarRow = { bars: CalendarBar[]; lanes: number; overlapping: boolean }

// Balken einer Wohnung: Beginn Mitte Anreisetag, Ende Mitte Abreisetag (Entwurf), am Rand abgeschnitten.
// Einträge, die sich schneiden, kommen in die nächste freie Spur; der Wechseltag ist keine Überschneidung.
export function layoutRow(entries: CalendarEntry[], from: string, days: number): CalendarRow {
  const sorted = [...entries].sort((a, b) => a.arrival.localeCompare(b.arrival) || a.departure.localeCompare(b.departure))
  const laneEnds: string[] = []
  const bars: CalendarBar[] = []
  for (const entry of sorted) {
    let lane = laneEnds.findIndex((end) => end <= entry.arrival)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = entry.departure
    const start = (nightsBetween(from, entry.arrival) + 0.5) / days
    const end = (nightsBetween(from, entry.departure) + 0.5) / days
    const left = Math.max(0, start)
    const right = Math.min(1, end)
    if (right <= left) continue
    bars.push({ entry, left, width: right - left, lane, clippedStart: start < 0, clippedEnd: end > 1 })
  }
  const lanes = Math.max(1, laneEnds.length)
  return { bars, lanes, overlapping: laneEnds.length > 1 }
}

// Tag unter der Maus bzw. dem Finger (Anteil der Zeilenbreite)
export function dayAt(fraction: number, from: string, days: number): string {
  const index = Math.min(days - 1, Math.max(0, Math.floor(fraction * days)))
  return addDays(from, index)
}

// ---- Monatsansicht --------------------------------------------------------------------------

export type MonthCell = CalendarDay & {
  // Wohnungen mit Buchung, Option oder Sperre in dieser Nacht / alle aktiven Wohnungen (archivierte zählen nicht)
  occupied: number
  total: number
  // Buchungen und Optionen (ohne Sperren)
  arrivals: number
  departures: number
}

export function monthCells(
  month: string,
  apartments: CalendarApartment[],
  entries: CalendarEntry[],
  today: string
): { leadBlanks: number; cells: MonthCell[] } {
  const { from, to } = monthRange(month)
  const active = new Set(apartments.filter((a) => !a.archived).map((a) => a.id))
  const shown = new Set(apartments.map((a) => a.id))
  const own = entries.filter((e) => shown.has(e.apartmentId))
  const guests = own.filter((e) => e.kind !== 'block')
  const cells = calendarDays(from, nightsBetween(from, to), today).map((day) => {
    const occupied = new Set(own.filter((e) => active.has(e.apartmentId) && e.arrival <= day.date && day.date < e.departure).map((e) => e.apartmentId))
    return {
      ...day,
      occupied: occupied.size,
      total: active.size,
      arrivals: guests.filter((e) => e.arrival === day.date).length,
      departures: guests.filter((e) => e.departure === day.date).length,
    }
  })
  return { leadBlanks: weekdayIndex(from), cells }
}

export type DayItem = { entry: CalendarEntry; tag: 'arrival' | 'departure' | 'until' }

// Tagesliste: Einträge, die in der Nacht belegen oder an diesem Tag abreisen
export function dayItems(day: string, entries: CalendarEntry[]): DayItem[] {
  return entries
    .filter((e) => (e.arrival <= day && day < e.departure) || e.departure === day)
    .sort((a, b) => a.arrival.localeCompare(b.arrival) || a.departure.localeCompare(b.departure))
    .map((entry) => ({ entry, tag: entry.arrival === day ? 'arrival' : entry.departure === day ? 'departure' : 'until' }))
}
