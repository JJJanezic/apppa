'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

import type { ActionResult, CommonErrorCode } from '@/lib/auth/result'
import { getSessionUser, pendingMfaStep } from '@/lib/auth/session'
import { todayIso } from '@/lib/bookings'
import { cleanInvoiceQuery } from '@/lib/invoices'
import { type PaymentErrorCode, type PaymentKind, type PaymentMethod, RECEIPT_BUCKET } from '@/lib/payments'
import { isMissingRelation } from '@/lib/payments-data'
import { removeReceiptFiles } from '@/lib/payment-files'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext, type TenantSummary } from '@/lib/tenant'
import { type PaymentInput, paymentSchema } from '@/lib/validation/payments'

// Server-Aktionen der Zahlungserfassung (PROJ-45). Erfassen: Inhaber und Mitarbeiter; Ändern, Umhängen, Löschen: nur Inhaber.
// Geschrieben wird nur über die Datenbank-Funktionen record_payment, update_payment und delete_payment; sie sperren die
// Rechnung (wie das Ausstellen einer Gutschrift), prüfen Rolle, Mandant, Zahlbarkeit, Plattform-Buchung, Zahlungsart und
// Beleg selbst und liefern Hinweise (Überzahlung, gleiche Zahlung, Rückzahlung über Guthaben), solange sie nicht bestätigt sind.

type Result<T = undefined> = ActionResult<T, PaymentErrorCode>
type Failure = { ok: false; error: PaymentErrorCode | CommonErrorCode }
type DbError = { code?: string; message?: string; details?: string }

const key = (k: string) => k
const fail = (error: PaymentErrorCode | CommonErrorCode): Failure => ({ ok: false, error })
const isId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value)
const untyped = async () => (await createClient()) as unknown as SupabaseClient
const SEARCH_LIMIT = 20

async function requireMember(): Promise<{ ok: true; tenant: TenantSummary } | Failure> {
  const user = await getSessionUser()
  if (!user || (await pendingMfaStep(user))) return fail('sessionExpired')
  const { active } = await getTenantContext()
  return active ? { ok: true, tenant: active } : fail('unknown')
}

async function requireOwner(): Promise<{ ok: true; tenant: TenantSummary } | Failure> {
  const guard = await requireMember()
  if (!guard.ok) return guard
  return guard.tenant.role === 'owner' ? guard : fail('ownerOnly')
}

// Fehler der Datenbank → Meldung (Codes siehe Migration der Zahlungen)
const DB_ERRORS: Record<string, PaymentErrorCode | CommonErrorCode> = {
  '42501': 'ownerOnly',
  P0950: 'ownerOnly',
  P0951: 'notFound',
  P0952: 'invoiceNotPayable',
  P0953: 'invoiceCancelled',
  P0954: 'notCreditNote',
  P0955: 'dateInFuture',
  P0956: 'amountInvalid',
  P0957: 'commissionNotAllowed',
  P0958: 'methodInactive',
  P0959: 'receiptMissing',
  P0960: 'stalePayment',
  P0016: 'tenantDeactivated',
}

function dbFail(error: DbError, context: string): Failure {
  if (isMissingRelation(error)) return fail('notImplemented')
  const mapped = error.code ? DB_ERRORS[error.code] : undefined
  if (!mapped) console.error(`[zahlungen] ${context}`, error.code, error.message)
  return fail(mapped ?? 'unknown')
}

const revalidate = (invoiceIds: (string | null | undefined)[], bookingIds: (string | null | undefined)[]) => {
  revalidatePath('/zahlungen')
  revalidatePath('/rechnungen')
  for (const id of new Set(invoiceIds)) if (id) revalidatePath(`/rechnungen/${id}`)
  for (const id of new Set(bookingIds)) if (id) revalidatePath(`/buchungen/${id}`)
  revalidatePath('/')
}

// Hinweise vor dem Speichern: Überzahlung um … Cent, gleiche Zahlung vom … schon erfasst, Rückzahlung über dem Guthaben
export type PaymentWarning = { code: 'overpaid'; cents: number } | { code: 'duplicate'; cents: number; date: string } | { code: 'refundOver'; cents: number }

