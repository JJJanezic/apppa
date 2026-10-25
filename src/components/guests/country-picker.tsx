'use client'

import { CaretUpDown, Check } from '@phosphor-icons/react'
import { useLocale, useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { countryName, countryOptions, searchKey } from '@/lib/guests'
import { cn } from '@/lib/utils'

interface CountryPickerProps {
  id?: string
  value: string
  onChange: (code: string) => void
  // Optionales Feld (z. B. Land der Adresse): Eintrag „Keine Angabe“ zum Leeren
  clearable?: boolean
  invalid?: boolean
  'aria-describedby'?: string
}

// Länderauswahl mit Suche (PROJ-7): häufige Länder oben, danach alle übrigen alphabetisch.
// Keine Vorauswahl – ein vorbelegtes Land würde die Herkunftsstatistik unbemerkt verfälschen.
export function CountryPicker({ id, value, onChange, clearable, invalid, ...aria }: CountryPickerProps) {
  const t = useTranslations('guests.countryPicker')
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const options = useMemo(() => countryOptions(locale), [locale])

  const choose = (code: string) => {
    onChange(code)
    setOpen(false)
  }
  // Suche über den Namen (ohne Akzente) und den Ländercode
  const item = (c: { code: string; name: string }) => (
    <CommandItem key={c.code} value={`${searchKey(c.name)} ${c.code.toLowerCase()}`} onSelect={() => choose(c.code)} className="min-h-11">
      <Check size={16} aria-hidden="true" className={cn(value === c.code ? 'opacity-100' : 'opacity-0')} />
      {c.name}
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
          <span className={cn('truncate', !value && 'text-ds-neutral-700')}>{value ? countryName(value, locale) : t('placeholder')}</span>
          <CaretUpDown size={16} aria-hidden="true" className="shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-72 p-0" align="start">
        <Command filter={(itemValue, search) => (itemValue.includes(searchKey(search)) ? 1 : 0)}>
          <CommandInput placeholder={t('search')} />
          <CommandList>
            <CommandEmpty>{t('none')}</CommandEmpty>
            {clearable && value && (
              <CommandGroup>
                <CommandItem value="__keine-angabe" onSelect={() => choose('')} className="min-h-11 text-ds-neutral-800">
                  {t('clear')}
                </CommandItem>
              </CommandGroup>
            )}
            <CommandGroup heading={t('common')}>{options.common.map(item)}</CommandGroup>
            <CommandGroup heading={t('all')}>{options.others.map(item)}</CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
