// Manuelle Buchungen (PROJ-8): Typen und reine Regeln für Browser und Server.
// Lesefunktionen: src/lib/bookings-data.ts (nur Server), Aktionen: src/app/(app)/buchungen/actions.ts.

import { TIME_ZONE } from '@/lib/locale'

export type BookingErrorCode =
  | 'notFound'
  | 'staleBooking'
  | 'ownerOnly'
  | 'warnings'
  | 'apartmentArchived'
  | 'guestAnonymized'
  | 'notActive'

// Buchung (bestätigt), Option (vorgemerkt mit Ablaufdatum) oder Sperre (ohne Gast und Preis)
export const BOOKING_KINDS = ['booking', 'option', 'block'] as const
export type BookingKind = (typeof BOOKING_KINDS)[number]

// Zustand wird berechnet, nie gespeichert (Tech Design B)
export const BOOKING_STATES = ['active', 'expired', 'cancelled'] as const
export type BookingState = (typeof BOOKING_STATES)[number]

export const BLOCK_REASONS = ['owner_use', 'renovation', 'other'] as const
export type BlockReason = (typeof BLOCK_REASONS)[number]

// Von Hand erfasst wird nur „Direkt“; booking.com und Airbnb kommen mit dem Import (PROJ-11)
export type BookingChannel = 'direct'

// Vorschläge für Zusatzkosten (Texte: bookings.chargeSuggestions.*); gespeichert wird die angezeigte Bezeichnung
export const CHARGE_SUGGESTIONS = ['cleaning', 'pet', 'breakfast', 'parking'] as const

export const LIMITS = {
  noteMax: 2000,
  chargeLabelMax: 100,
  chargesMax: 20,
  cancelReasonMax: 500,
  nightsMax: 365,
  yearsAhead: 3,
  adultsMax: 50,
  childAgeMax: 17,
  personsMax: 50,
  amountMaxCents: 100_000_000,
  optionDefaultDays: 7,
  nameMax: 100,
} as const

export type Charge = { label: string; amountCents: number }

// Beträge sehen nur Inhaber (eigene Tabellen, Tech Design C)
export type BookingAmounts = {
  nightsCents: number
  charges: Charge[]
  cancellationFeeCents: number | null
}

export type Companion = { firstName: string; lastName: string; birthDate: string | null }

// Wohnung, wie das Buchungsformular sie braucht
export type BookableApartment = {
  id: string
  label: string
  maxGuests: number
  priceCents: number | null
  cleaningFeeCents: number | null
  checkIn: string
  checkOut: string
  archived: boolean
}

export type BookingGuest = { id: string; lastName: string; firstName: string | null; country: string; anonymized: boolean }

// Anderer Eintrag, mit dem sich ein Zeitraum überschneidet
export type Conflict = {
  id: string
  kind: BookingKind
  number: string | null
  guestName: string | null
  blockReason: BlockReason | null
  arrival: string
  departure: string
}

export type BookingWarnings = {
  conflicts: Conflict[]
  // Personen über der Kapazität der Wohnung
  overCapacity: { persons: number; maxGuests: number } | null
}

export type Booking = {
  id: string
  kind: BookingKind
  channel: BookingChannel
  number: string | null
  apartment: { id: string; label: string; maxGuests: number; archived: boolean }
  // ISO-Datum; die Abreise ist nicht mehr belegt (Wechseltag)
  arrival: string
  departure: string
  checkIn: string
  checkOut: string
  guest: BookingGuest | null
  adults: number
  childAges: number[]
  blockReason: BlockReason | null
  optionUntil: string | null
  note: string | null
  cancelledAt: string | null
  cancelledBy: string | null
  cancelReason: string | null
  // Wer trotz Überschneidung oder Überbelegung gespeichert hat
  overrideBy: string | null
  priceReview: boolean
  companions: Companion[]
  // null für Mitarbeiter und bei Sperren
  amounts: BookingAmounts | null
  // Aktuelle Überschneidungen (berechnet)
  conflicts: Conflict[]
  updatedAt: string
}

