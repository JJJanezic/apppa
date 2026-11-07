import 'server-only'

import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { cache } from 'react'

import { apartmentLabel } from '@/lib/apartments'
import { todayIso } from '@/lib/bookings'
import { getCreditNotesFor, getValidFinalDeducting } from '@/lib/invoice-credit-data'
import { type IssuedSnapshot, retentionCutoff } from '@/lib/invoice-issue'
import {
  type BookingInvoices,
  type Invoice,
  INVOICE_BUCKET,
  INVOICE_PAGE_SIZE,
  type InvoiceFilters,
  invoiceDocKindFromDb,
  invoiceOriginFromDb,
  type InvoiceOrigin,
  type InvoicePage,
  type InvoicePdfLinks,
  type InvoiceRow,
  invoiceSearchPattern,
  type InvoiceTotals,
  isBilled,
} from '@/lib/invoices'
import type { Role } from '@/lib/navigation'
import { getPaymentStates, isMissingRelation } from '@/lib/payments-data'
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

const LIST_COLUMNS = 'id, number, invoice_date, recipient, total_cents, origin, kind, pdf_path, booking:bookings(id, number)'

type ListDbRow = {
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

const toRow = (r: ListDbRow): InvoiceRow => ({
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
})

// Rechnungsliste: Datum absteigend, bei gleichem Datum Nummer absteigend (Entwürfe ohne Nummer zuerst); je 50; Suche
// nach Nummer oder Empfänger; Filter Jahr, Status, Zahlung, Betrag (PROJ-43) samt Summen über alle Seiten.
// Liest über die Datenbank-Funktionen invoice_list_page und invoice_list_totals (Rechnung + Zahlungsstand aus PROJ-45; Rechte
// prüft die Datenbank). Fehlen sie (Umgebung ohne Migration), liest die Liste die Tabelle wie bisher: Jahr, Betrag, Entwurf
// und Gutschrift wirken, „storniert“ und Zahlung nicht, keine Summen.
export async function getInvoicePage(filters: InvoiceFilters): Promise<InvoicePage> {
  const { tenantId } = await requireMember()
  const fromView = await readInvoiceFunctions(tenantId, filters)
  const { rows, total, totals, ready } = fromView ?? (await readInvoiceTable(tenantId, filters))
  // Stornierte Rechnungen kennzeichnen (PROJ-44)
  const credits = await getCreditNotesFor(tenantId, rows.filter((r) => r.origin === 'issued' && r.kind !== 'credit_note').map((r) => r.id))
  // Zahlungsstand je Rechnung (PROJ-45)
  const states = await getPaymentStates(rows.map((r) => ({ id: r.id, origin: r.origin, kind: r.kind, totalCents: r.totalCents, cancelled: credits.has(r.id) })))
  return {
    ...filters,
    rows: rows.map((r) => ({ ...r, cancelledBy: credits.get(r.id) ?? null, payment: states.get(r.id) })),
    total,
    pageCount: Math.max(1, Math.ceil(total / INVOICE_PAGE_SIZE)),
    totals,
    ready,
  }
}

type ListResult = { rows: InvoiceRow[]; total: number; totals: InvoiceTotals | null; ready: boolean }

// Jahr als Datumsbereich [1.1., 1.1. des Folgejahres)
const yearRange = (year: number) => ({ from: `${year}-01-01`, to: `${year + 1}-01-01` })

type PageDbRow = Omit<ListDbRow, 'booking'> & { booking_id: string | null; booking_number: string | null }

type TotalsDb = { invoice_count: number | string; total_cents: number | string; paid_cents: number | string; open_cents: number | string }

// Seite und Summen (PROJ-43, Migrationen 20261107064552 bis 20261107065405); null, wenn die Funktionen fehlen
async function readInvoiceFunctions(tenantId: string, filters: InvoiceFilters): Promise<ListResult | null> {
  const supabase = await createClient()
  const pattern = invoiceSearchPattern(filters.query)
  const args = {
    p_tenant_id: tenantId,
    // Für PostgREST-Filter steht „\\_“ im Muster (daraus wird „\_“); direkt in SQL genügt „\_“
    p_pattern: pattern?.replaceAll('\\\\', '\\') ?? null,
    p_year: filters.year,
    p_status: filters.status,
    p_payment: filters.payment,
    p_min_cents: filters.minCents,
    p_max_cents: filters.maxCents,
  }
  // Die generierten Typen kennen keine leeren Argumente; die Funktionen erlauben sie (null = ohne Filter)
  const [page, totals] = await Promise.all([
    supabase.rpc('invoice_list_page', { ...args, p_offset: (filters.page - 1) * INVOICE_PAGE_SIZE, p_limit: INVOICE_PAGE_SIZE } as never),
    supabase.rpc('invoice_list_totals', args as never),
  ])
  const error = page.error ?? totals.error
  if (error) {
    if (isMissingRelation(error)) return null
    console.error('[rechnungen] Liste nicht lesbar', error.message)
  }
  const t = (Array.isArray(totals.data) ? totals.data[0] : totals.data) as TotalsDb | null
  return {
    rows: ((page.data ?? []) as unknown as PageDbRow[]).map((r) =>
      toRow({ ...r, booking: r.booking_id ? { id: r.booking_id, number: r.booking_number } : null })
    ),
    total: Number(t?.invoice_count ?? 0),
    totals: t ? { totalCents: Number(t.total_cents), paidCents: Number(t.paid_cents), openCents: Number(t.open_cents) } : null,
    ready: true,
  }
}

// Rückfall ohne Lesesicht: Tabelle wie bisher, nur die Filter, die die Tabelle selbst kennt
async function readInvoiceTable(tenantId: string, filters: InvoiceFilters): Promise<ListResult> {
  const supabase = await createClient()
  const pattern = invoiceSearchPattern(filters.query)
  const from = (filters.page - 1) * INVOICE_PAGE_SIZE
  let request = supabase.from('invoices').select(LIST_COLUMNS, { count: 'exact' }).eq('tenant_id', tenantId)
  if (pattern) request = request.or(`number.ilike."${pattern}",recipient.ilike."${pattern}"`)
  if (filters.year) request = request.gte('invoice_date', yearRange(filters.year).from).lt('invoice_date', yearRange(filters.year).to)
  if (filters.minCents !== null) request = request.gte('total_cents', filters.minCents)
  if (filters.maxCents !== null) request = request.lte('total_cents', filters.maxCents)
  if (filters.status === 'credit_note') request = request.eq('kind', 'credit_note')
  else if (filters.status === 'draft' || filters.status === 'backfilled') request = request.eq('origin', filters.status)
  else if (filters.status === 'issued') request = request.eq('origin', 'issued').neq('kind', 'credit_note')
  const { data, count, error } = await request
    .order('invoice_date', { ascending: false })
    .order('number', { ascending: false })
    .range(from, from + INVOICE_PAGE_SIZE - 1)
  if (error) console.error('[rechnungen] Liste nicht lesbar', error.message)
  return { rows: ((data ?? []) as unknown as ListDbRow[]).map(toRow), total: count ?? 0, totals: null, ready: false }
}

// Hat der Kunde überhaupt Rechnungen? (Leerzustand statt „Keine Treffer“)
export async function hasAnyInvoice(): Promise<boolean> {
  const { tenantId } = await requireMember()
  const supabase = await createClient()
  const { count, error } = await supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)
  if (error) console.error('[rechnungen] Anzahl nicht lesbar', error.message)
  return (count ?? 0) > 0
}

