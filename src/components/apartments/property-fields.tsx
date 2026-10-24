'use client'

import { useTranslations } from 'next-intl'
import { useFormContext, useWatch } from 'react-hook-form'

import { MunicipalityPicker } from '@/components/apartments/municipality-picker'
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { LIMITS, type Municipality } from '@/lib/apartments'

interface PropertyFieldsProps {
  // Feldnamen im umgebenden Formular, z. B. „newProperty.“ (Wohnungs-Panel) oder „“ (Objekt-Panel)
  prefix: string
  municipality: Municipality | null
  onMunicipality: (value: Municipality) => void
}

// Angaben eines Objekts: Name, Adresse, Gemeinde (geteilt von „Wohnung anlegen“ und „Objekt bearbeiten“)
export function PropertyFields({ prefix, municipality, onMunicipality }: PropertyFieldsProps) {
  const t = useTranslations('apartments.panel')
  const form = useFormContext()
  const postalCode = String(useWatch({ control: form.control, name: `${prefix}postalCode` }) ?? '')

  return (
    <div className="flex flex-col gap-5">
      <FormField
        control={form.control}
        name={`${prefix}name`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('propertyName')}</FormLabel>
            <FormControl>
              <Input autoComplete="off" maxLength={LIMITS.nameMax} className="min-h-11" {...field} />
            </FormControl>
            <FormDescription>{t('propertyNameHint')}</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={form.control}
        name={`${prefix}street`}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('street')}</FormLabel>
            <FormControl>
              <Input autoComplete="street-address" maxLength={LIMITS.streetMax} className="min-h-11" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
      <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3">
        <FormField
          control={form.control}
          name={`${prefix}postalCode`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('postalCode')}</FormLabel>
              <FormControl>
                <Input inputMode="numeric" autoComplete="postal-code" maxLength={4} className="min-h-11" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name={`${prefix}city`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('city')}</FormLabel>
              <FormControl>
                <Input autoComplete="address-level2" maxLength={LIMITS.cityMax} className="min-h-11" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
      <FormField
        control={form.control}
        name={`${prefix}municipalityCode`}
        render={({ field, fieldState }) => (
          <FormItem>
            <FormLabel>{t('municipality')}</FormLabel>
            <FormControl>
              <MunicipalityPicker
                value={municipality}
                postalCode={postalCode}
                invalid={Boolean(fieldState.error)}
                onChange={(m) => {
                  onMunicipality(m)
                  field.onChange(m.code)
                }}
              />
            </FormControl>
            <FormDescription>{t('municipalityHint')}</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
