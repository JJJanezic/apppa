'use client'

import { MagnifyingGlass } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState, useTransition } from 'react'

import { Input } from '@/components/ui/input'
import { type CompanyFilters, companyListHref } from '@/lib/companies'

const DELAY_MS = 300

// Suche der Firmenliste nach Name oder UID (PROJ-50). Steht in der Adresse; jede Änderung beginnt auf Seite 1.
export function CompanySearch({ filters }: { filters: CompanyFilters }) {
  const t = useTranslations('companies.list')
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [value, setValue] = useState(filters.query)
  const [seenQuery, setSeenQuery] = useState(filters.query)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Zurück-Taste ändert die Adresse: Feld nachziehen (nicht beim eigenen Tippen)
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

  function onSearch(next: string) {
    setValue(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(
      () => startTransition(() => router.replace(companyListHref({ query: next.trim(), page: 1 }), { scroll: false })),
      DELAY_MS
    )
  }

  return (
    <div className="relative w-full lg:max-w-sm" aria-busy={pending}>
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
  )
}