type SaveDb = {
  saved: boolean
  id?: string
  warnings?: PaymentWarning[]
  invoice_id?: string
  previous_invoice_id?: string | null
  booking_ids?: (string | null)[]
  unused_receipt?: string | null
}

export type SavePaymentResult = Result<{ id: string } | { warnings: PaymentWarning[] }>

type Parsed = NonNullable<ReturnType<typeof parse>>

function dbInput(tenantId: string, kind: PaymentKind, values: Parsed, confirmed: boolean) {
  return {
    tenant_id: tenantId,
    kind,
    invoice_id: values.invoiceId,
    paid_on: values.paidOn,
    amount_cents: values.amountCents,
    // Rückzahlungen haben weder Provision noch Gebühr
    commission_cents: kind === 'refund' ? 0 : values.commissionCents,
    fee_cents: kind === 'refund' ? 0 : values.feeCents,
    method_id: values.methodId,
    note: values.note,
    receipt_path: values.receiptPath,
    confirmed,
  }
}

const parse = (values: PaymentInput | undefined) => {
  const parsed = paymentSchema(key, { today: todayIso() }).safeParse(values)
  if (!parsed.success) return null
  const v = parsed.data
  return { ...v, amountCents: v.amount, commissionCents: v.commission, feeCents: v.fee }
}

async function finish(data: SaveDb): Promise<SavePaymentResult> {
  if (!data.saved) return { ok: true, data: { warnings: data.warnings ?? [] } }
  await removeReceiptFiles([data.unused_receipt])
  revalidate([data.invoice_id, data.previous_invoice_id], data.booking_ids ?? [])
  return { ok: true, data: { id: data.id ?? '' } }
}

// Zahlung (an einer Rechnung) bzw. Rückzahlung (an einer Gutschrift) erfassen; Inhaber und Mitarbeiter
export async function recordPayment(input: { kind: PaymentKind; values: PaymentInput; confirmed?: boolean }): Promise<SavePaymentResult> {
  const guard = await requireMember()
  if (!guard.ok) return guard
  if (input?.kind !== 'payment' && input?.kind !== 'refund') return fail('unknown')
  const v = parse(input.values)
  if (!v) return fail('unknown')
  const supabase = await untyped()
  const { data, error } = await supabase.rpc('record_payment', { p_input: dbInput(guard.tenant.id, input.kind, v, input.confirmed === true) })
  if (error) return dbFail(error, 'Zahlung erfassen')
  return finish(data as SaveDb)
}

// Zahlung ändern oder einer anderen Rechnung zuordnen (umhängen); nur Inhaber
export async function updatePayment(input: { id: string; updatedAt: string; kind: PaymentKind; values: PaymentInput; confirmed?: boolean }): Promise<SavePaymentResult> {
  const guard = await requireOwner()
  if (!guard.ok) return guard
  if (!isId(input?.id) || typeof input.updatedAt !== 'string') return fail('notFound')
  if (input.kind !== 'payment' && input.kind !== 'refund') return fail('unknown')
  const v = parse(input.values)
  if (!v) return fail('unknown')
  const supabase = await untyped()
  const { data, error } = await supabase.rpc('update_payment', {
    p_input: { ...dbInput(guard.tenant.id, input.kind, v, input.confirmed === true), id: input.id, updated_at: input.updatedAt },
  })
  if (error) return dbFail(error, 'Zahlung ändern')
  return finish(data as SaveDb)
}

// Zahlung samt Beleg löschen; nur Inhaber
export async function deletePayment(input: { id: string }): Promise<Result> {
  const guard = await requireOwner()
  if (!guard.ok) return guard
  if (!isId(input?.id)) return fail('notFound')
  const supabase = await untyped()
  const { data, error } = await supabase.rpc('delete_payment', { p_payment_id: input.id })
  if (error) return dbFail(error, 'Zahlung löschen')
  const result = data as { invoice_id: string; booking_id: string | null; receipt_path: string | null }
  await removeReceiptFiles([result.receipt_path])
  revalidate([result.invoice_id], [result.booking_id])
  return { ok: true }
}

