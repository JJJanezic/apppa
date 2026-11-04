import 'server-only'

import { getSessionUser, pendingMfaStep } from '@/lib/auth/session'
import { getTenantContext } from '@/lib/tenant'

const isId = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f-]{36}$/i.test(value)

export type TenantSettingsAccess = { tenantId: string; operator: boolean } | null

// Inhaber des gewählten Kunden oder Betreiber (mit abgeschlossener 2FA). Sonst null.
export async function tenantSettingsAccess(tenantId: unknown): Promise<TenantSettingsAccess> {
  if (!isId(tenantId)) return null
  const user = await getSessionUser()
  if (!user || (await pendingMfaStep(user))) return null
  if (user.isOperatorAdmin) return { tenantId, operator: true }
  const { active } = await getTenantContext()
  if (!active || active.role !== 'owner' || active.id !== tenantId) return null
  return { tenantId, operator: false }
}
