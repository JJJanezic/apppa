// Ortstaxe je Wohnung (PROJ-15): Tarife mit „gültig ab“ und die Rechenregel für die Abgabe einer Buchung.
// Reine Rechenregeln für Browser und Server. Dieselbe Regel gibt es in der Datenbank (maßgeblich beim Speichern, auch
// für Mitarbeiter); die Beispielfälle in tourist-tax.test.ts gelten für beide Fassungen.
// Beträge in Cent, Prozent- und Steuersätze in Hundertstel-Prozent (3,20 % = 320, wie src/lib/vat.ts).

import { addDays, todayIso } from '@/lib/bookings'

export const TOURIST_TAX_METHODS = ['per_person_night', 'percent'] as const
export type TouristTaxMethod = (typeof TOURIST_TAX_METHODS)[number]

// Basis bei Prozent: abgerechneter Übernachtungspreis ohne bzw. mit USt
export const TOURIST_TAX_BASES = ['net', 'gross'] as const
export type TouristTaxBase = (typeof TOURIST_TAX_BASES)[number]

// Bezeichnungen zur Auswahl (Texte: apartments.touristTax.labelChoices.*)
export const TOURIST_TAX_LABEL_CHOICES = ['overnightLevy', 'localTax', 'stayLevy'] as const

export const TOURIST_TAX_LIMITS = {
  labelMax: 100,
  amountMaxCents: 100_000,
  percentMaxBp: 10_000,
  ageMin: 1,
  ageMax: 18,
  ratesMax: 50,
} as const

// Ein Tarif-Eintrag einer Wohnung; id fehlt bei noch nicht gespeicherten Einträgen
export type TouristTaxRate = {
  id?: string
  validFrom: string
  label: string
  method: TouristTaxMethod
  // Betrag pro Person und Nacht (nur bei per_person_night)
  amountCents: number | null
  // Prozentsatz und Basis (nur bei percent)
  percentBp: number | null
  base: TouristTaxBase | null
  // Befreit unter … Jahren (nur bei per_person_night); null = keine Altersbefreiung
  exemptUnderAge: number | null
  vatBp: number
}

// Abgabe-Zustand einer Buchung: noch nicht berechnet (Altbestand vor PROJ-15), automatisch, von Hand überschrieben
export const TOURIST_TAX_MODES = ['pending', 'auto', 'manual'] as const
export type TouristTaxMode = (typeof TOURIST_TAX_MODES)[number]

// Kennzeichen einer Zusatzkosten-Position als Abgabe-Position
export type TouristTaxMark = { rateId: string | null; personNights: number | null }

// Person mit bekanntem Namen (Hauptgast, Mitreisende): Geburtsdatum und Befreiungs-Häkchen
export type TouristTaxPerson = { birthDate: string | null; exempt: boolean }

export type TouristTaxInput = {
  kind: 'booking' | 'option' | 'block'
  rates: readonly TouristTaxRate[]
  arrival: string
  // tatsächliche Abreise (Abgabe-Nächte, PROJ-30)
  departure: string
  // abgerechnete Nächte und abgerechneter Übernachtungspreis brutto (Basis bei Prozent)
  billableNights: number
  billedNightsCents: number
  nightsVatBp: number
  // Kleinunternehmer-Buchung (PROJ-36): netto = brutto
  smallBusiness: boolean
  residenceRegistered: boolean
  // Erwachsene + Kinder
  persons: number
  childCount: number
  // Hauptgast zuerst, dann Mitreisende; höchstens `persons` Einträge zählen
  people: readonly TouristTaxPerson[]
}

export type TouristTaxLine = {
  rateId: string | null
  validFrom: string
  label: string
  amountCents: number
  vatBp: number
  // abgabepflichtige Personennächte (nur bei Betrags-Tarifen)
  personNights: number | null
}

export type TouristTaxResult = {
  lines: TouristTaxLine[]
  // Personen ohne Geburtsdatum (und ohne Häkchen), die deshalb ohne Altersbefreiung zählen
  missingBirthDates: number
  // Abgabe-Nächte vor dem ersten Tarif-Eintrag
  nightsWithoutRate: number
}

const EMPTY: TouristTaxResult = { lines: [], missingBirthDates: 0, nightsWithoutRate: 0 }

// Neueste zuerst (Anzeige der Liste)
export const sortRates = <R extends Pick<TouristTaxRate, 'validFrom'>>(rates: readonly R[]): R[] =>
  [...rates].sort((a, b) => b.validFrom.localeCompare(a.validFrom))

