'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'

import { postalCodeMatchesMunicipality } from '@/app/(app)/einstellungen/wohnungen/actions'
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
  const mismatch = usePostalCodeMismatch(postalCode, municipality)

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
            {mismatch && municipality && (
              <p role="status" className="text-sm text-ds-accent-2-700">
                {t('postalCodeMismatch', { postalCode, municipality: municipality.name })}
              </p>
            )}
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}

// Hinweis, wenn PLZ und Gemeinde laut Gemeindeliste nicht zusammenpassen (BUG-2 aus QA); Speichern bleibt möglich
function usePostalCodeMismatch(postalCode: string, municipality: Municipality | null): boolean {
  const [result, setResult] = useState<{ key: string; mismatch: boolean } | null>(null)
  const key = municipality && /^\d{4}$/.test(postalCode) ? `${postalCode}:${municipality.code}` : null

  useEffect(() => {
    if (!key) return
    let cancelled = false
    const [plz, code] = key.split(':')
    postalCodeMatchesMunicipality({ postalCode: plz, municipalityCode: code })
      .then((r) => !cancelled && setResult({ key, mismatch: r.ok && r.data === false }))
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [key])

  return key !== null && result?.key === key && result.mismatch
}
