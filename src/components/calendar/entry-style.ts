import type { BookingChannel } from '@/lib/bookings'
import type { CalendarEntry } from '@/lib/calendar'

// Farben nach Kanal wie im Entwurf (Booking.com accent-700, Airbnb accent-2-700, Direkt neutral-800).
// PROJ-11 ergänzt hier booking.com und Airbnb, sobald der Kanal-Typ sie kennt.
const CHANNEL: Record<BookingChannel, { fill: string; outline: string; dot: string }> = {
  direct: {
    fill: 'bg-ds-neutral-800 text-white',
    outline: 'border-2 border-ds-neutral-800 bg-ds-bg text-ds-text',
    dot: 'bg-ds-neutral-800',
  },
}

// Sperre: schraffiert wie im Entwurf
export const BLOCK_FILL =
  'bg-[repeating-linear-gradient(135deg,var(--color-neutral-300)_0_6px,var(--color-neutral-200)_6px_12px)] text-ds-neutral-800'

const channel = (entry: CalendarEntry) => CHANNEL[entry.channel] ?? CHANNEL.direct

// Balken: Buchung gefüllt, Option nur mit Rahmen, Sperre schraffiert
export function barClasses(entry: CalendarEntry): string {
  if (entry.kind === 'block') return BLOCK_FILL
  return entry.kind === 'option' ? channel(entry).outline : channel(entry).fill
}

// Farbpunkt in Tagesliste und Legende
export function dotClasses(entry: CalendarEntry): string {
  if (entry.kind === 'block') return BLOCK_FILL
  return entry.kind === 'option' ? channel(entry).outline.replace('border-2', 'border') : channel(entry).dot
}

export const LEGEND_CLASSES = {
  direct: CHANNEL.direct.dot,
  option: 'border border-ds-neutral-800 bg-ds-bg',
  block: BLOCK_FILL,
} as const
