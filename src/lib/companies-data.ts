import 'server-only'

import { notFound } from 'next/navigation'
import { cache } from 'react'

import { getCompanyBookings } from '@/lib/bookings-data'
import {
  type Company,
  type CompanyDuplicatePair,
  type CompanyDuplicateReason,
  type CompanyFilters,
  COMPANY_PAGE_SIZE,
  type CompanyPage,
  type CompanyRow,
} from '@/lib/companies'
import type { GuestRow } from '@/lib/guests'
import { getCreditNotesFor } from '@/lib/invoice-credit-data'
import { EMPTY_INVOICE_FILTERS, invoiceDocKindFromDb, invoiceOriginFromDb, type InvoicePage } from '@/lib/invoices'
import type { Role } from '@/lib/navigation'
import { getPaymentStates } from '@/lib/payments-data'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext } from '@/lib/tenant'

// Lesefunktionen der Firmenliste (PROJ-50) für alle Mitglieder des gewählten Kunden.
// Rechte prüft die Datenbank zusätzlich (RLS: Lesen für Mitglieder, Dubletten nur für Inhaber).

async function requireMember(): Promise<{ tenantId: string; role: Role }> {
  const { active } = await getTenantContext()
  if (!active) notFound()
  return { tenantId: active.id, role: active.role }
}

export const COMPANY_COLUMNS =
  'id, name, name_missing, vat_id, address_line1, address_line2, postal_code, city, country, email, website, contact, updated_at'

type CompanyDb = {
  id: string
  name: string
  name_missing: boolean
  vat_id: string | null
  address_line1: string | null
  address_line2: string | null
  postal_code: string | null
  city: string | null
  country: string | null
  email: string | null
  website: string | null
  contact: string | null
  updated_at: string
}

export const toCompany = (c: CompanyDb, guestCount = 0): Company => ({
  id: c.id,
  name: c.name,
  nameMissing: c.name_missing,
  vatId: c.vat_id,
  addressLine1: c.address_line1,
  addressLine2: c.address_line2,
  postalCode: c.postal_code,
  city: c.city,
  country: c.country,
  email: c.email,
  website: c.website,
  contact: c.contact,
  updatedAt: c.updated_at,
  guestCount,
})

export const toCompanyRow = (c: Company): CompanyRow => ({
  id: c.id,
  name: c.name,
  nameMissing: c.nameMissing,
  vatId: c.vatId,
  addressLine1: c.addressLine1,
  postalCode: c.postalCode,
  city: c.city,
  country: c.country,
  guestCount: c.guestCount,
})

export type CompanyListDb = {
  id: string
  name: string
  name_missing: boolean
  vat_id: string | null
  address_line1: string | null
  postal_code: string | null
  city: string | null
  country: string | null
  guest_count: number
  total: number
}

export const companyListRow = (r: Omit<CompanyListDb, 'total'>): CompanyRow => ({
  id: r.id,
  name: r.name,
  nameMissing: r.name_missing,
  vatId: r.vat_id,
  addressLine1: r.address_line1,
  postalCode: r.postal_code,
  city: r.city,
  country: r.country,
  guestCount: Number(r.guest_count),
})

// Suche, Sortierung und Blättern laufen in der Datenbank (public.company_list)
export async function getCompanyPage(filters: CompanyFilters): Promise<CompanyPage> {
  const { tenantId } = await requireMember()
  const supabase = await createClient()
  const load = (page: number) =>
    supabase.rpc('company_list', {
      p_tenant_id: tenantId,
      p_query: filters.query,
      p_limit: COMPANY_PAGE_SIZE,
      p_offset: (page - 1) * COMPANY_PAGE_SIZE,
    })
  let page = filters.page
  let { data, error } = await load(page)
  // Seite hinter dem Ende (alter Link, Suche geändert): erste Seite zeigen
  if (!error && data?.length === 0 && page > 1) {
    page = 1
    ;({ data, error } = await load(page))
  }
  if (error) console.error('[firmen] Liste nicht lesbar', error.message)
  const rows = ((data ?? []) as CompanyListDb[]).map(companyListRow)
  const total = Number((data as CompanyListDb[] | null)?.[0]?.total ?? 0)
  return { ...filters, page, rows, total, pageCount: Math.max(1, Math.ceil(total / COMPANY_PAGE_SIZE)) }
}

