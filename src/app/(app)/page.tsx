import { Notebook } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import { connection } from 'next/server'
import { getFormatter, getTranslations } from 'next-intl/server'

import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { requireArea } from '@/lib/areas'
import { greetingFor } from '@/lib/greeting'
import { getShellInfo } from '@/lib/shell'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('dashboard')
  return { title: t('title') }
}

// Dashboard (Startseite). Inhalte folgen mit PROJ-14; bis dahin Leerzustand.
export default async function DashboardPage() {
  await requireArea('dashboard')
  // Datum und Begrüßung bei jedem Aufruf neu berechnen (nicht beim Bauen einfrieren)
  await connection()

  const t = await getTranslations('dashboard')
  const format = await getFormatter()
  const { person } = await getShellInfo()
  const now = new Date()

  return (
    <>
      <PageHeader
        eyebrow={format.dateTime(now, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        title={t(greetingFor(now), { name: person.firstName ?? 'none' })}
        lead={t('lead')}
      />
      <EmptyState icon={Notebook} title={t('emptyTitle')} text={t('emptyText')} />
    </>
  )
}
