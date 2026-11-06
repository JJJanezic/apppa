import { Coins, MagnifyingGlass, UserCircleDashed } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { PaymentFilterBar } from '@/components/payments/payment-filters'
import { PaymentList } from '@/components/payments/payment-list'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { requireArea } from '@/lib/areas'
import { todayIso } from '@/lib/bookings'
import { parsePaymentFilters } from '@/lib/payments'
import { getPaymentMethods, getPaymentPage, hasAnyPayment } from '@/lib/payments-data'
import { getTenantContext } from '@/lib/tenant'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('payments')
  return { title: t('listTitle') }
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

// Zahlungsliste (PROJ-45) für Inhaber und Mitarbeiter: alle Zahlungen und Rückzahlungen mit Monats-, Zahlungsart- und
// Suchfilter und Summen. Erfasst wird in Rechnung oder Buchung, nicht hier.
export default async function PaymentsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireArea('payments')
  const t = await getTranslations('payments')
  const { active } = await getTenantContext()
  // Ohne Kunde (z. B. Betreiber-Admin ohne Mitgliedschaft): Hinweis wie im Dashboard
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
  const filters = parsePaymentFilters(await searchParams, today)
  const [page, any, methods] = await Promise.all([getPaymentPage(filters), hasAnyPayment(), getPaymentMethods()])
  const filtered = filters.query !== '' || filters.methodId !== null

  if (!any) {
    return (
      <>
        <PageHeader title={t('listTitle')} lead={t('listLead')} />
        {!page.ready && (
          <Alert>
            <AlertDescription>{t('notReady')}</AlertDescription>
          </Alert>
        )}
        <EmptyState icon={Coins} title={t('list.emptyTitle')} text={t('list.emptyText')} />
      </>
    )
  }

  return (
    <>
      <PageHeader title={t('listTitle')} lead={t('listLead')} />
      <section className="flex flex-col gap-4">
        <PaymentFilterBar filters={filters} methods={methods} today={today} />
        <p className="text-sm text-ds-neutral-800" aria-live="polite">
          {t('list.count', { count: page.total })}
        </p>
        {page.rows.length === 0 ? (
          <EmptyState
            icon={MagnifyingGlass}
            title={t('list.noResultsTitle')}
            text={filtered ? t('list.noResultsFiltered') : t('list.noResultsPeriod')}
            action={
              filtered ? (
                <Button asChild variant="outline" className="min-h-11">
                  <Link href={filters.month ? `/zahlungen?monat=${filters.month}` : '/zahlungen?monat=alle'}>{t('list.clearFilters')}</Link>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <PaymentList page={page} today={today} />
        )}
      </section>
    </>
  )
}