// Schalter „Rechnungen nacherfassen“ in den Rechnungseinstellungen (PROJ-39, Voreinstellung ein). Nur Inhaber lesen
// die Einstellungen; der Knopf erscheint ohnehin nur für sie.
export const getInvoiceBackfillEnabled = cache(async (): Promise<boolean> => {
  const { tenantId } = await requireMember()
  const supabase = await createClient()
  const { data, error } = await supabase.from('invoice_settings').select('backfill_enabled').eq('tenant_id', tenantId).maybeSingle()
  if (error) console.error('[rechnungen] Schalter nicht lesbar', error.message)
  return data?.backfill_enabled ?? true
})

// Ausgestellte Rechnungen innerhalb der Aufbewahrungsfrist (PROJ-42), für den Betreiber: Sie sperren „Kunde löschen“.
// Die Datenbank prüft das beim Löschen zusätzlich.
export async function countRetainedInvoices(tenantId: string): Promise<number> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('origin', 'issued')
    .gte('invoice_date', retentionCutoff(todayIso()))
  if (error) console.error('[rechnungen] Aufbewahrte Rechnungen nicht zählbar', error.message)
  return count ?? 0
}

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
  'id, number, invoice_date, origin, kind, recipient, small_business, total_cents, pdf_path, updated_at, ' +
  'issued_at, issued_without_logo, issued_snapshot, issued_profile:profiles!invoices_issued_by_fkey(display_name), ' +
  'lines:invoice_lines(position, label, amount_cents, vat_rate), ' +
  'guest:guests(id, last_name, first_name, title_prefix, title_suffix, country, company_name, anonymized_at), ' +
  'booking:bookings(id, kind, number, arrival, departure, cancelled_at, guest:guests(last_name, first_name), apartment:apartments!inner(name, property:properties!inner(name)))'

