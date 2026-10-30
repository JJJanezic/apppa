'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

import { searchGuests } from '@/app/(app)/gaeste/actions'
import { callAction } from '@/components/auth/form-error'
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { countryName, type GuestRow, guestSortName } from '@/lib/guests'

const DELAY_MS = 200

interface GuestPickerProps {
  // Dieser Gast erscheint nicht in den Treffern (z. B. der Gast, mit dem zusammengeführt wird)
  excludeId?: string
  onSelect: (guest: GuestRow) => void
  label: string
}

// Gastsuche mit Trefferliste (PROJ-7): Name, Firma, E-Mail oder Telefon, ab 2 Zeichen.
// Wiederverwendbar für das Buchungsformular (PROJ-8).
export function GuestPicker({ excludeId, onSelect, label }: GuestPickerProps) {
  const t = useTranslations('guests.merge')
  const locale = useLocale()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<GuestRow[]>([])
  const tooShort = query.trim().length < 2

  useEffect(() => {
    if (tooShort) return
    let cancelled = false
    const timer = setTimeout(async () => {
      setLoading(true)
      const result = await callAction(() => searchGuests({ query, excludeId }))
      if (cancelled) return
      setLoading(false)
      setRows(result.ok && result.data ? result.data : [])
    }, DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, excludeId, tooShort])

  return (
    <Command shouldFilter={false} className="rounded-lg border" label={label}>
      <CommandInput value={query} onValueChange={setQuery} placeholder={t('pickPlaceholder')} aria-label={label} />
      {/* Hinweise neben der Trefferliste: role="listbox" darf nur Optionen enthalten (WCAG, axe aria-required-children) */}
      {tooShort && <p className="px-3 py-2 text-sm text-ds-neutral-700">{t('pickMinChars')}</p>}
      {!tooShort && loading && <p className="px-3 py-2 text-sm text-ds-neutral-700">{t('loading')}</p>}
      {!tooShort && !loading && rows.length === 0 && (
        <p role="status" className="px-3 py-2 text-sm text-ds-neutral-700">
          {t('pickNone')}
        </p>
      )}
      <CommandList>
        {!tooShort && rows.length > 0 && (
          <CommandGroup>
            {rows.map((row) => (
              <CommandItem key={row.id} value={row.id} onSelect={() => onSelect(row)} className="min-h-11 flex-col items-start gap-0">
                <span className="font-medium">{guestSortName(row)}</span>
                <span className="text-[13px] text-ds-neutral-700">
                  {[row.companyName, countryName(row.country, locale)].filter(Boolean).join(' · ')}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  )
}
