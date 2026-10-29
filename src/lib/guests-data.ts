import 'server-only'

import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { cache } from 'react'

import {
  type ContactSource,
  DOCUMENT_BUCKET,
  DOCUMENT_SIDES,
  type DocumentImage,
  type DocumentSide,
  type DocumentType,
  type DuplicatePair,
  type DuplicateReason,
  type Guest,
  type GuestFilters,
  GUEST_PAGE_SIZE,
  type GuestPage,
  type GuestRow,
  type GuestStays,
  type Gender,
  type Language,
  type MarketingSource,
} from '@/lib/guests'
import type { Role } from '@/lib/navigation'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/types/database'
import { getTenantContext } from '@/lib/tenant'
import type { GuestValues } from '@/lib/validation/guests'

// Lesefunktionen der Gäste-Datenbank (PROJ-7) für alle Mitglieder des gewählten Kunden.
// Rechte prüft die Datenbank zusätzlich (RLS: Lesen für Mitglieder, Dubletten nur für Inhaber).

type GuestDbRow = Database['public']['Tables']['guests']['Row']

// Spalten eines Gastes aus geprüften Formularwerten (Gast-Aktionen und Buchung mit neuem Gast)
export const guestDbColumns = (v: GuestValues) => ({
  last_name: v.lastName,
  first_name: v.firstName,
  country: v.country,
  email: v.email,
  phone: v.phone,
  language: v.language,
  birth_date: v.birthDate,
  street: v.street,
  postal_code: v.postalCode,
  city: v.city,
  address_country: v.addressCountry,
  marketing_source: v.marketingSource,
  marketing_custom: v.marketingCustom,
  company_name: v.companyName,
  company_vat_id: v.companyVatId,
  company_address_line1: v.companyAddressLine1,
  company_address_line2: v.companyAddressLine2,
  company_postal_code: v.companyPostalCode,
  company_city: v.companyCity,
  company_country: v.companyCountry,
  note: v.note,
  title_prefix: v.titlePrefix,
  title_suffix: v.titleSuffix,
  gender: v.gender,
  document_type: v.documentType,
  document_number: v.documentNumber,
  document_issued_on: v.documentIssuedOn,
  document_authority: v.documentAuthority,
  document_country: v.documentCountry,
  document_front_path: v.documentFrontPath,
  document_back_path: v.documentBackPath,
})

export const GUEST_COLUMNS =
  'id, last_name, first_name, country, email, email_source, phone, phone_source, language, birth_date, street, postal_code, city, address_country, marketing_source, marketing_custom, company_name, company_vat_id, company_address_line1, company_address_line2, company_postal_code, company_city, company_country, note, title_prefix, title_suffix, gender, document_type, document_number, document_issued_on, document_authority, document_country, document_front_path, document_back_path, anonymized_at, updated_at'

// Aufenthalte werden aus den Buchungen berechnet (PROJ-8), nicht am Gast gespeichert
const NO_STAYS: GuestStays = { count: 0, bookings: 0, last: null, next: null, channels: [] }

export async function guestStays(tenantId: string, guestId: string): Promise<GuestStays> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('bookings')
    .select('kind, channel, arrival, cancelled_at')
    .eq('tenant_id', tenantId)
    .eq('guest_id', guestId)
    .limit(2000)
  if (error) console.error('[gaeste] Aufenthalte nicht lesbar', error.message)
  const all = data ?? []
  const stays = all.filter((b) => b.kind === 'booking' && b.cancelled_at === null)
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Vienna' })
  const past = stays.filter((b) => b.arrival <= today).map((b) => b.arrival).sort()
  const future = stays.filter((b) => b.arrival > today).map((b) => b.arrival).sort()
  return {
    count: stays.length,
    bookings: all.length,
    last: past.at(-1) ?? null,
    next: future[0] ?? null,
    channels: [...new Set(stays.map((b) => b.channel))],
  }
}

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
    companyAddressLine1: g.company_address_line1,
    companyAddressLine2: g.company_address_line2,
    companyPostalCode: g.company_postal_code,
    companyCity: g.company_city,
    companyCountry: g.company_country,
    note: g.note,
    titlePrefix: g.title_prefix,
    titleSuffix: g.title_suffix,
    gender: g.gender as Gender,
    documentType: g.document_type as DocumentType | null,
    documentNumber: g.document_number,
    documentIssuedOn: g.document_issued_on,
    documentAuthority: g.document_authority,
    documentCountry: g.document_country,
    documentFrontPath: g.document_front_path,
    documentBackPath: g.document_back_path,
    documentImages: {},
    anonymizedAt: g.anonymized_at,
    updatedAt: g.updated_at,
    stays: NO_STAYS,
  }
}

export const toRow = (g: Guest): GuestRow => ({
  id: g.id,
  lastName: g.lastName,
  firstName: g.firstName,
  titlePrefix: g.titlePrefix,
  titleSuffix: g.titleSuffix,
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
  title_prefix: string | null
  title_suffix: string | null
  company_name: string | null
  country: string
  anonymized_at: string | null
  stay_count: number
  last_stay: string | null
  total: number
}

export const listRow = (r: Omit<ListRow, 'total'>): GuestRow => ({
  id: r.id,
  lastName: r.last_name,
  firstName: r.first_name,
  titlePrefix: r.title_prefix,
  titleSuffix: r.title_suffix,
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
  const guest = toGuest(data)
  const [stays, documentImages] = await Promise.all([guestStays(tenantId, id), documentImageLinks(guest)])
  return { ...guest, stays, documentImages }
})

// Abruf-Links der Ausweisbilder (PROJ-29): 10 Minuten gültig, nur mit Anmeldung im richtigen Kunden
// (Zugriffsregeln des Speichers). Zusätzlich ein Link zum Herunterladen mit lesbarem Dateinamen.
export const DOCUMENT_LINK_SECONDS = 600

export async function documentImageLinks(guest: Guest): Promise<Guest['documentImages']> {
  const paths: Record<DocumentSide, string | null> = { front: guest.documentFrontPath, back: guest.documentBackPath }
  if (!paths.front && !paths.back) return {}
  const t = await getTranslations('guests')
  const supabase = await createClient()
  const storage = supabase.storage.from(DOCUMENT_BUCKET)
  // Dateiname nur aus Buchstaben, Ziffern und Bindestrichen, z. B. „Reisepass-Huber-Vorderseite.jpg“
  const fileName = (side: DocumentSide) =>
    [guest.documentType ? t(`documentType.${guest.documentType}`) : t('document.title'), guest.lastName, t(`document.side.${side}`)]
      .join('-')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/[^A-Za-z0-9-]+/g, '-')
      .replace(/-+/g, '-')
      .concat('.jpg')
  const entries = await Promise.all(
    DOCUMENT_SIDES.map(async (side): Promise<[DocumentSide, DocumentImage | null]> => {
      const path = paths[side]
      if (!path) return [side, null]
      const [view, download] = await Promise.all([
        storage.createSignedUrl(path, DOCUMENT_LINK_SECONDS),
        storage.createSignedUrl(path, DOCUMENT_LINK_SECONDS, { download: fileName(side) }),
      ])
      if (view.error || download.error) {
        console.error('[gaeste] Ausweisbild nicht abrufbar', (view.error ?? download.error)?.message)
        return [side, null]
      }
      return [side, { view: view.data.signedUrl, download: download.data.signedUrl }]
    })
  )
  return Object.fromEntries(entries.filter((e): e is [DocumentSide, DocumentImage] => e[1] !== null))
}

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
