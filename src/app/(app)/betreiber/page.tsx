import { Buildings, MagnifyingGlass } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { EmptyState } from '@/components/empty-state'
import { CreateTenantPanel } from '@/components/operator/create-tenant-panel'
import { TenantList } from '@/components/operator/tenant-list'
import { TenantSearch } from '@/components/operator/tenant-search'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { requireArea } from '@/lib/areas'
import { getTenantPage } from '@/lib/operator-data'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('operator')
  return { title: t('title') }
}

type SearchParams = Promise<{ q?: string | string[]; seite?: string | string[] }>
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

// Betreiber-Bereich (PROJ-5): alle Kunden mit Suche; nur für den Admin mit 2FA („Seite nicht gefunden“ für alle anderen)
export default async function OperatorPage({ searchParams }: { searchParams: SearchParams }) {
  await requireArea('operator')
  const t = await getTranslations('operator')
  const params = await searchParams
  const page = await getTenantPage({ query: first(params.q)?.slice(0, 200), page: Number(first(params.seite)) || 1 })
  const noTenants = page.total === 0 && !page.query

  return (
    <>
      <PageHeader title={t('title')} lead={t('lead')} action={!noTenants && <CreateTenantPanel />} />
      {noTenants ? (
        <EmptyState icon={Buildings} title={t('emptyTitle')} text={t('emptyText')} action={<CreateTenantPanel />} />
      ) : (
        <section className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TenantSearch query={page.query} />
            <p className="text-sm text-ds-neutral-800" aria-live="polite">
              {t('count', { count: page.total })}
            </p>
          </div>
          {page.total === 0 ? (
            <EmptyState
              icon={MagnifyingGlass}
              title={t('noResultsTitle')}
              text={t('noResultsText', { query: page.query })}
              action={
                <Button asChild variant="outline" className="min-h-11">
                  <Link href="/betreiber">{t('clearSearch')}</Link>
                </Button>
              }
            />
          ) : (
            <TenantList page={page} />
          )}
        </section>
      )}
    </>
  )
}
