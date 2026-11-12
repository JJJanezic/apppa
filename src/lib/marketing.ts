import { BOOKING_SOURCES, type BookingSource } from '@/lib/bookings'
import { formatDatePlain } from '@/lib/format'
import { countryName, isCountry, languageName, LANGUAGES, type Language } from '@/lib/guests'
import { csvText } from '@/lib/tourist-tax-report'

// Marketing: Segmente und CSV-Export (PROJ-52). Seite „Marketing“ nur für Inhaber des gewählten Kunden: Gäste mit
// Einwilligung „Erteilt“ (PROJ-19) und eigener E-Mail-Adresse oder Anschrift; Plattform-E-Mail und -Telefon nie.

export const MARKETING_PATH = '/marketing'
export const MARKETING_EXPORT_PATH = '/api/marketing/csv'
export const MARKETING_PAGE_SIZE = 50

// „Mindestens Aufenthalte“: Auswahl 1–10 (leer = egal)
export const MIN_STAYS_MAX = 10
export const SEGMENT_NAME_MAX = 60

// Sprache „Keine Angabe“ als eigener Wert in Filter und Adresse
export const NO_LANGUAGE = 'none'
export type LanguageFilter = Language | typeof NO_LANGUAGE

export const REACH = ['any', 'email', 'post'] as const
export type Reach = (typeof REACH)[number]

// Monat als „JJJJ-MM“
export type Month = string

// Die Filter der Seite; dieselbe Form speichert ein Segment (ohne Seite und Segment-Verweis)
export type MarketingFilters = {
  from: Month | null
  to: Month | null
  minStays: number | null
  properties: string[]
  apartments: string[]
  sources: BookingSource[]
  countries: string[]
  languages: LanguageFilter[]
  reach: Reach
}

export type MarketingView = MarketingFilters & {
  // geöffnetes Segment
  segment: string | null
  page: number
}

export const EMPTY_FILTERS: MarketingFilters = {
  from: null,
  to: null,
  minStays: null,
  properties: [],
  apartments: [],
  sources: [],
  countries: [],
  languages: [],
  reach: 'any',
}

type Params = Record<string, string | string[] | undefined>

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)
// Listen in der Adresse kommagetrennt (?land=DE,AT); Dubletten und Unbekanntes fallen weg, Reihenfolge bleibt
const list = <T extends string>(v: string | string[] | undefined, ok: (x: string) => x is T, max = 300): T[] => {
  const raw = (Array.isArray(v) ? v.join(',') : (v ?? '')).split(',').map((x) => x.trim())
  return [...new Set(raw.filter(ok))].slice(0, max)
}
const isUuid = (x: string): x is string => UUID.test(x)
const isSource = (x: string): x is BookingSource => (BOOKING_SOURCES as readonly string[]).includes(x)
const isLanguageFilter = (x: string): x is LanguageFilter => x === NO_LANGUAGE || (LANGUAGES as readonly string[]).includes(x)
const isCountryCode = (x: string): x is string => isCountry(x)
const month = (v: string | undefined): Month | null => (v && MONTH.test(v) && Number(v.slice(0, 4)) >= 2000 ? v : null)

// Zeitraum: Liegt „bis“ vor „von“, gilt nur „von“ (die Oberfläche lässt das gar nicht erst zu)
function period(from: Month | null, to: Month | null): Pick<MarketingFilters, 'from' | 'to'> {
  return from && to && to < from ? { from, to: null } : { from, to }
}

export function parseMarketingView(params: Params): MarketingView {
  const stays = Number(one(params.aufenthalte))
  const reach = one(params.erreichbar)
  const page = Number(one(params.seite))
  return {
    ...period(month(one(params.von)), month(one(params.bis))),
    minStays: Number.isInteger(stays) && stays >= 1 && stays <= MIN_STAYS_MAX ? stays : null,
    properties: list(params.objekt, isUuid),
    apartments: list(params.wohnung, isUuid),
    sources: list(params.quelle, isSource),
    countries: list(params.land, isCountryCode),
    languages: list(params.sprache, isLanguageFilter),
    reach: reach === 'email' || reach === 'post' ? reach : 'any',
    segment: isUuid(one(params.segment) ?? '') ? (one(params.segment) as string) : null,
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  }
}

