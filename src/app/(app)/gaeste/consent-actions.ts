'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

import type { ActionResult, CommonErrorCode } from '@/lib/auth/result'
import { getSessionUser, pendingMfaStep } from '@/lib/auth/session'
import { todayIso } from '@/lib/bookings'
import { CONSENT_RECEIPT_BUCKET, type ConsentErrorCode, type ConsentKind, type ConsentWarning } from '@/lib/marketing-consent'
import { isMissingRelation } from '@/lib/marketing-consent-data'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext, type TenantSummary } from '@/lib/tenant'
import { type ConsentInput, consentSchema, voidSchema } from '@/lib/validation/marketing-consent'

// Server-Aktionen der Marketing-Einwilligung (PROJ-19). Erteilen und Widerrufen von Hand: Inhaber und Mitarbeiter (Ausnahme zu
// PROJ-7, damit ein Widerruf sofort wirkt, egal wer ihn entgegennimmt); als irrtümlich markieren: nur Inhaber.
// Geschrieben wird nur über die Datenbank-Funktionen record_marketing_consent und void_marketing_consent; sie prüfen Rolle,
// Mandant, Gast, Stand und Weg selbst und melden vor dem Speichern, wenn ein Eintrag den Stand nicht ändert.

type Result<T = undefined> = ActionResult<T, ConsentErrorCode>
type Failure = { ok: false; error: ConsentErrorCode | CommonErrorCode }
type DbError = { code?: string; message?: string }

const key = (k: string) => k
const fail = (error: ConsentErrorCode | CommonErrorCode): Failure => ({ ok: false, error })
const isId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value)
const untyped = async () => (await createClient()) as unknown as SupabaseClient

async function requireMember(): Promise<{ ok: true; tenant: TenantSummary } | Failure> {
  const user = await getSessionUser()
  if (!user || (await pendingMfaStep(user))) return fail('sessionExpired')
  const { active } = await getTenantContext()
  return active ? { ok: true, tenant: active } : fail('unknown')
}

// Fehler der Datenbank → Meldung (Codes siehe „Erwartete Datenbank-Schnittstellen“ in features/PROJ-19-marketing-einwilligung.md)
const DB_ERRORS: Record<string, ConsentErrorCode | CommonErrorCode> = {
  '42501': 'ownerOnly',
  P0988: 'consentReceiptMissing',
  P0992: 'notFound',
  P0993: 'guestAnonymized',
  P0994: 'consentDateInFuture',
  P0995: 'consentDateBeforeBirth',
  P0996: 'consentChannelInvalid',
  P0997: 'consentNotGranted',
  P0998: 'consentNotVoidable',
  P0999: 'consentAlreadyVoided',
}

function dbFail(error: DbError, context: string): Failure {
  if (isMissingRelation(error)) return fail('notImplemented')
  const mapped = error.code ? DB_ERRORS[error.code] : undefined
  if (!mapped) console.error(`[einwilligung] ${context}`, error.code, error.message)
  return fail(mapped ?? 'unknown')
}

const revalidate = (guestId: string) => {
  revalidatePath(`/gaeste/${guestId}`)
  revalidatePath('/gaeste')
}

export type RecordConsentResult = Result<{ id: string } | { warnings: ConsentWarning[] }>

type RecordDb = { saved: boolean; id?: string; warnings?: ConsentWarning[] }

