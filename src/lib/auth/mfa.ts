import 'server-only'

import { accountHash, clearFailures, getLockState, recordFailure } from '@/lib/auth/lockout'
import type { ActionResult } from '@/lib/auth/result'
import { getSessionUser } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

// Gemeinsame 2FA-Schritte für Anmelde-Seiten und „Mein Konto“. Bewusst keine Server-Aktionen:
// Die Berechtigung prüfen die aufrufenden Aktionen.

export type Enrollment = { factorId: string; qrCode: string; secret: string }

// Prüft einen Code gegen die angegebenen bzw. alle bestätigten Authenticator-Geräte.
// Erfolg hebt die Sitzung auf aal2; Fehlversuche zählen zur Sperre wie beim Passwort.
export async function verifyTotp(code: string, factorIds: string[] | null): Promise<ActionResult> {
  const user = await getSessionUser()
  if (!user?.email) return { ok: false, error: 'sessionExpired' }

  const hash = accountHash(user.email)
  const lock = await getLockState(hash)
  if (lock.locked) return { ok: false, error: 'locked', retryAfterMinutes: lock.retryAfterMinutes }

  const supabase = await createClient()
  let ids = factorIds
  if (!ids) {
    const { data } = await supabase.auth.mfa.listFactors()
    ids = data?.totp.map((f) => f.id) ?? []
  }

  for (const factorId of ids) {
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
    if (!error) {
      await clearFailures(hash)
      return { ok: true }
    }
    if (error.status === 429) return { ok: false, error: 'locked', retryAfterMinutes: 15 }
  }

  await recordFailure(hash, 'mfa')
  return { ok: false, error: 'codeInvalid' }
}

// Unbestätigte Geräte aus abgebrochenen Einrichtungen entfernen, dann ein neues Gerät anlegen.
// Supabase verlangt eindeutige Gerätenamen; angezeigt werden sie als „Gerät 1, 2 …“.
export async function enrollTotp(): Promise<ActionResult<Enrollment>> {
  const supabase = await createClient()
  const { data: factors } = await supabase.auth.mfa.listFactors()
  for (const factor of factors?.all ?? []) {
    if (factor.factor_type === 'totp' && factor.status === 'unverified') {
      await supabase.auth.mfa.unenroll({ factorId: factor.id })
    }
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp',
    friendlyName: `apppa ${new Date().toISOString()}`,
    issuer: 'apppa',
  })
  if (error || !data) return { ok: false, error: 'unknown' }
  return { ok: true, data: { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret } }
}
