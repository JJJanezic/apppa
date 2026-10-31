// Rechnungsentwurf (PROJ-40 „Rechnungsdaten sammeln“): Typen und alle Rechenregeln des Entwurfs an einer Stelle –
// Vorauswahl der Positionen, Teilbetrag mit anteiliger USt, Abzüge der Schlussrechnung, Summen und Knopf „Rechnung“,
// Fälligkeiten mit Rückfallregel, Platzhalter-Werte, Gastnamen und Pflichtangaben. Reine Regeln ohne
// Datenbankzugriff für Formular, Detailseite, Vorschau, Server-Aktion und später das Ausstellen (PROJ-41).

import { formatCents } from '@/lib/format'
import { guestTitledName, type PaymentRules, salutation, textDate, type PlaceholderValues, type TextBlockKind } from '@/lib/invoice-texts'
import { addDays, nightsBetween } from '@/lib/bookings'
import type { RichDoc } from '@/lib/rich-text'
import { VAT_DEFAULTS, VAT_BP_MAX, vatBreakdown, type VatLine, type VatShare } from '@/lib/vat'
import type { VatStatusChange } from '@/lib/vat-status'

// ---- Arten und Auswahlen ------------------------------------------------------------------------

// Rechnung (Positionen), Teilrechnung (Anzahlung über Prozent/Betrag), Schlussrechnung (Positionen minus Abzüge)
export const INVOICE_KINDS = ['invoice', 'partial', 'final'] as const
export type InvoiceKind = (typeof INVOICE_KINDS)[number]

// Empfänger: Gast oder Firma des Hauptgasts (Kopie, alle Felder überschreibbar)
export const RECIPIENT_KINDS = ['guest', 'company'] as const
export type RecipientKind = (typeof RECIPIENT_KINDS)[number]

// Block 3: keine Gastnamen (immer vorausgewählt), Hauptgast, Hauptgast mit Mitreisenden
export const GUEST_NAME_MODES = ['none', 'main', 'all'] as const
export type GuestNameMode = (typeof GUEST_NAME_MODES)[number]

// {Anrede} bei Firma als Empfänger: „Sehr geehrte Damen und Herren“ (vorausgewählt) oder Anrede des Hauptgasts
export const COMPANY_SALUTATIONS = ['generic', 'guest'] as const
export type CompanySalutation = (typeof COMPANY_SALUTATIONS)[number]

// Teilrechnung: Eingabe als Prozent vom Gesamtpreis oder als Eurobetrag
export const PARTIAL_MODES = ['percent', 'amount'] as const
export type PartialMode = (typeof PARTIAL_MODES)[number]

// Feste Texte auf der Rechnung (Rechnungen sind deutsch, PROJ-23 folgt später)
export const GENERIC_SALUTATION = 'Sehr geehrte Damen und Herren'
export const DRAFT_NUMBER_TEXT = 'Entwurf'
export const DELETED_GUEST_TEXT = 'Gelöschter Gast'

// Grenzen der Pflichtangaben (§ 11 UStG): Kleinbetragsrechnung bis € 400, UID des Empfängers ab € 10.000 (brutto)
export const SMALL_INVOICE_LIMIT_CENTS = 40_000
export const RECIPIENT_VAT_ID_LIMIT_CENTS = 1_000_000

export const DRAFT_LIMITS = {
  recipientNameMax: 200,
  recipientLineMax: 200,
  postalCodeMax: 10,
  cityMax: 100,
  vatIdMax: 30,
  // Prozent der Teilrechnung in Hundertstel (0,01 % bis 100 %)
  partialPercentBpMin: 1,
  partialPercentBpMax: VAT_BP_MAX,
} as const

export const invoiceNewHref = (bookingId: string) => `/rechnungen/neu?buchung=${bookingId}`
export const invoiceEditHref = (id: string) => `/rechnungen/${id}/bearbeiten`
export const invoicePreviewHref = (id: string) => `/rechnungen/${id}/vorschau`

// ---- Herkunft der Positionen --------------------------------------------------------------------

// Woher eine Rechnungsposition stammt: Übernachtung, Stornogebühr oder eine bestimmte Zusatzkosten-Position
// („charge:<Kennung>“). Eigene Positionen haben keine Herkunft.
export type LineSource = 'nights' | 'cancellation_fee' | `charge:${string}`

export const chargeSource = (chargeId: string): LineSource => `charge:${chargeId}`

