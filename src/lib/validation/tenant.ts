import { z } from 'zod'

import { isCountry } from '@/lib/guests'
import { isVatId, MASTER_DATA_LIMITS as L, normalizeVatId } from '@/lib/tenant-master-data'

// Prüfregeln für Kundenstammdaten (PROJ-28). Browser und Server-Aktionen nutzen dieselben Schemas.
// Meldungen kommen über `t` aus messages/de.json („tenantData.validation“).

type T = (key: string) => string

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
  })

export type TenantMasterDataInput = z.input<ReturnType<typeof tenantMasterDataSchema>>
export type TenantMasterDataValues = z.output<ReturnType<typeof tenantMasterDataSchema>>
