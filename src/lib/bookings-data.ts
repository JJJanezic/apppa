import 'server-only'

import { notFound } from 'next/navigation'
import { cache } from 'react'

import { apartmentLabel, childPricesFromDb, type PriceMode } from '@/lib/apartments'
import {
  type BlockReason,
  type BookableApartment,
  type Booking,
  type BookingFilters,
  type BookingKind,
  type BookingRow,
  bookingState,
  type Conflict,
  findConflicts,
  monthRange,
  personCount,
  todayIso,
  totalCents,
} from '@/lib/bookings'
import { guestSortName, searchKey } from '@/lib/guests'
import type { Role } from '@/lib/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext } from '@/lib/tenant'

// Lesefunktionen der Buchungen (PROJ-8) für alle Mitglieder des gewählten Kunden; Beträge nur für Inhaber.
// Rechte prüft die Datenbank zusätzlich (RLS: Buchungen und Mitreisende für Mitglieder, Beträge nur für Inhaber).

// Datenbank liefert Uhrzeiten als „15:00:00“
const hhmm = (value: string | null) => (value ? value.slice(0, 5) : '')
const LIST_LIMIT = 1000
const SEARCH_LIMIT = 50

async function requireMember(): Promise<{ tenantId: string; role: Role }> {
  const { active } = await getTenantContext()
  if (!active) notFound()
  return { tenantId: active.id, role: active.role }
}

// Wohnungen für Formulare und Filter (auch archivierte, gekennzeichnet), sortiert nach „Objekt · Wohnung“
export const getBookableApartments = cache(async (): Promise<BookableApartment[]> => {
  const { tenantId } = await requireMember()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('apartments')
    .select(
      'id, name, max_guests, max_adults, price_mode, price_cents, adult_price_cents, child_prices, cleaning_fee_cents, check_in, check_out, archived_at, property:properties!inner(name)'
    )
    .eq('tenant_id', tenantId)
    .limit(500)
  if (error) console.error('[buchungen] Wohnungen nicht lesbar', error.message)
  return (data ?? [])
    .map(
      (a): BookableApartment => ({
        id: a.id,
        label: apartmentLabel(a.property.name, a.name),
        maxGuests: a.max_guests,
        maxAdults: a.max_adults,
        priceMode: a.price_mode as PriceMode,
        priceCents: a.price_cents,
        adultPriceCents: a.adult_price_cents,
        childPrices: childPricesFromDb(a.child_prices),
        cleaningFeeCents: a.cleaning_fee_cents,
        checkIn: hhmm(a.check_in),
        checkOut: hhmm(a.check_out),
        archived: a.archived_at !== null,
      })
    )
    .sort((a, b) => a.label.localeCompare(b.label, 'de', { numeric: true }))
})

const ROW_COLUMNS =
  'id, kind, number, apartment_id, arrival, departure, adults, child_ages, block_reason, option_until, cancelled_at, price_review, guest:guests(id, last_name, first_name), apartment:apartments!inner(name, property:properties!inner(name)), amounts:booking_amounts(nights_cents), charges:booking_charges(amount_cents)'

type ListDbRow = {
  id: string
  kind: string
  number: string | null
  apartment_id: string
  arrival: string
  departure: string
  adults: number | null
  child_ages: number[]
  block_reason: string | null
  option_until: string | null
  cancelled_at: string | null
  price_review: boolean
  guest: { id: string; last_name: string; first_name: string | null } | null
  apartment: { name: string; property: { name: string } }
  // eine Zeile je Buchung; PostgREST liefert sie als Liste (Verweis über id + tenant_id)
  amounts: { nights_cents: number }[]
  charges: { amount_cents: number }[]
}

// Aktive Einträge (für das Kennzeichen „überschneidet sich“) der betroffenen Wohnungen im Zeitraum
async function activeOccupancy(tenantId: string, apartmentIds: string[], from: string, to: string, today: string) {
  if (apartmentIds.length === 0) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('bookings')
    .select('id, kind, number, apartment_id, arrival, departure, block_reason, option_until, cancelled_at, guest:guests(last_name, first_name)')
    .eq('tenant_id', tenantId)
    .in('apartment_id', apartmentIds)
    .is('cancelled_at', null)
    .lt('arrival', to)
    .gt('departure', from)
    .limit(LIST_LIMIT * 2)
  if (error) console.error('[buchungen] Belegung nicht lesbar', error.message)
  return (data ?? [])
    .map((o) => ({
      id: o.id,
      apartmentId: o.apartment_id,
      kind: o.kind as BookingKind,
      number: o.number,
      arrival: o.arrival,
      departure: o.departure,
      cancelledAt: o.cancelled_at,
      optionUntil: o.option_until,
      blockReason: o.block_reason as BlockReason | null,
      guestName: o.guest ? guestSortName({ lastName: o.guest.last_name, firstName: o.guest.first_name }) : null,
    }))
    .filter((o) => bookingState(o, today) === 'active')
}

