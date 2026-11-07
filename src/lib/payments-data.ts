import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import { cache } from 'react'

import { type BookingSource, todayIso } from '@/lib/bookings'
import type { InvoiceDocKind } from '@/lib/invoice-drafts'
import { cleanInvoiceQuery, type Invoice, type InvoiceOrigin } from '@/lib/invoices'
import {
  computePaymentState,
  isPlatformSource,
  type Payment,
  PAYMENT_PAGE_SIZE,
  type PaymentFilters,
  type PaymentKind,
  type PaymentListRow,
  type PaymentMethod,
  type PaymentPage,
  type PaymentState,
  type PaymentStatus,
  paymentRange,
  RECEIPT_BUCKET,
  receiptTypeOf,
} from '@/lib/payments'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext } from '@/lib/tenant'

// Lesefunktionen der Zahlungserfassung (PROJ-45) für alle Mitglieder des gewählten Kunden (Inhaber und Mitarbeiter).
// Rechte prüft die Datenbank (RLS: Zahlungen, Zahlungsarten und Belege nur für Mitglieder, ohne Betreiber-Ausnahme).
// Fehlen Tabellen, Lesesichten oder Funktionen (Umgebung ohne Migration 20261106171901_payments), liefern die Funktionen leere
// Ergebnisse und den Stand ohne Zahlungen. Zugriff ungetypt: Die Rückgaben werden hier selbst in eigene Typen übersetzt.

const RECEIPT_LINK_SECONDS = 600
// Tabelle, Sicht oder Funktion fehlt noch (Migration nicht eingespielt)
const MISSING = new Set(['42P01', '42883', 'PGRST202', 'PGRST205'])
export const isMissingRelation = (error: { code?: string } | null) => Boolean(error?.code && MISSING.has(error.code))

const untyped = async () => (await createClient()) as unknown as SupabaseClient

async function requireMember(): Promise<{ tenantId: string; owner: boolean }> {
  const { active } = await getTenantContext()
  if (!active) notFound()
  return { tenantId: active.id, owner: active.role === 'owner' }
}

// ---- Zahlungsarten ------------------------------------------------------------------------------

type MethodDb = { id: string; name: string; active: boolean; is_default: boolean }

// Alle Zahlungsarten des Kunden in der Reihenfolge der Einstellungen (auch deaktivierte, für alte Zahlungen)
export const getPaymentMethods = cache(async (): Promise<PaymentMethod[]> => {
  const { tenantId } = await requireMember()
  const supabase = await untyped()
  const { data, error } = await supabase.from('payment_methods').select('id, name, active, is_default').eq('tenant_id', tenantId).order('position')
  if (error) {
    if (!isMissingRelation(error)) console.error('[zahlungen] Zahlungsarten nicht lesbar', error.message)
    return []
  }
  return ((data ?? []) as MethodDb[]).map((m) => ({ id: m.id, name: m.name, active: m.active, isDefault: m.is_default }))
})

// Zahlungsarten mit Verwendung (Einstellungen → Zahlungen, nur Inhaber): Benutzte Arten lassen sich nur deaktivieren
export async function getPaymentMethodsWithUsage(): Promise<{ tenantId: string; methods: (PaymentMethod & { used: boolean })[]; ready: boolean }> {
  const { tenantId } = await requireMember()
  const supabase = await untyped()
  const { data, error } = await supabase
    .from('payment_methods')
    .select('id, name, active, is_default, payments(count)')
    .eq('tenant_id', tenantId)
    .order('position')
  if (error) {
    if (!isMissingRelation(error)) console.error('[zahlungen] Zahlungsarten nicht lesbar', error.message)
    return { tenantId, methods: [], ready: !isMissingRelation(error) }
  }
  type Row = MethodDb & { payments: { count: number }[] }
  return {
    tenantId,
    ready: true,
    methods: ((data ?? []) as Row[]).map((m) => ({ id: m.id, name: m.name, active: m.active, isDefault: m.is_default, used: (m.payments?.[0]?.count ?? 0) > 0 })),
  }
}

