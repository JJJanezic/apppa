import { z } from 'zod'

import { LIMITS, parsePriceCents } from '@/lib/apartments'

// Prüfregeln für Objekte und Wohnungen (PROJ-6). Browser und Server-Aktionen nutzen dieselben Schemas.
// Meldungen kommen über `t` aus messages/de.json („apartments.validation“).

type T = (key: string) => string

const NEW_PROPERTY = '__new'
export { NEW_PROPERTY }

const text = (t: T, max: number, requiredKey: string) =>
  z.string().trim().min(1, t(requiredKey)).max(max, t('tooLong'))

const time = (t: T) => z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, t('timeInvalid'))

export const propertySchema = (t: T) =>
  z.object({
    name: text(t, LIMITS.nameMax, 'propertyNameRequired'),
    street: text(t, LIMITS.streetMax, 'streetRequired'),
    postalCode: z.string().trim().regex(/^\d{4}$/, t('postalCodeInvalid')),
    city: text(t, LIMITS.cityMax, 'cityRequired'),
    municipalityCode: z.string().regex(/^\d{5}$/, t('municipalityRequired')),
  })

const apartmentFields = (t: T) => ({
  name: text(t, LIMITS.nameMax, 'apartmentNameRequired'),
  maxGuests: z.coerce
    .number({ error: t('guestsInvalid') })
    .int(t('guestsInvalid'))
    .min(LIMITS.guestsMin, t('guestsInvalid'))
    .max(LIMITS.guestsMax, t('guestsInvalid')),
  kind: z.enum(['holiday', 'service']),
  price: z
    .string()
    .refine((v) => {
      const cents = parsePriceCents(v)
      return cents === null || (!Number.isNaN(cents) && cents <= LIMITS.priceMaxCents)
    }, t('priceInvalid'))
    .transform((v) => parsePriceCents(v)),
  checkIn: time(t),
  checkOut: time(t),
  note: z
    .string()
    .trim()
    .max(LIMITS.noteMax, t('tooLong'))
    .transform((v) => v || null),
})

// Wohnung anlegen bzw. bearbeiten: bestehendes Objekt (propertyId) oder „Neues Objekt“ (propertyId = NEW_PROPERTY)
// samt Objektangaben. Die Objektangaben werden nur bei „Neues Objekt“ geprüft.
export const withNewProperty = (t: T) =>
  z.object({ propertyId: z.literal(NEW_PROPERTY), newProperty: propertySchema(t), ...apartmentFields(t) })
export const withExistingProperty = (t: T) =>
  z.object({
    propertyId: z.string().regex(/^[0-9a-f-]{36}$/i, t('propertyRequired')),
    newProperty: z.undefined().optional(),
    ...apartmentFields(t),
  })

export const apartmentSchema = (t: T) =>
  z.union([withNewProperty(t), withExistingProperty(t)])

export type PropertyInput = z.input<ReturnType<typeof propertySchema>>
export type PropertyValues = z.infer<ReturnType<typeof propertySchema>>
export type ApartmentInput = z.input<ReturnType<typeof apartmentSchema>>
export type ApartmentValues = z.infer<ReturnType<typeof apartmentSchema>>
