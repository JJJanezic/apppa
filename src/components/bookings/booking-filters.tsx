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
import {
  BOOKING_INVOICE_FILTERS,
  BOOKING_KINDS,
  BOOKING_SOURCES,
  BOOKING_STATES,
  type BookableApartment,
  type BookingFilters,
  type BookingInvoiceFilter,
  type BookingKind,
  bookingListHref,
  type BookingSource,
  type BookingState,
  currentMonth,
  shiftMonth,
} from '@/lib/bookings'

const DELAY_MS = 300
const ALL = '__alle'

interface BookingFilterBarProps {
  filters: BookingFilters
  apartments: BookableApartment[]
  // Heutiges Datum (Wien) vom Server, damit Browser und Server denselben Monat meinen
  today: string
}

// Monatsleiste (mit Sprungauswahl wie im Belegungskalender, PROJ-30), Suche und Filter der Buchungsliste. Alles steht in der Adresse (teilbar, „Zurück“ funktioniert).
// Die Suche und der Filter „Rechnung“ (PROJ-37) gelten für alle Monate; die Monatsleiste ist dann durch „Alle Monate“ ersetzt.
export function BookingFilterBar({ filters, apartments, today }: BookingFilterBarProps) {
  const t = useTranslations('bookings')
  const format = useFormatter()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [value, setValue] = useState(filters.query)
  const [seenQuery, setSeenQuery] = useState(filters.query)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const searching = filters.query.length >= 2
  const allMonths = searching || filters.invoice !== null
  // Jede Filteränderung beginnt wieder bei Seite 1
  const href = (next: Partial<BookingFilters>) => bookingListHref({ ...filters, page: 1, ...next }, today)

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

  const go = (next: Partial<BookingFilters>) => startTransition(() => router.replace(href(next), { scroll: false }))
  // Sprung in den Monat des gewählten Datums; die übrigen Filter bleiben (wie die Pfeile ein neuer Verlaufseintrag)
  const jump = (date: string) => startTransition(() => router.push(href({ month: date.slice(0, 7) }), { scroll: false }))

  function onSearch(next: string) {
    setValue(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => go({ query: next.trim() }), DELAY_MS)
  }

  // Ausnahme PROJ-31: Monatsüberschrift „Oktober 2026“
  // eslint-disable-next-line no-restricted-syntax
  const monthLabel = format.dateTime(new Date(`${filters.month}-15T12:00:00`), { month: 'long', year: 'numeric' })
  const isCurrent = filters.month === currentMonth(today)

  return (
    <div className="flex flex-col gap-4" aria-busy={pending}>
      {allMonths ? (
        <h2 className="text-2xl">{t('allMonths')}</h2>
      ) : (
        <nav aria-label={t('month.label')} className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline" size="icon" className="size-11">
            <Link href={href({ month: shiftMonth(filters.month, -1) })} aria-label={t('month.previous')} scroll={false}>
              <CaretLeft size={18} aria-hidden="true" />
            </Link>
          </Button>
          <h2 className="min-w-44 text-center text-2xl" aria-live="polite">
            <DateJump
              label={monthLabel}
              ariaLabel={`${monthLabel}. ${t('month.pickDate')}`}
              fieldLabel={t('month.pickDateLabel')}
              submitLabel={t('month.jump')}
              inputId="buchungen-datum"
              defaultDate={`${filters.month}-01`}
              onJump={jump}
              triggerClassName="w-full text-2xl font-semibold"
            />
          </h2>
          <Button asChild variant="outline" size="icon" className="size-11">
            <Link href={href({ month: shiftMonth(filters.month, 1) })} aria-label={t('month.next')} scroll={false}>
              <CaretRight size={18} aria-hidden="true" />
            </Link>
          </Button>
          {!isCurrent && (
            <Button asChild variant="ghost" className="min-h-11">
              <Link href={href({ month: currentMonth(today) })} scroll={false}>
                {t('month.today')}
              </Link>
            </Button>
          )}
        </nav>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="relative w-full lg:max-w-sm">
          <MagnifyingGlass
            size={18}
            weight="duotone"
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ds-neutral-700"
          />
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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filter-wohnung" className="text-[13px] text-ds-neutral-800">
              {t('filterApartment')}
            </Label>
            <Select value={filters.apartment ?? ALL} onValueChange={(v) => go({ apartment: v === ALL ? null : v })}>
              <SelectTrigger id="filter-wohnung" className="min-h-11 lg:w-60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL} className="min-h-11">
                  {t('allApartments')}
                </SelectItem>
                {apartments.map((a) => (
                  <SelectItem key={a.id} value={a.id} className="min-h-11">
                    {a.archived ? t('panel.archived', { label: a.label }) : a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filter-art" className="text-[13px] text-ds-neutral-800">
              {t('filterKind')}
            </Label>
            <Select value={filters.kind ?? ALL} onValueChange={(v) => go({ kind: v === ALL ? null : (v as BookingKind) })}>
              <SelectTrigger id="filter-art" className="min-h-11 lg:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL} className="min-h-11">
                  {t('allKinds')}
                </SelectItem>
                {BOOKING_KINDS.map((kind) => (
                  <SelectItem key={kind} value={kind} className="min-h-11">
                    {t(`kind.${kind}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filter-zustand" className="text-[13px] text-ds-neutral-800">
              {t('filterState')}
            </Label>
            <Select value={filters.state ?? ALL} onValueChange={(v) => go({ state: v === ALL ? null : (v as BookingState) })}>
              <SelectTrigger id="filter-zustand" className="min-h-11 lg:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL} className="min-h-11">
                  {t('onlyActive')}
                </SelectItem>
                {BOOKING_STATES.filter((s) => s !== 'active').map((state) => (
                  <SelectItem key={state} value={state} className="min-h-11">
                    {t(`state.${state}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filter-quelle" className="text-[13px] text-ds-neutral-800">
              {t('filterSource')}
            </Label>
            <Select value={filters.source ?? ALL} onValueChange={(v) => go({ source: v === ALL ? null : (v as BookingSource) })}>
              <SelectTrigger id="filter-quelle" className="min-h-11 lg:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL} className="min-h-11">
                  {t('allSources')}
                </SelectItem>
                {BOOKING_SOURCES.map((source) => (
                  <SelectItem key={source} value={source} className="min-h-11">
                    {t(`source.${source}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* PROJ-37: ohne bzw. mit verknüpfter Rechnung, über alle Monate */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filter-rechnung" className="text-[13px] text-ds-neutral-800">
              {t('filterInvoice')}
            </Label>
            <Select value={filters.invoice ?? ALL} onValueChange={(v) => go({ invoice: v === ALL ? null : (v as BookingInvoiceFilter) })}>
              <SelectTrigger id="filter-rechnung" className="min-h-11 lg:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL} className="min-h-11">
                  {t('allInvoices')}
                </SelectItem>
                {BOOKING_INVOICE_FILTERS.map((f) => (
                  <SelectItem key={f} value={f} className="min-h-11">
                    {t(`invoiceFilter.${f}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  )
}
