import 'server-only'

import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { cache } from 'react'

import { apartmentLabel } from '@/lib/apartments'
import {
  bookingDraftLines,
  bookingFingerprint,
  type BookingInvoiceSummary,
  COMPANY_SALUTATIONS,
  type CompanySalutation,
  DEFAULT_DRAFT_PAYMENT,
  type DraftBooking,
  type DraftPreviewData,
  type DraftText,
  GUEST_NAME_MODES,
  type GuestNameMode,
  type InvoiceDraft,
  lineSourceFromDb,
  type PartialMode,
  type RecipientKind,
} from '@/lib/invoice-drafts'
import { textBlockFromRow, TEXT_BLOCK_COLUMNS, type TextBlockRow } from '@/lib/invoice-settings'
import { type DueBasis, sortTextBlocks, type TextBlock } from '@/lib/invoice-texts'
import { getCreditNotesFor } from '@/lib/invoice-credit-data'
import { invoiceDocKindFromDb, invoiceKindFromDb, invoiceOriginFromDb } from '@/lib/invoices'
import type { Role } from '@/lib/navigation'
import { emptyDoc, isRichDoc, normalizeDoc, type RichDoc } from '@/lib/rich-text'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext } from '@/lib/tenant'
import { VAT_DEFAULTS, vatRateFromDb } from '@/lib/vat'
import { letterheadFromDb } from '@/lib/letterhead'
import { vatStatusForBooking, vatStatusFromRows } from '@/lib/vat-status'

// Lesefunktionen des Rechnungsentwurfs (PROJ-40) für alle Mitglieder des gewählten Kunden. Preise der Buchung und
// Textbausteine lesen nur Inhaber; Aussteller, Fußzeile, Kleinunternehmer-Hinweis und -Verlauf für die Vorschau liefert
// eine eigene Datenbank-Funktion auch an Mitarbeiter. Rechte prüft zusätzlich die Datenbank (RLS).

const isId = (v: string) => /^[0-9a-f-]{36}$/i.test(v)

async function requireMember(): Promise<{ tenantId: string; role: Role }> {
  const { active } = await getTenantContext()
  if (!active) notFound()
  return { tenantId: active.id, role: active.role }
}

const docFromDb = (value: unknown): RichDoc | null => (value ? (isRichDoc(value) ? value : normalizeDoc(value)) : null)

// ---- Buchung -------------------------------------------------------------------------------------

const GUEST_COLUMNS =
  'id, last_name, first_name, title_prefix, title_suffix, gender, anonymized_at, street, postal_code, city, address_country, company_name, company_vat_id, company_address_line1, company_address_line2, company_postal_code, company_city, company_country'

const BOOKING_COLUMNS =
  'id, kind, number, arrival, departure, cancelled_at, ' +
  `guest:guests(${GUEST_COLUMNS}), ` +
  'apartment:apartments!inner(name, property:properties!inner(name)), ' +
  'companions:booking_companions(position, first_name, last_name)'

// Preise nur für Inhaber (eigene Tabellen, PROJ-8)
const AMOUNT_COLUMNS =
  ', amounts:booking_amounts(billed_nights_cents, nights_cents, nights_vat_rate, cancellation_fee_cents, cancellation_fee_vat_rate), ' +
  'charges:booking_charges(id, position, label, amount_cents, vat_rate)'

type GuestDb = {
  id: string
  last_name: string
  first_name: string | null
  title_prefix: string | null
  title_suffix: string | null
  gender: string
  anonymized_at: string | null
  street: string | null
  postal_code: string | null
  city: string | null
  address_country: string | null
  company_name: string | null
  company_vat_id: string | null
  company_address_line1: string | null
  company_address_line2: string | null
  company_postal_code: string | null
  company_city: string | null
  company_country: string | null
}

type BookingDb = {
  id: string
  kind: string
  number: string | null
  arrival: string
  departure: string
  cancelled_at: string | null
  guest: GuestDb | null
  apartment: { name: string; property: { name: string } }
  companions: { position: number; first_name: string; last_name: string }[]
  amounts?: {
    billed_nights_cents: number | null
    nights_cents: number
    nights_vat_rate: number | string
    cancellation_fee_cents: number | null
    cancellation_fee_vat_rate: number | string | null
  }[]
  charges?: { id: string; position: number; label: string; amount_cents: number; vat_rate: number | string }[]
}

