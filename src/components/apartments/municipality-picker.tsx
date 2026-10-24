'use client'

import { CaretUpDown, Check } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

import { searchMunicipalities } from '@/app/(app)/einstellungen/wohnungen/actions'
import { callAction } from '@/components/auth/form-error'
import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { Municipality } from '@/lib/apartments'
import { cn } from '@/lib/utils'

const DELAY_MS = 200

interface MunicipalityPickerProps {
  id?: string
  value: Municipality | null
  onChange: (value: Municipality) => void
  // Eingegebene PLZ des Objekts: passende Gemeinden erscheinen zuerst
  postalCode: string
  invalid?: boolean
  'aria-describedby'?: string
}

// Auswahl einer österreichischen Gemeinde (PROJ-6, wiederverwendbar für PROJ-15): Suche nach Name oder PLZ.
// Freie Eingaben sind nicht möglich – gespeichert wird nur eine Gemeinde aus der Liste.
export function MunicipalityPicker({ id, value, onChange, postalCode, invalid, ...aria }: MunicipalityPickerProps) {
  const t = useTranslations('apartments')
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [found, setFound] = useState<{ byPostalCode: Municipality[]; results: Municipality[] }>({ byPostalCode: [], results: [] })
  const label = (m: Municipality) => `${m.name} · ${t(`state.${m.state}`)}`

  useEffect(() => {
    if (!open) return
    let cancelled = false
    const timer = setTimeout(async () => {
      setLoading(true)
      const result = await callAction(() => searchMunicipalities({ query, postalCode }))
      if (cancelled) return
      setLoading(false)
      setFound(result.ok && result.data ? result.data : { byPostalCode: [], results: [] })
    }, DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [open, query, postalCode])

  const results = found.results.filter((m) => !found.byPostalCode.some((p) => p.code === m.code))
  const choose = (m: Municipality) => {
    onChange(m)
    setOpen(false)
    setQuery('')
  }
  const item = (m: Municipality) => (
    <CommandItem key={m.code} value={m.code} onSelect={() => choose(m)} className="min-h-11">
      <Check size={16} aria-hidden="true" className={cn(value?.code === m.code ? 'opacity-100' : 'opacity-0')} />
      {label(m)}
    </CommandItem>
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid || undefined}
          aria-describedby={aria['aria-describedby']}
          className="min-h-11 w-full justify-between font-normal"
        >
          <span className={cn('truncate', !value && 'text-ds-neutral-700')}>{value ? label(value) : t('municipalityPicker.placeholder')}</span>
          <CaretUpDown size={16} aria-hidden="true" className="shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-72 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput value={query} onValueChange={setQuery} placeholder={t('municipalityPicker.search')} />
          <CommandList>
            {loading && <p className="px-3 py-2 text-sm text-ds-neutral-700">{t('municipalityPicker.loading')}</p>}
            {!loading && query.trim().length < 2 && found.byPostalCode.length === 0 && (
              <p className="px-3 py-2 text-sm text-ds-neutral-700">{t('municipalityPicker.minChars')}</p>
            )}
            {!loading && query.trim().length >= 2 && <CommandEmpty>{t('municipalityPicker.none')}</CommandEmpty>}
            {found.byPostalCode.length > 0 && (
              <CommandGroup heading={t('municipalityPicker.byPostalCode', { postalCode })}>{found.byPostalCode.map(item)}</CommandGroup>
            )}
            {results.length > 0 && <CommandGroup heading={t('municipalityPicker.results')}>{results.map(item)}</CommandGroup>}
          </CommandList>
          {/* Pflichtangabe der Lizenz CC BY 4.0 (supabase/data/statistik-austria/README.md) */}
          <p className="border-t px-3 py-2 text-[12px] text-ds-neutral-700">{t('municipalityPicker.source')}</p>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
