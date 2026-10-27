'use client'

import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { isIsoDate } from '@/lib/bookings'
import { cn } from '@/lib/utils'

interface DateJumpProps {
  // Angezeigter Zeitraum, z. B. „Oktober 2026“ (Inhalt des Auslösers)
  label: string
  // Vorlesetext des Auslösers, z. B. „Oktober 2026. Datum wählen“
  ariaLabel: string
  // Beschriftung des Datumsfelds („Springen zu“) und des Knopfs („Springen“)
  fieldLabel: string
  submitLabel: string
  inputId: string
  // Vorbelegung bei jedem Öffnen; ohne Angabe bleibt die letzte Eingabe stehen
  defaultDate?: string
  onJump: (date: string) => void
  triggerClassName?: string
}

// Sprungauswahl „Springen zu“ (PROJ-9), gemeinsam für Belegungskalender und Buchungsübersicht (PROJ-30).
// Klick oder Enter auf den Zeitraum öffnet das Feld; Escape oder Klick daneben schließt es ohne Sprung.
export function DateJump({ label, ariaLabel, fieldLabel, submitLabel, inputId, defaultDate, onJump, triggerClassName }: DateJumpProps) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(defaultDate ?? '')

  function onOpenChange(next: boolean) {
    if (next && defaultDate !== undefined) setDate(defaultDate)
    setOpen(next)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!isIsoDate(date)) return
    setOpen(false)
    onJump(date)
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" className={cn('min-h-11 px-2 font-normal tabular-nums', triggerClassName)} aria-label={ariaLabel}>
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto">
        <form onSubmit={submit} className="flex flex-col gap-3">
          <Label htmlFor={inputId}>{fieldLabel}</Label>
          <Input id={inputId} type="date" className="min-h-11 w-48" value={date} onChange={(e) => setDate(e.target.value)} />
          <Button type="submit" className="min-h-11" disabled={!isIsoDate(date)}>
            {submitLabel}
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  )
}
