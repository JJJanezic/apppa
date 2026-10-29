import { z } from 'zod'

import {
  DOCUMENT_TYPES,
  GENDER_DEFAULT,
  GENDERS,
  type Guest,
  isCountry,
  isDocumentPath,
  LANGUAGES,
  LIMITS,
  MARKETING_CUSTOM,
  MARKETING_NONE,
  MARKETING_SOURCES,
} from '@/lib/guests'

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

// Platzhalter im Formular, solange ein Ausweisbild noch umgewandelt bzw. hochgeladen wird (blockiert das Speichern)
export const DOCUMENT_UPLOADING = 'uploading'

// Speicherort eines Ausweisbildes: leer oder <Kunde>/<zufällig>.jpg
const documentPath = (t: T) =>
  z
    .string()
    .refine((v) => v !== DOCUMENT_UPLOADING, t('documentUploading'))
    .refine((v) => v === '' || v === DOCUMENT_UPLOADING || isDocumentPath(v), t('unknown'))
    .transform((v) => v || null)

export const guestSchema = (t: T) =>
  z
    .object({
      lastName: z.string().trim().min(1, t('lastNameRequired')).max(LIMITS.nameMax, t('tooLong')),
      firstName: optional(t, LIMITS.nameMax),
      titlePrefix: optional(t, LIMITS.titleMax),
      titleSuffix: optional(t, LIMITS.titleMax),
      gender: z.enum(GENDERS, t('unknown')),
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
      companyAddressLine1: optional(t, LIMITS.companyAddressLineMax),
      companyAddressLine2: optional(t, LIMITS.companyAddressLineMax),
      companyPostalCode: optional(t, LIMITS.companyPostalCodeMax),
      companyCity: optional(t, LIMITS.companyCityMax),
      companyCountry: z
        .string()
        .refine((v) => v === '' || isCountry(v), t('unknown'))
        .transform((v) => v || null),
      note: optional(t, LIMITS.noteMax),
      // Reisedokument (PROJ-29): höchstens eines je Gast
      documentType: z
        .string()
        .refine((v) => v === '' || (DOCUMENT_TYPES as readonly string[]).includes(v), t('unknown'))
        .transform((v) => (v || null) as (typeof DOCUMENT_TYPES)[number] | null),
      documentNumber: optional(t, LIMITS.documentNumberMax),
      documentIssuedOn: z
        .string()
        .refine((v) => v === '' || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))), t('dateInvalid'))
        .refine((v) => v === '' || v <= todayInVienna(), t('issuedOnFuture'))
        .refine((v) => v === '' || v >= '1900-01-01', t('dateInvalid'))
        .transform((v) => v || null),
      documentAuthority: optional(t, LIMITS.documentAuthorityMax),
      documentCountry: z
        .string()
        .refine((v) => v === '' || isCountry(v), t('unknown'))
        .transform((v) => v || null),
      documentFrontPath: documentPath(t),
      documentBackPath: documentPath(t),
    })
    // Sobald irgendeine Angabe des Dokuments oder ein Bild vorhanden ist, sind Art und Nummer Pflicht (Spec)
    .superRefine((v, ctx) => {
      const started = [
        v.documentType,
        v.documentNumber,
        v.documentIssuedOn,
        v.documentAuthority,
        v.documentCountry,
        v.documentFrontPath,
        v.documentBackPath,
      ].some((x) => x !== null)
      if (!started) return
      if (!v.documentType) ctx.addIssue({ code: 'custom', path: ['documentType'], message: t('documentTypeRequired') })
      if (!v.documentNumber) ctx.addIssue({ code: 'custom', path: ['documentNumber'], message: t('documentNumberRequired') })
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
  titlePrefix: '',
  titleSuffix: '',
  gender: GENDER_DEFAULT,
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
  companyAddressLine1: '',
  companyAddressLine2: '',
  companyPostalCode: '',
  companyCity: '',
  companyCountry: '',
  note: '',
  documentType: '',
  documentNumber: '',
  documentIssuedOn: '',
  documentAuthority: '',
  documentCountry: '',
  documentFrontPath: '',
  documentBackPath: '',
}

// Formularwerte eines bestehenden Gastes (Bearbeiten)
export function guestInput(g: Guest): GuestInput {
  return {
    lastName: g.lastName,
    firstName: g.firstName ?? '',
    titlePrefix: g.titlePrefix ?? '',
    titleSuffix: g.titleSuffix ?? '',
    gender: g.gender,
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
    companyAddressLine1: g.companyAddressLine1 ?? '',
    companyAddressLine2: g.companyAddressLine2 ?? '',
    companyPostalCode: g.companyPostalCode ?? '',
    companyCity: g.companyCity ?? '',
    companyCountry: g.companyCountry ?? '',
    note: g.note ?? '',
    documentType: g.documentType ?? '',
    documentNumber: g.documentNumber ?? '',
    documentIssuedOn: g.documentIssuedOn ?? '',
    documentAuthority: g.documentAuthority ?? '',
    documentCountry: g.documentCountry ?? '',
    documentFrontPath: g.documentFrontPath ?? '',
    documentBackPath: g.documentBackPath ?? '',
  }
}
