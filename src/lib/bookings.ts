// Manuelle Buchungen (PROJ-8): Typen und reine Regeln für Browser und Server.
// Lesefunktionen: src/lib/bookings-data.ts (nur Server), Aktionen: src/app/(app)/buchungen/actions.ts.

import { AMOUNT_MAX_CENTS, type ApartmentPricing } from '@/lib/apartments'
import { TIME_ZONE } from '@/lib/locale'

// Rechnerischer Vorschlag nach Preisart der Wohnung (PROJ-27); Regel in src/lib/apartments.ts
export { suggestedNightsCents } from '@/lib/apartments'

export type BookingErrorCode =
  | 'notFound'
  | 'staleBooking'
  | 'ownerOnly'
  | 'warnings'
  | 'apartmentArchived'
  | 'guestAnonymized'
  | 'notActive'
  | 'tooManyCompanions'
  | 'documentImageMissing'
  | 'guestSheetDuplicate'
  | 'billedTooHigh'

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

// Buchungsquelle (PROJ-30): Angabe des Vermieters, unabhängig von Kanal und Marketing-Quelle des Gastes.
// Texte: bookings.source.*; „custom“ mit Freitext, „none“ ist der Standard
export const BOOKING_SOURCES = [
  'website',
  'instagram',
  'google_ads',
  'newsletter',
  'referral',
  'platform_search',
  'booking_com',
  'custom',
  'none',
] as const
export type BookingSource = (typeof BOOKING_SOURCES)[number]

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
  amountMaxCents: AMOUNT_MAX_CENTS,
  optionDefaultDays: 7,
  nameMax: 100,
  guestSheetNumberMax: 30,
  sourceCustomMax: 100,
} as const

export type Charge = { label: string; amountCents: number }

// Beträge sehen nur Inhaber (eigene Tabellen, Tech Design C)
export type BookingAmounts = {
  // vereinbarter Übernachtungspreis für den geplanten Zeitraum (PROJ-30)
  nightsCents: number
  charges: Charge[]
  cancellationFeeCents: number | null
}

export type Companion = { firstName: string; lastName: string; birthDate: string | null }

// Wohnung, wie das Buchungsformular sie braucht (Preise nur für den Vorschlag des Inhabers)
export type BookableApartment = ApartmentPricing & {
  id: string
  label: string
  maxGuests: number
  maxAdults: number | null
  cleaningFeeCents: number | null
  checkIn: string
  checkOut: string
  archived: boolean
}

export type BookingGuest = {
  id: string
  lastName: string
  firstName: string | null
  titlePrefix: string | null
  titleSuffix: string | null
  country: string
  anonymized: boolean
}

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

// Andere Buchung mit derselben Gästeblattnummer (PROJ-30), auch storniert
export type GuestSheetDuplicate = {
  id: string
  kind: BookingKind
  number: string | null
  guestName: string | null
  cancelled: boolean
}

export type BookingWarnings = {
  conflicts: Conflict[]
  // Personen über der Kapazität bzw. Erwachsene über der Erwachsenen-Grenze der Wohnung (PROJ-27)
  overCapacity: { persons: number; maxGuests: number; adults: number; maxAdults: number | null } | null
  // Übergehbar für Inhaber und Mitarbeiter (eigene Bestätigung)
  guestSheetDuplicates: GuestSheetDuplicate[]
}

