'use server'

import type { ActionResult, CommonErrorCode } from '@/lib/auth/result'
import { getSessionUser, pendingMfaStep } from '@/lib/auth/session'
import {
  duplicateReasons,
  type DuplicateMatch,
  type Guest,
  type GuestErrorCode,
  type GuestRow,
  guestSortName,
  MERGE_FIELDS,
  type MergeChoice,
  phoneDigits,
  searchKey,
} from '@/lib/guests'
import { sampleGuests, toRow } from '@/lib/guests-data'
import { getTenantContext, type TenantSummary } from '@/lib/tenant'
import { guestSchema, type GuestInput } from '@/lib/validation/guests'

// Server-Aktionen der Gäste-Datenbank (PROJ-7). Lesen: alle Mitglieder; Anlegen, Ändern, Zusammenführen und
// Löschen: nur Inhaber (Mitarbeiter legen Gäste nur zusammen mit einer Buchung an, PROJ-8).
// VORLÄUFIG bis /backend: Schreibende Aktionen prüfen Rolle und Eingaben und melden „wird eingerichtet“;
// Suche und Dublettenprüfung arbeiten auf den Beispielgästen aus src/lib/guests-data.ts.

type Result<T = undefined> = ActionResult<T, GuestErrorCode>
type Failure = { ok: false; error: GuestErrorCode | CommonErrorCode }

const key = (k: string) => k
const fail = (error: GuestErrorCode | CommonErrorCode): Failure => ({ ok: false, error })
const isId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value)
const SEARCH_LIMIT = 10

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

// Mögliche Doppeleinträge vor dem Anlegen (Warnung mit „Bestehenden Gast öffnen“ / „Trotzdem anlegen“)
export async function checkGuestDuplicates(values: GuestInput): Promise<Result<DuplicateMatch[]>> {
  const parsed = guestSchema(key).safeParse(values)
  if (!parsed.success) return fail('unknown')
  const guard = await requireOwner()
  if (!guard.ok) return guard
  const v = parsed.data
  const matches = sampleGuests()
    .filter((g) => !g.anonymizedAt)
    .map((g) => ({ guest: toRow(g), reasons: duplicateReasons(v, g) }))
    .filter((m) => m.reasons.length > 0)
    .slice(0, 5)
  return { ok: true, data: matches }
}

export async function createGuest(values: GuestInput): Promise<Result<{ id: string }>> {
  const parsed = guestSchema(key).safeParse(values)
  if (!parsed.success) return fail('unknown')
  const guard = await requireOwner()
  if (!guard.ok) return guard
  return fail('notImplemented')
}

// updatedAt: Stand beim Öffnen des Formulars. Wurde der Gast seitdem geändert → „staleGuest“
export async function updateGuest(values: { id: string; updatedAt: string } & GuestInput): Promise<Result> {
  const parsed = guestSchema(key).safeParse(values)
  if (!isId(values?.id) || typeof values?.updatedAt !== 'string' || !parsed.success) return fail('unknown')
  const guard = await requireOwner()
  if (!guard.ok) return guard
  return fail('notImplemented')
}

// Ohne Buchungen endgültig löschen, mit Buchungen anonymisieren (die Datenbank entscheidet)
export async function deleteGuest(values: { id: string }): Promise<Result<{ mode: 'deleted' | 'anonymized' }>> {
  if (!isId(values?.id)) return fail('unknown')
  const guard = await requireOwner()
  if (!guard.ok) return guard
  return fail('notImplemented')
}

// keepId bleibt mit den gewählten Werten, removeId wird entfernt (seine Buchungen gehen auf keepId über)
export async function mergeGuests(values: { keepId: string; removeId: string; choice: MergeChoice }): Promise<Result> {
  const choice = values?.choice
  const validChoice =
    choice && typeof choice === 'object' && MERGE_FIELDS.every((f) => choice[f] === 'a' || choice[f] === 'b')
  if (!isId(values?.keepId) || !isId(values?.removeId) || !validChoice) return fail('unknown')
  if (values.keepId === values.removeId) return fail('mergeInvalid')
  const guard = await requireOwner()
  if (!guard.ok) return guard
  return fail('notImplemented')
}

// „Kein Doppeleintrag“: Vorschlag dauerhaft ausblenden
export async function dismissDuplicate(values: { aId: string; bId: string }): Promise<Result> {
  if (!isId(values?.aId) || !isId(values?.bId) || values.aId === values.bId) return fail('unknown')
  const guard = await requireOwner()
  if (!guard.ok) return guard
  return fail('notImplemented')
}

// Gastsuche (Auswahl des zweiten Gastes beim Zusammenführen; später auch im Buchungsformular, PROJ-8)
export async function searchGuests(values: { query: string; excludeId?: string }): Promise<Result<GuestRow[]>> {
  const guard = await requireMember()
  if (!guard.ok) return guard
  const query = String(values?.query ?? '').slice(0, 200)
  const needle = searchKey(query)
  if (needle.length < 2) return { ok: true, data: [] }
  const digits = phoneDigits(query)
  const rows = sampleGuests()
    .filter((g) => g.id !== values?.excludeId && !g.anonymizedAt)
    .filter(
      (g) =>
        searchKey([g.lastName, g.firstName, g.companyName, g.email].filter(Boolean).join(' ')).includes(needle) ||
        (digits.length >= 3 && phoneDigits(g.phone ?? '').includes(digits))
    )
    .sort((a, b) => guestSortName(a).localeCompare(guestSortName(b), 'de'))
    .slice(0, SEARCH_LIMIT)
    .map(toRow)
  return { ok: true, data: rows }
}

// Vollständige Angaben eines Gastes (zweiter Gast im Zusammenführen-Dialog)
export async function loadGuest(values: { id: string }): Promise<Result<Guest>> {
  if (!isId(values?.id)) return fail('unknown')
  const guard = await requireOwner()
  if (!guard.ok) return guard
  const guest = sampleGuests().find((g) => g.id === values.id)
  return guest ? { ok: true, data: guest } : fail('notFound')
}