// Erteilung oder Widerruf von Hand erfassen; Inhaber und Mitarbeiter
export async function recordConsent(input: { guestId: string; kind: ConsentKind; values: ConsentInput; confirmed?: boolean }): Promise<RecordConsentResult> {
  const guard = await requireMember()
  if (!guard.ok) return guard
  if (!isId(input?.guestId)) return fail('notFound')
  if (input.kind !== 'grant' && input.kind !== 'revoke') return fail('unknown')
  // Geburtsdatum prüft die Datenbank (P0995); hier nur Form, Zukunft und Weg
  const parsed = consentSchema(key, { kind: input.kind, today: todayIso() }).safeParse(input.values)
  if (!parsed.success) return fail('unknown')
  const v = parsed.data
  const supabase = await untyped()
  const { data, error } = await supabase.rpc('record_marketing_consent', {
    p_input: {
      tenant_id: guard.tenant.id,
      guest_id: input.guestId,
      kind: input.kind,
      occurred_on: v.occurredOn,
      channel: v.channel,
      note: v.note,
      receipt_path: v.receiptPath,
      confirmed: input.confirmed === true,
    },
  })
  if (error) return dbFail(error, 'Einwilligung erfassen')
  const result = data as RecordDb
  if (!result.saved) return { ok: true, data: { warnings: result.warnings ?? [] } }
  revalidate(input.guestId)
  return { ok: true, data: { id: result.id ?? '' } }
}

// Von Hand erfassten Eintrag als irrtümlich markieren; nur Inhaber (die Datenbank prüft die Rolle zusätzlich)
export async function voidConsentEntry(input: { guestId: string; entryId: string; reason: string }): Promise<Result> {
  const guard = await requireMember()
  if (!guard.ok) return guard
  if (guard.tenant.role !== 'owner') return fail('ownerOnly')
  if (!isId(input?.guestId) || !isId(input.entryId)) return fail('notFound')
  const parsed = voidSchema(key).safeParse({ reason: input.reason })
  if (!parsed.success) return fail('unknown')
  const supabase = await untyped()
  const { error } = await supabase.rpc('void_marketing_consent', { p_entry_id: input.entryId, p_reason: parsed.data.reason })
  if (error) return dbFail(error, 'Eintrag als irrtümlich markieren')
  revalidate(input.guestId)
  return { ok: true }
}

// Beleg hochladen: Speicherort und einmaliger Upload-Schlüssel im Ordner des eigenen Kunden; der Browser lädt direkt in den
// privaten Speicher. Wirksam erst beim Speichern; sonst räumt die tägliche Bereinigung den Beleg weg.
export async function prepareConsentReceiptUpload(input: { type: 'pdf' | 'image' }): Promise<Result<{ path: string; token: string }>> {
  const guard = await requireMember()
  if (!guard.ok) return guard
  const ext = input?.type === 'pdf' ? 'pdf' : 'jpg'
  const path = `${guard.tenant.id}/${crypto.randomUUID()}.${ext}`
  const supabase = await createClient()
  const { data, error } = await supabase.storage.from(CONSENT_RECEIPT_BUCKET).createSignedUploadUrl(path)
  if (error || !data) {
    if (error && /bucket/i.test(error.message)) return fail('notImplemented')
    console.error('[einwilligung] Upload nicht vorbereitet', error?.message)
    return fail('unknown')
  }
  return { ok: true, data: { path: data.path, token: data.token } }
}

// Abruf-Link eines Belegs (Beleg-Symbol im Verlauf), für alle Mitglieder
export async function openConsentReceipt(input: { entryId: string }): Promise<Result<{ url: string }>> {
  const guard = await requireMember()
  if (!guard.ok) return guard
  if (!isId(input?.entryId)) return fail('notFound')
  const supabase = await untyped()
  const { data, error } = await supabase
    .from('marketing_consent_events')
    .select('receipt_path')
    .eq('id', input.entryId)
    .eq('tenant_id', guard.tenant.id)
    .maybeSingle()
  if (error) return dbFail(error, 'Beleg lesen')
  const path = (data as { receipt_path: string | null } | null)?.receipt_path
  if (!path) return fail('notFound')
  const { data: link, error: linkError } = await (await createClient()).storage.from(CONSENT_RECEIPT_BUCKET).createSignedUrl(path, 600)
  if (linkError || !link) {
    console.error('[einwilligung] Beleg nicht abrufbar', linkError?.message)
    return fail('unknown')
  }
  return { ok: true, data: { url: link.signedUrl } }
}