// ---- Zahlungsstand je Rechnung ------------------------------------------------------------------

type StateDb = {
  invoice_id: string
  mode: PaymentState['mode']
  status: PaymentStatus | null
  total_cents: number
  received_cents: number
  commission_cents: number
  fee_cents: number
  settled_cents: number
  open_cents: number
  overdue: boolean
  balance_cents: number
  refunded_cents: number
}

const fromStateDb = (r: StateDb): PaymentState => ({
  mode: r.mode,
  status: r.status,
  totalCents: r.total_cents,
  receivedCents: r.received_cents,
  commissionCents: r.commission_cents,
  feeCents: r.fee_cents,
  settledCents: r.settled_cents,
  openCents: r.open_cents,
  overdue: r.overdue,
  balanceCents: r.balance_cents,
  refundedCents: r.refunded_cents,
})

export type InvoiceStateKey = { id: string; origin: InvoiceOrigin; kind: InvoiceDocKind | null; totalCents: number; cancelled: boolean }

// Stand aus der Lesesicht (nur Zeilen, die die Datenbank liefert)
async function readStates(ids: readonly string[]): Promise<Map<string, PaymentState>> {
  const result = new Map<string, PaymentState>()
  if (!ids.length) return result
  const { tenantId } = await requireMember()
  const supabase = await untyped()
  for (let i = 0; i < ids.length; i += 100) {
    const { data, error } = await supabase
      .from('invoice_payment_status')
      .select('invoice_id, mode, status, total_cents, received_cents, commission_cents, fee_cents, settled_cents, open_cents, overdue, balance_cents, refunded_cents')
      .eq('tenant_id', tenantId)
      .in('invoice_id', ids.slice(i, i + 100))
    if (error) {
      if (!isMissingRelation(error)) console.error('[zahlungen] Zahlungsstand nicht lesbar', error.message)
      break
    }
    for (const r of (data ?? []) as StateDb[]) result.set(r.invoice_id, fromStateDb(r))
  }
  return result
}

// Stand je Rechnung; fehlt die Lesesicht oder eine Zeile, der Stand ohne Zahlungen (gleiche Regel wie die Datenbank)
export async function getPaymentStates(invoices: readonly InvoiceStateKey[]): Promise<Map<string, PaymentState>> {
  const result = await readStates([...new Set(invoices.filter((i) => i.origin !== 'draft').map((i) => i.id))])
  for (const i of invoices) {
    if (!result.has(i.id)) result.set(i.id, computePaymentState({ origin: i.origin, kind: i.kind, totalCents: i.totalCents, cancelled: i.cancelled, payments: [] }))
  }
  return result
}

// Buchungsquellen → Plattform-Buchung (Provision und Zahlungsgebühr möglich)
export async function getPlatformBookings(bookingIds: readonly (string | null | undefined)[]): Promise<Set<string>> {
  const ids = [...new Set(bookingIds.filter((b): b is string => Boolean(b)))]
  const result = new Set<string>()
  if (!ids.length) return result
  const { tenantId } = await requireMember()
  const supabase = await createClient()
  const { data, error } = await supabase.from('bookings').select('id, source').eq('tenant_id', tenantId).in('id', ids)
  if (error) console.error('[zahlungen] Buchungsquelle nicht lesbar', error.message)
  for (const b of data ?? []) if (isPlatformSource(b.source as BookingSource)) result.add(b.id)
  return result
}

// ---- Zahlungen einer Rechnung -------------------------------------------------------------------

type PaymentDb = {
  id: string
  kind: PaymentKind
  invoice_id: string
  paid_on: string
  amount_cents: number
  commission_cents: number
  fee_cents: number
  note: string | null
  receipt_path: string | null
  created_at: string
  updated_at: string
  method: { id: string; name: string; active: boolean } | null
  creator: { display_name: string | null } | null
}

const PAYMENT_COLUMNS =
  'id, kind, invoice_id, paid_on, amount_cents, commission_cents, fee_cents, note, receipt_path, created_at, updated_at, ' +
  'method:payment_methods(id, name, active), creator:profiles!payments_created_by_fkey(display_name)'