type Occupancy = Awaited<ReturnType<typeof activeOccupancy>>[number]
const toConflict = (o: Occupancy): Conflict => ({
  id: o.id,
  kind: o.kind,
  number: o.number,
  guestName: o.guestName,
  blockReason: o.blockReason,
  arrival: o.arrival,
  departure: o.departure,
})

function toRow(r: ListDbRow, owner: boolean, today: string, occupancy: Occupancy[]): BookingRow {
  const kind = r.kind as BookingKind
  const state = bookingState({ kind, cancelledAt: r.cancelled_at, optionUntil: r.option_until }, today)
  return {
    id: r.id,
    kind,
    number: r.number,
    apartmentId: r.apartment_id,
    apartmentLabel: apartmentLabel(r.apartment.property.name, r.apartment.name),
    arrival: r.arrival,
    departure: r.departure,
    guestName: r.guest ? guestSortName({ lastName: r.guest.last_name, firstName: r.guest.first_name }) : null,
    blockReason: r.block_reason as BlockReason | null,
    persons: kind === 'block' ? 0 : personCount(r.adults ?? 0, r.child_ages),
    state,
    optionUntil: r.option_until,
    totalCents: owner && r.amounts[0] ? totalCents({ nightsCents: r.amounts[0].nights_cents, charges: r.charges.map((c) => ({ label: '', amountCents: c.amount_cents })) }) : null,
    overlapping: state === 'active' && findConflicts({ id: r.id, apartmentId: r.apartment_id, arrival: r.arrival, departure: r.departure }, occupancy, today).length > 0,
    priceReview: r.price_review,
  }
}

export type BookingList = { rows: BookingRow[]; searching: boolean; truncated: boolean }

// Suchbegriff für die Adresse der Datenbank-Abfrage: nur Buchstaben, Ziffern, Leerzeichen und Bindestrich
const cleanQuery = (value: string) => value.replace(/[^\p{L}\d\s-]/gu, ' ').replace(/\s+/g, ' ').trim()

// Monatsliste bzw. Suche über alle Monate (neueste zuerst, höchstens 50 Treffer). Ohne Zustandsfilter nur aktive Einträge.
export async function getBookingList(filters: BookingFilters): Promise<BookingList> {
  const { tenantId, role } = await requireMember()
  const owner = role === 'owner'
  const today = todayIso()
  const supabase = await createClient()
  const query = cleanQuery(filters.query)
  const searching = query.length >= 2

  let request = supabase.from('bookings').select(ROW_COLUMNS).eq('tenant_id', tenantId)
  if (filters.apartment) request = request.eq('apartment_id', filters.apartment)
  if (filters.kind) request = request.eq('kind', filters.kind)
  if (filters.state === 'cancelled') request = request.not('cancelled_at', 'is', null)
  else if (filters.state === 'expired') request = request.eq('kind', 'option').is('cancelled_at', null).lt('option_until', today)
  else request = request.is('cancelled_at', null).or(`kind.neq.option,option_until.gte.${today}`)

  if (searching) {
    // Gäste über den vereinheitlichten Suchtext (PROJ-7), dazu die Buchungsnummer
    const words = searchKey(query).split(' ').filter(Boolean)
    let guests = supabase.from('guests').select('id').eq('tenant_id', tenantId)
    for (const w of words) guests = guests.like('search_text', `%${w}%`)
    const { data: hits } = await guests.limit(200)
    const ids = (hits ?? []).map((g) => g.id)
    const number = query.replace(/\s/g, '')
    request = request.or(ids.length ? `number.ilike.%${number}%,guest_id.in.(${ids.join(',')})` : `number.ilike.%${number}%`)
    request = request.order('arrival', { ascending: false }).limit(SEARCH_LIMIT + 1)
  } else {
    const { from, to } = monthRange(filters.month)
    request = request.lt('arrival', to).gt('departure', from).order('arrival').order('number').limit(LIST_LIMIT)
  }

  const { data, error } = await request
  if (error) console.error('[buchungen] Liste nicht lesbar', error.message)
  const rows = ((data ?? []) as unknown as ListDbRow[]).slice(0, searching ? SEARCH_LIMIT : LIST_LIMIT)
  let occupancy: Occupancy[] = []
  if (rows.length) {
    const from = rows.reduce((m, r) => (r.arrival < m ? r.arrival : m), rows[0].arrival)
    const to = rows.reduce((m, r) => (r.departure > m ? r.departure : m), rows[0].departure)
    occupancy = await activeOccupancy(tenantId, [...new Set(rows.map((r) => r.apartment_id))], from, to, today)
  }
  return {
    rows: rows.map((r) => toRow(r, owner, today, occupancy)),
    searching,
    truncated: searching && (data?.length ?? 0) > SEARCH_LIMIT,
  }
}

// Hat der Kunde überhaupt Einträge? (Leerzustand statt „Keine Buchungen gefunden“)
export async function hasAnyBooking(): Promise<boolean> {
  const { tenantId } = await requireMember()
  const supabase = await createClient()
  const { count, error } = await supabase.from('bookings').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)
  if (error) console.error('[buchungen] Anzahl nicht lesbar', error.message)
  return (count ?? 0) > 0
}

