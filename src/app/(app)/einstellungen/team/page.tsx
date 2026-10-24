import { UsersThree } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { EmptyState } from '@/components/empty-state'
import { InvitationsList } from '@/components/settings/invitations-list'
import { InvitePanel } from '@/components/settings/invite-panel'
import { TeamMembers } from '@/components/settings/team-members'
import { getTeam } from '@/lib/team-data'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('team')
  return { title: t('title') }
}

// Team des gewählten Kunden: Mitglieder, offene Einladungen, „Person einladen“
export default async function TeamPage() {
  const t = await getTranslations('team')
  const team = await getTeam()
  const alone = team.members.length <= 1 && team.invitations.length === 0

  return (
    <div className="flex flex-col gap-10">
      {alone ? (
        <EmptyState icon={UsersThree} title={t('emptyTitle')} text={t('emptyText')} action={<InvitePanel />} />
      ) : (
        <>
          <section className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl">{t('membersTitle')}</h2>
              <InvitePanel />
            </div>
            <TeamMembers members={team.members} viewerRole={team.viewerRole} />
          </section>
          <section className="flex flex-col gap-4">
            <h2 className="text-2xl">{t('invitationsTitle')}</h2>
            <InvitationsList invitations={team.invitations} />
          </section>
        </>
      )}
    </div>
  )
}