const fromPaymentDb = (r: PaymentDb): Payment => ({
  id: r.id,
  kind: r.kind,
  invoiceId: r.invoice_id,
  paidOn: r.paid_on,
  amountCents: r.amount_cents,
  commissionCents: r.commission_cents,
  feeCents: r.fee_cents,
  method: r.method,
  note: r.note,
  receipt: r.receipt_path ? { path: r.receipt_path, type: receiptTypeOf(r.receipt_path) } : null,
  createdBy: r.creator?.display_name ?? null,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})

export type InvoicePayments = {
  state: PaymentState
  payments: Payment[]
  // Plattform-Buchung: Felder für Provision und Zahlungsgebühr
  platform: boolean
  owner: boolean
  // Datenbank bereit (Migration eingespielt)
  ready: boolean
}

// Zahlungen bzw. Rückzahlungen einer Rechnung, nach Datum aufsteigend, mit Stand
export async function getInvoicePayments(invoice: Invoice): Promise<InvoicePayments> {
  const { tenantId, owner } = await requireMember()
  const supabase = await untyped()
  const { data, error } = await supabase
    .from('payments')
    .select(PAYMENT_COLUMNS)
    .eq('tenant_id', tenantId)
    .eq('invoice_id', invoice.id)
    .order('paid_on')
    .order('created_at')
  const ready = !isMissingRelation(error)
  if (error && ready) console.error('[zahlungen] Zahlungen nicht lesbar', error.message)
  const payments = ((data ?? []) as unknown as PaymentDb[]).map(fromPaymentDb)
  const kind = invoice.kind ?? invoice.issued?.snapshot.kind ?? null
  const key = { id: invoice.id, origin: invoice.origin, kind, totalCents: invoice.totalCents, cancelled: invoice.cancelledBy !== null }
  const [states, platform] = await Promise.all([readStates([invoice.id]), getPlatformBookings([invoice.booking?.id])])
  // Fehlt die Lesesicht: Stand aus den gelesenen Zahlungen nach derselben Regel
  const state =
    states.get(invoice.id) ?? computePaymentState({ ...key, payments, schedule: invoice.issued?.snapshot.schedule ?? null, today: todayIso() })
  return { state, payments, platform: invoice.booking ? platform.has(invoice.booking.id) : false, owner, ready }
}

// Kurzlebiger Abruf-Link eines Belegs (nur für Mitglieder; die Speicherregeln prüfen den Kunden)
export async function receiptLink(path: string): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase.storage.from(RECEIPT_BUCKET).createSignedUrl(path, RECEIPT_LINK_SECONDS)
  if (error) {
    console.error('[zahlungen] Beleg nicht abrufbar', error.message)
    return null
  }
  return data.signedUrl
}

// ---- Zahlungsliste ------------------------------------------------------------------------------

type ListDb = {
  id: string
  kind: PaymentKind
  paid_on: string
  amount_cents: number
  commission_cents: number
  fee_cents: number
  method_name: string
  receipt_path: string | null
  invoice_id: string
  invoice_number: string | null
  recipient: string
  booking_id: string | null
  booking_number: string | null
}

type TotalsDb = { received_cents: number; commission_cents: number; fee_cents: number }

const LIST_COLUMNS =
  'id, kind, paid_on, amount_cents, commission_cents, fee_cents, method_name, receipt_path, invoice_id, invoice_number, recipient, booking_id, booking_number'

