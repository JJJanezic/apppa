// Erwartete Datumstexte für E2E-Tests (PROJ-31), unabhängig vom App-Code in src/lib/format.ts gebildet.

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

// „2026-10-28“ → „28.10.2026“
export const dePlain = (iso: string) => iso.split('-').reverse().join('.')

// „2026-10-28“ → „Mi, 28.10.2026“
export const deDate = (iso: string) => `${WEEKDAYS[new Date(`${iso}T12:00:00Z`).getUTCDay()]}, ${dePlain(iso)}`

// Für new RegExp(…): Punkte maskieren
export const re = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// Kalendertag und Uhrzeit eines Zeitpunkts in Wiener Zeit: „2026-10-27“, „14:35“
export const viennaDay = (at: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Vienna' }).format(at)
export const viennaTime = (at: Date) =>
  new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Vienna', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at)
