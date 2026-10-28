import { LockSimple, UserCircleDashed } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { getFormatter, getTranslations } from 'next-intl/server'

import { OccupancyCalendar } from '@/components/calendar/occupancy-calendar'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { MyInvitations } from '@/components/tenant/my-invitations'
import { requireArea } from '@/lib/areas'
import { greetingFor } from '@/lib/greeting'
import { isPathAvailable } from '@/lib/navigation'
import { safeRedirectPath } from '@/lib/safe-redirect'
import { getShellInfo, viewerOf } from '@/lib/shell'
import { getMyInvitations } from '@/lib/team-data'
import { belongsToDeactivatedTenant } from '@/lib/tenant'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard')
  return { title: t('title') }
}

// Dashboard (Startseite). PROJ-9: Abschnitt „Belegung“ (Kalender); weitere Inhalte folgen mit PROJ-14.
// PROJ-4: Einladungen an mich oben; ohne Kunde der Hinweis „keinem Kunden zugeordnet“.
// PROJ-5: Admin ohne eigenen Kunden startet im Betreiber-Bereich; nur deaktivierte Kunden → Hinweis „deaktiviert“.
// ?weiter=…: Rücksprung-Ziel nach der Anmeldung – nur, wenn der Bereich für die Person erreichbar ist.
export default async function DashboardPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireArea('dashboard')
  // Datum und Begrüßung bei jedem Aufruf neu berechnen (nicht beim Bauen einfrieren)
  await connection()

  const t = await getTranslations('dashboard')
  const format = await getFormatter()
  const tTenant = await getTranslations('tenant')
  const shell = await getShellInfo()
  const { person, tenant } = shell
  const params = await searchParams
  const { weiter } = params
  const target = safeRedirectPath(Array.isArray(weiter) ? weiter[0] : weiter, 'https://app.local')
  if (target !== '/' && isPathAvailable(new URL(target, 'https://app.local').pathname, viewerOf(shell))) redirect(target)
  const invitations = await getMyInvitations()
  const noTenant = tenant.list !== null && tenant.list.length === 0
  // Admin ohne eigenen Kunden → Betreiber-Bereich; aber nicht, solange eine Einladung an ihn offen ist,
  // sonst könnte er sie nie annehmen (sie erscheint nur hier)
  if (noTenant && person.isAdmin && invitations.length === 0) redirect('/betreiber')
  const deactivated = noTenant && (await belongsToDeactivatedTenant())
  const now = new Date()

  return (
    <>
      <PageHeader
        // Ausnahme PROJ-31: Datum unter dem Gruß bleibt ausgeschrieben
        // eslint-disable-next-line no-restricted-syntax
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
        <OccupancyCalendar variant="dashboard" searchParams={params} />
      )}
    </>
  )
}