// Buchung samt Hauptgast, Mitreisenden und (für Inhaber) Positionen; fremde oder unbekannte → null
export const getDraftBooking = cache(async (bookingId: string): Promise<DraftBooking | null> => {
  const { tenantId, role } = await requireMember()
  if (!isId(bookingId)) return null
  const owner = role === 'owner'
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('bookings')
    .select(owner ? BOOKING_COLUMNS + AMOUNT_COLUMNS : BOOKING_COLUMNS)
    .eq('id', bookingId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (error) console.error('[rechnungsentwurf] Buchung nicht lesbar', error.message)
  if (!data) return null
  const b = data as unknown as BookingDb
  const g = b.guest
  const a = b.amounts?.[0]
  const t = await getTranslations('invoices.form')
  return {
    id: b.id,
    kind: b.kind === 'option' ? 'option' : b.kind === 'block' ? 'block' : 'booking',
    number: b.number,
    arrival: b.arrival,
    departure: b.departure,
    cancelledAt: b.cancelled_at,
    apartmentLabel: apartmentLabel(b.apartment.property.name, b.apartment.name),
    guest: g && {
      id: g.id,
      lastName: g.last_name,
      firstName: g.first_name,
      titlePrefix: g.title_prefix,
      titleSuffix: g.title_suffix,
      gender: g.gender,
      anonymized: g.anonymized_at !== null,
      street: g.street,
      postalCode: g.postal_code,
      city: g.city,
      addressCountry: g.address_country,
      companyName: g.company_name,
      companyVatId: g.company_vat_id,
      companyAddressLine1: g.company_address_line1,
      companyAddressLine2: g.company_address_line2,
      companyPostalCode: g.company_postal_code,
      companyCity: g.company_city,
      companyCountry: g.company_country,
    },
    companions: [...b.companions].sort((x, y) => x.position - y.position).map((c) => ({ firstName: c.first_name, lastName: c.last_name })),
    lines:
      owner && a
        ? bookingDraftLines(
            {
              cancelled: b.cancelled_at !== null,
              billedNightsCents: a.billed_nights_cents ?? a.nights_cents,
              nightsVatBp: vatRateFromDb(a.nights_vat_rate),
              charges: [...(b.charges ?? [])]
                .sort((x, y) => x.position - y.position)
                .map((c) => ({ id: c.id, label: c.label, amountCents: c.amount_cents, vatBp: vatRateFromDb(c.vat_rate) })),
              cancellationFeeCents: a.cancellation_fee_cents,
              cancellationFeeVatBp: a.cancellation_fee_vat_rate === null ? VAT_DEFAULTS.cancellationFee : vatRateFromDb(a.cancellation_fee_vat_rate),
            },
            { nights: t('nightsLabel'), cancellationFee: t('cancellationFeeLabel') }
          )
        : owner && b.kind !== 'block'
          ? []
          : null,
  }
})

// Fingerabdruck der aktuellen Buchung (nur mit Positionen, also für Inhaber)
export const currentFingerprint = (b: DraftBooking): string | null =>
  b.lines ? bookingFingerprint({ cancelled: b.cancelledAt !== null, guestId: b.guest?.id ?? null, lines: b.lines }) : null

// ---- Rechnungen der Buchung ----------------------------------------------------------------------

type SummaryDb = {
  id: string
  number: string | null
  origin: string
  kind: string | null
  invoice_date: string
  total_cents: number
  small_business: boolean
  lines: { position: number; amount_cents: number; vat_rate: number | string; source_kind: string | null; source_charge_id: string | null }[]
}

// Alle Rechnungen der Buchung (Vorauswahl der Positionen, Summen, Abzüge der Schlussrechnung)
export const getBookingInvoiceSummaries = cache(async (bookingId: string): Promise<BookingInvoiceSummary[]> => {
  const { tenantId } = await requireMember()
  if (!isId(bookingId)) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('invoices')
    .select('id, number, origin, kind, invoice_date, total_cents, small_business, lines:invoice_lines(position, amount_cents, vat_rate, source_kind, source_charge_id)')
    .eq('tenant_id', tenantId)
    .eq('booking_id', bookingId)
    .order('invoice_date')
    .limit(200)
  if (error) console.error('[rechnungsentwurf] Rechnungen der Buchung nicht lesbar', error.message)
  const rows = (data ?? []) as unknown as SummaryDb[]
  // Stornierte Rechnungen sind nicht mehr abziehbar (PROJ-44)
  const credits = await getCreditNotesFor(tenantId, rows.filter((r) => r.origin === 'issued' && r.kind !== 'credit_note').map((r) => r.id))
  return rows.map((r) => ({
    id: r.id,
    number: r.number,
    origin: invoiceOriginFromDb(r.origin),
    kind: invoiceDocKindFromDb(r.kind),
    cancelled: credits.has(r.id),
    invoiceDate: r.invoice_date,
    totalCents: r.total_cents,
    smallBusiness: r.small_business,
    lines: [...r.lines]
      .sort((x, y) => x.position - y.position)
      .map((l) => ({ amountCents: l.amount_cents, vatBp: vatRateFromDb(l.vat_rate), source: lineSourceFromDb(l.source_kind, l.source_charge_id) })),
  }))
})

// ---- Aussteller, feste Texte, Kleinunternehmer-Verlauf -------------------------------------------

type PreviewDb = {
  issuer: {
    name: string
    name_line2: string | null
    address_line1: string | null
    address_line2: string | null
    postal_code: string | null
    city: string | null
    country: string | null
    vat_id: string | null
  } | null
  footer: unknown
  small_business_note: unknown
  vat_status: { valid_from: string; small_business: boolean }[] | null
  // Briefpapier (PROJ-41)
  letterhead?: Parameters<typeof letterheadFromDb>[0]
}

// Für Inhaber und Mitarbeiter (Mitarbeiter lesen Stammdaten und Rechnungseinstellungen sonst nicht)
export const getDraftPreviewData = cache(async (): Promise<DraftPreviewData> => {
  const { tenantId } = await requireMember()
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('invoice_preview_data', { p_tenant_id: tenantId })
  if (error) console.error('[rechnungsentwurf] Vorschau-Daten nicht lesbar', error.message)
  const r = (data as unknown as PreviewDb | null) ?? null
  const i = r?.issuer
  return {
    issuer: i
      ? {
          name: i.name,
          nameLine2: i.name_line2,
          addressLine1: i.address_line1,
          addressLine2: i.address_line2,
          postalCode: i.postal_code,
          city: i.city,
          country: i.country,
          vatId: i.vat_id,
        }
      : null,
    footer: docFromDb(r?.footer),
    smallBusinessNote: docFromDb(r?.small_business_note) ?? emptyDoc(),
    vatStatus: vatStatusFromRows(r?.vat_status ?? []),
    letterhead: letterheadFromDb(r?.letterhead),
  }
})

// Kleinunternehmer-Status nach der Buchung (PROJ-36: Abreise bzw. Stornodatum), bei jedem Öffnen neu ermittelt
export type { DraftPreviewData }

export const draftSmallBusiness = (preview: DraftPreviewData, b: Pick<DraftBooking, 'departure' | 'cancelledAt'>) =>
  vatStatusForBooking(preview.vatStatus, b).smallBusiness

// ---- Textbausteine -------------------------------------------------------------------------------

// Bausteine der Blöcke 4/6/7 (nur Inhaber; Standard zuerst)
export const getDraftTextBlocks = cache(async (): Promise<TextBlock[]> => {
  const { tenantId, role } = await requireMember()
  if (role !== 'owner') return []
  const supabase = await createClient()
  const { data, error } = await supabase.from('invoice_text_blocks').select(TEXT_BLOCK_COLUMNS).eq('tenant_id', tenantId).limit(100)
  if (error) console.error('[rechnungsentwurf] Bausteine nicht lesbar', error.message)
  return sortTextBlocks(((data ?? []) as TextBlockRow[]).map(textBlockFromRow))
})

// ---- Entwurf -------------------------------------------------------------------------------------

const DRAFT_COLUMNS =
  'id, origin, booking_id, kind, invoice_date, total_cents, created_at, updated_at, recipient_kind, recipient_name, recipient_line1, recipient_line2, ' +
  'recipient_postal_code, recipient_city, recipient_country, recipient_vat_id, company_salutation, guest_names, partial_mode, partial_percent, ' +
  'partial_amount_cents, intro_block_id, intro_text, payment_block_id, payment_text, closing_block_id, closing_text, deposit_percent, deposit_days, ' +
  'due_days, due_basis, booking_fingerprint, deduction_removed, ' +
  'lines:invoice_lines(position, label, amount_cents, vat_rate, source_kind, source_charge_id), ' +
  'deductions:invoice_deductions!invoice_deductions_invoice_fkey(deducted_invoice_id)'

type DraftDb = {
  id: string
  origin: string
  booking_id: string | null
  kind: string | null
  invoice_date: string
  total_cents: number
  created_at: string
  updated_at: string
  recipient_kind: string | null
  recipient_name: string | null
  recipient_line1: string | null
  recipient_line2: string | null
  recipient_postal_code: string | null
  recipient_city: string | null
  recipient_country: string | null
  recipient_vat_id: string | null
  company_salutation: string | null
  guest_names: string | null
  partial_mode: string | null
  partial_percent: number | string | null
  partial_amount_cents: number | null
  intro_block_id: string | null
  intro_text: unknown
  payment_block_id: string | null
  payment_text: unknown
  closing_block_id: string | null
  closing_text: unknown
  deposit_percent: number | string | null
  deposit_days: number | null
  due_days: number | null
  due_basis: string | null
  booking_fingerprint: string | null
  deduction_removed: boolean | null
  lines: { position: number; label: string; amount_cents: number; vat_rate: number | string; source_kind: string | null; source_charge_id: string | null }[]
  deductions: { deducted_invoice_id: string }[]
}

const pick = <V extends string>(list: readonly V[], value: string | null, fallback: V): V => (list.includes(value as V) ? (value as V) : fallback)

function draftFromDb(r: DraftDb): InvoiceDraft {
  const text = (blockId: string | null, body: unknown): DraftText => ({ blockId, body: docFromDb(body) })
  const s = (v: string | null) => v ?? ''
  return {
    id: r.id,
    kind: invoiceKindFromDb(r.kind) ?? 'invoice',
    invoiceDate: r.invoice_date,
    recipientKind: (r.recipient_kind === 'company' ? 'company' : 'guest') as RecipientKind,
    recipient: {
      name: s(r.recipient_name),
      line1: s(r.recipient_line1),
      line2: s(r.recipient_line2),
      postalCode: s(r.recipient_postal_code),
      city: s(r.recipient_city),
      country: s(r.recipient_country),
      vatId: s(r.recipient_vat_id),
    },
    companySalutation: pick<CompanySalutation>(COMPANY_SALUTATIONS, r.company_salutation, 'generic'),
    guestNames: pick<GuestNameMode>(GUEST_NAME_MODES, r.guest_names, 'none'),
    lines: [...r.lines]
      .sort((x, y) => x.position - y.position)
      .map((l) => ({ label: l.label, amountCents: l.amount_cents, vatBp: vatRateFromDb(l.vat_rate), source: lineSourceFromDb(l.source_kind, l.source_charge_id) })),
    partial:
      r.kind === 'partial'
        ? {
            mode: (r.partial_mode === 'amount' ? 'amount' : 'percent') as PartialMode,
            percentBp: r.partial_percent === null ? null : vatRateFromDb(r.partial_percent),
            amountCents: r.partial_amount_cents ?? 0,
          }
        : null,
    deductionIds: r.deductions.map((d) => d.deducted_invoice_id),
    deductionRemoved: r.deduction_removed ?? false,
    texts: {
      intro: text(r.intro_block_id, r.intro_text),
      payment: text(r.payment_block_id, r.payment_text),
      closing: text(r.closing_block_id, r.closing_text),
    },
    payment:
      r.due_days === null
        ? DEFAULT_DRAFT_PAYMENT
        : {
            depositPercent: r.deposit_percent === null ? null : Number(r.deposit_percent),
            depositDays: r.deposit_days,
            dueDays: r.due_days,
            dueBasis: (r.due_basis === 'before_arrival' ? 'before_arrival' : 'after_invoice') as DueBasis,
          },
    bookingFingerprint: r.booking_fingerprint,
    totalCents: r.total_cents,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export type DraftView = {
  draft: InvoiceDraft
  booking: DraftBooking
  // andere Rechnungen der Buchung (ohne den Entwurf selbst)
  others: BookingInvoiceSummary[]
  preview: DraftPreviewData
  smallBusiness: boolean
  // Buchung seit dem letzten Speichern geändert (nur für Inhaber feststellbar)
  bookingChanged: boolean
}

// Entwurf mit Buchung, anderen Rechnungen und Vorschau-Daten; kein Entwurf oder fremd → „Seite nicht gefunden“
export const getInvoiceDraftView = cache(async (id: string): Promise<DraftView> => {
  const { tenantId } = await requireMember()
  if (!isId(id)) notFound()
  const supabase = await createClient()
  const { data, error } = await supabase.from('invoices').select(DRAFT_COLUMNS).eq('id', id).eq('tenant_id', tenantId).maybeSingle()
  if (error) console.error('[rechnungsentwurf] Entwurf nicht lesbar', error.message)
  const r = data as unknown as DraftDb | null
  if (!r || r.origin !== 'draft' || !r.booking_id) notFound()
  const [booking, all, preview] = await Promise.all([getDraftBooking(r.booking_id), getBookingInvoiceSummaries(r.booking_id), getDraftPreviewData()])
  if (!booking) notFound()
  const draft = draftFromDb(r)
  const fingerprint = currentFingerprint(booking)
  return {
    draft,
    booking,
    others: all.filter((o) => o.id !== id),
    preview,
    smallBusiness: draftSmallBusiness(preview, booking),
    bookingChanged: fingerprint !== null && draft.bookingFingerprint !== null && fingerprint !== draft.bookingFingerprint,
  }
})
