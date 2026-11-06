// Gutschrift zu Rechnung (PROJ-44): Spiegelung der festgeschriebenen Rechnung und Prüfliste der Seite „Gutschrift ausstellen“.
// Reine Regel für Seite, Vorschau und Ausstellen auf dem Server.

import type { DraftIssuer, DraftLine } from '@/lib/invoice-drafts'
import {
  addNumberChecks,
  addPdfChecks,
  type CreditRef,
  type IssueAck,
  type IssueBlock,
  type IssueChecks,
  type IssuedSnapshot,
  type IssueNote,
  type NumberedInvoice,
  type PdfIssueMeta,
} from '@/lib/invoice-issue'
import type { NumberingSettings } from '@/lib/invoice-numbering'
import type { InvoicePreviewModel } from '@/lib/invoice-preview'
import type { DocLink } from '@/lib/invoices'
import type { RichDoc } from '@/lib/rich-text'
import type { VatShare } from '@/lib/vat'

export const CREDIT_LIMITS = { reasonMax: 300 } as const

// Grund: eine Zeile, Rand-Leerzeichen und Zeilenumbrüche fallen weg; leer → kein Grund
export const cleanCreditReason = (value: string) => value.replace(/\s+/g, ' ').trim()

// Ohne „-0“: Ein Betrag von 0 bleibt 0
const neg = (cents: number) => (cents === 0 ? 0 : -cents)
const negShare = (s: VatShare): VatShare => ({
  vatBp: s.vatBp,
  grossCents: neg(s.grossCents),
  vatCents: neg(s.vatCents),
})

export type MirroredAmounts = Pick<IssuedSnapshot, 'lines' | 'deductions' | 'totals'>

// Beträge der Rechnung genau umgekehrt, nicht neu berechnet: Rechnung und Gutschrift ergeben zusammen je Satz € 0,00.
// Abzüge der Schlussrechnung werden mitgespiegelt (sie stehen nur in Fassung und PDF der Gutschrift).
export function mirrorAmounts(s: IssuedSnapshot): MirroredAmounts {
  return {
    lines: s.lines.map(
      (l): DraftLine => ({
        label: l.label,
        amountCents: neg(l.amountCents),
        vatBp: l.vatBp,
        source: null,
      }),
    ),
    deductions: s.deductions.map((d) => ({
      ...d,
      totalCents: neg(d.totalCents),
      vatShares: d.vatShares.map(negShare),
    })),
    totals: {
      linesCents: neg(s.totals.linesCents),
      totalCents: neg(s.totals.totalCents),
      vatShares: s.totals.vatShares.map(negShare),
    },
  }
}

export type CreditInput = {
  // Die stornierte Rechnung und ihre festgeschriebene Fassung
  invoice: {
    id: string
    number: string
    invoiceDate: string
    snapshot: IssuedSnapshot
  }
  creditDate: string
  reason: string
  // Aktueller Stand: Aussteller und Fußzeile (Briefpapier kommt getrennt in die PDF-Erzeugung)
  issuer: DraftIssuer | null
  footer: RichDoc | null
}

// Inhalt der Gutschrift im Format der Rechnungsvorschau: Empfänger, Zeitraum, Gastnamen, Positionen und Kleinunternehmer aus
// der Rechnung, Aussteller und Fußzeile aktuell, keine Textbausteine und keine Zahlungsregeln
export function creditPreviewModel(p: CreditInput): InvoicePreviewModel {
  const s = p.invoice.snapshot
  const m = mirrorAmounts(s)
  const reason = cleanCreditReason(p.reason)
  return {
    kind: s.kind,
    invoiceDate: p.creditDate,
    issuer: p.issuer,
    recipient: s.recipient,
    booking: s.period,
    guestNames: s.guestNames,
    partialLabel: s.partialLabel,
    lines: m.lines,
    deductions: m.deductions.map((d, i) => ({
      id: `abzug-${i}`,
      number: d.number,
      origin: d.origin === 'backfilled' ? 'backfilled' : 'issued',
      // In der App abziehbar sind nur Teilrechnungen
      kind: d.origin === 'backfilled' ? null : 'partial',
      invoiceDate: d.invoiceDate,
      totalCents: d.totalCents,
      vatShares: d.vatShares,
    })),
    missingDeductions: 0,
    totals: {
      linesCents: m.totals.linesCents,
      deductionsCents: m.totals.linesCents - m.totals.totalCents,
      totalCents: m.totals.totalCents,
      vatShares: m.totals.vatShares,
    },
    smallBusiness: s.smallBusiness,
    smallBusinessNote: s.texts.smallBusinessNote,
    texts: { intro: null, payment: null, closing: null },
    values: {},
    payment: {
      depositPercent: null,
      depositDays: null,
      dueDays: 0,
      dueBasis: 'after_invoice',
    },
    schedule: s.schedule,
    footer: p.footer,
    credit: {
      invoiceNumber: p.invoice.number,
      invoiceDate: p.invoice.invoiceDate,
      reason: reason || null,
    },
  }
}