export function marketingQuery(view: Partial<MarketingView>): URLSearchParams {
  const q = new URLSearchParams()
  if (view.segment) q.set('segment', view.segment)
  if (view.from) q.set('von', view.from)
  if (view.to) q.set('bis', view.to)
  if (view.minStays) q.set('aufenthalte', String(view.minStays))
  if (view.properties?.length) q.set('objekt', view.properties.join(','))
  if (view.apartments?.length) q.set('wohnung', view.apartments.join(','))
  if (view.sources?.length) q.set('quelle', view.sources.join(','))
  if (view.countries?.length) q.set('land', view.countries.join(','))
  if (view.languages?.length) q.set('sprache', view.languages.join(','))
  if (view.reach && view.reach !== 'any') q.set('erreichbar', view.reach)
  if (view.page && view.page > 1) q.set('seite', String(view.page))
  return q
}

export function marketingHref(view: Partial<MarketingView>): string {
  const q = marketingQuery(view).toString()
  return q ? `${MARKETING_PATH}?${q}` : MARKETING_PATH
}

// Download-Adresse mit denselben Filtern (ohne Seite); das Segment nur als Angabe fürs Protokoll
export function marketingExportHref(view: MarketingView): string {
  const q = marketingQuery({ ...view, page: 1 }).toString()
  return q ? `${MARKETING_EXPORT_PATH}?${q}` : MARKETING_EXPORT_PATH
}

export const filtersOf = (view: MarketingView | MarketingFilters): MarketingFilters => ({
  from: view.from,
  to: view.to,
  minStays: view.minStays,
  properties: view.properties,
  apartments: view.apartments,
  sources: view.sources,
  countries: view.countries,
  languages: view.languages,
  reach: view.reach,
})

export const hasAnyFilter = (f: MarketingFilters) => !sameFilters(f, EMPTY_FILTERS)

// Gleiche Filter (Reihenfolge in den Listen egal): Grundlage für „Segment aktualisieren“
export function sameFilters(a: MarketingFilters, b: MarketingFilters): boolean {
  const set = (x: readonly string[]) => [...x].sort().join(',')
  return (
    a.from === b.from &&
    a.to === b.to &&
    a.minStays === b.minStays &&
    a.reach === b.reach &&
    set(a.properties) === set(b.properties) &&
    set(a.apartments) === set(b.apartments) &&
    set(a.sources) === set(b.sources) &&
    set(a.countries) === set(b.countries) &&
    set(a.languages) === set(b.languages)
  )
}

// Gespeicherte Filter eines Segments (Datenbank, jsonb) lesen; Unbekanntes fällt weg wie in der Adresse
export function parseSegmentFilters(raw: unknown): MarketingFilters {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string').join(',') : undefined)
  const view = parseMarketingView({
    von: typeof o.from === 'string' ? o.from : undefined,
    bis: typeof o.to === 'string' ? o.to : undefined,
    aufenthalte: typeof o.minStays === 'number' ? String(o.minStays) : undefined,
    objekt: arr(o.properties),
    wohnung: arr(o.apartments),
    quelle: arr(o.sources),
    land: arr(o.countries),
    sprache: arr(o.languages),
    erreichbar: typeof o.reach === 'string' ? o.reach : undefined,
  })
  return filtersOf(view)
}

// Verweise auf Objekte und Wohnungen, die es nicht mehr gibt, entfernen (gespeichertes Segment, alter Link)
export function dropMissingPlaces(
  f: MarketingFilters,
  known: { properties: ReadonlySet<string>; apartments: ReadonlySet<string> }
): { filters: MarketingFilters; dropped: boolean } {
  const properties = f.properties.filter((id) => known.properties.has(id))
  const apartments = f.apartments.filter((id) => known.apartments.has(id))
  const dropped = properties.length !== f.properties.length || apartments.length !== f.apartments.length
  return { filters: { ...f, properties, apartments }, dropped }
}

