'use server'

import { revalidatePath } from 'next/cache'

import type { ActionResult, CommonErrorCode } from '@/lib/auth/result'
import { getSessionUser, pendingMfaStep } from '@/lib/auth/session'
import { type BlockReason, type BookingErrorCode, type BookingKind, type BookingWarnings, isIsoDate, LIMITS } from '@/lib/bookings'
import { createClient } from '@/lib/supabase/server'
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
// Alle Änderungen laufen im Namen der Person über die geschützten Datenbank-Funktionen
// (supabase/migrations/20261026130000_bookings.sql); deren Fehler werden hier in Meldungen übersetzt.

type Result<T = undefined> = ActionResult<T, BookingErrorCode>
type Failure = { ok: false; error: BookingErrorCode | CommonErrorCode }
type DbError = { code?: string; message?: string }

const key = (k: string) => k
const fail = (error: BookingErrorCode | CommonErrorCode): Failure => ({ ok: false, error })
const isId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value)
const LIST = '/buchungen'

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

// Fehler der Datenbank → Meldung (Codes siehe Migration)
function dbFail(error: DbError, context: string): Failure {
  switch (error.code) {
    case 'P0801':
    case '42501':
      return fail('ownerOnly')
    case 'P0802':
      return fail('notFound')
    case 'P0803':
      return fail('staleBooking')
    case 'P0804':
      return fail('guestAnonymized')
    case 'P0805':
      return fail('notActive')
    case 'P0806':
      return fail('apartmentArchived')
    case 'P0808':
      return fail('tooManyCompanions')
  }
  console.error(`[buchungen] ${context}`, error.code, error.message)
  return fail('unknown')
}

const revalidate = (id?: string) => {
  revalidatePath(LIST)
  if (id) revalidatePath(`${LIST}/${id}`)
  // Aufenthalte in Gästeliste und Gast-Detail
  revalidatePath('/gaeste', 'layout')
}

type DbWarnings = {
  conflicts: { id: string; kind: string; number: string | null; guest_name: string | null; block_reason: string | null; arrival: string; departure: string }[]
  over_capacity: { persons: number; max_guests: number } | null
}

const toWarnings = (w: DbWarnings): BookingWarnings => ({
  conflicts: (w?.conflicts ?? []).map((c) => ({
    id: c.id,
    kind: c.kind as BookingKind,
    number: c.number,
    guestName: c.guest_name,
    blockReason: c.block_reason as BlockReason | null,
    arrival: c.arrival,
    departure: c.departure,
  })),
  overCapacity: w?.over_capacity ? { persons: w.over_capacity.persons, maxGuests: w.over_capacity.max_guests } : null,
})

type SaveResult = { status: 'saved'; id: string } | { status: 'warnings'; warnings: DbWarnings }

// Ergebnis der Speicherfunktionen: gespeichert oder Warnungen (dann wurde nichts gespeichert)
function saved(data: unknown, owner: boolean): Result<{ id: string }> {
  const result = data as SaveResult | null
  if (result?.status === 'saved') return { ok: true, data: { id: result.id } }
  // Inhaber bestätigen die Warnung, Mitarbeiter dürfen nicht übersteuern
  return fail(owner ? 'warnings' : 'ownerOnly')
}

type WarningQuery = { id?: string | null; apartmentId: string; arrival: string; departure: string; persons: number }

