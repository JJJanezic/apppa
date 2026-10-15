import 'server-only'

import { createHmac } from 'node:crypto'

import { lockState, LOOKBACK_MS, MAX_FAILURES, type LockState } from '@/lib/auth/lockout-rules'
import { getServerEnv } from '@/lib/env'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeEmail } from '@/lib/validation/auth'

// Sperre nach Fehlversuchen je Konto (Tabelle public.login_failures, nur mit Secret Key erreichbar).
// Supabase selbst begrenzt nur pro IP-Adresse.

export type FailureKind = 'password' | 'mfa'

// Das Konto wird nur als HMAC der normalisierten E-Mail-Adresse gespeichert. Der Schlüssel ist aus dem
// Secret Key abgeleitet: ohne ihn lässt sich der Hash nicht für bekannte Adressen nachrechnen.
export function accountHash(email: string): string {
  const key = createHmac('sha256', getServerEnv().SUPABASE_SECRET_KEY).update('apppa:login-failures').digest()
  return createHmac('sha256', key).update(normalizeEmail(email)).digest('hex')
}

// Fällt die Datenbank aus, bleibt die Anmeldung möglich (die IP-Grenze von Supabase greift weiter)
export async function getLockState(hash: string): Promise<LockState> {
  const since = new Date(Date.now() - LOOKBACK_MS).toISOString()
  const { data, error } = await createAdminClient()
    .from('login_failures')
    .select('created_at')
    .eq('account_hash', hash)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(MAX_FAILURES)
  if (error) {
    console.error('[lockout] Fehlversuche nicht lesbar', error.message)
    return { locked: false }
  }
  return lockState(
    data.map((row) => new Date(row.created_at)),
    new Date()
  )
}

export async function recordFailure(hash: string, kind: FailureKind): Promise<void> {
  const { error } = await createAdminClient().from('login_failures').insert({ account_hash: hash, kind })
  if (error) console.error('[lockout] Fehlversuch nicht gespeichert', error.message)
}

// Erfolgreiche Anmeldung bzw. richtiger Code: Zähler zurücksetzen
export async function clearFailures(hash: string): Promise<void> {
  const { error } = await createAdminClient().from('login_failures').delete().eq('account_hash', hash)
  if (error) console.error('[lockout] Fehlversuche nicht gelöscht', error.message)
}
