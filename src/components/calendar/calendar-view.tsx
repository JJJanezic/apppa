'use client'

import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'

import { BookingPanel } from '@/components/bookings/booking-panel'
import { NewBookingButtons } from '@/components/bookings/new-booking-buttons'
import { submitTenantSwitch } from '@/components/dashboard/row-target'
import { CalendarTimeline } from '@/components/calendar/calendar-timeline'
import { LEGEND_CLASSES } from '@/components/calendar/entry-style'
import { DateJump } from '@/components/date-jump'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { addDays, type BookableApartment } from '@/lib/bookings'
import {
  CALENDAR_COOKIE,
  CALENDAR_LENGTHS,
  type CalendarApartment,
  calendarCookieValue,
  calendarDays,
  type CalendarEntry,
  calendarHref,
  type CalendarLength,
  calendarProperties,
  type CalendarState,
  TIMELINE_LEAD,
  timelineStep,
  visibleApartments,
} from '@/lib/calendar'
import { formatDate, formatPeriod } from '@/lib/format'
import { cn } from '@/lib/utils'

interface CalendarViewProps {
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
  // Gewählter Kunde (PROJ-14): Einträge und Wohnungen anderer Kunden wechseln vor dem Öffnen bzw. Anlegen den Kunden
  activeTenantId: string | null
}

// Länge und Objekt je Gerät merken
function remember(length: CalendarLength, property: string | null) {
  document.cookie = `${CALENDAR_COOKIE}=${calendarCookieValue(length, property)}; path=/; max-age=${365 * 24 * 60 * 60}; samesite=lax`
}

