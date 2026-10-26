'use client'

import { WarningCircle } from '@phosphor-icons/react'
import { useFormatter, useTranslations } from 'next-intl'

import { barClasses } from '@/components/calendar/entry-style'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { type CalendarApartment, type CalendarDay, type CalendarEntry, type CalendarVariant, dayAt, layoutRow } from '@/lib/calendar'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

interface CalendarTimelineProps {
  variant: CalendarVariant
  days: CalendarDay[]
  apartments: CalendarApartment[]
  entries: CalendarEntry[]
  // Offener Eintrag (Ring um den Balken)
  selected: string | null
  onOpen: (id: string) => void
  // Klick auf einen freien Tag einer aktiven Wohnung; null = Anlegen nicht möglich
  onCreate: ((apartmentId: string, date: string) => void) | null
}

// Balkenhöhe wie im Entwurf, Abstand zwischen Spuren und oben/unten
const BAR = 34
const LANE = 40
const PAD = 6

// Spalten der Tage; feste Klassen, damit Tailwind sie findet
const DAY_COLUMNS: Record<number, string> = { 14: 'grid-cols-[repeat(14,minmax(0,1fr))]', 28: 'grid-cols-[repeat(28,minmax(0,1fr))]' }
const MIN_WIDTH: Record<CalendarVariant, string> = { dashboard: 'min-w-[680px] sm:min-w-[860px]', full: 'min-w-[1100px]' }
const pct = (fraction: number) => `${fraction * 100}%`
const noon = (iso: string) => new Date(`${iso}T12:00:00`)

// Zeitleiste (PROJ-9): Zeile je Wohnung, Balken in Kanalfarbe, Überschneidungen untereinander.
// Am Handy scrollt nur dieser Bereich seitlich; die Namensspalte bleibt stehen.
export function CalendarTimeline({ variant, days, apartments, entries, selected, onOpen, onCreate }: CalendarTimelineProps) {
  const t = useTranslations('calendar')
  const tb = useTranslations('bookings')
  const format = useFormatter()
  const count = days.length
  const from = days[0].date
  const todayIndex = days.findIndex((d) => d.today)
  const short = (iso: string) => format.dateTime(noon(iso), { day: 'numeric', month: 'short' })

  function label(e: CalendarEntry): string {
    if (e.kind === 'block') return e.blockReason ? tb(`blockReason.${e.blockReason}`) : tb('kind.block')
    const main = [e.guestLastName ?? tb('kind.booking'), formatNumber(e.persons)].join(' · ')
    return e.kind === 'option' ? `${t('optionPrefix')} · ${main}` : main
  }
  const name = (e: CalendarEntry) => (e.kind === 'block' ? label(e) : (e.guestName ?? tb('kind.booking')))

  function create(apartment: CalendarApartment, event: React.MouseEvent<HTMLDivElement>) {
    if (!onCreate || apartment.archived) return
    const box = event.currentTarget.getBoundingClientRect()
    onCreate(apartment.id, dayAt((event.clientX - box.left) / box.width, from, count))
  }

  return (
    <TooltipProvider delayDuration={300}>
      <div role="region" aria-label={t('gridLabel')} tabIndex={0} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className={cn('flex flex-col', MIN_WIDTH[variant])}>
          <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] sm:grid-cols-[12.5rem_minmax(0,1fr)]">
            <div className="sticky left-0 z-20 bg-ds-bg px-1 pb-2 text-[13px] text-ds-neutral-700">
              <span className="sr-only">{t('apartmentColumn')}</span>
            </div>
            <div className={cn('grid', DAY_COLUMNS[count])}>
              {days.map((d) => (
                <div
                  key={d.date}
                  className={cn(
                    'flex flex-col items-center pb-2 pt-1',
                    d.today ? 'font-semibold text-ds-accent-2-700' : d.weekend ? 'text-ds-neutral-700' : 'text-ds-text'
                  )}
                >
                  <span className="text-xs">{format.dateTime(noon(d.date), { weekday: 'short' })}</span>
                  <span className="text-base tabular-nums">{format.dateTime(noon(d.date), { day: 'numeric' })}</span>
                </div>
              ))}
            </div>
          </div>

          {apartments.map((apartment) => {
            const row = layoutRow(
              entries.filter((e) => e.apartmentId === apartment.id),
              from,
              count
            )
            const canCreate = Boolean(onCreate) && !apartment.archived
            return (
              <div key={apartment.id} className="grid grid-cols-[7.5rem_minmax(0,1fr)] sm:grid-cols-[12.5rem_minmax(0,1fr)] border-t border-ds-divider">
                <div className="sticky left-0 z-20 flex min-w-0 flex-col justify-center bg-ds-bg py-2 pr-3">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate font-semibold">{apartment.name}</span>
                    {row.overlapping && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="flex shrink-0 text-ds-accent-2-700">
                            <WarningCircle size={18} weight="duotone" aria-hidden="true" />
                            <span className="sr-only">{t('overlap')}</span>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent>{t('overlap')}</TooltipContent>
                      </Tooltip>
                    )}
                  </span>
                  <span className="truncate text-xs text-ds-neutral-700">
                    {apartment.propertyName}
                    {apartment.archived && ` · ${t('archived')}`}
                  </span>
                </div>
                {/* Freie Fläche: Klick legt an (Maus/Touch); per Tastatur über „Neue Buchung“ (Tech Design E) */}
                <div
                  className={cn('relative', canCreate && 'cursor-pointer')}
                  style={{ height: PAD * 2 + BAR + (row.lanes - 1) * LANE }}
                  onClick={(e) => create(apartment, e)}
                  title={canCreate ? t('createHint') : undefined}
                >
                  <div aria-hidden="true" className={cn('absolute inset-0 grid', DAY_COLUMNS[count])}>
                    {days.map((d) => (
                      <div key={d.date} className={cn('border-l border-ds-divider', d.weekend && 'bg-ds-neutral-200')} />
                    ))}
                  </div>
                  {todayIndex >= 0 && (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-y-0 w-0.5 bg-ds-accent-2 opacity-55"
                      style={{ left: pct((todayIndex + 0.5) / count) }}
                    />
                  )}
                  {row.bars.map((bar) => {
                    const e = bar.entry
                    return (
                      <Tooltip key={e.id}>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              onOpen(e.id)
                            }}
                            aria-label={t('barLabel', { kind: tb(`kind.${e.kind}`), name: name(e), from: short(e.arrival), to: short(e.departure) })}
                            className={cn(
                              'absolute flex items-center overflow-hidden rounded-lg px-2 text-left text-[13px] leading-tight shadow-sm',
                              barClasses(e),
                              bar.clippedStart && 'rounded-l-none',
                              bar.clippedEnd && 'rounded-r-none',
                              selected === e.id && 'ring-2 ring-ds-accent-2 ring-offset-2 ring-offset-ds-bg'
                            )}
                            style={{
                              top: PAD + bar.lane * LANE,
                              height: BAR,
                              left: `calc(${pct(bar.left)} + 2px)`,
                              width: `calc(${pct(bar.width)} - 4px)`,
                            }}
                          >
                            <span className="sticky left-0 truncate">{label(e)}</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>{t('barTitle', { name: name(e), from: short(e.arrival), to: short(e.departure) })}</TooltipContent>
                      </Tooltip>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </TooltipProvider>
  )
}