const ID = /^[0-9a-f-]{36}$/i

export function isLineSource(value: string): value is LineSource {
  if (value === 'nights' || value === 'cancellation_fee') return true
  return value.startsWith('charge:') && ID.test(value.slice(7))
}

// Spalten der Rechnungsposition: source_kind („nights“, „cancellation_fee“, „charge“) und source_charge_id
export function lineSourceToDb(source: LineSource | null): { source_kind: string | null; source_charge_id: string | null } {
  if (!source) return { source_kind: null, source_charge_id: null }
  if (source.startsWith('charge:')) return { source_kind: 'charge', source_charge_id: source.slice(7) }
  return { source_kind: source, source_charge_id: null }
}

export function lineSourceFromDb(kind: string | null, chargeId: string | null): LineSource | null {
  if (kind === 'nights' || kind === 'cancellation_fee') return kind
  if (kind === 'charge' && chargeId) return chargeSource(chargeId)
  return null
}

// ---- Buchung und andere Rechnungen --------------------------------------------------------------

export type DraftLine = VatLine & { label: string; source: LineSource | null }

export type DraftGuest = {
  id: string
  lastName: string
  firstName: string | null
  titlePrefix: string | null
  titleSuffix: string | null
  gender: string
  anonymized: boolean
  street: string | null
  postalCode: string | null
  city: string | null
  addressCountry: string | null
  companyName: string | null
  companyVatId: string | null
  companyAddressLine1: string | null
  companyAddressLine2: string | null
  companyPostalCode: string | null
  companyCity: string | null
  companyCountry: string | null
}

// Buchung, aus der der Entwurf entsteht. Zeitraum, Wohnung und Gastnamen sind immer aktuell.
export type DraftBooking = {
  id: string
  kind: 'booking' | 'option' | 'block'
  number: string | null
  arrival: string
  departure: string
  cancelledAt: string | null
  apartmentLabel: string
  guest: DraftGuest | null
  // Mitreisende in der Reihenfolge der Buchung (ohne Titel, PROJ-8)
  companions: { firstName: string; lastName: string }[]
  // Positionen der Buchung in der Reihenfolge aus PROJ-34 (storniert: nur die Stornogebühr);
  // null für Mitarbeiter (keine Preise)
  lines: DraftLine[] | null
}

export type InvoiceOriginKind = 'backfilled' | 'draft' | 'issued'

// Andere Rechnung derselben Buchung (Vorauswahl, Summen, Abzüge)
export type BookingInvoiceSummary = {
  id: string
  number: string | null
  origin: InvoiceOriginKind
  // nur bei Entwürfen und ausgestellten Rechnungen
  kind: InvoiceKind | null
  invoiceDate: string
  totalCents: number
  lines: (VatLine & { source: LineSource | null })[]
}

// Positionen einer Buchung für die Rechnung: aktiv → abgerechnete Übernachtung und Zusatzkosten (mit Kennung);
// storniert → nur die Stornogebühr, falls vorhanden
export function bookingDraftLines(
  a: {
    cancelled: boolean
    billedNightsCents: number
    nightsVatBp: number
    charges: { id: string; label: string; amountCents: number; vatBp: number }[]
    cancellationFeeCents: number | null
    cancellationFeeVatBp: number
  },
  labels: { nights: string; cancellationFee: string }
): DraftLine[] {
  if (a.cancelled) {
    return a.cancellationFeeCents === null
      ? []
      : [{ source: 'cancellation_fee', label: labels.cancellationFee, amountCents: a.cancellationFeeCents, vatBp: a.cancellationFeeVatBp }]
  }
  return [
    { source: 'nights', label: labels.nights, amountCents: a.billedNightsCents, vatBp: a.nightsVatBp },
    ...a.charges.map((c): DraftLine => ({ source: chargeSource(c.id), label: c.label, amountCents: c.amountCents, vatBp: c.vatBp })),
  ]
}

export const sumCents = (lines: readonly { amountCents: number }[]) => lines.reduce((sum, l) => sum + l.amountCents, 0)

// Zu verrechnen: Gesamtpreis bzw. bei stornierten Buchungen die Stornogebühr (0, wenn keine)
export const billableCents = (lines: readonly DraftLine[]) => sumCents(lines)

