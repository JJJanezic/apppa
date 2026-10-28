'use client'

import { ArrowsOut, CaretLeft, CaretRight } from '@phosphor-icons/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useFormatter, useTranslations } from 'next-intl'
import { useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { BookingPanel } from '@/components/bookings/booking-panel'
import { NewBookingButtons } from '@/components/bookings/new-booking-buttons'
import { CalendarMonth } from '@/components/calendar/calendar-month'
import { CalendarTimeline } from '@/components/calendar/calendar-timeline'
import { LEGEND_CLASSES } from '@/components/calendar/entry-style'
import { DateJump } from '@/components/date-jump'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { addDays, type BookableApartment, shiftMonth } from '@/lib/bookings'
import {
  CALENDAR_COOKIE,
  CALENDAR_PATH,
  type CalendarApartment,
  calendarCookieValue,
  calendarDays,
  type CalendarEntry,
  calendarHref,
  calendarProperties,
  type CalendarState,
  type CalendarVariant,
  type CalendarView as View,
  TIMELINE_DAYS,
  TIMELINE_LEAD,
  TIMELINE_STEP,
  visibleApartments,
} from '@/lib/calendar'
import { formatPeriod } from '@/lib/format'
import { cn } from '@/lib/utils'

interface CalendarViewProps {
  variant: CalendarVariant
  state: CalendarState
  today: string
  apartments: CalendarApartment[]
  entries: CalendarEntry[]
  // Für „Neue Buchung“/„Neue Sperre“ (PROJ-8)
  bookable: BookableApartment[]
  owner: boolean
  // Detailpanel des offenen Eintrags (vom Server)
  panel: React.ReactNode
  // Offener Eintrag existiert nicht (mehr)
  missingEntry: boolean
}

const noon = (iso: string) => new Date(`${iso}T12:00:00`)

// Ansicht und Objekt je Gerät merken (gemeinsam für Dashboard und Vollbild)
function remember(view: View, property: string | null) {
  document.cookie = `${CALENDAR_COOKIE}=${calendarCookieValue(view, property)}; path=/; max-age=${365 * 24 * 60 * 60}; samesite=lax`
}

// Belegungskalender (PROJ-9): Kopfzeile, Objektfilter, Legende, Zeitleiste bzw. Monat. Zeitraum, Ansicht, Filter
// und offener Eintrag stehen in der Adresse; der Server lädt die Daten des Bereichs.
export function CalendarView({ variant, state, today, apartments, entries, bookable, owner, panel, missingEntry }: CalendarViewProps) {
  const t = useTranslations('calendar')
  const format = useFormatter()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  // Gewählter Tag der Monatsansicht: nur im Browser, die Adresse wird ohne Neuladen nachgeführt.
  // Gilt nur, solange der Server denselben Ausgangstag liefert (nach dem Blättern wieder dessen Tag).
  const [picked, setPicked] = useState<{ base: string; day: string } | null>(null)
  const day = picked?.base === state.day ? picked.day : state.day
  const [createAt, setCreateAt] = useState<{ apartmentId: string; arrival: string } | null>(null)

  const properties = calendarProperties(apartments)
  const property = properties.some((p) => p.id === state.property) ? state.property : null
  const current: CalendarState = { ...state, day, property }
  const shown = visibleApartments(apartments, entries, property)
  const shownIds = new Set(shown.map((a) => a.id))
  const shownEntries = entries.filter((e) => shownIds.has(e.apartmentId))
  const canCreate = bookable.some((a) => !a.archived)
  const count = TIMELINE_DAYS[variant]
  const closeHref = calendarHref(variant, { ...current, entry: null })

  // Zuletzt angeforderter Zustand, solange der Server noch lädt: Schnelles Blättern zählt jeden Klick (QA BUG-2)
  const requested = useRef<CalendarState | null>(null)
  useEffect(() => {
    requested.current = null
  }, [state])

  const href = (patch: Partial<CalendarState>) => calendarHref(variant, { ...current, entry: null, ...patch })
  function go(patch: Partial<CalendarState>) {
    const target: CalendarState = { ...(requested.current ?? current), entry: null, ...patch }
    requested.current = target
    startTransition(() => router.push(calendarHref(variant, target), { scroll: false }))
  }

  // Eine Woche bzw. einen Monat weiter oder zurück
  const step = (from: CalendarState, dir: 1 | -1): Partial<CalendarState> =>
    from.view === 'timeline'
      ? { start: addDays(from.start, dir * TIMELINE_STEP) }
      : { month: shiftMonth(from.month, dir), day: `${shiftMonth(from.month, dir)}-01` }
  const todayPatch = state.view === 'timeline' ? { start: addDays(today, -TIMELINE_LEAD) } : { month: today.slice(0, 7), day: today }
  const prevHref = href(step(current, -1))
  const nextHref = href(step(current, 1))

  // Nachbarzeiträume vorab laden, damit Blättern sofort reagiert
  useEffect(() => {
    router.prefetch(prevHref)
    router.prefetch(nextHref)
  }, [router, prevHref, nextHref])

  // Alter Link auf einen gelöschten Eintrag: Hinweis und Panel-Parameter entfernen
  useEffect(() => {
    if (!missingEntry) return
    toast.error(t('entryMissing'))
    router.replace(closeHref, { scroll: false })
  }, [missingEntry, closeHref, router, t])

  function setView(view: string) {
    if (view !== 'timeline' && view !== 'month') return
    remember(view, property)
    go({ view })
  }

  function setProperty(id: string | null) {
    remember(state.view, id)
    go({ property: id })
  }

  function selectDay(date: string) {
    setPicked({ base: state.day, day: date })
    window.history.replaceState(null, '', calendarHref(variant, { ...current, day: date, entry: null }))
  }

  function jump(date: string) {
    go(state.view === 'timeline' ? { start: date } : { month: date.slice(0, 7), day: date })
  }

  // Zeitleiste: „So, 25.10.2026 – Sa, 07.11.2026“ (PROJ-31); Monat bleibt „Oktober 2026“
  const periodLabel =
    state.view === 'timeline'
      ? formatPeriod(state.start, addDays(state.start, count - 1))
      : // eslint-disable-next-line no-restricted-syntax -- Ausnahme PROJ-31: Monatsüberschrift
        format.dateTime(noon(`${state.month}-01`), { month: 'long', year: 'numeric' })
  const Heading = variant === 'full' ? 'h1' : 'h2'

  return (
    <section aria-labelledby="belegung-titel" className="min-w-0">
      {/* Der Kalenderkörper ist der Inhalt des gewählten Tabs, damit „aria-controls“ auf ihn zeigt (QA BUG-1) */}
      <Tabs value={state.view} onValueChange={setView} className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <Heading id="belegung-titel" className={variant === 'full' ? 'text-[34px] leading-[1.05] sm:text-[42px]' : 'text-2xl'}>
            {t('title')}
          </Heading>
          <TabsList aria-label={t('viewLabel')}>
            <TabsTrigger value="timeline" className="min-h-9">
              {t('view.timeline')}
            </TabsTrigger>
            <TabsTrigger value="month" className="min-h-9">
              {t('view.month')}
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-1 sm:ml-auto">
            <Button variant="ghost" size="icon" className="size-11" onClick={() => go(step(requested.current ?? current, -1))} aria-label={t('prev')}>
              <CaretLeft size={18} aria-hidden="true" />
            </Button>
            <DateJump
              label={periodLabel}
              ariaLabel={`${periodLabel}. ${t('pickDate')}`}
              fieldLabel={t('pickDateLabel')}
              submitLabel={t('jump')}
              inputId="belegung-datum"
              onJump={jump}
              triggerClassName="min-w-[11rem] whitespace-normal"
            />
            <Button variant="ghost" size="icon" className="size-11" onClick={() => go(step(requested.current ?? current, 1))} aria-label={t('next')}>
              <CaretRight size={18} aria-hidden="true" />
            </Button>
            <Button variant="outline" className="ml-1 min-h-11" onClick={() => go(todayPatch)}>
              {t('today')}
            </Button>
          </div>
        </div>

        {(canCreate || variant === 'dashboard') && (
          <div className="flex flex-wrap items-center gap-3">
            {canCreate && <NewBookingButtons apartments={bookable} owner={owner} today={today} afterCreate="refresh" />}
            {variant === 'dashboard' && (
              <Button asChild variant="ghost" className="min-h-11 sm:ml-auto">
                <Link href={CALENDAR_PATH.full}>
                  <ArrowsOut size={18} aria-hidden="true" />
                  {t('fullscreen')}
                </Link>
              </Button>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {properties.length > 1 && (
            <div role="group" aria-label={t('filterLabel')} className="flex flex-wrap gap-2">
              {[{ id: null, name: t('allProperties') }, ...properties].map((p) => (
                <Button
                  key={p.id ?? 'alle'}
                  size="sm"
                  variant={property === p.id ? 'default' : 'outline'}
                  aria-pressed={property === p.id}
                  className="min-h-9 rounded-lg font-normal"
                  onClick={() => setProperty(p.id)}
                >
                  {p.name}
                </Button>
              ))}
            </div>
          )}
          <ul aria-label={t('legendLabel')} className="flex flex-wrap gap-3 text-[13px] text-ds-neutral-700 sm:ml-auto">
            <LegendItem className={LEGEND_CLASSES.direct} label={t('channel.direct')} />
            <LegendItem className={LEGEND_CLASSES.bookingCom} label={t('channel.bookingCom')} />
            <LegendItem className={LEGEND_CLASSES.option} label={t('legendOption')} />
            <LegendItem className={LEGEND_CLASSES.block} label={t('legendBlock')} />
          </ul>
        </div>

        <TabsContent value={state.view} aria-busy={pending} className={cn('mt-0 transition-opacity', pending && 'opacity-60')}>
          {pending && <span className="sr-only">{t('loading')}</span>}
          {state.view === 'timeline' ? (
            <CalendarTimeline
              variant={variant}
              days={calendarDays(state.start, count, today)}
              apartments={shown}
              entries={shownEntries}
              selected={state.entry}
              onOpen={(id) => go({ entry: id })}
              onCreate={canCreate ? (apartmentId, arrival) => setCreateAt({ apartmentId, arrival }) : null}
            />
          ) : (
            <CalendarMonth
              month={state.month}
              day={day}
              today={today}
              apartments={shown}
              entries={shownEntries}
              selected={state.entry}
              onSelectDay={selectDay}
              onOpen={(id) => go({ entry: id })}
            />
          )}
        </TabsContent>
      </Tabs>

      {createAt && (
        <BookingPanel
          key={`${createAt.apartmentId}-${createAt.arrival}`}
          open
          onOpenChange={(o) => !o && setCreateAt(null)}
          apartments={bookable}
          booking={null}
          owner={owner}
          today={today}
          defaults={createAt}
          afterCreate="refresh"
        />
      )}
      {panel}
    </section>
  )
}

function LegendItem({ className, label }: { className: string; label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span className={cn('size-3 rounded-sm', className)} aria-hidden="true" />
      {label}
    </li>
  )
}
