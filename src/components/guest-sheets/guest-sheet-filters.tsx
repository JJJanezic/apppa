'use client'

import { CaretLeft, CaretRight, MagnifyingGlass } from '@phosphor-icons/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useFormatter, useTranslations } from 'next-intl'
import { useEffect, useRef, useState, useTransition } from 'react'

import { DateJump } from '@/components/date-jump'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { type BookableApartment, currentMonth, shiftMonth } from '@/lib/bookings'
import { type GuestSheetFilters, guestSheetListUrl } from '@/lib/guest-sheet'

const DELAY_MS = 300

const ALL = 'alle'

// Monatsleiste (Monat der Ankunft) mit Sprungauswahl, „Alle Monate“ (Voreinstellung), Wohnung, Suche und Schalter
// „Buchungen ohne Gästeblatt“ (PROJ-26, refine 2026-11-09). Alles steht in der Adresse; jede Änderung beginnt wieder auf
// Seite 1. Aufbau wie die Zahlungsliste (PROJ-45), Wohnungsauswahl wie die Buchungsübersicht.
export function GuestSheetFilterBar({ filters, today, apartments }: { filters: GuestSheetFilters; today: string; apartments: BookableApartment[] }) {
  const t = useTranslations('guestSheets.list')
  const format = useFormatter()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [value, setValue] = useState(filters.query)
  const [seenQuery, setSeenQuery] = useState(filters.query)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const href = (next: Partial<GuestSheetFilters>) => guestSheetListUrl({ ...filters, page: 1, ...next })

  // Zurück-Taste bzw. „Zurücksetzen“ ändern die Adresse: Feld nachziehen (nicht beim eigenen Tippen)
  if (filters.query !== seenQuery) {
    setSeenQuery(filters.query)
    if (filters.query !== value.trim()) setValue(filters.query)
  }
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )

  const go = (next: Partial<GuestSheetFilters>) => startTransition(() => router.replace(href(next), { scroll: false }))
  const jump = (date: string) => startTransition(() => router.push(href({ month: date.slice(0, 7) }), { scroll: false }))

  function onSearch(next: string) {
    setValue(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => go({ query: next.trim() }), DELAY_MS)
  }

  const month = filters.month
  // Ausnahme PROJ-31: Monatsüberschrift „Oktober 2026“
  // eslint-disable-next-line no-restricted-syntax
  const monthLabel = month ? format.dateTime(new Date(`${month}-15T12:00:00`), { month: 'long', year: 'numeric' }) : ''

  return (
    <div className="flex flex-col gap-4" aria-busy={pending}>
      {month ? (
        <nav aria-label={t('monthLabel')} className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="icon" className="size-11">
            <Link href={href({ month: shiftMonth(month, -1) })} aria-label={t('previousMonth')} scroll={false}>
              <CaretLeft size={18} aria-hidden="true" />
            </Link>
          </Button>
          <h2 className="min-w-44 text-center text-2xl" aria-live="polite">
            <DateJump
              label={monthLabel}
              ariaLabel={`${monthLabel}. ${t('pickDate')}`}
              fieldLabel={t('pickDateLabel')}
              submitLabel={t('jump')}
              inputId="gaesteblaetter-datum"
              defaultDate={`${month}-01`}
              onJump={jump}
              triggerClassName="w-full text-2xl font-semibold"
            />
          </h2>
          <Button asChild variant="outline" size="icon" className="size-11">
            <Link href={href({ month: shiftMonth(month, 1) })} aria-label={t('nextMonth')} scroll={false}>
              <CaretRight size={18} aria-hidden="true" />
            </Link>
          </Button>
          {month !== currentMonth(today) && (
            <Button asChild variant="ghost" className="min-h-11">
              <Link href={href({ month: currentMonth(today) })} scroll={false}>
                {t('thisMonth')}
              </Link>
            </Button>
          )}
          <Button asChild variant="ghost" className="min-h-11">
            <Link href={href({ month: null })} scroll={false}>
              {t('allMonths')}
            </Link>
          </Button>
        </nav>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-2xl">{t('allMonths')}</h2>
          <Button asChild variant="outline" className="min-h-11">
            <Link href={href({ month: currentMonth(today) })} scroll={false}>
              {t('byMonth')}
            </Link>
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-sm">
          <MagnifyingGlass size={18} weight="duotone" aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ds-neutral-700" />
          <Input
            type="search"
            value={value}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            aria-label={t('searchLabel')}
            autoComplete="off"
            className="min-h-11 pl-9"
          />
        </div>
        <Select value={filters.apartment ?? ALL} onValueChange={(v) => go({ apartment: v === ALL ? null : v })}>
          <SelectTrigger aria-label={t('apartmentLabel')} className="min-h-11 lg:w-60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL} className="min-h-11">
              {t('allApartments')}
            </SelectItem>
            {apartments.map((a) => (
              <SelectItem key={a.id} value={a.id} className="min-h-11">
                {a.archived ? t('archivedApartment', { label: a.label }) : a.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex min-h-11 items-center gap-3">
          <Switch id="filter-gaesteblatt-fehlt" checked={filters.missing} onCheckedChange={(missing) => go({ missing })} />
          <Label htmlFor="filter-gaesteblatt-fehlt" className="text-[15px] font-normal">
            {t('missingFilter')}
          </Label>
        </div>
      </div>
    </div>
  )
}
