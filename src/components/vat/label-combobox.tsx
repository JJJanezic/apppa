'use client'

import { forwardRef, useId, useState } from 'react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export type LabelChoice = { key: string; label: string }

type LabelComboboxProps = Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange'> & {
  value: string
  // Freies Tippen: nur der Text ändert sich
  onValueChange: (value: string) => void
  // Eintrag aus der Liste gewählt (Maus, Touch oder Enter): Text und z. B. Steuersatz setzen
  onChoose: (choice: LabelChoice) => void
  choices: readonly LabelChoice[]
  // Liste offen? Der Aufrufer verhindert damit, dass Escape das Seitenpanel schließt
  onListOpenChange?: (open: boolean) => void
  listLabel: string
  // Bleibt unbenutzt; erlaubt {...field} aus react-hook-form
  onChange?: unknown
}

// Bezeichnung mit sichtbarer Auswahl (PROJ-35): Textfeld als zugängliches Kombinationsfeld (ARIA 1.2) mit einer
// Liste fester Einträge. Pfeiltasten wählen, Enter übernimmt, Escape schließt; freie Eingabe bleibt Text.
// Anders als die Vorschlagsliste des Browsers meldet es, ob ein Eintrag gewählt oder nur getippt wurde.
export const LabelCombobox = forwardRef<HTMLInputElement, LabelComboboxProps>(function LabelCombobox(
  // onChange aus {...field} wird bewusst nicht weitergegeben
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  { value, onValueChange, onChoose, choices, onListOpenChange, listLabel, onBlur, onFocus, onKeyDown, onChange: _onChange, className, ...props },
  ref
) {
  const listId = useId()
  const [open, setOpenState] = useState(false)
  const [active, setActive] = useState(-1)
  const query = value.trim().toLocaleLowerCase('de')
  const visible = choices.filter((c) => !query || c.label.toLocaleLowerCase('de').includes(query))
  const expanded = open && visible.length > 0

  function setOpen(next: boolean) {
    setOpenState(next)
    if (!next) setActive(-1)
    onListOpenChange?.(next)
  }

  function choose(choice: LabelChoice) {
    onValueChange(choice.label)
    onChoose(choice)
    setOpen(false)
  }

  return (
    <div className="relative">
      <Input
        ref={ref}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-activedescendant={expanded && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        className={className}
        {...props}
        value={value}
        onChange={(e) => {
          onValueChange(e.target.value)
          setActive(-1)
          if (!open) setOpen(true)
        }}
        onFocus={(e) => {
          setOpen(true)
          onFocus?.(e)
        }}
        onBlur={(e) => {
          setOpen(false)
          onBlur?.(e)
        }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            if (!open) setOpen(true)
            if (visible.length === 0) return
            const step = e.key === 'ArrowDown' ? 1 : -1
            setActive((i) => (i + step + visible.length) % visible.length)
          } else if (e.key === 'Enter' && expanded && active >= 0) {
            // Eintrag übernehmen statt das Formular abzuschicken
            e.preventDefault()
            choose(visible[active])
          } else if (e.key === 'Escape' && expanded) {
            e.preventDefault()
            setOpen(false)
          } else if (e.key === 'Tab') {
            setOpen(false)
          }
          onKeyDown?.(e)
        }}
      />
      <ul
        id={listId}
        role="listbox"
        aria-label={listLabel}
        hidden={!expanded}
        className="absolute inset-x-0 top-full z-50 mt-1 rounded-md border bg-popover p-1 text-popover-foreground shadow-md"
      >
        {visible.map((choice, i) => (
          <li
            key={choice.key}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === active}
            // Mausklick ohne Fokusverlust, damit die Auswahl vor dem Schließen ankommt
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => choose(choice)}
            onMouseEnter={() => setActive(i)}
            className={cn('flex min-h-11 cursor-default items-center rounded-sm px-2 text-sm', i === active && 'bg-accent text-accent-foreground')}
          >
            {choice.label}
          </li>
        ))}
      </ul>
    </div>
  )
})
