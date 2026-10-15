// Daten für „Mein Konto“ (PROJ-3). Frontend-Stand: Platzhalter; /backend liest sie aus Supabase
// (Login-Konto, Profil, Admin-Kennzeichen, 2FA-Geräte).

export type MfaDevice = { id: string; name: string | null; createdAt: string }

export type AccountInfo = {
  email: string | null
  displayName: string | null
  isOperatorAdmin: boolean
  mfaDevices: MfaDevice[]
}

export async function getAccountInfo(): Promise<AccountInfo> {
  return { email: null, displayName: null, isOperatorAdmin: false, mfaDevices: [] }
}
