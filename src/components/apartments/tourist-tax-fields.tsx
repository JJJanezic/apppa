'use client'

import { Plus, Trash } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'

import { AmountInput } from '@/components/amount-input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { LabelCombobox } from '@/components/vat/label-combobox'
import { VatRateInput } from '@/components/vat/vat-rate-input'
import { todayIso } from '@/lib/bookings'
import { amountInput, formatCents, formatDate, parseAmountCents } from '@/lib/format'
import {
  currentRate,
  isFutureRate,
  TOURIST_TAX_BASES,
  TOURIST_TAX_LABEL_CHOICES,
  TOURIST_TAX_LIMITS,
  TOURIST_TAX_METHODS,
  type TouristTaxBase,
  type TouristTaxMethod,
  type TouristTaxRate,
} from '@/lib/tourist-tax'
import { formatVatRate, parseVatRate, vatRateInput } from '@/lib/vat'

// Tarif im Formular: Rohwerte wie in den Eingabefeldern
export type TouristTaxRateFormValues = {
  id?: string
  validFrom: string
  label: string
  method: TouristTaxMethod
  amount: string
  percent: string
  base: TouristTaxBase
  exemptUnderAge: string
  vat: string
}

export const toRateFormValues = (r: TouristTaxRate): TouristTaxRateFormValues => ({
  id: r.id,
  validFrom: r.validFrom,
  label: r.label,
  method: r.method,
  amount: r.amountCents === null ? '' : amountInput(r.amountCents),
  percent: r.percentBp === null ? '' : vatRateInput(r.percentBp),
  base: r.base ?? 'net',
  exemptUnderAge: r.exemptUnderAge === null ? '' : String(r.exemptUnderAge),
  vat: vatRateInput(r.vatBp),
})

type FormShape = { touristTaxRates: TouristTaxRateFormValues[] }

// Zeile „Aktuell: …“ aus den Formularwerten; ungültige Eingaben ergeben keine Zeile
function useSummary() {
  const t = useTranslations('apartments.touristTax')
  return (r: TouristTaxRateFormValues): string | null => {
    if (r.method === 'per_person_night') {
      const cents = parseAmountCents(r.amount)
      if (cents === null || Number.isNaN(cents)) return null
      const age = r.exemptUnderAge.trim()
      return t(age ? 'summaryPerPersonAge' : 'summaryPerPerson', { label: r.label.trim(), amount: formatCents(cents), age, since: formatDate(r.validFrom) })
    }
    const bp = parseVatRate(r.percent)
    if (bp === null || Number.isNaN(bp)) return null
    return t('summaryPercent', { label: r.label.trim(), percent: formatVatRate(bp), base: t(`base.${r.base}`), since: formatDate(r.validFrom) })
  }
}

