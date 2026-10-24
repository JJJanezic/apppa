'use client'

import { useFormatter, useTranslations } from 'next-intl'
import { useState } from 'react'

import { resendInvitation, revokeInvitation } from '@/app/(app)/einstellungen/actions'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { useTeamAction } from '@/components/settings/use-team-action'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { Invitation } from '@/lib/team'

// Offene und abgelaufene Einladungen mit „Erneut senden“ und „Zurückziehen“
export function InvitationsList({ invitations }: { invitations: Invitation[] }) {
  const t = useTranslations('team')
  const tRoles = useTranslations('roles')
  const format = useFormatter()
  const { run, pending } = useTeamAction()
  const [revoking, setRevoking] = useState<Invitation | null>(null)

  if (invitations.length === 0) return <p className="text-ds-neutral-800">{t('noInvitations')}</p>

  async function revoke(invitation: Invitation) {
    setRevoking(null)
    await run(() => revokeInvitation({ invitationId: invitation.id }), t('done.revoked'))
  }

  return (
    <>
      <ul className="flex flex-col divide-y rounded-lg bg-ds-surface">
        {invitations.map((invitation) => (
          <li key={invitation.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <div className="flex min-w-0 flex-1 basis-60 flex-col gap-1">
              <span className="break-all font-medium">{invitation.email}</span>
              <span className="flex flex-wrap items-center gap-2 text-[13px] text-ds-neutral-700">
                {tRoles(invitation.role)} ·{' '}
                {t('colSent')} {format.dateTime(new Date(invitation.sentAt), { day: 'numeric', month: 'long', year: 'numeric' })}
                <Badge
                  variant={invitation.status === 'expired' ? 'destructive' : 'outline'}
                  className="font-normal"
                >
                  {t(invitation.status === 'expired' ? 'statusExpired' : 'statusOpen')}
                </Badge>
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="min-h-11"
                disabled={pending}
                onClick={() => run(() => resendInvitation({ invitationId: invitation.id }), t('done.resent'))}
              >
                {t('actions.resend')}
              </Button>
              <Button variant="ghost" className="min-h-11" disabled={pending} onClick={() => setRevoking(invitation)}>
                {t('actions.revoke')}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {revoking && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setRevoking(null)}
          title={t('confirm.revokeTitle', { email: revoking.email })}
          text={t('confirm.revokeText')}
          confirmLabel={t('actions.revoke')}
          cancelLabel={t('confirm.cancel')}
          onConfirm={() => revoke(revoking)}
        />
      )}
    </>
  )
}