// Tarif einer Nacht (Datum, an dem sie beginnt): jüngster Eintrag am oder vor dem Tag
export function rateOn<R extends Pick<TouristTaxRate, 'validFrom'>>(rates: readonly R[], day: string): R | null {
  let match: R | null = null
  for (const r of rates) if (r.validFrom <= day && (!match || r.validFrom > match.validFrom)) match = r
  return match
}

// Heute gültiger Eintrag (Zeile „Aktuell“) und künftige Einträge (Kennzeichen „künftig“)
export const currentRate = <R extends Pick<TouristTaxRate, 'validFrom'>>(rates: readonly R[], today: string = todayIso()) =>
  rateOn(rates, today)
export const isFutureRate = (rate: Pick<TouristTaxRate, 'validFrom'>, today: string = todayIso()) => rate.validFrom > today

// Alter in ganzen Jahren an einem Tag; der Geburtstag zählt schon (am 15. Geburtstag ist man 15).
// Am 29. Februar Geborene werden in Nicht-Schaltjahren am 1. März ein Jahr älter.
export function ageOn(birthDate: string, day: string): number {
  const years = Number(day.slice(0, 4)) - Number(birthDate.slice(0, 4))
  return day.slice(5) < birthDate.slice(5) ? years - 1 : years
}

// Kaufmännisch runden für nicht negative Brüche (große Zahlen exakt über BigInt)
function roundDiv(numerator: bigint, denominator: bigint): number {
  return Number((numerator * BigInt(2) + denominator) / (BigInt(2) * denominator))
}

// Nach Tarif-Eintrag gruppieren (Schlüssel: „gültig ab“, je Wohnung eindeutig)
type Acc = { rate: TouristTaxRate; nights: number; personNights: number }

// Abgabe einer Buchung: je berührtem Tarif-Eintrag eine Position, aufsteigend nach „gültig ab“.
// Betrag pro Person und Nacht: über die tatsächlichen Nächte, Altersbefreiung tagesgenau nach Geburtsdatum, Personen
// ohne Geburtsdatum zahlen voll, angehakte Personen nie. Prozent: über die abgerechneten Nächte, Basis gleichmäßig je
// Nacht verteilt, ohne Alters- und persönliche Befreiung. Positionen mit € 0,00 entfallen.
export function computeTouristTax(input: TouristTaxInput): TouristTaxResult {
  if (input.kind === 'block' || input.residenceRegistered || input.rates.length === 0) return EMPTY
  if (!(input.arrival < input.departure)) return EMPTY

  const persons = Math.max(0, input.persons)
  const named = input.people.slice(0, persons)
  const unnamed = persons - named.length
  const perPerson = new Map<string, Acc>()
  const percent = new Map<string, Acc>()
  let nightsWithoutRate = 0
  let ageLimitUsed = false

  // Betrags-Tarife: tatsächliche Nächte
  for (let day = input.arrival; day < input.departure; day = addDays(day, 1)) {
    const rate = rateOn(input.rates, day)
    if (!rate) {
      nightsWithoutRate++
      continue
    }
    if (rate.method !== 'per_person_night') continue
    const limit = rate.exemptUnderAge
    if (limit !== null) ageLimitUsed = true
    let paying = unnamed
    for (const p of named) {
      if (p.exempt) continue
      if (limit !== null && p.birthDate && ageOn(p.birthDate, day) < limit) continue
      paying++
    }
    const acc = perPerson.get(rate.validFrom) ?? { rate, nights: 0, personNights: 0 }
    acc.nights++
    acc.personNights += paying
    perPerson.set(rate.validFrom, acc)
  }

  // Prozent-Tarife: abgerechnete Nächte (auch bei früherer Abreise der ganze Preis)
  const billable = Math.max(0, input.billableNights)
  for (let i = 0; i < billable; i++) {
    const rate = rateOn(input.rates, addDays(input.arrival, i))
    if (!rate || rate.method !== 'percent') continue
    const acc = percent.get(rate.validFrom) ?? { rate, nights: 0, personNights: 0 }
    acc.nights++
    percent.set(rate.validFrom, acc)
  }

  const lines: TouristTaxLine[] = []
  for (const { rate, personNights } of perPerson.values()) {
    const amountCents = personNights * (rate.amountCents ?? 0)
    if (amountCents > 0) lines.push(lineOf(rate, amountCents, personNights))
  }
  for (const { rate, nights } of percent.values()) {
    const amountCents = percentAmount(input, rate, nights, billable)
    if (amountCents > 0) lines.push(lineOf(rate, amountCents, null))
  }
  lines.sort((a, b) => a.validFrom.localeCompare(b.validFrom))

  const missing = named.filter((p) => !p.exempt && !p.birthDate).length + unnamed
  return {
    lines,
    // Hinweis nur, wenn eine Altersgrenze gilt und Kinder in der Buchung sind (Spec)
    missingBirthDates: ageLimitUsed && input.childCount > 0 ? missing : 0,
    nightsWithoutRate,
  }
}

