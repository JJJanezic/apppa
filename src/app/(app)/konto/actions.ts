'use server'

import { createClient as createPlainClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

import { accountHash, clearFailures, getLockState, recordFailure } from '@/lib/auth/lockout'
import { enrollTotp, type Enrollment, verifyTotp } from '@/lib/auth/mfa'
import type { ActionResult } from '@/lib/auth/result'
import { clearSessionLimits, getSessionUser, pendingMfaStep, type SessionUser } from '@/lib/auth/session'
import { getClientEnv } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'
import {
  changePasswordSchema,
  displayNameSchema,
  otpSchema,
  type ChangePasswordValues,
  type DisplayNameValues,
  type OtpValues,
} from '@/lib/validation/auth'

// Server-Aktionen für „Mein Konto“ (PROJ-3). Jede Aktion prüft die Sitzung selbst;
// der Admin braucht dafür eine mit Code bestätigte Sitzung (aal2).

const key = (k: string) => k

type Guard = { ok: true; user: SessionUser } | { ok: false; result: ActionResult }

async function requireAccountUser(): Promise<Guard> {
  const user = await getSessionUser()
  if (!user) return { ok: false, result: { ok: false, error: 'sessionExpired' } }
  if (await pendingMfaStep(user)) return { ok: false, result: { ok: false, error: 'sessionExpired' } }
  return { ok: true, user }
}

// 2FA-Geräte verwalten: nur der Admin, nur mit bestätigter Sitzung
async function requireMfaAdmin(): Promise<Guard> {
  const guard = await requireAccountUser()
  if (!guard.ok) return guard
  if (!guard.user.isOperatorAdmin || guard.user.aal !== 'aal2') return { ok: false, result: { ok: false, error: 'unknown' } }
  return guard
}

export async function updateDisplayName(values: DisplayNameValues): Promise<ActionResult> {
  const parsed = displayNameSchema(key).safeParse(values)
  if (!parsed.success) return { ok: false, error: 'unknown' }
  const guard = await requireAccountUser()
  if (!guard.ok) return guard.result

  const supabase = await createClient()
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: parsed.data.displayName })
    .eq('id', guard.user.userId)
  if (error) return { ok: false, error: 'unknown' }

  // Name erscheint im App-Rahmen (Seitenleiste, „Mehr“, Begrüßung)
  revalidatePath('/', 'layout')
  return { ok: true }
}

// Prüft das aktuelle Passwort (zählt bei Fehlern zur Sperre) und beendet andere Sitzungen
export async function changePassword(values: ChangePasswordValues): Promise<ActionResult> {
  const parsed = changePasswordSchema(key).safeParse(values)
  if (!parsed.success) return { ok: false, error: 'unknown' }
  const guard = await requireAccountUser()
  if (!guard.ok) return guard.result
  const email = guard.user.email
  if (!email) return { ok: false, error: 'unknown' }

  const hash = accountHash(email)
  const lock = await getLockState(hash)
  if (lock.locked) return { ok: false, error: 'locked', retryAfterMinutes: lock.retryAfterMinutes }

  // Aktuelles Passwort mit eigenem Client prüfen, der keine Cookies schreibt. Die dabei entstehende
  // Sitzung endet unten mit „andere Sitzungen abmelden“.
  const env = getClientEnv()
  const probe = createPlainClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error: checkError } = await probe.auth.signInWithPassword({ email, password: parsed.data.currentPassword })
  if (checkError) {
    if (checkError.status === 429) return { ok: false, error: 'locked', retryAfterMinutes: 15 }
    if (checkError.status && checkError.status >= 500) return { ok: false, error: 'unknown' }
    await recordFailure(hash, 'password')
    return { ok: false, error: 'wrongCurrentPassword' }
  }
  await clearFailures(hash)

  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error && error.code !== 'same_password') {
    return { ok: false, error: error.code === 'weak_password' ? 'weakPassword' : 'unknown' }
  }

  await supabase.auth.signOut({ scope: 'others' })
  return { ok: true }
}

// Beendet alle Sitzungen, auch die aktuelle
export async function signOutEverywhere(): Promise<ActionResult> {
  const guard = await requireAccountUser()
  if (!guard.ok) return guard.result

  const supabase = await createClient()
  const { error } = await supabase.auth.signOut({ scope: 'global' })
  if (error) return { ok: false, error: 'unknown' }
  await clearSessionLimits()
  return { ok: true, redirectTo: '/anmelden?grund=abgemeldet' }
}

// Zweites 2FA-Gerät: Einrichtung starten bzw. mit Code bestätigen (nur Admin)
export async function startAddMfaDevice(): Promise<ActionResult<Enrollment>> {
  const guard = await requireMfaAdmin()
  if (!guard.ok) return guard.result as ActionResult<Enrollment>
  return enrollTotp()
}

export async function confirmAddMfaDevice(values: OtpValues & { factorId: string }): Promise<ActionResult> {
  const parsed = otpSchema(key).safeParse(values)
  if (!parsed.success || typeof values.factorId !== 'string') return { ok: false, error: 'codeInvalid' }
  const guard = await requireMfaAdmin()
  if (!guard.ok) return guard.result

  const result = await verifyTotp(parsed.data.code, [values.factorId])
  if (result.ok) revalidatePath('/konto')
  return result
}

// Entfernt ein 2FA-Gerät; das letzte Gerät lässt sich nicht entfernen
export async function removeMfaDevice(values: { factorId: string }): Promise<ActionResult> {
  if (typeof values?.factorId !== 'string') return { ok: false, error: 'unknown' }
  const guard = await requireMfaAdmin()
  if (!guard.ok) return guard.result

  const supabase = await createClient()
  const { data } = await supabase.auth.mfa.listFactors()
  const verified = data?.totp ?? []
  if (!verified.some((f) => f.id === values.factorId)) return { ok: false, error: 'unknown' }
  if (verified.length <= 1) return { ok: false, error: 'lastFactor' }

  const { error } = await supabase.auth.mfa.unenroll({ factorId: values.factorId })
  if (error) return { ok: false, error: 'unknown' }
  revalidatePath('/konto')
  return { ok: true }
}
