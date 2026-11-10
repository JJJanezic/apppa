'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

import type { ActionResult, CommonErrorCode } from '@/lib/auth/result'
import { getSessionUser, pendingMfaStep } from '@/lib/auth/session'
import { defaultMarketingDoc, defaultPrivacyDoc, type GuestSheetErrorCode } from '@/lib/guest-sheet'
import { isMissingRelation } from '@/lib/guest-sheets-data'
import type { RichDoc } from '@/lib/rich-text'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext } from '@/lib/tenant'
import { guestSheetTextsSchema } from '@/lib/validation/guest-sheet'

// Einstellungen → Gästeblatt (PROJ-26), nur für Inhaber des gewählten Kunden. Gespeichert wird über eine Datenbank-Funktion
// mit Schutz vor Überschreiben (Stand); ein Text gleich dem Standard wird als „Standard“ (leer) abgelegt, damit spätere
// Verbesserungen des Standardtexts auch bei diesem Kunden wirken.

type Failure = { ok: false; error: GuestSheetErrorCode | CommonErrorCode | 'ownerOnly' | 'tenantDeactivated' }
const fail = (error: Failure['error']): Failure => ({ ok: false, error })
const key = (k: string) => k

const DB_ERRORS: Record<string, Failure['error']> = {
  '42501': 'ownerOnly',
  P0016: 'tenantDeactivated',
  P0970: 'staleSettings',
}

const sameDoc = (a: RichDoc, b: RichDoc) => JSON.stringify(a) === JSON.stringify(b)

export async function saveGuestSheetTexts(input: {
  tenantId: string
  updatedAt: string | null
  privacy: RichDoc
  marketing: RichDoc
}): Promise<ActionResult<undefined, Failure['error']>> {
  const user = await getSessionUser()
  if (!user || (await pendingMfaStep(user))) return fail('sessionExpired')
  const { active } = await getTenantContext()
  if (!active || active.id !== input?.tenantId) return fail('unknown')
  if (active.role !== 'owner') return fail('ownerOnly')
  const parsed = guestSheetTextsSchema(key).safeParse({ privacy: input.privacy, marketing: input.marketing })
  if (!parsed.success) return fail('unknown')
  if (input.updatedAt !== null && typeof input.updatedAt !== 'string') return fail('unknown')

  const supabase = (await createClient()) as unknown as SupabaseClient
  const { error } = await supabase.rpc('save_guest_sheet_texts', {
    p_tenant_id: active.id,
    p_expected_updated_at: input.updatedAt,
    p_privacy: sameDoc(parsed.data.privacy, defaultPrivacyDoc()) ? null : parsed.data.privacy,
    p_marketing: sameDoc(parsed.data.marketing, defaultMarketingDoc()) ? null : parsed.data.marketing,
  })
  if (error) {
    if (isMissingRelation(error)) return fail('notImplemented')
    const mapped = error.code ? DB_ERRORS[error.code] : undefined
    if (!mapped) console.error('[gaesteblatt] Texte speichern', error.code, error.message)
    return fail(mapped ?? 'unknown')
  }
  revalidatePath('/einstellungen/gaesteblatt')
  return { ok: true }
}

// Hinweis „Datenschutz-Text prüfen“ nach dem Freischalten von „Ausweis automatisch auslesen“ (PROJ-51) bestätigen; nur Inhaber
export async function dismissIdReadingPrivacyHint(input: { tenantId: string }): Promise<ActionResult<undefined, Failure['error']>> {
  const user = await getSessionUser()
  if (!user || (await pendingMfaStep(user))) return fail('sessionExpired')
  const { active } = await getTenantContext()
  if (!active || active.id !== input?.tenantId) return fail('unknown')
  if (active.role !== 'owner') return fail('ownerOnly')

  const supabase = (await createClient()) as unknown as SupabaseClient
  const { error } = await supabase.rpc('dismiss_id_reading_privacy_hint', { p_tenant_id: active.id })
  if (error) {
    if (isMissingRelation(error)) return fail('notImplemented')
    const mapped = error.code ? DB_ERRORS[error.code] : undefined
    if (!mapped) console.error('[ausweis] Hinweis bestätigen', error.code, error.message)
    return fail(mapped ?? 'unknown')
  }
  revalidatePath('/einstellungen/gaesteblatt')
  return { ok: true }
}
