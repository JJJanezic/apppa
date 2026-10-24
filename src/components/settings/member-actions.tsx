'use client'

import { DotsThreeVertical } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { demoteSelf, leaveTenant, promoteMember, removeMember } from '@/app/(app)/einstellungen/actions'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { useTeamAction } from '@/components/settings/use-team-action'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import type { TeamMember } from '@/lib/team'
import type { MemberAction, MemberActionState } from '@/lib/team-rules'

interface MemberActionsProps {
  member: TeamMember
  state: MemberActionState
}

// Aktionen-Menü einer Zeile; jede Aktion mit Bestätigung (Hinweis bei fehlenden Aktionen: BlockedHint)
export function MemberActions({ member, state }: MemberActionsProps) {
  const t = useTranslations('team')
  const { run, pending } = useTeamAction()
  const [confirming, setConfirming] = useState<MemberAction | null>(null)
  const name = member.name ?? member.email

  if (state.actions.length === 0) return null

  async function confirm(action: MemberAction) {
    setConfirming(null)
    if (action === 'promote') await run(() => promoteMember({ userId: member.userId }), t('done.promoted', { name }))
    if (action === 'remove') await run(() => removeMember({ userId: member.userId }), t('done.removed', { name }))
    if (action === 'demoteSelf') await run(() => demoteSelf(), t('done.demoted'))
    if (action === 'leave') await run(() => leaveTenant(), t('done.left'))
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="size-11" disabled={pending} aria-label={t('actionsFor', { name })}>
            <DotsThreeVertical size={20} weight="bold" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {state.actions.map((action) => (
            <DropdownMenuItem key={action} className="min-h-11" onSelect={() => setConfirming(action)}>
              {t(`actions.${action}`)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {confirming && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setConfirming(null)}
          title={t(`confirm.${confirming}Title`, { name })}
          text={t(`confirm.${confirming}Text`, { name })}
          confirmLabel={t(`actions.${confirming}`)}
          cancelLabel={t('confirm.cancel')}
          onConfirm={() => confirm(confirming)}
        />
      )}
    </>
  )
}

// Warum es für ein Mitglied keine Aktionen gibt (anderer Inhaber, letzter Inhaber)
export function BlockedHint({ state }: { state: MemberActionState }) {
  const t = useTranslations('team')
  if (state.actions.length > 0 || !state.blocked) return null
  return <p className="text-[13px] text-ds-neutral-700">{t(state.blocked === 'lastOwner' ? 'lastOwnerHint' : 'otherOwnerHint')}</p>
}
