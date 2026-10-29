'use client'

import { forwardRef } from 'react'

import { Input } from '@/components/ui/input'
import { parseVatRate, vatRateInput } from '@/lib/vat'

type VatRateInputProps = Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange'> & {
  value: string
  onValueChange: (value: string) => void
  // Bleibt unbenutzt; erlaubt {...field} aus react-hook-form, ohne dass dessen onChange das Event bekommt
  onChange?: unknown
}

// Umsatzsteuersatz (PROJ-35) wie das Betragsfeld (PROJ-31): Während des Tippens bleibt die Eingabe unverändert;
// beim Verlassen wird ein gültiger Satz zu „13,00“ umgeschrieben („10 %“, „10.5“ werden verstanden).
// Leere oder ungültige Eingaben bleiben stehen (die Prüfung meldet sie).
export const VatRateInput = forwardRef<HTMLInputElement, VatRateInputProps>(function VatRateInput(
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
        const bp = parseVatRate(value)
        if (bp !== null && !Number.isNaN(bp)) {
          const formatted = vatRateInput(bp)
          if (formatted !== value) onValueChange(formatted)
        }
        onBlur?.(e)
      }}
    />
  )
})
