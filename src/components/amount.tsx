import { cn } from '@/lib/utils'
import { formatCents } from '@/lib/format'

type AmountProps = {
  cents: number
  className?: string
}

// Betrag in Anzeigen (PROJ-32): „€ 1.250,00“, negativ „-€ 50,00“ in roter Schrift. Das Minus bleibt auch ohne
// Farbe erkennbar; Kontrast des Tokens `destructive` erfüllt WCAG AA. Eingabefelder bleiben ohne Farbe.
export function Amount({ cents, className }: AmountProps) {
  return <span className={cn('tabular-nums', cents < 0 && 'text-destructive', className)}>{formatCents(cents)}</span>
}
