'use client'

import { CaretDown, FunnelSimple } from '@phosphor-icons/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useMemo, useState, useTransition } from 'react'

import { type MultiOption, MultiSelect } from '@/components/marketing/multi-select'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BOOKING_SOURCES, type BookingSource } from '@/lib/bookings'
import { countryOptions, LANGUAGES, languageName } from '@/lib/guests'
import {
  EMPTY_FILTERS,
  filtersOf,
  hasAnyFilter,
  type LanguageFilter,
  marketingHref,
  type MarketingView,
  MIN_STAYS_MAX,
  NO_LANGUAGE,
  type Reach,
} from '@/lib/marketing'
import type { MarketingProperty } from '@/lib/marketing-data'

const ANY = '__egal'
const LABEL = 'text-[13px] text-ds-neutral-800'
const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))

interface MarketingFilterBarProps {
  view: MarketingView
  places: MarketingProperty[]
  // Heutiges Datum (Wien) vom Server, für die Jahresauswahl
  today: string
}

// Filter der Seite „Marketing“ (PROJ-52). Alles steht in der Adresse; jede Änderung lädt die Liste neu (Seite 1, das
// geöffnete Segment bleibt gewählt, damit „Segment aktualisieren“ möglich ist). Am Handy aufklappbar.
export function MarketingFilterBar({ view, places, today }: MarketingFilterBarProps) {
  const t = useTranslations('marketing.filters')
  const tSource = useTranslations('bookings.source')
  const locale = useLocale()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const go = (next: Partial<MarketingView>) => startTransition(() => router.push(marketingHref({ ...view, ...next, page: 1 }), { scroll: false }))

  const filters = filtersOf(view)
  const activeCount = [
    filters.from || filters.to,
    filters.minStays,
    filters.properties.length || filters.apartments.length,
    filters.sources.length,
    filters.countries.length,
    filters.languages.length,
    filters.reach !== 'any',
  ].filter(Boolean).length

  const placeOptions = useMemo<MultiOption[]>(
    () =>
      places.flatMap((p) => [
        { value: `p:${p.id}`, label: t('wholeProperty', { name: p.name }), group: p.name },
        ...p.apartments.map((a) => ({ value: `a:${a.id}`, label: a.archived ? t('archived', { name: a.name }) : a.name, group: p.name, indent: true })),
      ]),
    [places, t]
  )
  const sourceOptions = useMemo<MultiOption[]>(() => BOOKING_SOURCES.map((s) => ({ value: s, label: tSource(s) })), [tSource])
  const countryList = useMemo<MultiOption[]>(() => {
    const { common, others } = countryOptions(locale)
    return [...common, ...others].map((c) => ({ value: c.code, label: c.name }))
  }, [locale])
  const languageOptions = useMemo<MultiOption[]>(
    () => [...LANGUAGES.map((l) => ({ value: l, label: languageName(l, locale) })), { value: NO_LANGUAGE, label: t('noLanguage') }],
    [locale, t]
  )

  const years = useMemo(() => {
    const now = Number(today.slice(0, 4))
    return Array.from({ length: 8 }, (_, i) => String(now - i))
  }, [today])

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="flex flex-col gap-3">
      <CollapsibleTrigger asChild>
        <Button type="button" variant="outline" className="min-h-11 w-full justify-between md:hidden">
          <span className="flex items-center gap-2">
            <FunnelSimple size={18} aria-hidden="true" />
            {t('toggle')} · {t('activeCount', { count: activeCount })}
          </span>
          <CaretDown size={16} aria-hidden="true" className={open ? 'rotate-180' : undefined} />
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent forceMount className="data-[state=closed]:hidden md:data-[state=closed]:block">
        <section aria-label={t('label')} aria-busy={pending} className="flex flex-col gap-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MonthField
              id="marketing-von"
              label={t('from')}
              value={filters.from}
              years={years}
              edge="start"
              onChange={(from) => go({ from, to: filters.to && from && filters.to < from ? from : filters.to })}
            />
            <MonthField
              id="marketing-bis"
              label={t('to')}
              value={filters.to}
              years={years}
              edge="end"
              min={filters.from}
              // „bis“ nie vor „von“ (QA BUG-1): frühere Jahre gesperrt, ein früherer Monat zieht auf „von“
              onChange={(to) => go({ to: to && filters.from && to < filters.from ? filters.from : to })}
            />
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="marketing-aufenthalte" className={LABEL}>
                {t('minStays')}
              </Label>
              <Select value={filters.minStays ? String(filters.minStays) : ANY} onValueChange={(v) => go({ minStays: v === ANY ? null : Number(v) })}>
                <SelectTrigger id="marketing-aufenthalte" className="min-h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY} className="min-h-11">
                    {t('anyStays')}
                  </SelectItem>
                  {Array.from({ length: MIN_STAYS_MAX }, (_, i) => i + 1).map((n) => (
                    <SelectItem key={n} value={String(n)} className="min-h-11">
                      {t('minStaysValue', { count: n })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="marketing-erreichbar" className={LABEL}>
                {t('reach')}
              </Label>
              <Select value={filters.reach} onValueChange={(v) => go({ reach: v as Reach })}>
                <SelectTrigger id="marketing-erreichbar" className="min-h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any" className="min-h-11">
                    {t('reachAny')}
                  </SelectItem>
                  <SelectItem value="email" className="min-h-11">
                    {t('reachEmail')}
                  </SelectItem>
                  <SelectItem value="post" className="min-h-11">
                    {t('reachPost')}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Field id="marketing-wohnung" label={t('places')}>
              <MultiSelect
                id="marketing-wohnung"
                aria-labelledby="marketing-wohnung-label"
                value={[...filters.properties.map((id) => `p:${id}`), ...filters.apartments.map((id) => `a:${id}`)]}
                options={placeOptions}
                allLabel={t('allPlaces')}
                searchable={placeOptions.length > 8}
                onApply={(v) =>
                  go({
                    properties: v.filter((x) => x.startsWith('p:')).map((x) => x.slice(2)),
                    apartments: v.filter((x) => x.startsWith('a:')).map((x) => x.slice(2)),
                  })
                }
              />
            </Field>
            <Field id="marketing-quelle" label={t('sources')}>
              <MultiSelect
                id="marketing-quelle"
                aria-labelledby="marketing-quelle-label"
                value={filters.sources}
                options={sourceOptions}
                allLabel={t('allSources')}
                onApply={(v) => go({ sources: v as BookingSource[] })}
              />
            </Field>
            <Field id="marketing-land" label={t('countries')}>
              <MultiSelect
                id="marketing-land"
                aria-labelledby="marketing-land-label"
                value={filters.countries}
                options={countryList}
                allLabel={t('allCountries')}
                searchable
                onApply={(v) => go({ countries: v })}
              />
            </Field>
            <Field id="marketing-sprache" label={t('languages')}>
              <MultiSelect
                id="marketing-sprache"
                aria-labelledby="marketing-sprache-label"
                value={filters.languages}
                options={languageOptions}
                allLabel={t('allLanguages')}
                onApply={(v) => go({ languages: v as LanguageFilter[] })}
              />
            </Field>
          </div>
          {hasAnyFilter(filters) && (
            <div>
              <Button asChild variant="ghost" className="min-h-11 px-2 text-ds-accent-700">
                <Link href={marketingHref({ ...EMPTY_FILTERS, segment: view.segment })} scroll={false}>
                  {t('reset')}
                </Link>
              </Button>
            </div>
          )}
        </section>
      </CollapsibleContent>
    </Collapsible>
  )
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span id={`${id}-label`} className={LABEL}>
        {label}
      </span>
      {children}
    </div>
  )
}

// Monat und Jahr als zwei Auswahlen. Wird nur das Jahr gewählt, gilt Jänner („von“) bzw. Dezember („bis“); nur der Monat:
// laufendes Jahr. „beliebig“ leert das Feld.
function MonthField({
  id,
  label,
  value,
  years,
  edge,
  min,
  onChange,
}: {
  id: string
  label: string
  value: string | null
  years: string[]
  edge: 'start' | 'end'
  min?: string | null
  onChange: (value: string | null) => void
}) {
  const t = useTranslations('marketing.filters')
  const tStats = useTranslations('statistics')
  const year = value?.slice(0, 4) ?? null
  const month = value?.slice(5, 7) ?? null
  const shownYears = year && !years.includes(year) ? [year, ...years] : years
  const disabled = (y: string, m: string) => Boolean(min && `${y}-${m}` < min)

  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className={`${LABEL} mb-1.5`}>{label}</legend>
      <div className="grid grid-cols-[1fr_6.5rem] gap-2">
        <Select
          value={month ?? ANY}
          onValueChange={(m) => onChange(m === ANY ? null : `${year ?? years[0]}-${m}`)}
        >
          <SelectTrigger id={id} aria-label={`${label}: ${t('month')}`} className="min-h-11">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY} className="min-h-11">
              {t('anyMonth')}
            </SelectItem>
            {MONTHS.map((m) => (
              <SelectItem key={m} value={m} disabled={disabled(year ?? years[0], m)} className="min-h-11">
                {tStats('monthName', { month: String(Number(m)) })}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={year ?? ANY} onValueChange={(y) => onChange(y === ANY ? null : `${y}-${month ?? (edge === 'start' ? '01' : '12')}`)}>
          <SelectTrigger aria-label={`${label}: ${t('year')}`} className="min-h-11">
            <SelectValue placeholder={t('anyMonth')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY} className="min-h-11">
              {t('anyMonth')}
            </SelectItem>
            {shownYears.map((y) => (
              <SelectItem key={y} value={y} disabled={Boolean(min && y < min.slice(0, 4))} className="min-h-11">
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </fieldset>
  )
}
