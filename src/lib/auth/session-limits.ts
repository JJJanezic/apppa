import { createHmac, timingSafeEqual } from 'node:crypto'

// Sitzungsgrenzen (PROJ-3): höchstens 30 Tage ab Anmeldung, abgemeldet nach 8 Stunden ohne Aktivität.
// Supabase kann das nur im Pro-Tarif; die App prüft es deshalb selbst in src/proxy.ts.
//
// Ein signiertes, nur vom Server lesbares Cookie hält Konto, Beginn und letzte Aktivität fest:
//   <userId>.<beginn ms>.<letzte Aktivität ms>.<HMAC>
// Fehlt es oder passt es nicht zum angemeldeten Konto, gilt die Sitzung als abgelaufen.

export const SESSION_COOKIE = 'apppa-sitzung'
export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60_000
export const SESSION_IDLE_MS = 8 * 60 * 60_000
// Letzte Aktivität höchstens einmal pro Minute neu schreiben
const TOUCH_INTERVAL_MS = 60_000

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_MAX_AGE_MS / 1000,
}

function sign(payload: string, secret: string): string {
  const key = createHmac('sha256', secret).update('apppa:session-limits').digest()
  return createHmac('sha256', key).update(payload).digest('base64url')
}

function stamp(userId: string, start: number, seen: number, secret: string): string {
  const payload = `${userId}.${start}.${seen}`
  return `${payload}.${sign(payload, secret)}`
}

// Neues Cookie bei der Anmeldung bzw. beim Einlösen eines Mail-Links
export function startSession(userId: string, secret: string, now = Date.now()): string {
  return stamp(userId, now, now, secret)
}

export type SessionCheck =
  | { status: 'ok'; value?: string } // value: erneuertes Cookie, falls die Aktivität fortgeschrieben wird
  | { status: 'expired' }

export function checkSession(value: string | undefined, userId: string, secret: string, now = Date.now()): SessionCheck {
  const parts = value?.split('.') ?? []
  if (parts.length !== 4) return { status: 'expired' }
  const [id, startRaw, seenRaw, signature] = parts

  const expected = Buffer.from(sign(`${id}.${startRaw}.${seenRaw}`, secret))
  const given = Buffer.from(signature)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return { status: 'expired' }
  if (id !== userId) return { status: 'expired' }

  const start = Number(startRaw)
  const seen = Number(seenRaw)
  if (!Number.isFinite(start) || !Number.isFinite(seen)) return { status: 'expired' }
  if (now - start > SESSION_MAX_AGE_MS || now - seen > SESSION_IDLE_MS) return { status: 'expired' }

  return now - seen >= TOUCH_INTERVAL_MS ? { status: 'ok', value: stamp(id, start, now, secret) } : { status: 'ok' }
}
