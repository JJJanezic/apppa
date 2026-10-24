'use client'

import { DotsThreeVertical } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { changeMember } from '@/app/(app)/betreiber/actions'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { useTeamAction } from '@/components/settings/use-team-action'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  type OperatorMember,
  type OperatorMemberAction,
  operatorMemberActions,
  type OperatorMemberState,
} from '@/lib/operator'

interface OperatorMembersProps {
  tenantId: string
  members: OperatorMember[]
  // deaktivierte Kunden: nur ansehen
  readOnly: boolean
}

// Mitglieder eines Kunden aus Sicht des Betreibers: ab 768 px Tabelle, darunter Karten.
// Aktionen nur für Inhaber-Fragen (befördern, herabstufen, entfernen); Mitarbeiter verwalten die Inhaber.
export function OperatorMembers({ tenantId, members, readOnly }: OperatorMembersProps) {
  const t = useTranslations('operator')
  const tTeam = useTranslations('team')
  const tRoles = useTranslations('roles')

  if (members.length === 0) return <p className="text-ds-neutral-800">{t('noMembers')}</p>

  const ownerCount = members.filter((m) => m.role === 'owner').length
  const rows = members.map((member) => ({
    member,
    state: readOnly ? { actions: [], blocked: null } : operatorMemberActions(member, ownerCount),
  }))
  const nameOf = (member: OperatorMember) => member.name ?? <span className="text-ds-neutral-700">{tTeam('noName')}</span>
  const roleOf = (member: OperatorMember) => (
    <Badge variant={member.role === 'owner' ? 'default' : 'secondary'} className="font-normal">
      {tRoles(member.role)}
    </Badge>
  )
  const hint = (state: OperatorMemberState) =>
    state.blocked === 'lastOwner' ? <p className="text-[13px] text-ds-neutral-700">{t('lastOwnerHint')}</p> : null

  return (
    <>
      <Table className="hidden md:table">
        <TableHeader>
          <TableRow>
            <TableHead>{tTeam('colName')}</TableHead>
            <TableHead>{tTeam('colEmail')}</TableHead>
            <TableHead>{tTeam('colRole')}</TableHead>
            <TableHead className="w-[1%] text-right">
              <span className="sr-only">{tTeam('colActions')}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(({ member, state }) => (
            <TableRow key={member.userId}>
              <TableCell className="font-medium">{nameOf(member)}</TableCell>
              <TableCell className="break-all">{member.email}</TableCell>
              <TableCell className="max-w-[320px]">
                <div className="flex flex-col items-start gap-1.5">
                  {roleOf(member)}
                  {hint(state)}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <MemberMenu tenantId={tenantId} member={member} state={state} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map(({ member, state }) => (
          <li key={member.userId} className="flex flex-col gap-2 rounded-lg bg-ds-surface p-4">
            <div className="flex items-start gap-2">
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="font-medium">{nameOf(member)}</span>
                <span className="break-all text-sm text-ds-neutral-800">{member.email}</span>
                <span>{roleOf(member)}</span>
              </div>
              <MemberMenu tenantId={tenantId} member={member} state={state} />
            </div>
            {hint(state)}
          </li>
        ))}
      </ul>
    </>
  )
}

function MemberMenu({ tenantId, member, state }: { tenantId: string; member: OperatorMember; state: OperatorMemberState }) {
  const t = useTranslations('operator')
  const { run, pending } = useTeamAction('operator.errors')
  const [confirming, setConfirming] = useState<OperatorMemberAction | null>(null)
  const name = member.name ?? member.email

  if (state.actions.length === 0) return null

  async function confirm(action: OperatorMemberAction) {
    setConfirming(null)
    const done = { promote: 'done.promoted', demote: 'done.demoted', remove: 'done.removed' } as const
    await run(() => changeMember({ tenantId, userId: member.userId, action }), t(done[action], { name }))
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
