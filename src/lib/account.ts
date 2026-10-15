import 'server-only'

import { createClient } from '@/lib/supabase/server'

// Daten für „Mein Konto“ (PROJ-3): Login-Konto, Profil, Admin-Kennzeichen, 2FA-Geräte

export type MfaDevice = { id: string; name: string | null; createdAt: string }

export type AccountInfo = {
  email: string | null
  displayName: string | null
  isOperatorAdmin: boolean
  mfaDevices: MfaDevice[]
}

export async function getAccountInfo(): Promise<AccountInfo> {
  const supabase = await createClient()
  // getUser fragt Supabase direkt: aktuelle E-Mail-Adresse und Geräteliste
  const { data } = await supabase.auth.getUser()
  const user = data.user
  if (!user) return { email: null, displayName: null, isOperatorAdmin: false, mfaDevices: [] }

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, is_operator_admin')
    .eq('id', user.id)
    .maybeSingle()

  const mfaDevices = (user.factors ?? [])
    .filter((f) => f.factor_type === 'totp' && f.status === 'verified')
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    // Die Namen sind technisch (eindeutig für Supabase); die Oberfläche nummeriert die Geräte
    .map((f) => ({ id: f.id, name: null, createdAt: f.created_at }))

  return {
    email: user.email ?? null,
    displayName: profile?.display_name ?? null,
    isOperatorAdmin: profile?.is_operator_admin ?? false,
    mfaDevices,
  }
}
