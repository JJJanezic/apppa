'use server'

import type { ActionResult, CommonErrorCode } from '@/lib/auth/result'
import { getSessionUser, pendingMfaStep } from '@/lib/auth/session'
import { type BookingErrorCode, type BookingWarnings, findConflicts, isIsoDate, LIMITS, overCapacity, todayIso } from '@/lib/bookings'
import { getBookableApartments, getOccupancy } from '@/lib/bookings-data'
import { guestSortName } from '@/lib/guests'
import { getTenantContext, type TenantSummary } from '@/lib/tenant'
import {
  type BlockInput,
  blockSchema,
  type BookingInput,
  bookingSchema,
  type CancelInput,
  cancelSchema,
  type CompanionsInput,
  companionsSchema,
} from '@/lib/validation/bookings'
import { type GuestInput, guestSchema } from '@/lib/validation/guests'

// Server-Aktionen der Buchungen (PROJ-8). Anlegen und Ändern: alle Mitglieder (Beträge nur Inhaber);
// Stornieren, Sperren löschen und Übersteuern von Warnungen: nur Inhaber.
// VORLÄUFIG bis /backend: Die Aktionen prüfen Rolle und Eingaben und melden danach „wird eingerichtet“.
// Die Warnungs-Vorschau arbeitet auf den Beispielbuchungen aus src/lib/bookings-data.ts.

type Result<T = undefined> = ActionResult<T, BookingErrorCode>
type Failure = { ok: false; error: BookingErrorCode | CommonErrorCode }

const key = (k: string) => k
const fail = (error: BookingErrorCode | CommonErrorCode): Failure => ({ ok: false, error })
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

type WarningQuery = { id?: string | null; apartmentId: string; arrival: string; departure: string; persons: number }

async function warningsFor(q: WarningQuery): Promise<BookingWarnings> {
  const apartment = (await getBookableApartments()).find((a) => a.id === q.apartmentId)
  const today = todayIso()
  const conflicts = findConflicts(q, await getOccupancy(q.apartmentId), today).map((o) => ({
    id: o.id,
    kind: o.kind,
    number: o.number,
    guestName: o.guest ? guestSortName(o.guest) : null,
    blockReason: o.blockReason,
    arrival: o.arrival,
    departure: o.departure,
  }))
  return {
    conflicts,
    overCapacity: apartment && q.persons > 0 ? overCapacity(q.persons, [], apartment.maxGuests) : null,
  }
}

// Vorschau im Formular: Überschneidungen und Überbelegung, sobald Wohnung und Zeitraum stehen
export async function checkBookingWarnings(values: WarningQuery): Promise<Result<BookingWarnings>> {
  const guard = await requireMember()
  if (!guard.ok) return guard
  if (!isId(values?.apartmentId) || !isIsoDate(String(values.arrival)) || !isIsoDate(String(values.departure))) {
    return { ok: true, data: { conflicts: [], overCapacity: null } }
  }
  if (values.arrival >= values.departure) return { ok: true, data: { conflicts: [], overCapacity: null } }
  const persons = Math.max(0, Math.min(LIMITS.personsMax * 2, Math.floor(Number(values.persons) || 0)))
  return {
    ok: true,
    data: await warningsFor({ id: isId(values.id) ? values.id : null, apartmentId: values.apartmentId, arrival: values.arrival, departure: values.departure, persons }),
  }
}

type SaveBooking = {
  id?: string
  updatedAt?: string
  values: BookingInput
  // Neuer Gast (wenn values.guestMode = „new“)
  newGuest?: GuestInput
  // „Trotzdem speichern“ (zählt nur für Inhaber)
  confirmOverride?: boolean
}

export async function saveBooking(input: SaveBooking): Promise<Result<{ id: string }>> {
  const guard = await requireMember()
  if (!guard.ok) return guard
  const owner = guard.tenant.role === 'owner'
  const parsed = bookingSchema(key, { owner }).safeParse(input?.values)
  if (!parsed.success) return fail('unknown')
  if (input.values.guestMode === 'new' && !guestSchema(key).safeParse(input.newGuest).success) return fail('unknown')
  if (input.id !== undefined && !isId(input.id)) return fail('notFound')

  const v = parsed.data
  const warnings = await warningsFor({
    id: input.id,
    apartmentId: v.apartmentId,
    arrival: v.arrival,
    departure: v.departure,
    persons: v.adults + v.childAges.length,
  })
  const hasWarnings = warnings.conflicts.length > 0 || warnings.overCapacity !== null
  if (hasWarnings && !(owner && input.confirmOverride === true)) return fail(owner ? 'warnings' : 'ownerOnly')
  return fail('notImplemented')
}

export async function saveBlock(input: { id?: string; updatedAt?: string; values: BlockInput; confirmOverride?: boolean }): Promise<Result<{ id: string }>> {
  const guard = await requireMember()
  if (!guard.ok) return guard
  const parsed = blockSchema(key).safeParse(input?.values)
  if (!parsed.success) return fail('unknown')
  if (input.id !== undefined && !isId(input.id)) return fail('notFound')
  const v = parsed.data
  const warnings = await warningsFor({ id: input.id, apartmentId: v.apartmentId, arrival: v.arrival, departure: v.departure, persons: 0 })
  if (warnings.conflicts.length > 0 && !(guard.tenant.role === 'owner' && input.confirmOverride === true)) {
    return fail(guard.tenant.role === 'owner' ? 'warnings' : 'ownerOnly')
  }
  return fail('notImplemented')
}

export async function deleteBlock(input: { id: string }): Promise<Result> {
  const guard = await requireOwner()
  if (!guard.ok) return guard
  if (!isId(input?.id)) return fail('notFound')
  return fail('notImplemented')
}

export async function cancelBooking(input: { id: string; values: CancelInput }): Promise<Result> {
  const guard = await requireOwner()
  if (!guard.ok) return guard
  if (!isId(input?.id)) return fail('notFound')
  if (!cancelSchema(key).safeParse(input.values).success) return fail('unknown')
  return fail('notImplemented')
}

// Option → Buchung (auch eine verfallene, wenn der Zeitraum frei ist); prüft erneut auf Warnungen
export async function confirmOption(input: { id: string; confirmOverride?: boolean }): Promise<Result> {
  const guard = await requireMember()
  if (!guard.ok) return guard
  if (!isId(input?.id)) return fail('notFound')
  return fail('notImplemented')
}

export async function saveCompanions(input: { id: string; updatedAt: string; max: number; values: CompanionsInput }): Promise<Result> {
  const guard = await requireMember()
  if (!guard.ok) return guard
  if (!isId(input?.id)) return fail('notFound')
  const max = Math.max(0, Math.min(LIMITS.personsMax, Math.floor(Number(input.max) || 0)))
  if (!companionsSchema(key, { max }).safeParse(input.values).success) return fail('unknown')
  return fail('notImplemented')
}

// Stornierte und verfallene Einträge: nur Notiz und (Inhaber, storniert) Stornogebühr änderbar
export async function saveBookingNote(input: { id: string; updatedAt: string; note: string; fee?: string }): Promise<Result> {
  const guard = await requireMember()
  if (!guard.ok) return guard
  if (!isId(input?.id)) return fail('notFound')
  if (typeof input.note !== 'string' || input.note.length > LIMITS.noteMax) return fail('unknown')
  if (input.fee !== undefined) {
    if (guard.tenant.role !== 'owner') return fail('ownerOnly')
    if (!cancelSchema(key).safeParse({ reason: '', fee: input.fee }).success) return fail('unknown')
  }
  return fail('notImplemented')
}
