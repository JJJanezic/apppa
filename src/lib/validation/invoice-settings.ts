import { z } from 'zod'

import { NUMBER_SEPARATORS, NUMBERING_LIMITS as NL, PREFIX_PATTERN } from '@/lib/invoice-numbering'
import {
  DUE_BASES,
  docPlaceholderIssues,
  INVOICE_TEXT_LIMITS as L,
  type PaymentRules,
  type PlaceholderContext,
  TEXT_BLOCKS,
} from '@/lib/invoice-texts'
import { docLength, isDocEmpty, isRichDoc, type RichDoc } from '@/lib/rich-text'

// Prüfregeln für Einstellungen → Rechnungen (PROJ-39). Browser und Server-Aktionen nutzen dieselben Schemas, die
// Datenbank prüft dieselben Grenzen noch einmal. Meldungen über `t` aus messages/de.json („invoiceSettings.validation“).

type T = (key: string, values?: Record<string, string | number>) => string

// Ganze Zahl in einem Bereich aus der Eingabe („3“); sonst NaN
const parseWhole = (v: string) => (/^\d{1,9}$/.test(v.trim()) ? Number(v.trim()) : Number.NaN)

// Prozent mit bis zu 2 Nachkommastellen, Komma oder Punkt („20“, „12,5“); sonst NaN
const parsePercent = (v: string) => (/^\d{1,3}([.,]\d{1,2})?$/.test(v.trim()) ? Number(v.trim().replace(',', '.')) : Number.NaN)

export const numberingSchema = (t: T) =>
  z
    .object({
      prefix: z
        .string()
        .trim()
        .max(NL.prefixMax, t('prefixTooLong', { max: NL.prefixMax }))
        .refine((v) => PREFIX_PATTERN.test(v), t('prefixInvalid')),
      withYear: z.boolean(),
      separator: z.enum(NUMBER_SEPARATORS),
      digits: z
        .string()
        .transform(parseWhole)
        .refine((v) => v >= NL.digitsMin && v <= NL.digitsMax, t('digitsRange', { min: NL.digitsMin, max: NL.digitsMax })),
      yearlyReset: z.boolean(),
      startNumber: z
        .string()
        .transform(parseWhole)
        .refine((v) => Number.isInteger(v) && v >= 1 && v <= NL.startMax, t('startInvalid')),
    })
    .superRefine((v, ctx) => {
      if (v.yearlyReset && !v.withYear) ctx.addIssue({ code: 'custom', path: ['yearlyReset'], message: t('yearlyNeedsYear') })
    })

export type NumberingInput = z.input<ReturnType<typeof numberingSchema>>
export type NumberingValues = z.output<ReturnType<typeof numberingSchema>>

// Strukturprüfung des formatierten Texts; der Editor liefert immer diese Struktur
const docField = (t: T) => z.custom<RichDoc>((v) => isRichDoc(v), t('textInvalid'))

function placeholderMessages(t: T, doc: RichDoc, ctx: PlaceholderContext): string | null {
  const issues = docPlaceholderIssues(doc, ctx)
  if (!issues.length) return null
  return issues.map((i) => t(`placeholder.${i.problem}`, { token: i.token })).join(' ')
}

function checkDoc(
  t: T,
  doc: RichDoc,
  path: string,
  { max, required, requiredKey, ctx }: { max: number; required: boolean; requiredKey: string; ctx: PlaceholderContext },
  issue: z.RefinementCtx
) {
  const add = (message: string) => issue.addIssue({ code: 'custom', path: [path], message })
  if (isDocEmpty(doc)) {
    if (required) add(t(requiredKey))
    return
  }
  const length = docLength(doc)
  if (length > max) return add(t('textTooLong', { max: max.toLocaleString('de-DE'), length: length.toLocaleString('de-DE') }))
  const placeholders = placeholderMessages(t, doc, ctx)
  if (placeholders) add(placeholders)
}

