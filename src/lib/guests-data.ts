import 'server-only'

import { notFound } from 'next/navigation'
import { cache } from 'react'

import {
  type ContactSource,
  type DuplicatePair,
  type DuplicateReason,
  type Guest,
  type GuestFilters,
  GUEST_PAGE_SIZE,
  type GuestPage,
  type GuestRow,
  type Language,
  type MarketingSource,
} from '@/lib/guests'
import type { Role } from '@/lib/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import { getTenantContext } from '@/lib/tenant'

// Lesefunktionen der Gäste-Datenbank (PROJ-7) für alle Mitglieder des gewählten Kunden.
// Rechte prüft die Datenbank zusätzlich (RLS: Lesen für Mitglieder, Dubletten nur für Inhaber).

type GuestDbRow = Database['public']['Tables']['guests']['Row']

export const GUEST_COLUMNS =
  'id, last_name, first_name, country, email, email_source, phone, phone_source, language, birth_date, street, postal_code, city, address_country, marketing_source, marketing_custom, company_name, company_vat_id, company_billing_address, note, anonymized_at, updated_at'

// Aufenthalte kommen mit den Buchungen (PROJ-8)
const NO_STAYS = { count: 0, last: null, next: null, channels: [] }

async function requireMember(): Promise<{ tenantId: string; role: Role }> {
  const { active } = await getTenantContext()
  if (!active) notFound()
  return { tenantId: active.id, role: active.role }
}

export function toGuest(g: Pick<GuestDbRow, Exclude<keyof GuestDbRow, 'tenant_id' | 'created_at' | 'created_by' | 'updated_by' | 'search_text' | 'email_key' | 'phone_key' | 'name_key'>>): Guest {
  return {
    id: g.id,
    lastName: g.last_name,
    firstName: g.first_name,
    country: g.country,
    email: g.email,
    emailSource: g.email_source as ContactSource,
    phone: g.phone,
    phoneSource: g.phone_source as ContactSource,
    language: g.language as Language | null,
    birthDate: g.birth_date,
    street: g.street,
    postalCode: g.postal_code,
    city: g.city,
    addressCountry: g.address_country,
    marketingSource: g.marketing_source as MarketingSource | null,
    marketingCustom: g.marketing_custom,
    companyName: g.company_name,
    companyVatId: g.company_vat_id,
    companyBillingAddress: g.company_billing_address,
    note: g.note,
    anonymizedAt: g.anonymized_at,
    updatedAt: g.updated_at,
    stays: NO_STAYS,
  }
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

type ListRow = {
  id: string
  last_name: string
  first_name: string | null
  company_name: string | null
  country: string
  anonymized_at: string | null
  stay_count: number
  last_stay: string | null
  total: number
}

const listRow = (r: ListRow): GuestRow => ({
  id: r.id,
  lastName: r.last_name,
  firstName: r.first_name,
  companyName: r.company_name,
  country: r.country,
  stayCount: r.stay_count,
  lastStay: r.last_stay,
  anonymized: r.anonymized_at !== null,
})

// Suche, Filter, Sortierung und Blättern laufen in der Datenbank (public.guest_list)
export async function getGuestPage(filters: GuestFilters): Promise<GuestPage> {
  const { tenantId } = await requireMember()
  const supabase = await createClient()
  const load = (page: number) =>
    supabase.rpc('guest_list', {
      p_tenant_id: tenantId,
      p_query: filters.query,
      p_country: filters.country ?? undefined,
      p_marketing: filters.marketing ?? undefined,
      p_sort: filters.sort,
      p_limit: GUEST_PAGE_SIZE,
      p_offset: (page - 1) * GUEST_PAGE_SIZE,
    })
  let page = filters.page
  let { data, error } = await load(page)
  // Seite hinter dem Ende (alter Link, Filter geändert): erste Seite zeigen
  if (!error && data?.length === 0 && page > 1) {
    page = 1
    ;({ data, error } = await load(page))
  }
  if (error) console.error('[gaeste] Liste nicht lesbar', error.message)
  const rows = ((data ?? []) as ListRow[]).map(listRow)
  const total = Number((data as ListRow[] | null)?.[0]?.total ?? 0)
  return { ...filters, page, rows, total, pageCount: Math.max(1, Math.ceil(total / GUEST_PAGE_SIZE)) }
}

// Hat der Kunde überhaupt Gäste? (Leerzustand statt „Keine Gäste gefunden“)
export async function hasAnyGuest(): Promise<boolean> {
  const { tenantId } = await requireMember()
  const supabase = await createClient()
  const { count, error } = await supabase.from('guests').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)
  if (error) console.error('[gaeste] Anzahl nicht lesbar', error.message)
  return (count ?? 0) > 0
}

// Einmal pro Anfrage (Seitentitel und Seite); fremde oder unbekannte Gäste → „Seite nicht gefunden“
export const getGuest = cache(async (id: string): Promise<Guest> => {
  const { tenantId } = await requireMember()
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const supabase = await createClient()
  const { data, error } = await supabase.from('guests').select(GUEST_COLUMNS).eq('id', id).eq('tenant_id', tenantId).maybeSingle()
  if (error) console.error('[gaeste] Gast nicht lesbar', error.message)
  if (!data) notFound()
  return toGuest(data)
})

// Mögliche Dubletten (nur Inhaber): Paare mit gleicher E-Mail, Telefonnummer oder gleichem Vor- und Nachnamen
export async function getDuplicatePairs(): Promise<DuplicatePair[]> {
  const { tenantId, role } = await requireMember()
  if (role !== 'owner') notFound()
  const supabase = await createClient()
  const { data: pairs, error } = await supabase.rpc('guest_duplicate_pairs', { p_tenant_id: tenantId })
  if (error) console.error('[gaeste] Dubletten nicht lesbar', error.message)
  if (!pairs?.length) return []

  const ids = [...new Set(pairs.flatMap((p) => [p.guest_a, p.guest_b]))]
  const { data: guests } = await supabase.from('guests').select(GUEST_COLUMNS).in('id', ids)
  const byId = new Map((guests ?? []).map((g) => [g.id, toRow(toGuest(g))]))
  return pairs
    .filter((p) => byId.has(p.guest_a) && byId.has(p.guest_b))
    .map((p) => ({ a: byId.get(p.guest_a)!, b: byId.get(p.guest_b)!, reasons: p.reasons as DuplicateReason[] }))
}
