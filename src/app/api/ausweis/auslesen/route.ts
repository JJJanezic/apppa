import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'

import { getSessionUser, pendingMfaStep } from '@/lib/auth/session'
import { todayIso } from '@/lib/bookings'
import { DOCUMENT_BUCKET } from '@/lib/guests'
import { compareIdReading, fakeIdReading, ID_FIELDS, ID_READING_PLACES, type IdReadingError, type IdReadingResponse } from '@/lib/id-reading'
import { fakeReaderActive, loadIdReadingSettings } from '@/lib/id-reading-data'
import { type IdImage, readIdDocument, type ReaderOutcome } from '@/lib/id-reading-reader'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext } from '@/lib/tenant'

// Speicherort eines Ausweisbilds: <Kunde>/<zufällig>.jpg (PROJ-29)
const imagePath = z.string().max(200).regex(/^[0-9a-f-]{36}\/[A-Za-z0-9_-]{1,80}\.jpg$/)

const schema = z.object({
  tenantId: z.uuid(),
  place: z.enum(ID_READING_PLACES),
  guestId: z.uuid().nullable(),
  bookingId: z.uuid().nullable(),
  frontPath: imagePath.nullable(),
  backPath: imagePath.nullable(),
  current: z.object(Object.fromEntries(ID_FIELDS.map((f) => [f, z.string().max(200)])) as Record<(typeof ID_FIELDS)[number], z.ZodString>),
})

const STATUS: Record<IdReadingError, number> = {
  sessionExpired: 401,
  forbidden: 403,
  invalid: 400,
  notEnabled: 403,
  dailyLimit: 429,
  noImage: 400,
  noDocument: 422,
  unavailable: 503,
  notReady: 503,
  unknown: 500,
}
const answer = (body: IdReadingResponse) =>
  Response.json(body, { status: body.ok ? 200 : STATUS[body.error], headers: { 'cache-control': 'no-store' } })
const fail = (error: IdReadingError) => answer({ ok: false, error })

// Lesen kann dauern (zwei Bilder); der Leser bricht nach 50 Sekunden ab
export const maxDuration = 60

type Db = SupabaseClient
type GuestRow = { id: string; anonymized_at: string | null; document_front_path: string | null; document_back_path: string | null }

