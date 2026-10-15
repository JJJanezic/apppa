import 'server-only'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'

import { SESSION_COOKIE, sessionCookieOptions, startSession } from '@/lib/auth/session-limits'
import { getServerEnv } from '@/lib/env'
import { createClient } from '@/lib/supabase/server'

type ServerClient = Awaited<ReturnType<typeof createClient>>

export type SessionUser = {
  userId: string
  email: string | null
  aal: 'aal1' | 'aal2'
  displayName: string | null
  isOperatorAdmin: boolean
}

// Angemeldete Person samt Profil – einmal pro Anfrage (React cache).
// getClaims prüft die Signatur des Tokens; getSession allein wäre auf dem Server nicht vertrauenswürdig.
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (!claims?.sub) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, is_operator_admin')
    .eq('id', claims.sub)
    .maybeSingle()

  return {
    userId: claims.sub,
    email: typeof claims.email === 'string' ? claims.email : null,
    aal: claims.aal === 'aal2' ? 'aal2' : 'aal1',
    displayName: profile?.display_name ?? null,
    isOperatorAdmin: profile?.is_operator_admin ?? false,
  }
})

// Hat das Konto ein bestätigtes Authenticator-Gerät? (listFactors fragt Supabase, nicht das Cookie)
export async function hasVerifiedTotp(supabase: ServerClient): Promise<boolean> {
  const { data } = await supabase.auth.mfa.listFactors()
  return (data?.totp.length ?? 0) > 0
}

// Pflicht-2FA des Betreiber-Admins: Wohin, solange die Sitzung nicht mit Code bestätigt ist?
// null = kein 2FA-Schritt nötig
export async function pendingMfaStep(user: SessionUser, supabase?: ServerClient): Promise<'/2fa' | '/2fa/einrichten' | null> {
  if (!user.isOperatorAdmin || user.aal === 'aal2') return null
  return (await hasVerifiedTotp(supabase ?? (await createClient()))) ? '/2fa' : '/2fa/einrichten'
}

// App-Seiten (Rahmen): ohne Sitzung zur Anmeldung, Admin ohne bestätigten Code zur 2FA
export async function requireAppUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) redirect('/anmelden')
  const step = await pendingMfaStep(user)
  if (step) redirect(step)
  return user
}

// Beginn der Sitzungsgrenzen (30 Tage / 8 h) nach Anmeldung oder eingelöstem Mail-Link
export async function startSessionLimits(userId: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, startSession(userId, getServerEnv().SUPABASE_SECRET_KEY), sessionCookieOptions)
}

export async function clearSessionLimits(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(SESSION_COOKIE)
}
