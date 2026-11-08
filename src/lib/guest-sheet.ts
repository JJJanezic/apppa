// Gästeblatt (PROJ-26): Regeln, Typen und Standardtexte. Gilt im Browser und auf dem Server; die Datenbank prüft die
// Pflichtangaben beim Fertigstellen noch einmal mit derselben Regel.

import { type BookingKind, currentMonth, todayIso } from '@/lib/bookings'
import { countryName, type DocumentType, type Gender } from '@/lib/guests'
import { pdfDoc } from '@/lib/invoice-pdf/view'
import { docFromText, type RichDoc } from '@/lib/rich-text'

export type GuestSheetErrorCode =
  | 'notImplemented'
  | 'notExpected'
  | 'noGuest'
  | 'guestAnonymized'
  | 'incomplete'
  | 'tooManyCompanions'
  | 'staleBooking'
  | 'staleGuest'
  | 'sheetExists'
  | 'signatureMissing'
  | 'pdfInvalid'
  | 'pdfTooLarge'
  | 'uploadFailed'
  | 'signedOnFuture'
  | 'sheetNumberTooLong'
  | 'textRequired'
  | 'staleSettings'

export const GUEST_SHEET_BUCKET = 'guest-sheets'
// Hochgeladene Gästeblätter: nur PDF, höchstens 10 MB (gleiche Grenze im Speicherbereich)
export const GUEST_SHEET_PDF_MAX_BYTES = 10 * 1024 * 1024
// Lfd.-Nr. wie die Gästeblattnummer der Buchung (PROJ-30)
export const SHEET_NUMBER_MAX = 30
// Datenschutz-Texte in den Einstellungen
export const GUEST_SHEET_TEXT_MAX = 5000
// Unterschriften: Mindestlänge des Strichs in CSS-Pixeln, darunter gilt sie als leer (nur ein Punkt oder Tupfer)
export const SIGNATURE_MIN_LENGTH = 60

export const GUEST_SHEET_KINDS = ['signed', 'uploaded'] as const
export type GuestSheetKind = (typeof GUEST_SHEET_KINDS)[number]

export const guestSheetListHref = '/gaesteblaetter'
export const guestSheetSignHref = (bookingId: string) => `/gaesteblatt/${bookingId}`
// PDF zum Ansehen (Original bzw. mit Abreise-Nachtrag beim Öffnen erzeugt)
export const guestSheetPdfHref = (sheetId: string) => `/api/gaesteblatt/${sheetId}/pdf`

// Ist für die Buchung ein Gästeblatt vorgesehen? Nur Buchungen, nicht storniert, ohne „Wohnsitz angemeldet“ (Spec)
export const guestSheetExpected = (b: { kind: BookingKind; cancelledAt: string | null; residenceRegistered: boolean }) =>
  b.kind === 'booking' && b.cancelledAt === null && !b.residenceRegistered

// ---- Angaben auf Seite 1 ----------------------------------------------------------------------------

export type SheetGuest = {
  lastName: string
  firstName: string | null
  titlePrefix: string | null
  titleSuffix: string | null
  gender: Gender
  birthDate: string | null
  // Staatsangehörigkeit (Spalte „country“)
  country: string
  documentType: DocumentType | null
  documentNumber: string | null
  documentIssuedOn: string | null
  documentAuthority: string | null
  documentCountry: string | null
  street: string | null
  postalCode: string | null
  city: string | null
  // Herkunftsland (Staat des Wohnsitzes)
  addressCountry: string | null
}

export type SheetCompanion = { lastName: string; firstName: string; birthDate: string | null }

export type SheetStay = { arrival: string; plannedDeparture: string; persons: number }

// Reisedokument nur bei ausländischen Gästen (Formular: „bei ausländischen Gästen“)
export const needsTravelDocument = (g: Pick<SheetGuest, 'country'>) => g.country !== 'AT'

export const SHEET_GUEST_FIELDS = [
  'lastName',
  'firstName',
  'gender',
  'birthDate',
  'country',
  'documentType',
  'documentNumber',
  'documentIssuedOn',
  'documentAuthority',
  'documentCountry',
  'street',
  'postalCode',
  'city',
  'addressCountry',
] as const
export type SheetGuestField = (typeof SHEET_GUEST_FIELDS)[number]

