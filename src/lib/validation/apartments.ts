import { z } from 'zod'

import { type ChildPrice, LIMITS, parsePriceCents, PRICE_MODES } from '@/lib/apartments'

// Prüfregeln für Objekte und Wohnungen (PROJ-6). Browser und Server-Aktionen nutzen dieselben Schemas.
// Meldungen kommen über `t` aus messages/de.json („apartments.validation“).

type T = (key: string) => string

const NEW_PROPERTY = '__new'
export { NEW_PROPERTY }

const text = (t: T, max: number, requiredKey: string) =>
  z.string().trim().min(1, t(requiredKey)).max(max, t('tooLong'))

const time = (t: T) => z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, t('timeInvalid'))

// Betrag in Euro (leer erlaubt) → Cent bzw. null
const money = (t: T) =>
  z
    .string()
    .refine((v) => {
      const cents = parsePriceCents(v)
      return cents === null || (!Number.isNaN(cents) && cents <= LIMITS.priceMaxCents)
    }, t('priceInvalid'))
    .transform((v) => parsePriceCents(v))

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
  // Höchstens Erwachsene (PROJ-27): leer = nur die Personenzahl gilt
  maxAdults: z
    .string()
    .trim()
    .refine((v) => v === '' || (/^\d{1,2}$/.test(v) && Number(v) >= LIMITS.guestsMin && Number(v) <= LIMITS.guestsMax), t('adultsInvalid'))
    .transform((v) => (v === '' ? null : Number(v))),
  kind: z.enum(['holiday', 'service']),
  // Preisart (PROJ-27): Wohnungspreis (price) oder Personenpreise (adultPrice + childPrices)
  priceMode: z.enum(PRICE_MODES),
  price: money(t),
  adultPrice: money(t),
  childPrices: z
    .array(
      z.object({
        toAge: z
          .string()
          .trim()
          .refine((v) => /^\d{1,2}$/.test(v) && Number(v) <= LIMITS.childAgeMax, t('childAgeInvalid')),
        price: money(t).refine((cents) => cents !== null, t('childPriceRequired')),
      })
    )
    .max(LIMITS.childPricesMax),
  // Reinigungsgebühr (PROJ-8): wird neuen Buchungen als Position „Reinigung“ vorgeschlagen
  cleaningFee: money(t),
  checkIn: time(t),
  checkOut: time(t),
  note: z
    .string()
    .trim()
    .max(LIMITS.noteMax, t('tooLong'))
    .transform((v) => v || null),
})

// Regeln über mehrere Felder (PROJ-27): Erwachsene höchstens die Personenzahl, Erwachsenenpreis bei Personenpreisen,
// Kinderstufen mit aufsteigender Altersgrenze
type CrossFields = {
  maxGuests: number
  maxAdults: number | null
  priceMode: (typeof PRICE_MODES)[number]
  adultPrice: number | null
  childPrices: { toAge: string; price: number | null }[]
}
function checkApartment(t: T, v: CrossFields, ctx: z.RefinementCtx) {
  if (v.maxAdults !== null && v.maxAdults > v.maxGuests) ctx.addIssue({ code: 'custom', path: ['maxAdults'], message: t('adultsTooMany') })
  if (v.priceMode === 'person' && v.adultPrice === null) ctx.addIssue({ code: 'custom', path: ['adultPrice'], message: t('adultPriceRequired') })
  v.childPrices.forEach((tier, i) => {
    if (i > 0 && Number(tier.toAge) <= Number(v.childPrices[i - 1].toAge))
      ctx.addIssue({ code: 'custom', path: ['childPrices', i, 'toAge'], message: t('childAgesAscending') })
  })
}

// Kinderstufen für Datenbank und Anzeige
export const toChildPrices = (tiers: { toAge: string; price: number | null }[]): ChildPrice[] =>
  tiers.map((tier) => ({ toAge: Number(tier.toAge), priceCents: tier.price ?? 0 }))

// Wohnung anlegen bzw. bearbeiten: bestehendes Objekt (propertyId) oder „Neues Objekt“ (propertyId = NEW_PROPERTY)
// samt Objektangaben. Die Objektangaben werden nur bei „Neues Objekt“ geprüft.
export const withNewProperty = (t: T) =>
  z
    .object({ propertyId: z.literal(NEW_PROPERTY), newProperty: propertySchema(t), ...apartmentFields(t) })
    .superRefine((v, ctx) => checkApartment(t, v, ctx))
export const withExistingProperty = (t: T) =>
  z
    .object({
      propertyId: z.string().regex(/^[0-9a-f-]{36}$/i, t('propertyRequired')),
      newProperty: z.undefined().optional(),
      ...apartmentFields(t),
    })
    .superRefine((v, ctx) => checkApartment(t, v, ctx))

export const apartmentSchema = (t: T) =>
  z.union([withNewProperty(t), withExistingProperty(t)])

export type PropertyInput = z.input<ReturnType<typeof propertySchema>>
export type PropertyValues = z.infer<ReturnType<typeof propertySchema>>
export type ApartmentInput = z.input<ReturnType<typeof apartmentSchema>>
export type ApartmentValues = z.infer<ReturnType<typeof apartmentSchema>>
