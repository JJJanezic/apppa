'use client'

import { MagnifyingGlass } from '@phosphor-icons/react'
import { usePathname, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState, useTransition } from 'react'

import { Input } from '@/components/ui/input'

const DELAY_MS = 300

// Suche nach Kundenname oder E-Mail-Adresse. Der Begriff steht in der Adresse (?q=…), damit Zurück-Taste
// und geteilte Links dieselbe Liste zeigen; neue Suche beginnt wieder auf Seite 1.
export function TenantSearch({ query }: { query: string }) {
  const t = useTranslations('operator')
  const router = useRouter()
  const pathname = usePathname()
  const [value, setValue] = useState(query)
  const [seenQuery, setSeenQuery] = useState(query)
  const [pending, startTransition] = useTransition()
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Zurück-Taste bzw. „Suche leeren“ ändern die Adresse: Feld nachziehen (nicht beim eigenen Tippen)
  if (query !== seenQuery) {
    setSeenQuery(query)
    if (query !== value.trim()) setValue(query)
  }
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )

  function onChange(next: string) {
    setValue(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      const trimmed = next.trim()
      startTransition(() => router.replace(trimmed ? `${pathname}?q=${encodeURIComponent(trimmed)}` : pathname))
    }, DELAY_MS)
  }

  return (
    <div className="relative w-full max-w-md">
      <MagnifyingGlass
        size={18}
        weight="duotone"
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ds-neutral-700"
      />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t('searchPlaceholder')}
        aria-label={t('searchLabel')}
        aria-busy={pending}
        autoComplete="off"
        className="min-h-11 pl-9"
      />
    </div>
  )
}
