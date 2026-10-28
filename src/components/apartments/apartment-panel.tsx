'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { type Resolver, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'

import {
  createApartment,
  deleteApartment,
  setApartmentArchived,
  updateApartment,
} from '@/app/(app)/einstellungen/wohnungen/actions'
import { PropertyFields } from '@/components/apartments/property-fields'
import { callAction, FormError } from '@/components/auth/form-error'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { DetailPanel } from '@/components/detail-panel'
import { useTeamAction } from '@/components/settings/use-team-action'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AmountInput } from '@/components/amount-input'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  APARTMENT_DEFAULTS,
  type Apartment,
  apartmentLabel,
  LIMITS,
  type Municipality,
  PRICE_MODES,
  type PriceMode,
  priceInput,
  type Property,
} from '@/lib/apartments'
import { type ApartmentInput, NEW_PROPERTY, withExistingProperty, withNewProperty } from '@/lib/validation/apartments'

type FormValues = {
  propertyId: string
  newProperty?: { name: string; street: string; postalCode: string; city: string; municipalityCode: string }
  name: string
  maxGuests: string
  maxAdults: string
  kind: 'holiday' | 'service'
  priceMode: PriceMode
  price: string
  adultPrice: string
  childPrices: { toAge: string; price: string }[]
  cleaningFee: string
  checkIn: string
  checkOut: string
  note: string
}

const EMPTY_PROPERTY = { name: '', street: '', postalCode: '', city: '', municipalityCode: '' }

interface ApartmentPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  properties: Property[]
  // Bearbeiten: die Wohnung; Anlegen: null (optional mit vorgewähltem Objekt)
  apartment: Apartment | null
  presetPropertyId?: string
}

