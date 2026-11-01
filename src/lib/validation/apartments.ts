import { z } from 'zod'

import { type ChildPrice, LIMITS, parsePriceCents, PRICE_MODES } from '@/lib/apartments'
import { isIsoDate, parseAmountCents } from '@/lib/bookings'
import { TOURIST_TAX_BASES, TOURIST_TAX_LIMITS, TOURIST_TAX_METHODS, type TouristTaxRate } from '@/lib/tourist-tax'
import { parseVatRate } from '@/lib/vat'

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
  // Ortstaxe-Tarife (PROJ-15); Pflichtfelder je Berechnungsart prüft checkApartment
  touristTaxRates: z
    .array(
      z.object({
        id: z.string().optional(),
        validFrom: z.string().refine((v) => isIsoDate(v), t('touristTax.validFromRequired')),
        label: z.string().trim().min(1, t('touristTax.labelRequired')).max(TOURIST_TAX_LIMITS.labelMax, t('tooLong')),
        method: z.enum(TOURIST_TAX_METHODS),
        amount: z.string(),
        percent: z.string(),
        base: z.enum(TOURIST_TAX_BASES),
        exemptUnderAge: z.string().trim(),
        vat: z
          .string()
          .refine((v) => parseVatRate(v) !== null, t('touristTax.vatRequired'))
          .refine((v) => parseVatRate(v) === null || !Number.isNaN(parseVatRate(v)), t('touristTax.vatInvalid')),
      })
    )
    .max(TOURIST_TAX_LIMITS.ratesMax),
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
  touristTaxRates: TouristTaxRateInput[]
}
function checkApartment(t: T, v: CrossFields, ctx: z.RefinementCtx) {
  checkTouristTaxRates(t, v.touristTaxRates, ctx)
  if (v.maxAdults !== null && v.maxAdults > v.maxGuests) ctx.addIssue({ code: 'custom', path: ['maxAdults'], message: t('adultsTooMany') })
  if (v.priceMode === 'person' && v.adultPrice === null) ctx.addIssue({ code: 'custom', path: ['adultPrice'], message: t('adultPriceRequired') })
  v.childPrices.forEach((tier, i) => {
    if (i > 0 && Number(tier.toAge) <= Number(v.childPrices[i - 1].toAge))
      ctx.addIssue({ code: 'custom', path: ['childPrices', i, 'toAge'], message: t('childAgesAscending') })
  })
}

// Ortstaxe-Tarif im Formular (Rohwerte); Betrag und Prozentsatz als Text wie in den Eingabefeldern
type TouristTaxRateInput = {
  id?: string
  validFrom: string
  label: string
  method: (typeof TOURIST_TAX_METHODS)[number]
  amount: string
  percent: string
  base: (typeof TOURIST_TAX_BASES)[number]
  exemptUnderAge: string
  vat: string
}

const touristTaxAmount = (v: string) => parseAmountCents(v)
const touristTaxAge = (v: string) => (/^\d{1,2}$/.test(v) ? Number(v) : Number.NaN)

// Je Berechnungsart: Betrag (ab € 0,00) bzw. Prozentsatz (über 0 bis 100); Altersgrenze 1–18 oder leer;
// „gültig ab“ je Wohnung nur einmal
function checkTouristTaxRates(t: T, rates: TouristTaxRateInput[], ctx: z.RefinementCtx) {
  // Doppeltes Datum: Die Meldung gehört zum neuen Eintrag. Es bleibt der letzte gespeicherte ohne Meldung, sonst der letzte
  const keeper = new Map<string, number>()
  rates.forEach((r, i) => {
    const kept = keeper.get(r.validFrom)
    if (kept === undefined || r.id || !rates[kept].id) keeper.set(r.validFrom, i)
  })
  rates.forEach((r, i) => {
    const path = (field: string) => ['touristTaxRates', i, field]
    if (r.method === 'per_person_night') {
      const cents = touristTaxAmount(r.amount)
      if (cents === null) ctx.addIssue({ code: 'custom', path: path('amount'), message: t('touristTax.amountRequired') })
      else if (Number.isNaN(cents) || cents > TOURIST_TAX_LIMITS.amountMaxCents)
        ctx.addIssue({ code: 'custom', path: path('amount'), message: t('touristTax.amountInvalid') })
      const age = r.exemptUnderAge === '' ? null : touristTaxAge(r.exemptUnderAge)
      if (age !== null && (Number.isNaN(age) || age < TOURIST_TAX_LIMITS.ageMin || age > TOURIST_TAX_LIMITS.ageMax))
        ctx.addIssue({ code: 'custom', path: path('exemptUnderAge'), message: t('touristTax.ageInvalid') })
    } else {
      const bp = parseVatRate(r.percent)
      if (bp === null) ctx.addIssue({ code: 'custom', path: path('percent'), message: t('touristTax.percentRequired') })
      else if (Number.isNaN(bp) || bp <= 0) ctx.addIssue({ code: 'custom', path: path('percent'), message: t('touristTax.percentInvalid') })
    }
    if (isIsoDate(r.validFrom) && keeper.get(r.validFrom) !== i)
      ctx.addIssue({ code: 'custom', path: path('validFrom'), message: t('touristTax.validFromDuplicate') })
  })
}

// Tarife für Datenbank und Anzeige; Felder der nicht gewählten Berechnungsart entfallen
export const toTouristTaxRates = (rates: TouristTaxRateInput[]): TouristTaxRate[] =>
  rates.map((r) => {
    const perPerson = r.method === 'per_person_night'
    return {
      id: r.id && /^[0-9a-f-]{36}$/i.test(r.id) ? r.id : undefined,
      validFrom: r.validFrom,
      label: r.label.trim(),
      method: r.method,
      amountCents: perPerson ? (touristTaxAmount(r.amount) ?? 0) : null,
      percentBp: perPerson ? null : (parseVatRate(r.percent) ?? 0),
      base: perPerson ? null : r.base,
      exemptUnderAge: perPerson && r.exemptUnderAge !== '' ? touristTaxAge(r.exemptUnderAge) : null,
      vatBp: parseVatRate(r.vat) ?? 0,
    }
  })

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
