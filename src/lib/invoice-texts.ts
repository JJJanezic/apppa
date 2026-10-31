// Rechnungstexte (PROJ-39): Textbausteine der Blöcke 4, 6 und 7, Platzhalter, Zahlungsregeln und feste Texte.
// Gilt im Browser und auf dem Server; die Datenbank prüft dieselben Grenzen und Platzhalter noch einmal.
// Das Ersetzen der Platzhalter (fillPlaceholders) nutzen später auch Entwurf (PROJ-40) und PDF (PROJ-41).

import { addDays } from '@/lib/bookings'
import { formatCents, formatDatePlain } from '@/lib/format'
import { docParagraphs, type RichDoc } from '@/lib/rich-text'

// Block 4 Einleitung, Block 6 Zahlungsmodalitäten, Block 7 Abschlusstext
export const TEXT_BLOCKS = ['intro', 'payment', 'closing'] as const
export type TextBlockKind = (typeof TEXT_BLOCKS)[number]

export const DUE_BASES = ['after_invoice', 'before_arrival'] as const
export type DueBasis = (typeof DUE_BASES)[number]

export const INVOICE_TEXT_LIMITS = {
  blocksPerKind: 20,
  nameMax: 60,
  bodyMax: 2000,
  smallBusinessNoteMax: 500,
  footerMax: 2000,
  depositPercentMin: 1,
  depositPercentMax: 100,
  daysMax: 365,
} as const

export type PaymentRules = {
  // null: ohne Anzahlung
  depositPercent: number | null
  depositDays: number | null
  dueDays: number
  dueBasis: DueBasis
}

export type TextBlock = {
  id: string
  kind: TextBlockKind
  name: string
  body: RichDoc
  isDefault: boolean
  // nur Zahlungsmodalitäten
  payment: PaymentRules | null
  updatedAt: string
}

// Liste eines Blocks: Standard zuerst, dann nach Name
export const sortTextBlocks = <B extends Pick<TextBlock, 'isDefault' | 'name'>>(blocks: readonly B[]): B[] =>
  [...blocks].sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name, 'de', { sensitivity: 'base' }))

// Vergleich der Namen ohne Rücksicht auf Groß-/Kleinschreibung und Rand-Leerzeichen
export const textBlockNameKey = (name: string) => name.trim().toLocaleLowerCase('de')

// ---- Platzhalter ---------------------------------------------------------------------------------

// Reihenfolge = Reihenfolge in „Platzhalter einfügen“. scope: wo der Platzhalter erlaubt ist.
export const PLACEHOLDERS = [
  { name: 'Anrede', scope: 'all' },
  { name: 'Gast', scope: 'all' },
  { name: 'Wohnung', scope: 'all' },
  { name: 'Anreise', scope: 'all' },
  { name: 'Abreise', scope: 'all' },
  { name: 'Nächte', scope: 'all' },
  { name: 'Rechnungsnummer', scope: 'all' },
  { name: 'Rechnungsdatum', scope: 'all' },
  { name: 'Betrag', scope: 'all' },
  { name: 'Fälligkeitsdatum', scope: 'payment' },
  { name: 'Anzahlung', scope: 'deposit' },
  { name: 'Anzahlung fällig', scope: 'deposit' },
  { name: 'Restbetrag', scope: 'deposit' },
] as const
export type PlaceholderName = (typeof PLACEHOLDERS)[number]['name']

// Wo wird geschrieben? Feste Texte (Kleinunternehmer-Hinweis, Fußzeile) kennen keine Platzhalter.
export type PlaceholderContext = { kind: TextBlockKind; deposit: boolean } | 'fixed'

export function allowedPlaceholders(ctx: PlaceholderContext): PlaceholderName[] {
  if (ctx === 'fixed') return []
  return PLACEHOLDERS.filter(
    (p) => p.scope === 'all' || (ctx.kind === 'payment' && (p.scope === 'payment' || (p.scope === 'deposit' && ctx.deposit)))
  ).map((p) => p.name)
}

// Alles in geschweiften Klammern, ohne Zeilenumbruch, bis 40 Zeichen; „{ Wohnung }“ gilt als „{Wohnung}“ nicht
export const PLACEHOLDER_PATTERN = /\{([^{}\n]{1,40})\}/g

export type PlaceholderIssue = { token: string; problem: 'unknown' | 'notHere' | 'depositOnly' }

// Platzhalter, die hier nicht stehen dürfen, in der Reihenfolge des Texts, jeder nur einmal
export function placeholderIssues(text: string, ctx: PlaceholderContext): PlaceholderIssue[] {
  const allowed = new Set<string>(allowedPlaceholders(ctx))
  const issues: PlaceholderIssue[] = []
  for (const m of text.matchAll(PLACEHOLDER_PATTERN)) {
    const token = m[0]
    if (allowed.has(m[1]) || issues.some((i) => i.token === token)) continue
    const known = PLACEHOLDERS.find((p) => p.name === m[1])
    const problem: PlaceholderIssue['problem'] =
      !known || ctx === 'fixed' ? 'unknown' : known.scope === 'deposit' && ctx.kind === 'payment' ? 'depositOnly' : 'notHere'
    issues.push({ token, problem })
  }
  return issues
}

