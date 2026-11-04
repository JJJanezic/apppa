'use server'

import { revalidatePath } from 'next/cache'

import type { ActionResult, CommonErrorCode } from '@/lib/auth/result'
import type { InvoiceSettingsErrorCode } from '@/lib/invoice-settings'
import { tenantHref } from '@/lib/operator'
import { createClient } from '@/lib/supabase/server'
import { belongsToDeactivatedTenant } from '@/lib/tenant'
import { tenantSettingsAccess } from '@/lib/tenant-settings-guard'
import { letterheadSchema, type LetterheadInput } from '@/lib/validation/letterhead'

type Result = ActionResult<undefined, InvoiceSettingsErrorCode>
const key = (k: string) => k
const fail = (error: InvoiceSettingsErrorCode | CommonErrorCode): { ok: false; error: InvoiceSettingsErrorCode | CommonErrorCode } => ({ ok: false, error })

const DB_ERRORS: Record<string, InvoiceSettingsErrorCode | CommonErrorCode> = {
  '42501': 'sessionExpired',
  P0011: 'tenantGone',
  P0016: 'tenantDeactivated',
  P0910: 'staleSettings',
  P0914: 'contentInvalid',
  // Funktion noch nicht eingerichtet (Migration aus /backend)
  PGRST202: 'notImplemented',
}

// Briefpapier speichern (PROJ-41), Inhaber und Betreiber. Rolle, 2FA, Aktiv-Status und Stand prüft die Datenbank-Funktion.
export async function saveLetterhead(values: { tenantId: string; updatedAt: string; letterhead: LetterheadInput }): Promise<Result> {
  const parsed = letterheadSchema(key).safeParse(values?.letterhead)
  if (!parsed.success || typeof values?.updatedAt !== 'string' || !values.updatedAt || values.updatedAt.length > 64) return fail('unknown')
  const access = await tenantSettingsAccess(values.tenantId)
  if (!access) return fail((await belongsToDeactivatedTenant()) ? 'tenantDeactivated' : 'sessionExpired')
  const v = parsed.data
  const supabase = await createClient()
  const { error } = await supabase.rpc('save_invoice_letterhead' as never, {
    p_tenant_id: access.tenantId,
    p_expected_updated_at: values.updatedAt,
    p_data: {
      font: v.fontFamily,
      font_size: v.fontSize,
      line_spacing: v.lineSpacing,
      paragraph_spacing: v.paragraphSpacing,
      logo_position: v.logoPosition,
      logo_height_mm: v.logoHeightMm,
      show_issuer: v.showIssuer,
    },
  } as never)
  if (error) {
    const mapped = error.code ? DB_ERRORS[error.code] : undefined
    if (!mapped) console.error('[briefpapier] nicht gespeichert', error.code, error.message)
    return fail(mapped ?? 'unknown')
  }
  if (access.operator) revalidatePath(tenantHref(access.tenantId))
  revalidatePath('/einstellungen/briefpapier')
  return { ok: true }
}