export type BookingRow = {
  id: string
  kind: BookingKind
  number: string | null
  apartmentId: string
  apartmentLabel: string
  arrival: string
  departure: string
  guestName: string | null
  blockReason: BlockReason | null
  persons: number
  state: BookingState
  optionUntil: string | null
  // nur für Inhaber
  totalCents: number | null
  overlapping: boolean
  priceReview: boolean
}

export type BookingFilters = {
  // JJJJ-MM
  month: string
  apartment: string | null
  kind: BookingKind | null
  state: BookingState | null
  query: string
}

export const bookingHref = (id: string) => `/buchungen/${id}`

// Heutiges Datum in Wien (JJJJ-MM-TT)
export const todayIso = (now: Date = new Date()) => now.toLocaleDateString('sv-SE', { timeZone: TIME_ZONE })

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
export function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false
  const d = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value
}

const utc = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))

export function addDays(iso: string, days: number): string {
  return new Date(utc(iso) + days * 86_400_000).toISOString().slice(0, 10)
}

export function nightsBetween(arrival: string, departure: string): number {
  return Math.round((utc(departure) - utc(arrival)) / 86_400_000)
}

// Zeiträume [Anreise, Abreise) überschneiden sich; Abreise = Anreise der nächsten Buchung ist keine Überschneidung
export function rangesOverlap(a: { arrival: string; departure: string }, b: { arrival: string; departure: string }): boolean {
  return a.arrival < b.departure && b.arrival < a.departure
}

export function bookingState(b: { kind: BookingKind; cancelledAt: string | null; optionUntil: string | null }, today: string): BookingState {
  if (b.cancelledAt) return 'cancelled'
  if (b.kind === 'option' && b.optionUntil !== null && b.optionUntil < today) return 'expired'
  return 'active'
}

type Occupancy = { id: string; apartmentId: string; arrival: string; departure: string; kind: BookingKind; cancelledAt: string | null; optionUntil: string | null }

// Aktive Einträge derselben Wohnung, die den Zeitraum belegen (ohne den Eintrag selbst)
export function findConflicts<T extends Occupancy>(
  candidate: { id?: string | null; apartmentId: string; arrival: string; departure: string },
  others: T[],
  today: string
): T[] {
  return others
    .filter(
      (o) =>
        o.id !== candidate.id &&
        o.apartmentId === candidate.apartmentId &&
        bookingState(o, today) === 'active' &&
        rangesOverlap(candidate, o)
    )
    .sort((a, b) => a.arrival.localeCompare(b.arrival))
}

export const personCount = (adults: number, childAges: readonly number[]) => adults + childAges.length

export function overCapacity(adults: number, childAges: readonly number[], maxGuests: number): BookingWarnings['overCapacity'] {
  const persons = personCount(adults, childAges)
  return persons > maxGuests ? { persons, maxGuests } : null
}

// Vorschlag: Standardpreis × Nächte (null, wenn die Wohnung keinen Standardpreis hat)
export function suggestedNightsCents(priceCents: number | null, nights: number): number | null {
  return priceCents === null || nights < 1 ? null : priceCents * nights
}

export const chargesCents = (charges: readonly Charge[]) => charges.reduce((sum, c) => sum + c.amountCents, 0)

// Endbetrag = Übernachtungen + Zusatzkosten (nie gespeichert; die Ortstaxe kommt in PROJ-16 dazu)
export const totalCents = (a: Pick<BookingAmounts, 'nightsCents' | 'charges'>) => a.nightsCents + chargesCents(a.charges)

// „2026-0042“; ab 10.000 einfach fünfstellig
export const formatBookingNumber = (year: number, seq: number) => `${year}-${String(seq).padStart(4, '0')}`

// Betrag aus der Eingabe („125“, „125,50“, „1.250“, „1.250,50“, „125.5“) in Cent; null bei leer, NaN bei ungültig
export function parseAmountCents(input: string): number | null {
  const value = input.trim().replace(/^€\s*/, '')
  if (!value) return null
  let normalized: string
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(value)) normalized = value.replaceAll('.', '').replace(',', '.')
  else if (/^\d{1,7}([.,]\d{1,2})?$/.test(value)) normalized = value.replace(',', '.')
  else return Number.NaN
  return Math.round(Number(normalized) * 100)
}