export type Booking = {
  id: string
  kind: BookingKind
  channel: BookingChannel
  number: string | null
  apartment: { id: string; label: string; maxGuests: number; archived: boolean }
  // ISO-Datum; die Abreise ist nicht mehr belegt (Wechseltag). `departure` ist die tatsächliche Abreise und
  // bestimmt die Belegung; `plannedDeparture` die vereinbarte (PROJ-30). Bei Sperren gleich.
  arrival: string
  plannedDeparture: string
  departure: string
  checkIn: string
  checkOut: string
  guest: BookingGuest | null
  adults: number
  childAges: number[]
  blockReason: BlockReason | null
  optionUntil: string | null
  // Meldedaten und Quelle (PROJ-30); bei Sperren leer bzw. Standard
  guestSheetNumber: string | null
  residenceRegistered: boolean
  source: BookingSource
  sourceCustom: string | null
  note: string | null
  cancelledAt: string | null
  cancelledBy: string | null
  cancelReason: string | null
  // Wer trotz Überschneidung oder Überbelegung gespeichert hat
  overrideBy: string | null
  priceReview: boolean
  companions: Companion[]
  // null für Mitarbeiter und bei Sperren; dazu der abgerechnete Übernachtungspreis (vom Server berechnet)
  amounts: (BookingAmounts & { billedNightsCents: number }) | null
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
  guestSheetNumber: string | null
  source: BookingSource
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
  source: BookingSource | null
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

export function overCapacity(
  adults: number,
  childAges: readonly number[],
  maxGuests: number,
  maxAdults: number | null = null
): BookingWarnings['overCapacity'] {
  const persons = personCount(adults, childAges)
  const tooMany = persons > maxGuests || (maxAdults !== null && adults > maxAdults)
  return tooMany ? { persons, maxGuests, adults, maxAdults } : null
}

// ---- Abreise geplant / tatsächlich (PROJ-30) ----------------------------------------------------

// Abzurechnende Nächte: bis zur späteren der beiden Abreisen (frühere Abreise → voller gebuchter Zeitraum)
export const billableNights = (b: { arrival: string; plannedDeparture: string; departure: string }) =>
  nightsBetween(b.arrival, b.departure > b.plannedDeparture ? b.departure : b.plannedDeparture)

// Ortstaxe-Nächte (für PROJ-16): bis zur tatsächlichen Abreise
export const taxNights = (b: { arrival: string; departure: string }) => nightsBetween(b.arrival, b.departure)

// Abgerechneter Übernachtungspreis: vereinbarter Preis anteilig auf die abzurechnenden Nächte, kaufmännisch auf Cent.
// Gleiche Regel in der Datenbank (save_booking). Ganzzahlig gerechnet: 33333 × 4 / 3 = 44444.
export function billedNightsCents(agreedCents: number, plannedNights: number, billable: number): number {
  if (plannedNights < 1 || billable <= plannedNights) return agreedCents
  return Math.round((agreedCents * billable) / plannedNights)
}

// Gästeblattnummer vergleichen: ohne Rand-Leerzeichen, Groß/Klein egal
export const guestSheetKey = (value: string | null) => (value ?? '').trim().toLocaleLowerCase('de')

export const chargesCents = (charges: readonly Charge[]) => charges.reduce((sum, c) => sum + c.amountCents, 0)

// Endbetrag = Übernachtungen + Zusatzkosten (nie gespeichert; die Ortstaxe kommt in PROJ-16 dazu)
export const totalCents = (a: Pick<BookingAmounts, 'nightsCents' | 'charges'>) => a.nightsCents + chargesCents(a.charges)

// „2026-0042“; ab 10.000 einfach fünfstellig
export const formatBookingNumber = (year: number, seq: number) => `${year}-${String(seq).padStart(4, '0')}`

// Betrag lesen und als Eingabewert schreiben: zentral in src/lib/format.ts (PROJ-31)
export { amountInput, parseAmountCents } from '@/lib/format'

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
const isSource = (v: string): v is BookingSource => (BOOKING_SOURCES as readonly string[]).includes(v)

// Adresswerte (deutsch) ↔ interne Werte
const KIND_PARAM: Record<BookingKind, string> = { booking: 'buchung', option: 'option', block: 'sperre' }
const STATE_PARAM: Record<BookingState, string> = { active: 'aktiv', expired: 'verfallen', cancelled: 'storniert' }
const SOURCE_PARAM: Record<BookingSource, string> = {
  website: 'website',
  instagram: 'instagram',
  google_ads: 'google-ads',
  newsletter: 'newsletter',
  referral: 'empfehlung',
  platform_search: 'plattform-suche',
  booking_com: 'booking-com',
  custom: 'eigene',
  none: 'keine',
}
const fromParam = <K extends string>(map: Record<K, string>, value: string): K | null =>
  (Object.entries(map) as [K, string][]).find(([, v]) => v === value)?.[0] ?? null

// Gelesene Filter aus der Adresse (?monat, wohnung, art, zustand, quelle, q) – ungültige Werte werden ignoriert
export function parseBookingFilters(params: Record<string, string | string[] | undefined>, today: string = todayIso()): BookingFilters {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''
  const month = first(params.monat)
  const apartment = first(params.wohnung)
  const kind = fromParam(KIND_PARAM, first(params.art))
  const state = fromParam(STATE_PARAM, first(params.zustand))
  const source = fromParam(SOURCE_PARAM, first(params.quelle))
  return {
    month: MONTH.test(month) ? month : currentMonth(today),
    apartment: /^[0-9a-f-]{36}$/i.test(apartment) ? apartment : null,
    kind: kind && isKind(kind) ? kind : null,
    // „aktiv“ ist der Standard (ohne Filter)
    state: state && isState(state) && state !== 'active' ? state : null,
    source: source && isSource(source) ? source : null,
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
  if (filters.source) params.set('quelle', SOURCE_PARAM[filters.source])
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
    // Quelle gibt es nur bei Buchungen und Optionen
    .filter((r) => !filters.source || (r.kind !== 'block' && r.source === filters.source))
    .filter((r) => (filters.state ? r.state === filters.state : r.state === 'active'))
}
