// Firmenliste (PROJ-50): Typen und reine Regeln für Browser und Server.
// Lesefunktionen: src/lib/companies-data.ts (nur Server), Aktionen: src/app/(app)/gaeste/firmen/actions.ts.

import { addressLines } from '@/lib/guests'

export type CompanyErrorCode = 'notFound' | 'staleCompany' | 'mergeInvalid' | 'ownerOnly' | 'companyMissing'

export const COMPANY_PAGE_SIZE = 50
// Treffer der Firmensuche im Gastformular und im Zusammenführen-Dialog (wie GuestPicker)
export const COMPANY_SEARCH_LIMIT = 8
export const COMPANY_SEARCH_MIN_CHARS = 2

export const COMPANY_LIMITS = {
  nameMax: 200,
  vatIdMax: 30,
  addressLineMax: 200,
  postalCodeMax: 10,
  cityMax: 100,
  emailMax: 254,
  websiteMax: 200,
  contactMax: 200,
} as const

// Kurzform einer Firma für Auswahl, Karte, Liste und Gast (Anzeige „Name“, darunter UID · „PLZ Ort“ · Adresszeile 1)
export type CompanyRow = {
  id: string
  name: string
  // Platzhalter „Firma ohne Namen“ aus der Überführung (fällt bei der ersten Namensänderung weg)
  nameMissing: boolean
  vatId: string | null
  addressLine1: string | null
  postalCode: string | null
  city: string | null
  country: string | null
  guestCount: number
}

// Firma eines Gastes (Gast-Detail, Gastformular, Zusammenführen von Gästen)
export type CompanySummary = {
  id: string
  name: string
  nameMissing: boolean
  vatId: string | null
  addressLine1: string | null
  addressLine2: string | null
  postalCode: string | null
  city: string | null
  country: string | null
}

export type Company = {
  id: string
  name: string
  nameMissing: boolean
  vatId: string | null
  addressLine1: string | null
  addressLine2: string | null
  postalCode: string | null
  city: string | null
  country: string | null
  email: string | null
  website: string | null
  contact: string | null
  // Stand beim Laden; schützt beim Speichern vor dem Überschreiben fremder Änderungen
  updatedAt: string
  guestCount: number
}

export type CompanyFilters = { query: string; page: number }

export type CompanyPage = CompanyFilters & { rows: CompanyRow[]; total: number; pageCount: number }

// Grund eines Vorschlags „mögliche doppelte Firma“
export type CompanyDuplicateReason = 'name' | 'vatId'
export type CompanyDuplicatePair = { a: CompanyRow; b: CompanyRow; reasons: CompanyDuplicateReason[] }

// Angaben, die beim Zusammenführen einzeln gewählt werden (Reihenfolge = Anzeige); Rechnungsadresse als Ganzes
export const COMPANY_MERGE_FIELDS = ['name', 'vatId', 'address', 'email', 'website', 'contact'] as const
export type CompanyMergeField = (typeof COMPANY_MERGE_FIELDS)[number]
export type CompanyMergeChoice = Record<CompanyMergeField, 'a' | 'b'>

export const COMPANY_LIST = '/gaeste/firmen'
export const companyHref = (id: string) => `${COMPANY_LIST}/${id}`

export const companyAddress = (c: Pick<Company, 'addressLine1' | 'addressLine2' | 'postalCode' | 'city' | 'country'>, locale = 'de') =>
  addressLines({ lines: [c.addressLine1, c.addressLine2], postalCode: c.postalCode, city: c.city, country: c.country }, locale)

// Zweite Zeile in Auswahl und Karte: UID · „PLZ Ort“ · Adresszeile 1; leere Teile entfallen
export function companyDetailLine(c: Pick<CompanyRow, 'vatId' | 'postalCode' | 'city' | 'addressLine1'>): string {
  const place = [c.postalCode, c.city].filter(Boolean).join(' ')
  return [c.vatId, place, c.addressLine1].filter(Boolean).join(' · ')
}

// Webadresse als Link: „www.firma.at“ wird zu „https://www.firma.at“; andere Schemata als http(s) gibt es nicht
export function websiteHref(website: string): string | null {
  const value = website.trim()
  if (!value) return null
  if (/^https?:\/\//i.test(value)) return value
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return null
  return `https://${value}`
}

export function parseCompanyFilters(params: Record<string, string | string[] | undefined>): CompanyFilters {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''
  return {
    query: first(params.q).trim().slice(0, 200),
    page: Math.max(1, Math.floor(Number(first(params.seite)) || 1)),
  }
}

export function companyListHref(filters: Partial<CompanyFilters>): string {
  const params = new URLSearchParams()
  if (filters.query) params.set('q', filters.query)
  if (filters.page && filters.page > 1) params.set('seite', String(filters.page))
  const search = params.toString()
  return search ? `${COMPANY_LIST}?${search}` : COMPANY_LIST
}

// Werte einer Firma, die beim Zusammenführen zusammengehören
export function companyMergeValues(c: Company, field: CompanyMergeField): Partial<Company> {
  switch (field) {
    case 'name':
      return { name: c.name, nameMissing: c.nameMissing }
    case 'vatId':
      return { vatId: c.vatId }
    case 'address':
      return { addressLine1: c.addressLine1, addressLine2: c.addressLine2, postalCode: c.postalCode, city: c.city, country: c.country }
    case 'email':
      return { email: c.email }
    case 'website':
      return { website: c.website }
    case 'contact':
      return { contact: c.contact }
  }
}

export function sameCompanyMergeValue(a: Company, b: Company, field: CompanyMergeField): boolean {
  return JSON.stringify(companyMergeValues(a, field)) === JSON.stringify(companyMergeValues(b, field))
}

// Vorbelegung: Wert von A, außer A ist leer (bzw. Platzhaltername) und B nicht
export function defaultCompanyMergeChoice(a: Company, b: Company): CompanyMergeChoice {
  const isEmpty = (c: Company, field: CompanyMergeField) =>
    field === 'name' ? c.nameMissing : Object.values(companyMergeValues(c, field)).every((v) => v === null || v === '')
  return Object.fromEntries(
    COMPANY_MERGE_FIELDS.map((field) => [field, isEmpty(a, field) && !isEmpty(b, field) ? 'b' : 'a'])
  ) as CompanyMergeChoice
}
