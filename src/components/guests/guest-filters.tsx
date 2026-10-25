'use client'

import { MagnifyingGlass } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  countryOptions,
  type GuestFilters,
  guestListHref,
  MARKETING_CUSTOM,
  MARKETING_NONE,
  MARKETING_SOURCES,
  type MarketingFilter,
} from '@/lib/guests'

const DELAY_MS = 300
const ALL = '__alle'

// Suche, Filter und Sortierung der Gästeliste. Alles steht in der Adresse (teilbar, „Zurück“ funktioniert);
// jede Änderung beginnt wieder auf Seite 1.
export function GuestFilterBar({ filters }: { filters: GuestFilters }) {
  const t = useTranslations('guests')
  const tm = useTranslations('guests.marketing')
  const tc = useTranslations('guests.countryPicker')
  const locale = useLocale()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [value, setValue] = useState(filters.query)
  const [seenQuery, setSeenQuery] = useState(filters.query)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countries = useMemo(() => countryOptions(locale), [locale])

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

  const go = (next: Partial<GuestFilters>) =>
    startTransition(() => router.replace(guestListHref({ ...filters, ...next, page: 1 }), { scroll: false }))

  function onSearch(next: string) {
    setValue(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => go({ query: next.trim() }), DELAY_MS)
  }

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end" aria-busy={pending}>
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

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 lg:flex lg:flex-wrap">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-land" className="text-[13px] text-ds-neutral-800">
            {t('filterCountry')}
          </Label>
          <Select value={filters.country ?? ALL} onValueChange={(v) => go({ country: v === ALL ? null : v })}>
            <SelectTrigger id="filter-land" className="min-h-11 lg:w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL} className="min-h-11">
                {t('allCountries')}
              </SelectItem>
              <SelectGroup>
                <SelectLabel>{tc('common')}</SelectLabel>
                {countries.common.map((c) => (
                  <SelectItem key={c.code} value={c.code} className="min-h-11">
                    {c.name}
                  </SelectItem>
                ))}
              </SelectGroup>
              <SelectGroup>
                <SelectLabel>{tc('all')}</SelectLabel>
                {countries.others.map((c) => (
                  <SelectItem key={c.code} value={c.code} className="min-h-11">
                    {c.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-quelle" className="text-[13px] text-ds-neutral-800">
            {t('filterMarketing')}
          </Label>
          <Select value={filters.marketing ?? ALL} onValueChange={(v) => go({ marketing: v === ALL ? null : (v as MarketingFilter) })}>
            <SelectTrigger id="filter-quelle" className="min-h-11 lg:w-52">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL} className="min-h-11">
                {t('allSources')}
              </SelectItem>
              {MARKETING_SOURCES.map((source) => (
                <SelectItem key={source} value={source} className="min-h-11">
                  {tm(source)}
                </SelectItem>
              ))}
              <SelectItem value={MARKETING_CUSTOM} className="min-h-11">
                {tm('custom')}
              </SelectItem>
              <SelectItem value={MARKETING_NONE} className="min-h-11">
                {tm('none')}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sortierung" className="text-[13px] text-ds-neutral-800">
            {t('sortLabel')}
          </Label>
          <Select value={filters.sort} onValueChange={(v) => go({ sort: v === 'lastStay' ? 'lastStay' : 'name' })}>
            <SelectTrigger id="sortierung" className="min-h-11 lg:w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name" className="min-h-11">
                {t('sort.name')}
              </SelectItem>
              <SelectItem value="lastStay" className="min-h-11">
                {t('sort.lastStay')}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
