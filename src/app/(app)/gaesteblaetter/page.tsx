import { MagnifyingGlass, Signature, UserCircleDashed } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { EmptyState } from '@/components/empty-state'
import { GuestSheetFilterBar } from '@/components/guest-sheets/guest-sheet-filters'
import { GuestSheetList } from '@/components/guest-sheets/guest-sheet-list'
import { PageHeader } from '@/components/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { requireArea } from '@/lib/areas'
import { todayIso } from '@/lib/bookings'
import { guestSheetListUrl, parseGuestSheetFilters } from '@/lib/guest-sheet'
import { getGuestSheetPage, hasAnyGuestSheet } from '@/lib/guest-sheets-data'
import { getTenantContext } from '@/lib/tenant'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('guestSheets')
  return { title: t('listTitle') }
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

// Gästeblätter (PROJ-26) für Inhaber und Mitarbeiter: aktuelle Blätter nach Monat der Ankunft, Suche und „Gästeblatt fehlt“.
// Entstehen und Hochladen geschieht in der Buchung.
export default async function GuestSheetsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireArea('guestSheets')
  const t = await getTranslations('guestSheets')
  const { active } = await getTenantContext()
  if (!active) {
    const tTenant = await getTranslations('tenant')
    return (
      <>
        <PageHeader title={t('listTitle')} />
        <EmptyState icon={UserCircleDashed} title={tTenant('noTenantTitle')} text={tTenant('noTenantText')} />
      </>
    )
  }
  const today = todayIso()
  const filters = parseGuestSheetFilters(await searchParams, today)
  const [page, any] = await Promise.all([getGuestSheetPage(filters), hasAnyGuestSheet()])
  const rows = filters.missing ? page.missingRows : page.rows

  return (
    <>
      <PageHeader title={t('listTitle')} lead={t('listLead')} />
      {!page.ready && (
        <Alert>
          <AlertDescription>{t('notReady')}</AlertDescription>
        </Alert>
      )}
      {!any && !filters.missing ? (
        <section className="flex flex-col gap-4">
          <GuestSheetFilterBar filters={filters} today={today} />
          <EmptyState icon={Signature} title={t('list.emptyTitle')} text={t('list.emptyText')} />
        </section>
      ) : (
        <section className="flex flex-col gap-4">
          <GuestSheetFilterBar filters={filters} today={today} />
          <p className="text-sm text-ds-neutral-800" aria-live="polite">
            {filters.missing ? t('list.missingCount', { count: page.total }) : t('list.count', { count: page.total })}
          </p>
          {rows.length === 0 ? (
            <EmptyState
              icon={MagnifyingGlass}
              title={filters.missing ? t('list.noMissingTitle') : t('list.noResultsTitle')}
              text={filters.missing ? t('list.noMissingText') : filters.query ? t('list.noResultsFiltered') : t('list.noResultsPeriod')}
              action={
                filters.query ? (
                  <Button asChild variant="outline" className="min-h-11">
                    <Link href={guestSheetListUrl({ month: filters.month, missing: filters.missing }, today)}>{t('list.clearSearch')}</Link>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <GuestSheetList page={page} today={today} />
          )}
        </section>
      )}
    </>
  )
}
