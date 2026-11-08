'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { apartmentLabel } from '@/lib/apartments'
import type { ActionResult, CommonErrorCode } from '@/lib/auth/result'
import { getSessionUser, pendingMfaStep } from '@/lib/auth/session'
import { bookingHref, type BookingSource, todayIso } from '@/lib/bookings'
import { billableCents, lineSourceToDb, partialLabel, splitByVat } from '@/lib/invoice-drafts'
import { currentFingerprint, getDraftBooking, getInvoiceButtonStates } from '@/lib/invoice-drafts-data'
import { guestCompanyPayload, guestDbColumns } from '@/lib/guests-data'
import { removeInvoiceFiles } from '@/lib/invoice-files'
import {
  bookingGuestName,
  cleanInvoiceQuery,
  type DraftBookingOption,
  INVOICE_BUCKET,
  type InvoiceBookingDetails,
  type InvoiceBookingOption,
  type InvoiceErrorCode,
  invoiceHref,
} from '@/lib/invoices'
import { isPlatformSource } from '@/lib/payments'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext, type TenantSummary } from '@/lib/tenant'
import { type GuestInput, guestSchema } from '@/lib/validation/guests'
import { type DraftInput, draftSchema } from '@/lib/validation/invoice-drafts'
import { type InvoiceInput, invoiceSchema } from '@/lib/validation/invoices'
import { type AlreadyPaidInput, alreadyPaidSchema } from '@/lib/validation/payments'
import { VAT_DEFAULTS, vatRateFromDb, vatRateToDb } from '@/lib/vat'

// Server-Aktionen der Rechnungen (PROJ-37 nacherfassen, PROJ-40 Entwürfe). Anlegen, Ändern, Löschen und PDF-Upload:
// nur Inhaber. Alle Änderungen laufen im Namen der Person über die geschützten Datenbank-Funktionen save_invoice,
// delete_invoice, save_invoice_draft und delete_invoice_draft; die Datenbank prüft Rolle, Schalter, Mandant, Nummer,
// Datum, Positionen, Summenregel und Texte selbst.

type Result<T = undefined> = ActionResult<T, InvoiceErrorCode>
type Failure = { ok: false; error: InvoiceErrorCode | CommonErrorCode }
type DbError = { code?: string; message?: string; details?: string }

const key = (k: string) => k
const fail = (error: InvoiceErrorCode | CommonErrorCode): Failure => ({ ok: false, error })
const isId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value)
const LIST = '/rechnungen'
const SEARCH_LIMIT = 20

async function requireOwner(): Promise<{ ok: true; tenant: TenantSummary } | Failure> {
  const user = await getSessionUser()
  if (!user || (await pendingMfaStep(user))) return fail('sessionExpired')
  const { active } = await getTenantContext()
  if (!active) return fail('unknown')
  return active.role === 'owner' ? { ok: true, tenant: active } : fail('ownerOnly')
}

// Fehler der Datenbank → Meldung (Codes siehe Migration der Rechnungen)
function dbFail(error: DbError, context: string): Failure {
  switch (error.code) {
    case 'P0901':
    case '42501':
      return fail('ownerOnly')
    case 'P0902':
      return fail('notFound')
    case 'P0903':
      return fail('staleInvoice')
    case 'P0904':
      return fail('numberTaken')
    case 'P0905':
      return fail('backfillDisabled')
    case 'P0906':
      return fail('dateInFuture')
    case 'P0907':
      return fail('pdfMissing')
    case 'P0908':
      return fail('bookingInvalid')
    case 'P0909':
      return fail('guestInvalid')
    case 'P0804':
      return fail('guestAnonymized')
    case 'P0016':
      return fail('tenantDeactivated')
    // neuer Gast: Ausweisbild fehlt im Speicher oder gehört schon einem anderen Gast (PROJ-29)
    case 'P0705':
      return fail('documentImageMissing')
    // PROJ-50: gewählte Firma des neuen Gastes gibt es nicht mehr
    case 'P0707':
      return fail('companyMissing')
    // Entwurf (PROJ-40): nichts mehr zu verrechnen (Sperre, Storno ohne Gebühr, Summenregel beim Anlegen)
    case 'P0920':
      return fail('nothingToBill')
    case 'P0921':
      return fail('deductionInvalid')
    case 'P0922':
      return fail('contentInvalid')
    case 'P0923':
      return fail('notDraft')
    // Ausgestellte Schlussrechnung zieht diese nacherfasste Rechnung ab (PROJ-42)
    case 'P0933':
      return fail('deductedByIssued')
    // Zahlungen hängen an der Rechnung (PROJ-45): erst umhängen oder löschen
    case 'P0961':
      return fail('invoiceHasPayments')
    // „Bereits bezahlt“ (PROJ-45): Datum, Zahlungsart oder Beträge der Zahlung ungültig
    case 'P0955':
    case 'P0956':
    case 'P0957':
    case 'P0958':
      return fail('alreadyPaidInvalid')
  }
  console.error(`[rechnungen] ${context}`, error.code, error.message)
  return fail('unknown')
}