// „Verrechnet“: nacherfasste und ausgestellte Rechnungen; „In Entwürfen“: Entwürfe (ohne den gerade bearbeiteten)
export function invoiceSums(invoices: readonly Pick<BookingInvoiceSummary, 'id' | 'origin' | 'totalCents'>[], excludeId?: string) {
  let billedCents = 0
  let draftCents = 0
  for (const i of invoices) {
    if (i.id === excludeId) continue
    if (i.origin === 'draft') draftCents += i.totalCents
    else billedCents += i.totalCents
  }
  return { billedCents, draftCents }
}

export type InvoiceButtonState = { enabled: true } | { enabled: false; reason: 'cancelledNoFee' | 'nothingToBill' | 'overBilled' | 'fullyBilled' }

// Knopf „Rechnung“: aktiv, solange Verrechnet + In Entwürfen < Gesamtpreis (storniert: < Stornogebühr)
export function invoiceButtonState(b: { cancelled: boolean; hasFee: boolean; billableCents: number; billedCents: number; draftCents: number }): InvoiceButtonState {
  if (b.cancelled && !b.hasFee) return { enabled: false, reason: 'cancelledNoFee' }
  if (b.billableCents <= 0) return { enabled: false, reason: 'nothingToBill' }
  if (b.billedCents > b.billableCents) return { enabled: false, reason: 'overBilled' }
  if (b.billedCents + b.draftCents >= b.billableCents) return { enabled: false, reason: 'fullyBilled' }
  return { enabled: true }
}

// ---- Positionen (Art Rechnung und Schlussrechnung) ----------------------------------------------

// Verwendung einer Buchungsposition in einer anderen Rechnung: ausgestellt („bereits in Rechnung …“) oder Entwurf
export type LineUse = { draft: boolean; number: string | null; date: string }

export type PreselectedLine = DraftLine & { selected: boolean; usedBy: LineUse | null }

// Vorauswahl: Nur Buchungspositionen, die in keiner anderen Rechnung (Art Rechnung oder Schlussrechnung, Entwurf oder
// ausgestellt) dieser Buchung stehen, sind angewählt. Teilrechnungen und nacherfasste Rechnungen zählen nicht.
export function preselectLines(bookingLines: readonly DraftLine[], others: readonly BookingInvoiceSummary[], selfId?: string): PreselectedLine[] {
  const used = new Map<LineSource, LineUse>()
  const consuming = others
    .filter((o) => o.id !== selfId && o.origin !== 'backfilled' && (o.kind === 'invoice' || o.kind === 'final'))
    // ausgestellte Rechnungen vor Entwürfen, sonst nach Datum: der Hinweis nennt die maßgebliche
    .sort((a, b) => Number(a.origin === 'draft') - Number(b.origin === 'draft') || a.invoiceDate.localeCompare(b.invoiceDate))
  for (const o of consuming) {
    for (const l of o.lines) {
      if (l.source && !used.has(l.source)) used.set(l.source, { draft: o.origin === 'draft', number: o.number, date: o.invoiceDate })
    }
  }
  return bookingLines.map((l) => {
    const usedBy = l.source ? (used.get(l.source) ?? null) : null
    return { ...l, selected: usedBy === null, usedBy }
  })
}

// ---- Teilrechnung -------------------------------------------------------------------------------

// Prozent in Hundertstel (20 % = 2000) → Betrag, kaufmännisch auf Cent
export const amountFromPercent = (percentBp: number, baseCents: number) => Math.round((baseCents * percentBp) / VAT_BP_MAX)

// Betrag → Prozent in Hundertstel (auf 0,01 % gerundet); ohne Gesamtpreis null
export const percentFromAmount = (amountCents: number, baseCents: number): number | null =>
  baseCents > 0 ? Math.round((amountCents * VAT_BP_MAX) / baseCents) : null