// Beleg hochladen: Der Server vergibt Speicherort und einmaligen Upload-Schlüssel im Ordner des eigenen Kunden; der Browser
// lädt die Datei direkt in den privaten Speicher (Vercel begrenzt Server-Anfragen auf 4,5 MB). An der Zahlung wirksam wird
// der Beleg erst beim Speichern; sonst räumt die tägliche Bereinigung ihn weg.
export async function prepareReceiptUpload(input: { type: 'pdf' | 'image' }): Promise<Result<{ path: string; token: string }>> {
  const guard = await requireMember()
  if (!guard.ok) return guard
  const ext = input?.type === 'pdf' ? 'pdf' : 'jpg'
  const path = `${guard.tenant.id}/${crypto.randomUUID()}.${ext}`
  const supabase = await createClient()
  const { data, error } = await supabase.storage.from(RECEIPT_BUCKET).createSignedUploadUrl(path)
  if (error || !data) {
    if (error && /bucket/i.test(error.message)) return fail('notImplemented')
    console.error('[zahlungen] Upload nicht vorbereitet', error?.message)
    return fail('unknown')
  }
  return { ok: true, data: { path: data.path, token: data.token } }
}

// Abruf-Link eines Belegs (Klick auf das Beleg-Symbol), für alle Mitglieder
export async function openReceipt(input: { paymentId: string }): Promise<Result<{ url: string }>> {
  const guard = await requireMember()
  if (!guard.ok) return guard
  if (!isId(input?.paymentId)) return fail('notFound')
  const supabase = await untyped()
  const { data, error } = await supabase.from('payments').select('receipt_path').eq('id', input.paymentId).eq('tenant_id', guard.tenant.id).maybeSingle()
  if (error) return dbFail(error, 'Beleg lesen')
  const path = (data as { receipt_path: string | null } | null)?.receipt_path
  if (!path) return fail('notFound')
  const { data: link, error: linkError } = await (await createClient()).storage.from(RECEIPT_BUCKET).createSignedUrl(path, 600)
  if (linkError || !link) {
    console.error('[zahlungen] Beleg nicht abrufbar', linkError?.message)
    return fail('unknown')
  }
  return { ok: true, data: { url: link.signedUrl } }
}

export type PayableInvoiceOption = {
  id: string
  number: string | null
  kind: string | null
  recipient: string
  openCents: number
  bookingId: string | null
  platform: boolean
}

// Umhängen: zahlbare Rechnungen des Kunden, die der gleichen Buchung zuerst; Suche nach Nummer und Empfänger (nur Inhaber)
export async function searchPayableInvoices(input: { query: string; bookingId: string | null }): Promise<Result<PayableInvoiceOption[]>> {
  const guard = await requireOwner()
  if (!guard.ok) return guard
  const query = cleanInvoiceQuery(String(input?.query ?? ''))
  const supabase = await untyped()
  const { data, error } = await supabase.rpc('search_payable_invoices', {
    p_tenant_id: guard.tenant.id,
    p_query: query || null,
    p_booking_id: isId(input?.bookingId) ? input.bookingId : null,
    p_limit: SEARCH_LIMIT,
  })
  if (error) return dbFail(error, 'Rechnungssuche')
  type Row = { id: string; number: string | null; kind: string | null; recipient: string; open_cents: number; booking_id: string | null; platform: boolean }
  return {
    ok: true,
    data: ((data ?? []) as Row[]).map((r) => ({
      id: r.id,
      number: r.number,
      kind: r.kind,
      recipient: r.recipient,
      openCents: r.open_cents,
      bookingId: r.booking_id,
      platform: r.platform,
    })),
  }
}

// Aktive Zahlungsarten für Formulare ohne Seitendaten („Bereits bezahlt“ beim Nacherfassen)
export async function listActivePaymentMethods(): Promise<Result<PaymentMethod[]>> {
  const guard = await requireMember()
  if (!guard.ok) return guard
  const supabase = await untyped()
  const { data, error } = await supabase.from('payment_methods').select('id, name, active, is_default').eq('tenant_id', guard.tenant.id).eq('active', true).order('position')
  if (error) return dbFail(error, 'Zahlungsarten')
  type Row = { id: string; name: string; active: boolean; is_default: boolean }
  return { ok: true, data: ((data ?? []) as Row[]).map((m) => ({ id: m.id, name: m.name, active: m.active, isDefault: m.is_default })) }
}