const DOCUMENT_FIELDS: readonly SheetGuestField[] = ['documentType', 'documentNumber', 'documentIssuedOn', 'documentAuthority', 'documentCountry']
export const isDocumentField = (f: SheetGuestField) => DOCUMENT_FIELDS.includes(f)

export const SHEET_COMPANION_FIELDS = ['lastName', 'firstName', 'birthDate'] as const
export type SheetCompanionField = (typeof SHEET_COMPANION_FIELDS)[number]

export type SheetGaps = {
  // fehlende Pflichtfelder des Hauptgasts (das Geschlecht hat immer einen Wert, „keine Angabe“ zählt)
  guest: SheetGuestField[]
  // je Mitreisendem die fehlenden Felder (Index wie in der Liste)
  companions: SheetCompanionField[][]
  // wie viele Mitreisende fehlen noch (Personen − 1 − erfasst), nie negativ
  companionsMissing: number
  // mehr Mitreisende als Personen − 1 (Buchung korrigieren)
  companionsTooMany: boolean
}

const blank = (v: string | null | undefined) => v === null || v === undefined || v.trim() === ''

// Pflichtangaben laut Meldeformular (Spec, Frage 6). Eine Regel für die Seite und das Fertigstellen auf dem Server.
export function sheetGaps(guest: SheetGuest, companions: readonly SheetCompanion[], persons: number): SheetGaps {
  const required: SheetGuestField[] = ['lastName', 'firstName', 'birthDate', 'country', 'street', 'postalCode', 'city', 'addressCountry']
  if (needsTravelDocument(guest)) required.push(...DOCUMENT_FIELDS)
  const expected = Math.max(0, persons - 1)
  return {
    guest: SHEET_GUEST_FIELDS.filter((f) => required.includes(f) && blank(guest[f] as string | null)),
    companions: companions.map((c) => SHEET_COMPANION_FIELDS.filter((f) => blank(c[f]))),
    companionsMissing: Math.max(0, expected - companions.length),
    companionsTooMany: companions.length > expected,
  }
}

export const sheetComplete = (g: SheetGaps) =>
  g.guest.length === 0 && g.companions.every((c) => c.length === 0) && g.companionsMissing === 0 && !g.companionsTooMany

// ---- Eingefrorene Fassung --------------------------------------------------------------------------

// Alles, was auf dem unterschriebenen Blatt steht. Spätere Änderungen an Gast, Buchung oder Texten wirken nicht.
export type GuestSheetSnapshot = {
  version: 1
  // Name des Beherbergungsbetriebes = Kundenname
  tenantName: string
  sheetNumber: string | null
  guest: SheetGuest
  companions: SheetCompanion[]
  stay: SheetStay
  // Datenschutz-Texte mit ersetzten Platzhaltern
  privacyText: RichDoc
  marketingText: RichDoc
  marketingConsent: boolean
  // Zeitpunkte der Unterschriften (ISO mit Zeit)
  signedAt1: string
  signedAt2: string
}

// Den Hinweis „Buchung nach der Unterschrift geändert“ (Ankunft, voraussichtliche Abreise, Hauptgast, Mitreisende;
// Gastdaten zählen nicht) berechnet die Datenbank in der Lesesicht der Gästeblätter, für Buchung und Liste gleich.

// ---- Tatsächliche Abreise auf dem Blatt (Spec, Variante B) ------------------------------------------

export type SheetDeparture = { date: string; noted: { at: string; by: string | null } | null; automatic: boolean } | null

// noted: Datenbank-Vermerk, wenn jemand nach der Unterschrift die Abreise an der Buchung gespeichert hat.
// Sonst ab dem Abreisetag automatisch die Abreise der Buchung (läuft mit der geplanten mit, solange niemand sie ändert).
export function sheetDeparture(p: { departure: string; noted: { at: string; by: string | null } | null; today: string }): SheetDeparture {
  if (p.noted) return { date: p.departure, noted: p.noted, automatic: false }
  if (p.today >= p.departure) return { date: p.departure, noted: null, automatic: true }
  return null
}

