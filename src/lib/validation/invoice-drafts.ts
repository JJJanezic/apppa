import { z } from 'zod'

import { isIsoDate, parseAmountCents } from '@/lib/bookings'
import {
  amountFromPercent,
  COMPANY_SALUTATIONS,
  DRAFT_LIMITS as D,
  type DraftLine,
  type DraftText,
  GUEST_NAME_MODES,
  INVOICE_KINDS,
  isLineSource,
  PARTIAL_MODES,
  RECIPIENT_KINDS,
} from '@/lib/invoice-drafts'
import { DUE_BASES, docPlaceholderIssues, INVOICE_TEXT_LIMITS as TL, type PaymentRules, type PlaceholderContext, type TextBlockKind } from '@/lib/invoice-texts'
import { INVOICE_LIMITS as L } from '@/lib/invoices'
import { docLength, isDocEmpty, isRichDoc, type RichDoc } from '@/lib/rich-text'
import { parseVatRate, VAT_DEFAULTS } from '@/lib/vat'

// Prüfregeln des Rechnungsentwurfs (PROJ-40). Browser und Server-Aktion nutzen dasselbe Schema; die Datenbank prüft
// Positionen, Teilbetrag, Zahlungsregeln, Texte und Abzüge noch einmal. Meldungen über `t` aus messages/de.json
// („invoiceDrafts.validation“). Pflichtangaben sind keine Prüfregel: Speichern mit Lücken ist erlaubt.

type T = (key: string, values?: Record<string, string | number>) => string

const isId = (v: string) => /^[0-9a-f-]{36}$/i.test(v)

// Ganze Zahl („3“) bzw. Prozent mit bis zu 2 Nachkommastellen („12,5“); sonst NaN (wie PROJ-39)
const parseWhole = (v: string) => (/^\d{1,9}$/.test(v.trim()) ? Number(v.trim()) : Number.NaN)
const parsePercent = (v: string) => (/^\d{1,3}([.,]\d{1,2})?$/.test(v.trim()) ? Number(v.trim().replace(',', '.')) : Number.NaN)

// Prozent der Teilrechnung in Hundertstel („20“ → 2000, „12,5“ → 1250); leer → null, ungültig → NaN
export function parsePartialPercent(v: string): number | null {
  if (!v.trim()) return null
  const p = parsePercent(v)
  return Number.isNaN(p) ? Number.NaN : Math.round(p * 100)
}

const lineSchema = z.object({
  selected: z.boolean(),
  // Herkunft in der Buchung („nights“, „cancellation_fee“, „charge:<Kennung>“) oder leer (eigene Position)
  source: z.string(),
  label: z.string(),
  amount: z.string(),
  vat: z.string(),
})

const textSchema = z.object({
  blockId: z.string(),
  body: z.custom<RichDoc>((v) => isRichDoc(v)),
})