// Aufteilung des Teilbetrags anteilig nach den USt-Sätzen der Buchungspositionen: Bruttobeträge je Satz, Anteil auf
// Cent gerundet, Rundungsrest beim größten Anteil – die Summe entspricht genau dem Teilbetrag. Aufsteigend nach Satz.
// Ohne verwertbare Positionen eine Zeile zum Satz der Übernachtung.
export function splitByVat(amountCents: number, bookingLines: readonly VatLine[]): VatLine[] {
  const gross = new Map<number, number>()
  for (const l of bookingLines) gross.set(l.vatBp, (gross.get(l.vatBp) ?? 0) + l.amountCents)
  const rates = [...gross.entries()].filter(([, g]) => g !== 0)
  const total = rates.reduce((sum, [, g]) => sum + g, 0)
  if (total <= 0 || rates.length === 0) return [{ vatBp: bookingLines[0]?.vatBp ?? VAT_DEFAULTS.nights, amountCents }]
  const shares = rates.map(([vatBp, g]) => ({ vatBp, gross: g, amountCents: Math.round((amountCents * g) / total) }))
  const rest = amountCents - shares.reduce((sum, s) => sum + s.amountCents, 0)
  if (rest !== 0) {
    const largest = shares.reduce((max, s) => (Math.abs(s.gross) > Math.abs(max.gross) ? s : max), shares[0])
    largest.amountCents += rest
  }
  return shares
    .filter((s) => s.amountCents !== 0)
    .sort((a, b) => a.vatBp - b.vatBp)
    .map(({ vatBp, amountCents: cents }) => ({ vatBp, amountCents: cents }))
}

// Zeile der Teilrechnung (Anreise/Abreise ohne Wochentag wie alle Datumsangaben auf der Rechnung)
export const partialLabel = (b: Pick<DraftBooking, 'apartmentLabel' | 'arrival' | 'departure'>) =>
  `Anzahlung für Aufenthalt in ${b.apartmentLabel} vom ${textDate(b.arrival)} bis ${textDate(b.departure)}`

// ---- Schlussrechnung: Abzüge --------------------------------------------------------------------

// Abziehbar: Teilrechnungen aus der App (vorausgewählt) und nacherfasste Rechnungen (abgewählt) derselben Buchung
export type DeductionCandidate = BookingInvoiceSummary & { preselected: boolean }

export function deductionCandidates(others: readonly BookingInvoiceSummary[], selfId?: string): DeductionCandidate[] {
  return others
    .filter((o) => o.id !== selfId && (o.origin === 'backfilled' || o.kind === 'partial'))
    .map((o) => ({ ...o, preselected: o.origin !== 'backfilled' }))
    .sort((a, b) => a.invoiceDate.localeCompare(b.invoiceDate) || (a.number ?? '').localeCompare(b.number ?? '', 'de', { numeric: true }))
}

// ---- Summen und USt ------------------------------------------------------------------------------

export type DraftTotals = {
  // Summe der Positionen bzw. Teilbetrag
  linesCents: number
  deductionsCents: number
  // Rechnungsbetrag (Schlussrechnung nach Abzügen)
  totalCents: number
  // Enthaltene USt je Satz (Kleinunternehmer: keine)
  vatShares: VatShare[]
}

// Schlussrechnung: USt je Satz = USt der Positionen minus die auf den abgezogenen Rechnungen ausgewiesene USt, damit
// der Abzug genau der früher ausgewiesenen Steuer entspricht
function finalVatShares(lines: readonly VatLine[], deductions: readonly { lines: readonly VatLine[] }[]): VatShare[] {
  const byRate = new Map<number, VatShare>()
  const add = (s: VatShare, sign: 1 | -1) => {
    const cur = byRate.get(s.vatBp) ?? { vatBp: s.vatBp, grossCents: 0, vatCents: 0 }
    byRate.set(s.vatBp, { vatBp: s.vatBp, grossCents: cur.grossCents + sign * s.grossCents, vatCents: cur.vatCents + sign * s.vatCents })
  }
  for (const s of vatBreakdown(lines)) add(s, 1)
  for (const d of deductions) for (const s of vatBreakdown(d.lines)) add(s, -1)
  return [...byRate.values()].filter((s) => s.grossCents !== 0 || s.vatCents !== 0).sort((a, b) => a.vatBp - b.vatBp)
}

export function draftTotals(d: {
  kind: InvoiceKind
  lines: readonly VatLine[]
  deductions: readonly { totalCents: number; lines: readonly VatLine[] }[]
  smallBusiness: boolean
}): DraftTotals {
  const linesCents = sumCents(d.lines)
  const deductions = d.kind === 'final' ? d.deductions : []
  const deductionsCents = sumCents(deductions.map((x) => ({ amountCents: x.totalCents })))
  const vatShares = d.smallBusiness ? [] : deductions.length ? finalVatShares(d.lines, deductions) : vatBreakdown(d.lines)
  return { linesCents, deductionsCents, totalCents: linesCents - deductionsCents, vatShares }
}

