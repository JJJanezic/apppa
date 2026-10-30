import 'server-only'

import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { cache } from 'react'

import { apartmentLabel } from '@/lib/apartments'
import {
  type BookingInvoices,
  cleanInvoiceQuery,
  type Invoice,
  INVOICE_BUCKET,
  INVOICE_PAGE_SIZE,
  type InvoiceFilters,
  type InvoiceOrigin,
  type InvoicePage,
  type InvoicePdfLinks,
  type InvoiceRow,
} from '@/lib/invoices'
import type { Role } from '@/lib/navigation'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext } from '@/lib/tenant'
import { vatRateFromDb } from '@/lib/vat'

// Lesefunktionen der Rechnungen (PROJ-37) für alle Mitglieder des gewählten Kunden.
// Rechte prüft zusätzlich die Datenbank (RLS: Rechnungen, Positionen und PDFs nur für Mitglieder des Kunden).

// Abruf-Links der PDFs: 10 Minuten gültig, nur mit Anmeldung im richtigen Kunden
const PDF_LINK_SECONDS = 600

async function requireMember(): Promise<{ tenantId: string; role: Role }> {
  const { active } = await getTenantContext()
  if (!active) notFound()
  return { tenantId: active.id, role: active.role }
}

const LIST_COLUMNS = 'id, number, invoice_date, recipient, total_cents, origin, pdf_path, booking:bookings(id, number)'

type ListDbRow = {
  id: string
  number: string
  invoice_date: string
  recipient: string
  total_cents: number
  origin: string
  pdf_path: string | null
  booking: { id: string; number: string | null } | null
}

const toRow = (r: ListDbRow): InvoiceRow => ({
  id: r.id,
  number: r.number,
  invoiceDate: r.invoice_date,
  recipient: r.recipient,
  totalCents: r.total_cents,
  origin: r.origin as InvoiceOrigin,
  hasPdf: r.pdf_path !== null,
  booking: r.booking,
})

// Rechnungsliste: Datum absteigend, bei gleichem Datum Nummer absteigend; je 50; Suche nach Nummer oder Empfänger
export async function getInvoicePage(filters: InvoiceFilters): Promise<InvoicePage> {
  const { tenantId } = await requireMember()
  const supabase = await createClient()
  const query = cleanInvoiceQuery(filters.query)
  const from = (filters.page - 1) * INVOICE_PAGE_SIZE

  let request = supabase.from('invoices').select(LIST_COLUMNS, { count: 'exact' }).eq('tenant_id', tenantId)
  // Werte in Anführungszeichen: Punkt, Schrägstrich und Leerzeichen bleiben Teil des Suchbegriffs
  if (query) request = request.or(`number.ilike."%${query}%",recipient.ilike."%${query}%"`)
  const { data, count, error } = await request
    .order('invoice_date', { ascending: false })
    .order('number', { ascending: false })
    .range(from, from + INVOICE_PAGE_SIZE - 1)
  if (error) console.error('[rechnungen] Liste nicht lesbar', error.message)
  const total = count ?? 0
  return {
    ...filters,
    rows: ((data ?? []) as unknown as ListDbRow[]).map(toRow),
    total,
    pageCount: Math.max(1, Math.ceil(total / INVOICE_PAGE_SIZE)),
  }
}

// Hat der Kunde überhaupt Rechnungen? (Leerzustand statt „Keine Treffer“)
export async function hasAnyInvoice(): Promise<boolean> {
  const { tenantId } = await requireMember()
  const supabase = await createClient()
  const { count, error } = await supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)
  if (error) console.error('[rechnungen] Anzahl nicht lesbar', error.message)
  return (count ?? 0) > 0
}

// Schalter „Rechnungen nacherfassen“ in den Kundenstammdaten (Voreinstellung ein)
export const getInvoiceBackfillEnabled = cache(async (): Promise<boolean> => {
  const { tenantId } = await requireMember()
  const supabase = await createClient()
  const { data, error } = await supabase.from('tenants').select('invoice_backfill_enabled').eq('id', tenantId).maybeSingle()
  if (error) console.error('[rechnungen] Schalter nicht lesbar', error.message)
  return data?.invoice_backfill_enabled ?? true
})

// Dateiname zum Herunterladen, z. B. „Rechnung-2025-0042.pdf“
const pdfFileName = (label: string, number: string) =>
  `${label}-${number}`
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^A-Za-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .concat('.pdf')

async function pdfLinks(path: string, fileName: string): Promise<InvoicePdfLinks | null> {
  const storage = (await createClient()).storage.from(INVOICE_BUCKET)
  const [view, download] = await Promise.all([
    storage.createSignedUrl(path, PDF_LINK_SECONDS),
    storage.createSignedUrl(path, PDF_LINK_SECONDS, { download: fileName }),
  ])
  if (view.error || download.error) {
    console.error('[rechnungen] PDF nicht abrufbar', (view.error ?? download.error)?.message)
    return null
  }
  return { view: view.data.signedUrl, download: download.data.signedUrl }
}

