import { z } from 'zod'

import {
  addDays,
  BLOCK_REASONS,
  type BookingAmounts,
  isIsoDate,
  LIMITS,
  nightsBetween,
  parseAmountCents,
  todayIso,
} from '@/lib/bookings'

// Prüfregeln für Buchungen, Optionen, Sperren, Mitreisende und Storno (PROJ-8).
// Browser und Server-Aktionen nutzen dieselben Schemas. Meldungen über `t` aus messages/de.json („bookings.validation“).
// Ein neuer Gast im Buchungsformular wird zusätzlich mit dem Gast-Schema aus PROJ-7 geprüft.

type T = (key: string) => string

const time = (t: T) => z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, t('timeInvalid'))
const date = (t: T, requiredKey: string) => z.string().refine((v) => v !== '', t(requiredKey)).refine((v) => v === '' || isIsoDate(v), t('dateInvalid'))
const note = (t: T) =>
  z
    .string()
    .trim()
    .max(LIMITS.noteMax, t('tooLong'))
    .transform((v) => v || null)
const id = (t: T, requiredKey: string) => z.string().regex(/^[0-9a-f-]{36}$/i, t(requiredKey))

const amount = (t: T) =>
  z.string().refine((v) => {
    const cents = parseAmountCents(v)
    return cents === null || (!Number.isNaN(cents) && cents <= LIMITS.amountMaxCents)
  }, t('amountInvalid'))

// Zeitraum: Abreise nach Anreise, höchstens 365 Nächte, Anreise höchstens 3 Jahre in der Zukunft
function checkPeriod(t: T, today: string, v: { arrival: string; departure: string }, ctx: z.RefinementCtx) {
  if (!isIsoDate(v.arrival) || !isIsoDate(v.departure)) return
  const nights = nightsBetween(v.arrival, v.departure)
  if (nights < 1) ctx.addIssue({ code: 'custom', path: ['departure'], message: t('departureBeforeArrival') })
  else if (nights > LIMITS.nightsMax) ctx.addIssue({ code: 'custom', path: ['departure'], message: t('tooManyNights') })
  if (v.arrival > addDays(today, 365 * LIMITS.yearsAhead + 1)) ctx.addIssue({ code: 'custom', path: ['arrival'], message: t('arrivalTooFar') })
}

