// Belegungskalender (PROJ-9): Typen und reine Regeln für Browser und Server.
// Lesefunktion: src/lib/calendar-data.ts (nur Server), Oberfläche: src/components/calendar/.

import { addDays, type BlockReason, type BookingChannel, type BookingKind, type BookingSource, isIsoDate, nightsBetween } from '@/lib/bookings'

// Sichtbare Tage der Zeitleiste (refine 2026-11-10: Schalter „14 Tage | 28 Tage“ auf dem Dashboard)
export type CalendarLength = 14 | 28
export const CALENDAR_LENGTHS: readonly CalendarLength[] = [14, 28]
export const DEFAULT_LENGTH: CalendarLength = 14
// Blättern um den halben Zeitraum (7 bzw. 14 Tage); beim Öffnen beginnt die Zeitleiste zwei Tage vor heute (Entwurf)
export const timelineStep = (length: CalendarLength) => length / 2
export const TIMELINE_LEAD = 2

// Der Kalender steht nur noch auf dem Dashboard; /belegung leitet dorthin um (next.config.ts)
export const CALENDAR_PATH = '/'

// Länge und Objektfilter je Gerät
export const CALENDAR_COOKIE = 'apppa-belegung'

// tenantName nur auf dem Dashboard mit mehreren Kunden (PROJ-14): Gruppenkopf je Kunde; sonst null
export type CalendarApartment = {
  id: string
  name: string
  propertyId: string
  propertyName: string
  archived: boolean
  tenantId: string
  tenantName: string | null
}

// Aktiver Eintrag (Buchung, Option, Sperre) ohne Beträge
export type CalendarEntry = {
  id: string
  // Kunde des Eintrags (PROJ-14): Klick auf einen anderen als den gewählten Kunden wechselt vorher
  tenantId: string
  apartmentId: string
  kind: BookingKind
  channel: BookingChannel
  // Buchungsquelle (PROJ-30): „booking_com“ färbt den Eintrag in der booking.com-Farbe
  source: BookingSource
  // ISO-Datum; die Abreise ist nicht mehr belegt (Wechseltag)
  arrival: string
  departure: string
  // Nachname für den Balken, voller Name für den Tooltip; null bei Sperren
  guestLastName: string | null
  guestName: string | null
  persons: number
  blockReason: BlockReason | null
}

export type CalendarState = {
  length: CalendarLength
  // Erster Tag der Zeitleiste
  start: string
  // Objektfilter; null = alle
  property: string | null
  // Offener Eintrag im Detailpanel
  entry: string | null
  // Formular „Neue Buchung“ vorbelegt öffnen (PROJ-14: nach dem Kundenwechsel aus dem Dashboard)
  create: { apartmentId: string; arrival: string } | null
}

const UUID = /^[0-9a-f-]{36}$/i
const ALL_PROPERTIES = 'alle'
const lengthFrom = (value: string): CalendarLength | null => CALENDAR_LENGTHS.find((l) => String(l) === value) ?? null

// Cookie „14.alle“ bzw. „28.<Objekt-ID>“; ältere Werte („zeitleiste.…“, „monat.…“) liefern nur das Objekt
export const calendarCookieValue = (length: CalendarLength, property: string | null) => `${length}.${property ?? ALL_PROPERTIES}`

function parseCookie(value: string | undefined): { length: CalendarLength | null; property: string | null | undefined } {
  const [length, property] = (value ?? '').split('.')
  return {
    length: lengthFrom(length ?? ''),
    property: property === ALL_PROPERTIES ? null : property && UUID.test(property) ? property : undefined,
  }
}

// Zustand aus Adresse (?tage, ab, objekt, eintrag, neu) und Cookie; die Adresse gewinnt, ungültige und alte Werte
// (ansicht, monat, tag der früheren Monatsansicht) zählen nicht
export function parseCalendarState(
  params: Record<string, string | string[] | undefined>,
  cookie: string | undefined,
  today: string
): CalendarState {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''
  const remembered = parseCookie(cookie)
  const objekt = first(params.objekt)
  const ab = first(params.ab)
  const eintrag = first(params.eintrag)
  // „neu=<Wohnung>_<Anreise>“
  const [neuApartment, neuArrival] = first(params.neu).split('_')

  return {
    length: lengthFrom(first(params.tage)) ?? remembered.length ?? DEFAULT_LENGTH,
    start: isIsoDate(ab) ? ab : addDays(today, -TIMELINE_LEAD),
    property: objekt === ALL_PROPERTIES ? null : UUID.test(objekt) ? objekt : (remembered.property ?? null),
    entry: UUID.test(eintrag) ? eintrag : null,
    create: UUID.test(neuApartment ?? '') && isIsoDate(neuArrival ?? '') ? { apartmentId: neuApartment, arrival: neuArrival } : null,
  }
}

// Adresse des Kalenders; Länge und Objekt stehen immer drin, damit die Adresse für sich allein gilt
export function calendarHref(state: CalendarState): string {
  const params = new URLSearchParams()
  params.set('tage', String(state.length))
  params.set('ab', state.start)
  params.set('objekt', state.property ?? ALL_PROPERTIES)
  if (state.entry) params.set('eintrag', state.entry)
  if (state.create) params.set('neu', `${state.create.apartmentId}_${state.create.arrival}`)
  return `${CALENDAR_PATH}?${params.toString()}`
}

// Geladener Bereich: Einträge mit Anreise vor `to` und Abreise ab `from` (auch Abreisen am ersten Tag sind sichtbar)
export function calendarRange(state: CalendarState): { from: string; to: string } {
  return { from: state.start, to: addDays(state.start, state.length) }
}

// ---- Wohnungen und Objekte ------------------------------------------------------------------

// tenantName: Kunde des Objekts, nur bei mehreren Kunden (PROJ-14)
export type CalendarProperty = { id: string; name: string; tenantName: string | null }

// Objekte mit mindestens einer aktiven Wohnung, in der Reihenfolge der Wohnungen
export function calendarProperties(apartments: CalendarApartment[]): CalendarProperty[] {
  const seen = new Map<string, CalendarProperty>()
  for (const a of apartments)
    if (!a.archived && !seen.has(a.propertyId)) seen.set(a.propertyId, { id: a.propertyId, name: a.propertyName, tenantName: a.tenantName })
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
