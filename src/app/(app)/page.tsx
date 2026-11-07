import { LockSimple, UserCircleDashed } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { connection } from 'next/server'
import { getFormatter, getTranslations } from 'next-intl/server'
import { Suspense } from 'react'

import { OccupancyCalendar } from '@/components/calendar/occupancy-calendar'
import { DashboardKpis, DashboardKpisSkeleton, DashboardLead } from '@/components/dashboard/dashboard-kpis'
import { DashboardNotice } from '@/components/dashboard/dashboard-notice'
import { OpenInvoicesSection } from '@/components/dashboard/open-invoices-section'
import { SectionSkeleton } from '@/components/dashboard/section'
import { TenantFilter } from '@/components/dashboard/tenant-filter'
import { TodaySection } from '@/components/dashboard/today-section'
import { TouristTaxSection } from '@/components/dashboard/tourist-tax-section'
import { UnbilledSection } from '@/components/dashboard/unbilled-section'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { MyInvitations } from '@/components/tenant/my-invitations'
import { requireArea } from '@/lib/areas'
import { todayIso } from '@/lib/bookings'
import { NO_ACCESS_NOTICE } from '@/lib/dashboard'
import { type DashboardScope, getDashboardScope } from '@/lib/dashboard-data'
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

// Dashboard (Startseite). PROJ-9: Abschnitt „Belegung“ (Kalender). PROJ-14: Kacheln, „Heute“, „Noch nicht abgerechnet“,
// „Offene Rechnungen“, „Ortstaxe“ über alle Kunden der Person (Kundenfilter, Rechte je Kunde); jeder Abschnitt lädt für sich.
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
  const { weiter, hinweis, kunde } = params
  const target = safeRedirectPath(Array.isArray(weiter) ? weiter[0] : weiter, 'https://app.local')
  if (target !== '/' && isPathAvailable(new URL(target, 'https://app.local').pathname, viewerOf(shell))) redirect(target)
  const invitations = await getMyInvitations()
  const noTenant = tenant.list !== null && tenant.list.length === 0
  // Admin ohne eigenen Kunden → Betreiber-Bereich; aber nicht, solange eine Einladung an ihn offen ist,
  // sonst könnte er sie nie annehmen (sie erscheint nur hier)
  if (noTenant && person.isAdmin && invitations.length === 0) redirect('/betreiber')
  const deactivated = noTenant && (await belongsToDeactivatedTenant())
  const now = new Date()
  const today = todayIso(now)
  const scope = noTenant || deactivated ? null : await getDashboardScope(kunde)

  return (
    <>
      <PageHeader
        // Ausnahme PROJ-31: Datum unter dem Gruß bleibt ausgeschrieben
        // eslint-disable-next-line no-restricted-syntax
        eyebrow={format.dateTime(now, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        title={t(greetingFor(now), { name: person.firstName ?? 'none' })}
        lead={
          scope ? (
            <Suspense fallback={t('lead')}>
              <DashboardLead scope={scope} today={today} />
            </Suspense>
          ) : (
            t('lead')
          )
        }
      />
      {hinweis === NO_ACCESS_NOTICE && <DashboardNotice />}
      <MyInvitations invitations={invitations} />
      {deactivated ? (
        <EmptyState icon={LockSimple} title={tTenant('deactivatedTitle')} text={tTenant('deactivatedText')} />
      ) : noTenant ? (
        <EmptyState icon={UserCircleDashed} title={tTenant('noTenantTitle')} text={tTenant('noTenantText')} />
      ) : (
        scope && <DashboardBody scope={scope} today={today} params={params} />
      )}
    </>
  )
}

// Anordnung wie im Entwurf, Variante „Zeitung“ (Standard): Kacheln, Belegung in voller Breite, darunter die Abschnitte im
// Raster (auto-fit, mind. 260 px je Spalte); am Handy untereinander (PROJ-14 BUG-6)
async function DashboardBody({ scope, today, params }: { scope: DashboardScope; today: string; params: Record<string, string | string[] | undefined> }) {
  const t = await getTranslations('dashboard')
  const tenants = scope.scope.map((s) => ({ id: s.id, name: s.name }))
  const owner = scope.owned.length > 0
  return (
    <div className="flex flex-col gap-8">
      {scope.tenants.length > 1 && <TenantFilter tenants={scope.tenants.map((s) => ({ id: s.id, name: s.name }))} value={scope.filter} />}
      <Suspense fallback={<DashboardKpisSkeleton />}>
        <DashboardKpis scope={scope} today={today} />
      </Suspense>
      <div className="min-w-0">
        <OccupancyCalendar variant="dashboard" searchParams={params} tenants={tenants} />
      </div>
      <div className="grid items-start gap-8 sm:grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
        <Suspense fallback={<SectionSkeleton title={t('today.title')} />}>
          <TodaySection scope={scope} today={today} />
        </Suspense>
        {owner && (
          <Suspense fallback={<SectionSkeleton title={t('unbilled.title')} />}>
            <UnbilledSection scope={scope} today={today} />
          </Suspense>
        )}
        <Suspense fallback={<SectionSkeleton title={t('openInvoices.title')} />}>
          <OpenInvoicesSection scope={scope} />
        </Suspense>
        {owner && (
          <Suspense fallback={<SectionSkeleton title={t('tax.title')} rows={4} className="md:col-span-2" />}>
            <TouristTaxSection scope={scope} today={today} />
          </Suspense>
        )}
      </div>
    </div>
  )
}
