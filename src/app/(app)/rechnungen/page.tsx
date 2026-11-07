import { MagnifyingGlass, Receipt, UserCircleDashed } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { EmptyState } from '@/components/empty-state'
import { DeletedNotice } from '@/components/guests/deleted-notice'
import { CreateInvoiceButton } from '@/components/invoices/create-invoice-button'
import { NewInvoiceButton } from '@/components/invoices/invoice-buttons'
import { InvoiceFilterBar } from '@/components/invoices/invoice-filters'
import { InvoiceList } from '@/components/invoices/invoice-list'
import { RememberInvoiceList } from '@/components/invoices/invoice-list-return'
import { InvoiceSearch } from '@/components/invoices/invoice-search'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { requireArea } from '@/lib/areas'
import { todayIso } from '@/lib/bookings'
import { activeInvoiceFilterCount, invoiceListHref, parseInvoiceFilters } from '@/lib/invoices'
import { getInvoiceBackfillEnabled, getInvoicePage, hasAnyInvoice } from '@/lib/invoices-data'
import { getTenantContext } from '@/lib/tenant'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('invoices')
  return { title: t('title') }
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

// Rechnungsliste (PROJ-37) für alle Mitglieder mit Filtern und Summen (PROJ-43); „Rechnung erstellen“ nur für Inhaber,
// „Rechnung nacherfassen“ nur für Inhaber bei eingeschaltetem Schalter
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
  const filtered = Boolean(filters.query) || activeInvoiceFilterCount(filters) > 0
  const [page, anyInvoice, backfill] = await Promise.all([getInvoicePage(filters), hasAnyInvoice(), owner ? getInvoiceBackfillEnabled() : false])
  const today = todayIso()
  // Inhaber: „Rechnung erstellen“ (PROJ-43) und, bei eingeschaltetem Schalter, „Rechnung nacherfassen“
  const action = owner ? (
    <div className="flex flex-wrap gap-3">
      <CreateInvoiceButton />
      {backfill && <NewInvoiceButton today={today} variant="outline" />}
    </div>
  ) : undefined

  if (!anyInvoice) {
    return (
      <>
        <PageHeader title={t('title')} lead={t('lead')} />
        <DeletedNotice message={t('done.deleted')} />
        <EmptyState icon={Receipt} title={t('emptyTitle')} text={owner ? t(backfill ? 'emptyTextOwner' : 'emptyTextOwnerCreate') : t('emptyTextStaff')} action={action} />
      </>
    )
  }

  return (
    <>
      <PageHeader title={t('title')} lead={t('lead')} action={action} />
      <DeletedNotice message={t('done.deleted')} />
      <section className="flex flex-col gap-4">
        <RememberInvoiceList href={invoiceListHref(filters)} />
        <InvoiceSearch filters={filters} />
        <InvoiceFilterBar filters={filters} today={today} />
        {!page.ready && (filters.status || filters.payment) && (
          <p role="status" className="text-sm text-ds-neutral-800">
            {t('filter.notReady')}
          </p>
        )}
        <p className="text-sm text-ds-neutral-800" aria-live="polite">
          {filtered ? t('list.searchCount', { count: page.total }) : t('list.count', { count: page.total })}
        </p>
        {page.rows.length === 0 ? (
          <EmptyState
            icon={MagnifyingGlass}
            title={t('list.noResultsTitle')}
            text={page.total > 0 ? t('list.noResultsPage') : filtered ? t('list.noResultsFilter') : t('list.noResultsPage')}
            action={
              <Button asChild variant="outline" className="min-h-11">
                <Link href="/rechnungen">{t('filter.reset')}</Link>
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