// ---- Zahlungsregeln -----------------------------------------------------------------------------

// Ohne Baustein: ohne Anzahlung, fällig 0 Tage nach Rechnungsdatum (sofort)
export const DEFAULT_DRAFT_PAYMENT: PaymentRules = { depositPercent: null, depositDays: null, dueDays: 0, dueBasis: 'after_invoice' }

export type PaymentSchedule = {
  due: string
  depositCents: number | null
  depositDue: string | null
  remainderCents: number | null
  // Fälligkeit lag vor dem Rechnungsdatum → sofort fällig gesetzt
  dueClamped: boolean
  // „Anzahlung fällig“ lag nach der Fälligkeit des Rests → auf diese gesetzt
  depositClamped: boolean
}

// Fristen aus Regel und Rechnungsdatum. Rückfallregel: keine Frist vor dem Rechnungsdatum; „Anzahlung fällig“ nie nach
// der Fälligkeit des Rests. Anzahlung in Prozent vom Rechnungsbetrag, auf Cent gerundet.
export function paymentSchedule(rules: PaymentRules, totalCents: number, invoiceDate: string, arrival: string): PaymentSchedule {
  let due = rules.dueBasis === 'after_invoice' ? addDays(invoiceDate, rules.dueDays) : addDays(arrival, -rules.dueDays)
  const dueClamped = due < invoiceDate
  if (dueClamped) due = invoiceDate
  if (rules.depositPercent === null || rules.depositDays === null) {
    return { due, depositCents: null, depositDue: null, remainderCents: null, dueClamped, depositClamped: false }
  }
  const depositCents = Math.round((totalCents * rules.depositPercent) / 100)
  let depositDue = addDays(invoiceDate, rules.depositDays)
  const depositClamped = depositDue > due
  if (depositClamped) depositDue = due
  return { due, depositCents, depositDue, remainderCents: totalCents - depositCents, dueClamped, depositClamped }
}

// ---- Empfänger, Gastnamen, Platzhalter ----------------------------------------------------------

export type DraftRecipient = {
  name: string
  line1: string
  line2: string
  postalCode: string
  city: string
  country: string
  vatId: string
}

export const EMPTY_RECIPIENT: DraftRecipient = { name: '', line1: '', line2: '', postalCode: '', city: '', country: '', vatId: '' }

export const guestHasCompany = (g: Pick<DraftGuest, 'companyName'> | null): boolean => Boolean(g?.companyName?.trim())

// Vorbelegung des Empfängers aus dem Hauptgast: Gast → Name mit Titeln und Wohnadresse; Firma → Firmenname,
// Rechnungsanschrift (PROJ-33) und UID
export function recipientFromGuest(g: DraftGuest | null, kind: RecipientKind): DraftRecipient {
  if (!g || g.anonymized) return EMPTY_RECIPIENT
  const s = (v: string | null) => v ?? ''
  if (kind === 'company') {
    return {
      name: s(g.companyName),
      line1: s(g.companyAddressLine1),
      line2: s(g.companyAddressLine2),
      postalCode: s(g.companyPostalCode),
      city: s(g.companyCity),
      country: s(g.companyCountry),
      vatId: s(g.companyVatId),
    }
  }
  return {
    name: guestTitledName(g),
    line1: s(g.street),
    line2: '',
    postalCode: s(g.postalCode),
    city: s(g.city),
    country: s(g.addressCountry),
    vatId: '',
  }
}

export const defaultRecipientKind = (g: DraftGuest | null): RecipientKind => (guestHasCompany(g) ? 'company' : 'guest')

// Name des Hauptgasts mit Titeln; anonymisiert „Gelöschter Gast“
export const mainGuestName = (g: DraftGuest | null): string | null => (g ? (g.anonymized ? DELETED_GUEST_TEXT : guestTitledName(g)) : null)

// Block 3: Namen immer aktuell aus der Buchung, Mitreisende in deren Reihenfolge
export function guestNames(mode: GuestNameMode, b: Pick<DraftBooking, 'guest' | 'companions'>): string[] {
  if (mode === 'none') return []
  const main = mainGuestName(b.guest)
  const names = main ? [main] : []
  if (mode === 'all') names.push(...b.companions.map((c) => [c.firstName, c.lastName].filter(Boolean).join(' ')))
  return names
}

