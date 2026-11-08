import { Buildings, MagnifyingGlass, UserCircleDashed } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { CompanyList } from '@/components/companies/company-list'
import { CompanySearch } from '@/components/companies/company-search'
import { CreateCompanyButton } from '@/components/companies/create-company-button'
import { EmptyState } from '@/components/empty-state'
import { DeletedNotice } from '@/components/guests/deleted-notice'
import { GuestTabs } from '@/components/guests/guest-tabs'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { requireArea } from '@/lib/areas'
import { COMPANY_LIST, parseCompanyFilters } from '@/lib/companies'
import { countCompanyDuplicates, getCompanyPage, hasAnyCompany } from '@/lib/companies-data'
import { getTenantContext } from '@/lib/tenant'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('companies')
  return { title: t('title') }
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

// Firmenliste (PROJ-50), Reiter „Firmen“ unter „Gäste“: für alle Mitglieder; Anlegen und Dubletten nur für Inhaber
export default async function CompaniesPage({ searchParams }: { searchParams: SearchParams }) {
  await requireArea('guests')
  const t = await getTranslations('companies')
  const tg = await getTranslations('guests')
  const { active } = await getTenantContext()
  if (!active) {
    const tTenant = await getTranslations('tenant')
    return (
      <>
        <PageHeader title={tg('title')} />
        <EmptyState icon={UserCircleDashed} title={tTenant('noTenantTitle')} text={tTenant('noTenantText')} />
      </>
    )
  }
  const isOwner = active.role === 'owner'
  const filters = parseCompanyFilters(await searchParams)
  const [page, anyCompany, duplicates] = await Promise.all([getCompanyPage(filters), hasAnyCompany(), countCompanyDuplicates()])
  const header = (
    <>
      <DeletedNotice message={t('done.deleted')} />
      <PageHeader title={tg('title')} lead={t('lead')} action={isOwner && <CreateCompanyButton />} />
      <GuestTabs />
    </>
  )

  if (!anyCompany) {
    return (
      <>
        {header}
        <EmptyState
          icon={Buildings}
          title={t('list.emptyTitle')}
          text={isOwner ? t('list.emptyTextOwner') : t('list.emptyTextStaff')}
          action={isOwner ? <CreateCompanyButton /> : undefined}
        />
      </>
    )
  }

  return (
    <>
      {header}
      <section className="flex flex-col gap-4">
        <CompanySearch filters={page} />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ds-neutral-800" aria-live="polite">
            {t('list.count', { count: page.total })}
          </p>
          {duplicates > 0 && (
            <Link href={`${COMPANY_LIST}/dubletten`} className="flex min-h-11 items-center text-sm text-ds-accent-700 underline underline-offset-[3px]">
              {t('list.duplicatesLink', { count: duplicates })}
            </Link>
          )}
        </div>
        {page.total === 0 ? (
          <EmptyState
            icon={MagnifyingGlass}
            title={t('list.noResultsTitle')}
            text={t('list.noResultsText')}
            action={
              <Button asChild variant="outline" className="min-h-11">
                <Link href={COMPANY_LIST}>{t('list.clearSearch')}</Link>
              </Button>
            }
          />
        ) : (
          <CompanyList page={page} />
        )}
      </section>
    </>
  )
}
