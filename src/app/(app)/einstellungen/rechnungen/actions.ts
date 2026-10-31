'use server'

import { revalidatePath } from 'next/cache'

import type { ActionResult, CommonErrorCode } from '@/lib/auth/result'
import { getSessionUser, pendingMfaStep } from '@/lib/auth/session'
import type { InvoiceSettingsErrorCode } from '@/lib/invoice-settings'
import { tenantHref } from '@/lib/operator'
import { createClient } from '@/lib/supabase/server'
import { belongsToDeactivatedTenant, getTenantContext } from '@/lib/tenant'
import {
  fixedTextsSchema,
  type FixedTextsInput,
  numberingSchema,
  type NumberingInput,
  textBlockSchema,
  type TextBlockInput,
} from '@/lib/validation/invoice-settings'
import { TEXT_BLOCKS, type TextBlockKind } from '@/lib/invoice-texts'

// Server-Aktionen für Einstellungen → Rechnungen (PROJ-39), gemeinsam für Inhaber (eigener, gewählter Kunde) und
// Betreiber (Kunden-Detailseite). Gespeichert wird nur über Datenbank-Funktionen; sie prüfen Rolle, 2FA des Betreibers,
// Aktiv-Status, Stand und Inhalt selbst und schreiben das Betreiber-Protokoll.

type Result<T = undefined> = ActionResult<T, InvoiceSettingsErrorCode>
const fail = (error: InvoiceSettingsErrorCode | CommonErrorCode): { ok: false; error: InvoiceSettingsErrorCode | CommonErrorCode } => ({
  ok: false,
  error,
})
const key = (k: string) => k
const isId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value)
const isStamp = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length < 64

// Fehlercodes der Datenbank-Funktionen → Meldungen
const DB_ERRORS: Record<string, InvoiceSettingsErrorCode | CommonErrorCode> = {
  '42501': 'sessionExpired',
  P0011: 'tenantGone',
  P0016: 'tenantDeactivated',
  P0910: 'staleSettings',
  P0911: 'blockGone',
  P0912: 'blockLimit',
  P0913: 'nameTaken',
  P0914: 'contentInvalid',
}

function dbFail(error: { code?: string; message?: string }, context: string) {
  const mapped = error.code ? DB_ERRORS[error.code] : undefined
  if (!mapped) console.error(`[rechnungseinstellungen] ${context}`, error.code, error.message)
  return fail(mapped ?? 'unknown')
}

// Betreiber: jeder Kunde (2FA und Aktiv-Status prüft die Datenbank). Inhaber: nur der gewählte Kunde. Wurde er
// inzwischen deaktiviert, fehlt er in der Kundenauswahl; dann eigene Meldung statt „unbekannt“.
async function guard(tenantId: unknown): Promise<{ ok: true; tenantId: string; operator: boolean } | ReturnType<typeof fail>> {
  if (!isId(tenantId)) return fail('unknown')
  const user = await getSessionUser()
  if (!user || (await pendingMfaStep(user))) return fail('sessionExpired')
  if (user.isOperatorAdmin) return { ok: true, tenantId, operator: true }
  const { active } = await getTenantContext()
  if (!active || active.role !== 'owner' || active.id !== tenantId) {
    return fail((await belongsToDeactivatedTenant()) ? 'tenantDeactivated' : 'unknown')
  }
  return { ok: true, tenantId, operator: false }
}

function refresh(tenantId: string, operator: boolean) {
  if (operator) revalidatePath(tenantHref(tenantId))
  revalidatePath('/einstellungen/rechnungen')
  // Schalter „Rechnungen nacherfassen“ wirkt auf die Rechnungsliste
  revalidatePath('/rechnungen')
}

export async function saveInvoiceNumbering(values: { tenantId: string; updatedAt: string; numbering: NumberingInput }): Promise<Result> {
  const parsed = numberingSchema(key).safeParse(values?.numbering)
  if (!parsed.success || !isStamp(values?.updatedAt)) return fail('unknown')
  const g = await guard(values.tenantId)
  if (!g.ok) return g
  const n = parsed.data

  const supabase = await createClient()
  const { error } = await supabase.rpc('save_invoice_numbering', {
    p_tenant_id: g.tenantId,
    p_expected_updated_at: values.updatedAt,
    p_data: {
      prefix: n.prefix,
      with_year: n.withYear,
      separator: n.separator,
      digits: n.digits,
      yearly_reset: n.yearlyReset,
      start: n.startNumber,
    },
  })
  if (error) return dbFail(error, 'Nummernkreis nicht gespeichert')
  refresh(g.tenantId, g.operator)
  return { ok: true }
}

