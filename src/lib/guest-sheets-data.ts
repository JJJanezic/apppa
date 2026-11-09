import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import { cache } from 'react'

import { apartmentLabel } from '@/lib/apartments'
import { type BookingKind, monthRange, personCount, todayIso } from '@/lib/bookings'
import {
  filledTexts,
  GUEST_SHEET_PAGE_SIZE,
  type GuestSheetFilters,
  type GuestSheetKind,
  type GuestSheetPage,
  type GuestSheetSummary,
  type GuestSheetTexts,
  type SheetCompanion,
  type SheetGuest,
  type SheetIssuer,
} from '@/lib/guest-sheet'
import { type DocumentType, type Gender, guestSortName } from '@/lib/guests'
import { isRichDoc, type RichDoc } from '@/lib/rich-text'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext } from '@/lib/tenant'

// Lesefunktionen des Gästeblatts (PROJ-26) für alle Mitglieder des gewählten Kunden (Inhaber und Mitarbeiter).
// Rechte prüft die Datenbank (RLS: Gästeblätter, Einstellungen und Dateien nur für Mitglieder).
// Fehlen Tabellen oder Lesesichten (Umgebung ohne Migration), liefern die Funktionen leere Ergebnisse bzw. die
// Standardtexte. Zugriff ungetypt: Die Rückgaben werden hier selbst in eigene Typen übersetzt.

// Tabelle, Sicht oder Funktion fehlt noch (Migration nicht eingespielt)
const MISSING = new Set(['42P01', '42703', '42883', 'PGRST202', 'PGRST204', 'PGRST205'])
export const isMissingRelation = (error: { code?: string } | null) => Boolean(error?.code && MISSING.has(error.code))

const untyped = async () => (await createClient()) as unknown as SupabaseClient

async function requireMember(): Promise<{ tenantId: string; owner: boolean }> {
  const { active } = await getTenantContext()
  if (!active) notFound()
  return { tenantId: active.id, owner: active.role === 'owner' }
}

type NameDb = { last_name: string | null; first_name: string | null; title_prefix: string | null; title_suffix: string | null }
const nameOf = (r: NameDb) =>
  r.last_name ? guestSortName({ lastName: r.last_name, firstName: r.first_name, titlePrefix: r.title_prefix, titleSuffix: r.title_suffix }) : null

// ---- Einstellungen und Aussteller -------------------------------------------------------------------

type IssuerDb = {
  name: string
  address_line1: string | null
  address_line2: string | null
  postal_code: string | null
  city: string | null
  country: string | null
  email?: string | null
  phone?: string | null
}

const issuerOf = (r: IssuerDb): SheetIssuer => ({
  name: r.name,
  addressLine1: r.address_line1,
  addressLine2: r.address_line2,
  postalCode: r.postal_code,
  city: r.city,
  country: r.country,
  email: r.email ?? null,
  phone: r.phone ?? null,
})

// Stammdaten für die Platzhalter. Ohne die Spalten E-Mail/Telefon (vor der Migration) ohne diese beiden Angaben.
async function loadIssuer(supabase: SupabaseClient, tenantId: string): Promise<SheetIssuer> {
  const base = 'name, address_line1, address_line2, postal_code, city, country'
  let { data, error } = await supabase.from('tenants').select(`${base}, email, phone`).eq('id', tenantId).maybeSingle()
  if (error && isMissingRelation(error)) ({ data, error } = await supabase.from('tenants').select(base).eq('id', tenantId).maybeSingle())
  if (error) console.error('[gaesteblatt] Stammdaten nicht lesbar', error.message)
  if (!data) notFound()
  return issuerOf(data as IssuerDb)
}

type SettingsDb = { privacy_text: unknown; marketing_text: unknown; updated_at: string }

async function loadTexts(supabase: SupabaseClient, tenantId: string): Promise<GuestSheetTexts & { ready: boolean }> {
  const { data, error } = await supabase
    .from('guest_sheet_settings')
    .select('privacy_text, marketing_text, updated_at')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  const ready = !isMissingRelation(error)
  if (error && ready) console.error('[gaesteblatt] Einstellungen nicht lesbar', error.message)
  const row = data as SettingsDb | null
  const doc = (v: unknown): RichDoc | null => (isRichDoc(v) ? v : null)
  return { privacy: doc(row?.privacy_text), marketing: doc(row?.marketing_text), updatedAt: row?.updated_at ?? null, ready }
}