// Anzeigenamen (Storno, Übersteuern); frühere Mitglieder sind nicht mehr lesbar → null
async function displayNames(ids: (string | null)[]): Promise<Map<string, string>> {
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))]
  if (wanted.length === 0) return new Map()
  const supabase = await createClient()
  const { data } = await supabase.from('profiles').select('id, display_name, email').in('id', wanted)
  return new Map((data ?? []).map((p) => [p.id, p.display_name || p.email]))
}

// Einmal pro Anfrage (Seitentitel, App-Rahmen und Seite); fremde oder unbekannte Buchungen → „Seite nicht gefunden“
export const getBooking = cache(async (id: string): Promise<Booking> => (await findBooking(id)) ?? notFound())

// Wie getBooking, aber null statt „Seite nicht gefunden“ (Detailpanel im Belegungskalender, PROJ-9)
export const findBooking = cache(async (id: string): Promise<Booking | null> => {
  const { tenantId, role } = await requireMember()
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const supabase = await createClient()
  const { data: b, error } = await supabase
    .from('bookings')
    .select(
      'id, kind, channel, number, apartment_id, arrival, departure, check_in, check_out, adults, child_ages, block_reason, option_until, note, cancelled_at, cancelled_by, cancel_reason, override_by, price_review, updated_at, guest:guests(id, last_name, first_name, country, anonymized_at), apartment:apartments!inner(name, max_guests, archived_at, property:properties!inner(name)), companions:booking_companions(position, first_name, last_name, birth_date), amounts:booking_amounts(nights_cents, cancellation_fee_cents), charges:booking_charges(position, label, amount_cents)'
    )
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (error) console.error('[buchungen] Buchung nicht lesbar', error.message)
  if (!b) return null

  const today = todayIso()
  const kind = b.kind as BookingKind
  const state = bookingState({ kind, cancelledAt: b.cancelled_at, optionUntil: b.option_until }, today)
  const [occupancy, names] = await Promise.all([
    state === 'active' ? activeOccupancy(tenantId, [b.apartment_id], b.arrival, b.departure, today) : Promise.resolve([]),
    displayNames([b.cancelled_by, b.override_by]),
  ])
  const byPosition = <T extends { position: number }>(list: T[]) => [...list].sort((x, y) => x.position - y.position)
  const amounts = b.amounts[0]

  return {
    id: b.id,
    kind,
    channel: 'direct',
    number: b.number,
    apartment: {
      id: b.apartment_id,
      label: apartmentLabel(b.apartment.property.name, b.apartment.name),
      maxGuests: b.apartment.max_guests,
      archived: b.apartment.archived_at !== null,
    },
    arrival: b.arrival,
    departure: b.departure,
    checkIn: hhmm(b.check_in),
    checkOut: hhmm(b.check_out),
    guest: b.guest && {
      id: b.guest.id,
      lastName: b.guest.last_name,
      firstName: b.guest.first_name,
      country: b.guest.country,
      anonymized: b.guest.anonymized_at !== null,
    },
    adults: b.adults ?? 0,
    childAges: b.child_ages,
    blockReason: b.block_reason as BlockReason | null,
    optionUntil: b.option_until,
    note: b.note,
    cancelledAt: b.cancelled_at,
    cancelledBy: b.cancelled_by ? (names.get(b.cancelled_by) ?? null) : null,
    cancelReason: b.cancel_reason,
    overrideBy: b.override_by ? (names.get(b.override_by) ?? '–') : null,
    priceReview: b.price_review,
    companions: byPosition(b.companions).map((c) => ({ firstName: c.first_name, lastName: c.last_name, birthDate: c.birth_date })),
    amounts:
      role === 'owner' && kind !== 'block'
        ? {
            nightsCents: amounts?.nights_cents ?? 0,
            charges: byPosition(b.charges).map((c) => ({ label: c.label, amountCents: c.amount_cents })),
            cancellationFeeCents: amounts?.cancellation_fee_cents ?? null,
          }
        : null,
    conflicts: findConflicts({ id: b.id, apartmentId: b.apartment_id, arrival: b.arrival, departure: b.departure }, occupancy, today).map(toConflict),
    updatedAt: b.updated_at,
  }
})

// Buchungen eines Gastes (Gast-Detail, PROJ-7), neueste zuerst
export async function getGuestBookings(guestId: string): Promise<BookingRow[]> {
  const { tenantId, role } = await requireMember()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('bookings')
    .select(ROW_COLUMNS)
    .eq('tenant_id', tenantId)
    .eq('guest_id', guestId)
    .order('arrival', { ascending: false })
    .limit(200)
  if (error) console.error('[buchungen] Buchungen des Gastes nicht lesbar', error.message)
  const today = todayIso()
  return ((data ?? []) as unknown as ListDbRow[]).map((r) => toRow(r, role === 'owner', today, []))
}
