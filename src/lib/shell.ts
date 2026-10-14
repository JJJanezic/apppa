import type { Role } from '@/lib/navigation'

// Was der App-Rahmen über Person, Kunde und Synchronisierung wissen muss.
// PROJ-2 liefert Platzhalter; PROJ-3 (Person), PROJ-4 (Kunde, Rolle) und PROJ-10 (Sync) füllen sie mit echten Daten.
export type ShellInfo = {
  person: { name: string | null; firstName: string | null; role: Role }
  tenant: { name: string | null; hasOthers: boolean }
  sync: { connections: number; problems: number }
}

export async function getShellInfo(): Promise<ShellInfo> {
  return {
    person: { name: null, firstName: null, role: 'owner' },
    tenant: { name: null, hasOthers: false },
    sync: { connections: 0, problems: 0 },
  }
}