const lineOf = (rate: TouristTaxRate, amountCents: number, personNights: number | null): TouristTaxLine => ({
  rateId: rate.id ?? null,
  validFrom: rate.validFrom,
  label: rate.label,
  amountCents,
  vatBp: rate.vatBp,
  personNights,
})

// Basisanteil × Prozentsatz auf den Cent; netto = brutto × 100 / (100 + USt-Satz der Übernachtung)
function percentAmount(input: TouristTaxInput, rate: TouristTaxRate, nights: number, billable: number): number {
  const billed = BigInt(Math.max(0, input.billedNightsCents))
  if (billed === BigInt(0) || billable === 0) return 0
  const pct = BigInt(rate.percentBp ?? 0)
  const net = rate.base === 'net' && !input.smallBusiness
  const numerator = billed * BigInt(nights) * pct * (net ? BigInt(10_000) : BigInt(1))
  const denominator = BigInt(billable) * BigInt(10_000) * (net ? BigInt(10_000 + input.nightsVatBp) : BigInt(1))
  return roundDiv(numerator, denominator)
}

// Gespeicherte und berechnete Abgabe vergleichen (Angebot „Abgabe neu berechnen“): Bezeichnung, Betrag und Satz
// je Position, unabhängig von der Reihenfolge
type Comparable = { label: string; amountCents: number; vatBp: number }
const fingerprint = (lines: readonly Comparable[]) =>
  lines
    .map((l) => `${l.label.trim()}|${l.amountCents}|${l.vatBp}`)
    .sort()
    .join('\n')
export const sameTaxLines = (a: readonly Comparable[], b: readonly Comparable[]) => fingerprint(a) === fingerprint(b)

// Von Hand eingetragene Positionen mit einer Bezeichnung der Abgabe (Hinweis auf doppelte Verrechnung)
export function duplicateTaxLabels(manual: readonly { label: string }[], lines: readonly { label: string }[]): string[] {
  const wanted = new Set(lines.map((l) => l.label.trim().toLocaleLowerCase('de')))
  return [...new Set(manual.map((c) => c.label.trim()).filter((label) => wanted.has(label.toLocaleLowerCase('de'))))]
}

// Zeilen der Tabelle apartment_tourist_tax_rates → Einträge (Sätze kommen als numeric, siehe vatRateFromDb)
export type TouristTaxRateRow = {
  id: string
  apartment_id: string
  valid_from: string
  label: string
  method: string
  amount_cents: number | null
  percent_rate: number | string | null
  base: string | null
  exempt_under_age: number | null
  vat_rate: number | string
}

export const TOURIST_TAX_RATE_COLUMNS =
  'id, apartment_id, valid_from, label, method, amount_cents, percent_rate, base, exempt_under_age, vat_rate'

const bpFromDb = (value: number | string) => Math.round(Number(value) * 100)

export const rateFromRow = (r: TouristTaxRateRow): TouristTaxRate => ({
  id: r.id,
  validFrom: r.valid_from,
  label: r.label,
  method: r.method === 'percent' ? 'percent' : 'per_person_night',
  amountCents: r.amount_cents,
  percentBp: r.percent_rate === null ? null : bpFromDb(r.percent_rate),
  base: r.base === 'gross' ? 'gross' : r.base === 'net' ? 'net' : null,
  exemptUnderAge: r.exempt_under_age,
  vatBp: bpFromDb(r.vat_rate),
})

// Tarife je Wohnung, neueste zuerst
export function ratesByApartment(rows: readonly TouristTaxRateRow[]): Map<string, TouristTaxRate[]> {
  const map = new Map<string, TouristTaxRate[]>()
  for (const r of rows) map.set(r.apartment_id, [...(map.get(r.apartment_id) ?? []), rateFromRow(r)])
  for (const [id, list] of map) map.set(id, sortRates(list))
  return map
}
