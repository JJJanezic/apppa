// Gäste-Datenbank (PROJ-7): Typen und reine Regeln für Browser und Server.
// Lesefunktionen: src/lib/guests-data.ts (nur Server), Aktionen: src/app/(app)/gaeste/actions.ts.

export type GuestErrorCode =
  | 'notFound'
  | 'staleGuest'
  | 'guestAnonymized'
  | 'mergeInvalid'
  | 'ownerOnly'

export const GUEST_PAGE_SIZE = 50

export const LIMITS = {
  nameMax: 100,
  emailMax: 254,
  phoneMax: 40,
  streetMax: 200,
  postalCodeMax: 20,
  cityMax: 100,
  marketingCustomMax: 100,
  companyNameMax: 200,
  vatIdMax: 30,
  billingAddressMax: 500,
  noteMax: 2000,
} as const

// „Wie kam der Gast erstmals zu uns?“ – Standardwerte (Texte: guests.marketing.*); dazu eine eigene Angabe als Freitext
export const MARKETING_SOURCES = ['website', 'instagram', 'google_ads', 'newsletter', 'referral', 'platform_search'] as const
export type MarketingSource = (typeof MARKETING_SOURCES)[number]
// Filterwerte zusätzlich zu den Standardwerten
export const MARKETING_CUSTOM = 'custom'
export const MARKETING_NONE = 'none'
export type MarketingFilter = MarketingSource | typeof MARKETING_CUSTOM | typeof MARKETING_NONE

// Korrespondenzsprachen (Namen über Intl.DisplayNames)
export const LANGUAGES = ['de', 'en', 'it', 'fr', 'nl', 'hu', 'cs', 'sl', 'hr', 'pl', 'es'] as const
export type Language = (typeof LANGUAGES)[number]

// Häufige Herkunftsländer stehen in der Auswahl oben (ISO 3166-1 alpha-2)
export const COMMON_COUNTRIES = ['AT', 'DE', 'CH', 'IT', 'NL', 'HU', 'CZ', 'SI', 'GB', 'US'] as const

// Alle Länder (ISO 3166-1 alpha-2); Namen liefert Intl.DisplayNames in der Sprache der Oberfläche
export const COUNTRIES = [
  'AD', 'AE', 'AF', 'AG', 'AL', 'AM', 'AO', 'AR', 'AT', 'AU', 'AZ', 'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ',
  'BN', 'BO', 'BR', 'BS', 'BT', 'BW', 'BY', 'BZ', 'CA', 'CD', 'CF', 'CG', 'CH', 'CI', 'CL', 'CM', 'CN', 'CO', 'CR', 'CU',
  'CV', 'CY', 'CZ', 'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ', 'EC', 'EE', 'EG', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FM', 'FR', 'GA',
  'GB', 'GD', 'GE', 'GH', 'GM', 'GN', 'GQ', 'GR', 'GT', 'GW', 'GY', 'HK', 'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IN',
  'IQ', 'IR', 'IS', 'IT', 'JM', 'JO', 'JP', 'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KZ', 'LA', 'LB', 'LC',
  'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY', 'MA', 'MC', 'MD', 'ME', 'MG', 'MH', 'MK', 'ML', 'MM', 'MN', 'MO', 'MR',
  'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ', 'NA', 'NE', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NZ', 'OM', 'PA', 'PE', 'PG',
  'PH', 'PK', 'PL', 'PS', 'PT', 'PW', 'PY', 'QA', 'RO', 'RS', 'RU', 'RW', 'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SI', 'SK',
  'SL', 'SM', 'SN', 'SO', 'SR', 'SS', 'ST', 'SV', 'SY', 'SZ', 'TD', 'TG', 'TH', 'TJ', 'TL', 'TM', 'TN', 'TO', 'TR', 'TT',
  'TV', 'TW', 'TZ', 'UA', 'UG', 'US', 'UY', 'UZ', 'VA', 'VC', 'VE', 'VN', 'VU', 'WS', 'XK', 'YE', 'ZA', 'ZM', 'ZW',
] as const
const COUNTRY_SET: ReadonlySet<string> = new Set(COUNTRIES)
export const isCountry = (code: string): boolean => COUNTRY_SET.has(code)

// Woher stammt eine Kontaktangabe? „platform“ setzt erst der Import aus Channex (PROJ-11)
export type ContactSource = 'direct' | 'platform'

