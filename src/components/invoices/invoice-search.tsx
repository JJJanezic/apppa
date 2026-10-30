'use client'

import { MagnifyingGlass } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState, useTransition } from 'react'

import { Input } from '@/components/ui/input'
import { invoiceListHref } from '@/lib/invoices'

const DELAY_MS = 300

// Suchfeld der Rechnungsliste (Nummer oder Empfänger). Der Suchbegriff steht in der Adresse
// (Zurück-Taste und Rückkehr aus dem Detail behalten ihn); jede Änderung beginnt wieder auf Seite 1.
export function InvoiceSearch({ query }: { query: string }) {
  const t = useTranslations('invoices.list')
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [value, setValue] = useState(query)
  const [seenQuery, setSeenQuery] = useState(query)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Zurück-Taste bzw. „Suche zurücksetzen“ ändern die Adresse: Feld nachziehen (nicht beim eigenen Tippen)
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

  function onSearch(next: string) {
    setValue(next)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(
      () => startTransition(() => router.replace(invoiceListHref({ query: next.trim(), page: 1 }), { scroll: false })),
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
