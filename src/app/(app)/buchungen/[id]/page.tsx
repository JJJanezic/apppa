import { CaretLeft } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getFormatter, getLocale, getTranslations } from 'next-intl/server'

import { BookingActions } from '@/components/bookings/booking-actions'
import { BookingBadges } from '@/components/bookings/booking-badges'
import { PageHeader } from '@/components/page-header'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { requireArea } from '@/lib/areas'
import { type Booking, bookingHref, bookingListHref, bookingState, nightsBetween, personCount, todayIso, totalCents } from '@/lib/bookings'
import { getBookableApartments, getBooking } from '@/lib/bookings-data'
import { formatCurrency, formatNumber } from '@/lib/format'
import { countryName, guestDisplayName, guestHref, guestSortName } from '@/lib/guests'
import { getTenantContext } from '@/lib/tenant'

type Params = Promise<{ id: string }>

async function bookingTitle(b: Booking): Promise<string> {
  const t = await getTranslations('bookings')
  if (b.kind === 'block') return b.blockReason ? `${t('kind.block')}: ${t(`blockReason.${b.blockReason}`)}` : t('kind.block')
  return b.guest ? guestDisplayName(b.guest) : t('kind.booking')
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const booking = await getBooking((await params).id)
  return { title: [booking.number, await bookingTitle(booking)].filter(Boolean).join(' · ') }
}