// Zahlungsliste (Menüpunkt „Zahlungen“): Datum absteigend, je 50; Summen über alle Seiten aus einer eigenen Funktion
export async function getPaymentPage(filters: PaymentFilters): Promise<PaymentPage & { ready: boolean }> {
  const { tenantId } = await requireMember()
  const supabase = await untyped()
  const range = paymentRange(filters)
  const query = cleanInvoiceQuery(filters.query)
  const from = (filters.page - 1) * PAYMENT_PAGE_SIZE

  let request = supabase.from('payment_list').select(LIST_COLUMNS, { count: 'exact' }).eq('tenant_id', tenantId)
  if (range) request = request.gte('paid_on', range.from).lt('paid_on', range.to)
  if (filters.methodId) request = request.eq('method_id', filters.methodId)
  if (query) request = request.or(`invoice_number.ilike."%${query}%",recipient.ilike."%${query}%",note.ilike."%${query}%"`)
  const [list, totals] = await Promise.all([
    request
      .order('paid_on', { ascending: false })
      .order('created_at', { ascending: false })
      .range(from, from + PAYMENT_PAGE_SIZE - 1),
    supabase.rpc('payment_list_totals', {
      p_tenant_id: tenantId,
      p_from: range?.from ?? null,
      p_to: range?.to ?? null,
      p_method_id: filters.methodId,
      p_query: query || null,
    }),
  ])
  const ready = !isMissingRelation(list.error)
  if (list.error && ready) console.error('[zahlungen] Liste nicht lesbar', list.error.message)
  if (totals.error && !isMissingRelation(totals.error)) console.error('[zahlungen] Summen nicht lesbar', totals.error.message)
  const t = (Array.isArray(totals.data) ? totals.data[0] : totals.data) as TotalsDb | null
  const total = list.count ?? 0
  return {
    ...filters,
    ready,
    total,
    pageCount: Math.max(1, Math.ceil(total / PAYMENT_PAGE_SIZE)),
    totals: { receivedCents: t?.received_cents ?? 0, commissionCents: t?.commission_cents ?? 0, feeCents: t?.fee_cents ?? 0 },
    rows: ((list.data ?? []) as unknown as ListDb[]).map((r) => ({
      id: r.id,
      kind: r.kind,
      paidOn: r.paid_on,
      amountCents: r.amount_cents,
      commissionCents: r.commission_cents,
      feeCents: r.fee_cents,
      methodName: r.method_name,
      receiptType: r.receipt_path ? receiptTypeOf(r.receipt_path) : null,
      invoice: { id: r.invoice_id, number: r.invoice_number, recipient: r.recipient },
      booking: r.booking_id ? { id: r.booking_id, number: r.booking_number } : null,
    })),
  }
}

// Zahlungen und Rückzahlungen aller Rechnungen einer Buchung (Abschnitt „Zahlungen“ im Buchungsdetail), Datum aufsteigend
export async function getBookingPayments(bookingId: string): Promise<(PaymentListRow & { note: string | null })[]> {
  const { tenantId } = await requireMember()
  const supabase = await untyped()
  const { data, error } = await supabase
    .from('payment_list')
    .select(`${LIST_COLUMNS}, note`)
    .eq('tenant_id', tenantId)
    .eq('booking_id', bookingId)
    .order('paid_on')
    .order('created_at')
  if (error && !isMissingRelation(error)) console.error('[zahlungen] Zahlungen der Buchung nicht lesbar', error.message)
  return ((data ?? []) as unknown as (ListDb & { note: string | null })[]).map((r) => ({
    id: r.id,
    kind: r.kind,
    paidOn: r.paid_on,
    amountCents: r.amount_cents,
    commissionCents: r.commission_cents,
    feeCents: r.fee_cents,
    methodName: r.method_name,
    receiptType: r.receipt_path ? receiptTypeOf(r.receipt_path) : null,
    invoice: { id: r.invoice_id, number: r.invoice_number, recipient: r.recipient },
    booking: r.booking_id ? { id: r.booking_id, number: r.booking_number } : null,
    note: r.note,
  }))
}

// Gibt es beim Kunden überhaupt Zahlungen? (Leerzustand)
export async function hasAnyPayment(): Promise<boolean> {
  const { tenantId } = await requireMember()
  const supabase = await untyped()
  const { count, error } = await supabase.from('payments').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)
  if (error && !isMissingRelation(error)) console.error('[zahlungen] Anzahl nicht lesbar', error.message)
  return (count ?? 0) > 0
}
