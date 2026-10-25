import 'server-only'

import { notFound } from 'next/navigation'
import { cache } from 'react'

import { apartmentLabel } from '@/lib/apartments'
import {
  addDays,
  type BookableApartment,
  type Booking,
  type BookingFilters,
  type BookingRow,
  bookingState,
  filterRows,
  findConflicts,
  formatBookingNumber,
  personCount,
  todayIso,
  totalCents,
} from '@/lib/bookings'
import { guestSortName } from '@/lib/guests'
import type { Role } from '@/lib/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext } from '@/lib/tenant'

// Lesefunktionen der Buchungen (PROJ-8) für alle Mitglieder des gewählten Kunden; Beträge nur für Inhaber.
// VORLÄUFIG bis /backend: Die Tabellen fehlen noch. In der Entwicklung liefern die Funktionen Beispielbuchungen
// auf den echten Wohnungen und Gästen des Kunden, damit sich Liste, Detail und Formulare ansehen lassen; sonst leer.

const samplesEnabled = () => process.env.NODE_ENV === 'development'
// Datenbank liefert Uhrzeiten als „15:00:00“
const hhmm = (value: string) => value.slice(0, 5)

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
    .select('id, name, max_guests, price_cents, check_in, check_out, archived_at, property:properties!inner(name)')
    .eq('tenant_id', tenantId)
    .limit(500)
  if (error) console.error('[buchungen] Wohnungen nicht lesbar', error.message)
  return (data ?? [])
    .map(
      (a): BookableApartment => ({
        id: a.id,
        label: apartmentLabel(a.property.name, a.name),
        maxGuests: a.max_guests,
        priceCents: a.price_cents,
        // Reinigungsgebühr kommt mit /backend (neues Feld der Wohnung)
        cleaningFeeCents: null,
        checkIn: hhmm(a.check_in),
        checkOut: hhmm(a.check_out),
        archived: a.archived_at !== null,
      })
    )
    .sort((a, b) => a.label.localeCompare(b.label, 'de', { numeric: true }))
})

// ---- VORLÄUFIG: Beispielbuchungen ------------------------------------------------------------------

type SampleGuest = { id: string; lastName: string; firstName: string | null; country: string }
const FALLBACK_GUESTS: SampleGuest[] = [
  { id: '00000000-0000-4000-9100-000000000001', lastName: 'Huber', firstName: 'Anna', country: 'AT' },
  { id: '00000000-0000-4000-9100-000000000002', lastName: 'Schmidt', firstName: 'Jonas', country: 'DE' },
  { id: '00000000-0000-4000-9100-000000000003', lastName: 'Rossi', firstName: 'Giulia', country: 'IT' },
  { id: '00000000-0000-4000-9100-000000000004', lastName: 'Brown', firstName: 'Olivia', country: 'US' },
]
const sampleId = (n: number) => `00000000-0000-4000-9000-${String(n).padStart(12, '0')}`

const getSamples = cache(async (): Promise<Booking[]> => {
  if (!samplesEnabled()) return []
  const { tenantId, role } = await requireMember()
  const apartments = (await getBookableApartments()).filter((a) => !a.archived)
  if (apartments.length === 0) return []
  const supabase = await createClient()
  const { data } = await supabase
    .from('guests')
    .select('id, last_name, first_name, country')
    .eq('tenant_id', tenantId)
    .is('anonymized_at', null)
    .order('last_name')
    .limit(4)
  const real = (data ?? []).map((g) => ({ id: g.id, lastName: g.last_name, firstName: g.first_name, country: g.country }))
  const guests = real.length >= 4 ? real : [...real, ...FALLBACK_GUESTS].slice(0, 4)
  const apt = (i: number) => apartments[i % apartments.length]
  const today = todayIso()
  const year = Number(today.slice(0, 4))
  const owner = role === 'owner'

  type Seed = Partial<Booking> & { n: number; aptIndex: number; guestIndex: number | null; from: number; to: number; nightsEuro?: number; fee?: number }
  const seeds: Seed[] = [
    { n: 1, kind: 'booking', aptIndex: 0, guestIndex: 0, from: -2, to: 3, adults: 2, childAges: [4], nightsEuro: 600, note: 'Kinderbett aufstellen.' },
    { n: 2, kind: 'option', aptIndex: 1, guestIndex: 1, from: 10, to: 14, adults: 1, optionUntil: addDays(today, 3) },
    { n: 3, kind: 'block', aptIndex: 0, guestIndex: null, from: 5, to: 8, blockReason: 'renovation', note: 'Malerarbeiten im Bad' },
    { n: 4, kind: 'booking', aptIndex: 0, guestIndex: 2, from: 7, to: 10, adults: 2, nightsEuro: 360, overrideBy: 'Inhaber', priceReview: true },
    { n: 5, kind: 'option', aptIndex: 2, guestIndex: 3, from: 20, to: 27, adults: 3, optionUntil: addDays(today, -1) },
    { n: 6, kind: 'booking', aptIndex: 1, guestIndex: 0, from: -10, to: -6, adults: 2, nightsEuro: 400, fee: 50, cancelledAt: `${addDays(today, -20)}T09:30:00.000Z`, cancelledBy: 'Inhaber', cancelReason: 'Krankheit' },
    { n: 7, kind: 'booking', aptIndex: 1, guestIndex: 3, from: -35, to: -28, adults: 4, childAges: [12, 9], nightsEuro: 980 },
  ]
  let seq = 0
  const bookings = seeds.map((s): Booking => {
    const a = apt(s.aptIndex)
    const g = s.guestIndex === null ? null : guests[s.guestIndex]
    const kind = s.kind ?? 'booking'
    return {
      id: sampleId(s.n),
      kind,
      channel: 'direct',
      number: kind === 'block' ? null : formatBookingNumber(year, ++seq),
      apartment: { id: a.id, label: a.label, maxGuests: a.maxGuests, archived: a.archived },
      arrival: addDays(today, s.from),
      departure: addDays(today, s.to),
      checkIn: a.checkIn,
      checkOut: a.checkOut,
      guest: g && { ...g, anonymized: false },
      adults: s.adults ?? 0,
      childAges: s.childAges ?? [],
      blockReason: s.blockReason ?? null,
      optionUntil: s.optionUntil ?? null,
      note: s.note ?? null,
      cancelledAt: s.cancelledAt ?? null,
      cancelledBy: s.cancelledBy ?? null,
      cancelReason: s.cancelReason ?? null,
      overrideBy: s.overrideBy ?? null,
      priceReview: s.priceReview ?? false,
      companions: s.n === 1 ? [{ firstName: 'Max', lastName: g?.lastName ?? 'Huber', birthDate: '1985-03-12' }] : [],
      amounts:
        owner && kind !== 'block'
          ? {
              nightsCents: (s.nightsEuro ?? 0) * 100,
              charges: [{ label: 'Reinigung', amountCents: 6000 }],
              cancellationFeeCents: s.fee === undefined ? null : s.fee * 100,
            }
          : null,
      conflicts: [],
      updatedAt: '2026-10-20T09:00:00.000Z',
    }
  })
  return withConflicts(bookings, today)
})