// Abschnitt „Ortstaxe“ im Wohnungsformular (PROJ-15): Tarife mit „gültig ab“, neueste oben. Gespeichert wird mit der
// Wohnung; die Datenbank ersetzt die Liste als Ganzes.
export function TouristTaxFields() {
  const t = useTranslations('apartments.touristTax')
  const { control } = useFormContext<FormShape>()
  const rates = useFieldArray({ control, name: 'touristTaxRates' })
  const values = useWatch({ control, name: 'touristTaxRates' }) ?? []
  const summary = useSummary()
  const today = todayIso()
  const labelChoices = TOURIST_TAX_LABEL_CHOICES.map((key) => ({ key, label: t(`labelChoices.${key}`) }))

  const valid = values.filter((r) => /^\d{4}-\d{2}-\d{2}$/.test(r.validFrom ?? ''))
  const current = currentRate(valid, today)
  const currentText = current ? summary(current) : null

  function add() {
    // Vorbelegung: Bezeichnung und Werte des neuesten Eintrags, Datum leer (z. B. Erhöhung ab 1.1.)
    const latest = values[0]
    rates.prepend(
      {
        validFrom: '',
        label: latest?.label ?? t('labelChoices.overnightLevy'),
        method: latest?.method ?? 'per_person_night',
        amount: '',
        percent: '',
        base: latest?.base ?? 'net',
        exemptUnderAge: latest?.exemptUnderAge ?? '',
        vat: latest?.vat ?? vatRateInput(0),
      },
      { focusName: 'touristTaxRates.0.validFrom' }
    )
  }

  return (
    <fieldset className="flex flex-col gap-4 rounded-lg border p-4">
      <legend className="px-1 text-sm font-semibold">{t('title')}</legend>
      <p className="-mt-1 text-[13px] text-ds-neutral-800" aria-live="polite">
        {rates.fields.length === 0 ? t('empty') : currentText ? t('current', { text: currentText }) : t('noCurrent')}
      </p>

      {rates.fields.map((rate, i) => {
        const row = values[i]
        const future = row && /^\d{4}-\d{2}-\d{2}$/.test(row.validFrom) && isFutureRate(row, today)
        const perPerson = row?.method !== 'percent'
        return (
          <div key={rate.id} role="group" aria-label={t('entry', { n: i + 1 })} className="flex flex-col gap-4 rounded-lg bg-ds-surface p-3">
            <div className="flex flex-wrap items-start gap-3">
              <FormField
                control={control}
                name={`touristTaxRates.${i}.validFrom`}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      {t('validFrom')}
                      {future && <Badge variant="outline">{t('future')}</Badge>}
                    </FormLabel>
                    <FormControl>
                      <Input type="date" className="min-h-11 w-44" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mt-6 ml-auto size-11"
                aria-label={t('remove', { n: i + 1 })}
                onClick={() => rates.remove(i)}
              >
                <Trash size={18} aria-hidden="true" />
              </Button>
            </div>
            <FormField
              control={control}
              name={`touristTaxRates.${i}.label`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('label')}</FormLabel>
                  <FormControl>
                    <LabelCombobox
                      maxLength={TOURIST_TAX_LIMITS.labelMax}
                      className="min-h-11"
                      choices={labelChoices}
                      listLabel={t('labelChoicesList')}
                      {...field}
                      onValueChange={field.onChange}
                      onChoose={() => undefined}
                    />
                  </FormControl>
                  <FormDescription>{t('labelHint')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={control}
              name={`touristTaxRates.${i}.method`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('method')}</FormLabel>
                  <FormControl>
                    <RadioGroup value={field.value} onValueChange={field.onChange} className="grid gap-3 sm:grid-cols-2">
                      {TOURIST_TAX_METHODS.map((m) => (
                        <Label
                          key={m}
                          className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border bg-ds-bg px-3 py-2 font-normal has-[[data-state=checked]]:border-ds-accent-700"
                        >
                          <RadioGroupItem value={m} />
                          {t(`methods.${m}`)}
                        </Label>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {perPerson ? (
              <div className="flex flex-wrap items-start gap-3">
                <FormField
                  control={control}
                  name={`touristTaxRates.${i}.amount`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('amount')}</FormLabel>
                      <FormControl>
                        <AmountInput className="min-h-11 w-32" {...field} onValueChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name={`touristTaxRates.${i}.exemptUnderAge`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('exemptUnderAge')}</FormLabel>
                      <div className="flex items-center gap-2">
                        <FormControl>
                          <Input
                            type="number"
                            inputMode="numeric"
                            min={TOURIST_TAX_LIMITS.ageMin}
                            max={TOURIST_TAX_LIMITS.ageMax}
                            className="min-h-11 w-24"
                            {...field}
                          />
                        </FormControl>
                        <span className="text-sm text-ds-neutral-800" aria-hidden="true">
                          {t('years')}
                        </span>
                      </div>
                      <FormDescription>{t('exemptUnderAgeHint')}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <FormField
                  control={control}
                  name={`touristTaxRates.${i}.percent`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('percent')}</FormLabel>
                      <div className="flex items-center gap-2">
                        <FormControl>
                          <VatRateInput className="min-h-11 w-24" {...field} onValueChange={field.onChange} />
                        </FormControl>
                        <span className="text-sm text-ds-neutral-800" aria-hidden="true">
                          %
                        </span>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name={`touristTaxRates.${i}.base`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('baseLabel')}</FormLabel>
                      <FormControl>
                        <RadioGroup value={field.value} onValueChange={field.onChange} className="grid gap-3 sm:grid-cols-2">
                          {TOURIST_TAX_BASES.map((b) => (
                            <Label
                              key={b}
                              className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border bg-ds-bg px-3 py-2 font-normal has-[[data-state=checked]]:border-ds-accent-700"
                            >
                              <RadioGroupItem value={b} />
                              {t(`baseOption.${b}`)}
                            </Label>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormDescription>{t('percentHint')}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}
            <FormField
              control={control}
              name={`touristTaxRates.${i}.vat`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('vat')}</FormLabel>
                  <div className="flex items-center gap-2">
                    <FormControl>
                      <VatRateInput className="min-h-11 w-24" {...field} onValueChange={field.onChange} />
                    </FormControl>
                    <span className="text-sm text-ds-neutral-800" aria-hidden="true">
                      %
                    </span>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )
      })}

      {rates.fields.length < TOURIST_TAX_LIMITS.ratesMax && (
        <Button type="button" variant="outline" className="min-h-11 self-start" onClick={add}>
          <Plus size={16} aria-hidden="true" />
          {t('add')}
        </Button>
      )}
    </fieldset>
  )
}
