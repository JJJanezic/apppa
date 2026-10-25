import { z } from 'zod'

import { type Guest, isCountry, LANGUAGES, LIMITS, MARKETING_CUSTOM, MARKETING_NONE, MARKETING_SOURCES } from '@/lib/guests'

// Prüfregeln für Gäste (PROJ-7). Browser und Server-Aktionen nutzen dieselben Schemas.
// Meldungen kommen über `t` aus messages/de.json („guests.validation“).

type T = (key: string) => string

// Leere Eingabe → null; sonst getrimmt und begrenzt
const optional = (t: T, max: number) =>
  z
    .string()
    .trim()
    .max(max, t('tooLong'))
    .transform((v) => v || null)

// Heutiges Datum in Wien (JJJJ-MM-TT), damit ein Geburtsdatum „heute“ nicht wegen der Zeitzone abgelehnt wird
const todayInVienna = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Vienna' })

export const guestSchema = (t: T) =>
  z
    .object({
      lastName: z.string().trim().min(1, t('lastNameRequired')).max(LIMITS.nameMax, t('tooLong')),
      firstName: optional(t, LIMITS.nameMax),
      country: z.string().refine(isCountry, t('countryRequired')),
      email: z
        .string()
        .trim()
        .max(LIMITS.emailMax, t('tooLong'))
        .refine((v) => v === '' || z.email().safeParse(v).success, t('emailInvalid'))
        .transform((v) => v.toLowerCase() || null),
      phone: z
        .string()
        .trim()
        .max(LIMITS.phoneMax, t('tooLong'))
        .refine((v) => v === '' || /^\+?[\d\s()/.-]{4,}$/.test(v), t('phoneInvalid'))
        .transform((v) => v || null),
      language: z
        .string()
        .refine((v) => v === '' || (LANGUAGES as readonly string[]).includes(v), t('unknown'))
        .transform((v) => v || null),
      birthDate: z
        .string()
        .refine((v) => v === '' || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))), t('birthDateInvalid'))
        .refine((v) => v === '' || v <= todayInVienna(), t('birthDateFuture'))
        .refine((v) => v === '' || v >= '1900-01-01', t('birthDateInvalid'))
        .transform((v) => v || null),
      street: optional(t, LIMITS.streetMax),
      postalCode: optional(t, LIMITS.postalCodeMax),
      city: optional(t, LIMITS.cityMax),
      addressCountry: z
        .string()
        .refine((v) => v === '' || isCountry(v), t('unknown'))
        .transform((v) => v || null),
      // Standardwert, „custom“ (mit Freitext) oder „none“
      marketing: z.enum([...MARKETING_SOURCES, MARKETING_CUSTOM, MARKETING_NONE]),
      marketingCustom: optional(t, LIMITS.marketingCustomMax),
      companyName: optional(t, LIMITS.companyNameMax),
      companyVatId: optional(t, LIMITS.vatIdMax),
      companyBillingAddress: optional(t, LIMITS.billingAddressMax),
      note: optional(t, LIMITS.noteMax),
    })
    // Freitext gilt nur bei „Eigene Angabe“; leer = keine Angabe (Spec)
    .transform(({ marketing, marketingCustom, ...rest }) => ({
      ...rest,
      marketingSource: (MARKETING_SOURCES as readonly string[]).includes(marketing) ? (marketing as (typeof MARKETING_SOURCES)[number]) : null,
      marketingCustom: marketing === MARKETING_CUSTOM ? marketingCustom : null,
    }))

export type GuestInput = z.input<ReturnType<typeof guestSchema>>
export type GuestValues = z.infer<ReturnType<typeof guestSchema>>

export const EMPTY_GUEST_INPUT: GuestInput = {
  lastName: '',
  firstName: '',
  country: '',
  email: '',
  phone: '',
  language: '',
  birthDate: '',
  street: '',
  postalCode: '',
  city: '',
  addressCountry: '',
  marketing: MARKETING_NONE,
  marketingCustom: '',
  companyName: '',
  companyVatId: '',
  companyBillingAddress: '',
  note: '',
}

// Formularwerte eines bestehenden Gastes (Bearbeiten)
export function guestInput(g: Guest): GuestInput {
  return {
    lastName: g.lastName,
    firstName: g.firstName ?? '',
    country: g.country,
    email: g.email ?? '',
    phone: g.phone ?? '',
    language: g.language ?? '',
    birthDate: g.birthDate ?? '',
    street: g.street ?? '',
    postalCode: g.postalCode ?? '',
    city: g.city ?? '',
    addressCountry: g.addressCountry ?? '',
    marketing: g.marketingSource ?? (g.marketingCustom ? MARKETING_CUSTOM : MARKETING_NONE),
    marketingCustom: g.marketingCustom ?? '',
    companyName: g.companyName ?? '',
    companyVatId: g.companyVatId ?? '',
    companyBillingAddress: g.companyBillingAddress ?? '',
    note: g.note ?? '',
  }
}