// Hat der Kunde überhaupt Firmen? (Leerzustand statt „Keine Firmen gefunden“)
export async function hasAnyCompany(): Promise<boolean> {
  const { tenantId } = await requireMember()
  const supabase = await createClient()
  const { count, error } = await supabase.from('companies').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)
  if (error) console.error('[firmen] Anzahl nicht lesbar', error.message)
  return (count ?? 0) > 0
}

// Einmal pro Anfrage (Seitentitel und Seite); fremde oder unbekannte Firmen → „Seite nicht gefunden“
export const getCompany = cache(async (id: string): Promise<Company> => {
  const { tenantId } = await requireMember()
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const supabase = await createClient()
  const [{ data, error }, guests] = await Promise.all([
    supabase.from('companies').select(COMPANY_COLUMNS).eq('id', id).eq('tenant_id', tenantId).maybeSingle(),
    supabase.from('guests').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('company_id', id),
  ])
  if (error) console.error('[firmen] Firma nicht lesbar', error.message)
  if (!data) notFound()
  return toCompany(data, guests.count ?? 0)
})

// Verknüpfte Gäste (Abschnitt „Gäste“), alphabetisch
export const getCompanyGuests = cache(async (companyId: string): Promise<GuestRow[]> => {
  const { tenantId } = await requireMember()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('guests')
    .select('id, last_name, first_name, title_prefix, title_suffix, country, anonymized_at')
    .eq('tenant_id', tenantId)
    .eq('company_id', companyId)
    .order('last_name')
    .order('first_name')
    .limit(500)
  if (error) console.error('[firmen] Gäste der Firma nicht lesbar', error.message)
  return (data ?? []).map((g) => ({
    id: g.id,
    lastName: g.last_name,
    firstName: g.first_name,
    titlePrefix: g.title_prefix,
    titleSuffix: g.title_suffix,
    companyId,
    companyName: null,
    country: g.country,
    stayCount: 0,
    lastStay: null,
    anonymized: g.anonymized_at !== null,
  }))
})

export async function getCompanyBookingRows(companyId: string) {
  const guests = await getCompanyGuests(companyId)
  return getCompanyBookings(guests.map((g) => g.id))
}

export const COMPANY_INVOICE_LIMIT = 200

type InvoiceDb = {
  id: string
  number: string | null
  invoice_date: string
  recipient: string
  total_cents: number
  origin: string
  kind: string | null
  pdf_path: string | null
  booking: { id: string; number: string | null } | null
}