// ---- Übersicht in Buchung und Liste ----------------------------------------------------------------

export type GuestSheetSummary = {
  id: string
  bookingId: string
  kind: GuestSheetKind
  sheetNumber: string | null
  marketingConsent: boolean
  createdAt: string
  createdBy: string | null
  // unterschrieben: Zeitpunkt der zweiten Unterschrift; hochgeladen: „Unterschrieben am“ (optional, nur Datum)
  signedAt: string | null
  replacedAt: string | null
  changed: boolean
}

// ---- Liste „Gästeblätter“ --------------------------------------------------------------------------

export const GUEST_SHEET_PAGE_SIZE = 50

export type GuestSheetFilters = {
  // Monat der Ankunft „2026-11“ oder null für „Alle Monate“
  month: string | null
  query: string
  // „Gästeblatt fehlt“: statt der Blätter die Buchungen ohne Blatt (Ankunft bis heute)
  missing: boolean
  page: number
}

export type GuestSheetRow = {
  id: string
  bookingId: string
  bookingNumber: string | null
  kind: GuestSheetKind
  sheetNumber: string | null
  guestName: string | null
  arrival: string
  departure: string
  apartmentLabel: string
  marketingConsent: boolean
  changed: boolean
  cancelled: boolean
}

export type MissingSheetRow = {
  bookingId: string
  bookingNumber: string | null
  guestName: string | null
  arrival: string
  departure: string
  apartmentLabel: string
  sheetNumber: string | null
}

