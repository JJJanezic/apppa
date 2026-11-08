'use client'

import { useLocale, useTranslations } from 'next-intl'
import { type ChangeEvent, type Ref, useImperativeHandle, useRef, useState } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { countryName } from '@/lib/guests'
import { type AutofillPlan, loadPostalPlaces, planAutofill, postalLookup } from '@/lib/postal-places'
import type { GuestInput } from '@/lib/validation/guests'

type TextKey = 'postalCode' | 'city' | 'companyPostalCode' | 'companyCity'
type CountryKey = 'addressCountry' | 'companyCountry'

interface PostalPlaceFieldsProps {
  postalName: TextKey
  cityName: TextKey
  countryName: CountryKey
  postalLabel: string
  cityLabel: string
  postalMax: number
  cityMax: number
  // Raster für PLZ und Ort (Gast- und Firmenanschrift unterscheiden sich auf dem Handy)
  gridClassName: string
  // reset(): Ort/Staat wurden von außen gesetzt (Firmenvorschlag, PROJ-49). Merker „automatisch befüllt“ und offene
  // Ortsauswahl verwerfen, damit die Automatik die gesetzten Werte nicht überschreibt
  ref?: Ref<PostalPlaceFieldsHandle>
}

export interface PostalPlaceFieldsHandle {
  reset: () => void
}

// PLZ und Ort einer Anschrift im Gastformular (PROJ-48): Eine österreichische oder deutsche PLZ füllt Ort und Land aus.
// Nur Eingaben im PLZ-Feld lösen das aus – Öffnen eines Gastes oder Zurücksetzen des Formulars nicht.
// Welche Werte automatisch eingetragen wurden, gilt nur für die laufende Bearbeitung und wird nicht gespeichert.
export function PostalPlaceFields({ postalName, cityName, countryName: countryKey, postalLabel, cityLabel, postalMax, cityMax, gridClassName, ref }: PostalPlaceFieldsProps) {
  const t = useTranslations('guests.postalPlaces')
  const locale = useLocale()
  const { control, getValues, setValue, setFocus, formState } = useFormContext<GuestInput>()
  const city = useWatch({ control, name: cityName })
  const auto = useRef<AutofillPlan['auto']>({ city: null, country: null })
  const sequence = useRef(0)
  const [choices, setChoices] = useState<string[]>([])
  const [announcement, setAnnouncement] = useState('')
  // Für die Anzeige der Quellenangabe: zuletzt automatisch eingetragener Ort (die Logik liest den Ref)
  const [autoCity, setAutoCity] = useState<string | null>(null)
  const remember = (next: AutofillPlan['auto']) => {
    auto.current = next
    setAutoCity(next.city)
  }

  useImperativeHandle(ref, () => ({
    reset: () => {
      // Noch laufende Nachschlage-Antwort verwerfen
      sequence.current++
      remember({ city: null, country: null })
      setChoices([])
    },
  }))

  const set = (name: TextKey | CountryKey, value: string) =>
    setValue(name, value, { shouldDirty: true, shouldValidate: formState.isSubmitted })

  const onPostalInput = async (value: string) => {
    const current = ++sequence.current
    setChoices([])
    const lookup = postalLookup(value, getValues(countryKey) ?? '', auto.current.country)
    if (!lookup) return
    const places = await loadPostalPlaces(lookup.country)
    // Inzwischen weitergetippt: veraltete Antwort verwerfen
    if (current !== sequence.current || getValues(postalName) !== value) return
    const found = places?.[lookup.code] ?? []
    const before = { city: getValues(cityName) ?? '', country: getValues(countryKey) ?? '' }
    const plan = planAutofill(before, auto.current, lookup.country, found)
    remember(plan.auto)
    if (plan.values.country !== before.country) set(countryKey, plan.values.country)
    if (plan.values.city !== before.city) set(cityName, plan.values.city)
    setChoices(plan.choices)
    if (plan.choices.length) setAnnouncement(t('choices', { count: plan.choices.length }))
    else if (plan.values.city !== before.city || plan.values.country !== before.country)
      setAnnouncement(t('filled', { place: [plan.values.city, countryName(plan.values.country, locale)].filter(Boolean).join(', ') }))
  }

  const choose = (place: string) => {
    set(cityName, place)
    // Gewählter Ort gilt als „von Hand“
    remember({ ...auto.current, city: null })
    setChoices([])
    setFocus(cityName)
  }

  const fromPostalCode = choices.length > 0 || (autoCity !== null && city === autoCity)

  return (
    <div className="flex flex-col gap-2">
      <div className={gridClassName}>
        <FormField
          control={control}
          name={postalName}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{postalLabel}</FormLabel>
              <FormControl>
                <Input
                  autoComplete="off"
                  maxLength={postalMax}
                  className="min-h-11"
                  {...field}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    field.onChange(e)
                    void onPostalInput(e.target.value)
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={control}
          name={cityName}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{cityLabel}</FormLabel>
              <FormControl>
                <Input
                  autoComplete="off"
                  maxLength={cityMax}
                  className="min-h-11"
                  {...field}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => {
                    field.onChange(e)
                    if (choices.length) setChoices([])
                  }}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {choices.length > 0 && (
        <div role="group" aria-label={t('choicesLabel')} className="flex flex-col gap-2">
          <p className="text-[13px] text-ds-neutral-700">{t('choicesLabel')}</p>
          <div className="flex flex-wrap gap-2">
            {choices.map((place) => (
              <Button
                key={place}
                type="button"
                variant="outline"
                // Safari: Knöpfe sind ohne ausdrücklichen tabIndex nicht per Tabulatortaste erreichbar (BUG-1 aus QA)
                tabIndex={0}
                className="min-h-11 font-normal"
                onClick={() => choose(place)}
              >
                {place}
              </Button>
            ))}
          </div>
        </div>
      )}
      {/* Quellenangabe (Lizenzen RTR/GeoNames), sehr klein wie Bildunterschriften im Design-System */}
      {fromPostalCode && <p className="text-[11px] text-ds-neutral-700">{t('source')}</p>}
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </div>
  )
}
