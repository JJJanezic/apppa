import { createHash, randomUUID } from 'node:crypto'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { getSessionUser, pendingMfaStep } from '@/lib/auth/session'
import { bookingHref } from '@/lib/bookings'
import { GUEST_SHEET_BUCKET, guestSheetExpected, guestSheetListHref, type GuestSheetSnapshot, sheetComplete, sheetGaps } from '@/lib/guest-sheet'
import { renderGuestSheet } from '@/lib/guest-sheet-pdf/respond'
import { getSigningData } from '@/lib/guest-sheets-data'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTenantContext } from '@/lib/tenant'

// Ein Unterschriftsbild: PNG als data:-Adresse, höchstens ~1 MB
const PNG = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/
const signature = z.object({ image: z.string().max(1_400_000).regex(PNG), signedAt: z.iso.datetime({ offset: true }) })

const schema = z.object({
  tenantId: z.uuid(),
  bookingId: z.uuid(),
  bookingUpdatedAt: z.string().max(40),
  guestUpdatedAt: z.string().max(40),
  previousSheetId: z.uuid().nullable(),
  marketingConsent: z.boolean(),
  signature1: signature,
  signature2: signature,
})

type FinishError =
  | 'sessionExpired'
  | 'forbidden'
  | 'invalid'
  | 'notExpected'
  | 'staleBooking'
  | 'incomplete'
  | 'sheetExists'
  | 'notImplemented'
  | 'noSheetNumber'
  | 'unknown'
// bookingUpdatedAt: neuer Stand der Buchung, wenn die Nummer vergeben wurde und danach etwas scheiterte (erneutes „Fertig“)
const answer = (
  body: { ok: true; id: string } | { ok: false; error: FinishError; currentSheetId?: string; bookingUpdatedAt?: string },
  status = 200
) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store' } })

// PDF, Ablage und Festschreiben dürfen länger dauern als die Standardgrenze
export const maxDuration = 60

// Zeitpunkt einer Unterschrift: wie vom Gerät gemeldet, aber nie in der Zukunft und nicht älter als 12 Stunden
function signedAt(value: string, now: number): string {
  const at = Date.parse(value)
  return at > now || at < now - 12 * 60 * 60_000 ? new Date(now).toISOString() : new Date(at).toISOString()
}