const LONG_DATE = { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' } as const
const euro = (cents: number) => formatCurrency(cents / 100, { cents: true })

// Buchungs-Detail (PROJ-8) für alle Mitglieder; Preis nur für Inhaber
export default async function BookingDetailPage({ params }: { params: Params }) {
  await requireArea('bookings')
  const { id } = await params
  const t = await getTranslations('bookings')
  const format = await getFormatter()
  const locale = await getLocale()
  const [booking, apartments, { active }] = await Promise.all([getBooking(id), getBookableApartments(), getTenantContext()])
  const owner = active?.role === 'owner'
  const today = todayIso()
  const state = bookingState(booking, today)
  const isBlock = booking.kind === 'block'
  // Datum ohne Uhrzeit: mittags erzeugen, damit die Zeitzone den Tag nicht verschiebt
  const date = (iso: string) => format.dateTime(new Date(iso.length === 10 ? `${iso}T12:00:00` : iso), LONG_DATE)
  const missing = <span className="text-ds-neutral-700">{t('detail.missing')}</span>
  const persons = personCount(booking.adults, booking.childAges)
  const conflictLabel = (c: Booking['conflicts'][number]) =>
    c.kind === 'block'
      ? `${t('kind.block')}${c.blockReason ? `: ${t(`blockReason.${c.blockReason}`)}` : ''}`
      : [t(`kind.${c.kind}`), c.number, c.guestName].filter(Boolean).join(' · ')

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

      <div className="-mt-4 flex flex-col gap-4">
        <BookingBadges
          kind={booking.kind}
          state={state}
          optionUntil={booking.optionUntil}
          overlapping={booking.conflicts.length > 0}
          priceReview={owner && booking.priceReview}
        />
        {state === 'expired' && booking.optionUntil && (
          <Alert className="max-w-2xl border-ds-neutral-400 bg-ds-surface">
            <AlertDescription>{t('detail.optionExpiredNote', { date: date(booking.optionUntil) })}</AlertDescription>
          </Alert>
        )}
        {state === 'cancelled' && booking.cancelledAt && (
          <Alert className="max-w-2xl border-ds-neutral-400 bg-ds-surface">
            <AlertDescription>{t('detail.cancelledNote', { date: date(booking.cancelledAt), name: booking.cancelledBy ?? '–' })}</AlertDescription>
          </Alert>
        )}
        {booking.conflicts.length > 0 && (
          <Alert className="max-w-2xl border-ds-accent-2-700/40 bg-ds-accent-2-100 text-ds-accent-2-800">
            <AlertDescription className="flex flex-col gap-1 text-ds-accent-2-800">
              <span>{t('detail.overlapNote')}</span>
              <ul className="flex flex-col gap-1">
                {booking.conflicts.map((c) => (
                  <li key={c.id}>
                    <Link href={bookingHref(c.id)} className="underline underline-offset-[3px]">
                      {conflictLabel(c)}
                    </Link>
                  </li>
                ))}
              </ul>
              {booking.overrideBy && <span className="text-[13px]">{t('detail.overrideNote', { name: booking.overrideBy })}</span>}
            </AlertDescription>
          </Alert>
        )}
        <BookingActions booking={booking} apartments={apartments} owner={owner} today={today} />
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <DetailSection title={t('detail.stay')}>
          <Fact label={t('detail.arrival')}>
            {date(booking.arrival)}
            {!isBlock && <span className="text-ds-neutral-800"> · {booking.checkIn}</span>}
          </Fact>
          <Fact label={t('detail.departure')}>
            {date(booking.departure)}
            {!isBlock && <span className="text-ds-neutral-800"> · {booking.checkOut}</span>}
          </Fact>
          <Fact label={t('detail.nights')}>{formatNumber(nightsBetween(booking.arrival, booking.departure))}</Fact>
          {isBlock ? (
            <Fact label={t('detail.reason')}>{booking.blockReason ? t(`blockReason.${booking.blockReason}`) : missing}</Fact>
          ) : (
            <>
              <Fact label={t('detail.persons')}>
                {booking.childAges.length > 0
                  ? t('detail.personsValue', { persons, adults: booking.adults, children: booking.childAges.length })
                  : t('detail.personsAdultsOnly', { persons })}
              </Fact>
              {booking.childAges.length > 0 && (
                <Fact label={t('detail.childAges')}>{t('detail.agesValue', { ages: booking.childAges.join(', ') })}</Fact>
              )}
              <Fact label={t('detail.channel')}>{t('detail.channelDirect')}</Fact>
            </>
          )}
          {booking.kind === 'option' && booking.optionUntil && <Fact label={t('detail.optionUntil')}>{date(booking.optionUntil)}</Fact>}
          {booking.cancelReason && <Fact label={t('detail.cancelReason')}>{booking.cancelReason}</Fact>}
          <Fact label={t('detail.note')}>{booking.note ? <span className="whitespace-pre-line break-words">{booking.note}</span> : missing}</Fact>
        </DetailSection>

        {!isBlock && (
          <div className="flex flex-col gap-8">
            {booking.guest && (
              <DetailSection title={t('detail.guest')}>
                <Fact label={t('detail.guest')}>
                  <Link href={guestHref(booking.guest.id)} className="text-ds-accent-700 underline-offset-[3px] hover:underline">
                    {guestSortName(booking.guest)}
                  </Link>
                </Fact>
                <Fact label={t('detail.country')}>{countryName(booking.guest.country, locale)}</Fact>
              </DetailSection>
            )}

            <section className="flex flex-col gap-3">
              <h2 className="text-2xl">{t('detail.companions')}</h2>
              {booking.companions.length === 0 ? (
                <p className="rounded-lg bg-ds-surface px-4 py-3 text-ds-neutral-800">
                  {persons > 1 ? t('detail.companionsEmpty') : t('detail.companionsNone')}
                </p>
              ) : (
                <ul className="flex flex-col divide-y rounded-lg bg-ds-surface px-4">
                  {booking.companions.map((c, i) => (
                    <li key={i} className="flex flex-wrap justify-between gap-2 py-3">
                      <span>{guestSortName(c)}</span>
                      {c.birthDate && <span className="text-ds-neutral-800 tabular-nums">{date(c.birthDate)}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {owner && booking.amounts && (
              <section className="flex flex-col gap-3">
                <h2 className="text-2xl">{t('detail.price')}</h2>
                {booking.priceReview && (
                  <Alert className="border-ds-accent-700/40 bg-ds-accent-100">
                    <AlertDescription>{t('detail.priceReviewNote')}</AlertDescription>
                  </Alert>
                )}
                <dl className="flex flex-col divide-y rounded-lg bg-ds-surface px-4">
                  <Money label={t('detail.nightsPrice')} cents={booking.amounts.nightsCents} />
                  {booking.amounts.charges.map((c, i) => (
                    <Money key={i} label={c.label} cents={c.amountCents} />
                  ))}
                  <div className="flex items-baseline justify-between gap-4 py-3 font-semibold">
                    <dt>{t('detail.total')}</dt>
                    <dd className="tabular-nums">{euro(totalCents(booking.amounts))}</dd>
                  </div>
                  {booking.amounts.cancellationFeeCents !== null && (
                    <Money label={t('detail.cancellationFee')} cents={booking.amounts.cancellationFeeCents} />
                  )}
                </dl>
                <p className="text-[13px] text-ds-neutral-700">{t('detail.taxNote')}</p>
              </section>
            )}
          </div>
        )}
      </div>
    </>
  )
}

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-2xl">{title}</h2>
      <dl className="flex flex-col divide-y rounded-lg bg-ds-surface px-4">{children}</dl>
    </section>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-[13px] text-ds-neutral-700 sm:text-sm">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}

function Money({ label, cents }: { label: string; cents: number }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-3">
      <dt className="min-w-0 break-words">{label}</dt>
      <dd className="tabular-nums">{euro(cents)}</dd>
    </div>
  )
}
