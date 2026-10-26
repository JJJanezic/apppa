import { Buildings } from '@phosphor-icons/react/ssr'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { BookingDetail, bookingTitle } from '@/components/bookings/booking-detail'
import { CalendarError } from '@/components/calendar/calendar-error'
import { CalendarView } from '@/components/calendar/calendar-view'
import { EntryPanel } from '@/components/calendar/entry-panel'
import { EmptyState } from '@/components/empty-state'
import { Button } from '@/components/ui/button'
import { todayIso } from '@/lib/bookings'
import { findBooking, getBookableApartments } from '@/lib/bookings-data'
import { CALENDAR_COOKIE, calendarHref, calendarRange, type CalendarVariant, parseCalendarState } from '@/lib/calendar'
import { getCalendarData } from '@/lib/calendar-data'
import { getTenantContext } from '@/lib/tenant'

interface OccupancyCalendarProps {
  variant: CalendarVariant
  searchParams: Record<string, string | string[] | undefined>
}

// Belegungskalender (PROJ-9) auf dem Dashboard und der Vollbild-Seite: liest Zustand aus Adresse und Cookie,
// lädt die Einträge des Bereichs (ohne Beträge) und bei offenem Eintrag dessen Detail (Preis nur für Inhaber).
export async function OccupancyCalendar({ variant, searchParams }: OccupancyCalendarProps) {
  const { active } = await getTenantContext()
  if (!active) return null
  const owner = active.role === 'owner'
  const today = todayIso()
  const state = parseCalendarState(searchParams, (await cookies()).get(CALENDAR_COOKIE)?.value, today)
  const [data, bookable, booking] = await Promise.all([
    getCalendarData(calendarRange(state, variant)),
    getBookableApartments(),
    state.entry ? findBooking(state.entry) : Promise.resolve(null),
  ])

  if (data.failed) return <CalendarError />

  if (data.apartments.length === 0) {
    const t = await getTranslations('bookings')
    return (
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
    )
  }

  const closeHref = calendarHref(variant, { ...state, entry: null })
  const panel = booking && (
    <EntryPanel
      key={booking.id}
      closeHref={closeHref}
      title={<span className="break-words">{await bookingTitle(booking)}</span>}
      eyebrow={[booking.number, booking.apartment.label].filter(Boolean).join(' · ')}
    >
      <BookingDetail
        booking={booking}
        apartments={bookable}
        owner={owner}
        today={today}
        layout="panel"
        conflictHref={(id) => calendarHref(variant, { ...state, entry: id })}
        closeHref={closeHref}
      />
    </EntryPanel>
  )

  return (
    <CalendarView
      variant={variant}
      state={state}
      today={today}
      apartments={data.apartments}
      entries={data.entries}
      bookable={bookable}
      owner={owner}
      panel={panel}
      missingEntry={state.entry !== null && booking === null}
    />
  )
}
