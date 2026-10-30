import { MagnifyingGlass, Receipt, UserCircleDashed } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { EmptyState } from '@/components/empty-state'
import { NewInvoiceButton } from '@/components/invoices/invoice-buttons'
import { InvoiceList } from '@/components/invoices/invoice-list'
import { InvoiceSearch } from '@/components/invoices/invoice-search'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { requireArea } from '@/lib/areas'
import { todayIso } from '@/lib/bookings'
import { parseInvoiceFilters } from '@/lib/invoices'
import { getInvoiceBackfillEnabled, getInvoicePage, hasAnyInvoice } from '@/lib/invoices-data'
import { getTenantContext } from '@/lib/tenant'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('invoices')
  return { title: t('title') }
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

// Rechnungsliste (PROJ-37) für alle Mitglieder; „Rechnung nacherfassen“ nur für Inhaber bei eingeschaltetem Schalter
export default async function InvoicesPage({ searchParams }: { searchParams: SearchParams }) {
  await requireArea('invoices')
  const t = await getTranslations('invoices')
  const { active } = await getTenantContext()
  // Ohne Kunde (z. B. Betreiber-Admin ohne Mitgliedschaft): Hinweis wie im Dashboard statt „Seite nicht gefunden“
  if (!active) {
    const tTenant = await getTranslations('tenant')
    return (
      <>
        <PageHeader title={t('title')} />
        <EmptyState icon={UserCircleDashed} title={tTenant('noTenantTitle')} text={tTenant('noTenantText')} />
      </>
    )
  }
  const owner = active.role === 'owner'
  const filters = parseInvoiceFilters(await searchParams)
  const [page, anyInvoice, backfill] = await Promise.all([getInvoicePage(filters), hasAnyInvoice(), getInvoiceBackfillEnabled()])
  const action = owner && backfill ? <NewInvoiceButton today={todayIso()} /> : undefined

  if (!anyInvoice) {
    return (
      <>
        <PageHeader title={t('title')} lead={t('lead')} />
        <EmptyState icon={Receipt} title={t('emptyTitle')} text={action ? t('emptyTextOwner') : t('emptyTextStaff')} action={action} />
      </>
    )
  }

  return (
    <>
      <PageHeader title={t('title')} lead={t('lead')} action={action} />
      <section className="flex flex-col gap-4">
        <InvoiceSearch query={filters.query} />
        <p className="text-sm text-ds-neutral-800" aria-live="polite">
          {filters.query ? t('list.searchCount', { count: page.total }) : t('list.count', { count: page.total })}
        </p>
        {page.rows.length === 0 ? (
          <EmptyState
            icon={MagnifyingGlass}
            title={t('list.noResultsTitle')}
            text={filters.query ? t('list.noResultsSearch') : t('list.noResultsPage')}
            action={
              <Button asChild variant="outline" className="min-h-11">
                <Link href="/rechnungen">{t('list.clearSearch')}</Link>
              </Button>
            }
          />
        ) : (
          <InvoiceList page={page} />
        )}
      </section>
    </>
  )
}
