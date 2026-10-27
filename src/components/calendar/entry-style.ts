import type { CalendarEntry } from '@/lib/calendar'

// Farben nach Kanal wie im Entwurf (Booking.com accent-700, Airbnb accent-2-700, Direkt neutral-800).
// PROJ-30: booking.com-Farbe für die Buchungsquelle „booking.com“; PROJ-11 ergänzt den importierten Kanal und Airbnb.
type ColorChannel = 'direct' | 'booking_com'

const CHANNEL: Record<ColorChannel, { fill: string; outline: string; dot: string }> = {
  direct: {
    fill: 'bg-ds-neutral-800 text-white',
    outline: 'border-2 border-ds-neutral-800 bg-ds-bg text-ds-text',
    dot: 'bg-ds-neutral-800',
  },
  booking_com: {
    fill: 'bg-ds-accent-700 text-white',
    outline: 'border-2 border-ds-accent-700 bg-ds-bg text-ds-text',
    dot: 'bg-ds-accent-700',
  },
}

// Sperre: schraffiert wie im Entwurf
export const BLOCK_FILL =
  'bg-[repeating-linear-gradient(135deg,var(--color-neutral-300)_0_6px,var(--color-neutral-200)_6px_12px)] text-ds-neutral-800'

// Einzige Farbregel für Kalender, Tagesliste und Legende
export const colorChannel = (entry: Pick<CalendarEntry, 'source'>): ColorChannel => (entry.source === 'booking_com' ? 'booking_com' : 'direct')

const channel = (entry: CalendarEntry) => CHANNEL[colorChannel(entry)]

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
  bookingCom: CHANNEL.booking_com.dot,
  option: 'border border-ds-neutral-800 bg-ds-bg',
  block: BLOCK_FILL,
} as const
