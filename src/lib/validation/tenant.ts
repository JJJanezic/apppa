import { z } from 'zod'

import { isIsoDate } from '@/lib/bookings'
import { isCountry } from '@/lib/guests'
import { isVatId, MASTER_DATA_LIMITS as L, normalizeVatId } from '@/lib/tenant-master-data'

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
  })

export type TenantMasterDataInput = z.input<ReturnType<typeof tenantMasterDataSchema>>
export type TenantMasterDataValues = z.output<ReturnType<typeof tenantMasterDataSchema>>