// {Anrede}: Firma als Empfänger → „Sehr geehrte Damen und Herren“ oder (gewählt) Anrede des Hauptgasts; Gast als
// Empfänger → Regel aus PROJ-39. Ohne bzw. anonymisierter Hauptgast: allgemeine Anrede.
export function draftSalutation(b: Pick<DraftBooking, 'guest'>, recipientKind: RecipientKind, companySalutation: CompanySalutation): string {
  const g = b.guest
  if (!g || g.anonymized || (recipientKind === 'company' && companySalutation === 'generic')) return GENERIC_SALUTATION
  return salutation(g)
}

export type DraftTextContext = {
  booking: Pick<DraftBooking, 'guest' | 'apartmentLabel' | 'arrival' | 'departure'>
  recipientKind: RecipientKind
  companySalutation: CompanySalutation
  invoiceDate: string
  totalCents: number
  payment: PaymentRules
  // Nummer erst beim Ausstellen (PROJ-41); im Entwurf „Entwurf“
  invoiceNumber?: string
}

// Werte der Platzhalter mit den aktuellen Daten; Fristen nach der Rückfallregel
export function draftPlaceholderValues(c: DraftTextContext): PlaceholderValues {
  const b = c.booking
  const s = paymentSchedule(c.payment, c.totalCents, c.invoiceDate, b.arrival)
  const values: PlaceholderValues = {
    Anrede: draftSalutation(b, c.recipientKind, c.companySalutation),
    Gast: mainGuestName(b.guest) ?? '',
    Wohnung: b.apartmentLabel,
    Anreise: textDate(b.arrival),
    Abreise: textDate(b.departure),
    Nächte: String(nightsBetween(b.arrival, b.departure)),
    Rechnungsnummer: c.invoiceNumber ?? DRAFT_NUMBER_TEXT,
    Rechnungsdatum: textDate(c.invoiceDate),
    Betrag: formatCents(c.totalCents),
    Fälligkeitsdatum: textDate(s.due),
  }
  if (s.depositCents !== null && s.depositDue && s.remainderCents !== null) {
    values.Anzahlung = formatCents(s.depositCents)
    values['Anzahlung fällig'] = textDate(s.depositDue)
    values.Restbetrag = formatCents(s.remainderCents)
  }
  return values
}

// ---- Pflichtangaben ------------------------------------------------------------------------------

// IDs der Formularfelder, zu denen die Liste springt
export const DRAFT_FIELD_IDS = {
  invoiceDate: 'rechnung-datum',
  recipientName: 'rechnung-empfaenger-name',
  recipientLine1: 'rechnung-empfaenger-adresse',
  recipientPostalCode: 'rechnung-empfaenger-plz',
  recipientCity: 'rechnung-empfaenger-ort',
  recipientCountry: 'rechnung-empfaenger-staat',
  recipientVatId: 'rechnung-empfaenger-uid',
  lines: 'rechnung-positionen',
  partial: 'rechnung-teilbetrag',
} as const

export type RequiredCheckKey =
  | 'issuer'
  | 'issuerVatId'
  | 'invoiceDate'
  | 'period'
  | 'lines'
  | 'partial'
  | 'amounts'
  | 'recipient'
  | 'recipientName'
  | 'recipientLine1'
  | 'recipientPostalCode'
  | 'recipientCity'
  | 'recipientCountry'
  | 'recipientVatId'

// field: Formularfeld (Sprung); settings: Fehler liegt in Einstellungen → Stammdaten
export type RequiredCheck = { key: RequiredCheckKey; ok: boolean; field?: string; settings?: boolean }

export type DraftIssuer = {
  name: string
  nameLine2: string | null
  addressLine1: string | null
  addressLine2: string | null
  postalCode: string | null
  city: string | null
  country: string | null
  vatId: string | null
}

// Aussteller, Fußzeile und Kleinunternehmer-Hinweis/-Verlauf für die Vorschau (auch für Mitarbeiter)
export type DraftPreviewData = {
  issuer: DraftIssuer | null
  footer: RichDoc | null
  smallBusinessNote: RichDoc
  vatStatus: VatStatusChange[]
}

const filled = (v: string | null | undefined) => Boolean(v?.trim())

