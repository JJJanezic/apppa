'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash, WarningCircle } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useMemo, useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'

import { saveBooking } from '@/app/(app)/buchungen/actions'
import { checkGuestDuplicates } from '@/app/(app)/gaeste/actions'
import { callAction, FormError } from '@/components/auth/form-error'
import { BookingWarningsAlert, hasWarnings } from '@/components/bookings/booking-warnings'
import { useBookingWarnings } from '@/components/bookings/use-booking-warnings'
import { DetailPanel } from '@/components/detail-panel'
import { GuestFields } from '@/components/guests/guest-fields'
import { GuestPicker } from '@/components/guests/guest-picker'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { personPriceGroups } from '@/lib/apartments'
import {
  addDays,
  amountInput,
  type BookableApartment,
  type Booking,
  bookingHref,
  CHARGE_SUGGESTIONS,
  isIsoDate,
  LIMITS,
  nightsBetween,
  parseAmountCents,
  suggestedNightsCents,
} from '@/lib/bookings'
import { formatCurrency } from '@/lib/format'
import { countryName, type DuplicateMatch, guestSortName } from '@/lib/guests'
import { type BookingInput, bookingSchema } from '@/lib/validation/bookings'
import { EMPTY_GUEST_INPUT, type GuestInput, guestSchema } from '@/lib/validation/guests'

type PickedGuest = {
  id: string
  lastName: string
  firstName: string | null
  titlePrefix: string | null
  titleSuffix: string | null
  country: string
}

interface BookingPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  apartments: BookableApartment[]
  // Bearbeiten: die Buchung bzw. Option; Anlegen: null
  booking: Booking | null
  owner: boolean
  // Heutiges Datum (Wien) vom Server
  today: string
  // Anlegen per Klick im Belegungskalender (PROJ-9): Wohnung und Anreise vorbelegt, Abreise = Anreise + 1
  defaults?: { apartmentId: string; arrival: string }
  // Nach dem Anlegen: Detailseite öffnen (Standard) oder nur die Seite erneuern (Belegungskalender)
  afterCreate?: 'open' | 'refresh'
}

const euro = (cents: number) => formatCurrency(cents / 100, { cents: cents % 100 !== 0 })

// Neue Buchung: Inhaber erhalten die Reinigungsgebühr der Wohnung als Position (cleaningLabel), Mitarbeiter keine Beträge
function initialValues(
  booking: Booking | null,
  apartments: BookableApartment[],
  today: string,
  cleaningLabel: string | null,
  defaults?: BookingPanelProps['defaults']
): BookingInput {
  if (booking) {
    return {
      kind: booking.kind === 'option' ? 'option' : 'booking',
      apartmentId: booking.apartment.id,
      arrival: booking.arrival,
      departure: booking.departure,
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      guestMode: 'existing',
      guestId: booking.guest?.id ?? '',
      adults: String(booking.adults),
      children: booking.childAges.map((age) => ({ age: String(age) })),
      optionUntil: booking.optionUntil ?? '',
      nightsPrice: amountInput(booking.amounts?.nightsCents ?? null),
      charges: (booking.amounts?.charges ?? []).map((c) => ({ label: c.label, amount: amountInput(c.amountCents) })),
      note: booking.note ?? '',
    }
  }
  const active = apartments.filter((a) => !a.archived)
  // Vorbelegte (nur aktive) Wohnung, sonst die einzige aktive
  const only = active.find((a) => a.id === defaults?.apartmentId) ?? (active.length === 1 ? active[0] : null)
  return {
    kind: 'booking',
    apartmentId: only?.id ?? '',
    arrival: defaults?.arrival ?? '',
    departure: defaults ? addDays(defaults.arrival, 1) : '',
    checkIn: only?.checkIn ?? '15:00',
    checkOut: only?.checkOut ?? '10:00',
    guestMode: 'existing',
    guestId: '',
    adults: '1',
    children: [],
    optionUntil: addDays(today, LIMITS.optionDefaultDays),
    nightsPrice: '',
    // Vorausgewählte Wohnung: ihre Reinigungsgebühr gleich eintragen (wie beim Wählen)
    charges: cleaningLabel && only && only.cleaningFeeCents !== null ? [{ label: cleaningLabel, amount: amountInput(only.cleaningFeeCents) }] : [],
    note: '',
  }
}

