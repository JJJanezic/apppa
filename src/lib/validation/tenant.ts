import { z } from 'zod'

import { BANK_ACCOUNT_LIMITS as B, ibanProblem, isBic, normalizeBic, normalizeIban } from '@/lib/bank-accounts'
import { isIsoDate } from '@/lib/bookings'
import { isCountry } from '@/lib/guests'
import { isVatId, MASTER_DATA_LIMITS as L, normalizeVatId } from '@/lib/tenant-master-data'
import { isLogoPath, LOGO_UPLOADING } from '@/lib/tenant-logo'

// Prüfregeln für Kundenstammdaten (PROJ-28). Browser und Server-Aktionen nutzen dieselben Schemas.
// Meldungen kommen über `t` aus messages/de.json („tenantData.validation“).

type T = (key: string) => string

// Obergrenze für den Verlauf; gleicher Wert in der Datenbank-Funktion
export const VAT_STATUS_MAX = 50
const VAT_DATE_MIN = '2000-01-01'
const VAT_DATE_MAX = '2100-12-31'

// Leere Eingabe (auch nur Leerzeichen) → null; sonst getrimmt und begrenzt
const optional = (t: T, max: number) =>
  z
    .string()
    .trim()
    .max(max, t('tooLong'))
    .transform((v) => v || null)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const IBAN_MESSAGES = { country: 'ibanCountry', length: 'ibanLength', checksum: 'ibanChecksum', format: 'ibanInvalid' } as const

// Bankkonten (PROJ-46): Kennung entsteht beim Hinzufügen im Formular. Regeln über alle Konten: höchstens 20,
// jede IBAN nur einmal (auch archivierte), genau ein aktives primäres Konto, sobald es Konten gibt.
const bankAccountsSchema = (t: T) =>
  z
    .array(
      z.object({
        id: z.string().regex(UUID, t('unknown')),
        label: optional(t, B.labelMax),
        accountHolder: z.string().trim().min(1, t('accountHolderRequired')).max(B.holderMax, t('tooLong')),
        iban: z
          .string()
          .transform(normalizeIban)
          .superRefine((v, ctx) => {
            if (v === '') return void ctx.addIssue({ code: 'custom', message: t('ibanRequired') })
            const problem = ibanProblem(v)
            if (problem) ctx.addIssue({ code: 'custom', message: t(IBAN_MESSAGES[problem]) })
          }),
        bic: z
          .string()
          .transform(normalizeBic)
          .refine((v) => v === '' || isBic(v), t('bicInvalid'))
          .transform((v) => v || null),
        bankName: optional(t, B.bankNameMax),
        note: optional(t, B.noteMax),
        primary: z.boolean(),
        archived: z.boolean(),
      })
    )
    .max(B.accountsMax, t('bankAccountsTooMany'))
    .superRefine((accounts, ctx) => {
      const seen = new Set<string>()
      accounts.forEach((a, i) => {
        if (a.iban && seen.has(a.iban)) ctx.addIssue({ code: 'custom', path: [i, 'iban'], message: t('ibanDuplicate') })
        seen.add(a.iban)
        if (a.primary && a.archived) ctx.addIssue({ code: 'custom', path: [i, 'archived'], message: t('primaryArchived') })
      })
      const primaries = accounts.filter((a) => a.primary).length
      if (accounts.length > 0 && primaries !== 1) ctx.addIssue({ code: 'custom', message: t('primaryRequired') })
    })

export const tenantMasterDataSchema = (t: T) =>
  z.object({
    name: z.string().trim().min(1, t('nameRequired')).max(L.nameMax, t('tooLong')),
    nameLine2: optional(t, L.lineMax),
    addressLine1: optional(t, L.lineMax),
    addressLine2: optional(t, L.lineMax),
    postalCode: optional(t, L.postalCodeMax),
    city: optional(t, L.cityMax),
    country: z
      .string()
      .refine((v) => v === '' || isCountry(v), t('unknown'))
      .transform((v) => v || null),
    vatId: z
      .string()
      .transform(normalizeVatId)
      .refine((v) => v === '' || isVatId(v), t('vatIdInvalid'))
      .transform((v) => v || null),
    taxNumber: optional(t, L.numberMax),
    registerNumber: optional(t, L.numberMax),
    // Kontakt für Gäste (PROJ-26); E-Mail in Kleinbuchstaben wie beim Gast
    email: z
      .string()
      .trim()
      .max(L.emailMax, t('tooLong'))
      .refine((v) => v === '' || z.email().safeParse(v).success, t('emailInvalid'))
      .transform((v) => v.toLowerCase() || null),
    phone: z
      .string()
      .trim()
      .max(L.phoneMax, t('tooLong'))
      .refine((v) => v === '' || /^\+?[\d\s()/.-]{4,}$/.test(v), t('phoneInvalid'))
      .transform((v) => v || null),
    // Kleinunternehmer-Status (PROJ-36): je Eintrag Datum und Status Pflicht, jedes Datum nur einmal
    vatStatus: z
      .array(
        z.object({
          validFrom: z
            .string()
            .refine(isIsoDate, t('vatDateRequired'))
            // gleicher Bereich wie in der Datenbank
            .refine((v) => !isIsoDate(v) || (v >= VAT_DATE_MIN && v <= VAT_DATE_MAX), t('vatDateRange')),
          status: z
            .string()
            .refine((v) => v === 'small' || v === 'regular', t('vatStatusRequired'))
            .transform((v) => v === 'small'),
        })
      )
      .max(VAT_STATUS_MAX, t('vatStatusTooMany'))
      .superRefine((rows, ctx) => {
        const seen = new Set<string>()
        rows.forEach((row, i) => {
          if (!isIsoDate(row.validFrom)) return
          if (seen.has(row.validFrom)) ctx.addIssue({ code: 'custom', path: [i, 'validFrom'], message: t('vatDateDuplicate') })
          seen.add(row.validFrom)
        })
      })
      .transform((rows) => rows.map((r) => ({ validFrom: r.validFrom, smallBusiness: r.status }))),
    bankAccounts: bankAccountsSchema(t),
    // Logo (PROJ-38): leer oder <Kunde>/<zufällig>.png; den Ordner des Kunden prüft die Datenbank
    logoPath: z
      .string()
      .refine((v) => v !== LOGO_UPLOADING, t('logoUploading'))
      .refine((v) => v === '' || v === LOGO_UPLOADING || isLogoPath(v), t('unknown'))
      .transform((v) => v || null),
  })

export type TenantMasterDataInput = z.input<ReturnType<typeof tenantMasterDataSchema>>
export type TenantMasterDataValues = z.output<ReturnType<typeof tenantMasterDataSchema>>