// Einstellungen → Gästeblatt (nur Inhaber; die Seite liegt im Einstellungsbereich)
export async function getGuestSheetSettings(): Promise<{ tenantId: string; texts: GuestSheetTexts; ready: boolean; issuer: SheetIssuer }> {
  const { tenantId } = await requireMember()
  const supabase = await untyped()
  const [texts, issuer] = await Promise.all([loadTexts(supabase, tenantId), loadIssuer(supabase, tenantId)])
  const { ready, ...rest } = texts
  return { tenantId, texts: rest, ready, issuer }
}

// ---- Gästeblätter einer Buchung --------------------------------------------------------------------

const LIST_COLUMNS =
  'id, booking_id, booking_number, kind, sheet_number, marketing_consent, created_at, created_by_name, signed_at, signed_on, replaced_at, changed, booking_cancelled, last_name, first_name, title_prefix, title_suffix, arrival, departure, property_name, apartment_name'

type ListDb = NameDb & {
  id: string
  booking_id: string
  booking_number: string | null
  kind: GuestSheetKind
  sheet_number: string | null
  marketing_consent: boolean
  created_at: string
  created_by_name: string | null
  signed_at: string | null
  signed_on: string | null
  replaced_at: string | null
  changed: boolean
  booking_cancelled: boolean
  arrival: string
  departure: string
  property_name: string
  apartment_name: string
}

const summaryOf = (r: ListDb): GuestSheetSummary => ({
  id: r.id,
  bookingId: r.booking_id,
  kind: r.kind,
  sheetNumber: r.sheet_number,
  marketingConsent: r.marketing_consent,
  createdAt: r.created_at,
  createdBy: r.created_by_name,
  signedAt: r.kind === 'signed' ? r.signed_at : r.signed_on,
  replacedAt: r.replaced_at,
  changed: r.changed,
})

export type BookingGuestSheets = { current: GuestSheetSummary | null; previous: GuestSheetSummary[]; ready: boolean }

// Aktuelles Blatt und ersetzte Blätter einer Buchung (Abschnitt „Gästeblatt“ im Buchungsdetail), neueste zuerst
export const getBookingGuestSheets = cache(async (bookingId: string): Promise<BookingGuestSheets> => {
  const { tenantId } = await requireMember()
  const supabase = await untyped()
  const { data, error } = await supabase
    .from('guest_sheet_list')
    .select(LIST_COLUMNS)
    .eq('tenant_id', tenantId)
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false })
  const ready = !isMissingRelation(error)
  if (error && ready) console.error('[gaesteblatt] Gästeblätter der Buchung nicht lesbar', error.message)
  const sheets = ((data ?? []) as ListDb[]).map(summaryOf)
  return { current: sheets.find((s) => s.replacedAt === null) ?? null, previous: sheets.filter((s) => s.replacedAt !== null), ready }
})

// ---- Liste „Gästeblätter“ -----------------------------------------------------------------------------

type MissingDb = NameDb & {
  booking_id: string
  booking_number: string | null
  arrival: string
  departure: string
  property_name: string
  apartment_name: string
  guest_sheet_number: string | null
}

// Suche: Ziffern, Buchstaben, Leerzeichen und übliche Zeichen der Nummern; alles andere würde den Filter stören
const cleanQuery = (q: string) => q.replace(/[^\p{L}\p{N}\s/.\-_]/gu, '').trim()

