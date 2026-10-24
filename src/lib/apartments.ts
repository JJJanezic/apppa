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

export type Apartment = {
  id: string
  propertyId: string
  name: string
  maxGuests: number
  kind: ApartmentKind
  // Standardpreis pro Nacht in Cent; null = keiner
  priceCents: number | null
  checkIn: string
  checkOut: string
  note: string | null
  archivedAt: string | null
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

// Ein Objekt wird ausgeblendet, wenn es Wohnungen hat und alle archiviert sind (außer bei „Archivierte anzeigen“)
export function visibleProperties(properties: Property[], showArchived: boolean): Property[] {
  if (showArchived) return properties
  return properties
    .map((p) => ({ ...p, apartments: p.apartments.filter((a) => !a.archivedAt) }))
    .filter((p, i) => p.apartments.length > 0 || properties[i].apartments.length === 0)
}