// Gästeblatt fertigstellen (PROJ-26): Alle Prüfungen laufen hier neu (Buchungsart, Gast, Pflichtangaben, Stand, aktuelles
// Blatt), dann PDF erzeugen, PDF und Unterschriften ablegen und in einem Datenbankschritt festschreiben. Der Schreibschritt
// ist nur für den Server freigegeben; scheitert er, werden die Dateien wieder entfernt (sonst die tägliche Bereinigung).
export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user || (await pendingMfaStep(user))) return answer({ ok: false, error: 'sessionExpired' }, 401)
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return answer({ ok: false, error: 'invalid' }, 400)
  const input = parsed.data
  const { active } = await getTenantContext()
  if (!active || active.id !== input.tenantId) return answer({ ok: false, error: 'forbidden' }, 403)

  const data = await getSigningData(input.bookingId)
  const guest = data.guest
  if (!guestSheetExpected(data.booking) || !guest || guest.anonymized) return answer({ ok: false, error: 'notExpected' }, 409)
  if (data.booking.updatedAt !== input.bookingUpdatedAt || guest.updatedAt !== input.guestUpdatedAt) return answer({ ok: false, error: 'staleBooking' }, 409)
  if (!sheetComplete(sheetGaps(guest, data.companions, data.booking.persons))) return answer({ ok: false, error: 'incomplete' }, 409)
  if (data.currentSheetId !== input.previousSheetId) return answer({ ok: false, error: 'sheetExists', currentSheetId: data.currentSheetId ?? undefined }, 409)

  // Gästeblattnummer (Erweiterung 2026-11-09): Hat die Buchung keine, vergibt die Datenbank die nächste freie der Gemeinde
  // (Sperre gegen gleichzeitige Vergabe, belegte übersprungen, Sprung in den nächsten Bereich) und schreibt sie an die
  // Buchung. Scheitert danach etwas, bleibt die Nummer dort und ein erneutes „Fertig“ nimmt sie wieder.
  const admin = createAdminClient()
  let sheetNumber = data.booking.sheetNumber
  let bookingUpdatedAt = input.bookingUpdatedAt
  if (!sheetNumber) {
    const { data: assigned, error: assignError } = await admin.rpc('assign_guest_sheet_number' as never, {
      p_booking_id: data.booking.id,
      p_actor_id: user.userId,
      p_expected_updated_at: input.bookingUpdatedAt,
    } as never)
    const code = (assignError as { code?: string } | null)?.code
    if (code === 'P0986') return answer({ ok: false, error: 'noSheetNumber' }, 409)
    if (code === 'P0975') return answer({ ok: false, error: 'staleBooking' }, 409)
    // Funktion fehlt (Umgebung ohne Migration): Blatt ohne Nummer wie bisher
    if (assignError && code !== '42883' && code !== 'PGRST202') {
      console.error('[gaesteblatt] Nummer nicht vergeben', code, (assignError as { message?: string }).message)
      return answer({ ok: false, error: 'unknown' }, 500)
    }
    const result = assigned as unknown as { sheet_number: string; updated_at: string } | null
    if (result) {
      sheetNumber = result.sheet_number
      bookingUpdatedAt = result.updated_at
    }
  }

  // Antworten nach der Vergabe tragen den neuen Stand der Buchung mit
  const failAfter = (error: FinishError, status: number) =>
    answer({ ok: false, error, bookingUpdatedAt: bookingUpdatedAt !== input.bookingUpdatedAt ? bookingUpdatedAt : undefined }, status)

  const now = Date.now()
  const snapshot: GuestSheetSnapshot = {
    version: 1,
    tenantName: data.tenantName,
    sheetNumber,
    establishmentNumber: data.establishmentNumber,
    guest: {
      lastName: guest.lastName,
      firstName: guest.firstName,
      titlePrefix: guest.titlePrefix,
      titleSuffix: guest.titleSuffix,
      gender: guest.gender,
      birthDate: guest.birthDate,
      country: guest.country,
      documentType: guest.documentType,
      documentNumber: guest.documentNumber,
      documentIssuedOn: guest.documentIssuedOn,
      documentAuthority: guest.documentAuthority,
      documentCountry: guest.documentCountry,
      street: guest.street,
      postalCode: guest.postalCode,
      city: guest.city,
      addressCountry: guest.addressCountry,
      documentFrontPath: guest.documentFrontPath,
      documentBackPath: guest.documentBackPath,
    },
    companions: data.companions.map((c) => ({ lastName: c.lastName, firstName: c.firstName, birthDate: c.birthDate })),
    stay: { arrival: data.booking.arrival, plannedDeparture: data.booking.plannedDeparture, persons: data.booking.persons },
    privacyText: data.texts.privacy,
    marketingText: data.texts.marketing,
    marketingConsent: input.marketingConsent,
    signedAt1: signedAt(input.signature1.signedAt, now),
    signedAt2: signedAt(input.signature2.signedAt, now),
  }

  let pdf: Uint8Array
  try {
    pdf = (await renderGuestSheet({ snapshot, departure: null, signatures: { first: input.signature1.image, second: input.signature2.image } })).pdf
  } catch (e) {
    console.error('[gaesteblatt] PDF nicht erzeugt', e instanceof Error ? e.message : e)
    return failAfter('unknown', 500)
  }

  const storage = admin.storage.from(GUEST_SHEET_BUCKET)
  const png = (dataUrl: string) => Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64')
  const paths = { pdf: `${active.id}/${randomUUID()}.pdf`, first: `${active.id}/${randomUUID()}.png`, second: `${active.id}/${randomUUID()}.png` }
  const uploads = await Promise.all([
    storage.upload(paths.pdf, pdf, { contentType: 'application/pdf', upsert: false }),
    storage.upload(paths.first, png(input.signature1.image), { contentType: 'image/png', upsert: false }),
    storage.upload(paths.second, png(input.signature2.image), { contentType: 'image/png', upsert: false }),
  ])
  const remove = () => storage.remove(Object.values(paths))
  const uploadError = uploads.find((u) => u.error)?.error
  if (uploadError) {
    await remove()
    // Speicherbereich fehlt noch (Migration nicht eingespielt)
    if (/not found/i.test(uploadError.message)) return failAfter('notImplemented', 501)
    console.error('[gaesteblatt] Dateien nicht abgelegt', uploadError.message)
    return failAfter('unknown', 500)
  }

  const { data: id, error } = await admin.rpc('finish_guest_sheet' as never, {
    p_input: {
      tenant_id: active.id,
      booking_id: data.booking.id,
      guest_id: guest.id,
      actor_id: user.userId,
      booking_updated_at: bookingUpdatedAt,
      guest_updated_at: input.guestUpdatedAt,
      previous_sheet_id: input.previousSheetId,
      sheet_number: snapshot.sheetNumber,
      marketing_consent: snapshot.marketingConsent,
      snapshot,
      signed_at_1: snapshot.signedAt1,
      signed_at_2: snapshot.signedAt2,
      signature_1_path: paths.first,
      signature_2_path: paths.second,
      pdf_path: paths.pdf,
      pdf_sha256: createHash('sha256').update(pdf).digest('hex'),
    },
  } as never)
  if (error) {
    await remove()
    const code = (error as { code?: string }).code
    switch (code) {
      case 'P0973':
        return failAfter('sheetExists', 409)
      case 'P0975':
        return failAfter('staleBooking', 409)
      case 'P0974':
        return failAfter('incomplete', 409)
      case 'P0976':
      case 'P0977':
      case 'P0978':
        return failAfter('notExpected', 409)
      case 'P0016':
        return failAfter('forbidden', 403)
      case '42883':
      case 'PGRST202':
        return failAfter('notImplemented', 501)
    }
    console.error('[gaesteblatt] Nicht festgeschrieben', code, (error as { message?: string }).message)
    return failAfter('unknown', 500)
  }
  revalidatePath(bookingHref(data.booking.id))
  revalidatePath(guestSheetListHref)
  revalidatePath(`/gaeste/${guest.id}`)
  return answer({ ok: true, id: id as unknown as string })
}
