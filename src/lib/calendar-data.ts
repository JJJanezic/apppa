import 'server-only'

import { apartmentLabel } from '@/lib/apartments'
import { type BlockReason, type BookingChannel, type BookingKind, bookingState, personCount, todayIso } from '@/lib/bookings'
import type { CalendarApartment, CalendarEntry } from '@/lib/calendar'
import { guestDisplayName } from '@/lib/guests'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext } from '@/lib/tenant'

// Lesefunktion des Belegungskalenders (PROJ-9) für alle Mitglieder des gewählten Kunden.
// Bewusst ohne Beträge: Der Kalender zeigt keine Preise, und so erreichen sie auch keine Mitarbeiter.

const ENTRY_LIMIT = 3000

export type CalendarData = { apartments: CalendarApartment[]; entries: CalendarEntry[]; failed: boolean }

// Wohnungen (auch archivierte) und aktive Einträge mit Anreise vor `to` und Abreise ab `from`
export async function getCalendarData(range: { from: string; to: string }): Promise<CalendarData> {
  const { active } = await getTenantContext()
  if (!active) return { apartments: [], entries: [], failed: false }
  const supabase = await createClient()
  const today = todayIso()

  const [apartmentsResult, entriesResult] = await Promise.all([
    supabase.from('apartments').select('id, name, archived_at, property:properties!inner(id, name)').eq('tenant_id', active.id).limit(500),
    supabase
      .from('bookings')
      .select('id, kind, channel, apartment_id, arrival, departure, adults, child_ages, block_reason, option_until, cancelled_at, guest:guests(last_name, first_name)')
      .eq('tenant_id', active.id)
      .is('cancelled_at', null)
      .lt('arrival', range.to)
      .gte('departure', range.from)
      .order('arrival')
      .limit(ENTRY_LIMIT),
  ])
  if (apartmentsResult.error) console.error('[belegung] Wohnungen nicht lesbar', apartmentsResult.error.message)
  if (entriesResult.error) console.error('[belegung] Einträge nicht lesbar', entriesResult.error.message)

  // Reihenfolge wie in Formularen und Filtern: „Objekt · Wohnung“
  const label = (a: CalendarApartment) => apartmentLabel(a.propertyName, a.name)
  const apartments = (apartmentsResult.data ?? [])
    .map(
      (a): CalendarApartment => ({
        id: a.id,
        name: a.name,
        propertyId: a.property.id,
        propertyName: a.property.name,
        archived: a.archived_at !== null,
      })
    )
    .sort((a, b) => label(a).localeCompare(label(b), 'de', { numeric: true }))

  const entries = (entriesResult.data ?? [])
    .filter((e) => bookingState({ kind: e.kind as BookingKind, cancelledAt: e.cancelled_at, optionUntil: e.option_until }, today) === 'active')
    .map(
      (e): CalendarEntry => ({
        id: e.id,
        apartmentId: e.apartment_id,
        kind: e.kind as BookingKind,
        channel: e.channel as BookingChannel,
        arrival: e.arrival,
        departure: e.departure,
        guestLastName: e.guest?.last_name ?? null,
        guestName: e.guest ? guestDisplayName({ lastName: e.guest.last_name, firstName: e.guest.first_name }) : null,
        persons: e.kind === 'block' ? 0 : personCount(e.adults ?? 0, e.child_ages),
        blockReason: e.block_reason as BlockReason | null,
      })
    )

  return { apartments, entries, failed: Boolean(apartmentsResult.error || entriesResult.error) }
}