// Festgeschriebene Fassung der Gutschrift: gespiegelte Beträge, Verweis und Grund; Texte so, wie sie im PDF stehen
export function creditSnapshot(p: CreditInput, texts: { smallBusinessNote: RichDoc | null; footer: RichDoc | null }): IssuedSnapshot {
  const s = p.invoice.snapshot
  const reason = cleanCreditReason(p.reason)
  const credit: CreditRef = {
    invoiceId: p.invoice.id,
    number: p.invoice.number,
    invoiceDate: p.invoice.invoiceDate,
    reason: reason || null,
  }
  return {
    ...s,
    ...mirrorAmounts(s),
    issuer: p.issuer,
    texts: {
      intro: null,
      smallBusinessNote: texts.smallBusinessNote,
      payment: null,
      closing: null,
      footer: texts.footer,
    },
    credit,
  }
}

export type CreditChecksInput = {
  number: string
  creditDate: string
  today: string
  invoiceDate: string
  reason: string
  numbering: NumberingSettings
  existing: readonly NumberedInvoice[]
  // Rechnung inzwischen storniert bzw. in einer gültigen Schlussrechnung abgezogen
  cancelledBy: DocLink | null
  deductedBy: DocLink | null
  totalCents: number
  pdf: PdfIssueMeta
}

// Prüfliste der Gutschrift: keine Buchungs- und Pflichtangaben-Prüfung, die Gutschrift hängt nur an der Rechnung
export function creditChecks(p: CreditChecksInput): IssueChecks {
  const blocks: IssueBlock[] = []
  const acks: IssueAck[] = []
  const notes: IssueNote[] = []

  if (p.cancelledBy) blocks.push({ key: 'alreadyCredited', ...p.cancelledBy })
  if (p.deductedBy) blocks.push({ key: 'deductedByFinal', ...p.deductedBy })
  if (p.creditDate < p.invoiceDate) blocks.push({ key: 'dateBeforeInvoice', date: p.invoiceDate })
  if (p.creditDate > p.today) blocks.push({ key: 'futureDate' })
  if (cleanCreditReason(p.reason).length > CREDIT_LIMITS.reasonMax) blocks.push({ key: 'reasonTooLong' })
  addNumberChecks(
    { blocks, acks, notes },
    {
      number: p.number,
      invoiceDate: p.creditDate,
      numbering: p.numbering,
      existing: p.existing,
    },
  )
  addPdfChecks({ blocks, acks, notes }, p.pdf)
  if (p.totalCents >= 0) notes.push({ key: 'creditNotNegative' })

  return {
    number: p.number.trim(),
    invoiceDate: p.creditDate,
    blocks,
    acks,
    notes,
  }
}

// Knopf „Gutschrift erstellen“ auf der Detailseite: nur bei in der App ausgestellten Rechnungen, die keine Gutschrift sind und
// noch nicht storniert; gesperrt, solange eine gültige Schlussrechnung sie abzieht
export type CreditEntry = { state: 'none' } | { state: 'available' } | { state: 'deducted'; final: DocLink }

export function creditEntry(i: { origin: string; kind: string | null; cancelledBy: DocLink | null; deductedBy: DocLink | null }): CreditEntry {
  if (i.origin !== 'issued' || i.kind === 'credit_note' || i.cancelledBy) return { state: 'none' }
  if (i.deductedBy) return { state: 'deducted', final: i.deductedBy }
  return { state: 'available' }
}
