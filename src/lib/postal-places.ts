// Ort und Staat aus der PLZ (PROJ-48): Erkennen der PLZ, Wahl der Ortsliste, Befüllungsregel.
// Die Ortslisten (src/lib/postal-places-data/*.json) erzeugt scripts/build-postal-places.mts aus offenen Daten
// (AT: RTR, CC BY 3.0 AT; DE: GeoNames, CC BY 4.0). Nachgeschlagen wird nur im Browser.

export type PostalCountry = 'AT' | 'DE'
// PLZ → Postorte (alphabetisch)
export type PostalPlaces = Record<string, string[]>

const PREFIX: Record<string, PostalCountry> = { A: 'AT', AT: 'AT', D: 'DE', DE: 'DE' }
const DIGITS: Record<PostalCountry, number> = { AT: 4, DE: 5 }

// „A-6020“, „AT 6020“, „D-80331“, „60 20“ → Ziffern und ggf. Präfix; alles andere (Buchstaben, falsche Länge) → null
export function parsePostalCode(input: string): { digits: string; prefix: PostalCountry | null } | null {
  const match = /^(?:(AT|A|DE|D)-?)?(\d{4}|\d{5})$/i.exec(input.replace(/\s+/g, ''))
  if (!match) return null
  return { digits: match[2], prefix: match[1] ? PREFIX[match[1].toUpperCase()] : null }
}

// Ein Feld darf befüllt werden, wenn es leer ist oder noch den zuletzt automatisch eingetragenen Wert enthält
export function canAutofill(value: string, autoValue: string | null): boolean {
  return value === '' || (autoValue !== null && value === autoValue)
}

// In welcher Liste nachgeschlagen wird: gewähltes Land (AT/DE) oder – bei leerem bzw. automatisch gesetztem Land –
// die Stellenzahl. Bei anderem Land, unpassendem Präfix oder unvollständiger PLZ: null (es passiert nichts).
export function postalLookup(
  input: string,
  country: string,
  autoCountry: string | null
): { country: PostalCountry; code: string } | null {
  const parsed = parsePostalCode(input)
  if (!parsed) return null
  const byLength: PostalCountry = parsed.digits.length === DIGITS.AT ? 'AT' : 'DE'
  if (parsed.prefix && parsed.prefix !== byLength) return null
  const chosen = canAutofill(country, autoCountry) ? '' : country
  if (chosen && chosen !== byLength) return null
  return { country: byLength, code: parsed.digits }
}

export interface AutofillValues {
  city: string
  country: string
}

export interface AutofillPlan {
  values: AutofillValues
  // zuletzt automatisch eingetragene Werte (null = von Hand bzw. nicht automatisch)
  auto: { city: string | null; country: string | null }
  // mehrere Orte: zur Auswahl anzeigen
  choices: string[]
}

// Befüllungsregel der Spec: Ort und Land nur, wenn leer oder automatisch befüllt; bei mehreren Orten bleibt der Ort leer
export function planAutofill(current: AutofillValues, auto: AutofillPlan['auto'], country: PostalCountry, found: string[]): AutofillPlan {
  const plan: AutofillPlan = { values: { ...current }, auto: { ...auto }, choices: [] }
  if (found.length === 0) return plan
  if (canAutofill(current.country, auto.country)) {
    plan.values.country = country
    plan.auto.country = country
  }
  if (canAutofill(current.city, auto.city)) {
    if (found.length === 1) {
      plan.values.city = found[0]
      plan.auto.city = found[0]
    } else {
      plan.values.city = ''
      plan.auto.city = null
      plan.choices = found
    }
  }
  return plan
}

// Ortslisten erst bei Bedarf laden (eigene Bundles, vom Browser zwischengespeichert). Ladefehler → null, ohne Meldung.
const cache = new Map<PostalCountry, Promise<PostalPlaces | null>>()

export function loadPostalPlaces(country: PostalCountry): Promise<PostalPlaces | null> {
  let pending = cache.get(country)
  if (!pending) {
    const load = country === 'AT' ? import('./postal-places-data/at.json') : import('./postal-places-data/de.json')
    pending = load
      .then((m) => m.default as unknown as PostalPlaces)
      .catch(() => {
        cache.delete(country)
        return null
      })
    cache.set(country, pending)
  }
  return pending
}

// --- Erzeugung der Ortslisten (scripts/build-postal-places.mts) ---

// Großkunden-Einträge in den GeoNames-Daten (z. B. „80788 BMW AG“) sind keine Wohnorte
const COMPANY = /(?:^|\s)(?:GmbH|mbH|AG|KG|KGaA|SE|e\.\s?V\.|Niederlassung|Abrechnung|Verwaltung)(?:$|[\s,.-])/

// Doppelte zusammenfassen, Firmeneinträge entfernen, Ortsteile („Hamburg Altstadt“) neben dem Hauptort („Hamburg“) entfernen
export function cleanPlaceNames(names: string[]): string[] {
  const unique = [...new Set(names.map((n) => n.trim()).filter((n) => n && !COMPANY.test(n)))]
  return unique.filter((n) => !unique.some((main) => main !== n && n.startsWith(`${main} `))).sort((a, b) => a.localeCompare(b, 'de'))
}
