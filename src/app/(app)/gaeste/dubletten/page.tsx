import { CaretLeft, CheckCircle } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { EmptyState } from '@/components/empty-state'
import { DuplicateList } from '@/components/guests/duplicate-list'
import { PageHeader } from '@/components/page-header'
import { requireArea } from '@/lib/areas'
import { getDuplicatePairs } from '@/lib/guests-data'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('guests.duplicates')
  return { title: t('title') }
}

// Mögliche Dubletten (PROJ-7), nur für Inhaber (Mitarbeiter: „Seite nicht gefunden“, siehe App-Rahmen)
export default async function DuplicatesPage() {
  await requireArea('guests')
  const t = await getTranslations('guests')
  const pairs = await getDuplicatePairs()

  return (
    <>
      <Link href="/gaeste" className="-mb-6 flex min-h-11 w-fit items-center gap-1.5 text-ds-accent-700 underline-offset-[3px] hover:underline">
        <CaretLeft size={16} weight="bold" aria-hidden="true" />
        {t('back')}
      </Link>
      <PageHeader title={t('duplicates.title')} lead={t('duplicates.lead')} />
      {pairs.length === 0 ? (
        <EmptyState icon={CheckCircle} title={t('duplicates.emptyTitle')} text={t('duplicates.emptyText')} />
      ) : (
        <DuplicateList pairs={pairs} />
      )}
    </>
  )
}