type DetailDbRow = {
  id: string
  number: string | null
  invoice_date: string
  origin: string
  kind: string | null
  recipient: string
  small_business: boolean
  total_cents: number
  pdf_path: string | null
  updated_at: string
  issued_at: string | null
  issued_without_logo: boolean
  issued_snapshot: unknown
  issued_profile: { display_name: string | null } | null
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

// Herkunft einer Rechnung (Detailseite: Entwurf oder nacherfasste Rechnung); fremde oder unbekannte → „Seite nicht gefunden“
export const getInvoiceOrigin = cache(async (id: string): Promise<InvoiceOrigin> => {
  const { tenantId } = await requireMember()
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const supabase = await createClient()
  const { data, error } = await supabase.from('invoices').select('origin').eq('id', id).eq('tenant_id', tenantId).maybeSingle()
  if (error) console.error('[rechnungen] Herkunft nicht lesbar', error.message)
  if (!data) notFound()
  return invoiceOriginFromDb(data.origin)
})

// Einmal pro Anfrage (Seitentitel und Seite); fremde oder unbekannte Rechnungen → „Seite nicht gefunden“.
// Für nacherfasste (später ausgestellte) Rechnungen; Entwürfe liest getInvoiceDraftView (invoice-drafts-data.ts).
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
  const origin = invoiceOriginFromDb(r.origin)
  const kind = invoiceDocKindFromDb(r.kind)
  // Storno und Abzug nur bei in der App ausgestellten Rechnungen (PROJ-44)
  const invoice = origin === 'issued' && kind !== 'credit_note'
  const [credits, deductedBy] = invoice
    ? await Promise.all([getCreditNotesFor(tenantId, [r.id]), kind === 'partial' ? getValidFinalDeducting(tenantId, r.id) : null])
    : [null, null]
  return {
    id: r.id,
    number: r.number ?? '',
    invoiceDate: r.invoice_date,
    origin,
    kind,
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
    pdf: r.pdf_path ? await pdfLinks(r.pdf_path, pdfFileName(t(kind === 'credit_note' ? 'pdf.fileNameCredit' : 'pdf.fileName'), r.number ?? '')) : null,
    updatedAt: r.updated_at,
    issued:
      r.issued_at && r.issued_snapshot
        ? { at: r.issued_at, byName: r.issued_profile?.display_name ?? null, withoutLogo: r.issued_without_logo, snapshot: r.issued_snapshot as IssuedSnapshot }
        : null,
    cancelledBy: credits?.get(r.id) ?? null,
    deductedBy,
  }
})

type BookingInvoicesDb = {
  booking_total_cents: number | null
  invoices: {
    id: string
    number: string | null
    invoice_date: string
    recipient: string
    total_cents: number
    origin: string
    kind: string | null
    has_pdf: boolean
  }[]
}

// Abschnitt „Rechnungen“ im Buchungsdetail (Seite und Kalender-Panel). Eigene Datenbank-Funktion, damit auch
// Mitarbeiter Gesamtpreis und verrechnete Summe sehen (Nutzerentscheidung in /architecture). Einmal je Anfrage
// (Knopf „Rechnung“ und Abschnitt lesen dieselben Summen).
export const getBookingInvoices = cache(async (bookingId: string): Promise<BookingInvoices> => {
  const { tenantId } = await requireMember()
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
    origin: invoiceOriginFromDb(i.origin),
    kind: invoiceDocKindFromDb(i.kind ?? null),
    hasPdf: i.has_pdf,
  }))
  // Stornierte Rechnungen kennzeichnen (PROJ-44); Rechnung und Gutschrift heben sich in „Verrechnet“ auf
  const credits = await getCreditNotesFor(tenantId, invoices.filter((i) => i.origin === 'issued' && i.kind !== 'credit_note').map((i) => i.id))
  return {
    invoices: invoices.map((i) => ({ ...i, cancelledBy: credits.get(i.id) ?? null })),
    billedCents: invoices.reduce((sum, i) => (isBilled(i.origin) ? sum + i.totalCents : sum), 0),
    draftCents: invoices.reduce((sum, i) => (isBilled(i.origin) ? sum : sum + i.totalCents), 0),
    bookingTotalCents: result.booking_total_cents,
  }
})
