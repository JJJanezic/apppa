'use server'

import { createClient as createPlainClient } from '@supabase/supabase-js'

import { accountHash, clearFailures, getLockState, recordFailure } from '@/lib/auth/lockout'
import { enrollTotp, type Enrollment, verifyTotp } from '@/lib/auth/mfa'
import type { ActionResult } from '@/lib/auth/result'
import {
  clearSessionLimits,
  getSessionUser,
  hasVerifiedTotp,
  pendingMfaStep,
  startSessionLimits,
} from '@/lib/auth/session'
import { getClientEnv } from '@/lib/env'
import { safeRedirectPath } from '@/lib/safe-redirect'
import { rememberTenant } from '@/lib/tenant'
import { createClient } from '@/lib/supabase/server'
import {
  completeInviteSchema,
  forgotPasswordSchema,
  loginSchema,
  newPasswordSchema,
  otpSchema,
  type CompleteInviteValues,
  type ForgotPasswordValues,
  type LoginValues,
  type NewPasswordValues,
  type OtpValues,
} from '@/lib/validation/auth'

// Server-Aktionen der Anmelde-Seiten (PROJ-3). Meldungen bleiben neutral (keine Rückschlüsse auf Konten);
// Fehlversuche bei Passwort und 2FA-Code zählen zur Sperre (src/lib/auth/lockout.ts).

// Die Formulare prüfen schon im Browser; auf dem Server genügen Schlüssel statt übersetzter Texte
const key = (k: string) => k
// Basis zum Auflösen von Rücksprung-Zielen: nur der Pfad wird verwendet
const APP_ORIGIN = 'https://app.local'

// Anmelden. Erfolg → redirectTo: Ziel (Dashboard, Rücksprung-Seite, /2fa oder /2fa/einrichten)
export async function signIn(values: LoginValues & { next?: string }): Promise<ActionResult> {
  const parsed = loginSchema(key).safeParse(values)
  if (!parsed.success) return { ok: false, error: 'invalidCredentials' }
  const { email, password } = parsed.data

  const hash = accountHash(email)
  const lock = await getLockState(hash)
  if (lock.locked) return { ok: false, error: 'locked', retryAfterMinutes: lock.retryAfterMinutes }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.user) {
    if (error?.status === 429) return { ok: false, error: 'locked', retryAfterMinutes: 15 }
    if (error && error.status && error.status >= 500) return { ok: false, error: 'unknown' }
    await recordFailure(hash, 'password')
    return { ok: false, error: 'invalidCredentials' }
  }

  await clearFailures(hash)
  await startSessionLimits(data.user.id)
  await redeemNewAccountInvitations(supabase)

  const next = safeRedirectPath(values.next, APP_ORIGIN)
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_operator_admin')
    .eq('id', data.user.id)
    .maybeSingle()
  if (profile?.is_operator_admin) {
    const hasDevice = (data.user.factors ?? []).some((f) => f.factor_type === 'totp' && f.status === 'verified')
    return { ok: true, redirectTo: hasDevice ? `/2fa?next=${encodeURIComponent(next)}` : '/2fa/einrichten' }
  }
  return { ok: true, redirectTo: next }
}

// Reset-Mail anfordern. Antwortet immer gleich (neutral), auch wenn kein Konto existiert oder das Limit erreicht ist.
// Eigener Client ohne PKCE: Der Link funktioniert dann auch in einem anderen Browser als dem, der ihn angefordert hat.
export async function requestPasswordReset(values: ForgotPasswordValues): Promise<ActionResult> {
  const parsed = forgotPasswordSchema(key).safeParse(values)
  if (!parsed.success) return { ok: true }

  const env = getClientEnv()
  const client = createPlainClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, flowType: 'implicit' },
  })
  const { error } = await client.auth.resetPasswordForEmail(parsed.data.email)
  if (error) console.warn('[auth] Reset-Mail nicht verschickt', error.code ?? error.status)
  return { ok: true }
}

