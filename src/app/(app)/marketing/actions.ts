'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import type { ActionResult, CommonErrorCode } from '@/lib/auth/result'
import { getSessionUser, pendingMfaStep } from '@/lib/auth/session'
import { MARKETING_PATH, type MarketingErrorCode, marketingHref, parseSegmentFilters } from '@/lib/marketing'
import { filtersPayload, isMissingRelation } from '@/lib/marketing-data'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext } from '@/lib/tenant'
import { segmentNameSchema } from '@/lib/validation/marketing'

// Segmente der Seite „Marketing“ (PROJ-52), nur Inhaber des gewählten Kunden. Geschrieben wird direkt in die Tabelle
// marketing_segments; die Zugriffsregeln lassen nur Inhaber zu, die Datenbank prüft den eindeutigen Namen je Kunde.
// Ändern und Umbenennen nur, wenn das Segment seit dem Laden unverändert ist (updated_at). Nach Anlegen und Löschen leitet die
// Aktion selbst weiter (redirect): router.push nach einer Server-Aktion geht in Next 16 sporadisch verloren.

type Result<T = undefined> = ActionResult<T, MarketingErrorCode>
type Failure = { ok: false; error: MarketingErrorCode | CommonErrorCode }
const fail = (error: MarketingErrorCode | CommonErrorCode): Failure => ({ ok: false, error })
const key = (k: string) => k
const isId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value)
const untyped = async () => (await createClient()) as unknown as SupabaseClient

const DB_ERRORS: Record<string, MarketingErrorCode> = {
  '42501': 'ownerOnly',
  // eindeutiger Name je Kunde (ohne Groß-/Kleinschreibung)
  '23505': 'nameTaken',
  P0016: 'tenantDeactivated',
}

function dbFail(error: { code?: string; message?: string }, context: string): Failure {
  if (isMissingRelation(error)) return fail('notImplemented')
  const mapped = error.code ? DB_ERRORS[error.code] : undefined
  if (!mapped) console.error(`[marketing] ${context}`, error.code, error.message)
  return fail(mapped ?? 'unknown')
}

async function requireOwner(): Promise<{ ok: true; tenantId: string } | Failure> {
  const user = await getSessionUser()
  if (!user || (await pendingMfaStep(user))) return fail('sessionExpired')
  const { active } = await getTenantContext()
  if (!active) return fail('unknown')
  return active.role === 'owner' ? { ok: true, tenantId: active.id } : fail('ownerOnly')
}

function parseName(name: unknown): { ok: true; name: string } | Failure {
  const parsed = segmentNameSchema(key).safeParse({ name })
  if (parsed.success) return { ok: true, name: parsed.data.name }
  return fail(parsed.error.issues[0]?.message === 'nameTooLong' ? 'nameTooLong' : 'nameRequired')
}

// Kein Treffer beim Ändern: gelöscht oder inzwischen von jemand anderem geändert?
async function staleReason(supabase: SupabaseClient, id: string, tenantId: string): Promise<Failure> {
  const { data } = await supabase.from('marketing_segments').select('id').eq('id', id).eq('tenant_id', tenantId).maybeSingle()
  return fail(data ? 'segmentChanged' : 'segmentGone')
}

type Saved = { id: string; updated_at: string }

// Neues Segment mit den aktuellen Filtern
export async function createSegment(input: { name: string; filters: unknown }): Promise<Result> {
  const guard = await requireOwner()
  if (!guard.ok) return guard
  const name = parseName(input?.name)
  if (!name.ok) return name
  const filters = parseSegmentFilters(input.filters)
  const supabase = await untyped()
  const { data, error } = await supabase
    .from('marketing_segments')
    .insert({ tenant_id: guard.tenantId, name: name.name, filters: filtersPayload(filters) })
    .select('id')
    .single()
  if (error) return dbFail(error, 'Segment anlegen')
  revalidatePath(MARKETING_PATH)
  // Das neue Segment ist danach geöffnet
  redirect(marketingHref({ ...filters, segment: (data as { id: string }).id }))
}

// Filter eines Segments überschreiben („Segment aktualisieren“)
export async function updateSegmentFilters(input: { id: string; filters: unknown; updatedAt: string }): Promise<Result> {
  const guard = await requireOwner()
  if (!guard.ok) return guard
  if (!isId(input?.id) || typeof input.updatedAt !== 'string') return fail('unknown')
  const supabase = await untyped()
  const { data, error } = await supabase
    .from('marketing_segments')
    .update({ filters: filtersPayload(parseSegmentFilters(input.filters)) })
    .eq('id', input.id)
    .eq('tenant_id', guard.tenantId)
    .eq('updated_at', input.updatedAt)
    .select('id, updated_at')
  if (error) return dbFail(error, 'Segment aktualisieren')
  if (!(data as Saved[] | null)?.length) return staleReason(supabase, input.id, guard.tenantId)
  revalidatePath(MARKETING_PATH)
  return { ok: true }
}

export async function renameSegment(input: { id: string; name: string; updatedAt: string }): Promise<Result> {
  const guard = await requireOwner()
  if (!guard.ok) return guard
  if (!isId(input?.id) || typeof input.updatedAt !== 'string') return fail('unknown')
  const name = parseName(input.name)
  if (!name.ok) return name
  const supabase = await untyped()
  const { data, error } = await supabase
    .from('marketing_segments')
    .update({ name: name.name })
    .eq('id', input.id)
    .eq('tenant_id', guard.tenantId)
    .eq('updated_at', input.updatedAt)
    .select('id, updated_at')
  if (error) return dbFail(error, 'Segment umbenennen')
  if (!(data as Saved[] | null)?.length) return staleReason(supabase, input.id, guard.tenantId)
  revalidatePath(MARKETING_PATH)
  return { ok: true }
}

// Löschen betrifft keine Gäste; ein bereits gelöschtes Segment gilt als erledigt. Danach bleiben die Filter ohne Segment stehen.
export async function deleteSegment(input: { id: string; filters: unknown }): Promise<Result> {
  const guard = await requireOwner()
  if (!guard.ok) return guard
  if (!isId(input?.id)) return fail('unknown')
  const supabase = await untyped()
  const { error } = await supabase.from('marketing_segments').delete().eq('id', input.id).eq('tenant_id', guard.tenantId)
  if (error) return dbFail(error, 'Segment löschen')
  revalidatePath(MARKETING_PATH)
  redirect(marketingHref(parseSegmentFilters(input.filters)))
}