export type GuestStays = {
  // aktive Buchungen (ohne Optionen)
  count: number
  // alle Einträge des Gastes, auch Optionen und stornierte (dann wird beim Löschen anonymisiert)
  bookings: number
  // ISO-Datum (Anreise) des letzten bzw. nächsten Aufenthalts; bis PROJ-8 immer leer
  last: string | null
  next: string | null
  // Kanäle der Buchungen (PROJ-8/11)
  channels: string[]
}

export type Guest = {
  id: string
  lastName: string
  firstName: string | null
  country: string
  email: string | null
  emailSource: ContactSource
  phone: string | null
  phoneSource: ContactSource
  language: Language | null
  birthDate: string | null
  street: string | null
  postalCode: string | null
  city: string | null
  addressCountry: string | null
  marketingSource: MarketingSource | null
  marketingCustom: string | null
  companyName: string | null
  companyVatId: string | null
  companyBillingAddress: string | null
  note: string | null
  anonymizedAt: string | null
  // Stand beim Laden; schützt beim Speichern vor dem Überschreiben fremder Änderungen
  updatedAt: string
  stays: GuestStays
}

export type GuestRow = {
  id: string
  lastName: string
  firstName: string | null
  companyName: string | null
  country: string
  stayCount: number
  lastStay: string | null
  anonymized: boolean
}

export type GuestSort = 'name' | 'lastStay'

export type GuestFilters = {
  query: string
  country: string | null
  marketing: MarketingFilter | null
  sort: GuestSort
  page: number
}

export type GuestPage = GuestFilters & { rows: GuestRow[]; total: number; pageCount: number }

// Grund eines Dubletten-Vorschlags
export type DuplicateReason = 'email' | 'phone' | 'name'

export type DuplicatePair = { a: GuestRow; b: GuestRow; reasons: DuplicateReason[] }

// Mögliche Doppeleinträge beim Anlegen (Warnung „Bestehenden Gast öffnen“)
export type DuplicateMatch = { guest: GuestRow; reasons: DuplicateReason[] }

// Angaben, die beim Zusammenführen einzeln gewählt werden (Reihenfolge = Anzeige)
export const MERGE_FIELDS = [
  'name',
  'country',
  'email',
  'phone',
  'language',
  'birthDate',
  'address',
  'marketing',
  'company',
  'note',
] as const
export type MergeField = (typeof MERGE_FIELDS)[number]
export type MergeChoice = Record<MergeField, 'a' | 'b'>

export const guestHref = (id: string) => `/gaeste/${id}`

// „Huber, Anna“ für Listen; nur Nachname, wenn kein Vorname (z. B. „Familie Berger“)
export function guestSortName(g: { lastName: string; firstName: string | null }): string {
  return g.firstName ? `${g.lastName}, ${g.firstName}` : g.lastName
}

// „Anna Huber“ für Überschriften
export function guestDisplayName(g: { lastName: string; firstName: string | null }): string {
  return g.firstName ? `${g.firstName} ${g.lastName}` : g.lastName
}

// Vereinheitlichung für Suche und Dublettenvergleich: Kleinbuchstaben, ohne Akzente, Leerraum zusammengefasst.
// „ß“ wird „ss“, „ø“ „o“ usw.; „Mueller“ und „Müller“ gelten bewusst nicht als gleich (Spec, Edge Cases).
export function searchKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/[øØ]/g, 'o')
    .replace(/[æÆ]/g, 'ae')
    .replace(/[łŁ]/g, 'l')
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Telefonnummern werden nur über ihre Ziffern verglichen („+43 664 …“ = „0043664…“ ist bewusst nicht gleich)
export function phoneDigits(value: string): string {
  return value.replace(/\D/g, '')
}

// Relay-Adressen der Plattformen wechseln je Buchung und gelten nicht als „gleiche E-Mail“ (Tech Design D)
const PLATFORM_RELAY_DOMAINS = ['guest.booking.com', 'guest.airbnb.com'] as const
export function isPlatformRelayEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split('@')[1] ?? ''
  return PLATFORM_RELAY_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))
}

// Gründe, warum zwei Gäste derselbe sein könnten (gleiche E-Mail, Telefonnummer oder Vor- und Nachname)
export function duplicateReasons(
  a: { lastName: string; firstName: string | null; email: string | null; phone: string | null },
  b: { lastName: string; firstName: string | null; email: string | null; phone: string | null }
): DuplicateReason[] {
  const reasons: DuplicateReason[] = []
  const email = (e: string | null) => (e && !isPlatformRelayEmail(e) ? e.trim().toLowerCase() : '')
  if (email(a.email) && email(a.email) === email(b.email)) reasons.push('email')
  const phone = (p: string | null) => (p ? phoneDigits(p) : '')
  if (phone(a.phone).length >= 6 && phone(a.phone) === phone(b.phone)) reasons.push('phone')
  if (a.firstName && b.firstName && searchKey(guestDisplayName(a)) === searchKey(guestDisplayName(b))) reasons.push('name')
  return reasons
}