const revalidate = (input: { id?: string; bookingIds?: (string | null | undefined)[] }) => {
  revalidatePath(LIST)
  if (input.id) revalidatePath(`${LIST}/${input.id}`)
  // Abschnitt „Rechnungen“ im Buchungsdetail und im Kalender-Panel
  for (const b of new Set(input.bookingIds ?? [])) if (b) revalidatePath(`/buchungen/${b}`)
  // Spalte „Rechnungen“ und Filter „Rechnung“ der Buchungsübersicht
  revalidatePath('/buchungen')
  revalidatePath('/belegung')
}

// Doppelte Nummer: Datum der vorhandenen Rechnung für die Meldung „Rechnung vom …“
export type SaveInvoiceResult = Result<{ id: string }> & { takenDate?: string; deductedBy?: string }

type SaveInvoice = {
  id?: string
  updatedAt?: string
  values: InvoiceInput
  // Neuer Gast (wenn values.guestMode = „new“)
  newGuest?: GuestInput
  // „Bereits bezahlt“ (PROJ-45, nur beim Anlegen): Zahlung über den vollen Betrag im selben Datenbankschritt
  alreadyPaid?: AlreadyPaidInput
}

type SaveDbResult = { id: string; unused_pdf: string | null; previous_booking_id?: string | null }

