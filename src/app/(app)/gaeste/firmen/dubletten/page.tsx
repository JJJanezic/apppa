import { CaretLeft, CheckCircle } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { CompanyDuplicateList } from '@/components/companies/company-duplicate-list'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { requireArea } from '@/lib/areas'
import { COMPANY_LIST } from '@/lib/companies'
import { getCompanyDuplicatePairs } from '@/lib/companies-data'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('companies.duplicates')
  return { title: t('title') }
}

// Mögliche doppelte Firmen (PROJ-50), nur für Inhaber (Mitarbeiter: „Seite nicht gefunden“)
export default async function CompanyDuplicatesPage() {
  await requireArea('guests')
  const t = await getTranslations('companies')
  const pairs = await getCompanyDuplicatePairs()

  return (
    <>
      <Link href={COMPANY_LIST} className="-mb-6 flex min-h-11 w-fit items-center gap-1.5 text-ds-accent-700 underline-offset-[3px] hover:underline">
        <CaretLeft size={16} weight="bold" aria-hidden="true" />
        {t('back')}
      </Link>
      <PageHeader title={t('duplicates.title')} lead={t('duplicates.lead')} />
      {pairs.length === 0 ? (
        <EmptyState icon={CheckCircle} title={t('duplicates.emptyTitle')} text={t('duplicates.emptyText')} />
      ) : (
        <CompanyDuplicateList pairs={pairs} />
      )}
    </>
  )
}
