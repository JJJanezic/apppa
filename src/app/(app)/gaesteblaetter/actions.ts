'use server'

import type { SupabaseClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

import type { ActionResult, CommonErrorCode } from '@/lib/auth/result'
import { getSessionUser, pendingMfaStep } from '@/lib/auth/session'
import { bookingHref } from '@/lib/bookings'
import { GUEST_SHEET_BUCKET, type GuestSheetErrorCode, guestSheetListHref, type SheetGuestField } from '@/lib/guest-sheet'
import { isMissingRelation } from '@/lib/guest-sheets-data'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext } from '@/lib/tenant'
import {
  sheetCompanionSchema,
  sheetEmailSchema,
  type SheetCompanionInput,
  sheetGuestSchema,
  type SheetGuestInput,
  sheetNumberSchema,
  sheetUploadSchema,
  type SheetUploadInput,
} from '@/lib/validation/guest-sheet'

// Server-Aktionen des Gästeblatts (PROJ-26) für Inhaber und Mitarbeiter des gewählten Kunden.
// Felder auf Seite 1 speichert eine eigene Datenbank-Funktion: Sie erlaubt auch Mitarbeitern genau die Felder des Blatts
// (am Gast, an der Buchung, die Mitreisenden), schützt mit dem Stand vor Überschreiben und vermerkt „Gästeblatt“ im
// Änderungsprotokoll. Das Fertigstellen läuft über /api/gaesteblatt (PDF, Dateien, Schreibschritt nur für den Server).

type ErrorCode = GuestSheetErrorCode | 'ownerOnly' | 'tenantDeactivated' | 'notFound'
type Failure = { ok: false; error: ErrorCode | CommonErrorCode }
const fail = (error: Failure['error']): Failure => ({ ok: false, error })
const key = (k: string) => k
const isId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value)
const untyped = async () => (await createClient()) as unknown as SupabaseClient

const DB_ERRORS: Record<string, ErrorCode> = {
  '42501': 'notFound',
  P0016: 'tenantDeactivated',
  P0973: 'sheetExists',
  P0974: 'incomplete',
  P0976: 'notExpected',
  P0977: 'noGuest',
  P0978: 'guestAnonymized',
  P0979: 'tooManyCompanions',
  P0980: 'pdfInvalid',
}

function dbFail(error: { code?: string; message?: string }, context: string, stale: ErrorCode = 'staleBooking'): Failure {
  if (isMissingRelation(error)) return fail('notImplemented')
  // Stand weicht ab (jemand anderes hat inzwischen gespeichert)
  if (error.code === 'P0975') return fail(stale)
  const mapped = error.code ? DB_ERRORS[error.code] : undefined
  if (!mapped) console.error(`[gaesteblatt] ${context}`, error.code, error.message)
  return fail(mapped ?? 'unknown')
}

async function requireMember(): Promise<{ ok: true; tenantId: string } | Failure> {
  const user = await getSessionUser()
  if (!user || (await pendingMfaStep(user))) return fail('sessionExpired')
  const { active } = await getTenantContext()
  if (!active) return fail('unknown')
  return { ok: true, tenantId: active.id }
}

// tenantId: der Kunde, für den das Blatt geöffnet wurde; ein Kundenwechsel in einem anderen Tab ändert ihn nicht
async function requireTenant(tenantId: unknown): Promise<{ ok: true; tenantId: string } | Failure> {
  const guard = await requireMember()
  if (!guard.ok) return guard
  if (guard.tenantId !== tenantId) return fail('unknown')
  return guard
}

const revalidate = (bookingId: string) => {
  revalidatePath(bookingHref(bookingId))
  revalidatePath(guestSheetListHref)
}

// ---- Seite 1: einzelne Felder ------------------------------------------------------------------------

const GUEST_COLUMNS: Record<SheetGuestField | 'email', string> = {
  lastName: 'last_name',
  firstName: 'first_name',
  gender: 'gender',
  birthDate: 'birth_date',
  country: 'country',
  documentType: 'document_type',
  documentNumber: 'document_number',
  documentIssuedOn: 'document_issued_on',
  documentAuthority: 'document_authority',
  documentCountry: 'document_country',
  street: 'street',
  postalCode: 'postal_code',
  city: 'city',
  addressCountry: 'address_country',
  documentFrontPath: 'document_front_path',
  documentBackPath: 'document_back_path',
  // nur auf Seite 2 und nur, solange der Gast keine E-Mail hat (prüft die Datenbank)
  email: 'email',
}

// Ein oder mehrere Felder des Hauptgasts (das Reisedokument zusammen, PLZ mit Ort und Herkunftsland). Antwort: neuer Stand.
export async function saveSheetGuest(input: {
  tenantId: string
  bookingId: string
  updatedAt: string
  values: Partial<SheetGuestInput & { email: string }>
}): Promise<ActionResult<{ updatedAt: string }, ErrorCode>> {
  const guard = await requireTenant(input?.tenantId)
  if (!guard.ok) return guard
  if (!isId(input.bookingId) || typeof input.updatedAt !== 'string' || !input.values || typeof input.values !== 'object') return fail('unknown')
  const fields = Object.keys(input.values) as (SheetGuestField | 'email')[]
  if (fields.length === 0 || fields.some((f) => !(f in GUEST_COLUMNS))) return fail('unknown')
  const schema = sheetGuestSchema(key).extend({ email: sheetEmailSchema(key) })
  const parsed = schema.pick(Object.fromEntries(fields.map((f) => [f, true])) as never).safeParse(input.values)
  if (!parsed.success) return fail('unknown')
  const values = Object.fromEntries(Object.entries(parsed.data as Record<string, unknown>).map(([f, v]) => [GUEST_COLUMNS[f as SheetGuestField | 'email'], v]))

  const supabase = await untyped()
  const { data, error } = await supabase.rpc('save_guest_sheet_field', {
    p_booking_id: input.bookingId,
    p_target: 'guest',
    p_values: values,
    p_expected_updated_at: input.updatedAt,
  })
  if (error) return dbFail(error, 'Gastfeld speichern', 'staleGuest')
  revalidate(input.bookingId)
  return { ok: true, data: { updatedAt: data as string } }
}

