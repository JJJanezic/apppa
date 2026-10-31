// Nummernkreis der Rechnungen (PROJ-39): Aufbau [Präfix][JJJJ][Trennzeichen][laufende Nummer] und die Regel
// „nächste Nummer“. Eine Stelle für die Vorschau in den Einstellungen und den Vorschlag beim Ausstellen (PROJ-41).

export const NUMBER_SEPARATORS = ['-', '/', '.', ''] as const
export type NumberSeparator = (typeof NUMBER_SEPARATORS)[number]

export const NUMBERING_LIMITS = {
  prefixMax: 10,
  digitsMin: 3,
  digitsMax: 6,
  startMax: 999_999_999,
} as const

// Buchstaben, Ziffern, „-“, „/“, „_“, „.“ (gleiche Regel in der Datenbank)
export const PREFIX_PATTERN = /^[A-Za-z0-9\-/_.]*$/

export type NumberingSettings = {
  prefix: string
  withYear: boolean
  separator: NumberSeparator
  digits: number
  yearlyReset: boolean
  startNumber: number
  // Jahr, in dem die Startnummer eingetragen wurde; bei „jährlich neu“ gilt sie nur dann
  startYear: number | null
}

export const DEFAULT_NUMBERING: NumberingSettings = {
  prefix: '',
  withYear: true,
  separator: '-',
  digits: 4,
  yearlyReset: true,
  startNumber: 1,
  startYear: null,
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\/-]/g, '\\$&')

// „2026-0012“; mehr Ziffern als Stellen: die Nummer wächst weiter („2026-1000“)
export function formatInvoiceNumber(s: NumberingSettings, year: number, seq: number): string {
  const running = String(seq).padStart(s.digits, '0')
  return s.withYear ? `${s.prefix}${year}${s.separator}${running}` : `${s.prefix}${running}`
}

// Passt die Nummer genau zum Format? Dann Jahr (falls enthalten) und laufende Nummer, sonst null.
// Präfix ohne Rücksicht auf Groß-/Kleinschreibung (Nummern sind so eindeutig); andere Stellenzahl zählt mit.
export function parseInvoiceNumber(s: NumberingSettings, number: string): { year: number | null; seq: number } | null {
  const pattern = s.withYear ? `^${escape(s.prefix)}(\\d{4})${escape(s.separator)}(\\d+)$` : `^${escape(s.prefix)}(\\d+)$`
  const m = new RegExp(pattern, 'i').exec(number.trim())
  if (!m) return null
  const seq = Number(s.withYear ? m[2] : m[1])
  if (!Number.isSafeInteger(seq)) return null
  return { year: s.withYear ? Number(m[1]) : null, seq }
}

export type NextNumber = {
  number: string
  // Es gibt passende Nummern; die Startnummer greift deshalb nicht
  startIgnored: boolean
}

// Höchste passende laufende Nummer + 1, sonst die Startnummer. Bei „jährlich neu“ zählen nur Nummern mit der
// Jahreszahl des Rechnungsdatums, und die Startnummer gilt nur im Jahr, in dem sie eingetragen wurde (sonst 1).
// invoiceDate: Kalendertag „JJJJ-MM-TT“
export function nextInvoiceNumber(s: NumberingSettings, existing: readonly string[], invoiceDate: string): NextNumber {
  const year = Number(invoiceDate.slice(0, 4))
  const yearly = s.withYear && s.yearlyReset
  let max = 0
  for (const n of existing) {
    const parsed = parseInvoiceNumber(s, n)
    if (!parsed || (yearly && parsed.year !== year)) continue
    if (parsed.seq > max) max = parsed.seq
  }
  if (max > 0) return { number: formatInvoiceNumber(s, year, max + 1), startIgnored: true }
  const start = yearly && s.startYear !== year ? 1 : s.startNumber
  return { number: formatInvoiceNumber(s, year, start), startIgnored: false }
}

// Gleicher Nummernkreis? (Warnung beim Ändern nach dem ersten Ausstellen; das Jahr der Startnummer zählt nicht)
export const sameNumbering = (a: NumberingSettings, b: NumberingSettings) =>
  a.prefix === b.prefix &&
  a.withYear === b.withYear &&
  a.separator === b.separator &&
  a.digits === b.digits &&
  a.yearlyReset === b.yearlyReset &&
  a.startNumber === b.startNumber
