'use client'

import { useTranslations } from 'next-intl'

import { dotClasses } from '@/components/calendar/entry-style'
import { addDays } from '@/lib/bookings'
import { type CalendarApartment, type CalendarEntry, dayItems, monthCells } from '@/lib/calendar'
import { formatDate, formatDayOfMonth, formatNumber, formatWeekday } from '@/lib/format'
import { cn } from '@/lib/utils'

interface CalendarMonthProps {
  month: string
  day: string
  today: string
  apartments: CalendarApartment[]
  entries: CalendarEntry[]
  selected: string | null
  onSelectDay: (date: string) => void
  onOpen: (id: string) => void
}

// Wochentage ab Montag (2026-10-26 ist ein Montag)
const WEEK = Array.from({ length: 7 }, (_, i) => addDays('2026-10-26', i))

// Monatsansicht (PROJ-9, wie Entwurf): Kachel je Tag mit belegt x/y, An/Ab; rechts bzw. darunter die Tagesliste
export function CalendarMonth({ month, day, today, apartments, entries, selected, onSelectDay, onOpen }: CalendarMonthProps) {
  const t = useTranslations('calendar')
  const tb = useTranslations('bookings')
  const shown = new Set(apartments.map((a) => a.id))
  const own = entries.filter((e) => shown.has(e.apartmentId))
  const { leadBlanks, cells } = monthCells(month, apartments, own, today)
  const items = dayItems(day, own)
  const apartmentName = new Map(apartments.map((a) => [a.id, a.name]))
  const short = formatDate

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex flex-col gap-1">
        <div className="grid grid-cols-7 gap-1 text-xs text-ds-neutral-700" aria-hidden="true">
          {WEEK.map((d) => (
            <div key={d} className="px-1.5">
              {formatWeekday(d)}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: leadBlanks }, (_, i) => (
            <div key={`leer-${i}`} />
          ))}
          {cells.map((c) => {
            const isSelected = c.date === day
            const share = c.total > 0 ? c.occupied / c.total : 0
            return (
              <button
                key={c.date}
                type="button"
                onClick={() => onSelectDay(c.date)}
                aria-pressed={isSelected}
                aria-label={t('dayButton', {
                  date: formatDate(c.date),
                  occupied: formatNumber(c.occupied),
                  total: formatNumber(c.total),
                  arrivals: formatNumber(c.arrivals),
                  departures: formatNumber(c.departures),
                })}
                className={cn(
                  'flex min-h-16 flex-col gap-1 rounded-lg p-1.5 text-left hover:bg-ds-neutral-300 sm:min-h-[84px] sm:px-2',
                  c.weekend ? 'bg-ds-neutral-200' : 'bg-ds-surface',
                  isSelected && 'shadow-[inset_0_0_0_2px_var(--color-accent-700)]'
                )}
              >
                <span className="flex w-full flex-wrap items-baseline justify-between gap-x-1">
                  <span className={cn('text-base tabular-nums', c.today && 'font-semibold text-ds-accent-2-700')}>
                    {formatDayOfMonth(c.date)}
                  </span>
                  <span className="hidden text-xs tabular-nums text-ds-neutral-700 sm:inline">
                    {t('occupied', { occupied: formatNumber(c.occupied), total: formatNumber(c.total) })}
                  </span>
                </span>
                <span className="block h-1 w-full overflow-hidden rounded-sm bg-ds-neutral-300">
                  <span className="block h-full bg-ds-accent-700" style={{ width: `${share * 100}%` }} />
                </span>
                <span className="flex flex-col text-[11px] leading-tight text-ds-neutral-800 sm:text-xs">
                  {c.arrivals > 0 && <span>{t('arrivals', { count: formatNumber(c.arrivals) })}</span>}
                  {c.departures > 0 && <span>{t('departures', { count: formatNumber(c.departures) })}</span>}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <section className="flex flex-col gap-3" aria-live="polite">
        <h3 className="text-lg">{formatDate(day)}</h3>
        {items.length === 0 ? (
          <p className="text-sm text-ds-neutral-700">{t('dayEmpty')}</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {items.map(({ entry: e, tag }) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => onOpen(e.id)}
                  className={cn(
                    'grid min-h-11 w-full grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-md px-1 py-2 text-left hover:bg-ds-neutral-200',
                    selected === e.id && 'bg-ds-neutral-200'
                  )}
                >
                  <span className={cn('size-2.5 rounded-sm', dotClasses(e))} aria-hidden="true" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">
                      {e.kind === 'block'
                        ? e.blockReason
                          ? tb(`blockReason.${e.blockReason}`)
                          : tb('kind.block')
                        : `${e.kind === 'option' ? `${t('optionPrefix')} · ` : ''}${e.guestName ?? tb('kind.booking')}`}
                    </span>
                    <span className="truncate text-xs text-ds-neutral-700">{apartmentName.get(e.apartmentId)}</span>
                  </span>
                  <span className="text-xs text-ds-neutral-800">
                    {tag === 'arrival' ? t('dayArrival') : tag === 'departure' ? t('dayDeparture') : t('dayUntil', { date: short(e.departure) })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