export async function getGuestSheetPage(filters: GuestSheetFilters): Promise<GuestSheetPage> {
  const { tenantId } = await requireMember()
  const supabase = await untyped()
  const range = filters.month ? monthRange(filters.month) : null
  const query = cleanQuery(filters.query)
  const from = (filters.page - 1) * GUEST_SHEET_PAGE_SIZE
  const to = from + GUEST_SHEET_PAGE_SIZE - 1
  const empty = { ...filters, rows: [], missingRows: [], total: 0, pageCount: 1 }

  if (filters.missing) {
    // Buchungen ab Ankunftstag ohne Blatt; „Alle Monate“ bzw. der Monat der Ankunft
    let request = supabase.from('guest_sheet_missing').select('*', { count: 'exact' }).eq('tenant_id', tenantId).lte('arrival', todayIso())
    if (range) request = request.gte('arrival', range.from).lt('arrival', range.to)
    if (query) request = request.ilike('search_text', `%${query}%`)
    const { data, error, count } = await request.order('arrival', { ascending: false }).order('booking_number').range(from, to)
    const ready = !isMissingRelation(error)
    if (error && ready) console.error('[gaesteblatt] Fehlende Gästeblätter nicht lesbar', error.message)
    if (error) return { ...empty, ready }
    const total = count ?? 0
    return {
      ...empty,
      ready,
      total,
      pageCount: Math.max(1, Math.ceil(total / GUEST_SHEET_PAGE_SIZE)),
      missingRows: ((data ?? []) as MissingDb[]).map((r) => ({
        bookingId: r.booking_id,
        bookingNumber: r.booking_number,
        guestName: nameOf(r),
        arrival: r.arrival,
        departure: r.departure,
        apartmentLabel: apartmentLabel(r.property_name, r.apartment_name),
        sheetNumber: r.guest_sheet_number,
      })),
    }
  }

  // Aktuelle Blätter (ersetzte nur in der Buchung)
  let request = supabase.from('guest_sheet_list').select(LIST_COLUMNS, { count: 'exact' }).eq('tenant_id', tenantId).is('replaced_at', null)
  if (range) request = request.gte('arrival', range.from).lt('arrival', range.to)
  if (query) request = request.ilike('search_text', `%${query}%`)
  const { data, error, count } = await request.order('arrival', { ascending: false }).order('created_at', { ascending: false }).range(from, to)
  const ready = !isMissingRelation(error)
  if (error && ready) console.error('[gaesteblatt] Liste nicht lesbar', error.message)
  if (error) return { ...empty, ready }
  const total = count ?? 0
  return {
    ...empty,
    ready,
    total,
    pageCount: Math.max(1, Math.ceil(total / GUEST_SHEET_PAGE_SIZE)),
    rows: ((data ?? []) as ListDb[]).map((r) => ({
      id: r.id,
      bookingId: r.booking_id,
      bookingNumber: r.booking_number,
      kind: r.kind,
      sheetNumber: r.sheet_number,
      guestName: nameOf(r),
      arrival: r.arrival,
      departure: r.departure,
      apartmentLabel: apartmentLabel(r.property_name, r.apartment_name),
      marketingConsent: r.marketing_consent,
      changed: r.changed,
      cancelled: r.booking_cancelled,
    })),
  }
}

// Gibt es beim Kunden überhaupt schon ein Gästeblatt? (Leerzustand der Liste)
export async function hasAnyGuestSheet(): Promise<boolean> {
  const { tenantId } = await requireMember()
  const supabase = await untyped()
  const { count, error } = await supabase.from('guest_sheets').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)
  if (error && !isMissingRelation(error)) console.error('[gaesteblatt] Anzahl nicht lesbar', error.message)
  return (count ?? 0) > 0
}

// ---- Vollbild-Seite --------------------------------------------------------------------------------

// email: für das Feld auf Seite 2 (nur bei leerer E-Mail angeboten); nicht Teil des Blatts
export type SigningGuest = SheetGuest & { id: string; email: string | null; anonymized: boolean; updatedAt: string }

export type SigningData = {
  tenantId: string
  tenantName: string
  booking: {
    id: string
    number: string | null
    kind: BookingKind
    cancelledAt: string | null
    residenceRegistered: boolean
    arrival: string
    plannedDeparture: string
    departure: string
    persons: number
    sheetNumber: string | null
    apartmentLabel: string
    updatedAt: string
  }
  // Kennzahl des Kunden für die Gemeinde der Buchung (Erweiterung 2026-11-09); null = keine
  establishmentNumber: string | null
  guest: SigningGuest | null
  // Mitreisende in der Reihenfolge der Buchung; „Von der Ortstaxe befreit“ bleibt beim Speichern erhalten
  companions: (SheetCompanion & { taxExempt: boolean })[]
  // Aktuelles Blatt beim Öffnen (Schutz vor gleichzeitigem Fertigstellen)
  currentSheetId: string | null
  // Datenschutz-Texte mit gefüllten Platzhaltern
  texts: { privacy: RichDoc; marketing: RichDoc }
}

type GuestDb = {
  id: string
  last_name: string
  first_name: string | null
  title_prefix: string | null
  title_suffix: string | null
  gender: Gender
  birth_date: string | null
  country: string
  document_type: DocumentType | null
  document_number: string | null
  document_issued_on: string | null
  document_authority: string | null
  document_country: string | null
  street: string | null
  postal_code: string | null
  city: string | null
  address_country: string | null
  document_front_path: string | null
  document_back_path: string | null
  email: string | null
  anonymized_at: string | null
  updated_at: string
}

const GUEST_COLUMNS =
  'id, last_name, first_name, title_prefix, title_suffix, gender, birth_date, country, document_type, document_number, document_issued_on, document_authority, document_country, street, postal_code, city, address_country, document_front_path, document_back_path, email, anonymized_at, updated_at'

