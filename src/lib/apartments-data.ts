import 'server-only'

import { notFound } from 'next/navigation'

import type { Apartment, FederalState, Property } from '@/lib/apartments'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext } from '@/lib/tenant'

// Lesefunktionen für Objekte und Wohnungen (PROJ-6), nur für Inhaber des gewählten Kunden (Einstellungen).
// Rechte prüft die Datenbank zusätzlich (RLS: Lesen für Mitglieder, Schreiben für Inhaber).

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, 'de', { numeric: true })
// Datenbank liefert Uhrzeiten als „15:00:00“
const hhmm = (value: string) => value.slice(0, 5)

export async function getProperties(): Promise<Property[]> {
  const { active } = await getTenantContext()
  if (!active || active.role !== 'owner') notFound()

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('properties')
    .select(
      'id, name, street, postal_code, city, municipality:municipalities!inner(code, name, state), apartments(id, property_id, name, max_guests, kind, price_cents, cleaning_fee_cents, check_in, check_out, note, archived_at)'
    )
    .eq('tenant_id', active.id)
    .limit(500)
  if (error) console.error('[wohnungen] Objekte nicht lesbar', error.message)

  // Buchungen je Wohnung (PROJ-8): ob es welche gibt und die Personenzahl künftiger aktiver Einträge
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Vienna' })
  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('apartment_id, kind, departure, adults, child_ages, cancelled_at, option_until')
    .eq('tenant_id', active.id)
    .limit(10000)
  if (bookingsError) console.error('[wohnungen] Buchungen nicht lesbar', bookingsError.message)
  const withBookings = new Set((bookings ?? []).map((b) => b.apartment_id))
  const futurePersons = new Map<string, number[]>()
  for (const b of bookings ?? []) {
    const active = b.cancelled_at === null && (b.kind !== 'option' || (b.option_until ?? '') >= today)
    if (b.kind === 'block' || !active || b.departure <= today) continue
    futurePersons.set(b.apartment_id, [...(futurePersons.get(b.apartment_id) ?? []), (b.adults ?? 0) + b.child_ages.length])
  }

  return (data ?? [])
    .map((p) => ({
      id: p.id,
      name: p.name,
      street: p.street,
      postalCode: p.postal_code,
      city: p.city,
      municipality: { code: p.municipality.code, name: p.municipality.name, state: p.municipality.state as FederalState },
      apartments: p.apartments
        .map(
          (a): Apartment => ({
            id: a.id,
            propertyId: a.property_id,
            name: a.name,
            maxGuests: a.max_guests,
            kind: a.kind as Apartment['kind'],
            priceCents: a.price_cents,
            cleaningFeeCents: a.cleaning_fee_cents,
            checkIn: hhmm(a.check_in),
            checkOut: hhmm(a.check_out),
            note: a.note,
            archivedAt: a.archived_at,
            hasBookings: withBookings.has(a.id),
            futurePersons: futurePersons.get(a.id) ?? [],
          })
        )
        .sort(byName),
    }))
    .sort(byName)
}
