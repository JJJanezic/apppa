import { LockSimple, Notebook, UserCircleDashed } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { getFormatter, getTranslations } from 'next-intl/server'

import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { MyInvitations } from '@/components/tenant/my-invitations'
import { requireArea } from '@/lib/areas'
import { greetingFor } from '@/lib/greeting'
import { getShellInfo } from '@/lib/shell'
import { getMyInvitations } from '@/lib/team-data'
import { belongsToDeactivatedTenant } from '@/lib/tenant'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard')
  return { title: t('title') }
}

// Dashboard (Startseite). Inhalte folgen mit PROJ-14; bis dahin Leerzustand.
// PROJ-4: Einladungen an mich oben; ohne Kunde der Hinweis „keinem Kunden zugeordnet“.
// PROJ-5: Admin ohne eigenen Kunden startet im Betreiber-Bereich; nur deaktivierte Kunden → Hinweis „deaktiviert“.
export default async function DashboardPage() {
  await requireArea('dashboard')
  // Datum und Begrüßung bei jedem Aufruf neu berechnen (nicht beim Bauen einfrieren)
  await connection()

  const t = await getTranslations('dashboard')
  const format = await getFormatter()
  const tTenant = await getTranslations('tenant')
  const { person, tenant } = await getShellInfo()
  const invitations = await getMyInvitations()
  const noTenant = tenant.list !== null && tenant.list.length === 0
  if (noTenant && person.isAdmin) redirect('/betreiber')
  const deactivated = noTenant && (await belongsToDeactivatedTenant())
  const now = new Date()

  return (
    <>
      <PageHeader
        eyebrow={format.dateTime(now, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        title={t(greetingFor(now), { name: person.firstName ?? 'none' })}
        lead={t('lead')}
      />
      <MyInvitations invitations={invitations} />
      {deactivated ? (
        <EmptyState icon={LockSimple} title={tTenant('deactivatedTitle')} text={tTenant('deactivatedText')} />
      ) : noTenant ? (
        <EmptyState icon={UserCircleDashed} title={tTenant('noTenantTitle')} text={tTenant('noTenantText')} />
      ) : (
        <EmptyState icon={Notebook} title={t('emptyTitle')} text={t('emptyText')} />
      )}
    </>
  )
}
