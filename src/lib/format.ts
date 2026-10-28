// Einheitliche Zahlen-, Betrags- und Datumsformate der App (PROJ-2, PROJ-31).
// Zahlen: Tausender immer mit Punkt, Dezimalstellen mit Komma („1.179,80“). de-AT trennt einfache Zahlen,
// Prozent und Einheiten mit schmalem Leerzeichen („1 179,80“), Euro-Beträge dagegen mit Punkt. Darum: Zahlen,
// Prozent und Einheiten über de-DE (gleiche Zeichen), Euro über de-AT („€ 17.480,00“ statt „17.480,00 €“).
// Beträge immer mit zwei Nachkommastellen (PROJ-31).
// Datum: „Mi, 28.10.2026“, mit Uhrzeit „Di, 27.10.2026, 14:35“, ohne Wochentag „15.05.1978“ (PROJ-31).
// Ausnahmen mit next-intl format.dateTime(): Monatsüberschriften („Oktober 2026“) und das Datum unter dem
// Dashboard-Gruß.
//
// Regel: Zahlen, Beträge und Daten in der Oberfläche nur über diese Funktionen formatieren, nicht mit
// format.number()/format.dateTime() von next-intl, toLocaleString() oder „#“ in ICU-Texten (dort {value}
// mit formatNumber() übergeben). ESLint mahnt Abweichungen an (eslint.config.mjs).

const NUMBER_LOCALE = 'de-DE'
const CURRENCY_LOCALE = 'de-AT'

export function formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(NUMBER_LOCALE, { useGrouping: true, ...options }).format(value)
}

// 0.58 → „58 %“
export function formatPercent(value: number, options?: Intl.NumberFormatOptions): string {
  return formatNumber(value, { style: 'percent', maximumFractionDigits: 0, ...options })
}

// 17480 → „€ 17.480,00“ (immer zwei Nachkommastellen, PROJ-31)
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat(CURRENCY_LOCALE, {
    style: 'currency',
    currency: 'EUR',
    useGrouping: true,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

// Beträge sind in Cent gespeichert: 125050 → „€ 1.250,50“
export const formatCents = (cents: number): string => formatCurrency(cents / 100)

// Eingabewert eines Betragsfelds: 125000 → „1.250,00“; null → leer
export function amountInput(cents: number | null): string {
  if (cents === null) return ''
  return formatNumber(cents / 100, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// Betrag aus der Eingabe („125“, „125,50“, „1.250“, „1.250,50“, „125.5“, „€ 125“) in Cent;
// null bei leer, NaN bei ungültig. Ein Leser für die ganze App (Buchungen und Wohnungen, PROJ-31).
export function parseAmountCents(input: string): number | null {
  const value = input.trim().replace(/^€\s*/, '')
  if (!value) return null
  let normalized: string
  if (/^\d{1,3}(\.\d{3})+(,\d{1,2})?$/.test(value)) normalized = value.replaceAll('.', '').replace(',', '.')
  else if (/^\d{1,7}([.,]\d{1,2})?$/.test(value)) normalized = value.replace(',', '.')
  else return Number.NaN
  return Math.round(Number(normalized) * 100)
}

// ---- Datum (PROJ-31) ----------------------------------------------------------------------------
// Unabhängig von Sprache und Zeitzone des Geräts, damit Server und Browser dasselbe zeigen.
// Kalendertage („2026-10-28“) werden direkt aus dem Tag gebildet, Zeitpunkte in Wiener Zeit.

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'] as const
const TIME_ZONE = 'Europe/Vienna'
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

type DateParts = { year: string; month: string; day: string; weekday: number; hour: string; minute: string }

const viennaParts = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})

function partsOf(value: string | Date): DateParts {
  if (typeof value === 'string' && ISO_DAY.test(value)) {
    const [year, month, day] = value.split('-')
    const weekday = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).getUTCDay()
    return { year, month, day, weekday, hour: '00', minute: '00' }
  }
  const date = typeof value === 'string' ? new Date(value) : value
  const p = Object.fromEntries(viennaParts.formatToParts(date).map((x) => [x.type, x.value]))
  const weekday = new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day))).getUTCDay()
  return { year: p.year, month: p.month, day: p.day, weekday, hour: p.hour, minute: p.minute }
}

// Enge Stellen im Kalender: Wochentag „Mi“ bzw. Tageszahl „28“ eines Kalendertags
export const formatWeekday = (value: string | Date): string => WEEKDAYS[partsOf(value).weekday]
export const formatDayOfMonth = (value: string | Date): string => String(Number(partsOf(value).day))

// „15.05.1978“ (Geburts- und Ausstellungsdatum, enge Stellen)
export function formatDatePlain(value: string | Date): string {
  const p = partsOf(value)
  return `${p.day}.${p.month}.${p.year}`
}

// „Mi, 28.10.2026“ (Standard)
export function formatDate(value: string | Date): string {
  return `${WEEKDAYS[partsOf(value).weekday]}, ${formatDatePlain(value)}`
}

// „Di, 27.10.2026, 14:35“ (Zeitpunkte, Wiener Zeit)
export function formatDateTime(value: string | Date): string {
  const p = partsOf(value)
  return `${formatDate(value)}, ${p.hour}:${p.minute}`
}

// „Mi, 28.10.2026 – Di, 03.11.2026“
export const formatPeriod = (from: string, to: string): string => `${formatDate(from)} – ${formatDate(to)}`