// Vorschau im Formular: Überschneidungen und Überbelegung, sobald Wohnung und Zeitraum stehen
export async function checkBookingWarnings(values: WarningQuery): Promise<Result<BookingWarnings>> {
  const guard = await requireMember()
  if (!guard.ok) return guard
  const none = { ok: true as const, data: { conflicts: [], overCapacity: null } }
  if (!isId(values?.apartmentId) || !isIsoDate(String(values.arrival)) || !isIsoDate(String(values.departure))) return none
  if (values.arrival >= values.departure) return none
  const persons = Math.max(0, Math.min(LIMITS.personsMax * 2, Math.floor(Number(values.persons) || 0)))
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('booking_warnings', {
    p_tenant_id: guard.tenant.id,
    p_apartment_id: values.apartmentId,
    p_arrival: values.arrival,
    p_departure: values.departure,
    p_persons: persons,
    p_exclude: isId(values.id) ? values.id : undefined,
  })
  if (error) return dbFail(error, 'Warnungen')
  return { ok: true, data: toWarnings(data as unknown as DbWarnings) }
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
  if (input.id !== undefined && !isId(input.id)) return fail('notFound')
  const v = parsed.data

  let newGuest: Record<string, string | null> | null = null
  if (input.values.guestMode === 'new') {
    const guest = guestSchema(key).safeParse(input.newGuest)
    if (!guest.success) return fail('unknown')
    const g = guest.data
    newGuest = {
      last_name: g.lastName,
      first_name: g.firstName,
      country: g.country,
      email: g.email,
      phone: g.phone,
      language: g.language,
      birth_date: g.birthDate,
      street: g.street,
      postal_code: g.postalCode,
      city: g.city,
      address_country: g.addressCountry,
      marketing_source: g.marketingSource,
      marketing_custom: g.marketingCustom,
      company_name: g.companyName,
      company_vat_id: g.companyVatId,
      company_billing_address: g.companyBillingAddress,
      note: g.note,
    }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('save_booking', {
    p_input: {
      id: input.id ?? null,
      updated_at: input.updatedAt ?? null,
      tenant_id: guard.tenant.id,
      kind: v.kind,
      apartment_id: v.apartmentId,
      arrival: v.arrival,
      departure: v.departure,
      check_in: v.checkIn,
      check_out: v.checkOut,
      guest_id: v.guestId,
      new_guest: newGuest,
      adults: v.adults,
      child_ages: v.childAges,
      option_until: v.optionUntil,
      note: v.note,
      amounts: v.amounts && {
        nights_cents: v.amounts.nightsCents,
        charges: v.amounts.charges.map((c) => ({ label: c.label, amount_cents: c.amountCents })),
      },
    },
    p_confirm: owner && input.confirmOverride === true,
  })
  if (error) return dbFail(error, 'Buchung speichern')
  const result = saved(data, owner)
  if (result.ok) revalidate(result.data?.id)
  return result
}

export async function saveBlock(input: { id?: string; updatedAt?: string; values: BlockInput; confirmOverride?: boolean }): Promise<Result<{ id: string }>> {
  const guard = await requireMember()
  if (!guard.ok) return guard
  const owner = guard.tenant.role === 'owner'
  const parsed = blockSchema(key).safeParse(input?.values)
  if (!parsed.success) return fail('unknown')
  if (input.id !== undefined && !isId(input.id)) return fail('notFound')
  const v = parsed.data
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('save_block', {
    p_input: {
      id: input.id ?? null,
      updated_at: input.updatedAt ?? null,
      tenant_id: guard.tenant.id,
      apartment_id: v.apartmentId,
      arrival: v.arrival,
      departure: v.departure,
      block_reason: v.reason,
      note: v.note,
    },
    p_confirm: owner && input.confirmOverride === true,
  })
  if (error) return dbFail(error, 'Sperre speichern')
  const result = saved(data, owner)
  if (result.ok) revalidate(result.data?.id)
  return result
}

export async function deleteBlock(input: { id: string }): Promise<Result> {
  const guard = await requireOwner()
  if (!guard.ok) return guard
  if (!isId(input?.id)) return fail('notFound')
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('bookings')
    .delete()
    .eq('id', input.id)
    .eq('tenant_id', guard.tenant.id)
    .eq('kind', 'block')
    .select('id')
  if (error) return dbFail(error, 'Sperre löschen')
  if (!data?.length) return fail('notFound')
  revalidatePath(LIST)
  return { ok: true }
}

export async function cancelBooking(input: { id: string; values: CancelInput }): Promise<Result> {
  const guard = await requireOwner()
  if (!guard.ok) return guard
  if (!isId(input?.id)) return fail('notFound')
  const parsed = cancelSchema(key).safeParse(input.values)
  if (!parsed.success) return fail('unknown')
  const supabase = await createClient()
  const { error } = await supabase.rpc('cancel_booking', {
    p_booking_id: input.id,
    p_reason: parsed.data.reason ?? undefined,
    p_fee_cents: parsed.data.fee ?? undefined,
  })
  if (error) return dbFail(error, 'Stornieren')
  revalidate(input.id)
  return { ok: true }
}

// Option → Buchung (auch eine verfallene, wenn der Zeitraum frei ist); prüft erneut auf Warnungen
export async function confirmOption(input: { id: string; confirmOverride?: boolean }): Promise<Result> {
  const guard = await requireMember()
  if (!guard.ok) return guard
  if (!isId(input?.id)) return fail('notFound')
  const owner = guard.tenant.role === 'owner'
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('confirm_option', {
    p_booking_id: input.id,
    p_confirm: owner && input.confirmOverride === true,
  })
  if (error) return dbFail(error, 'Option bestätigen')
  const result = saved(data, owner)
  if (!result.ok) return result
  revalidate(input.id)
  return { ok: true }
}

export async function saveCompanions(input: { id: string; updatedAt: string; values: CompanionsInput }): Promise<Result> {
  const guard = await requireMember()
  if (!guard.ok) return guard
  if (!isId(input?.id)) return fail('notFound')
  // Höchstzahl prüft die Datenbank (Personen minus Hauptgast)
  const parsed = companionsSchema(key, { max: LIMITS.personsMax }).safeParse(input.values)
  if (!parsed.success) return fail('unknown')
  const supabase = await createClient()
  const { error } = await supabase.rpc('save_companions', {
    p_booking_id: input.id,
    p_updated_at: input.updatedAt,
    p_companions: parsed.data.companions.map((c) => ({ first_name: c.firstName, last_name: c.lastName, birth_date: c.birthDate })),
  })
  if (error) return dbFail(error, 'Mitreisende speichern')
  revalidate(input.id)
  return { ok: true }
}

// Stornierte und verfallene Einträge: nur Notiz und (Inhaber, storniert) Stornogebühr änderbar
export async function saveBookingNote(input: { id: string; updatedAt: string; note: string; fee?: string }): Promise<Result> {
  const guard = await requireMember()
  if (!guard.ok) return guard
  if (!isId(input?.id)) return fail('notFound')
  if (typeof input.note !== 'string' || input.note.length > LIMITS.noteMax) return fail('unknown')
  let fee: number | null = null
  if (input.fee !== undefined) {
    if (guard.tenant.role !== 'owner') return fail('ownerOnly')
    const parsed = cancelSchema(key).safeParse({ reason: '', fee: input.fee })
    if (!parsed.success) return fail('unknown')
    fee = parsed.data.fee
  }
  const supabase = await createClient()
  const { error } = await supabase.rpc('save_booking_note', {
    p_booking_id: input.id,
    p_updated_at: input.updatedAt,
    p_note: input.note,
    p_set_fee: input.fee !== undefined,
    p_fee_cents: fee ?? undefined,
  })
  if (error) return dbFail(error, 'Notiz speichern')
  revalidate(input.id)
  return { ok: true }
}
