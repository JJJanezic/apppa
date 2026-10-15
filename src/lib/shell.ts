import 'server-only'

import { getSessionUser } from '@/lib/auth/session'
import type { Role } from '@/lib/navigation'
import { firstNameOf } from '@/lib/validation/auth'

// Was der App-Rahmen über Person, Kunde und Synchronisierung wissen muss.
// PROJ-3 liefert die Person; PROJ-4 (Kunde, Rolle) und PROJ-10 (Sync) füllen den Rest.
export type ShellInfo = {
  person: { name: string | null; firstName: string | null; role: Role }
  tenant: { name: string | null; hasOthers: boolean }
  sync: { connections: number; problems: number }
}

export async function getShellInfo(): Promise<ShellInfo> {
  const user = await getSessionUser()
  const name = user?.displayName ?? null
  return {
    person: { name, firstName: firstNameOf(name), role: 'owner' },
    tenant: { name: null, hasOthers: false },
    sync: { connections: 0, problems: 0 },
  }
}