export type GuestSheetPage = GuestSheetFilters & {
  rows: GuestSheetRow[]
  missingRows: MissingSheetRow[]
  total: number
  pageCount: number
  // false: Datenbank noch ohne Gästeblätter (vor der Migration)
  ready: boolean
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/
const ALL_MONTHS = 'alle'

// ?monat=2026-10|alle, q, fehlt=1, seite – ungültige Werte werden ignoriert; Standard: aktueller Monat
export function parseGuestSheetFilters(params: Record<string, string | string[] | undefined>, today: string = todayIso()): GuestSheetFilters {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''
  const month = first(params.monat)
  return {
    month: month === ALL_MONTHS ? null : MONTH.test(month) ? month : currentMonth(today),
    query: first(params.q).trim().slice(0, 100),
    missing: first(params.fehlt) === '1',
    page: Math.max(1, Math.floor(Number(first(params.seite)) || 1)),
  }
}

export function guestSheetListUrl(filters: Partial<GuestSheetFilters>, today: string = todayIso()): string {
  const params = new URLSearchParams()
  if (filters.month === null) params.set('monat', ALL_MONTHS)
  else if (filters.month && filters.month !== currentMonth(today)) params.set('monat', filters.month)
  if (filters.query) params.set('q', filters.query)
  if (filters.missing) params.set('fehlt', '1')
  if (filters.page && filters.page > 1) params.set('seite', String(filters.page))
  const search = params.toString()
  return search ? `${guestSheetListHref}?${search}` : guestSheetListHref
}

// ---- Datenschutz-Texte -----------------------------------------------------------------------------

export const GUEST_SHEET_PLACEHOLDERS = ['Kundenname', 'Anschrift', 'E-Mail', 'Telefon'] as const
export type GuestSheetPlaceholder = (typeof GUEST_SHEET_PLACEHOLDERS)[number]

export type GuestSheetTexts = {
  // null = Standardtext der App
  privacy: RichDoc | null
  marketing: RichDoc | null
  updatedAt: string | null
}

export const DEFAULT_PRIVACY_TEXT = `Verantwortlich für die Verarbeitung Ihrer personenbezogenen Daten ist {Kundenname}, {Anschrift}, E-Mail: {E-Mail}, Telefon: {Telefon}.

Wir verarbeiten die Angaben dieses Gästeblatts (Namen, Geschlecht, Geburtsdaten, Staatsangehörigkeit, Anschrift, Reisedokument, Aufenthaltsdaten und Mitreisende) elektronisch. Das ist nötig, um unsere gesetzlichen Pflichten nach dem Meldegesetz und den Abgabenvorschriften (Ortstaxe) zu erfüllen (Art. 6 Abs. 1 lit. c DSGVO) und um Ihren Beherbergungsvertrag einschließlich der Rechnungslegung abzuwickeln (Art. 6 Abs. 1 lit. b DSGVO).

Ihre Daten geben wir nur weiter, soweit ein Gesetz das verlangt, etwa an die Gemeinde oder an Sicherheitsbehörden. Gespeichert werden sie bei IT-Dienstleistern mit Sitz bzw. Rechenzentrum in der EU, die als Auftragsverarbeiter an unsere Weisungen gebunden sind.

Das Gästeblatt bewahren wir sieben Jahre auf; Rechnungsdaten so lange, wie es das Steuer- und Unternehmensrecht vorschreibt. Danach werden die Daten gelöscht.

Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Sie können sich außerdem bei der Österreichischen Datenschutzbehörde (www.dsb.gv.at) beschweren.

Mit meiner Unterschrift bestätige ich, diese Information erhalten zu haben.`

export const DEFAULT_MARKETING_TEXT = `Ich willige ein, dass {Kundenname} meinen Namen, meine Anschrift, E-Mail-Adresse und Telefonnummer sowie die Daten meiner Aufenthalte speichert und verwendet, um mir Angebote und Neuigkeiten zu den eigenen Unterkünften per Post, E-Mail oder telefonisch zu senden.

Diese Einwilligung ist freiwillig. Wenn ich sie nicht erteile, hat das keinen Einfluss auf meinen Aufenthalt. Ich kann sie jederzeit ohne Angabe von Gründen mit Wirkung für die Zukunft widerrufen, zum Beispiel per E-Mail an {E-Mail}.`

export const defaultPrivacyDoc = (): RichDoc => docFromText(DEFAULT_PRIVACY_TEXT)
export const defaultMarketingDoc = (): RichDoc => docFromText(DEFAULT_MARKETING_TEXT)

// Gespeicherter Text oder Standard
export const effectiveTexts = (t: Pick<GuestSheetTexts, 'privacy' | 'marketing'>) => ({
  privacy: t.privacy ?? defaultPrivacyDoc(),
  marketing: t.marketing ?? defaultMarketingDoc(),
})

export type SheetIssuer = {
  name: string
  addressLine1: string | null
  addressLine2: string | null
  postalCode: string | null
  city: string | null
  country: string | null
  email: string | null
  phone: string | null
}

// Werte der Platzhalter aus den Stammdaten; leere Angaben bleiben leer (die Vorschau weist darauf hin)
export function sheetPlaceholderValues(i: SheetIssuer, locale = 'de'): Record<GuestSheetPlaceholder, string> {
  const place = [i.postalCode, i.city].filter(Boolean).join(' ')
  const address = [i.addressLine1, i.addressLine2, place, i.country ? countryName(i.country, locale) : null].filter(Boolean).join(', ')
  return { Kundenname: i.name, Anschrift: address, 'E-Mail': i.email ?? '', Telefon: i.phone ?? '' }
}

// Platzhalter, die im Text stehen, deren Wert in den Stammdaten aber fehlt (Hinweis in der Vorschau)
export function emptyPlaceholders(texts: readonly string[], values: Record<GuestSheetPlaceholder, string>): GuestSheetPlaceholder[] {
  return GUEST_SHEET_PLACEHOLDERS.filter((p) => values[p] === '' && texts.some((t) => t.includes(`{${p}}`)))
}

// Texte für Blatt und PDF: Platzhalter aus den Stammdaten gefüllt; fehlende Angaben als „–“, damit kein „Telefon: “ ohne
// Wert stehen bleibt
export function filledTexts(texts: Pick<GuestSheetTexts, 'privacy' | 'marketing'>, issuer: SheetIssuer, locale = 'de') {
  const values = Object.fromEntries(Object.entries(sheetPlaceholderValues(issuer, locale)).map(([k, v]) => [k, v || '–']))
  const docs = effectiveTexts(texts)
  return {
    privacy: pdfDoc(docs.privacy, values) ?? defaultPrivacyDoc(),
    marketing: pdfDoc(docs.marketing, values) ?? defaultMarketingDoc(),
  }
}