// Pflichtangaben-Prüfung: Fehler verhindern nur das Ausstellen (PROJ-41), nicht das Speichern. Die fehlende
// Rechnungsnummer ist im Entwurf kein Fehler.
export function requiredChecks(d: {
  issuer: DraftIssuer | null
  smallBusiness: boolean
  kind: InvoiceKind
  invoiceDate: string
  booking: Pick<DraftBooking, 'arrival' | 'departure'>
  lineCount: number
  partialCents: number
  totalCents: number
  recipient: DraftRecipient
}): RequiredCheck[] {
  const checks: RequiredCheck[] = []
  const i = d.issuer
  checks.push({ key: 'issuer', ok: Boolean(i && filled(i.name) && filled(i.addressLine1) && filled(i.postalCode) && filled(i.city)), settings: true })
  if (d.totalCents >= SMALL_INVOICE_LIMIT_CENTS && !d.smallBusiness) checks.push({ key: 'issuerVatId', ok: filled(i?.vatId), settings: true })
  checks.push({ key: 'invoiceDate', ok: /^\d{4}-\d{2}-\d{2}$/.test(d.invoiceDate), field: DRAFT_FIELD_IDS.invoiceDate })
  checks.push({ key: 'period', ok: Boolean(d.booking.arrival && d.booking.departure) })
  if (d.kind === 'partial') checks.push({ key: 'partial', ok: d.partialCents > 0, field: DRAFT_FIELD_IDS.partial })
  else checks.push({ key: 'lines', ok: d.lineCount > 0, field: DRAFT_FIELD_IDS.lines })
  checks.push({ key: 'amounts', ok: true })
  if (d.totalCents >= SMALL_INVOICE_LIMIT_CENTS) {
    const r = d.recipient
    const missing: RequiredCheck[] = (
      [
        ['recipientName', r.name],
        ['recipientLine1', r.line1],
        ['recipientPostalCode', r.postalCode],
        ['recipientCity', r.city],
        ['recipientCountry', r.country],
      ] as const
    )
      .filter(([, v]) => !filled(v))
      .map(([key]) => ({ key, ok: false, field: DRAFT_FIELD_IDS[key] }))
    checks.push(...(missing.length ? missing : [{ key: 'recipient' as const, ok: true }]))
  }
  if (d.totalCents >= RECIPIENT_VAT_ID_LIMIT_CENTS) checks.push({ key: 'recipientVatId', ok: filled(d.recipient.vatId), field: DRAFT_FIELD_IDS.recipientVatId })
  return checks
}

// ---- „Buchung geändert“ ---------------------------------------------------------------------------

// Fingerabdruck der preisrelevanten Buchungsdaten (Positionen mit Herkunft, Bezeichnung, Betrag, Satz; Stornostatus).
// Wird beim Speichern am Entwurf abgelegt; weicht er beim Öffnen ab, erscheint „Die Buchung wurde seit dem Entwurf
// geändert“. FNV-1a (32 Bit) über eine feste Schreibweise – kurz und in Browser und Server gleich.
export function bookingFingerprint(b: { cancelled: boolean; lines: readonly DraftLine[] }): string {
  const text = [b.cancelled ? 'storniert' : 'aktiv', ...b.lines.map((l) => [l.source ?? '', l.label, l.amountCents, l.vatBp].join('\u001f'))].join('\u001e')
  let hash = 0x811c9dc5
  for (const ch of new TextEncoder().encode(text)) {
    hash ^= ch
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

// ---- Gespeicherter Entwurf -----------------------------------------------------------------------

export type DraftText = { blockId: string | null; body: RichDoc | null }

export type InvoiceDraft = {
  id: string
  kind: InvoiceKind
  invoiceDate: string
  recipientKind: RecipientKind
  recipient: DraftRecipient
  companySalutation: CompanySalutation
  guestNames: GuestNameMode
  // Art Rechnung/Schlussrechnung: die Positionen; Teilrechnung: die Zeilen je USt-Satz
  lines: DraftLine[]
  partial: { mode: PartialMode; percentBp: number | null; amountCents: number } | null
  // Schlussrechnung: abgezogene Rechnungen (Kennungen); fehlt eine, entfällt der Abzug mit Hinweis
  deductionIds: string[]
  // Eine abgezogene Rechnung wurde seit dem letzten Speichern gelöscht (Hinweis bis zum nächsten Speichern)
  deductionRemoved: boolean
  texts: Record<TextBlockKind, DraftText>
  payment: PaymentRules
  bookingFingerprint: string | null
  totalCents: number
  createdAt: string
  updatedAt: string
}