// Ausweis auslesen (PROJ-51). Prüft Sitzung, Kunde, Rolle je Stelle, Gast/Buchung und die Bilder; merkt die Auslesung mit
// Tageslimit vor (Datenbank), liest die Bilder aus dem privaten Speicher, ruft den Leser (Claude über AWS Bedrock bzw. in
// Dev/Test den Test-Leser), schließt die Auslesung mit Ergebnis und Verbrauch ab und liefert nur die Gegenüberstellung.
// Gespeichert wird hier nichts am Gast; gelesene Werte landen nirgends in der Datenbank.
export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user || (await pendingMfaStep(user))) return fail('sessionExpired')
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return fail('invalid')
  const input = parsed.data
  const { active } = await getTenantContext()
  if (!active || active.id !== input.tenantId) return fail('forbidden')

  const paths = [input.frontPath, input.backPath].filter((p): p is string => Boolean(p))
  if (!paths.length) return fail('noImage')
  if (paths.some((p) => !p.startsWith(`${input.tenantId}/`))) return fail('forbidden')
  // Freischaltung zuerst (QA BUG-2): ohne sie werden keine Bilder geladen; verbindlich prüft sie das Vormerken
  if (!(await loadIdReadingSettings(input.tenantId)).enabled) return fail('notEnabled')

  // Rollen: Gastformular – Inhaber; Mitarbeiter nur beim neuen Gast (PROJ-29). Gästeblatt – Inhaber und Mitarbeiter,
  // nur für den Hauptgast einer Buchung des Kunden (PROJ-26)
  const db = (await createClient()) as unknown as Db
  if (input.place === 'guestForm' && active.role !== 'owner' && input.guestId !== null) return fail('forbidden')
  if (input.place === 'guestSheet') {
    if (!input.bookingId || !input.guestId) return fail('invalid')
    const { data: booking } = await db
      .from('bookings')
      .select('guest_id')
      .eq('id', input.bookingId)
      .eq('tenant_id', input.tenantId)
      .maybeSingle()
    if (!booking || (booking as { guest_id: string | null }).guest_id !== input.guestId) return fail('forbidden')
  }

  // Gast des Kunden, nicht anonymisiert; Bilder gehören diesem Gast oder noch keinem (frisch hochgeladen)
  if (input.guestId) {
    const { data: guest } = await db.from('guests').select('id, anonymized_at').eq('id', input.guestId).eq('tenant_id', input.tenantId).maybeSingle()
    if (!guest || (guest as GuestRow).anonymized_at) return fail('forbidden')
  }
  const quoted = paths.map((p) => `"${p}"`).join(',')
  const { data: owners, error: ownersError } = await db
    .from('guests')
    .select('id')
    .eq('tenant_id', input.tenantId)
    .or(`document_front_path.in.(${quoted}),document_back_path.in.(${quoted})`)
    .limit(5)
  if (ownersError) {
    console.error('[ausweis] Bilder nicht prüfbar', ownersError.code, ownersError.message)
    return fail('unknown')
  }
  if ((owners ?? []).some((g) => (g as { id: string }).id !== input.guestId)) return fail('forbidden')

  // Bilder vor dem Vormerken laden: Fehlt eine Datei im Speicher, zählt das nicht als Auslesung
  const admin = createAdminClient() as unknown as Db
  const fake = fakeReaderActive()
  const images = fake ? [] : await loadImages(admin, input)
  if (!fake && !images.length) return fail('noImage')

  // Vormerken mit Tageslimit (prüft auch die Freischaltung); nur der Server darf das
  const { data: readingId, error: reserveError } = await admin.rpc('reserve_id_reading', {
    p_tenant_id: input.tenantId,
    p_user_id: user.userId,
    p_guest_id: input.guestId,
    p_place: input.place,
  })
  if (reserveError) {
    if (reserveError.code === 'P0990') return fail('notEnabled')
    if (reserveError.code === 'P0991') return fail('dailyLimit')
    if (reserveError.code === 'P0016') return fail('forbidden')
    console.error('[ausweis] Vormerken fehlgeschlagen', reserveError.code, reserveError.message)
    return fail('unknown')
  }

  const outcome = fake ? fakeOutcome(input) : await readIdDocument(images, todayIso())
  const { error: finishError } = await admin.rpc('finish_id_reading', {
    p_id: readingId,
    p_outcome: outcome.ok ? 'read' : outcome.reason === 'noDocument' ? 'no_document' : outcome.reason === 'failed' ? 'failed' : 'unreachable',
    p_model: outcome.usage?.model ?? null,
    p_input_tokens: outcome.usage?.inputTokens ?? null,
    p_output_tokens: outcome.usage?.outputTokens ?? null,
  })
  if (finishError) console.error('[ausweis] Abschließen fehlgeschlagen', finishError.code, finishError.message)

  // readingId: Nachweis für den Vermerk „aus Ausweis gelesen“ beim Speichern (QA BUG-1)
  if (outcome.ok) return answer({ ok: true, comparison: compareIdReading(input.current, outcome.read), readingId: readingId as string })
  if (outcome.reason === 'noDocument') return fail('noDocument')
  if (outcome.reason === 'notConfigured') return fail('notReady')
  return fail('unavailable')
}

type Input = z.infer<typeof schema>

// Test-Leser (nur Dev/Test): feste Ergebnisse, die Bilder werden nicht gelesen
function fakeOutcome(input: Input): ReaderOutcome {
  const fake = fakeIdReading(input.current)
  const usage = { model: 'test-leser', inputTokens: 0, outputTokens: 0 }
  if (fake.ok) return { ok: true, read: fake.read, usage }
  return fake.error === 'noDocument' ? { ok: false, reason: 'noDocument', usage } : { ok: false, reason: 'unreachable', usage: null }
}

async function loadImages(admin: Db, input: Input): Promise<IdImage[]> {
  const images: IdImage[] = []
  for (const [side, path] of [['front', input.frontPath], ['back', input.backPath]] as const) {
    if (!path) continue
    const { data, error } = await admin.storage.from(DOCUMENT_BUCKET).download(path)
    if (error || !data) {
      console.error('[ausweis] Bild nicht lesbar', error?.message)
      continue
    }
    images.push({ side, jpeg: Buffer.from(await data.arrayBuffer()) })
  }
  return images
}
