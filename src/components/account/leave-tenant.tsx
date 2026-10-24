'use client'

import { SignOut } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { leaveTenant } from '@/app/(app)/einstellungen/actions'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { useTeamAction } from '@/components/settings/use-team-action'
import { Button } from '@/components/ui/button'

interface LeaveTenantProps {
  tenantName: string
  // Letzter Inhaber: Austreten gesperrt (Hinweis statt Knopf)
  lastOwner: boolean
}

// „Kunde verlassen“ unter Mein Konto – für Mitarbeiter und Inhaber (Team-Seite sehen nur Inhaber)
export function LeaveTenant({ tenantName, lastOwner }: LeaveTenantProps) {
  const t = useTranslations('account')
  const tTeam = useTranslations('team')
  const { run, pending } = useTeamAction()
  const [confirming, setConfirming] = useState(false)

  if (lastOwner) return <p className="text-sm text-ds-neutral-700">{tTeam('lastOwnerHint')}</p>

  return (
    <>
      <Button variant="outline" className="min-h-11 self-start" disabled={pending} onClick={() => setConfirming(true)}>
        <SignOut size={18} aria-hidden="true" />
        {t('leaveTenantButton', { tenant: tenantName })}
      </Button>
      {confirming && (
        <ConfirmDialog
          open
          onOpenChange={setConfirming}
          title={t('leaveTenantConfirmTitle', { tenant: tenantName })}
          text={tTeam('confirm.leaveText')}
          confirmLabel={tTeam('actions.leave')}
          cancelLabel={tTeam('confirm.cancel')}
          onConfirm={() => {
            setConfirming(false)
            run(() => leaveTenant(), tTeam('done.left'))
          }}
        />
      )}
    </>
  )
}