export const bookingSchema = (t: T, { owner, today = todayIso() }: { owner: boolean; today?: string }) =>
  z
    .object({
      kind: z.enum(['booking', 'option']),
      apartmentId: id(t, 'apartmentRequired'),
      arrival: date(t, 'arrivalRequired'),
      departure: date(t, 'departureRequired'),
      checkIn: time(t),
      checkOut: time(t),
      // Bestehender Gast (Suche) oder neuer Gast (Gast-Felder aus PROJ-7, eigenes Schema)
      guestMode: z.enum(['existing', 'new']),
      guestId: z.string(),
      adults: z
        .string()
        .trim()
        .refine((v) => /^\d{1,2}$/.test(v) && Number(v) >= 1 && Number(v) <= LIMITS.adultsMax, t('adultsInvalid'))
        .transform(Number),
      children: z
        .array(
          z.object({
            age: z
              .string()
              .trim()
              .refine((v) => /^\d{1,2}$/.test(v) && Number(v) <= LIMITS.childAgeMax, t('childAgeInvalid')),
          })
        )
        .max(LIMITS.personsMax),
      optionUntil: z.string(),
      nightsPrice: z.string(),
      charges: z
        .array(
          z.object({
            label: z.string().trim().min(1, t('chargeLabelRequired')).max(LIMITS.chargeLabelMax, t('tooLong')),
            amount: amount(t).refine((v) => parseAmountCents(v) !== null, t('amountRequired')),
          })
        )
        .max(LIMITS.chargesMax),
      note: note(t),
    })
    .superRefine((v, ctx) => {
      checkPeriod(t, today, v, ctx)
      if (v.guestMode === 'existing' && !/^[0-9a-f-]{36}$/i.test(v.guestId))
        ctx.addIssue({ code: 'custom', path: ['guestId'], message: t('guestRequired') })
      if (v.adults + v.children.length > LIMITS.personsMax)
        ctx.addIssue({ code: 'custom', path: ['adults'], message: t('tooManyPersons') })
      if (v.kind === 'option') {
        if (!isIsoDate(v.optionUntil)) ctx.addIssue({ code: 'custom', path: ['optionUntil'], message: t('optionUntilRequired') })
        else if (v.optionUntil < today) ctx.addIssue({ code: 'custom', path: ['optionUntil'], message: t('optionUntilPast') })
      }
      // Preise setzen nur Inhaber; Mitarbeiter-Buchungen erhalten den Vorschlag (Tech Design C)
      if (owner) {
        const cents = parseAmountCents(v.nightsPrice)
        if (cents === null) ctx.addIssue({ code: 'custom', path: ['nightsPrice'], message: t('nightsPriceRequired') })
        else if (Number.isNaN(cents) || cents > LIMITS.amountMaxCents)
          ctx.addIssue({ code: 'custom', path: ['nightsPrice'], message: t('amountInvalid') })
      }
    })
    .transform((v) => ({
      kind: v.kind,
      apartmentId: v.apartmentId,
      arrival: v.arrival,
      departure: v.departure,
      checkIn: v.checkIn,
      checkOut: v.checkOut,
      guestId: v.guestMode === 'existing' ? v.guestId : null,
      adults: v.adults,
      childAges: v.children.map((c) => Number(c.age)),
      optionUntil: v.kind === 'option' ? v.optionUntil : null,
      amounts: owner
        ? ({
            nightsCents: parseAmountCents(v.nightsPrice) ?? 0,
            charges: v.charges.map((c) => ({ label: c.label.trim(), amountCents: parseAmountCents(c.amount) ?? 0 })),
            cancellationFeeCents: null,
          } satisfies BookingAmounts)
        : null,
      note: v.note,
    }))

export type BookingInput = z.input<ReturnType<typeof bookingSchema>>
export type BookingValues = z.infer<ReturnType<typeof bookingSchema>>

export const blockSchema = (t: T, { today = todayIso() }: { today?: string } = {}) =>
  z
    .object({
      apartmentId: id(t, 'apartmentRequired'),
      arrival: date(t, 'fromRequired'),
      departure: date(t, 'toRequired'),
      reason: z.enum(BLOCK_REASONS),
      note: note(t),
    })
    .superRefine((v, ctx) => {
      checkPeriod(t, today, v, ctx)
      if (v.reason === 'other' && !v.note) ctx.addIssue({ code: 'custom', path: ['note'], message: t('blockNoteRequired') })
    })

export type BlockInput = z.input<ReturnType<typeof blockSchema>>
export type BlockValues = z.infer<ReturnType<typeof blockSchema>>

// Mitreisende: höchstens Personen minus Hauptgast
export const companionsSchema = (t: T, { max, today = todayIso() }: { max: number; today?: string }) =>
  z.object({
    companions: z
      .array(
        z.object({
          firstName: z.string().trim().min(1, t('firstNameRequired')).max(LIMITS.nameMax, t('tooLong')),
          lastName: z.string().trim().min(1, t('lastNameRequired')).max(LIMITS.nameMax, t('tooLong')),
          birthDate: z
            .string()
            .refine((v) => v === '' || (isIsoDate(v) && v >= '1900-01-01'), t('dateInvalid'))
            .refine((v) => v === '' || v <= today, t('birthDateFuture'))
            .transform((v) => v || null),
        })
      )
      .max(max, t('tooManyCompanions')),
  })

export type CompanionsInput = z.input<ReturnType<typeof companionsSchema>>
export type CompanionsValues = z.infer<ReturnType<typeof companionsSchema>>

export const cancelSchema = (t: T) =>
  z.object({
    reason: z
      .string()
      .trim()
      .max(LIMITS.cancelReasonMax, t('tooLong'))
      .transform((v) => v || null),
    fee: amount(t).transform((v) => parseAmountCents(v)),
  })

export type CancelInput = z.input<ReturnType<typeof cancelSchema>>
export type CancelValues = z.infer<ReturnType<typeof cancelSchema>>