export const fixedTextsSchema = (t: T) =>
  z
    .object({ smallBusinessNote: docField(t), footer: docField(t) })
    .superRefine((v, ctx) => {
      checkDoc(t, v.smallBusinessNote, 'smallBusinessNote', {
        max: L.smallBusinessNoteMax,
        required: true,
        requiredKey: 'smallBusinessNoteRequired',
        ctx: 'fixed',
      }, ctx)
      checkDoc(t, v.footer, 'footer', { max: L.footerMax, required: false, requiredKey: 'unknown', ctx: 'fixed' }, ctx)
    })
    // Leere Fußzeile wird als „keine Fußzeile“ gespeichert
    .transform((v) => ({ smallBusinessNote: v.smallBusinessNote, footer: isDocEmpty(v.footer) ? null : v.footer }))

export type FixedTextsInput = z.input<ReturnType<typeof fixedTextsSchema>>
export type FixedTextsValues = z.output<ReturnType<typeof fixedTextsSchema>>

export const textBlockSchema = (t: T) =>
  z
    .object({
      kind: z.enum(TEXT_BLOCKS),
      name: z
        .string()
        .trim()
        .min(1, t('nameRequired'))
        .max(L.nameMax, t('nameTooLong', { max: L.nameMax })),
      body: docField(t),
      // nur Zahlungsmodalitäten
      deposit: z.boolean(),
      depositPercent: z.string(),
      depositDays: z.string(),
      dueDays: z.string(),
      dueBasis: z.enum(DUE_BASES),
    })
    .superRefine((v, ctx) => {
      const payment = v.kind === 'payment'
      const deposit = payment && v.deposit
      checkDoc(t, v.body, 'body', { max: L.bodyMax, required: true, requiredKey: 'bodyRequired', ctx: { kind: v.kind, deposit } }, ctx)
      if (!payment) return
      const days = (field: 'depositDays' | 'dueDays') => {
        const raw = v[field].trim()
        if (!raw) return ctx.addIssue({ code: 'custom', path: [field], message: t('daysRequired') })
        const n = parseWhole(raw)
        if (!(n >= 0 && n <= L.daysMax)) ctx.addIssue({ code: 'custom', path: [field], message: t('daysRange', { max: L.daysMax }) })
      }
      days('dueDays')
      if (!deposit) return
      const raw = v.depositPercent.trim()
      if (!raw) ctx.addIssue({ code: 'custom', path: ['depositPercent'], message: t('percentRequired') })
      else {
        const p = parsePercent(raw)
        if (!(p >= L.depositPercentMin && p <= L.depositPercentMax)) {
          ctx.addIssue({
            code: 'custom',
            path: ['depositPercent'],
            message: t('percentRange', { min: L.depositPercentMin, max: L.depositPercentMax }),
          })
        }
      }
      days('depositDays')
    })
    .transform((v) => {
      // „Anzahlung: nein“ verwirft Prozent und Frist (Spec)
      const payment: PaymentRules | null =
        v.kind === 'payment'
          ? {
              depositPercent: v.deposit ? parsePercent(v.depositPercent) : null,
              depositDays: v.deposit ? parseWhole(v.depositDays) : null,
              dueDays: parseWhole(v.dueDays),
              dueBasis: v.dueBasis,
            }
          : null
      return { kind: v.kind, name: v.name, body: v.body, payment }
    })

export type TextBlockInput = z.input<ReturnType<typeof textBlockSchema>>
export type TextBlockValues = z.output<ReturnType<typeof textBlockSchema>>

// Eingabe → Zahlungsregeln, solange das Formular offen ist (Vorschau); unvollständige Werte → null
export function previewPaymentRules(v: Pick<TextBlockInput, 'kind' | 'deposit' | 'depositPercent' | 'depositDays' | 'dueDays' | 'dueBasis'>): PaymentRules | null {
  if (v.kind !== 'payment') return null
  const dueDays = parseWhole(v.dueDays)
  const depositPercent = parsePercent(v.depositPercent)
  const depositDays = parseWhole(v.depositDays)
  const deposit = v.deposit && depositPercent >= 1 && depositPercent <= 100 && depositDays >= 0 && depositDays <= L.daysMax
  return {
    dueDays: dueDays >= 0 && dueDays <= L.daysMax ? dueDays : 0,
    dueBasis: v.dueBasis,
    depositPercent: deposit ? depositPercent : null,
    depositDays: deposit ? depositDays : null,
  }
}