// Länder- und Sprachnamen in der Sprache der Oberfläche (eingebaute Sprachfunktion, keine eigene Liste)
export function countryName(code: string, locale = 'de'): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}

export function languageName(code: string, locale = 'de'): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'language' }).of(code) ?? code
  } catch {
    return code
  }
}

// Länderauswahl: häufige Länder zuerst (feste Reihenfolge), danach alle übrigen alphabetisch
export function countryOptions(locale = 'de'): { common: { code: string; name: string }[]; others: { code: string; name: string }[] } {
  const named = (code: string) => ({ code, name: countryName(code, locale) })
  const common = COMMON_COUNTRIES.map(named)
  const others = COUNTRIES.filter((c) => !(COMMON_COUNTRIES as readonly string[]).includes(c))
    .map(named)
    .sort((a, b) => a.name.localeCompare(b.name, locale))
  return { common, others }
}

// Gelesene Filter aus der Adresse (?q, land, quelle, sortierung, seite) – ungültige Werte werden ignoriert
export function parseGuestFilters(params: Record<string, string | string[] | undefined>): GuestFilters {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''
  const country = first(params.land).toUpperCase()
  const marketing = first(params.quelle)
  const isMarketing = (v: string): v is MarketingFilter =>
    (MARKETING_SOURCES as readonly string[]).includes(v) || v === MARKETING_CUSTOM || v === MARKETING_NONE
  return {
    query: first(params.q).trim().slice(0, 200),
    country: isCountry(country) ? country : null,
    marketing: isMarketing(marketing) ? marketing : null,
    sort: first(params.sortierung) === 'aufenthalt' ? 'lastStay' : 'name',
    page: Math.max(1, Math.floor(Number(first(params.seite)) || 1)),
  }
}

// Adresse der Gästeliste zu Filtern (leere Werte und Standard weglassen)
export function guestListHref(filters: Partial<GuestFilters>): string {
  const params = new URLSearchParams()
  if (filters.query) params.set('q', filters.query)
  if (filters.country) params.set('land', filters.country)
  if (filters.marketing) params.set('quelle', filters.marketing)
  if (filters.sort === 'lastStay') params.set('sortierung', 'aufenthalt')
  if (filters.page && filters.page > 1) params.set('seite', String(filters.page))
  const search = params.toString()
  return search ? `/gaeste?${search}` : '/gaeste'
}

// Werte eines Gastes, die beim Zusammenführen zusammengehören (z. B. alle Adressfelder)
export function mergeFieldValues(g: Guest, field: MergeField): Partial<Guest> {
  switch (field) {
    case 'name':
      return { lastName: g.lastName, firstName: g.firstName }
    case 'country':
      return { country: g.country }
    case 'email':
      return { email: g.email, emailSource: g.emailSource }
    case 'phone':
      return { phone: g.phone, phoneSource: g.phoneSource }
    case 'language':
      return { language: g.language }
    case 'birthDate':
      return { birthDate: g.birthDate }
    case 'address':
      return { street: g.street, postalCode: g.postalCode, city: g.city, addressCountry: g.addressCountry }
    case 'marketing':
      return { marketingSource: g.marketingSource, marketingCustom: g.marketingCustom }
    case 'company':
      return { companyName: g.companyName, companyVatId: g.companyVatId, companyBillingAddress: g.companyBillingAddress }
    case 'note':
      return { note: g.note }
  }
}

// Sind die Werte einer Angabe bei beiden Gästen gleich? Dann muss nichts gewählt werden.
export function sameMergeValue(a: Guest, b: Guest, field: MergeField): boolean {
  return JSON.stringify(mergeFieldValues(a, field)) === JSON.stringify(mergeFieldValues(b, field))
}

// Vorbelegung beim Zusammenführen: Wert von A, außer A ist leer und B nicht
export function defaultMergeChoice(a: Guest, b: Guest): MergeChoice {
  const isEmpty = (g: Guest, field: MergeField) => Object.values(mergeFieldValues(g, field)).every((v) => v === null || v === '' || v === 'direct')
  return Object.fromEntries(
    MERGE_FIELDS.map((field) => [field, isEmpty(a, field) && !isEmpty(b, field) ? 'b' : 'a'])
  ) as MergeChoice
}
