'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import type { ActionResult, CommonErrorCode } from '@/lib/auth/result'
import { getSessionUser, pendingMfaStep } from '@/lib/auth/session'
import {
  type Company,
  COMPANY_LIST,
  COMPANY_MERGE_FIELDS,
  COMPANY_SEARCH_LIMIT,
  COMPANY_SEARCH_MIN_CHARS,
  type CompanyErrorCode,
  type CompanyMergeChoice,
  type CompanyRow,
  companyHref,
} from '@/lib/companies'
import { COMPANY_COLUMNS, type CompanyListDb, companyListRow, toCompany } from '@/lib/companies-data'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext, type TenantSummary } from '@/lib/tenant'
import { companyDbColumns, type CompanyInput, companySchema } from '@/lib/validation/companies'

// Server-Aktionen der Firmenliste (PROJ-50). Lesen und Suchen: alle Mitglieder; Anlegen, Ändern, Löschen, Zusammenführen
// und Dubletten: nur Inhaber. Mitarbeiter legen Firmen nur zusammen mit einer Buchung mit neuem Gast an (PROJ-8).
// Die Datenbank-Regeln (RLS, Funktionen mit Rollenprüfung) entscheiden zusätzlich.

type Result<T = undefined> = ActionResult<T, CompanyErrorCode>
type Failure = { ok: false; error: CompanyErrorCode | CommonErrorCode }
type DbError = { code?: string; message?: string }

const key = (k: string) => k
const fail = (error: CompanyErrorCode | CommonErrorCode): Failure => ({ ok: false, error })
const isId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value)

async function requireMember(): Promise<{ ok: true; tenant: TenantSummary } | Failure> {
  const user = await getSessionUser()
  if (!user || (await pendingMfaStep(user))) return fail('sessionExpired')
  const { active } = await getTenantContext()
  if (!active) return fail('unknown')
  return { ok: true, tenant: active }
}

async function requireOwner(): Promise<{ ok: true; tenant: TenantSummary } | Failure> {
  const guard = await requireMember()
  if (!guard.ok) return guard
  return guard.tenant.role === 'owner' ? guard : fail('ownerOnly')
}

// Fehler der Datenbank → Meldung (Codes wie bei Gästen, siehe Migration der Firmenliste)
function dbFail(error: DbError, context: string): Failure {
  switch (error.code) {
    case 'P0701':
    case '42501':
      return fail('ownerOnly')
    case 'P0702':
    case 'P0707':
      return fail('notFound')
    case 'P0704':
      return fail('mergeInvalid')
  }
  console.error(`[firmen] ${context}`, error.code, error.message)
  return fail('unknown')
}

// Firmenliste, Firmendetail und Gästeliste (Firmenname, Anzahl Gäste) neu laden
const revalidate = () => revalidatePath('/gaeste', 'layout')

// Nach dem Anlegen zur Detailseite: Weiterleitung in der Aktion statt router.push (siehe Buchungen)
export async function createCompany(values: CompanyInput): Promise<Result<{ id: string }>> {
  const parsed = companySchema(key).safeParse(values)
  if (!parsed.success) return fail('unknown')
  const guard = await requireOwner()
  if (!guard.ok) return guard
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('companies')
    .insert({ tenant_id: guard.tenant.id, ...companyDbColumns(parsed.data) })
    .select('id')
    .single()
  if (error || !data) return dbFail(error ?? {}, 'Firma nicht angelegt')
  revalidate()
  redirect(companyHref(data.id))
}

// updatedAt: Stand beim Öffnen des Formulars. Wurde die Firma seitdem geändert → „staleCompany“
export async function updateCompany(values: { id: string; updatedAt: string } & CompanyInput): Promise<Result> {
  const parsed = companySchema(key).safeParse(values)
  if (!isId(values?.id) || typeof values?.updatedAt !== 'string' || !parsed.success) return fail('unknown')
  const guard = await requireOwner()
  if (!guard.ok) return guard
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('companies')
    .update(companyDbColumns(parsed.data))
    .eq('id', values.id)
    .eq('tenant_id', guard.tenant.id)
    .eq('updated_at', values.updatedAt)
    .select('id')
  if (error) return dbFail(error, 'Firma nicht geändert')
  if (!data?.length) {
    const { data: current } = await supabase.from('companies').select('id').eq('id', values.id).eq('tenant_id', guard.tenant.id).maybeSingle()
    return fail(current ? 'staleCompany' : 'notFound')
  }
  revalidate()
  return { ok: true }
}

// Endgültig löschen; verknüpfte Gäste haben danach keine Firma mehr (die Datenbank leert die Verknüpfung)
export async function deleteCompany(values: { id: string }): Promise<Result> {
  if (!isId(values?.id)) return fail('unknown')
  const guard = await requireOwner()
  if (!guard.ok) return guard
  const supabase = await createClient()
  const { error } = await supabase.rpc('delete_company', { p_company_id: values.id })
  if (error) return dbFail(error, 'Firma nicht gelöscht')
  // Nichts neu laden: die Detailseite würde sonst „Seite nicht gefunden“ zeigen; die Oberfläche lädt die Liste frisch
  return { ok: true, redirectTo: `${COMPANY_LIST}?geloescht=1` }
}

