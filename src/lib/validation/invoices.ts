import { z } from 'zod'

import { isIsoDate, parseAmountCents, todayIso } from '@/lib/bookings'
import { INVOICE_LIMITS as L, type InvoiceLine, PDF_UPLOADING } from '@/lib/invoices'
import { parseVatRate, VAT_DEFAULTS } from '@/lib/vat'

// Prüfregeln für nacherfasste Rechnungen (PROJ-37). Browser und Server-Aktion nutzen dasselbe Schema.
// Meldungen über `t` aus messages/de.json („invoices.validation“). Ein neuer Gast wird zusätzlich mit dem
// Gast-Schema aus PROJ-7 geprüft.

type T = (key: string) => string

const isId = (v: string) => /^[0-9a-f-]{36}$/i.test(v)
const optionalId = z
  .string()
  .refine((v) => v === '' || isId(v))
  .transform((v) => v || null)

export const invoiceLineSchema = (t: T) =>
  z.object({
    label: z.string().trim().min(1, t('lineLabelRequired')).max(L.lineLabelMax, t('tooLong')),
    amount: z
      .string()
      .refine((v) => parseAmountCents(v, { negative: true }) !== null, t('amountRequired'))
      .refine((v) => {
        const cents = parseAmountCents(v, { negative: true })
        return cents === null || (!Number.isNaN(cents) && Math.abs(cents) <= L.amountMaxCents)
      }, t('amountInvalid')),
    vat: z
      .string()
      .refine((v) => parseVatRate(v) !== null, t('vatRequired'))
      .refine((v) => parseVatRate(v) === null || !Number.isNaN(parseVatRate(v)), t('vatInvalid')),
  })

export const invoiceSchema = (t: T, { today = todayIso() }: { today?: string } = {}) =>
  z
    .object({
      number: z.string().trim().min(1, t('numberRequired')).max(L.numberMax, t('numberTooLong')),
      invoiceDate: z
        .string()
        .refine((v) => v !== '', t('dateRequired'))
        .refine((v) => v === '' || isIsoDate(v), t('dateInvalid'))
        .refine((v) => !isIsoDate(v) || v <= today, t('dateInFuture')),
      bookingId: optionalId,
      guestMode: z.enum(['existing', 'new']),
      guestId: optionalId,
      recipient: z.string().trim().min(1, t('recipientRequired')).max(L.recipientMax, t('tooLong')),
      lines: z.array(invoiceLineSchema(t)).min(1, t('linesRequired')).max(L.linesMax, t('linesTooMany')),
      pdfPath: z
        .string()
        .refine((v) => v !== PDF_UPLOADING, t('pdfUploading'))
        .transform((v) => v || null),
    })
    .transform((v) => ({
      ...v,
      // Neuer Gast: die Verknüpfung entsteht erst beim Speichern
      guestId: v.guestMode === 'new' ? null : v.guestId,
      lines: v.lines.map(
        (l): InvoiceLine => ({
          label: l.label,
          amountCents: parseAmountCents(l.amount, { negative: true }) ?? 0,
          vatBp: parseVatRate(l.vat) ?? VAT_DEFAULTS.charge,
        })
      ),
    }))

export type InvoiceInput = z.input<ReturnType<typeof invoiceSchema>>
export type InvoiceValues = z.output<ReturnType<typeof invoiceSchema>>
export type InvoiceLineInput = z.input<ReturnType<typeof invoiceLineSchema>>
