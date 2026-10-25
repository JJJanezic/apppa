// Objekte und Wohnungen (PROJ-6): Typen und reine Regeln für Browser und Server.
// Lesefunktionen: src/lib/apartments-data.ts (nur Server), Aktionen: src/app/(app)/einstellungen/wohnungen/actions.ts.

export type ApartmentErrorCode =
  | 'duplicateApartmentName'
  | 'duplicatePropertyName'
  | 'municipalityInvalid'
  | 'propertyInUse'
  | 'apartmentHasBookings'
  | 'notFound'

// Bundesländer in der Reihenfolge der Gemeindekennziffern von Statistik Austria (erste Ziffer 1–9)
export const FEDERAL_STATES = [
  'burgenland',
  'kaernten',
  'niederoesterreich',
  'oberoesterreich',
  'salzburg',
  'steiermark',
  'tirol',
  'vorarlberg',
  'wien',
] as const
export type FederalState = (typeof FEDERAL_STATES)[number]

// Bundesland aus der 5-stelligen Gemeindekennziffer (z. B. 50408 → Salzburg)
export function stateOfMunicipality(code: string): FederalState | null {
  const digit = Number(code.charAt(0))
  return FEDERAL_STATES[digit - 1] ?? null
}

export type Municipality = { code: string; name: string; state: FederalState }

export type ApartmentKind = 'holiday' | 'service'

// Preisart (PROJ-27): Wohnungspreis pro Nacht oder Personenpreise pro Nacht
export type PriceMode = 'apartment' | 'person'
export const PRICE_MODES = ['apartment', 'person'] as const

// Kinderstufe: Kinder bis einschließlich toAge (Alter bei Anreise) zahlen priceCents pro Nacht
export type ChildPrice = { toAge: number; priceCents: number }

// Preis-Konfiguration einer Wohnung; daraus entsteht nur der rechnerische Vorschlag einer Buchung
export type ApartmentPricing = {
  priceMode: PriceMode
  // Wohnungspreis pro Nacht in Cent (Preisart „apartment“); null = keiner
  priceCents: number | null
  // Erwachsenenpreis pro Nacht in Cent (Preisart „person“)
  adultPriceCents: number | null
  childPrices: ChildPrice[]
}

export type Apartment = {
  id: string
  propertyId: string
  name: string
  maxGuests: number
  // Höchstens Erwachsene (PROJ-27); null = nur die Personenzahl gilt
  maxAdults: number | null
  kind: ApartmentKind
  priceMode: PriceMode
  // Wohnungspreis pro Nacht in Cent; null = keiner
  priceCents: number | null
  adultPriceCents: number | null
  childPrices: ChildPrice[]
  // Reinigungsgebühr in Cent (PROJ-8); null = keine
  cleaningFeeCents: number | null
  checkIn: string
  checkOut: string
  note: string | null
  archivedAt: string | null
  // PROJ-8: Hat die Wohnung Buchungen oder Sperren (auch stornierte)? Dann kein „Endgültig löschen“
  hasBookings: boolean
  // Personen bzw. Erwachsene der künftigen aktiven Buchungen und Optionen (Hinweise beim Archivieren und Senken der Kapazität)
  futureStays: { persons: number; adults: number }[]
}

export type Property = {
  id: string
  name: string
  street: string
  postalCode: string
  city: string
  municipality: Municipality
  apartments: Apartment[]
}

export const APARTMENT_DEFAULTS = { kind: 'holiday', checkIn: '15:00', checkOut: '10:00' } as const

export const LIMITS = {
  nameMax: 100,
  noteMax: 2000,
  guestsMin: 1,
  guestsMax: 50,
  priceMaxCents: 1_000_000,
  childPricesMax: 3,
  childAgeMax: 17,
  streetMax: 200,
  cityMax: 100,
} as const

// Anzeige überall (Liste, Kalender, Buchungen): „Haus Seeblick · Top 1“
export const apartmentLabel = (propertyName: string, apartmentName: string) => `${propertyName} · ${apartmentName}`

// Namen vergleichen wie die Datenbank: ohne Leerzeichen am Rand, ohne Groß-/Kleinschreibung
export const sameName = (a: string, b: string) => a.trim().toLocaleLowerCase('de') === b.trim().toLocaleLowerCase('de')