// Detail-Panel „Wohnung anlegen / bearbeiten“ (PROJ-6). Beim Anlegen lässt sich ein neues Objekt mit Adresse und
// Gemeinde im selben Formular erfassen; beim Bearbeiten kann die Wohnung in ein anderes Objekt verschoben werden.
export function ApartmentPanel({ open, onOpenChange, properties, apartment, presetPropertyId }: ApartmentPanelProps) {
  const t = useTranslations('apartments')
  const tv = useTranslations('apartments.validation')
  const router = useRouter()
  const editing = apartment !== null
  const [error, setError] = useState<string | null>(null)
  const [municipality, setMunicipality] = useState<Municipality | null>(null)
  const [confirming, setConfirming] = useState<'archive' | 'delete' | null>(null)
  const { run, pending } = useTeamAction('apartments.errors')

  const defaults: FormValues = apartment
    ? {
        propertyId: apartment.propertyId,
        name: apartment.name,
        maxGuests: String(apartment.maxGuests),
        maxAdults: apartment.maxAdults === null ? '' : String(apartment.maxAdults),
        kind: apartment.kind,
        priceMode: apartment.priceMode,
        price: priceInput(apartment.priceCents),
        adultPrice: priceInput(apartment.adultPriceCents),
        childPrices: apartment.childPrices.map((c) => ({ toAge: String(c.toAge), price: priceInput(c.priceCents) })),
        cleaningFee: priceInput(apartment.cleaningFeeCents),
        checkIn: apartment.checkIn,
        checkOut: apartment.checkOut,
        note: apartment.note ?? '',
      }
    : {
        propertyId: presetPropertyId ?? (properties.length === 0 ? NEW_PROPERTY : ''),
        newProperty: EMPTY_PROPERTY,
        name: '',
        maxGuests: '',
        maxAdults: '',
        kind: APARTMENT_DEFAULTS.kind,
        priceMode: 'apartment',
        price: '',
        adultPrice: '',
        childPrices: [],
        cleaningFee: '',
        checkIn: APARTMENT_DEFAULTS.checkIn,
        checkOut: APARTMENT_DEFAULTS.checkOut,
        note: '',
      }

  // Die Objektangaben werden nur geprüft, wenn „Neues Objekt“ gewählt ist; der Server erhält die Rohwerte
  const resolveNew = zodResolver(withNewProperty(tv), undefined, { raw: true })
  const resolveExisting = zodResolver(withExistingProperty(tv), undefined, { raw: true })
  // Bei bestehendem Objekt die (leeren) Felder für „Neues Objekt“ nicht mitprüfen
  const resolver: Resolver<FormValues> = (values, context, options) =>
    values.propertyId === NEW_PROPERTY
      ? (resolveNew(values as never, context, options as never) as never)
      : (resolveExisting({ ...values, newProperty: undefined } as never, context, options as never) as never)
  const form = useForm<FormValues>({ resolver, defaultValues: defaults })
  const isNew = useWatch({ control: form.control, name: 'propertyId' }) === NEW_PROPERTY
  const childPrices = useFieldArray({ control: form.control, name: 'childPrices' })
  const priceMode = useWatch({ control: form.control, name: 'priceMode' })
  // Künftige Buchungen mit mehr Personen bzw. Erwachsenen als eingegeben (nur Hinweis, PROJ-8/27)
  const maxGuests = Number(useWatch({ control: form.control, name: 'maxGuests' }))
  const maxAdults = Number(useWatch({ control: form.control, name: 'maxAdults' }))
  const tooLarge = apartment && maxGuests > 0 ? apartment.futureStays.filter((s) => s.persons > maxGuests).length : 0
  const tooManyAdults = apartment && maxAdults > 0 ? apartment.futureStays.filter((s) => s.adults > maxAdults).length : 0
  const property = properties.find((p) => p.id === (apartment?.propertyId ?? ''))
  const title = apartment && property ? apartmentLabel(property.name, apartment.name) : t('panel.createTitle')

  async function onSubmit(values: FormValues) {
    setError(null)
    const input = { ...values, newProperty: values.propertyId === NEW_PROPERTY ? values.newProperty : undefined } as ApartmentInput
    const result = await callAction(() => (apartment ? updateApartment({ id: apartment.id, ...input }) : createApartment(input)))
    if (!result.ok) {
      if (result.error === 'duplicateApartmentName') form.setError('name', { message: t('errors.duplicateApartmentName') })
      else if (result.error === 'duplicatePropertyName') form.setError('newProperty.name', { message: t('errors.duplicatePropertyName') })
      else setError(result.error)
      return
    }
    toast.success(apartment ? t('done.saved') : t('done.created', { name: values.name.trim() }))
    onOpenChange(false)
    router.refresh()
  }

  async function confirm(action: 'archive' | 'delete') {
    if (!apartment) return
    setConfirming(null)
    const ok =
      action === 'archive'
        ? await run(() => setApartmentArchived({ id: apartment.id, archived: true }), t('done.archived', { name: apartment.name }))
        : await run(() => deleteApartment({ id: apartment.id }), t('done.deleted', { name: apartment.name }))
    if (ok) onOpenChange(false)
  }

  async function restore() {
    if (!apartment) return
    if (await run(() => setApartmentArchived({ id: apartment.id, archived: false }), t('done.restored', { name: apartment.name }))) {
      onOpenChange(false)
    }
  }

  return (
    <DetailPanel
      open={open}
      onOpenChange={onOpenChange}
      title={editing ? title : t('panel.createTitle')}
      description={editing ? undefined : t('panel.description')}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
          <FormError error={error} namespace="apartments.errors" />
          {apartment?.archivedAt && (
            <Alert className="border-ds-neutral-400 bg-ds-surface">
              <AlertDescription>{t('panel.archivedNote')}</AlertDescription>
            </Alert>
          )}

          <FormField
            control={form.control}
            name="propertyId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('panel.property')}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="min-h-11">
                      <SelectValue placeholder={t('panel.propertyPlaceholder')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {properties.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="min-h-11">
                        {p.name}
                      </SelectItem>
                    ))}
                    {!editing && (
                      <SelectItem value={NEW_PROPERTY} className="min-h-11 font-semibold">
                        {t('panel.newProperty')}
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {isNew && (
            <fieldset className="flex flex-col gap-4 rounded-lg border p-4">
              <legend className="px-1 text-sm font-semibold">{t('panel.newProperty')}</legend>
              <PropertyFields prefix="newProperty." municipality={municipality} onMunicipality={setMunicipality} />
            </fieldset>
          )}

          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('panel.name')}</FormLabel>
                <FormControl>
                  <Input autoComplete="off" maxLength={LIMITS.nameMax} className="min-h-11" {...field} />
                </FormControl>
                <FormDescription>{t('panel.nameHint')}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="maxGuests"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('panel.maxGuests')}</FormLabel>
                <FormControl>
                  <Input type="number" inputMode="numeric" min={LIMITS.guestsMin} max={LIMITS.guestsMax} className="min-h-11 w-32" {...field} />
                </FormControl>
                {tooLarge > 0 && <FormDescription className="text-ds-accent-2-800">{t('panel.capacityHint', { count: tooLarge })}</FormDescription>}
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="maxAdults"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('panel.maxAdults')}</FormLabel>
                <FormControl>
                  <Input type="number" inputMode="numeric" min={LIMITS.guestsMin} max={LIMITS.guestsMax} className="min-h-11 w-32" {...field} />
                </FormControl>
                <FormDescription>{t('panel.maxAdultsHint')}</FormDescription>
                {tooManyAdults > 0 && (
                  <FormDescription className="text-ds-accent-2-800">{t('panel.capacityAdultsHint', { count: tooManyAdults })}</FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="kind"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('panel.kind')}</FormLabel>
                <FormControl>
                  <RadioGroup value={field.value} onValueChange={field.onChange} className="flex flex-wrap gap-3">
                    {(['holiday', 'service'] as const).map((kind) => (
                      <div key={kind} className="flex min-h-11 items-center gap-2 rounded-md border px-3">
                        <RadioGroupItem value={kind} id={`art-${kind}`} />
                        <Label htmlFor={`art-${kind}`} className="cursor-pointer font-normal">
                          {t(`kind.${kind}`)}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <fieldset className="flex flex-col gap-4 rounded-lg border p-4">
            <legend className="px-1 text-sm font-semibold">{t('panel.priceSection')}</legend>
            <p className="-mt-1 text-[13px] text-ds-neutral-800">{t('panel.priceSectionHint')}</p>
            <FormField
              control={form.control}
              name="priceMode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('panel.priceMode')}</FormLabel>
                  <FormControl>
                    <RadioGroup value={field.value} onValueChange={field.onChange} className="flex flex-wrap gap-3">
                      {PRICE_MODES.map((mode) => (
                        <div key={mode} className="flex min-h-11 items-center gap-2 rounded-md border px-3">
                          <RadioGroupItem value={mode} id={`preisart-${mode}`} />
                          <Label htmlFor={`preisart-${mode}`} className="cursor-pointer font-normal">
                            {t(`priceMode.${mode}`)}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {priceMode === 'apartment' ? (
              <FormField
                control={form.control}
                name="price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('panel.price')}</FormLabel>
                    <FormControl>
                      <AmountInput className="min-h-11 w-40" {...field} onValueChange={field.onChange} />
                    </FormControl>
                    <FormDescription>{t('panel.priceHint')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : (
              <>
                <FormField
                  control={form.control}
                  name="adultPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('panel.adultPrice')}</FormLabel>
                      <FormControl>
                        <AmountInput className="min-h-11 w-40" {...field} onValueChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex flex-col gap-3">
                  <span className="text-sm font-semibold">{t('panel.childPrices')}</span>
                  <p className="-mt-2 text-[13px] text-ds-neutral-800">{t('panel.childPricesHint')}</p>
                  {childPrices.fields.map((tier, i) => (
                    <div key={tier.id} className="grid grid-cols-[1fr_1fr_auto] items-start gap-2">
                      <FormField
                        control={form.control}
                        name={`childPrices.${i}.toAge`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[13px] font-normal">{t('panel.childToAge', { n: i + 1 })}</FormLabel>
                            <FormControl>
                              <Input type="number" inputMode="numeric" min={0} max={LIMITS.childAgeMax} className="min-h-11" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name={`childPrices.${i}.price`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-[13px] font-normal">{t('panel.childPrice', { n: i + 1 })}</FormLabel>
                            <FormControl>
                              <AmountInput className="min-h-11" {...field} onValueChange={field.onChange} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="mt-6 size-11"
                        aria-label={t('panel.removeChildPrice', { n: i + 1 })}
                        onClick={() => childPrices.remove(i)}
                      >
                        <Trash size={18} aria-hidden="true" />
                      </Button>
                    </div>
                  ))}
                  {childPrices.fields.length < LIMITS.childPricesMax && (
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11 self-start"
                      onClick={() => childPrices.append({ toAge: '', price: '' }, { shouldFocus: true })}
                    >
                      <Plus size={16} aria-hidden="true" />
                      {t('panel.addChildPrice')}
                    </Button>
                  )}
                </div>
              </>
            )}
            <FormField
              control={form.control}
              name="cleaningFee"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('panel.cleaningFee')}</FormLabel>
                  <FormControl>
                    <AmountInput className="min-h-11 w-40" {...field} onValueChange={field.onChange} />
                  </FormControl>
                  <FormDescription>{t('panel.cleaningFeeHint')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
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

          <Button type="submit" disabled={form.formState.isSubmitting} aria-busy={form.formState.isSubmitting} className="min-h-11">
            {editing ? t('panel.save') : t('panel.createSubmit')}
          </Button>

          {apartment && (
            <div className="flex flex-wrap gap-3 border-t pt-5">
              {apartment.archivedAt ? (
                <Button type="button" variant="outline" className="min-h-11" disabled={pending} onClick={restore}>
                  {t('panel.restore')}
                </Button>
              ) : (
                <Button type="button" variant="outline" className="min-h-11" disabled={pending} onClick={() => setConfirming('archive')}>
                  {t('panel.archive')}
                </Button>
              )}
              {apartment.hasBookings ? (
                <p className="w-full text-sm text-ds-neutral-800">{t('panel.hasBookingsHint')}</p>
              ) : (
                <Button type="button" variant="ghost" className="min-h-11 text-ds-accent-2-700" disabled={pending} onClick={() => setConfirming('delete')}>
                  {t('panel.delete')}
                </Button>
              )}
            </div>
          )}
        </form>
      </Form>

      {apartment && confirming && (
        <ConfirmDialog
          open
          onOpenChange={(next) => !next && setConfirming(null)}
          title={t(`confirm.${confirming}Title`, { name: apartment.name })}
          text={
            confirming === 'archive' && apartment.futureStays.length > 0
              ? `${t('confirm.archiveText')} ${t('confirm.archiveFuture', { count: apartment.futureStays.length })}`
              : t(`confirm.${confirming}Text`)
          }
          confirmLabel={t(confirming === 'archive' ? 'panel.archive' : 'panel.delete')}
          cancelLabel={t('confirm.cancel')}
          onConfirm={() => confirm(confirming)}
        />
      )}
    </DetailPanel>
  )
}