const DETAIL_COLUMNS =
  'id, number, invoice_date, origin, recipient, small_business, total_cents, pdf_path, updated_at, ' +
  'lines:invoice_lines(position, label, amount_cents, vat_rate), ' +
  'guest:guests(id, last_name, first_name, title_prefix, title_suffix, country, company_name, anonymized_at), ' +
  'booking:bookings(id, kind, number, arrival, departure, cancelled_at, guest:guests(last_name, first_name), apartment:apartments!inner(name, property:properties!inner(name)))'

type DetailDbRow = {
  id: string
  number: string
  invoice_date: string
  origin: string
  recipient: string
  small_business: boolean
  total_cents: number
  pdf_path: string | null
  updated_at: string
  lines: { position: number; label: string; amount_cents: number; vat_rate: number | string }[]
  guest: {
    id: string
    last_name: string
    first_name: string | null
    title_prefix: string | null
    title_suffix: string | null
    country: string
    company_name: string | null
    anonymized_at: string | null
  } | null
  booking: {
    id: string
    kind: string
    number: string | null
    arrival: string
    departure: string
    cancelled_at: string | null
    guest: { last_name: string; first_name: string | null } | null
    apartment: { name: string; property: { name: string } }
  } | null
}

// Einmal pro Anfrage (Seitentitel und Seite); fremde oder unbekannte Rechnungen → „Seite nicht gefunden“
export const getInvoice = cache(async (id: string): Promise<Invoice> => {
  const { tenantId } = await requireMember()
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const supabase = await createClient()
  const { data, error } = await supabase.from('invoices').select(DETAIL_COLUMNS).eq('id', id).eq('tenant_id', tenantId).maybeSingle()
  if (error) console.error('[rechnungen] Rechnung nicht lesbar', error.message)
  if (!data) notFound()
  const r = data as unknown as DetailDbRow
  const t = await getTranslations('invoices')
  const b = r.booking
  return {
    id: r.id,
    number: r.number,
    invoiceDate: r.invoice_date,
    origin: r.origin as InvoiceOrigin,
    recipient: r.recipient,
    smallBusiness: r.small_business,
    totalCents: r.total_cents,
    lines: [...r.lines]
      .sort((x, y) => x.position - y.position)
      .map((l) => ({ label: l.label, amountCents: l.amount_cents, vatBp: vatRateFromDb(l.vat_rate) })),
    guest: r.guest && {
      id: r.guest.id,
      lastName: r.guest.last_name,
      firstName: r.guest.first_name,
      titlePrefix: r.guest.title_prefix,
      titleSuffix: r.guest.title_suffix,
      country: r.guest.country,
      companyName: r.guest.company_name,
      anonymized: r.guest.anonymized_at !== null,
    },
    booking: b && {
      id: b.id,
      kind: b.kind === 'option' ? 'option' : 'booking',
      number: b.number,
      guestName: b.guest ? [b.guest.last_name, b.guest.first_name].filter(Boolean).join(' ') : null,
      apartmentLabel: apartmentLabel(b.apartment.property.name, b.apartment.name),
      arrival: b.arrival,
      departure: b.departure,
      cancelled: b.cancelled_at !== null,
    },
    pdfPath: r.pdf_path,
    pdf: r.pdf_path ? await pdfLinks(r.pdf_path, pdfFileName(t('pdf.fileName'), r.number)) : null,
    updatedAt: r.updated_at,
  }
})

type BookingInvoicesDb = {
  booking_total_cents: number | null
  invoices: { id: string; number: string; invoice_date: string; recipient: string; total_cents: number; origin: string; has_pdf: boolean }[]
}

// Abschnitt „Rechnungen“ im Buchungsdetail (Seite und Kalender-Panel). Eigene Datenbank-Funktion, damit auch
// Mitarbeiter Gesamtpreis und verrechnete Summe sehen (Nutzerentscheidung in /architecture).
export async function getBookingInvoices(bookingId: string): Promise<BookingInvoices> {
  await requireMember()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('booking_invoices', { p_booking_id: bookingId })
  if (error) console.error('[rechnungen] Rechnungen der Buchung nicht lesbar', error.message)
  const result = (data as unknown as BookingInvoicesDb | null) ?? { booking_total_cents: null, invoices: [] }
  const invoices = (result.invoices ?? []).map((i) => ({
    id: i.id,
    number: i.number,
    invoiceDate: i.invoice_date,
    recipient: i.recipient,
    totalCents: i.total_cents,
    origin: i.origin as InvoiceOrigin,
    hasPdf: i.has_pdf,
  }))
  return {
    invoices,
    billedCents: invoices.reduce((sum, i) => sum + i.totalCents, 0),
    bookingTotalCents: result.booking_total_cents,
  }
}