// Vereinheitlichter Suchname für Gemeinden: Kleinbuchstaben, Umlaute ausgeschrieben, „St.“ = „Sankt“,
// Satzzeichen weg. Gleiche Regel beim Einspielen der Gemeindeliste und bei der Suche.
export function municipalitySearchKey(value: string): string {
  return value
    .toLocaleLowerCase('de')
    .replaceAll('ä', 'ae')
    .replaceAll('ö', 'oe')
    .replaceAll('ü', 'ue')
    .replaceAll('ß', 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\bst\.?(?=\s|$)/g, 'sankt')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

// Preis aus der Eingabe („125“, „125,50“, „125.5“) in Cent; null bei leerer Eingabe, NaN bei ungültiger
export function parsePriceCents(input: string): number | null {
  const value = input.trim()
  if (!value) return null
  if (!/^\d{1,5}([.,]\d{1,2})?$/.test(value)) return Number.NaN
  return Math.round(Number(value.replace(',', '.')) * 100)
}

// Cent → Eingabewert für das Formular („125,50“; ganze Euro ohne Nachkommastellen)
export function priceInput(cents: number | null): string {
  if (cents === null) return ''
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2).replace('.', ',')
}

// Kinderstufen aus der Datenbank ([{ to_age, price_cents }]); ungültige Einträge werden übergangen
export function childPricesFromDb(value: unknown): ChildPrice[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((t): t is { to_age: number; price_cents: number } => typeof t?.to_age === 'number' && typeof t?.price_cents === 'number')
    .map((t) => ({ toAge: t.to_age, priceCents: t.price_cents }))
}

export const childPricesToDb = (tiers: readonly ChildPrice[]) => tiers.map((t) => ({ to_age: t.toAge, price_cents: t.priceCents }))

// Preis pro Nacht eines Kindes: erste Stufe, deren Altersgrenze das Alter umfasst, sonst der Erwachsenenpreis
export function childNightCents(pricing: Pick<ApartmentPricing, 'adultPriceCents' | 'childPrices'>, age: number): number | null {
  const tier = pricing.childPrices.find((t) => age <= t.toAge)
  return tier ? tier.priceCents : pricing.adultPriceCents
}

// Personen gruppiert nach Preis pro Nacht (für die Anzeige „2 × € 50 + 1 × € 20“), Erwachsene zuerst
export function personPriceGroups(
  pricing: Pick<ApartmentPricing, 'adultPriceCents' | 'childPrices'>,
  adults: number,
  childAges: readonly number[]
): { count: number; cents: number }[] | null {
  if (pricing.adultPriceCents === null) return null
  const groups = new Map<number, number>()
  if (adults > 0) groups.set(pricing.adultPriceCents, adults)
  for (const age of childAges) {
    const cents = childNightCents(pricing, age) ?? pricing.adultPriceCents
    groups.set(cents, (groups.get(cents) ?? 0) + 1)
  }
  return [...groups].map(([cents, count]) => ({ count, cents }))
}

// Höchster Betrag einer Buchung (Übernachtungspreis bzw. Position) in Cent, wie in der Datenbank (booking_amounts)
export const AMOUNT_MAX_CENTS = 100_000_000

// Rechnerischer Übernachtungspreis (Vorschlag) in Cent; null ohne Preis, ohne Nächte oder über dem Höchstbetrag.
// Gleiche Rechnung wie private.suggested_nights_cents in der Datenbank (Mitarbeiter-Buchungen).
export function suggestedNightsCents(pricing: ApartmentPricing, nights: number, adults: number, childAges: readonly number[]): number | null {
  if (nights < 1) return null
  let cents: number | null
  if (pricing.priceMode === 'apartment') cents = pricing.priceCents === null ? null : pricing.priceCents * nights
  else {
    const groups = personPriceGroups(pricing, adults, childAges)
    cents = groups === null ? null : nights * groups.reduce((sum, g) => sum + g.count * g.cents, 0)
  }
  return cents !== null && cents > AMOUNT_MAX_CENTS ? null : cents
}

// Ein Objekt wird ausgeblendet, wenn es Wohnungen hat und alle archiviert sind (außer bei „Archivierte anzeigen“)
export function visibleProperties(properties: Property[], showArchived: boolean): Property[] {
  if (showArchived) return properties
  return properties
    .map((p) => ({ ...p, apartments: p.apartments.filter((a) => !a.archivedAt) }))
    .filter((p, i) => p.apartments.length > 0 || properties[i].apartments.length === 0)
}
