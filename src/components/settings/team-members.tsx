'use client'

import { useTranslations } from 'next-intl'

import { BlockedHint, MemberActions } from '@/components/settings/member-actions'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Role } from '@/lib/navigation'
import type { TeamMember } from '@/lib/team'
import { memberActions } from '@/lib/team-rules'

interface TeamMembersProps {
  members: TeamMember[]
  viewerRole: Role
}

// Mitglieder des gewählten Kunden: ab 768 px Tabelle, darunter Karten
export function TeamMembers({ members, viewerRole }: TeamMembersProps) {
  const t = useTranslations('team')
  const tRoles = useTranslations('roles')
  const ownerCount = members.filter((m) => m.role === 'owner').length
  const rows = members.map((member) => ({ member, state: memberActions(member, viewerRole, ownerCount) }))

  const nameOf = (member: TeamMember) => (
    <>
      {member.name ?? <span className="text-ds-neutral-700">{t('noName')}</span>}
      {member.isSelf && <span className="text-ds-neutral-700"> {t('you')}</span>}
    </>
  )
  const roleOf = (role: Role) => (
    <Badge variant={role === 'owner' ? 'default' : 'secondary'} className="font-normal">
      {tRoles(role)}
    </Badge>
  )

  return (
    <>
      <Table className="hidden md:table">
        <TableHeader>
          <TableRow>
            <TableHead>{t('colName')}</TableHead>
            <TableHead>{t('colEmail')}</TableHead>
            <TableHead>{t('colRole')}</TableHead>
            <TableHead className="w-[1%] text-right">
              <span className="sr-only">{t('colActions')}</span>
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
                  {roleOf(member.role)}
                  <BlockedHint state={state} />
                </div>
              </TableCell>
              <TableCell className="text-right">
                <MemberActions member={member} state={state} />
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
                <span>{roleOf(member.role)}</span>
              </div>
              <MemberActions member={member} state={state} />
            </div>
            <BlockedHint state={state} />
          </li>
        ))}
      </ul>
    </>
  )
}
