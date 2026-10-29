// Umsatzsteuersatz je Position (PROJ-35): Sätze lesen, anzeigen und die enthaltene Umsatzsteuer je Satz berechnen.
// Reine Rechenregeln für Browser und Server. Sätze werden intern als ganze Zahl in Hundertstel-Prozent geführt
// (10,00 % = 1000, 5,5 % = 550), Beträge in Cent – so entstehen keine Kommazahl-Fehler.

import { formatNumber } from '@/lib/format'

// Vorbelegungen (Spec): Übernachtung 10 %, frei eingetippte Position 20 %, Stornogebühr 0 %
export const VAT_DEFAULTS = { nights: 1000, charge: 2000, cancellationFee: 0 } as const

// Auswahl der Bezeichnung im Buchungsformular: Eintrag → Satz (Texte: bookings.chargeSuggestions.*)
export const CHARGE_CHOICES = [
  { key: 'cleaning', vatBp: 1000 },
  { key: 'touristTax', vatBp: 0 },
] as const

export const VAT_BP_MAX = 10000

// Eingabe „10“, „10,5“, „10.5“, „10 %“ → Hundertstel-Prozent; null bei leer, NaN bei ungültig
// (Text, mehr als zwei Nachkommastellen, unter 0 oder über 100)
export function parseVatRate(input: string): number | null {
  const value = input.trim().replace(/\s*%$/, '').trim()
  if (!value) return null
  const m = /^(\d{1,3})(?:[.,](\d{1,2}))?$/.exec(value)
  if (!m) return Number.NaN
  const bp = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'))
  return bp <= VAT_BP_MAX ? bp : Number.NaN
}

// Eingabefeld: 1000 → „10,00“, 550 → „5,50“
export const vatRateInput = (bp: number): string =>
  formatNumber(bp / 100, { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false })

// Anzeige: 1000 → „10 %“, 550 → „5,5 %“ (Nachkommastellen nur, wenn nicht null)
export const formatVatRate = (bp: number): string =>
  `${formatNumber(bp / 100, { maximumFractionDigits: 2, useGrouping: false })} %`

// Wert an die Datenbank: 550 → „5.50“ (exakte Dezimalzahl, keine Kommazahl)
export const vatRateToDb = (bp: number): string => `${Math.trunc(bp / 100)}.${String(bp % 100).padStart(2, '0')}`

// Wert aus der Datenbank (numeric, kommt als Zahl oder Text) → Hundertstel-Prozent
export const vatRateFromDb = (value: number | string): number => Math.round(Number(value) * 100)

// Kaufmännisch runden, bei negativen Werten symmetrisch (-0,5 → -1)
const roundHalfAwayFromZero = (numerator: number, denominator: number): number => {
  const sign = Math.sign(numerator)
  return (sign * Math.floor((Math.abs(numerator) * 2 + denominator) / (2 * denominator))) || 0
}

export type VatLine = { amountCents: number; vatBp: number }
export type VatShare = { vatBp: number; grossCents: number; vatCents: number }

// Enthaltene Umsatzsteuer je Satz: Bruttobeträge je Satz summieren, dann Brutto × Satz / (100 + Satz) auf den Cent
// runden. Ergebnis aufsteigend nach Satz, ohne 0 %; leer, wenn alle Sätze 0 sind.
export function vatBreakdown(lines: readonly VatLine[]): VatShare[] {
  const gross = new Map<number, number>()
  for (const l of lines) gross.set(l.vatBp, (gross.get(l.vatBp) ?? 0) + l.amountCents)
  return [...gross.entries()]
    .filter(([bp]) => bp > 0)
    .sort(([a], [b]) => a - b)
    .map(([vatBp, grossCents]) => ({ vatBp, grossCents, vatCents: roundHalfAwayFromZero(grossCents * vatBp, VAT_BP_MAX + vatBp) }))
}

// Satz zu einer Bezeichnung (Umstellung bestehender Buchungen, Vorbelegung der automatisch eingetragenen Reinigung):
// „Reinigung“ 10 %, „Nächtigungsabgabe“ 0 %, sonst 20 % – ohne Groß-/Kleinschreibung und Rand-Leerzeichen
export function vatBpForLabel(label: string, labels: { cleaning: string; touristTax: string }): number {
  const key = label.trim().toLocaleLowerCase('de')
  if (key === labels.cleaning.toLocaleLowerCase('de')) return 1000
  if (key === labels.touristTax.toLocaleLowerCase('de')) return 0
  return VAT_DEFAULTS.charge
}