// Mail-Link einlösen – erst nach Klick auf der Bestätigungsseite (Schutz vor Linkscannern).
// Ist im Browser schon jemand angemeldet, wird diese Sitzung vorher beendet.
export async function confirmEmailLink(values: {
  tokenHash: string
  type: 'invite' | 'recovery'
}): Promise<ActionResult<{ signedOutOther: boolean }>> {
  const { tokenHash, type } = values
  if (typeof tokenHash !== 'string' || !tokenHash || tokenHash.length > 512 || (type !== 'invite' && type !== 'recovery')) {
    return { ok: false, error: 'linkInvalid' }
  }

  const supabase = await createClient()
  const previous = await getSessionUser()
  if (previous) await supabase.auth.signOut({ scope: 'local' })

  const { data, error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
  if (error || !data.user) return { ok: false, error: 'linkInvalid' }

  await startSessionLimits(data.user.id)
  return {
    ok: true,
    redirectTo: type === 'invite' ? '/einladung/abschliessen' : '/passwort-neu',
    data: { signedOutOther: Boolean(previous && previous.userId !== data.user.id) },
  }
}

// Offene Einladungen „neues Konto“ für die eigene Adresse einlösen (PROJ-4). Fehler blockieren die Anmeldung nicht.
async function redeemNewAccountInvitations(supabase: Awaited<ReturnType<typeof createClient>>): Promise<void> {
  const { data: tenantId, error } = await supabase.rpc('accept_new_account_invitations')
  if (error) console.error('[invite] Einladungen nicht eingelöst', error.message)
  else if (tenantId) await rememberTenant(tenantId)
}

function passwordError(code: string | undefined): ActionResult {
  return { ok: false, error: code === 'weak_password' ? 'weakPassword' : 'unknown' }
}

// Einladung abschließen: Anzeigename + Passwort
export async function completeInvite(values: CompleteInviteValues): Promise<ActionResult> {
  const parsed = completeInviteSchema(key).safeParse(values)
  if (!parsed.success) return { ok: false, error: 'unknown' }

  const user = await getSessionUser()
  if (!user) return { ok: false, error: 'linkInvalid' }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) return passwordError(error.code)

  const { error: profileError } = await supabase
    .from('profiles')
    .update({ display_name: parsed.data.displayName })
    .eq('id', user.userId)
  if (profileError) return { ok: false, error: 'unknown' }

  // Einladung(en) aus der Mail einlösen: Mitgliedschaft entsteht, Kunde wird gewählt (PROJ-4)
  await redeemNewAccountInvitations(supabase)
  return { ok: true, redirectTo: (await pendingMfaStep(user, supabase)) ?? '/' }
}

// Neues Passwort nach Reset; beendet andere Sitzungen
export async function setNewPassword(values: NewPasswordValues): Promise<ActionResult> {
  const parsed = newPasswordSchema(key).safeParse(values)
  if (!parsed.success) return { ok: false, error: 'unknown' }

  const user = await getSessionUser()
  if (!user) return { ok: false, error: 'linkInvalid' }

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  // same_password: Ziel ist erreicht, das Passwort gilt
  if (error && error.code !== 'same_password') return passwordError(error.code)

  await supabase.auth.signOut({ scope: 'others' })
  return { ok: true, redirectTo: (await pendingMfaStep(user, supabase)) ?? '/' }
}

// 2FA-Code nach dem Passwort prüfen (nur Admin)
export async function verifyMfa(values: OtpValues & { next?: string }): Promise<ActionResult> {
  const parsed = otpSchema(key).safeParse(values)
  if (!parsed.success) return { ok: false, error: 'codeInvalid' }

  const result = await verifyTotp(parsed.data.code, null)
  if (!result.ok) return result
  return { ok: true, redirectTo: safeRedirectPath(values.next, APP_ORIGIN) }
}

// 2FA-Einrichtung starten: QR-Code (SVG-Daten-URL) und Schlüssel zum Abtippen.
// Nur für den Admin und nur, solange er noch kein Gerät hat – weitere Geräte nur mit bestätigter Sitzung (Mein Konto).
export async function startMfaEnrollment(): Promise<ActionResult<Enrollment>> {
  const user = await getSessionUser()
  if (!user) return { ok: false, error: 'sessionExpired' }
  if (!user.isOperatorAdmin) return { ok: false, error: 'unknown' }

  const supabase = await createClient()
  if (await hasVerifiedTotp(supabase)) return { ok: false, error: 'unknown' }
  return enrollTotp()
}

// 2FA-Einrichtung mit erstem Code bestätigen
export async function confirmMfaEnrollment(values: OtpValues & { factorId: string }): Promise<ActionResult> {
  const parsed = otpSchema(key).safeParse(values)
  if (!parsed.success || typeof values.factorId !== 'string') return { ok: false, error: 'codeInvalid' }

  const result = await verifyTotp(parsed.data.code, [values.factorId])
  if (!result.ok) return result
  return { ok: true, redirectTo: '/' }
}

// Abmelden (nur dieses Gerät)
export async function signOut(): Promise<ActionResult> {
  const supabase = await createClient()
  await supabase.auth.signOut({ scope: 'local' })
  await clearSessionLimits()
  return { ok: true, redirectTo: '/anmelden?grund=abgemeldet' }
}
