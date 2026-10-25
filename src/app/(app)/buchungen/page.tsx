import { Buildings, MagnifyingGlass, Notebook, UserCircleDashed } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { BookingFilterBar } from '@/components/bookings/booking-filters'
import { BookingList } from '@/components/bookings/booking-list'
import { NewBookingButtons } from '@/components/bookings/new-booking-buttons'
import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { requireArea } from '@/lib/areas'
import { bookingListHref, parseBookingFilters, todayIso } from '@/lib/bookings'
import { getBookableApartments, getBookingList, hasAnyBooking } from '@/lib/bookings-data'
import { getTenantContext } from '@/lib/tenant'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('bookings')
  return { title: t('title') }
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

// Buchungsliste (PROJ-8) für alle Mitglieder: Monat mit Blättern, Filter, Suche über alle Monate
export default async function BookingsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireArea('bookings')
  const t = await getTranslations('bookings')
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
  const today = todayIso()
  const filters = parseBookingFilters(await searchParams, today)
  const [apartments, list, anyBooking] = await Promise.all([getBookableApartments(), getBookingList(filters), hasAnyBooking()])
  const bookable = apartments.filter((a) => !a.archived)
  const actions = <NewBookingButtons apartments={apartments} owner={owner} today={today} />

  if (bookable.length === 0 && !anyBooking) {
    return (
      <>
        <PageHeader title={t('title')} lead={t('lead')} />
        <EmptyState
          icon={Buildings}
          title={t('noApartmentTitle')}
          text={owner ? t('noApartmentTextOwner') : t('noApartmentTextStaff')}
          action={
            owner ? (
              <Button asChild className="min-h-11">
                <Link href="/einstellungen/wohnungen">{t('toApartments')}</Link>
              </Button>
            ) : undefined
          }
        />
      </>
    )
  }

  if (!anyBooking) {
    return (
      <>
        <PageHeader title={t('title')} lead={t('lead')} />
        <EmptyState icon={Notebook} title={t('emptyTitle')} text={t('emptyText')} action={actions} />
      </>
    )
  }

  return (
    <>
      <PageHeader title={t('title')} lead={t('lead')} action={bookable.length > 0 && actions} />
      <section className="flex flex-col gap-4">
        <BookingFilterBar filters={filters} apartments={apartments} today={today} />
        <p className="text-sm text-ds-neutral-800" aria-live="polite">
          {list.searching ? t('searchCount', { count: list.rows.length }) : t('count', { count: list.rows.length })}
        </p>
        {list.truncated && <p className="text-sm text-ds-neutral-800">{t('truncated')}</p>}
        {list.rows.length === 0 ? (
          <EmptyState
            icon={MagnifyingGlass}
            title={t('noResultsTitle')}
            text={list.searching ? t('noResultsSearch') : t('noResultsMonth')}
            action={
              (filters.query || filters.apartment || filters.kind || filters.state) && (
                <Button asChild variant="outline" className="min-h-11">
                  <Link href={bookingListHref({ month: filters.month }, today)}>{t('clearFilters')}</Link>
                </Button>
              )
            }
          />
        ) : (
          <BookingList rows={list.rows} showAmounts={owner} withYear={list.searching} />
        )}
      </section>
    </>
  )
}
