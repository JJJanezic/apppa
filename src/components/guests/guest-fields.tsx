'use client'

import { CaretDown } from '@phosphor-icons/react'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'

import { CountryPicker } from '@/components/guests/country-picker'
import { DocumentImageField } from '@/components/guests/document-image-field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  DOCUMENT_SIDES,
  DOCUMENT_TYPES,
  type DocumentSide,
  GENDERS,
  type Guest,
  LANGUAGES,
  languageName,
  LIMITS,
  MARKETING_CUSTOM,
  MARKETING_NONE,
  MARKETING_SOURCES,
} from '@/lib/guests'
import type { GuestInput } from '@/lib/validation/guests'

// Leerer Sprachwert im Select (Radix erlaubt keinen leeren String als Wert)
const NO_LANGUAGE = '__keine'
const NO_DOCUMENT_TYPE = '__keine'

const PATH_FIELD: Record<DocumentSide, 'documentFrontPath' | 'documentBackPath'> = { front: 'documentFrontPath', back: 'documentBackPath' }

interface GuestFieldsProps {
  // Abruf-Links der gespeicherten Ausweisbilder (Bearbeiten eines Gastes, PROJ-29)
  documentImages?: Guest['documentImages']
}

// Felder eines Gastes (PROJ-7). Wiederverwendbar: Gast-Panel und später das Buchungsformular (PROJ-8).
// Muss innerhalb eines react-hook-form <Form> mit GuestInput-Werten stehen.
export function GuestFields({ documentImages = {} }: GuestFieldsProps) {
  const t = useTranslations('guests.panel')
  const tm = useTranslations('guests.marketing')
  const tg = useTranslations('guests.gender')
  const td = useTranslations('guests.document')
  const tdt = useTranslations('guests.documentType')
  const locale = useLocale()
  const { control, getValues, formState } = useFormContext<GuestInput>()
  const marketing = useWatch({ control, name: 'marketing' })
  const [documentType, frontPath, backPath] = useWatch({ control, name: ['documentType', 'documentFrontPath', 'documentBackPath'] })
  const initial = formState.defaultValues
  // Reisedokument aufgeklappt, wenn schon Angaben oder Bilder vorhanden sind
  const [documentOpen, setDocumentOpen] = useState(() => {
    const v = getValues()
    return Boolean(
      v.documentType || v.documentNumber || v.documentIssuedOn || v.documentAuthority || v.documentCountry || v.documentFrontPath || v.documentBackPath
    )
  })
  // Fehler im zugeklappten Abschnitt (z. B. Art/Nummer fehlen) sichtbar machen
  const documentError = Boolean(formState.errors.documentType || formState.errors.documentNumber || formState.errors.documentIssuedOn)
  // Hinweis: Art geändert, die bisherigen Bilder gehören womöglich zum alten Dokument (Spec, Edge Cases)
  const oldImagesKept =
    Boolean(initial?.documentType && documentType && documentType !== initial.documentType) &&
    ((Boolean(initial?.documentFrontPath) && frontPath === initial?.documentFrontPath) ||
      (Boolean(initial?.documentBackPath) && backPath === initial?.documentBackPath))
  // Firma aufgeklappt, wenn schon Firmenangaben vorhanden sind
  const [companyOpen, setCompanyOpen] = useState(() => {
    const v = getValues()
    return Boolean(
      v.companyName || v.companyVatId || v.companyAddressLine1 || v.companyAddressLine2 || v.companyPostalCode || v.companyCity || v.companyCountry
    )
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

      <div className="grid gap-4 sm:grid-cols-2">
        {text('titlePrefix', t('titlePrefix'), { max: LIMITS.titleMax, hint: t('titlePrefixHint') })}
        {text('titleSuffix', t('titleSuffix'), { max: LIMITS.titleMax, hint: t('titleSuffixHint') })}
      </div>

      <FormField
        control={control}
        name="gender"
        render={({ field }) => (
          <FormItem className="sm:max-w-[calc(50%-0.5rem)]">
            <FormLabel>{t('gender')}</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <FormControl>
                <SelectTrigger className="min-h-11">
                  <SelectValue />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {GENDERS.map((g) => (
                  <SelectItem key={g} value={g} className="min-h-11">
                    {tg(g)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

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
          <fieldset className="flex flex-col gap-4">
            <legend className="text-sm font-semibold">{t('billingAddress')}</legend>
            <p className="-mt-2 text-[13px] text-ds-neutral-700">{t('billingAddressHint')}</p>
            {text('companyAddressLine1', t('addressLine1'), { max: LIMITS.companyAddressLineMax })}
            {text('companyAddressLine2', t('addressLine2'), { max: LIMITS.companyAddressLineMax })}
            <div className="grid gap-4 sm:grid-cols-[minmax(0,7rem)_1fr]">
              {text('companyPostalCode', t('postalCode'), { max: LIMITS.companyPostalCodeMax })}
              {text('companyCity', t('city'), { max: LIMITS.companyCityMax })}
            </div>
            <FormField
              control={control}
              name="companyCountry"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>{t('companyCountry')}</FormLabel>
                  <FormControl>
                    <CountryPicker value={field.value} onChange={field.onChange} clearable invalid={Boolean(fieldState.error)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </fieldset>
        </CollapsibleContent>
      </Collapsible>

      <Collapsible open={documentOpen || documentError} onOpenChange={setDocumentOpen} className="rounded-lg border">
        <CollapsibleTrigger className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-2 text-left">
          <span className="flex flex-col">
            <span className="text-sm font-semibold">{td('title')}</span>
            <span className="text-[13px] text-ds-neutral-700">{td('hint')}</span>
          </span>
          <CaretDown size={16} aria-hidden="true" className={documentOpen || documentError ? 'rotate-180 transition-transform' : 'transition-transform'} />
        </CollapsibleTrigger>
        <CollapsibleContent className="flex flex-col gap-4 px-4 pb-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={control}
              name="documentType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{td('type')}</FormLabel>
                  <Select value={field.value || NO_DOCUMENT_TYPE} onValueChange={(v) => field.onChange(v === NO_DOCUMENT_TYPE ? '' : v)}>
                    <FormControl>
                      <SelectTrigger className="min-h-11">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_DOCUMENT_TYPE} className="min-h-11">
                        {td('typeNone')}
                      </SelectItem>
                      {DOCUMENT_TYPES.map((type) => (
                        <SelectItem key={type} value={type} className="min-h-11">
                          {tdt(type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {text('documentNumber', td('number'), { max: LIMITS.documentNumberMax })}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {text('documentIssuedOn', td('issuedOn'), { max: 10, type: 'date' })}
            {text('documentAuthority', td('authority'), { max: LIMITS.documentAuthorityMax, hint: td('authorityHint') })}
          </div>
          <FormField
            control={control}
            name="documentCountry"
            render={({ field, fieldState }) => (
              <FormItem>
                <FormLabel>{td('country')}</FormLabel>
                <FormControl>
                  <CountryPicker value={field.value} onChange={field.onChange} clearable invalid={Boolean(fieldState.error)} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {oldImagesKept && (
            <Alert className="border-ds-accent-700/40 bg-ds-accent-100">
              <AlertDescription>{td('typeChangedHint')}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            {DOCUMENT_SIDES.map((side) => {
              const savedPath = initial?.[PATH_FIELD[side]]
              const savedImage = documentImages[side]
              return (
                <FormField
                  key={side}
                  control={control}
                  name={PATH_FIELD[side]}
                  render={({ field, fieldState }) => (
                    <FormItem>
                      <DocumentImageField
                        side={side}
                        value={field.value}
                        onChange={field.onChange}
                        saved={savedPath && savedImage ? { path: savedPath, image: savedImage } : undefined}
                        invalid={Boolean(fieldState.error)}
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )
            })}
          </div>
          <p className="text-[13px] text-ds-neutral-700">{td('imagesHint')}</p>
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