// Belegungskalender (PROJ-9) auf dem Dashboard: Kopfzeile mit „14 Tage | 28 Tage“, Objektfilter, Legende, Zeitleiste.
// Länge, Zeitraum, Filter und offener Eintrag stehen in der Adresse; der Server lädt die Daten des Bereichs.
export function CalendarView({ state, today, apartments, entries, bookable, owner, panel, missingEntry, activeTenantId }: CalendarViewProps) {
  const t = useTranslations('calendar')
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  // Vorbelegt aus der Adresse (?neu=…), wenn die Wohnung zum gewählten Kunden gehört (nach dem Kundenwechsel, PROJ-14)
  const [createAt, setCreateAt] = useState<{ apartmentId: string; arrival: string } | null>(() =>
    state.create && bookable.some((a) => a.id === state.create?.apartmentId && !a.archived) ? state.create : null
  )

  const properties = calendarProperties(apartments)
  const property = properties.some((p) => p.id === state.property) ? state.property : null
  const current: CalendarState = { ...state, property, create: null }
  const shown = visibleApartments(apartments, entries, property)
  const shownIds = new Set(shown.map((a) => a.id))
  const shownEntries = entries.filter((e) => shownIds.has(e.apartmentId))
  const canCreate = bookable.some((a) => !a.archived)
  // „Neue Buchung“/„Neue Sperre“ nur, wenn die Belegung nur den gewählten Kunden zeigt (PROJ-14 BUG-4); bei mehreren
  // Kunden legt man per Klick in eine Zeile an
  const onlyActiveTenant = apartments.every((a) => a.tenantId === activeTenantId)
  const showButtons = canCreate && onlyActiveTenant
  // Anlegen per Klick auch in Zeilen anderer Kunden (wechselt vorher)
  const canCreateInRows = canCreate || apartments.some((a) => a.tenantId !== activeTenantId && !a.archived)
  const count = state.length
  const closeHref = calendarHref({ ...current, entry: null })

  // Zuletzt angeforderter Zustand, solange der Server noch lädt: Schnelles Blättern zählt jeden Klick (QA BUG-2)
  const requested = useRef<CalendarState | null>(null)
  useEffect(() => {
    requested.current = null
  }, [state])

  const href = (patch: Partial<CalendarState>) => calendarHref({ ...current, entry: null, ...patch })
  function go(patch: Partial<CalendarState>) {
    const target: CalendarState = { ...(requested.current ?? current), entry: null, ...patch }
    requested.current = target
    startTransition(() => router.push(calendarHref(target), { scroll: false }))
  }

  // Um den halben Zeitraum weiter oder zurück (7 bzw. 14 Tage)
  const step = (from: CalendarState, dir: 1 | -1): Partial<CalendarState> => ({ start: addDays(from.start, dir * timelineStep(from.length)) })
  const todayPatch = { start: addDays(today, -TIMELINE_LEAD) }
  const prevHref = href(step(current, -1))
  const nextHref = href(step(current, 1))

  // Nachbarzeiträume vorab laden, damit Blättern sofort reagiert
  useEffect(() => {
    router.prefetch(prevHref)
    router.prefetch(nextHref)
  }, [router, prevHref, nextHref])

  // Eintrag öffnen; gehört er zu einem anderen Kunden, vorher wechseln (Ziel: derselbe Kalender mit offenem Eintrag)
  function open(id: string) {
    const entry = entries.find((e) => e.id === id)
    if (entry && entry.tenantId !== activeTenantId) submitTenantSwitch(entry.tenantId, calendarHref({ ...current, entry: id }))
    else go({ entry: id })
  }

  // Neue Buchung per Klick; in der Zeile eines anderen Kunden nach dem Wechsel mit vorbelegtem Formular
  function createIn(apartmentId: string, arrival: string) {
    const apartment = apartments.find((a) => a.id === apartmentId)
    if (apartment && apartment.tenantId !== activeTenantId)
      submitTenantSwitch(apartment.tenantId, calendarHref({ ...current, entry: null, create: { apartmentId, arrival } }))
    else if (canCreate) setCreateAt({ apartmentId, arrival })
  }

  function closeCreate() {
    setCreateAt(null)
    if (state.create) router.replace(closeHref, { scroll: false })
  }

  // Alter Link auf einen gelöschten Eintrag: Hinweis und Panel-Parameter entfernen
  useEffect(() => {
    if (!missingEntry) return
    toast.error(t('entryMissing'))
    router.replace(closeHref, { scroll: false })
  }, [missingEntry, closeHref, router, t])

  // Umschalten behält den Starttag
  function setLength(value: string) {
    const length = CALENDAR_LENGTHS.find((l) => String(l) === value)
    if (!length) return
    remember(length, property)
    go({ length })
  }

  function setProperty(id: string | null) {
    remember(state.length, id)
    go({ property: id })
  }

  function jump(date: string) {
    go({ start: date })
  }

  // „So, 25.10.2026 – Sa, 07.11.2026“ (PROJ-31)
  const periodLabel = formatPeriod(state.start, addDays(state.start, count - 1))
  // Sichtbar bricht der Zeitraum nur am „–“ um, nie innerhalb eines Datums (QA PROJ-31 BUG-2)
  const keepTogether = (text: string) => text.replaceAll(' ', '\u00a0')
  const periodVisible = `${keepTogether(formatDate(state.start))} – ${keepTogether(formatDate(addDays(state.start, count - 1)))}`

  return (
    <section aria-labelledby="belegung-titel" className="min-w-0">
      {/* Der Kalenderkörper ist der Inhalt des gewählten Tabs, damit „aria-controls“ auf ihn zeigt (QA BUG-1) */}
      <Tabs value={String(state.length)} onValueChange={setLength} className="flex min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <h2 id="belegung-titel" className="text-2xl">
            {t('title')}
          </h2>
          <TabsList aria-label={t('lengthLabel')}>
            {CALENDAR_LENGTHS.map((length) => (
              <TabsTrigger key={length} value={String(length)} className="min-h-9">
                {t('length', { days: length })}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="flex items-center gap-1 sm:ml-auto">
            <Button variant="ghost" size="icon" className="size-11" onClick={() => go(step(requested.current ?? current, -1))} aria-label={t('prev')}>
              <CaretLeft size={18} aria-hidden="true" />
            </Button>
            <DateJump
              label={periodVisible}
              ariaLabel={`${periodLabel}. ${t('pickDate')}`}
              fieldLabel={t('pickDateLabel')}
              submitLabel={t('jump')}
              inputId="belegung-datum"
              onJump={jump}
              triggerClassName="min-w-[9rem] whitespace-normal sm:min-w-[11rem]"
            />
            <Button variant="ghost" size="icon" className="size-11" onClick={() => go(step(requested.current ?? current, 1))} aria-label={t('next')}>
              <CaretRight size={18} aria-hidden="true" />
            </Button>
            <Button variant="outline" className="ml-1 min-h-11" onClick={() => go(todayPatch)}>
              {t('today')}
            </Button>
          </div>
        </div>

        {showButtons && (
          <div className="flex flex-wrap items-center gap-3">
            <NewBookingButtons apartments={bookable} owner={owner} today={today} afterCreate="refresh" />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {properties.length > 1 && (
            <div role="group" aria-label={t('filterLabel')} className="flex flex-wrap gap-2">
              {[{ id: null, name: t('allProperties'), tenantName: null }, ...properties].map((p) => (
                <Button
                  key={p.id ?? 'alle'}
                  size="sm"
                  variant={property === p.id ? 'default' : 'outline'}
                  aria-pressed={property === p.id}
                  className="min-h-9 rounded-lg font-normal"
                  onClick={() => setProperty(p.id)}
                >
                  {p.tenantName ? `${p.tenantName} · ${p.name}` : p.name}
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

        <TabsContent value={String(state.length)} aria-busy={pending} className={cn('mt-0 transition-opacity', pending && 'opacity-60')}>
          {pending && <span className="sr-only">{t('loading')}</span>}
          <CalendarTimeline
            length={state.length}
            days={calendarDays(state.start, count, today)}
            apartments={shown}
            entries={shownEntries}
            selected={state.entry}
            onOpen={open}
            onCreate={canCreateInRows ? createIn : null}
          />
        </TabsContent>
      </Tabs>

      {createAt && (
        <BookingPanel
          key={`${createAt.apartmentId}-${createAt.arrival}`}
          open
          onOpenChange={(o) => !o && closeCreate()}
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
