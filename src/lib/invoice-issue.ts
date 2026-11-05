// Regeln der Seite „Rechnung ausstellen“ (PROJ-42): Einordnung der Nummer, Vergleich des Datums mit der Nummernfolge und
// die Prüfliste aus Sperren, Häkchen und Hinweisen. Eine Stelle für die Seite und das Ausstellen auf dem Server.

import type { DraftIssuer, DraftLine, DraftRecipient, InvoiceKind, PaymentSchedule, RecipientKind, RequiredCheck } from '@/lib/invoice-drafts'
import { formatInvoiceNumber, nextInvoiceNumber, type NumberingSettings, parseInvoiceNumber } from '@/lib/invoice-numbering'
import { INVOICE_LIMITS, invoiceNumberKey } from '@/lib/invoices'
import type { RichDoc } from '@/lib/rich-text'
import type { VatShare } from '@/lib/vat'

export const ISSUE_MIN_DATE = '1990-01-01'

export const isIssueDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= ISSUE_MIN_DATE

// Unsichtbare Zeichen (etwa aus kopiertem Text): Das PDF zeigt sie nicht, zwei Rechnungen sähen gleich aus. Regel auch in issue_invoice
const HIDDEN_CHARS = /[\u0001-\u001f\u007f-\u009f\u00ad\u061c\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/

export type NumberedInvoice = { number: string; invoiceDate: string }

export type NumberClass =
  | { kind: 'proposal' }
  | { kind: 'gap' }
  // Nummer über dem Vorschlag: next ist die danach vorgeschlagene Nummer
  | { kind: 'above'; next: string }
  | { kind: 'otherFormat' }
  | { kind: 'otherYear'; year: number }
  | { kind: 'taken' }
  | { kind: 'invalid' }

// Einordnung einer eingegebenen Nummer. „Vergeben“ vergleicht wie die Datenbank ohne Groß-/Kleinschreibung und Rand-Leerzeichen.
export function classifyInvoiceNumber(s: NumberingSettings, existing: readonly string[], rawNumber: string, invoiceDate: string): NumberClass {
  const number = rawNumber.trim()
  if (!number || number.length > INVOICE_LIMITS.numberMax || HIDDEN_CHARS.test(number)) return { kind: 'invalid' }
  const key = invoiceNumberKey(number)
  if (existing.some((n) => invoiceNumberKey(n) === key)) return { kind: 'taken' }
  const proposal = nextInvoiceNumber(s, existing, invoiceDate).number
  if (invoiceNumberKey(proposal) === key) return { kind: 'proposal' }
  const parsed = parseInvoiceNumber(s, number)
  if (!parsed) return { kind: 'otherFormat' }
  const year = Number(invoiceDate.slice(0, 4))
  if (parsed.year !== null && parsed.year !== year) return { kind: 'otherYear', year: parsed.year }
  const proposed = parseInvoiceNumber(s, proposal)
  if (proposed && parsed.seq > proposed.seq) return { kind: 'above', next: formatInvoiceNumber(s, year, parsed.seq + 1) }
  return { kind: 'gap' }
}

export type DateConflict = NumberedInvoice & { direction: 'later' | 'earlier' }

// Passt das Datum zur Nummernfolge? Verglichen wird mit dem nächsten Nachbarn desselben Kreises: eine niedrigere Nummer mit
// späterem Datum oder eine höhere mit früherem. Nummern in anderem Format haben keine Nachbarn.
export function dateConflict(s: NumberingSettings, existing: readonly NumberedInvoice[], rawNumber: string, invoiceDate: string): DateConflict | null {
  const own = parseInvoiceNumber(s, rawNumber)
  if (!own) return null
  const yearly = s.withYear && s.yearlyReset
  let below: (NumberedInvoice & { seq: number }) | null = null
  let above: (NumberedInvoice & { seq: number }) | null = null
  for (const invoice of existing) {
    const parsed = parseInvoiceNumber(s, invoice.number)
    if (!parsed || (yearly && parsed.year !== own.year)) continue
    if (parsed.seq < own.seq && invoice.invoiceDate > invoiceDate && (!below || parsed.seq > below.seq)) below = { ...invoice, seq: parsed.seq }
    if (parsed.seq > own.seq && invoice.invoiceDate < invoiceDate && (!above || parsed.seq < above.seq)) above = { ...invoice, seq: parsed.seq }
  }
  if (below) return { number: below.number, invoiceDate: below.invoiceDate, direction: 'later' }
  if (above) return { number: above.number, invoiceDate: above.invoiceDate, direction: 'earlier' }
  return null
}

export type IssueBlock =
  | { key: 'required'; check: RequiredCheck }
  | { key: 'futureDate' }
  | { key: 'numberInvalid' }
  | { key: 'numberTaken'; number: string }
  | { key: 'deductionDraft'; id: string }
  | { key: 'deductionRemoved' }
  | { key: 'bookingCancelled' }
  | { key: 'missingChars'; chars: string }
  | { key: 'issuerOverflow' }
  | { key: 'footerCut' }

// Häkchen: id gilt nur für genau diesen Fall; ändert er sich (andere Nummer), ist das Häkchen wieder leer
export type IssueAck =
  | { id: 'bookingChanged'; key: 'bookingChanged' }
  | { id: 'option'; key: 'option' }
  | { id: 'logo'; key: 'logo' }
  | { id: string; key: 'numberAbove'; next: string }
  | { id: string; key: 'numberOtherFormat' }
  | { id: string; key: 'numberOtherYear'; year: number }

export type IssueNote =
  | { key: 'gap' }
  | { key: 'dateLater'; number: string; date: string }
  | { key: 'dateEarlier'; number: string; date: string }
  | { key: 'footerReduced' }
  | { key: 'overBilled' }
  | { key: 'totalNotPositive' }
  | { key: 'logoBlurry' }
  | { key: 'smallBusinessDiffers' }

export type IssueChecks = {
  // Stand, für den die Liste gilt (die Seite erkennt so eine veraltete Antwort)
  number: string
  invoiceDate: string
  blocks: IssueBlock[]
  acks: IssueAck[]
  notes: IssueNote[]
}

export type IssueChecksInput = {
  number: string
  invoiceDate: string
  today: string
  numbering: NumberingSettings
  existing: readonly NumberedInvoice[]
  required: readonly RequiredCheck[]
  bookingChanged: boolean
  bookingCancelled: boolean
  bookingIsOption: boolean
  smallBusiness: boolean
  deductions: readonly { id: string; origin: string; number: string | null; smallBusiness?: boolean }[]
  missingDeductions: number
  // Verrechnet ohne diese Rechnung, Rechnungsbetrag, Gesamtpreis der Buchung
  billedCents: number
  totalCents: number
  billableCents: number
  pdf: { missingChars: readonly string[]; issuerOverflow: boolean; footerCut: boolean; footerReduced: boolean; logoFailed: boolean; logoBlurry: boolean }
}

export function issueChecks(p: IssueChecksInput): IssueChecks {
  const number = p.number.trim()
  const blocks: IssueBlock[] = p.required.filter((c) => !c.ok).map((check) => ({ key: 'required', check }))
  const acks: IssueAck[] = []
  const notes: IssueNote[] = []

  if (p.invoiceDate > p.today) blocks.push({ key: 'futureDate' })

  const numbers = p.existing.map((e) => e.number)
  const cls = classifyInvoiceNumber(p.numbering, numbers, number, p.invoiceDate)
  if (cls.kind === 'invalid') blocks.push({ key: 'numberInvalid' })
  if (cls.kind === 'taken') blocks.push({ key: 'numberTaken', number })
  if (cls.kind === 'gap') notes.push({ key: 'gap' })
  if (cls.kind === 'above') acks.push({ id: `number:${number}`, key: 'numberAbove', next: cls.next })
  if (cls.kind === 'otherFormat') acks.push({ id: `number:${number}`, key: 'numberOtherFormat' })
  if (cls.kind === 'otherYear') acks.push({ id: `number:${number}`, key: 'numberOtherYear', year: cls.year })

  if (cls.kind !== 'invalid' && cls.kind !== 'taken') {
    const conflict = dateConflict(p.numbering, p.existing, number, p.invoiceDate)
    if (conflict) notes.push({ key: conflict.direction === 'later' ? 'dateLater' : 'dateEarlier', number: conflict.number, date: conflict.invoiceDate })
  }

  for (const d of p.deductions) if (d.origin === 'draft') blocks.push({ key: 'deductionDraft', id: d.id })
  if (p.missingDeductions > 0) blocks.push({ key: 'deductionRemoved' })
  if (p.deductions.some((d) => d.origin !== 'draft' && d.smallBusiness !== undefined && d.smallBusiness !== p.smallBusiness)) notes.push({ key: 'smallBusinessDiffers' })

  // Eine inzwischen stornierte Buchung sperrt, bis der Entwurf gespeichert ist; dann stimmt der Fingerabdruck wieder
  if (p.bookingChanged && p.bookingCancelled) blocks.push({ key: 'bookingCancelled' })
  else if (p.bookingChanged) acks.push({ id: 'bookingChanged', key: 'bookingChanged' })
  if (p.bookingIsOption) acks.push({ id: 'option', key: 'option' })

  if (p.pdf.missingChars.length) blocks.push({ key: 'missingChars', chars: p.pdf.missingChars.join(' ') })
  if (p.pdf.issuerOverflow) blocks.push({ key: 'issuerOverflow' })
  if (p.pdf.footerCut) blocks.push({ key: 'footerCut' })
  else if (p.pdf.footerReduced) notes.push({ key: 'footerReduced' })
  if (p.pdf.logoFailed) acks.push({ id: 'logo', key: 'logo' })
  if (p.pdf.logoBlurry) notes.push({ key: 'logoBlurry' })

  if (p.totalCents <= 0) notes.push({ key: 'totalNotPositive' })
  if (p.billedCents + p.totalCents > p.billableCents) notes.push({ key: 'overBilled' })

  return { number, invoiceDate: p.invoiceDate, blocks, acks, notes }
}

// Darf mit diesen gesetzten Häkchen ausgestellt werden?
export const issueAllowed = (c: IssueChecks, acknowledged: ReadonlySet<string> | readonly string[]) => {
  const set = acknowledged instanceof Set ? acknowledged : new Set(acknowledged as readonly string[])
  return c.blocks.length === 0 && c.acks.every((a) => set.has(a.id))
}

// Festgeschriebene Fassung (PROJ-42): alles, was auf der Rechnung steht, als Kopie. Texte mit ersetzten Platzhaltern.
export type IssuedSnapshot = {
  kind: InvoiceKind
  issuer: DraftIssuer | null
  recipient: DraftRecipient
  recipientKind: RecipientKind
  period: { apartmentLabel: string; arrival: string; departure: string }
  guestNames: string[]
  partialLabel: string | null
  lines: DraftLine[]
  deductions: { number: string | null; origin: string; invoiceDate: string; totalCents: number; vatShares: VatShare[] }[]
  totals: { linesCents: number; totalCents: number; vatShares: VatShare[] }
  smallBusiness: boolean
  schedule: PaymentSchedule
  texts: { intro: RichDoc | null; smallBusinessNote: RichDoc | null; payment: RichDoc | null; closing: RichDoc | null; footer: RichDoc | null }
}

// Frist für die Löschsperre beim Kunden: 7 Jahre ab dem Ende des Kalenderjahres des Rechnungsdatums. Liefert das früheste
// Rechnungsdatum, das heute noch aufbewahrt werden muss.
export const retentionCutoff = (today: string) => `${Number(today.slice(0, 4)) - 7}-01-01`
