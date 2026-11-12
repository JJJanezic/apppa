'use client'

import { CaretUpDown, Check } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { searchKey } from '@/lib/guests'
import { cn } from '@/lib/utils'

export type MultiOption = { value: string; label: string; group?: string; indent?: boolean }

interface MultiSelectProps {
  id: string
  value: readonly string[]
  options: readonly MultiOption[]
  // Text, wenn nichts gewählt ist (z. B. „Alle Länder“)
  allLabel: string
  // Übernehmen beim Schließen: nur ein Seitenwechsel je Auswahl statt einer je Klick
  onApply: (values: string[]) => void
  searchable?: boolean
  'aria-labelledby'?: string
}

// Mehrfachauswahl der Marketing-Filter (PROJ-52) aus Popover und Command (shadcn): Häkchen je Eintrag, optional mit Suche
// und Gruppen; „Auswahl leeren“ unten. Die Auswahl wird beim Schließen übernommen.
export function MultiSelect({ id, value, options, allLabel, onApply, searchable = false, ...aria }: MultiSelectProps) {
  const t = useTranslations('marketing.filters')
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<string[]>([...value])

  const changeOpen = (next: boolean) => {
    if (next) setDraft([...value])
    else if (draft.length !== value.length || draft.some((v) => !value.includes(v))) onApply(draft)
    setOpen(next)
  }
  const toggle = (v: string) => setDraft((d) => (d.includes(v) ? d.filter((x) => x !== v) : [...d, v]))

  const shown = open ? draft : value
  const summary =
    shown.length === 0
      ? allLabel
      : shown.length === 1
        ? (options.find((o) => o.value === shown[0])?.label ?? t('selected', { count: 1 }))
        : t('selected', { count: shown.length })

  const groups = [...new Set(options.map((o) => o.group ?? ''))]
  const item = (o: MultiOption) => (
    <CommandItem
      key={o.value}
      value={`${searchKey(o.label)} ${o.value}`}
      onSelect={() => toggle(o.value)}
      aria-selected={draft.includes(o.value)}
      className={cn('min-h-11', o.indent && 'pl-6')}
    >
      <Check size={16} aria-hidden="true" className={cn(draft.includes(o.value) ? 'opacity-100' : 'opacity-0')} />
      {o.label}
    </CommandItem>
  )

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          // Safari: Knöpfe sind ohne ausdrücklichen tabIndex nicht per Tabulatortaste erreichbar
          tabIndex={0}
          aria-expanded={open}
          aria-labelledby={aria['aria-labelledby']}
          className="min-h-11 w-full justify-between font-normal"
        >
          <span className={cn('truncate', shown.length === 0 && 'text-ds-neutral-700')}>{summary}</span>
          <CaretUpDown size={16} aria-hidden="true" className="shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-64 p-0" align="start">
        <Command>
          {searchable && <CommandInput placeholder={t('search')} />}
          <CommandList className="max-h-72">
            <CommandEmpty>{t('noMatch')}</CommandEmpty>
            {groups.map((g) => (
              <CommandGroup key={g || '_'} heading={g || undefined}>
                {options.filter((o) => (o.group ?? '') === g).map(item)}
              </CommandGroup>
            ))}
          </CommandList>
          {draft.length > 0 && (
            <>
              <CommandSeparator />
              <div className="p-1">
                <Button type="button" variant="ghost" className="min-h-11 w-full justify-start" onClick={() => setDraft([])}>
                  {t('clearSelection')}
                </Button>
              </div>
            </>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  )
}