// Cent → Eingabewert („125,50“; ganze Euro ohne Nachkommastellen)
export function amountInput(cents: number | null): string {
  if (cents === null) return ''
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2).replace('.', ',')
}

// ---- Monat und Filter -------------------------------------------------------------------------

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/
export const currentMonth = (today: string = todayIso()) => today.slice(0, 7)

export function shiftMonth(month: string, delta: number): string {
  const y = Number(month.slice(0, 4))
  const m = Number(month.slice(5, 7)) - 1 + delta
  const date = new Date(Date.UTC(y, m, 1))
  return date.toISOString().slice(0, 7)
}

// Erster Tag des Monats und erster Tag des Folgemonats (Ende ausgeschlossen)
export const monthRange = (month: string) => ({ from: `${month}-01`, to: `${shiftMonth(month, 1)}-01` })

// Berührt der Eintrag den Monat? (eine Nacht im Monat genügt)
export const touchesMonth = (b: { arrival: string; departure: string }, month: string) =>
  rangesOverlap(b, { arrival: monthRange(month).from, departure: monthRange(month).to })

const isKind = (v: string): v is BookingKind => (BOOKING_KINDS as readonly string[]).includes(v)
const isState = (v: string): v is BookingState => (BOOKING_STATES as readonly string[]).includes(v)

// Adresswerte (deutsch) ↔ interne Werte
const KIND_PARAM: Record<BookingKind, string> = { booking: 'buchung', option: 'option', block: 'sperre' }
const STATE_PARAM: Record<BookingState, string> = { active: 'aktiv', expired: 'verfallen', cancelled: 'storniert' }
const fromParam = <K extends string>(map: Record<K, string>, value: string): K | null =>
  (Object.entries(map) as [K, string][]).find(([, v]) => v === value)?.[0] ?? null

// Gelesene Filter aus der Adresse (?monat, wohnung, art, zustand, q) – ungültige Werte werden ignoriert
export function parseBookingFilters(params: Record<string, string | string[] | undefined>, today: string = todayIso()): BookingFilters {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''
  const month = first(params.monat)
  const apartment = first(params.wohnung)
  const kind = fromParam(KIND_PARAM, first(params.art))
  const state = fromParam(STATE_PARAM, first(params.zustand))
  return {
    month: MONTH.test(month) ? month : currentMonth(today),
    apartment: /^[0-9a-f-]{36}$/i.test(apartment) ? apartment : null,
    kind: kind && isKind(kind) ? kind : null,
    // „aktiv“ ist der Standard (ohne Filter)
    state: state && isState(state) && state !== 'active' ? state : null,
    query: first(params.q).trim().slice(0, 100),
  }
}

// Adresse der Buchungsliste (leere Werte und den aktuellen Monat weglassen)
export function bookingListHref(filters: Partial<BookingFilters>, today: string = todayIso()): string {
  const params = new URLSearchParams()
  if (filters.month && filters.month !== currentMonth(today)) params.set('monat', filters.month)
  if (filters.apartment) params.set('wohnung', filters.apartment)
  if (filters.kind) params.set('art', KIND_PARAM[filters.kind])
  if (filters.state) params.set('zustand', STATE_PARAM[filters.state])
  if (filters.query) params.set('q', filters.query)
  const search = params.toString()
  return search ? `/buchungen?${search}` : '/buchungen'
}

// Liste filtern: ohne Zustandsfilter nur aktive Einträge; mit Suche über alle Monate (Tech Design G)
export function filterRows(rows: BookingRow[], filters: BookingFilters, allMonths: boolean): BookingRow[] {
  return rows
    .filter((r) => allMonths || touchesMonth(r, filters.month))
    .filter((r) => !filters.apartment || r.apartmentId === filters.apartment)
    .filter((r) => !filters.kind || r.kind === filters.kind)
    .filter((r) => (filters.state ? r.state === filters.state : r.state === 'active'))
}
