'use client'

import { forwardRef } from 'react'

import { Input } from '@/components/ui/input'
import { amountInput, parseAmountCents } from '@/lib/format'

type AmountInputProps = Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange'> & {
  value: string
  onValueChange: (value: string) => void
  // Bleibt unbenutzt; erlaubt {...field} aus react-hook-form, ohne dass dessen onChange das Event bekommt
  onChange?: unknown
}

// Betragsfeld (PROJ-31): Während des Tippens bleibt die Eingabe unverändert; beim Verlassen wird eine gültige
// Eingabe zu „1.250,00“ umgeschrieben. Leere oder ungültige Eingaben bleiben stehen (die Prüfung meldet sie).
export const AmountInput = forwardRef<HTMLInputElement, AmountInputProps>(function AmountInput(
  // onChange aus {...field} wird bewusst nicht weitergegeben
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  { value, onValueChange, onBlur, onChange: _onChange, ...props },
  ref
) {
  return (
    <Input
      ref={ref}
      inputMode="decimal"
      autoComplete="off"
      {...props}
      value={value}
      onChange={(e) => onValueChange(e.target.value)}
      onBlur={(e) => {
        const cents = parseAmountCents(value)
        if (cents !== null && !Number.isNaN(cents)) {
          const formatted = amountInput(cents)
          if (formatted !== value) onValueChange(formatted)
        }
        onBlur?.(e)
      }}
    />
  )
})