export const signingGuestOf = (g: GuestDb): SigningGuest => ({
  id: g.id,
  lastName: g.last_name,
  firstName: g.first_name,
  titlePrefix: g.title_prefix,
  titleSuffix: g.title_suffix,
  gender: g.gender,
  birthDate: g.birth_date,
  country: g.country,
  documentType: g.document_type,
  documentNumber: g.document_number,
  documentIssuedOn: g.document_issued_on,
  documentAuthority: g.document_authority,
  documentCountry: g.document_country,
  street: g.street,
  postalCode: g.postal_code,
  city: g.city,
  addressCountry: g.address_country,
  documentFrontPath: g.document_front_path,
  documentBackPath: g.document_back_path,
  email: g.email,
  anonymized: g.anonymized_at !== null,
  updatedAt: g.updated_at,
})

type BookingDb = {
  id: string
  number: string | null
  kind: BookingKind
  cancelled_at: string | null
  residence_registered: boolean
  arrival: string
  planned_departure: string
  departure: string
  adults: number
  child_ages: number[]
  guest_sheet_number: string | null
  updated_at: string
  guest: GuestDb | null
  apartment: { name: string; property: { name: string; municipality_code: string } }
  companions: { position: number; first_name: string; last_name: string; birth_date: string | null; tourist_tax_exempt: boolean }[]
}

// Alles für das Gästeblatt einer Buchung; fremde oder unbekannte Buchungen → „Seite nicht gefunden“.
// tenantId: der Kunde, für den das Blatt geöffnet wurde (bleibt auch bei einem Kundenwechsel in einem anderen Tab)
export async function getSigningData(bookingId: string, locale = 'de'): Promise<SigningData> {
  const { tenantId } = await requireMember()
  if (!/^[0-9a-f-]{36}$/i.test(bookingId)) notFound()
  const supabase = await untyped()
  const { data, error } = await supabase
    .from('bookings')
    .select(
      `id, number, kind, cancelled_at, residence_registered, arrival, planned_departure, departure, adults, child_ages, guest_sheet_number, updated_at, guest:guests(${GUEST_COLUMNS}), apartment:apartments!inner(name, property:properties!inner(name, municipality_code)), companions:booking_companions(position, first_name, last_name, birth_date, tourist_tax_exempt)`
    )
    .eq('id', bookingId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (error) console.error('[gaesteblatt] Buchung nicht lesbar', error.message)
  if (!data) notFound()
  const b = data as unknown as BookingDb
  const [issuer, texts, sheets, establishmentNumber] = await Promise.all([
    loadIssuer(supabase, tenantId),
    loadTexts(supabase, tenantId),
    getBookingGuestSheets(bookingId),
    loadEstablishmentNumber(supabase, tenantId, b.apartment.property.municipality_code),
  ])
  return {
    tenantId,
    tenantName: issuer.name,
    booking: {
      id: b.id,
      number: b.number,
      kind: b.kind,
      cancelledAt: b.cancelled_at,
      residenceRegistered: b.residence_registered,
      arrival: b.arrival,
      plannedDeparture: b.planned_departure,
      departure: b.departure,
      persons: personCount(b.adults, b.child_ages),
      sheetNumber: b.guest_sheet_number,
      apartmentLabel: apartmentLabel(b.apartment.property.name, b.apartment.name),
      updatedAt: b.updated_at,
    },
    establishmentNumber,
    guest: b.guest ? signingGuestOf(b.guest) : null,
    companions: [...b.companions]
      .sort((x, y) => x.position - y.position)
      .map((c) => ({ lastName: c.last_name, firstName: c.first_name, birthDate: c.birth_date, taxExempt: c.tourist_tax_exempt })),
    currentSheetId: sheets.current?.id ?? null,
    texts: filledTexts(texts, issuer, locale),
  }
}

// Kennzahl des Kunden für eine Gemeinde (Erweiterung 2026-11-09); fehlt die Tabelle noch, keine
export async function loadEstablishmentNumber(supabase: SupabaseClient, tenantId: string, municipalityCode: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('establishment_numbers')
    .select('establishment_number')
    .eq('tenant_id', tenantId)
    .eq('municipality_code', municipalityCode)
    .maybeSingle()
  if (error && !isMissingRelation(error)) console.error('[gaesteblatt] Kennzahl nicht lesbar', error.message)
  return (data as { establishment_number: string | null } | null)?.establishment_number ?? null
}