// Detail-Panel „Neue Buchung / Buchung bearbeiten“ (PROJ-8). Gast suchen oder neu anlegen (Bausteine aus PROJ-7),
// Personen mit Kinderalter, Preis mit Vorschlag und Zusatzkosten (nur Inhaber), Warnung bei Überschneidung oder
// Überbelegung (Inhaber dürfen bewusst übersteuern).
export function BookingPanel({ open, onOpenChange, apartments, booking, owner, today, defaults, afterCreate = 'open' }: BookingPanelProps) {
  const t = useTranslations('bookings')
  const tv = useTranslations('bookings.validation')
  const tgv = useTranslations('guests.validation')
  const tg = useTranslations('guests')
  const locale = useLocale()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const [override, setOverride] = useState<{ version: string } | null>(null)
  const [picked, setPicked] = useState<PickedGuest | null>(booking?.guest ?? null)
  // Wurde der Preis von Hand geändert? Dann wird ein neuer Vorschlag nur angeboten (Spec)
  const [priceTouched, setPriceTouched] = useState(Boolean(booking))
  // Mögliche Doppeleinträge des neuen Gastes samt geprüften Werten
  const [duplicates, setDuplicates] = useState<{ matches: DuplicateMatch[]; values: string } | null>(null)

  const form = useForm<BookingInput>({
    resolver: zodResolver(bookingSchema(tv, { owner, today }), undefined, { raw: true }),
    defaultValues: initialValues(booking, apartments, today, owner ? t('chargeSuggestions.cleaning') : null, defaults),
  })
  const guestForm = useForm<GuestInput>({
    resolver: zodResolver(guestSchema(tgv), undefined, { raw: true }),
    defaultValues: EMPTY_GUEST_INPUT,
  })
  const children = useFieldArray({ control: form.control, name: 'children' })
  const charges = useFieldArray({ control: form.control, name: 'charges' })

  const [kind, apartmentId, arrival, departure, guestMode, adults, childRows, nightsPrice, chargeRows] = useWatch({
    control: form.control,
    name: ['kind', 'apartmentId', 'arrival', 'departure', 'guestMode', 'adults', 'children', 'nightsPrice', 'charges'],
  })
  const guestValues = JSON.stringify(useWatch({ control: guestForm.control }))
  const visibleDuplicates = duplicates && duplicates.values === guestValues ? duplicates.matches : null

  // Archivierte Wohnungen sind nicht wählbar; beim Bearbeiten bleibt die bisherige sichtbar
  const options = apartments.filter((a) => !a.archived || a.id === booking?.apartment.id)
  const apartment = apartments.find((a) => a.id === apartmentId) ?? null
  const periodOk = isIsoDate(arrival) && isIsoDate(departure) && arrival < departure
  const nights = periodOk ? nightsBetween(arrival, departure) : 0
  const adultCount = Number(adults) || 0
  const persons = adultCount + childRows.length
  // Alter der Kinder; solange eines fehlt oder ungültig ist, bleibt der bisherige Vorschlag stehen (undefined)
  const childAges = childRows.map((c) => (/^\d{1,2}$/.test(c.age?.trim() ?? '') && Number(c.age) <= LIMITS.childAgeMax ? Number(c.age) : null))
  const agesComplete = childAges.every((a) => a !== null)
  // Rechnerischer Vorschlag nach Preisart der Wohnung (PROJ-27); vereinbart wird der eingetragene Preis
  const suggestion =
    apartment && nights > 0 && agesComplete ? suggestedNightsCents(apartment, nights, adultCount, childAges as number[]) : apartment && nights > 0 ? undefined : null
  const hasPricing = apartment !== null && (apartment.priceMode === 'person' ? apartment.adultPriceCents !== null : apartment.priceCents !== null)
  // Rechnung über dem Höchstbetrag: kein Vorschlag, Preis von Hand eingeben
  const tooHigh = hasPricing && nights > 0 && agesComplete && suggestion === null
  const groups = apartment?.priceMode === 'person' && agesComplete ? personPriceGroups(apartment, adultCount, childAges as number[]) : null

  const { warnings, version, recheck } = useBookingWarnings({ id: booking?.id ?? null, apartmentId, arrival, departure, persons, adults: adultCount })
  const warn = hasWarnings(warnings)
  const overrideOk = owner && override?.version === version
  const blocked = warn && !overrideOk

  const total = useMemo(() => {
    const cents = [nightsPrice, ...chargeRows.map((c) => c.amount)].map((v) => parseAmountCents(v ?? ''))
    return cents.every((c) => c === null || !Number.isNaN(c)) ? cents.reduce<number>((s, c) => s + (c ?? 0), 0) : null
  }, [nightsPrice, chargeRows])

  // Neuer Vorschlag nach Änderung von Wohnung, Zeitraum oder Personen: übernehmen, solange der Preis nicht von Hand
  // geändert wurde (sonst nur „Neuen Vorschlag übernehmen“). Wohnung ohne Preis oder Rechnung über dem Höchstbetrag:
  // Feld leeren, Preis ist Pflicht.
  useEffect(() => {
    if (!owner || priceTouched || suggestion === undefined) return
    if (suggestion !== null) form.setValue('nightsPrice', amountInput(suggestion))
    else if (apartment && (!hasPricing || tooHigh)) form.setValue('nightsPrice', '')
  }, [owner, priceTouched, suggestion, apartment, hasPricing, tooHigh, form])

  function onApartment(id: string) {
    const apt = apartments.find((a) => a.id === id) ?? null
    form.setValue('apartmentId', id, { shouldValidate: form.formState.isSubmitted })
    if (!apt || booking) return
    form.setValue('checkIn', apt.checkIn)
    form.setValue('checkOut', apt.checkOut)
    // Reinigungsgebühr der Wohnung als Position „Reinigung“ (nur neue Buchungen)
    if (owner) {
      const cleaning = t('chargeSuggestions.cleaning')
      const index = form.getValues('charges').findIndex((c) => c.label === cleaning)
      if (apt.cleaningFeeCents !== null) {
        if (index >= 0) form.setValue(`charges.${index}.amount`, amountInput(apt.cleaningFeeCents))
        else charges.append({ label: cleaning, amount: amountInput(apt.cleaningFeeCents) })
      }
    }
  }

  function onPeriod(field: 'arrival' | 'departure', value: string) {
    form.setValue(field, value, { shouldValidate: form.formState.isSubmitted })
  }

  async function save(values: BookingInput, forceNewGuest = false) {
    setError(null)
    let newGuest: GuestInput | undefined
    if (values.guestMode === 'new') {
      if (!(await guestForm.trigger())) return
      newGuest = guestForm.getValues()
      // Möglicher Doppeleintrag? (Prüfung aus PROJ-7; „Trotzdem neu anlegen“ speichert ohne erneute Prüfung)
      if (!forceNewGuest) {
        const check = await callAction(() => checkGuestDuplicates(newGuest!))
        if (check.ok && check.data && check.data.length > 0) {
          setDuplicates({ matches: check.data, values: JSON.stringify(newGuest) })
          return
        }
      }
    }
    if (blocked) return
    const result = await callAction(() =>
      saveBooking({ id: booking?.id, updatedAt: booking?.updatedAt, values, newGuest, confirmOverride: overrideOk })
    )
    if (!result.ok) {
      if (result.error === 'staleBooking') setStale(true)
      else {
        setError(result.error)
        // Inzwischen neue Überschneidung (z. B. gleichzeitig angelegt): Warnung neu laden
        if (result.error === 'warnings' || result.error === 'ownerOnly') recheck()
      }
      return
    }
    toast.success(booking ? t('done.saved') : t('done.created'))
    onOpenChange(false)
    if (!booking && result.data && afterCreate === 'open') router.push(bookingHref(result.data.id))
    else router.refresh()
  }

  function pickExisting(match: DuplicateMatch) {
    setPicked(match.guest)
    form.setValue('guestMode', 'existing')
    form.setValue('guestId', match.guest.id, { shouldValidate: form.formState.isSubmitted })
    setDuplicates(null)
  }

  const submitting = form.formState.isSubmitting
  const submitLabel = booking ? t('panel.saveChanges') : kind === 'option' ? t('panel.saveOption') : t('panel.save')

  return (
    <DetailPanel
      open={open}
      onOpenChange={onOpenChange}
      title={booking ? t('panel.editTitle') : t('panel.createTitle')}
      eyebrow={booking ? [t(`kind.${booking.kind}`), booking.number].filter(Boolean).join(' · ') : undefined}
      description={booking ? undefined : t('panel.description')}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit((v) => save(v))} noValidate className="flex flex-col gap-6">
          <FormError error={error} namespace="bookings.errors" />
          {stale && (
            <Alert role="alert" className="border-ds-accent-2-700/40 bg-ds-accent-2-100 text-ds-accent-2-800">
              <WarningCircle size={18} weight="duotone" aria-hidden="true" />
              <AlertDescription className="flex flex-col items-start gap-3">
                {t('stale.text')}
                <Button type="button" variant="outline" className="min-h-11" onClick={() => router.refresh()}>
                  {t('stale.reload')}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {!booking && (
            <FormField
              control={form.control}
              name="kind"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('panel.kindLabel')}</FormLabel>
                  <FormControl>
                    <RadioGroup value={field.value} onValueChange={field.onChange} className="grid grid-cols-2 gap-3">
                      {(['booking', 'option'] as const).map((k) => (
                        <Label key={k} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 font-normal has-[[data-state=checked]]:border-ds-accent-700">
                          <RadioGroupItem value={k} />
                          {t(`kind.${k}`)}
                        </Label>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  {kind === 'option' && <FormDescription>{t('panel.kindOptionHint')}</FormDescription>}
                </FormItem>
              )}
            />
          )}

          {kind === 'option' && (
            <FormField
              control={form.control}
              name="optionUntil"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('panel.optionUntil')}</FormLabel>
                  <FormControl>
                    <Input type="date" min={today} className="min-h-11 w-48" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          <FormField
            control={form.control}
            name="apartmentId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('panel.apartment')}</FormLabel>
                <Select value={field.value} onValueChange={onApartment}>
                  <FormControl>
                    <SelectTrigger className="min-h-11">
                      <SelectValue placeholder={t('panel.apartmentPlaceholder')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {options.map((a) => (
                      <SelectItem key={a.id} value={a.id} className="min-h-11">
                        {a.archived ? t('panel.archived', { label: a.label }) : a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-3">
            {(['arrival', 'departure'] as const).map((name) => (
              <FormField
                key={name}
                control={form.control}
                name={name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t(`panel.${name}`)}</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        min={name === 'departure' && isIsoDate(arrival) ? addDays(arrival, 1) : undefined}
                        className="min-h-11"
                        {...field}
                        onChange={(e) => onPeriod(name, e.target.value)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
            {(['checkIn', 'checkOut'] as const).map((name) => (
              <FormField
                key={name}
                control={form.control}
                name={name}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t(`panel.${name}`)}</FormLabel>
                    <FormControl>
                      <Input type="time" className="min-h-11" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
          </div>
          {nights > 0 && (
            <p className="-mt-3 text-sm text-ds-neutral-800" aria-live="polite">
              {t('nightsCount', { nights })}
            </p>
          )}

          <fieldset className="flex flex-col gap-4">
            <legend className="mb-2 text-sm font-semibold">{t('panel.guest')}</legend>
            <FormField
              control={form.control}
              name="guestMode"
              render={({ field }) => (
                <RadioGroup value={field.value} onValueChange={field.onChange} className="grid grid-cols-2 gap-3" aria-label={t('panel.guest')}>
                  {(['existing', 'new'] as const).map((m) => (
                    <Label key={m} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 font-normal has-[[data-state=checked]]:border-ds-accent-700">
                      <RadioGroupItem value={m} />
                      {m === 'existing' ? t('panel.guestExisting') : t('panel.guestNew')}
                    </Label>
                  ))}
                </RadioGroup>
              )}
            />

            {guestMode === 'existing' ? (
              <FormField
                control={form.control}
                name="guestId"
                render={() => (
                  <FormItem>
                    {picked ? (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-ds-surface px-4 py-3">
                        <span className="flex flex-col">
                          <span className="font-medium">{guestSortName(picked)}</span>
                          <span className="text-[13px] text-ds-neutral-700">{countryName(picked.country, locale)}</span>
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11"
                          onClick={() => {
                            setPicked(null)
                            form.setValue('guestId', '')
                          }}
                        >
                          {t('panel.guestChange')}
                        </Button>
                      </div>
                    ) : (
                      <GuestPicker
                        label={t('panel.guestSearch')}
                        onSelect={(row) => {
                          setPicked(row)
                          form.setValue('guestId', row.id, { shouldValidate: form.formState.isSubmitted })
                        }}
                      />
                    )}
                    <FormDescription>{t('panel.guestHint')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <div className="flex flex-col gap-4 rounded-lg border p-4">
                {/* Eigenes Formular für die Gast-Felder (PROJ-7), ohne eigenes <form>-Element */}
                <Form {...guestForm}>
                  <GuestFields />
                </Form>
                {visibleDuplicates && (
                  <Alert role="alert" className="border-ds-accent-700/40 bg-ds-accent-100">
                    <WarningCircle size={18} weight="duotone" aria-hidden="true" />
                    <AlertTitle>{tg('duplicateWarning.title')}</AlertTitle>
                    <AlertDescription className="flex flex-col gap-3">
                      <p>{tg('duplicateWarning.text')}</p>
                      <ul className="flex flex-col gap-2">
                        {visibleDuplicates.map((m) => (
                          <li key={m.guest.id} className="flex flex-wrap items-center justify-between gap-2">
                            <span className="flex flex-col">
                              <span className="font-medium">{guestSortName(m.guest)}</span>
                              <span className="text-[13px] text-ds-neutral-800">
                                {countryName(m.guest.country, locale)} · {m.reasons.map((r) => tg(`reason.${r}`)).join(', ')}
                              </span>
                            </span>
                            <Button type="button" variant="outline" className="min-h-11" onClick={() => pickExisting(m)}>
                              {t('panel.guestExisting')}
                            </Button>
                          </li>
                        ))}
                      </ul>
                      <Button type="button" className="min-h-11 self-start" disabled={submitting} onClick={form.handleSubmit((v) => save(v, true))}>
                        {tg('duplicateWarning.createAnyway')}
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </fieldset>

          <fieldset className="flex flex-col gap-4">
            <legend className="mb-2 text-sm font-semibold">
              {t('panel.persons')}
              {persons > 0 && <span className="font-normal text-ds-neutral-800"> · {t('personsCount', { persons })}</span>}
            </legend>
            <FormField
              control={form.control}
              name="adults"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('panel.adults')}</FormLabel>
                  <FormControl>
                    <Input type="number" inputMode="numeric" min={1} max={LIMITS.adultsMax} className="min-h-11 w-28" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {children.fields.map((child, i) => (
              <FormField
                key={child.id}
                control={form.control}
                name={`children.${i}.age`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('panel.childAge', { n: i + 1 })}</FormLabel>
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input type="number" inputMode="numeric" min={0} max={LIMITS.childAgeMax} className="min-h-11 w-28" {...field} />
                      </FormControl>
                      <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={t('panel.removeChild', { n: i + 1 })} onClick={() => children.remove(i)}>
                        <Trash size={18} aria-hidden="true" />
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
            <Button type="button" variant="outline" className="min-h-11 self-start" onClick={() => children.append({ age: '' }, { shouldFocus: true })}>
              <Plus size={16} aria-hidden="true" />
              {t('panel.addChild')}
            </Button>
          </fieldset>

          {owner ? (
            <fieldset className="flex flex-col gap-4">
              <legend className="mb-2 text-sm font-semibold">{t('panel.price')}</legend>
              <FormField
                control={form.control}
                name="nightsPrice"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('panel.nightsPrice')}</FormLabel>
                    <FormControl>
                      <Input
                        inputMode="decimal"
                        autoComplete="off"
                        className="min-h-11 w-40"
                        {...field}
                        onChange={(e) => {
                          setPriceTouched(true)
                          field.onChange(e)
                        }}
                      />
                    </FormControl>
                    {typeof suggestion === 'number' && apartment?.priceMode === 'apartment' && apartment.priceCents !== null && (
                      <FormDescription>
                        {t('panel.suggestion', { price: euro(suggestion), nights, rate: euro(apartment.priceCents) })}
                      </FormDescription>
                    )}
                    {typeof suggestion === 'number' && groups && (
                      <FormDescription>
                        {t('panel.suggestionPersons', {
                          price: euro(suggestion),
                          nights,
                          persons: groups.map((g) => `${g.count} × ${euro(g.cents)}`).join(' + '),
                        })}
                      </FormDescription>
                    )}
                    {apartment && !hasPricing && <FormDescription>{t('panel.noDefaultPrice')}</FormDescription>}
                    {tooHigh && <FormDescription>{t('panel.suggestionTooHigh')}</FormDescription>}
                    {priceTouched && typeof suggestion === 'number' && parseAmountCents(nightsPrice) !== suggestion && (
                      <Button
                        type="button"
                        variant="link"
                        className="h-auto min-h-11 self-start p-0"
                        onClick={() => form.setValue('nightsPrice', amountInput(suggestion), { shouldValidate: form.formState.isSubmitted })}
                      >
                        {t('panel.takeSuggestion', { price: euro(suggestion) })}
                      </Button>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex flex-col gap-3">
                <span className="text-sm font-semibold">{t('panel.charges')}</span>
                <datalist id="zusatzkosten-vorschlaege">
                  {CHARGE_SUGGESTIONS.map((s) => (
                    <option key={s} value={t(`chargeSuggestions.${s}`)} />
                  ))}
                </datalist>
                {charges.fields.map((charge, i) => (
                  <div key={charge.id} className="grid grid-cols-[1fr_7rem_auto] items-start gap-2">
                    <FormField
                      control={form.control}
                      name={`charges.${i}.label`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="sr-only">{t('panel.chargeLabel')}</FormLabel>
                          <FormControl>
                            <Input list="zusatzkosten-vorschlaege" maxLength={LIMITS.chargeLabelMax} placeholder={t('panel.chargeLabel')} className="min-h-11" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`charges.${i}.amount`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="sr-only">{t('panel.chargeAmount')}</FormLabel>
                          <FormControl>
                            <Input inputMode="decimal" autoComplete="off" placeholder={t('panel.chargeAmount')} className="min-h-11" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={t('panel.removeCharge', { n: i + 1 })} onClick={() => charges.remove(i)}>
                      <Trash size={18} aria-hidden="true" />
                    </Button>
                  </div>
                ))}
                {charges.fields.length < LIMITS.chargesMax && (
                  <Button type="button" variant="outline" className="min-h-11 self-start" onClick={() => charges.append({ label: '', amount: '' }, { shouldFocus: true })}>
                    <Plus size={16} aria-hidden="true" />
                    {t('panel.addCharge')}
                  </Button>
                )}
              </div>

              <div className="flex items-baseline justify-between gap-3 border-t pt-3" aria-live="polite">
                <span>
                  {t('panel.total')} <span className="text-[13px] text-ds-neutral-700">({t('panel.totalHint')})</span>
                </span>
                <span className="text-lg font-semibold tabular-nums">{total === null ? '–' : euro(total)}</span>
              </div>
            </fieldset>
          ) : (
            !booking && <p className="rounded-lg bg-ds-surface px-4 py-3 text-sm text-ds-neutral-800">{t('panel.staffPriceNote')}</p>
          )}

          <FormField
            control={form.control}
            name="note"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('panel.note')}</FormLabel>
                <FormControl>
                  <Textarea rows={3} maxLength={LIMITS.noteMax} {...field} />
                </FormControl>
                <FormDescription>{t('panel.noteHint')}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {warn && (
            <BookingWarningsAlert
              warnings={warnings}
              owner={owner}
              override={overrideOk}
              onOverrideChange={(v) => setOverride(v ? { version } : null)}
            />
          )}

          {!visibleDuplicates && (
            <Button type="submit" disabled={submitting || blocked} aria-busy={submitting} className="min-h-11">
              {submitLabel}
            </Button>
          )}
        </form>
      </Form>
    </DetailPanel>
  )
}