export async function saveInvoice(input: SaveInvoice): Promise<SaveInvoiceResult> {
  const guard = await requireOwner()
  if (!guard.ok) return guard
  const parsed = invoiceSchema(key, { today: todayIso() }).safeParse(input?.values)
  if (!parsed.success) return fail('unknown')
  if (input.id !== undefined && (!isId(input.id) || typeof input.updatedAt !== 'string')) return fail('notFound')
  const v = parsed.data

  let newGuest: (ReturnType<typeof guestDbColumns> & ReturnType<typeof guestCompanyPayload>) | null = null
  if (v.guestMode === 'new') {
    const guest = guestSchema(key).safeParse(input.newGuest)
    if (!guest.success) return fail('unknown')
    newGuest = { ...guestDbColumns(guest.data), ...guestCompanyPayload(guest.data.company) }
  }

  let alreadyPaid: { paid_on: string; method_id: string; commission_cents: number; fee_cents: number } | null = null
  if (input.alreadyPaid && input.id === undefined) {
    const paid = alreadyPaidSchema(key, { today: todayIso() }).safeParse(input.alreadyPaid)
    if (!paid.success) return fail('unknown')
    alreadyPaid = { paid_on: paid.data.paidOn, method_id: paid.data.methodId, commission_cents: paid.data.commission, fee_cents: paid.data.fee }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('save_invoice', {
    p_input: {
      id: input.id ?? null,
      updated_at: input.updatedAt ?? null,
      tenant_id: guard.tenant.id,
      number: v.number,
      invoice_date: v.invoiceDate,
      booking_id: v.bookingId,
      guest_id: v.guestId,
      new_guest: newGuest,
      recipient: v.recipient,
      small_business: v.smallBusiness,
      // Reihenfolge = Position; Sätze als exakte Dezimalzahl („10.00“), Gesamtbetrag bildet die Datenbank
      lines: v.lines.map((l) => ({ label: l.label, amount_cents: l.amountCents, vat_rate: vatRateToDb(l.vatBp) })),
      pdf_path: v.pdfPath,
      ...(alreadyPaid ? { already_paid: alreadyPaid } : {}),
    },
  })
  if (error) {
    const failure = dbFail(error, 'Rechnung speichern')
    // Die Datenbank meldet das Datum der vorhandenen Rechnung im Detail („2025-03-14“)
    if (failure.error === 'numberTaken' && error.details && /^\d{4}-\d{2}-\d{2}$/.test(error.details)) {
      return { ...failure, takenDate: error.details }
    }
    // Die Datenbank meldet die Nummer der ausgestellten Schlussrechnung im Detail (PROJ-42)
    if (failure.error === 'deductedByIssued') return { ...failure, deductedBy: error.details ?? '' }
    return failure
  }
  const result = data as unknown as SaveDbResult
  await removeInvoiceFiles([result.unused_pdf])
  revalidate({ id: result.id, bookingIds: [v.bookingId, result.previous_booking_id] })
  // Nach dem Anlegen zur Detailseite: Weiterleitung in der Aktion statt router.push im Browser (Next 16, siehe saveBooking)
  if (!input.id) redirect(invoiceHref(result.id))
  return { ok: true, data: { id: result.id } }
}

export async function deleteInvoice(input: { id: string }): Promise<Result & { deductedBy?: string }> {
  const guard = await requireOwner()
  if (!guard.ok) return guard
  if (!isId(input?.id)) return fail('notFound')
  const supabase = await createClient()
  const { data: before } = await supabase.from('invoices').select('booking_id').eq('id', input.id).eq('tenant_id', guard.tenant.id).maybeSingle()
  const { data, error } = await supabase.rpc('delete_invoice', { p_invoice_id: input.id })
  if (error) {
    const failure = dbFail(error, 'Rechnung löschen')
    return failure.error === 'deductedByIssued' ? { ...failure, deductedBy: error.details ?? '' } : failure
  }
  // Die Funktion meldet das PDF der gelöschten Rechnung zurück
  await removeInvoiceFiles([data])
  revalidate({ bookingIds: [before?.booking_id] })
  // Keine Weiterleitung aus der Aktion (QA BUG-2, PROJ-45): Das Neuladen der jetzt gelöschten Rechnung überholte sie sporadisch
  // („Seite nicht gefunden“). Der Browser wechselt selbst (wie beim Löschen eines Gastes); die Liste zeigt die Bestätigung.
  return { ok: true, redirectTo: `${LIST}?geloescht=1` }
}

// PDF hochladen: Der Server vergibt Speicherort und einmaligen Upload-Schlüssel im Ordner des eigenen Kunden;
// der Browser lädt die Datei direkt in den privaten Speicher (Vercel begrenzt Server-Anfragen auf 4,5 MB).
// An der Rechnung wirksam wird das PDF erst beim Speichern.
export async function prepareInvoiceUpload(): Promise<Result<{ path: string; token: string }>> {
  const guard = await requireOwner()
  if (!guard.ok) return guard
  const path = `${guard.tenant.id}/${crypto.randomUUID()}.pdf`
  const supabase = await createClient()
  const { data, error } = await supabase.storage.from(INVOICE_BUCKET).createSignedUploadUrl(path)
  if (error || !data) {
    console.error('[rechnungen] Upload nicht vorbereitet', error?.message)
    return fail('unknown')
  }
  return { ok: true, data: { path: data.path, token: data.token } }
}

// Buchungsauswahl im Formular: Gastname, Wohnung oder Zeitraum; höchstens 20 Treffer, neueste zuerst,
// Buchungen und Optionen inkl. stornierter, keine Sperren
export async function searchInvoiceBookings(values: { query: string }): Promise<Result<InvoiceBookingOption[]>> {
  const guard = await requireOwner()
  if (!guard.ok) return guard
  return findBookings(guard.tenant.id, values)
}

// Buchungssuche „Rechnung erstellen“ aus der Rechnungsliste (PROJ-43): dieselben Treffer, je Treffer die Regel des Knopfs
// „Rechnung“ (PROJ-40). Formular und Datenbank prüfen beim Öffnen bzw. Speichern noch einmal.
export async function searchDraftBookings(values: { query: string }): Promise<Result<DraftBookingOption[]>> {
  const guard = await requireOwner()
  if (!guard.ok) return guard
  const found = await findBookings(guard.tenant.id, values)
  if (!found.ok || !found.data) return found as Result<DraftBookingOption[]>
  const states = await getInvoiceButtonStates(guard.tenant.id, found.data.map((b) => b.id))
  return {
    ok: true,
    data: found.data.map((b) => {
      const state = states.get(b.id)
      return { ...b, blocked: !state ? 'nothingToBill' : state.enabled ? null : state.reason }
    }),
  }
}

async function findBookings(tenantId: string, values: { query: string }): Promise<Result<InvoiceBookingOption[]>> {
  const query = cleanInvoiceQuery(String(values?.query ?? ''))
  if (query.length < 2) return { ok: true, data: [] }
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('search_invoice_bookings', { p_tenant_id: tenantId, p_query: query, p_limit: SEARCH_LIMIT })
  if (error) return dbFail(error, 'Buchungssuche')
  return {
    ok: true,
    data: (data ?? []).map((r) => ({
      id: r.id,
      kind: r.kind === 'option' ? 'option' : 'booking',
      number: r.number,
      guestName: bookingGuestName(r.guest_last_name ? { lastName: r.guest_last_name, firstName: r.guest_first_name } : null),
      apartmentLabel: apartmentLabel(r.property_name, r.apartment_name),
      arrival: r.arrival,
      departure: r.departure,
      cancelled: r.cancelled,
    })),
  }
}

// Gewählte Buchung: Hauptgast und Beträge zum Vorbelegen (Inhaber dürfen Buchungspreise lesen)
export async function loadInvoiceBooking(input: { id: string }): Promise<Result<InvoiceBookingDetails>> {
  const guard = await requireOwner()
  if (!guard.ok) return guard
  if (!isId(input?.id)) return fail('bookingInvalid')
  const supabase = await createClient()
  const { data: b, error } = await supabase
    .from('bookings')
    .select(
      'id, kind, source, cancelled_at, guest:guests(id, last_name, first_name, title_prefix, title_suffix, country, anonymized_at, company:companies!guests_company_fkey(name)), amounts:booking_amounts(billed_nights_cents, nights_cents, nights_vat_rate, cancellation_fee_cents, cancellation_fee_vat_rate), charges:booking_charges(position, label, amount_cents, vat_rate)'
    )
    .eq('id', input.id)
    .eq('tenant_id', guard.tenant.id)
    .neq('kind', 'block')
    .maybeSingle()
  if (error) return dbFail(error, 'Buchung für Rechnung')
  if (!b) return fail('bookingInvalid')
  const a = b.amounts[0]
  return {
    ok: true,
    data: {
      guest: b.guest && {
        id: b.guest.id,
        lastName: b.guest.last_name,
        firstName: b.guest.first_name,
        titlePrefix: b.guest.title_prefix,
        titleSuffix: b.guest.title_suffix,
        country: b.guest.country,
        companyName: b.guest.company?.name ?? null,
        anonymized: b.guest.anonymized_at !== null,
      },
      amounts: a
        ? {
            cancelled: b.cancelled_at !== null,
            billedNightsCents: a.billed_nights_cents ?? a.nights_cents,
            nightsVatBp: vatRateFromDb(a.nights_vat_rate),
            charges: [...b.charges]
              .sort((x, y) => x.position - y.position)
              .map((c) => ({ label: c.label, amountCents: c.amount_cents, vatBp: vatRateFromDb(c.vat_rate) })),
            cancellationFeeCents: a.cancellation_fee_cents,
            cancellationFeeVatBp: a.cancellation_fee_vat_rate === null ? VAT_DEFAULTS.cancellationFee : vatRateFromDb(a.cancellation_fee_vat_rate),
          }
        : null,
      platform: isPlatformSource(b.source as BookingSource),
    },
  }
}

// ---- Rechnungsentwurf (PROJ-40) ------------------------------------------------------------------

type SaveDraft = {
  id?: string
  updatedAt?: string
  bookingId: string
  values: DraftInput
}

// Entwurf anlegen oder ändern. Buchung, Teilbetrag-Aufteilung und Fingerabdruck liest bzw. rechnet der Server selbst
// aus der aktuellen Buchung; der Browser liefert nur die Eingaben. Danach zur Detailseite des Entwurfs.
export async function saveInvoiceDraft(input: SaveDraft): Promise<Result<{ id: string }>> {
  const guard = await requireOwner()
  if (!guard.ok) return guard
  if (input.id !== undefined && (!isId(input.id) || typeof input.updatedAt !== 'string')) return fail('notFound')
  if (!isId(input?.bookingId)) return fail('bookingInvalid')
  const booking = await getDraftBooking(input.bookingId)
  if (!booking || booking.kind === 'block' || !booking.lines) return fail('bookingInvalid')
  const parsed = draftSchema(key, { partialBaseCents: billableCents(booking.lines) }).safeParse(input.values)
  if (!parsed.success) return fail('unknown')
  const v = parsed.data
  // Teilrechnung: eine Zeile je USt-Satz der Buchungspositionen, anteilig und auf Cent genau
  const lines =
    v.kind === 'partial' && v.partial
      ? splitByVat(v.partial.amountCents, booking.lines).map((l) => ({ ...l, label: partialLabel(booking), source: null }))
      : v.lines

  const supabase = await createClient()
  const { data, error } = await supabase.rpc('save_invoice_draft', {
    p_input: {
      id: input.id ?? null,
      updated_at: input.updatedAt ?? null,
      tenant_id: guard.tenant.id,
      booking_id: booking.id,
      kind: v.kind,
      invoice_date: v.invoiceDate,
      recipient_kind: v.recipientKind,
      recipient: {
        name: v.recipient.name,
        line1: v.recipient.line1,
        line2: v.recipient.line2,
        postal_code: v.recipient.postalCode,
        city: v.recipient.city,
        country: v.recipient.country,
        vat_id: v.recipient.vatId,
      },
      company_salutation: v.companySalutation,
      guest_names: v.guestNames,
      partial: v.partial && {
        mode: v.partial.mode,
        percent: v.partial.percentBp === null ? null : vatRateToDb(v.partial.percentBp),
        amount_cents: v.partial.amountCents,
      },
      // Reihenfolge = Position; Sätze als exakte Dezimalzahl („10.00“), Gesamtbetrag bildet die Datenbank
      lines: lines.map((l) => ({ label: l.label, amount_cents: l.amountCents, vat_rate: vatRateToDb(l.vatBp), ...lineSourceToDb(l.source) })),
      deduction_ids: v.deductionIds,
      texts: {
        intro: { block_id: v.texts.intro.blockId, body: v.texts.intro.body },
        payment: { block_id: v.texts.payment.blockId, body: v.texts.payment.body },
        closing: { block_id: v.texts.closing.blockId, body: v.texts.closing.body },
      },
      payment: {
        deposit_percent: v.payment.depositPercent,
        deposit_days: v.payment.depositDays,
        due_days: v.payment.dueDays,
        due_basis: v.payment.dueBasis,
      },
      booking_fingerprint: currentFingerprint(booking),
    },
  })
  if (error) return dbFail(error, 'Entwurf speichern')
  const id = data as unknown as string
  revalidate({ id, bookingIds: [booking.id] })
  // Bearbeiten-/Vorschau-Seite und Schlussrechnungen, die diesen Entwurf abziehen (Betrag neu gebildet)
  revalidatePath(LIST, 'layout')
  // Weiterleitung in der Aktion statt router.push im Browser (Next 16, siehe saveBooking)
  redirect(invoiceHref(id))
}

// Entwurf löschen (nur Entwürfe); Schlussrechnungen, die ihn abziehen, verlieren den Abzug. Danach zur Buchung.
export async function deleteInvoiceDraft(input: { id: string }): Promise<Result> {
  const guard = await requireOwner()
  if (!guard.ok) return guard
  if (!isId(input?.id)) return fail('notFound')
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('delete_invoice_draft', { p_invoice_id: input.id })
  if (error) return dbFail(error, 'Entwurf löschen')
  // Die Funktion meldet die Buchung des gelöschten Entwurfs zurück
  const bookingId = typeof data === 'string' && isId(data) ? data : null
  revalidate({ bookingIds: [bookingId] })
  revalidatePath(LIST, 'layout')
  redirect(bookingId ? bookingHref(bookingId) : LIST)
}