// Trefferzeile (Liste und Export). E-Mail und Telefon kommen nur, wenn selbst erfasst (die Datenbank blendet Plattform-Daten aus).
export type MarketingRow = {
  id: string
  lastName: string
  firstName: string | null
  titlePrefix: string | null
  titleSuffix: string | null
  gender: string | null
  companyName: string | null
  email: string | null
  phone: string | null
  street: string | null
  postalCode: string | null
  city: string | null
  country: string | null
  language: string | null
  stayCount: number
  lastStay: string | null
  consentOn: string
}

export type MarketingPage = {
  rows: MarketingRow[]
  total: number
  // Gäste mit Einwilligung, aber ohne eigene E-Mail und ohne Anschrift (fehlen in Liste und Export)
  withoutContact: number
  page: number
  pageCount: number
  // false, solange die Datenbank-Abfrage fehlt (bis /backend)
  ready: boolean
}

export const reachOf = (r: Pick<MarketingRow, 'email' | 'street' | 'postalCode' | 'city'>) => ({
  email: Boolean(r.email),
  post: Boolean(r.street && (r.postalCode || r.city)),
})

export type Segment = { id: string; name: string; filters: MarketingFilters; updatedAt: string }

export type MarketingErrorCode = 'ownerOnly' | 'nameTaken' | 'nameRequired' | 'nameTooLong' | 'segmentGone' | 'segmentChanged' | 'tenantDeactivated'

// Anrede für Serienbriefe aus dem Geschlecht (PROJ-29): nur „Frau“/„Herr“, sonst leer
export function salutation(gender: string | null): string {
  return gender === 'female' ? 'Frau' : gender === 'male' ? 'Herr' : ''
}

// Kundenname im Dateinamen: Leerzeichen und in Dateinamen unzulässige Zeichen → „-“, Umlaute bleiben
export function fileNamePart(value: string): string {
  return (
    value
      .replace(/[\s/\\:*?"<>|]+/g, '-')
      .replace(/[\u0000-\u001f]+/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'Kunde'
  )
}

// gaeste_[Kundenname]_[JJJJ-MM-TT_HH-MM].csv in Wiener Zeit
export function marketingFileName(tenantName: string, now: Date = new Date()): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Vienna',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value])
  )
  return `gaeste_${fileNamePart(tenantName)}_${parts.year}-${parts.month}-${parts.day}_${parts.hour}-${parts.minute}.csv`
}

// Telefonnummern (nur Ziffern, Leerzeichen, „+“ vorne, „-“, „/“, Klammern) unverändert, damit „+43 …“ ohne Hochkomma im
// Newsletter-Programm ankommt (Nutzerentscheid QA BUG-2); alles andere wie jede Zelle gegen Formeln geschützt
const PHONE = /^\+?[\d(][\d\s\-/()]*$/
export const phoneCell = (value: string | null) => (value && PHONE.test(value) ? value : csvText(value ?? ''))

// CSV für Excel und Newsletter-Programme (PROJ-52): eine Zeile je Gast, Strichpunkt, UTF-8 mit BOM, CRLF, Schutz vor Formeln
// (csvText aus PROJ-16). Spalten: Anrede, Titel vor, Vorname, Nachname, Titel nach, Firma, E-Mail, Telefon, Straße, PLZ, Ort,
// Land, Sprache, Anzahl Aufenthalte, letzter Aufenthalt, eingewilligt seit.
export function buildMarketingCsv(rows: readonly MarketingRow[], columns: readonly string[], locale = 'de'): string {
  const text = (v: string | null | undefined) => csvText(v ?? '')
  const lines = [columns.map(csvText).join(';')]
  for (const r of rows) {
    lines.push(
      [
        text(salutation(r.gender)),
        text(r.titlePrefix),
        text(r.firstName),
        text(r.lastName),
        text(r.titleSuffix),
        text(r.companyName),
        text(r.email),
        phoneCell(r.phone),
        text(r.street),
        text(r.postalCode),
        text(r.city),
        text(r.country ? countryName(r.country, locale) : ''),
        text(r.language ? languageName(r.language, locale) : ''),
        String(r.stayCount),
        r.lastStay ? formatDatePlain(r.lastStay) : '',
        formatDatePlain(r.consentOn),
      ].join(';')
    )
  }
  return `\uFEFF${lines.join('\r\n')}\r\n`
}
