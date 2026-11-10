import { z } from 'zod'

import { getSessionUser, pendingMfaStep } from '@/lib/auth/session'
import { compareIdReading, fakeIdReading, ID_FIELDS, ID_READING_PLACES, type IdReadingResponse } from '@/lib/id-reading'
import { fakeReaderActive, loadIdReadingSettings } from '@/lib/id-reading-data'
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

const answer = (body: IdReadingResponse, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } })

// Lesen kann dauern (zwei Bilder); der Server bricht nach 50 Sekunden ab
export const maxDuration = 60

// Ausweis auslesen (PROJ-51): prüft Sitzung, Kunde und Freischaltung, liest die Bilder und liefert nur die Gegenüberstellung.
// Gespeichert wird hier nichts. Stand Frontend: nur der Test-Leser (ID_READING_FAKE=1, nie in Produktion);
// Rollenprüfung, Tageslimit, Bilder aus dem Speicher und Claude über AWS Bedrock ergänzt /backend.
export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user || (await pendingMfaStep(user))) return answer({ ok: false, error: 'sessionExpired' }, 401)
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return answer({ ok: false, error: 'invalid' }, 400)
  const input = parsed.data
  const { active } = await getTenantContext()
  if (!active || active.id !== input.tenantId) return answer({ ok: false, error: 'forbidden' }, 403)
  // Bilder nur aus dem Ordner des eigenen Kunden
  const paths = [input.frontPath, input.backPath].filter((p): p is string => Boolean(p))
  if (!paths.length) return answer({ ok: false, error: 'noImage' }, 400)
  if (paths.some((p) => !p.startsWith(`${input.tenantId}/`))) return answer({ ok: false, error: 'forbidden' }, 403)

  const settings = await loadIdReadingSettings(input.tenantId)
  if (!settings.enabled) return answer({ ok: false, error: 'notEnabled' }, 403)

  if (!fakeReaderActive()) return answer({ ok: false, error: 'notReady' }, 503)
  const outcome = fakeIdReading(input.current)
  if (!outcome.ok) return answer({ ok: false, error: outcome.error }, outcome.error === 'unavailable' ? 503 : 422)
  return answer({ ok: true, comparison: compareIdReading(input.current, outcome.read) })
}
