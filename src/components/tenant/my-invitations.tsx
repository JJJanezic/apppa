'use client'

import { EnvelopeSimpleOpen } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'

import { acceptInvitation, declineInvitation } from '@/app/(app)/tenant-actions'
import { useTeamAction } from '@/components/settings/use-team-action'
import { Button } from '@/components/ui/button'
import type { MyInvitation } from '@/lib/team'

// Einladungen an die angemeldete Person (bestehendes Konto): annehmen oder ablehnen
export function MyInvitations({ invitations }: { invitations: MyInvitation[] }) {
  const t = useTranslations('tenant')
  const tRoles = useTranslations('roles')
  const { run, pending } = useTeamAction()

  if (invitations.length === 0) return null

  return (
    <section aria-labelledby="einladungen-an-mich" className="flex flex-col gap-3">
      <h2 id="einladungen-an-mich" className="text-xl">
        {t('invitationsTitle')}
      </h2>
      <ul className="flex flex-col gap-3">
        {invitations.map((invitation) => (
          <li key={invitation.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-ds-accent-100 p-4">
            <EnvelopeSimpleOpen size={24} weight="duotone" aria-hidden="true" className="text-ds-accent-700" />
            <p className="min-w-0 flex-1 basis-60">
              {t('invitationText', {
                inviter: invitation.invitedBy ?? 'none',
                role: tRoles(invitation.role),
                tenant: invitation.tenantName,
              })}
            </p>
            <div className="flex gap-2">
              <Button
                className="min-h-11"
                disabled={pending}
                onClick={() => run(() => acceptInvitation({ invitationId: invitation.id }), t('accepted', { tenant: invitation.tenantName }))}
              >
                {t('accept')}
              </Button>
              <Button
                variant="ghost"
                className="min-h-11"
                disabled={pending}
                onClick={() => run(() => declineInvitation({ invitationId: invitation.id }), t('declined'))}
              >
                {t('decline')}
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
