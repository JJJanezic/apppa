'use client'

import { CaretDown } from '@phosphor-icons/react'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'

import { CountryPicker } from '@/components/guests/country-picker'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { LANGUAGES, languageName, LIMITS, MARKETING_CUSTOM, MARKETING_NONE, MARKETING_SOURCES } from '@/lib/guests'
import type { GuestInput } from '@/lib/validation/guests'

// Leerer Sprachwert im Select (Radix erlaubt keinen leeren String als Wert)
const NO_LANGUAGE = '__keine'

// Felder eines Gastes (PROJ-7). Wiederverwendbar: Gast-Panel und später das Buchungsformular (PROJ-8).
// Muss innerhalb eines react-hook-form <Form> mit GuestInput-Werten stehen.
export function GuestFields() {
  const t = useTranslations('guests.panel')
  const tm = useTranslations('guests.marketing')
  const locale = useLocale()
  const { control, getValues } = useFormContext<GuestInput>()
  const marketing = useWatch({ control, name: 'marketing' })
  // Firma aufgeklappt, wenn schon Firmenangaben vorhanden sind
  const [companyOpen, setCompanyOpen] = useState(() => {
    const v = getValues()
    return Boolean(v.companyName || v.companyVatId || v.companyBillingAddress)
  })

  const text = (name: keyof GuestInput, label: string, opts: { max: number; hint?: string; type?: string; autoComplete?: string; inputMode?: 'email' | 'tel' } ) => (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type={opts.type ?? 'text'}
              inputMode={opts.inputMode}
              autoComplete={opts.autoComplete ?? 'off'}
              maxLength={opts.max}
              className="min-h-11"
              {...field}
            />
          </FormControl>
          {opts.hint && <FormDescription>{opts.hint}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-2">
        {text('lastName', t('lastName'), { max: LIMITS.nameMax, hint: t('lastNameHint'), autoComplete: 'off' })}
        {text('firstName', t('firstName'), { max: LIMITS.nameMax })}
      </div>

      <FormField
        control={control}
        name="country"
        render={({ field, fieldState }) => (
          <FormItem>
            <FormLabel>{t('country')}</FormLabel>
            <FormControl>
              <CountryPicker value={field.value} onChange={field.onChange} invalid={Boolean(fieldState.error)} />
            </FormControl>
            <FormDescription>{t('countryHint')}</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        {text('email', t('email'), { max: LIMITS.emailMax, type: 'email', inputMode: 'email' })}
        {text('phone', t('phone'), { max: LIMITS.phoneMax, type: 'tel', inputMode: 'tel', hint: t('phoneHint') })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={control}
          name="language"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('language')}</FormLabel>
              <Select value={field.value || NO_LANGUAGE} onValueChange={(v) => field.onChange(v === NO_LANGUAGE ? '' : v)}>
                <FormControl>
                  <SelectTrigger className="min-h-11">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={NO_LANGUAGE} className="min-h-11">
                    {t('languageNone')}
                  </SelectItem>
                  {LANGUAGES.map((code) => (
                    <SelectItem key={code} value={code} className="min-h-11">
                      {languageName(code, locale)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        {text('birthDate', t('birthDate'), { max: 10, type: 'date' })}
      </div>

      <fieldset className="flex flex-col gap-4 rounded-lg border p-4">
        <legend className="px-1 text-sm font-semibold">{t('address')}</legend>
        {text('street', t('street'), { max: LIMITS.streetMax })}
        <div className="grid grid-cols-[minmax(0,7rem)_1fr] gap-3">
          {text('postalCode', t('postalCode'), { max: LIMITS.postalCodeMax })}
          {text('city', t('city'), { max: LIMITS.cityMax })}
        </div>
        <FormField
          control={control}
          name="addressCountry"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>{t('addressCountry')}</FormLabel>
              <FormControl>
                <CountryPicker value={field.value} onChange={field.onChange} clearable invalid={Boolean(fieldState.error)} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </fieldset>

      <FormField
        control={control}
        name="marketing"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('marketing')}</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger className="min-h-11">
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value={MARKETING_NONE} className="min-h-11">
                  {tm('none')}
                </SelectItem>
                {MARKETING_SOURCES.map((source) => (
                  <SelectItem key={source} value={source} className="min-h-11">
                    {tm(source)}
                  </SelectItem>
                ))}
                <SelectItem value={MARKETING_CUSTOM} className="min-h-11">
                  {tm('custom')}
                </SelectItem>
              </SelectContent>
            </Select>
            <FormDescription>{t('marketingHint')}</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      {marketing === MARKETING_CUSTOM &&
        text('marketingCustom', t('marketingCustom'), { max: LIMITS.marketingCustomMax, hint: t('marketingCustomHint') })}

      <Collapsible open={companyOpen} onOpenChange={setCompanyOpen} className="rounded-lg border">
        <CollapsibleTrigger className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-2 text-left">
          <span className="flex flex-col">
            <span className="text-sm font-semibold">{t('company')}</span>
            <span className="text-[13px] text-ds-neutral-700">{t('companyHint')}</span>
          </span>
          <CaretDown size={16} aria-hidden="true" className={companyOpen ? 'rotate-180 transition-transform' : 'transition-transform'} />
        </CollapsibleTrigger>
        <CollapsibleContent className="flex flex-col gap-4 px-4 pb-4">
          {text('companyName', t('companyName'), { max: LIMITS.companyNameMax })}
          {text('companyVatId', t('vatId'), { max: LIMITS.vatIdMax })}
          <FormField
            control={control}
            name="companyBillingAddress"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('billingAddress')}</FormLabel>
                <FormControl>
                  <Textarea rows={3} maxLength={LIMITS.billingAddressMax} {...field} />
                </FormControl>
                <FormDescription>{t('billingAddressHint')}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </CollapsibleContent>
      </Collapsible>

      <FormField
        control={control}
        name="note"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('note')}</FormLabel>
            <FormControl>
              <Textarea rows={3} maxLength={LIMITS.noteMax} {...field} />
            </FormControl>
            <FormDescription>{t('noteHint')}</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
