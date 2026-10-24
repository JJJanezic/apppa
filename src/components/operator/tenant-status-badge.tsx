'use client'

import { useTranslations } from 'next-intl'

import { Badge } from '@/components/ui/badge'
import type { InviteState, TenantDisplayStatus } from '@/lib/operator'

const VARIANT = { active: 'default', invited: 'outline', deactivated: 'secondary' } as const

// Status eines Kunden; bei „Einladung offen“ mit Zusatz, wenn die Einladung abgelaufen ist oder fehlt
export function TenantStatusBadge({ status, inviteState }: { status: TenantDisplayStatus; inviteState: InviteState | null }) {
  const t = useTranslations('operator')
  const extra = inviteState && inviteState !== 'open' ? t(`inviteState.${inviteState}`) : null
  return (
    <span className="flex flex-col items-start gap-1">
      <Badge variant={VARIANT[status]} className="whitespace-nowrap font-normal">
        {t(`status.${status}`)}
      </Badge>
      {extra && <span className="text-[13px] text-ds-accent-2-700">{extra}</span>}
    </span>
  )
}
