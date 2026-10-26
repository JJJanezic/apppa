import { UserCircleDashed } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { OccupancyCalendar } from '@/components/calendar/occupancy-calendar'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { requireArea } from '@/lib/areas'
import { getTenantContext } from '@/lib/tenant'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('calendar')
  return { title: t('title') }
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

// Belegung im Vollbild (PROJ-9): derselbe Kalender wie auf dem Dashboard, Zeitleiste über 28 Tage
export default async function OccupancyPage({ searchParams }: { searchParams: SearchParams }) {
  await requireArea('calendar')
  const { active } = await getTenantContext()
  // Ohne Kunde (z. B. Betreiber-Admin ohne Mitgliedschaft): Hinweis wie im Dashboard
  if (!active) {
    const [t, tTenant] = await Promise.all([getTranslations('calendar'), getTranslations('tenant')])
    return (
      <>
        <PageHeader title={t('title')} />
        <EmptyState icon={UserCircleDashed} title={tTenant('noTenantTitle')} text={tTenant('noTenantText')} />
      </>
    )
  }
  return <OccupancyCalendar variant="full" searchParams={await searchParams} />
}
