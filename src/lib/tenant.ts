import 'server-only'

import { cookies } from 'next/headers'
import { cache } from 'react'

import { getSessionUser } from '@/lib/auth/session'
import type { Role } from '@/lib/navigation'
import { createClient } from '@/lib/supabase/server'

// Gewählter Kunde (PROJ-4). Ein Cookie merkt sich je Gerät, welcher Kunde zuletzt offen war; der Server prüft
// bei jedem Aufruf gegen die Mitgliedschaften. Das Cookie entscheidet nur, *welcher* Kunde angezeigt wird –
// was erlaubt ist, prüft weiterhin die Datenbank (RLS).

export const TENANT_COOKIE = 'apppa-kunde'

export type TenantSummary = { id: string; name: string; role: Role }
export type TenantContext = { list: TenantSummary[]; active: TenantSummary | null }

export const getTenantContext = cache(async (): Promise<TenantContext> => {
  const user = await getSessionUser()
  if (!user) return { list: [], active: null }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('memberships')
    .select('role, tenant:tenants!inner(id, name, status)')
    .eq('user_id', user.userId)
    .limit(200)
  if (error) console.error('[tenant] Mitgliedschaften nicht lesbar', error.message)

  const list = (data ?? [])
    .filter((m) => m.tenant.status === 'active')
    .map((m) => ({ id: m.tenant.id, name: m.tenant.name, role: m.role }))
    .sort((a, b) => a.name.localeCompare(b.name, 'de'))

  const chosen = (await cookies()).get(TENANT_COOKIE)?.value
  const active = list.find((t) => t.id === chosen) ?? list[0] ?? null
  return { list, active }
})

// Nur in Server-Aktionen aufrufen (Cookies lassen sich in Seiten nicht setzen)
export async function rememberTenant(tenantId: string | null): Promise<void> {
  const store = await cookies()
  if (!tenantId) {
    store.delete(TENANT_COOKIE)
    return
  }
  store.set(TENANT_COOKIE, tenantId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 365 * 24 * 60 * 60,
  })
}
