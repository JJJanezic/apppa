import { z } from 'zod'

import { type Company, COMPANY_LIMITS, websiteHref } from '@/lib/companies'
import { isCountry } from '@/lib/guests'

// Prüfregeln für Firmen (PROJ-50). Firmen-Panel und Bereich „Neue Firma“ im Gastformular nutzen dieselben Felder;
// die Namen tragen das Präfix „company“, damit sie im Gastformular neben den Gastfeldern stehen können.
// Meldungen kommen über `t` aus messages/de.json („guests.validation“).

type T = (key: string) => string

const optional = (t: T, max: number) =>
  z
    .string()
    .trim()
    .max(max, t('tooLong'))
    .transform((v) => v || null)

export const companySchema = (t: T) =>
  z
    .object({
      companyName: z.string().trim().min(1, t('companyNameRequired')).max(COMPANY_LIMITS.nameMax, t('tooLong')),
      companyVatId: optional(t, COMPANY_LIMITS.vatIdMax),
      companyAddressLine1: optional(t, COMPANY_LIMITS.addressLineMax),
      companyAddressLine2: optional(t, COMPANY_LIMITS.addressLineMax),
      companyPostalCode: optional(t, COMPANY_LIMITS.postalCodeMax),
      companyCity: optional(t, COMPANY_LIMITS.cityMax),
      companyCountry: z
        .string()
        .refine((v) => v === '' || isCountry(v), t('unknown'))
        .transform((v) => v || null),
      companyEmail: z
        .string()
        .trim()
        .max(COMPANY_LIMITS.emailMax, t('tooLong'))
        .refine((v) => v === '' || z.email().safeParse(v).success, t('emailInvalid'))
        .transform((v) => v.toLowerCase() || null),
      // „www.firma.at“ oder „https://firma.at“: ohne Leerzeichen, mit Punkt, nur http(s)
      companyWebsite: z
        .string()
        .trim()
        .max(COMPANY_LIMITS.websiteMax, t('tooLong'))
        .refine((v) => v === '' || (!/\s/.test(v) && v.includes('.') && websiteHref(v) !== null), t('websiteInvalid'))
        .transform((v) => v || null),
      companyContact: optional(t, COMPANY_LIMITS.contactMax),
    })
    .transform((v) => ({
      name: v.companyName,
      vatId: v.companyVatId,
      addressLine1: v.companyAddressLine1,
      addressLine2: v.companyAddressLine2,
      postalCode: v.companyPostalCode,
      city: v.companyCity,
      country: v.companyCountry,
      email: v.companyEmail,
      website: v.companyWebsite,
      contact: v.companyContact,
    }))

export type CompanyInput = z.input<ReturnType<typeof companySchema>>
export type CompanyValues = z.infer<ReturnType<typeof companySchema>>
export const COMPANY_INPUT_KEYS = [
  'companyName',
  'companyVatId',
  'companyAddressLine1',
  'companyAddressLine2',
  'companyPostalCode',
  'companyCity',
  'companyCountry',
  'companyEmail',
  'companyWebsite',
  'companyContact',
] as const satisfies readonly (keyof CompanyInput)[]

export const EMPTY_COMPANY_INPUT: CompanyInput = {
  companyName: '',
  companyVatId: '',
  companyAddressLine1: '',
  companyAddressLine2: '',
  companyPostalCode: '',
  companyCity: '',
  companyCountry: '',
  companyEmail: '',
  companyWebsite: '',
  companyContact: '',
}

// Formularwerte einer bestehenden Firma (Bearbeiten im Reiter „Firmen“)
export function companyInput(c: Company): CompanyInput {
  return {
    companyName: c.name,
    companyVatId: c.vatId ?? '',
    companyAddressLine1: c.addressLine1 ?? '',
    companyAddressLine2: c.addressLine2 ?? '',
    companyPostalCode: c.postalCode ?? '',
    companyCity: c.city ?? '',
    companyCountry: c.country ?? '',
    companyEmail: c.email ?? '',
    companyWebsite: c.website ?? '',
    companyContact: c.contact ?? '',
  }
}

// Spalten einer Firma aus geprüften Werten (Firmen-Panel, neue Firma beim Gast oder in der Buchung)
export const companyDbColumns = (v: CompanyValues) => ({
  name: v.name,
  vat_id: v.vatId,
  address_line1: v.addressLine1,
  address_line2: v.addressLine2,
  postal_code: v.postalCode,
  city: v.city,
  country: v.country,
  email: v.email,
  website: v.website,
  contact: v.contact,
})
