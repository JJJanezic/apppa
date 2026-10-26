import { CaretLeft } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { BookingDetail, bookingTitle } from '@/components/bookings/booking-detail'
import { PageHeader } from '@/components/page-header'
import { requireArea } from '@/lib/areas'
import { bookingHref, bookingListHref, todayIso } from '@/lib/bookings'
import { getBookableApartments, getBooking } from '@/lib/bookings-data'
import { getTenantContext } from '@/lib/tenant'

type Params = Promise<{ id: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const booking = await getBooking((await params).id)
  return { title: [booking.number, await bookingTitle(booking)].filter(Boolean).join(' · ') }
}

// Buchungs-Detail (PROJ-8) für alle Mitglieder; Preis nur für Inhaber. Inhalt gemeinsam mit dem Kalender-Panel (PROJ-9).
export default async function BookingDetailPage({ params }: { params: Params }) {
  await requireArea('bookings')
  const { id } = await params
  const t = await getTranslations('bookings')
  const [booking, apartments, { active }] = await Promise.all([getBooking(id), getBookableApartments(), getTenantContext()])
  const owner = active?.role === 'owner'
  const today = todayIso()

  return (
    <>
      <Link
        href={bookingListHref({ month: booking.arrival.slice(0, 7) }, today)}
        className="-mb-6 flex min-h-11 w-fit items-center gap-1.5 text-ds-accent-700 underline-offset-[3px] hover:underline"
      >
        <CaretLeft size={16} weight="bold" aria-hidden="true" />
        {t('back')}
      </Link>
      <PageHeader
        eyebrow={[booking.number, booking.apartment.label].filter(Boolean).join(' · ')}
        title={<span className="break-words">{await bookingTitle(booking)}</span>}
      />
      <BookingDetail booking={booking} apartments={apartments} owner={owner} today={today} layout="page" conflictHref={bookingHref} />
    </>
  )
}