// Aktuelle Überschneidungen je Eintrag (nur aktive Einträge)
function withConflicts(bookings: Booking[], today: string): Booking[] {
  const occ = bookings.map((b) => ({ ...b, apartmentId: b.apartment.id }))
  return bookings.map((b) => ({
    ...b,
    conflicts:
      bookingState(b, today) === 'active'
        ? findConflicts({ id: b.id, apartmentId: b.apartment.id, arrival: b.arrival, departure: b.departure }, occ, today).map((o) => ({
            id: o.id,
            kind: o.kind,
            number: o.number,
            guestName: o.guest ? guestSortName(o.guest) : null,
            blockReason: o.blockReason,
            arrival: o.arrival,
            departure: o.departure,
          }))
        : [],
  }))
}

function toRow(b: Booking, today: string): BookingRow {
  return {
    id: b.id,
    kind: b.kind,
    number: b.number,
    apartmentId: b.apartment.id,
    apartmentLabel: b.apartment.label,
    arrival: b.arrival,
    departure: b.departure,
    guestName: b.guest ? guestSortName(b.guest) : null,
    blockReason: b.blockReason,
    persons: personCount(b.adults, b.childAges),
    state: bookingState(b, today),
    optionUntil: b.optionUntil,
    totalCents: b.amounts ? totalCents(b.amounts) : null,
    overlapping: b.conflicts.length > 0,
    priceReview: b.priceReview,
  }
}

// ---- Lesefunktionen -------------------------------------------------------------------------------

export type BookingList = { rows: BookingRow[]; searching: boolean; truncated: boolean }
const SEARCH_LIMIT = 50

// Monatsliste bzw. Suche über alle Monate (neueste zuerst, höchstens 50 Treffer)
export async function getBookingList(filters: BookingFilters): Promise<BookingList> {
  await requireMember()
  const today = todayIso()
  const all = (await getSamples()).map((b) => toRow(b, today))
  const query = filters.query.trim().toLowerCase()
  if (query.length >= 2) {
    const hits = filterRows(all, filters, true)
      .filter((r) => (r.number ?? '').includes(query) || (r.guestName ?? '').toLowerCase().includes(query))
      .sort((a, b) => b.arrival.localeCompare(a.arrival))
    return { rows: hits.slice(0, SEARCH_LIMIT), searching: true, truncated: hits.length > SEARCH_LIMIT }
  }
  const rows = filterRows(all, filters, false).sort((a, b) => a.arrival.localeCompare(b.arrival) || (a.number ?? '').localeCompare(b.number ?? ''))
  return { rows, searching: false, truncated: false }
}

// Hat der Kunde überhaupt Einträge? (Leerzustand statt „Keine Buchungen gefunden“)
export async function hasAnyBooking(): Promise<boolean> {
  await requireMember()
  return (await getSamples()).length > 0
}

// Einmal pro Anfrage (Seitentitel, App-Rahmen und Seite); fremde oder unbekannte Buchungen → „Seite nicht gefunden“
export const getBooking = cache(async (id: string): Promise<Booking> => {
  await requireMember()
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const booking = (await getSamples()).find((b) => b.id === id)
  if (!booking) notFound()
  return booking
})

// Belegung derselben Wohnung für die Vorschau der Konfliktprüfung (VORLÄUFIG: Beispielbuchungen)
export async function getOccupancy(apartmentId: string) {
  return (await getSamples())
    .filter((b) => b.apartment.id === apartmentId)
    .map((b) => ({ ...b, apartmentId: b.apartment.id }))
}