export const draftSchema = (t: T, { partialBaseCents = 0 }: { partialBaseCents?: number } = {}) =>
  z
    .object({
      kind: z.enum(INVOICE_KINDS),
      recipientKind: z.enum(RECIPIENT_KINDS),
      companySalutation: z.enum(COMPANY_SALUTATIONS),
      recipientName: z.string().trim().max(D.recipientNameMax, t('tooLong')),
      recipientLine1: z.string().trim().max(D.recipientLineMax, t('tooLong')),
      recipientLine2: z.string().trim().max(D.recipientLineMax, t('tooLong')),
      recipientPostalCode: z.string().trim().max(D.postalCodeMax, t('tooLong')),
      recipientCity: z.string().trim().max(D.cityMax, t('tooLong')),
      recipientCountry: z.string().trim().max(2),
      recipientVatId: z.string().trim().max(D.vatIdMax, t('tooLong')),
      invoiceDate: z
        .string()
        .refine((v) => v !== '', t('dateRequired'))
        .refine((v) => v === '' || isIsoDate(v), t('dateInvalid')),
      guestNames: z.enum(GUEST_NAME_MODES),
      lines: z.array(lineSchema).max(L.linesMax, t('linesTooMany')),
      partialMode: z.enum(PARTIAL_MODES),
      partialPercent: z.string(),
      partialAmount: z.string(),
      deductionIds: z.array(z.string().refine(isId)),
      intro: textSchema,
      payment: textSchema,
      closing: textSchema,
      deposit: z.boolean(),
      depositPercent: z.string(),
      depositDays: z.string(),
      dueDays: z.string(),
      dueBasis: z.enum(DUE_BASES),
    })
    .superRefine((v, ctx) => {
      const add = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message })

      // Positionen (Art Rechnung und Schlussrechnung): nur angewählte werden geprüft und gespeichert
      if (v.kind !== 'partial') {
        if (v.lines.filter((l) => l.selected).length > L.linesMax) add(['lines'], t('linesTooMany'))
        v.lines.forEach((l, i) => {
          if (!l.selected) return
          if (l.source && !isLineSource(l.source)) add(['lines', i, 'label'], t('lineInvalid'))
          const label = l.label.trim()
          if (!label) add(['lines', i, 'label'], t('lineLabelRequired'))
          else if (label.length > L.lineLabelMax) add(['lines', i, 'label'], t('tooLong'))
          const cents = parseAmountCents(l.amount, { negative: true })
          if (cents === null) add(['lines', i, 'amount'], t('amountRequired'))
          else if (Number.isNaN(cents) || Math.abs(cents) > L.amountMaxCents) add(['lines', i, 'amount'], t('amountInvalid'))
          const vat = parseVatRate(l.vat)
          if (vat === null) add(['lines', i, 'vat'], t('vatRequired'))
          else if (Number.isNaN(vat)) add(['lines', i, 'vat'], t('vatInvalid'))
        })
      }

      // Teilbetrag größer als 0 (Prozent oder Betrag)
      if (v.kind === 'partial') {
        if (v.partialMode === 'percent') {
          const bp = parsePartialPercent(v.partialPercent)
          if (bp === null || bp === 0) add(['partialPercent'], t('partialRequired'))
          else if (Number.isNaN(bp) || bp < D.partialPercentBpMin || bp > D.partialPercentBpMax) add(['partialPercent'], t('partialPercentInvalid'))
          else if (amountFromPercent(bp, partialBaseCents) <= 0) add(['partialPercent'], t('partialRequired'))
        } else {
          const cents = parseAmountCents(v.partialAmount)
          if (cents === null || cents === 0) add(['partialAmount'], t('partialRequired'))
          else if (Number.isNaN(cents) || cents > L.amountMaxCents) add(['partialAmount'], t('amountInvalid'))
        }
      }

      // Zahlungsregeln dieser Rechnung (Grenzen wie PROJ-39)
      const days = (field: 'depositDays' | 'dueDays') => {
        const raw = v[field].trim()
        if (!raw) return add([field], t('daysRequired'))
        const n = parseWhole(raw)
        if (!(n >= 0 && n <= TL.daysMax)) add([field], t('daysRange', { max: TL.daysMax }))
      }
      days('dueDays')
      if (v.deposit) {
        const raw = v.depositPercent.trim()
        const p = parsePercent(raw)
        if (!raw) add(['depositPercent'], t('percentRequired'))
        else if (!(p >= TL.depositPercentMin && p <= TL.depositPercentMax)) {
          add(['depositPercent'], t('percentRange', { min: TL.depositPercentMin, max: TL.depositPercentMax }))
        }
        days('depositDays')
      }

      // Texte: Länge und Platzhalter je Block; unbekannte bzw. hier unzulässige Platzhalter verhindern das Speichern
      for (const kind of ['intro', 'payment', 'closing'] as const) {
        const body = v[kind].body
        if (isDocEmpty(body)) continue
        const length = docLength(body)
        if (length > TL.bodyMax) {
          add([kind, 'body'], t('textTooLong', { max: TL.bodyMax.toLocaleString('de-DE'), length: length.toLocaleString('de-DE') }))
          continue
        }
        const pctx: PlaceholderContext = { kind, deposit: kind === 'payment' && v.deposit }
        const issues = docPlaceholderIssues(body, pctx)
        if (issues.length) add([kind, 'body'], issues.map((i) => t(`placeholder.${i.problem}`, { token: i.token })).join(' '))
      }
    })
    .transform((v) => {
      const lines: DraftLine[] =
        v.kind === 'partial'
          ? []
          : v.lines
              .filter((l) => l.selected)
              .map((l) => ({
                source: l.source && isLineSource(l.source) ? l.source : null,
                label: l.label.trim(),
                amountCents: parseAmountCents(l.amount, { negative: true }) ?? 0,
                vatBp: parseVatRate(l.vat) ?? VAT_DEFAULTS.charge,
              }))
      const percentBp = v.partialMode === 'percent' ? parsePartialPercent(v.partialPercent) : null
      const partial =
        v.kind === 'partial'
          ? {
              mode: v.partialMode,
              percentBp,
              amountCents: v.partialMode === 'percent' ? amountFromPercent(percentBp ?? 0, partialBaseCents) : (parseAmountCents(v.partialAmount) ?? 0),
            }
          : null
      const text = (kind: TextBlockKind): DraftText => ({
        blockId: v[kind].blockId && isId(v[kind].blockId) ? v[kind].blockId : null,
        body: isDocEmpty(v[kind].body) ? null : v[kind].body,
      })
      // „Anzahlung: nein“ verwirft Prozent und Frist (wie PROJ-39)
      const payment: PaymentRules = {
        depositPercent: v.deposit ? parsePercent(v.depositPercent) : null,
        depositDays: v.deposit ? parseWhole(v.depositDays) : null,
        dueDays: parseWhole(v.dueDays),
        dueBasis: v.dueBasis,
      }
      return {
        kind: v.kind,
        recipientKind: v.recipientKind,
        companySalutation: v.companySalutation,
        recipient: {
          name: v.recipientName,
          line1: v.recipientLine1,
          line2: v.recipientLine2,
          postalCode: v.recipientPostalCode,
          city: v.recipientCity,
          country: v.recipientCountry.toUpperCase(),
          vatId: v.recipientVatId.replace(/\s+/g, '').toUpperCase(),
        },
        invoiceDate: v.invoiceDate,
        guestNames: v.guestNames,
        lines,
        partial,
        deductionIds: v.kind === 'final' ? [...new Set(v.deductionIds)] : [],
        texts: { intro: text('intro'), payment: text('payment'), closing: text('closing') },
        payment,
      }
    })

export type DraftInput = z.input<ReturnType<typeof draftSchema>>
export type DraftValues = z.output<ReturnType<typeof draftSchema>>
export type DraftLineInput = DraftInput['lines'][number]

// Eingabe → Zahlungsregeln, solange das Formular offen ist (Fristen, Vorschau); unvollständige Werte → Voreinstellung
export function liveDraftPayment(v: Pick<DraftInput, 'deposit' | 'depositPercent' | 'depositDays' | 'dueDays' | 'dueBasis'>): PaymentRules {
  const dueDays = parseWhole(v.dueDays)
  const depositPercent = parsePercent(v.depositPercent)
  const depositDays = parseWhole(v.depositDays)
  const deposit = v.deposit && depositPercent >= TL.depositPercentMin && depositPercent <= TL.depositPercentMax && depositDays >= 0 && depositDays <= TL.daysMax
  return {
    dueDays: dueDays >= 0 && dueDays <= TL.daysMax ? dueDays : 0,
    dueBasis: v.dueBasis,
    depositPercent: deposit ? depositPercent : null,
    depositDays: deposit ? depositDays : null,
  }
}
