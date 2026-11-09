import { z } from 'zod'

import { isIsoDate } from '@/lib/bookings'
import { GUEST_SHEET_TEXT_MAX, SHEET_NUMBER_MAX } from '@/lib/guest-sheet'
import { DOCUMENT_TYPES, GENDERS, isCountry, isDocumentPath, LIMITS } from '@/lib/guests'
import { checkDoc, docField } from '@/lib/validation/invoice-settings'

// Prüfregeln des Gästeblatts (PROJ-26). Browser und Server-Aktionen nutzen dieselben Schemas; die Datenbank prüft
// Längen, Ländercodes und Daten noch einmal. Meldungen über `t` aus messages/de.json („guestSheets.validation“).
// Die Regeln der Gastfelder entsprechen dem Gastformular (src/lib/validation/guests.ts).

type T = (key: string, values?: Record<string, string | number>) => string

const todayInVienna = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Vienna' })

const optional = (t: T, max: number) =>
  z
    .string()
    .trim()
    .max(max, t('tooLong'))
    .transform((v) => v || null)

const pastDate = (t: T, futureKey: string) =>
  z
    .string()
    .refine((v) => v === '' || (isIsoDate(v) && v >= '1900-01-01'), t('dateInvalid'))
    .refine((v) => v === '' || v <= todayInVienna(), t(futureKey))
    .transform((v) => v || null)

const countryOrEmpty = (t: T) =>
  z
    .string()
    .refine((v) => v === '' || isCountry(v), t('unknown'))
    .transform((v) => v || null)

const imagePath = (t: T) =>
  z
    .string()
    .refine((v) => v === '' || isDocumentPath(v), t('documentUploading'))
    .transform((v) => v || null)

// Felder des Hauptgasts auf Seite 1, einzeln speicherbar. Leere Pflichtfelder sind erlaubt (das Blatt markiert sie);
// nur Nachname und Staatsangehörigkeit darf man nicht leeren, weil der Gast sie immer hat (PROJ-7).
export const sheetGuestSchema = (t: T) =>
  z.object({
    lastName: z.string().trim().min(1, t('lastNameRequired')).max(LIMITS.nameMax, t('tooLong')),
    firstName: optional(t, LIMITS.nameMax),
    gender: z.enum(GENDERS, t('unknown')),
    birthDate: pastDate(t, 'birthDateFuture'),
    country: z.string().refine(isCountry, t('countryRequired')),
    documentType: z
      .string()
      .refine((v) => v === '' || (DOCUMENT_TYPES as readonly string[]).includes(v), t('unknown'))
      .transform((v) => (v || null) as (typeof DOCUMENT_TYPES)[number] | null),
    documentNumber: optional(t, LIMITS.documentNumberMax),
    documentIssuedOn: pastDate(t, 'issuedOnFuture'),
    documentAuthority: optional(t, LIMITS.documentAuthorityMax),
    documentCountry: countryOrEmpty(t),
    street: optional(t, LIMITS.streetMax),
    postalCode: optional(t, LIMITS.postalCodeMax),
    city: optional(t, LIMITS.cityMax),
    addressCountry: countryOrEmpty(t),
    // Ausweisbilder: leer oder <Kunde>/<zufällig>.jpg; während des Hochladens nicht speicherbar
    documentFrontPath: imagePath(t),
    documentBackPath: imagePath(t),
  })

// E-Mail des Gastes auf Seite 2 (nur wenn noch keine hinterlegt ist); Regel wie im Gastformular, Kleinbuchstaben
export const sheetEmailSchema = (t: T) =>
  z
    .string()
    .trim()
    .max(LIMITS.emailMax, t('tooLong'))
    .refine((v) => v === '' || z.email().safeParse(v).success, t('emailInvalid'))
    .transform((v) => v.toLowerCase() || null)

export type SheetGuestInput = z.input<ReturnType<typeof sheetGuestSchema>>
export type SheetGuestValues = z.output<ReturnType<typeof sheetGuestSchema>>

// Mitreisende: wie im Buchungsformular (Nachname und Vorname Pflicht, Geburtsdatum nicht in der Zukunft)
export const sheetCompanionSchema = (t: T) =>
  z.object({
    lastName: z.string().trim().min(1, t('lastNameRequired')).max(LIMITS.nameMax, t('tooLong')),
    firstName: z.string().trim().min(1, t('firstNameRequired')).max(LIMITS.nameMax, t('tooLong')),
    birthDate: pastDate(t, 'birthDateFuture'),
  })

export type SheetCompanionInput = z.input<ReturnType<typeof sheetCompanionSchema>>

// Lfd.-Nr. wie die Gästeblattnummer der Buchung (PROJ-30)
export const sheetNumberSchema = (t: T) => optional(t, SHEET_NUMBER_MAX)

// Hochladen eines alten Gästeblatts (Datei wird vorher direkt in den Speicher geladen)
export const sheetUploadSchema = (t: T) =>
  z.object({
    sheetNumber: sheetNumberSchema(t),
    signedOn: pastDate(t, 'signedOnFuture'),
    marketingConsent: z.boolean(),
  })

export type SheetUploadInput = z.input<ReturnType<typeof sheetUploadSchema>>

// Einstellungen → Gästeblatt: beide Texte Pflicht, Platzhalter nur aus der Gästeblatt-Liste
export const guestSheetTextsSchema = (t: T) =>
  z
    .object({ privacy: docField(t), marketing: docField(t) })
    .superRefine((v, ctx) => {
      const rules = { max: GUEST_SHEET_TEXT_MAX, required: true, requiredKey: 'textRequired', ctx: 'guestSheet' as const }
      checkDoc(t, v.privacy, 'privacy', rules, ctx)
      checkDoc(t, v.marketing, 'marketing', rules, ctx)
    })

export type GuestSheetTextsInput = z.input<ReturnType<typeof guestSheetTextsSchema>>