// keepId bleibt mit den gewählten Werten, removeId wird gelöscht (ihre Gäste gehen auf keepId über)
export async function mergeCompanies(values: { keepId: string; removeId: string; choice: CompanyMergeChoice }): Promise<Result> {
  const choice = values?.choice
  const validChoice = choice && typeof choice === 'object' && COMPANY_MERGE_FIELDS.every((f) => choice[f] === 'a' || choice[f] === 'b')
  if (!isId(values?.keepId) || !isId(values?.removeId) || !validChoice) return fail('unknown')
  if (values.keepId === values.removeId) return fail('mergeInvalid')
  const guard = await requireOwner()
  if (!guard.ok) return guard
  const supabase = await createClient()
  const cleanChoice = Object.fromEntries(COMPANY_MERGE_FIELDS.map((f) => [f, choice[f]]))
  const { error } = await supabase.rpc('merge_companies', { p_keep: values.keepId, p_remove: values.removeId, p_choice: cleanChoice })
  if (error) return dbFail(error, 'Zusammenführen fehlgeschlagen')
  revalidate()
  return { ok: true }
}

// „Keine doppelte Firma“: Vorschlag dauerhaft ausblenden
export async function dismissCompanyDuplicate(values: { aId: string; bId: string }): Promise<Result> {
  if (!isId(values?.aId) || !isId(values?.bId) || values.aId === values.bId) return fail('unknown')
  const guard = await requireOwner()
  if (!guard.ok) return guard
  // Paar in fester Reihenfolge (wie in der Datenbank verlangt)
  const [a, b] = [values.aId, values.bId].sort()
  const supabase = await createClient()
  const { error } = await supabase.from('company_duplicate_dismissals').insert({ tenant_id: guard.tenant.id, company_a: a, company_b: b })
  // Schon abgelehnt (z. B. Doppelklick): kein Fehler
  if (error && error.code !== '23505') return dbFail(error, 'Vorschlag nicht ausgeblendet')
  revalidate()
  return { ok: true }
}

// Firmensuche nach Name oder UID (Gastformular „Bestehende Firma“, Zusammenführen), alle Mitglieder
export async function searchCompanies(values: { query: string; excludeId?: string }): Promise<Result<CompanyRow[]>> {
  const guard = await requireMember()
  if (!guard.ok) return guard
  const query = String(values?.query ?? '').slice(0, 200)
  if (query.trim().length < COMPANY_SEARCH_MIN_CHARS) return { ok: true, data: [] }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('company_list', {
    p_tenant_id: guard.tenant.id,
    p_query: query,
    p_exclude_id: isId(values?.excludeId) ? values.excludeId : undefined,
    p_limit: COMPANY_SEARCH_LIMIT,
    p_offset: 0,
  })
  if (error) return dbFail(error, 'Firmensuche')
  return { ok: true, data: ((data ?? []) as CompanyListDb[]).map(companyListRow) }
}

// Firmen mit gleichem Namen (Schreibung, Umlaute, Rand-Leerzeichen egal) für den Hinweis bei „Neue Firma“
export async function findSameNameCompanies(values: { name: string }): Promise<Result<CompanyRow[]>> {
  const guard = await requireMember()
  if (!guard.ok) return guard
  const name = String(values?.name ?? '').trim().slice(0, 200)
  if (!name) return { ok: true, data: [] }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('company_list', {
    p_tenant_id: guard.tenant.id,
    p_exact_name: name,
    p_limit: COMPANY_SEARCH_LIMIT,
    p_offset: 0,
  })
  if (error) return dbFail(error, 'Gleichnamige Firmen')
  return { ok: true, data: ((data ?? []) as CompanyListDb[]).map(companyListRow) }
}

// Vollständige Angaben einer Firma (zweite Firma im Zusammenführen-Dialog), nur Inhaber
export async function loadCompany(values: { id: string }): Promise<Result<Company>> {
  if (!isId(values?.id)) return fail('unknown')
  const guard = await requireOwner()
  if (!guard.ok) return guard
  const supabase = await createClient()
  const [{ data, error }, guests] = await Promise.all([
    supabase.from('companies').select(COMPANY_COLUMNS).eq('id', values.id).eq('tenant_id', guard.tenant.id).maybeSingle(),
    supabase.from('guests').select('id', { count: 'exact', head: true }).eq('tenant_id', guard.tenant.id).eq('company_id', values.id),
  ])
  if (error) return dbFail(error, 'Firma nicht lesbar')
  if (!data) return fail('notFound')
  return { ok: true, data: toCompany(data, guests.count ?? 0) }
}