// Rechnungen an die Firma (Abschnitt „Rechnungen“): Empfänger-Art „Firma“ zu Buchungen der verknüpften Gäste, samt
// Gutschriften (sie übernehmen Empfänger und Buchung der stornierten Rechnung). Neueste zuerst; Darstellung wie die
// Rechnungsübersicht, ohne Filter und Summen.
export async function getCompanyInvoicePage(companyId: string): Promise<InvoicePage & { limited: boolean }> {
  const { tenantId } = await requireMember()
  const empty = { ...EMPTY_INVOICE_FILTERS, rows: [], total: 0, pageCount: 1, totals: null, ready: true, limited: false }
  const guests = await getCompanyGuests(companyId)
  if (!guests.length) return empty
  const supabase = await createClient()
  const { data: bookings, error: bookingError } = await supabase
    .from('bookings')
    .select('id')
    .eq('tenant_id', tenantId)
    .in('guest_id', guests.map((g) => g.id))
    .limit(2000)
  if (bookingError) console.error('[firmen] Buchungen für Rechnungen nicht lesbar', bookingError.message)
  if (!bookings?.length) return empty
  const { data, error } = await supabase
    .from('invoices')
    .select('id, number, invoice_date, recipient, total_cents, origin, kind, pdf_path, booking:bookings(id, number)')
    .eq('tenant_id', tenantId)
    .eq('recipient_kind', 'company')
    .in('booking_id', bookings.map((b) => b.id))
    .order('invoice_date', { ascending: false })
    .order('number', { ascending: false })
    .limit(COMPANY_INVOICE_LIMIT + 1)
  if (error) console.error('[firmen] Rechnungen der Firma nicht lesbar', error.message)
  const all = (data ?? []) as unknown as InvoiceDb[]
  const rows = all.slice(0, COMPANY_INVOICE_LIMIT).map((r) => ({
    id: r.id,
    number: r.number,
    invoiceDate: r.invoice_date,
    recipient: r.recipient,
    totalCents: r.total_cents,
    origin: invoiceOriginFromDb(r.origin),
    kind: invoiceDocKindFromDb(r.kind),
    hasPdf: r.pdf_path !== null,
    booking: r.booking,
    cancelledBy: null,
  }))
  // Stornierte Rechnungen kennzeichnen (PROJ-44) und Zahlungsstand (PROJ-45) wie in der Übersicht
  const credits = await getCreditNotesFor(tenantId, rows.filter((r) => r.origin === 'issued' && r.kind !== 'credit_note').map((r) => r.id))
  const states = await getPaymentStates(rows.map((r) => ({ id: r.id, origin: r.origin, kind: r.kind, totalCents: r.totalCents, cancelled: credits.has(r.id) })))
  return {
    ...empty,
    rows: rows.map((r) => ({ ...r, cancelledBy: credits.get(r.id) ?? null, payment: states.get(r.id) })),
    total: rows.length,
    limited: all.length > COMPANY_INVOICE_LIMIT,
  }
}

// Mögliche doppelte Firmen (nur Inhaber): gleicher Name oder gleiche UID
export async function getCompanyDuplicatePairs(): Promise<CompanyDuplicatePair[]> {
  const { tenantId, role } = await requireMember()
  if (role !== 'owner') notFound()
  const supabase = await createClient()
  const { data: pairs, error } = await supabase.rpc('company_duplicate_pairs', { p_tenant_id: tenantId })
  if (error) console.error('[firmen] Dubletten nicht lesbar', error.message)
  if (!pairs?.length) return []

  const ids = [...new Set(pairs.flatMap((p) => [p.company_a, p.company_b]))]
  const [{ data: companies }, { data: links }] = await Promise.all([
    supabase.from('companies').select(COMPANY_COLUMNS).in('id', ids).eq('tenant_id', tenantId),
    supabase.from('guests').select('company_id').in('company_id', ids).eq('tenant_id', tenantId),
  ])
  const counts = new Map<string, number>()
  for (const l of links ?? []) if (l.company_id) counts.set(l.company_id, (counts.get(l.company_id) ?? 0) + 1)
  const byId = new Map((companies ?? []).map((c) => [c.id, toCompanyRow(toCompany(c, counts.get(c.id) ?? 0))]))
  return pairs
    .filter((p) => byId.has(p.company_a) && byId.has(p.company_b))
    .map((p) => ({ a: byId.get(p.company_a)!, b: byId.get(p.company_b)!, reasons: p.reasons as CompanyDuplicateReason[] }))
}

// Zahl der Vorschläge für den Link in der Firmenliste (nur Inhaber; sonst 0)
export async function countCompanyDuplicates(): Promise<number> {
  const { tenantId, role } = await requireMember()
  if (role !== 'owner') return 0
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('company_duplicate_pairs', { p_tenant_id: tenantId })
  if (error) console.error('[firmen] Dubletten nicht zählbar', error.message)
  return data?.length ?? 0
}
