import 'server-only'

import { notFound } from 'next/navigation'
import { cache } from 'react'

import {
  duplicateReasons,
  type DuplicatePair,
  type Guest,
  type GuestFilters,
  GUEST_PAGE_SIZE,
  type GuestPage,
  type GuestRow,
  guestSortName,
  MARKETING_CUSTOM,
  MARKETING_NONE,
  phoneDigits,
  searchKey,
} from '@/lib/guests'
import type { Role } from '@/lib/navigation'
import { getTenantContext } from '@/lib/tenant'

// Lesefunktionen der Gäste-Datenbank (PROJ-7) für alle Mitglieder des gewählten Kunden.
// VORLÄUFIG bis /backend: Die Tabelle fehlt noch. In der Entwicklung liefern die Funktionen Beispielgäste,
// damit sich Liste, Detail und Zusammenführen ansehen lassen; sonst eine leere Liste.

const SAMPLE_UPDATED_AT = '2026-10-20T09:00:00.000Z'
const NO_STAYS = { count: 0, last: null, next: null, channels: [] }
const base = {
  firstName: null,
  email: null,
  emailSource: 'direct',
  phone: null,
  phoneSource: 'direct',
  language: null,
  birthDate: null,
  street: null,
  postalCode: null,
  city: null,
  addressCountry: null,
  marketingSource: null,
  marketingCustom: null,
  companyName: null,
  companyVatId: null,
  companyBillingAddress: null,
  note: null,
  anonymizedAt: null,
  updatedAt: SAMPLE_UPDATED_AT,
  stays: NO_STAYS,
} as const satisfies Omit<Guest, 'id' | 'lastName' | 'country'>

const SAMPLES: Guest[] = [
  { ...base, id: '00000000-0000-4000-8000-000000000001', lastName: 'Huber', firstName: 'Anna', country: 'AT', email: 'anna.huber@example.at', phone: '+43 664 1234567', language: 'de', street: 'Lagergasse 12', postalCode: '8020', city: 'Graz', addressCountry: 'AT', marketingSource: 'instagram' },
  { ...base, id: '00000000-0000-4000-8000-000000000002', lastName: 'Huber', firstName: 'Anna', country: 'AT', email: 'a.huber-4821@guest.booking.com', emailSource: 'platform', marketingSource: 'platform_search' },
  { ...base, id: '00000000-0000-4000-8000-000000000003', lastName: 'Berger', country: 'AT', phone: '0316 98765', marketingCustom: 'Messe Graz 2026', note: 'Familie mit zwei Kindern, Kinderbett mitbringen.' },
  { ...base, id: '00000000-0000-4000-8000-000000000004', lastName: 'Schmidt', firstName: 'Jonas', country: 'DE', email: 'jonas.schmidt@example.de', language: 'de', companyName: 'Montagebau Schmidt GmbH', companyVatId: 'DE123456789', companyBillingAddress: 'Industriestraße 4, 80331 München', marketingSource: 'referral' },
  { ...base, id: '00000000-0000-4000-8000-000000000005', lastName: 'Rossi', firstName: 'Giulia', country: 'IT', email: 'giulia.rossi@example.it', language: 'it', marketingSource: 'website' },
  { ...base, id: '00000000-0000-4000-8000-000000000006', lastName: 'Brown', firstName: 'Olivia', country: 'US', email: 'olivia.brown@example.com', language: 'en', birthDate: '1988-04-17' },
  { ...base, id: '00000000-0000-4000-8000-000000000007', lastName: 'Gelöschter Gast', country: 'NL', anonymizedAt: '2026-10-22T10:00:00.000Z' },
]

const samplesEnabled = () => process.env.NODE_ENV === 'development'

async function requireMember(): Promise<{ tenantId: string; role: Role }> {
  const { active } = await getTenantContext()
  if (!active) notFound()
  return { tenantId: active.id, role: active.role }
}

export const toRow = (g: Guest): GuestRow => ({
  id: g.id,
  lastName: g.lastName,
  firstName: g.firstName,
  companyName: g.companyName,
  country: g.country,
  stayCount: g.stays.count,
  lastStay: g.stays.last,
  anonymized: g.anonymizedAt !== null,
})

function matches(g: Guest, f: GuestFilters): boolean {
  if (f.country && g.country !== f.country) return false
  if (f.marketing === MARKETING_NONE && (g.marketingSource || g.marketingCustom)) return false
  if (f.marketing === MARKETING_CUSTOM && !g.marketingCustom) return false
  if (f.marketing && f.marketing !== MARKETING_NONE && f.marketing !== MARKETING_CUSTOM && g.marketingSource !== f.marketing) return false
  if (!f.query) return true
  const needle = searchKey(f.query)
  const haystack = searchKey([g.lastName, g.firstName, g.companyName, g.email].filter(Boolean).join(' '))
  const digits = phoneDigits(f.query)
  return haystack.includes(needle) || (digits.length >= 3 && phoneDigits(g.phone ?? '').includes(digits))
}

export async function getGuestPage(filters: GuestFilters): Promise<GuestPage> {
  await requireMember()
  const all = samplesEnabled() ? SAMPLES.filter((g) => matches(g, filters)) : []
  const sorted = all.sort((a, b) =>
    filters.sort === 'lastStay'
      ? (b.stays.last ?? '').localeCompare(a.stays.last ?? '') || guestSortName(a).localeCompare(guestSortName(b), 'de')
      : guestSortName(a).localeCompare(guestSortName(b), 'de')
  )
  const total = sorted.length
  const pageCount = Math.max(1, Math.ceil(total / GUEST_PAGE_SIZE))
  // Seite hinter dem Ende (alter Link, Filter geändert): erste Seite zeigen
  const page = filters.page > pageCount ? 1 : filters.page
  const rows = sorted.slice((page - 1) * GUEST_PAGE_SIZE, page * GUEST_PAGE_SIZE).map(toRow)
  return { ...filters, page, rows, total, pageCount }
}

// Hat der Kunde überhaupt Gäste? (Leerzustand statt „Keine Gäste gefunden“)
export async function hasAnyGuest(): Promise<boolean> {
  await requireMember()
  return samplesEnabled() && SAMPLES.length > 0
}

// Einmal pro Anfrage (Seitentitel und Seite); fremde oder unbekannte Gäste → „Seite nicht gefunden“
export const getGuest = cache(async (id: string): Promise<Guest> => {
  await requireMember()
  const guest = samplesEnabled() ? SAMPLES.find((g) => g.id === id) : undefined
  if (!guest) notFound()
  return guest
})

// Mögliche Dubletten (nur Inhaber): Paare mit gleicher E-Mail, Telefonnummer oder gleichem Vor- und Nachnamen
export async function getDuplicatePairs(): Promise<DuplicatePair[]> {
  const { role } = await requireMember()
  if (role !== 'owner') notFound()
  if (!samplesEnabled()) return []
  const active = SAMPLES.filter((g) => !g.anonymizedAt)
  const pairs: DuplicatePair[] = []
  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const reasons = duplicateReasons(active[i], active[j])
      if (reasons.length) pairs.push({ a: toRow(active[i]), b: toRow(active[j]), reasons })
    }
  }
  return pairs
}

// Für die Aktionen (Suche beim Zusammenführen, Dublettenwarnung) bis zum Backend
export function sampleGuests(): Guest[] {
  return samplesEnabled() ? SAMPLES : []
}
