import { inject } from 'vitest'

import { anonClient, type Client, type TestUser } from './helpers'

// Gemeinsame Anmeldungen aus global-setup.ts: Jede Rolle meldet sich je Testlauf nur einmal an
// (Supabase erlaubt 30 Anmeldungen je 5 Minuten). Die Dateien legen ihre eigenen Kunden an und nehmen
// die Nutzer dort als Mitglieder auf; Abfragen müssen deshalb auf diese Kunden eingeschränkt sein.
// Tests, die alle Kunden einer Person prüfen oder die Sitzung ändern, legen eigene Nutzer an.
// ownerA, staffA, ownerB: Inhaber und Mitarbeiter · adminAal2/adminAal1: Betreiber-Admin mit/ohne 2FA-Bestätigung
export type SharedRole = 'ownerA' | 'staffA' | 'ownerB' | 'adminAal2' | 'adminAal1'
export type SharedSession = { user: TestUser; accessToken: string; refreshToken: string }

declare module 'vitest' {
  export interface ProvidedContext {
    sharedSessions: Record<SharedRole, SharedSession> | null
  }
}

export async function sharedClient(role: SharedRole): Promise<{ user: TestUser; client: Client }> {
  const session = inject('sharedSessions')?.[role]
  if (!session) throw new Error('Gemeinsame Anmeldung fehlt (supabase/tests/global-setup.ts)')
  const client = anonClient()
  const { error } = await client.auth.setSession({ access_token: session.accessToken, refresh_token: session.refreshToken })
  if (error) throw error
  return { user: session.user, client }
}