export async function saveInvoiceFixedTexts(values: { tenantId: string; updatedAt: string; texts: FixedTextsInput }): Promise<Result> {
  const parsed = fixedTextsSchema(key).safeParse(values?.texts)
  if (!parsed.success || !isStamp(values?.updatedAt)) return fail('unknown')
  const g = await guard(values.tenantId)
  if (!g.ok) return g

  const supabase = await createClient()
  const { error } = await supabase.rpc('save_invoice_fixed_texts', {
    p_tenant_id: g.tenantId,
    p_expected_updated_at: values.updatedAt,
    p_data: { small_business_note: parsed.data.smallBusinessNote, footer: parsed.data.footer },
  })
  if (error) return dbFail(error, 'Feste Texte nicht gespeichert')
  refresh(g.tenantId, g.operator)
  return { ok: true }
}

export async function saveInvoiceBackfill(values: { tenantId: string; updatedAt: string; enabled: boolean }): Promise<Result> {
  if (typeof values?.enabled !== 'boolean' || !isStamp(values?.updatedAt)) return fail('unknown')
  const g = await guard(values.tenantId)
  if (!g.ok) return g

  const supabase = await createClient()
  const { error } = await supabase.rpc('save_invoice_backfill', {
    p_tenant_id: g.tenantId,
    p_expected_updated_at: values.updatedAt,
    p_enabled: values.enabled,
  })
  if (error) return dbFail(error, 'Schalter nicht gespeichert')
  refresh(g.tenantId, g.operator)
  return { ok: true }
}

// Anlegen (id null) oder Ändern (id + Stand); der Standard wird getrennt gesetzt
export async function saveInvoiceTextBlock(values: {
  tenantId: string
  id: string | null
  updatedAt: string | null
  block: TextBlockInput
}): Promise<Result<{ id: string }>> {
  const parsed = textBlockSchema(key).safeParse(values?.block)
  const editing = values?.id !== null
  if (!parsed.success || (editing && (!isId(values?.id) || !isStamp(values?.updatedAt)))) return fail('unknown')
  const g = await guard(values.tenantId)
  if (!g.ok) return g
  const b = parsed.data

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('save_invoice_text_block', {
    p_input: {
      tenant_id: g.tenantId,
      id: values.id,
      updated_at: values.updatedAt,
      block: b.kind,
      name: b.name,
      body: b.body,
      deposit_percent: b.payment?.depositPercent ?? null,
      deposit_days: b.payment?.depositDays ?? null,
      due_days: b.payment?.dueDays ?? null,
      due_basis: b.payment?.dueBasis ?? null,
    },
  })
  if (error || typeof data !== 'string') return dbFail(error ?? {}, 'Baustein nicht gespeichert')
  refresh(g.tenantId, g.operator)
  return { ok: true, data: { id: data } }
}

// Als Standard setzen (blockId) bzw. Standard aufheben (null). expectedDefaultId: Standard des Blocks beim Laden;
// hat er sich inzwischen geändert, meldet die Datenbank einen Konflikt.
export async function setInvoiceTextBlockDefault(values: {
  tenantId: string
  kind: TextBlockKind
  blockId: string | null
  expectedDefaultId: string | null
}): Promise<Result> {
  if (!TEXT_BLOCKS.includes(values?.kind)) return fail('unknown')
  if (values.blockId !== null && !isId(values.blockId)) return fail('unknown')
  if (values.expectedDefaultId !== null && !isId(values.expectedDefaultId)) return fail('unknown')
  const g = await guard(values.tenantId)
  if (!g.ok) return g

  const supabase = await createClient()
  const { error } = await supabase.rpc('set_invoice_text_block_default', {
    p_tenant_id: g.tenantId,
    p_block: values.kind,
    p_block_id: values.blockId,
    p_expected_default_id: values.expectedDefaultId,
  })
  if (error) return dbFail(error, 'Standard nicht gesetzt')
  refresh(g.tenantId, g.operator)
  return { ok: true }
}

export async function deleteInvoiceTextBlock(values: { tenantId: string; id: string }): Promise<Result> {
  if (!isId(values?.id)) return fail('unknown')
  const g = await guard(values.tenantId)
  if (!g.ok) return g

  const supabase = await createClient()
  const { error } = await supabase.rpc('delete_invoice_text_block', { p_tenant_id: g.tenantId, p_block_id: values.id })
  if (error) return dbFail(error, 'Baustein nicht gelöscht')
  refresh(g.tenantId, g.operator)
  return { ok: true }
}
