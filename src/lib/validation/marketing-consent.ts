import { z } from 'zod'

import { isIsoDate, todayIso } from '@/lib/bookings'
import { channelsFor, CONSENT_LIMITS as L, type ConsentKind } from '@/lib/marketing-consent'
import { RECEIPT_UPLOADING } from '@/lib/payments'

// Prüfregeln für Erteilung und Widerruf von Hand (PROJ-19). Browser und Server-Aktion nutzen dasselbe Schema; die Datenbank
// prüft beim Speichern zusätzlich (Rolle, Gast, Stand, Weg). Meldungen aus „guests.consent.validation“.

type T = (key: string) => string

export const consentSchema = (t: T, { kind, today = todayIso(), birthDate = null }: { kind: ConsentKind; today?: string; birthDate?: string | null }) =>
  z.object({
    occurredOn: z
      .string()
      .refine((v) => v !== '', t('dateRequired'))
      .refine((v) => v === '' || isIsoDate(v), t('dateInvalid'))
      .refine((v) => !isIsoDate(v) || v <= today, t('dateInFuture'))
      .refine((v) => !isIsoDate(v) || !birthDate || v >= birthDate, t('dateBeforeBirth')),
    channel: z.string().refine((v) => (channelsFor(kind) as readonly string[]).includes(v), t('channelRequired')),
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

export type ConsentInput = z.input<ReturnType<typeof consentSchema>>
export type ConsentValues = z.output<ReturnType<typeof consentSchema>>

export const voidSchema = (t: T) =>
  z.object({
    reason: z
      .string()
      .trim()
      .min(1, t('reasonRequired'))
      .max(L.voidReasonMax, t('reasonTooLong')),
  })

export type VoidInput = z.input<ReturnType<typeof voidSchema>>
