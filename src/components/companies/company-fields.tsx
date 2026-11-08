'use client'

import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import { useFormContext } from 'react-hook-form'

import { CountryPicker } from '@/components/guests/country-picker'
import { PostalPlaceFields } from '@/components/guests/postal-place-fields'
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { COMPANY_LIMITS } from '@/lib/companies'
import type { CompanyInput } from '@/lib/validation/companies'

interface CompanyFieldsProps {
  // Hinweis unter dem Firmennamen (z. B. „Diese Firma gibt es bereits“ im Gastformular)
  nameHint?: ReactNode
}

// Felder einer Firma (PROJ-50): Firmen-Panel und „Neue Firma“ im Gastformular. Muss innerhalb eines react-hook-form <Form>
// mit den Firmenfeldern (Präfix „company“) stehen. PLZ füllt Ort und Staat wie in der Gastanschrift (PROJ-48).
export function CompanyFields({ nameHint }: CompanyFieldsProps) {
  const t = useTranslations('companies.fields')
  const { control } = useFormContext<CompanyInput>()

  const text = (
    name: keyof CompanyInput,
    label: string,
    opts: { max: number; hint?: string; type?: string; inputMode?: 'email' | 'url'; required?: boolean; after?: ReactNode }
  ) => (
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
              autoComplete="off"
              maxLength={opts.max}
              aria-required={opts.required || undefined}
              className="min-h-11"
              {...field}
            />
          </FormControl>
          {opts.hint && <FormDescription>{opts.hint}</FormDescription>}
          <FormMessage />
          {opts.after}
        </FormItem>
      )}
    />
  )

  return (
    <div className="flex flex-col gap-4">
      {text('companyName', t('name'), { max: COMPANY_LIMITS.nameMax, required: true, after: nameHint })}
      {text('companyVatId', t('vatId'), { max: COMPANY_LIMITS.vatIdMax })}
      <fieldset className="flex flex-col gap-4">
        <legend className="text-sm font-semibold">{t('billingAddress')}</legend>
        {text('companyAddressLine1', t('addressLine1'), { max: COMPANY_LIMITS.addressLineMax })}
        {text('companyAddressLine2', t('addressLine2'), { max: COMPANY_LIMITS.addressLineMax })}
        <PostalPlaceFields
          postalName="companyPostalCode"
          cityName="companyCity"
          countryName="companyCountry"
          postalLabel={t('postalCode')}
          cityLabel={t('city')}
          postalMax={COMPANY_LIMITS.postalCodeMax}
          cityMax={COMPANY_LIMITS.cityMax}
          gridClassName="grid gap-4 sm:grid-cols-[minmax(0,7rem)_1fr]"
        />
        <FormField
          control={control}
          name="companyCountry"
          render={({ field, fieldState }) => (
            <FormItem>
              <FormLabel>{t('country')}</FormLabel>
              <FormControl>
                <CountryPicker value={field.value} onChange={field.onChange} clearable invalid={Boolean(fieldState.error)} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        {text('companyEmail', t('email'), { max: COMPANY_LIMITS.emailMax, type: 'email', inputMode: 'email' })}
        {text('companyWebsite', t('website'), { max: COMPANY_LIMITS.websiteMax, inputMode: 'url', hint: t('websiteHint') })}
      </div>
      {text('companyContact', t('contact'), { max: COMPANY_LIMITS.contactMax, hint: t('contactHint') })}
    </div>
  )
}
