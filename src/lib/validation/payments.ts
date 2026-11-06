import { z } from 'zod'

import { isIsoDate, parseAmountCents, todayIso } from '@/lib/bookings'
import { PAYMENT_LIMITS as L, RECEIPT_UPLOADING } from '@/lib/payments'

// Prüfregeln für Zahlungen und Rückzahlungen (PROJ-45). Browser und Server-Aktion nutzen dasselbe Schema; die Datenbank
// prüft beim Speichern zusätzlich (zahlbar, Plattform-Buchung, Zahlungsart aktiv). Meldungen aus „payments.validation“.

type T = (key: string) => string

const isId = (v: string) => /^[0-9a-f-]{36}$/i.test(v)

const cents = (v: string) => parseAmountCents(v)
const validCents = (v: string) => {
  const c = cents(v)
  return c === null || (!Number.isNaN(c) && c <= L.amountMaxCents)
}

// Provision und Zahlungsgebühr: leer = 0, sonst ≥ 0
const optionalAmount = (t: T) =>
  z
    .string()
    .refine((v) => !/^\s*[-−]/.test(v), t('notNegative'))
    .refine(validCents, t('amountInvalid'))
    .transform((v) => cents(v) ?? 0)

export const paymentSchema = (t: T, { today = todayIso() }: { today?: string } = {}) =>
  z.object({
    invoiceId: z.string().refine(isId, t('invoiceRequired')),
    paidOn: z
      .string()
      .refine((v) => v !== '', t('dateRequired'))
      .refine((v) => v === '' || isIsoDate(v), t('dateInvalid'))
      .refine((v) => !isIsoDate(v) || v <= today, t('dateInFuture')),
    amount: z
      .string()
      .refine((v) => cents(v) !== null, t('amountRequired'))
      .refine(validCents, t('amountInvalid'))
      .refine((v) => {
        const c = cents(v)
        return c === null || Number.isNaN(c) || c > 0
      }, t('amountPositive'))
      .transform((v) => cents(v) ?? 0),
    commission: optionalAmount(t),
    fee: optionalAmount(t),
    methodId: z.string().refine(isId, t('methodRequired')),
    note: z
      .string()
      .trim()
      .max(L.noteMax, t('noteTooLong'))
      .transform((v) => v || null),
    receiptPath: z
      .string()
      .refine((v) => v !== RECEIPT_UPLOADING, t('receiptUploading'))
      .transform((v) => v || null),
  })

export type PaymentInput = z.input<ReturnType<typeof paymentSchema>>
export type PaymentValues = z.output<ReturnType<typeof paymentSchema>>

export const paymentMethodNameSchema = (t: T) => z.string().trim().min(1, t('nameRequired')).max(L.methodNameMax, t('nameTooLong'))

// „Bereits bezahlt“ beim Nacherfassen (PROJ-37-Formular): Datum, Zahlungsart, bei Plattform-Buchung Provision und Gebühr
export const alreadyPaidSchema = (t: T, { today = todayIso() }: { today?: string } = {}) =>
  z.object({
    paidOn: z
      .string()
      .refine((v) => v !== '', t('dateRequired'))
      .refine((v) => v === '' || isIsoDate(v), t('dateInvalid'))
      .refine((v) => !isIsoDate(v) || v <= today, t('dateInFuture')),
    methodId: z.string().refine(isId, t('methodRequired')),
    commission: optionalAmount(t),
    fee: optionalAmount(t),
  })

export type AlreadyPaidInput = z.input<ReturnType<typeof alreadyPaidSchema>>
export type AlreadyPaidValues = z.output<ReturnType<typeof alreadyPaidSchema>>
