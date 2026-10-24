import 'server-only'

import { getSessionUser } from '@/lib/auth/session'
import type { Role } from '@/lib/navigation'
import { getTenantContext, type TenantSummary } from '@/lib/tenant'
import { firstNameOf } from '@/lib/validation/auth'

// Was der App-Rahmen über Person, Kunde und Synchronisierung wissen muss.
// PROJ-3 liefert die Person, PROJ-4 Kunde und Rolle beim gewählten Kunden; PROJ-10 füllt den Sync-Status.
export type { TenantSummary }

export type ShellInfo = {
  // role: Rolle beim gewählten Kunden; ohne Kunde „staff“ (sieht keine Inhaber-Bereiche)
  person: { name: string | null; firstName: string | null; role: Role }
  // id/name: gewählter Kunde; list: alle Kunden der Person (null nur, wenn noch nicht geladen)
  tenant: { id: string | null; name: string | null; hasOthers: boolean; list: TenantSummary[] | null }
  sync: { connections: number; problems: number }
}

export async function getShellInfo(): Promise<ShellInfo> {
  const [user, { list, active }] = await Promise.all([getSessionUser(), getTenantContext()])
  const name = user?.displayName ?? null
  return {
    person: { name, firstName: firstNameOf(name), role: active?.role ?? 'staff' },
    tenant: { id: active?.id ?? null, name: active?.name ?? null, hasOthers: list.length > 1, list },
    sync: { connections: 0, problems: 0 },
  }
}