// Lfd.-Nr. = Gästeblattnummer der Buchung (PROJ-30)
export async function saveSheetNumber(input: {
  tenantId: string
  bookingId: string
  updatedAt: string
  value: string
}): Promise<ActionResult<{ updatedAt: string }, ErrorCode>> {
  const guard = await requireTenant(input?.tenantId)
  if (!guard.ok) return guard
  if (!isId(input.bookingId) || typeof input.updatedAt !== 'string') return fail('unknown')
  const parsed = sheetNumberSchema(key).safeParse(input.value)
  if (!parsed.success) return fail('sheetNumberTooLong')
  const supabase = await untyped()
  const { data, error } = await supabase.rpc('save_guest_sheet_field', {
    p_booking_id: input.bookingId,
    p_target: 'booking',
    p_values: { guest_sheet_number: parsed.data },
    p_expected_updated_at: input.updatedAt,
  })
  if (error) return dbFail(error, 'Lfd.-Nr. speichern')
  revalidate(input.bookingId)
  return { ok: true, data: { updatedAt: data as string } }
}

// Mitreisende der Buchung; „Von der Ortstaxe befreit“ (PROJ-15) kommt unverändert mit
export async function saveSheetCompanions(input: {
  tenantId: string
  bookingId: string
  updatedAt: string
  companions: (SheetCompanionInput & { taxExempt: boolean })[]
}): Promise<ActionResult<{ updatedAt: string }, ErrorCode>> {
  const guard = await requireTenant(input?.tenantId)
  if (!guard.ok) return guard
  if (!isId(input.bookingId) || typeof input.updatedAt !== 'string' || !Array.isArray(input.companions)) return fail('unknown')
  const schema = sheetCompanionSchema(key)
  const companions = []
  for (const c of input.companions) {
    const parsed = schema.safeParse(c)
    if (!parsed.success || typeof c.taxExempt !== 'boolean') return fail('unknown')
    companions.push({ last_name: parsed.data.lastName, first_name: parsed.data.firstName, birth_date: parsed.data.birthDate, tourist_tax_exempt: c.taxExempt })
  }
  const supabase = await untyped()
  const { data, error } = await supabase.rpc('save_guest_sheet_field', {
    p_booking_id: input.bookingId,
    p_target: 'companions',
    p_values: { companions },
    p_expected_updated_at: input.updatedAt,
  })
  if (error) return dbFail(error, 'Mitreisende speichern')
  revalidate(input.bookingId)
  return { ok: true, data: { updatedAt: data as string } }
}

// ---- Altes Gästeblatt hochladen ----------------------------------------------------------------------

// Speicherort im Ordner des gewählten Kunden; eingetragen wird die Datei erst mit registerGuestSheetUpload
export async function prepareGuestSheetUpload(): Promise<ActionResult<{ path: string; token: string }, ErrorCode>> {
  const guard = await requireMember()
  if (!guard.ok) return guard
  const path = `${guard.tenantId}/${crypto.randomUUID()}.pdf`
  const supabase = await createClient()
  const { data, error } = await supabase.storage.from(GUEST_SHEET_BUCKET).createSignedUploadUrl(path)
  if (error || !data) {
    // Speicherbereich fehlt noch (Migration nicht eingespielt)
    if (error && /not found/i.test(error.message)) return fail('notImplemented')
    console.error('[gaesteblatt] Upload nicht vorbereitet', error?.message)
    return fail('unknown')
  }
  return { ok: true, data: { path: data.path, token: data.token } }
}

export async function registerGuestSheetUpload(input: {
  bookingId: string
  path: string
  values: SheetUploadInput
  // Blatt, das beim Öffnen des Dialogs aktuell war (null = keines); sonst „inzwischen gespeichert“
  previousSheetId: string | null
}): Promise<ActionResult<undefined, ErrorCode>> {
  const guard = await requireMember()
  if (!guard.ok) return guard
  if (!isId(input?.bookingId) || typeof input.path !== 'string' || !input.path.startsWith(`${guard.tenantId}/`)) return fail('unknown')
  if (input.previousSheetId !== null && !isId(input.previousSheetId)) return fail('unknown')
  const parsed = sheetUploadSchema(key).safeParse(input.values)
  if (!parsed.success) return fail('unknown')
  const supabase = await untyped()
  const { error } = await supabase.rpc('register_guest_sheet_upload', {
    p_input: {
      booking_id: input.bookingId,
      pdf_path: input.path,
      sheet_number: parsed.data.sheetNumber,
      signed_on: parsed.data.signedOn,
      marketing_consent: parsed.data.marketingConsent,
      previous_sheet_id: input.previousSheetId,
    },
  })
  if (error) return dbFail(error, 'Hochladen eintragen')
  revalidate(input.bookingId)
  return { ok: true }
}
