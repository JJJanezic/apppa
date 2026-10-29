'use client'

import { WarningCircle } from '@phosphor-icons/react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { adminUpdateTenantMasterData } from '@/app/(app)/betreiber/actions'
import { updateTenantMasterData } from '@/app/(app)/einstellungen/actions'
import { callAction, FormError } from '@/components/auth/form-error'
import { CountryPicker } from '@/components/guests/country-picker'
import { VatStatusFields } from '@/components/tenant/vat-status-fields'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { DEFAULT_TENANT_COUNTRY, MASTER_DATA_LIMITS as L, type TenantMasterData } from '@/lib/tenant-master-data'
import { tenantMasterDataSchema, type TenantMasterDataInput } from '@/lib/validation/tenant'

const toInput = (d: TenantMasterData): TenantMasterDataInput => ({
  name: d.name,
  nameLine2: d.nameLine2 ?? '',
  addressLine1: d.addressLine1 ?? '',
  addressLine2: d.addressLine2 ?? '',
  postalCode: d.postalCode ?? '',
  city: d.city ?? '',
  country: d.country ?? DEFAULT_TENANT_COUNTRY,
  vatId: d.vatId ?? '',
  taxNumber: d.taxNumber ?? '',
  registerNumber: d.registerNumber ?? '',
  vatStatus: d.vatStatus.map((c) => ({ validFrom: c.validFrom, status: c.smallBusiness ? 'small' : 'regular' })),
})

interface TenantMasterDataFormProps {
  data: TenantMasterData
  // owner: Einstellungen → Kunde (eigener Kunde); operator: Kunden-Detailseite des Betreibers
  mode: 'owner' | 'operator'
  readOnly?: boolean
}

// Stammdaten eines Kunden (PROJ-28), gleich für Inhaber und Betreiber.
// Die Seite setzt key={data.updatedAt}: Nach „Aktuelle Fassung laden“ startet das Formular mit dem neuen Stand.
export function TenantMasterDataForm({ data, mode, readOnly = false }: TenantMasterDataFormProps) {
  const t = useTranslations('tenantData')
  const tv = useTranslations('tenantData.validation')
  const router = useRouter()
  const schema = useMemo(() => tenantMasterDataSchema(tv), [tv])
  // raw: Die Aktion bekommt die Eingaben, der Server prüft und bereinigt sie selbst noch einmal
  const form = useForm<TenantMasterDataInput>({
    resolver: zodResolver(schema, undefined, { raw: true }),
    defaultValues: toInput(data),
  })
  const [error, setError] = useState<string | null>(null)
  const [stale, setStale] = useState(false)

  async function onSubmit(values: TenantMasterDataInput) {
    setError(null)
    const payload = { ...values, tenantId: data.id, updatedAt: data.updatedAt }
    const result = await callAction(() =>
      mode === 'operator' ? adminUpdateTenantMasterData(payload) : updateTenantMasterData(payload)
    )
    if (!result.ok) {
      if (result.error === 'staleTenant') setStale(true)
      else setError(result.error)
      return
    }
    toast.success(t('saved'))
    router.refresh()
  }

  const text = (
    name: Exclude<keyof TenantMasterDataInput, 'country' | 'vatStatus'>,
    max: number,
    opts: { hint?: string; autoComplete?: string } = {}
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t(`fields.${name}`)}</FormLabel>
          <FormControl>
            <Input maxLength={max} autoComplete={opts.autoComplete ?? 'off'} className="min-h-11" {...field} />
          </FormControl>
          {opts.hint && <FormDescription>{opts.hint}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex max-w-[640px] flex-col gap-6">
        <FormError error={error} namespace="tenantData.errors" />
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
        {readOnly && <p className="text-ds-neutral-800">{t('readOnlyHint')}</p>}

        {/* Deaktivierter Kunde: alle Felder samt Länderauswahl gesperrt */}
        <fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-col gap-4">
            {text('name', L.nameMax, { hint: t('fields.nameHint'), autoComplete: 'organization' })}
            {text('nameLine2', L.lineMax, { hint: t('fields.nameLine2Hint') })}
          </div>

          <div className="flex flex-col gap-4">
            <h3 className="text-lg">{t('sections.address')}</h3>
            {text('addressLine1', L.lineMax, { autoComplete: 'address-line1' })}
            {text('addressLine2', L.lineMax, { autoComplete: 'address-line2' })}
            <div className="grid grid-cols-[minmax(0,7rem)_1fr] gap-3">
              {text('postalCode', L.postalCodeMax, { autoComplete: 'postal-code' })}
              {text('city', L.cityMax, { autoComplete: 'address-level2' })}
            </div>
            <FormField
              control={form.control}
              name="country"
              render={({ field, fieldState }) => (
                <FormItem>
                  <FormLabel>{t('fields.country')}</FormLabel>
                  <FormControl>
                    <CountryPicker value={field.value} onChange={field.onChange} clearable invalid={Boolean(fieldState.error)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="flex flex-col gap-4">
            <h3 className="text-lg">{t('sections.numbers')}</h3>
            {/* UID: etwas Spielraum für Leerzeichen, die beim Speichern entfernt werden */}
            {text('vatId', 20, { hint: t('fields.vatIdHint') })}
            <div className="grid gap-4 sm:grid-cols-2">
              {text('taxNumber', L.numberMax)}
              {text('registerNumber', L.numberMax, { hint: t('fields.registerNumberHint') })}
            </div>
          </div>

          <VatStatusFields control={form.control} saved={data.vatStatus} readOnly={readOnly} />
        </fieldset>

        {!readOnly && (
          <Button type="submit" disabled={form.formState.isSubmitting} className="min-h-11 self-start">
            {t('save')}
          </Button>
        )}
      </form>
    </Form>
  )
}