export const docPlaceholderIssues = (doc: RichDoc, ctx: PlaceholderContext): PlaceholderIssue[] => {
  const seen = new Set<string>()
  return docParagraphs(doc)
    .flatMap((p) => placeholderIssues(p, ctx))
    .filter((i) => (seen.has(i.token) ? false : (seen.add(i.token), true)))
}

// ---- Werte und Ersetzen ---------------------------------------------------------------------------

export type SalutationParts = {
  gender: string
  lastName: string
  firstName: string | null
  titlePrefix: string | null
  titleSuffix: string | null
}

// {Anrede}: „Sehr geehrte Frau Dr. Huber“ / „Sehr geehrter Herr Huber“; sonst „Sehr geehrte/r Maria Huber“
export function salutation(g: SalutationParts): string {
  const titled = [g.titlePrefix, g.lastName].filter(Boolean).join(' ')
  if (g.gender === 'female') return `Sehr geehrte Frau ${titled}`
  if (g.gender === 'male') return `Sehr geehrter Herr ${titled}`
  return `Sehr geehrte/r ${[g.titlePrefix, g.firstName, g.lastName].filter(Boolean).join(' ')}`
}

// {Gast}: „Dr. Maria Huber“ (Hauptgast mit Titeln)
export function guestTitledName(g: SalutationParts): string {
  const name = [g.titlePrefix, g.firstName, g.lastName].filter(Boolean).join(' ')
  return g.titleSuffix ? `${name}, ${g.titleSuffix}` : name
}

export type PaymentFigures = {
  depositCents: number | null
  depositDue: string | null
  remainderCents: number | null
  due: string
}

// Anzahlung (Prozent vom Rechnungsbetrag, auf Cent gerundet), Fristen und Rest aus den Zahlungsregeln.
// Tage: „nach Rechnungsdatum“ bzw. „vor Anreise“; Kalendertage „JJJJ-MM-TT“.
export function paymentFigures(rules: PaymentRules, totalCents: number, invoiceDate: string, arrival: string): PaymentFigures {
  const due = rules.dueBasis === 'after_invoice' ? addDays(invoiceDate, rules.dueDays) : addDays(arrival, -rules.dueDays)
  if (rules.depositPercent === null || rules.depositDays === null) return { depositCents: null, depositDue: null, remainderCents: null, due }
  const depositCents = Math.round((totalCents * rules.depositPercent) / 100)
  return { depositCents, depositDue: addDays(invoiceDate, rules.depositDays), remainderCents: totalCents - depositCents, due }
}

export type PlaceholderValues = Partial<Record<PlaceholderName, string>>

// Datum in Rechnungstexten ohne Wochentag (Ausnahme von PROJ-31), Beträge wie überall
export const textDate = (iso: string) => formatDatePlain(iso)

export type InvoiceTextContext = {
  guest: SalutationParts
  apartment: string
  arrival: string
  departure: string
  nights: number
  invoiceNumber: string
  invoiceDate: string
  totalCents: number
  payment: PaymentRules | null
}

export function placeholderValues(c: InvoiceTextContext): PlaceholderValues {
  const values: PlaceholderValues = {
    Anrede: salutation(c.guest),
    Gast: guestTitledName(c.guest),
    Wohnung: c.apartment,
    Anreise: textDate(c.arrival),
    Abreise: textDate(c.departure),
    Nächte: String(c.nights),
    Rechnungsnummer: c.invoiceNumber,
    Rechnungsdatum: textDate(c.invoiceDate),
    Betrag: formatCents(c.totalCents),
  }
  if (c.payment) {
    const f = paymentFigures(c.payment, c.totalCents, c.invoiceDate, c.arrival)
    values['Fälligkeitsdatum'] = textDate(f.due)
    if (f.depositCents !== null && f.depositDue && f.remainderCents !== null) {
      values.Anzahlung = formatCents(f.depositCents)
      values['Anzahlung fällig'] = textDate(f.depositDue)
      values.Restbetrag = formatCents(f.remainderCents)
    }
  }
  return values
}

// Ersetzt bekannte Platzhalter; alles andere bleibt stehen
export const fillPlaceholders = (text: string, values: PlaceholderValues): string =>
  text.replace(PLACEHOLDER_PATTERN, (token, name: string) => values[name as PlaceholderName] ?? token)

// Beispiel-Datensatz der Vorschau (fest, damit sie stabil und prüfbar bleibt)
export const SAMPLE_TEXT_CONTEXT: Omit<InvoiceTextContext, 'invoiceNumber' | 'payment'> = {
  guest: { gender: 'female', lastName: 'Muster', firstName: 'Maria', titlePrefix: 'Mag.', titleSuffix: null },
  apartment: 'Top 1',
  arrival: '2026-10-14',
  departure: '2026-10-17',
  nights: 3,
  invoiceDate: '2026-10-01',
  totalCents: 45000,
}

// Vorbelegung (Spec „Vorbelegung“); die Datenbank legt dieselben Texte je Kunde als eigene Kopie an
export const DEFAULT_SMALL_BUSINESS_NOTE = 'Umsatzsteuerfrei aufgrund der Kleinunternehmerregelung gemäß § 6 Abs. 1 Z 27 UStG'
