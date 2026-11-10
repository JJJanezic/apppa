'use client'

import { Plus, Trash } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'
import { useFieldArray, useFormContext, useWatch } from 'react-hook-form'

import { CountryPicker } from '@/components/guests/country-picker'
import { DocumentImageField } from '@/components/guests/document-image-field'
import { IdReadingButton } from '@/components/id-reading/id-reading-button'
import { PostalPlaceFields } from '@/components/guests/postal-place-fields'
import { Button } from '@/components/ui/button'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatDate } from '@/lib/format'
import { needsTravelDocument, type SheetGaps } from '@/lib/guest-sheet'
import { DOCUMENT_TYPES, GENDERS, LIMITS } from '@/lib/guests'
import { ID_FIELDS, type IdCurrentValues, type IdField } from '@/lib/id-reading'
import { cn } from '@/lib/utils'
import type { SheetForm } from '@/components/guest-sheets/signing/sheet-form'

interface SheetPageOneProps {
  tenantName: string
  // Lfd.-Nr. der Buchung (null = wird beim „Fertig“ vergeben) und Kennzahl der Gemeinde, beide nur lesen (Erweiterung 2026-11-09)
  sheetNumber: string | null
  establishmentNumber: string | null
  stay: { arrival: string; plannedDeparture: string; persons: number }
  gaps: SheetGaps
  // nach jeder Auswahl in Listen sofort speichern (Textfelder speichern beim Verlassen)
  onCommit: () => void
  // Hinweis am Reisedokument: wird erst mit Art und Nummer gespeichert
  documentWaiting: boolean
  // Ausweisbilder beim Öffnen schon hinterlegt? Fehlende Seiten lassen sich auf dem Blatt aufnehmen
  imagesOnFile: { front: boolean; back: boolean }
  // „Ausweis auslesen“ (PROJ-51): übernommene Werte werden sofort gespeichert
  idReading: { tenantId: string; guestId: string; bookingId: string; onApply: (values: Partial<Record<IdField, string>>, readingId: string) => void }
}

// Fehlende Angabe: deutlich rot umrandet (Rückmeldung nach dem Deploy)
const MISSING = 'border-2 border-red-600 bg-red-50 focus-visible:ring-red-600'
const MISSING_HINT = 'text-[13px] font-semibold text-red-700'

type TextName = Exclude<
  keyof SheetForm,
  'gender' | 'companions' | 'country' | 'documentType' | 'documentCountry' | 'addressCountry' | 'documentFrontPath' | 'documentBackPath'
>

// Seite 1 „Meldedaten“ des Gästeblatts (PROJ-26): Aufbau wie das amtliche Gästeverzeichnisblatt (ohne Reisegruppen).
// Fehlende Pflichtangaben sind markiert und per Tastatur ergänzbar.
export function SheetPageOne({ tenantName, sheetNumber, establishmentNumber, stay, gaps, onCommit, documentWaiting, imagesOnFile, idReading }: SheetPageOneProps) {
  const t = useTranslations('guestSheets.signing')
  const tg = useTranslations('guests.gender')
  const tdt = useTranslations('guests.documentType')
  const { control, getValues } = useFormContext<SheetForm>()
  const country = useWatch({ control, name: 'country' })
  const [frontPath, backPath] = useWatch({ control, name: ['documentFrontPath', 'documentBackPath'] })
  const companions = useFieldArray({ control, name: 'companions' })
  const missing = new Set<string>(gaps.guest)
  const mark = (name: string) => missing.has(name)

  const text = (name: TextName, label: string, opts: { max: number; type?: string; autoComplete?: string } = { max: 100 }) => (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="min-w-0">
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type={opts.type ?? 'text'}
              maxLength={opts.max}
              autoComplete={opts.autoComplete ?? 'off'}
              aria-invalid={mark(name) || undefined}
              className={cn('min-h-11 bg-white', mark(name) && MISSING)}
              {...field}
            />
          </FormControl>
          {mark(name) && <p className={MISSING_HINT}>{t('fillIn')}</p>}
          <FormMessage />
        </FormItem>
      )}
    />
  )

  const countryField = (name: 'country' | 'documentCountry' | 'addressCountry', label: string) => (
    <FormField
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormItem className="min-w-0">
          <FormLabel>{label}</FormLabel>
          <div className={cn('rounded-md', mark(name) && 'bg-red-50 ring-2 ring-red-600')}>
            <FormControl>
              <CountryPicker
                value={field.value}
                onChange={(v) => {
                  field.onChange(v)
                  onCommit()
                }}
                clearable={name !== 'country'}
                invalid={Boolean(fieldState.error) || mark(name)}
              />
            </FormControl>
          </div>
          {mark(name) && <p className={MISSING_HINT}>{t('fillIn')}</p>}
          <FormMessage />
        </FormItem>
      )}
    />
  )

  return (
    <div className="flex flex-col gap-6">
      {/* Kopf wie auf dem Formular */}
      <section className="grid gap-4 rounded-lg border bg-ds-surface p-4 sm:grid-cols-[minmax(0,12rem)_minmax(0,12rem)_1fr]">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium leading-none">{t('sheetNumber')}</span>
          <p className={cn('flex min-h-11 items-center break-words', sheetNumber ? 'font-semibold' : 'text-ds-neutral-800')}>{sheetNumber ?? t('sheetNumberPending')}</p>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium leading-none">{t('kennzahl')}</span>
          <p className="flex min-h-11 items-center break-words font-semibold">{establishmentNumber ?? '–'}</p>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium leading-none">{t('establishment')}</span>
          <p className="flex min-h-11 items-center break-words font-semibold">{tenantName}</p>
        </div>
      </section>

      <section aria-labelledby="blatt-gast" className="flex flex-col gap-4 rounded-lg border bg-ds-surface p-4">
        <h2 id="blatt-gast" className="text-xl">
          {t('mainGuest')}
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          {text('lastName', t('lastName'), { max: LIMITS.nameMax, autoComplete: 'family-name' })}
          {text('firstName', t('firstName'), { max: LIMITS.nameMax, autoComplete: 'given-name' })}
        </div>
        <FormField
          control={control}
          name="gender"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('gender')}</FormLabel>
              <FormControl>
                <RadioGroup
                  value={field.value}
                  onValueChange={(v) => {
                    field.onChange(v)
                    onCommit()
                  }}
                  className="flex flex-wrap gap-x-5 gap-y-2"
                >
                  {GENDERS.map((g) => (
                    <label key={g} className="flex min-h-11 cursor-pointer items-center gap-2">
                      <RadioGroupItem value={g} className="size-5 bg-white" />
                      {tg(g)}
                    </label>
                  ))}
                </RadioGroup>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid gap-4 md:grid-cols-2">
          {text('birthDate', t('birthDate'), { max: 10, type: 'date' })}
          {countryField('country', t('nationality'))}
        </div>
      </section>

      {needsTravelDocument({ country }) && (
        <section aria-labelledby="blatt-dokument" className="flex flex-col gap-4 rounded-lg border bg-ds-surface p-4">
          <div className="flex flex-col gap-1">
            <h2 id="blatt-dokument" className="text-xl">
              {t('document')}
            </h2>
            <p className="text-sm text-ds-neutral-800">{t('documentHint')}</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={control}
              name="documentType"
              render={({ field }) => (
                <FormItem className="min-w-0">
                  <FormLabel>{t('documentType')}</FormLabel>
                  <Select
                    value={field.value || undefined}
                    onValueChange={(v) => {
                      field.onChange(v)
                      onCommit()
                    }}
                  >
                    <FormControl>
                      <SelectTrigger
                        aria-invalid={mark('documentType') || undefined}
                        className={cn('min-h-11 bg-white', mark('documentType') && MISSING)}
                      >
                        <SelectValue placeholder={t('choose')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {DOCUMENT_TYPES.map((d) => (
                        <SelectItem key={d} value={d} className="min-h-11">
                          {tdt(d)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {mark('documentType') && <p className={MISSING_HINT}>{t('fillIn')}</p>}
                  <FormMessage />
                </FormItem>
              )}
            />
            {text('documentNumber', t('documentNumber'), { max: LIMITS.documentNumberMax })}
            {text('documentIssuedOn', t('documentIssuedOn'), { max: 10, type: 'date' })}
            {text('documentAuthority', t('documentAuthority'), { max: LIMITS.documentAuthorityMax })}
            {countryField('documentCountry', t('documentCountry'))}
          </div>
          {(!imagesOnFile.front || !imagesOnFile.back) && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium leading-none">{t('documentImages')}</span>
              <p className="text-sm text-ds-neutral-800">{t('documentImagesHint')}</p>
              <div className="grid gap-4 md:grid-cols-2">
                {(['front', 'back'] as const)
                  .filter((side) => !imagesOnFile[side])
                  .map((side) => (
                    <FormField
                      key={side}
                      control={control}
                      name={side === 'front' ? 'documentFrontPath' : 'documentBackPath'}
                      render={({ field }) => (
                        <FormItem className="min-w-0">
                          <DocumentImageField side={side} value={field.value} onChange={field.onChange} />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  ))}
              </div>
            </div>
          )}
          <IdReadingButton
            tenantId={idReading.tenantId}
            place="guestSheet"
            guestId={idReading.guestId}
            bookingId={idReading.bookingId}
            frontPath={frontPath}
            backPath={backPath}
            current={() => {
              const v = getValues()
              return Object.fromEntries(ID_FIELDS.map((f) => [f, String(v[f] ?? '')])) as IdCurrentValues
            }}
            onApply={idReading.onApply}
          />
          {documentWaiting && <p className="text-sm text-ds-neutral-800">{t('documentWaiting')}</p>}
        </section>
      )}

      <section aria-labelledby="blatt-adresse" className="flex flex-col gap-4 rounded-lg border bg-ds-surface p-4">
        <div className="flex flex-col gap-1">
          <h2 id="blatt-adresse" className="text-xl">
            {t('address')}
          </h2>
          <p className="text-sm text-ds-neutral-800">{t('addressHint')}</p>
        </div>
        {text('street', t('street'), { max: LIMITS.streetMax, autoComplete: 'street-address' })}
        <PostalPlaceFields
          postalName="postalCode"
          cityName="city"
          countryName="addressCountry"
          postalLabel={t('postalCode')}
          cityLabel={t('city')}
          postalMax={LIMITS.postalCodeMax}
          cityMax={LIMITS.cityMax}
          gridClassName="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] gap-3"
          inputClassNames={{ postal: cn('bg-white', mark('postalCode') && MISSING), city: cn('bg-white', mark('city') && MISSING) }}
        />
        {(mark('postalCode') || mark('city')) && <p className={cn('-mt-2', MISSING_HINT)}>{t('fillInAddress')}</p>}
        {countryField('addressCountry', t('residenceCountry'))}
      </section>

      <section aria-labelledby="blatt-mitreisende" className="flex flex-col gap-4 rounded-lg border bg-ds-surface p-4">
        <div className="flex flex-col gap-1">
          <h2 id="blatt-mitreisende" className="text-xl">
            {t('companions')}
          </h2>
          <p className="text-sm text-ds-neutral-800">{t('companionsHint', { count: Math.max(0, stay.persons - 1) })}</p>
        </div>
        {companions.fields.length === 0 && stay.persons <= 1 && <p>{t('noCompanions')}</p>}
        {companions.fields.map((row, i) => (
          <fieldset key={row.id} className="grid gap-3 rounded-md border bg-ds-bg p-3 md:grid-cols-[1fr_1fr_12rem_auto] md:items-end">
            <legend className="sr-only">{t('companionN', { n: i + 1 })}</legend>
            {(['lastName', 'firstName', 'birthDate'] as const).map((f) => {
              const gap = gaps.companions[i]?.includes(f)
              return (
                <FormField
                  key={f}
                  control={control}
                  name={`companions.${i}.${f}`}
                  render={({ field }) => (
                    <FormItem className="min-w-0">
                      <FormLabel>{t(f === 'birthDate' ? 'birthDate' : f)}</FormLabel>
                      <FormControl>
                        <Input
                          type={f === 'birthDate' ? 'date' : 'text'}
                          maxLength={f === 'birthDate' ? 10 : LIMITS.nameMax}
                          autoComplete="off"
                          aria-invalid={gap || undefined}
                          className={cn('min-h-11 bg-white', gap && MISSING)}
                          {...field}
                        />
                      </FormControl>
                      {gap && <p className={MISSING_HINT}>{t('fillIn')}</p>}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )
            })}
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              onClick={() => {
                companions.remove(i)
                onCommit()
              }}
            >
              <Trash size={18} aria-hidden="true" />
              <span className="md:sr-only">{t('removeCompanion')}</span>
            </Button>
          </fieldset>
        ))}
        {gaps.companionsTooMany && <p className="text-sm font-semibold text-red-700">{t('tooManyCompanions')}</p>}
        {gaps.companionsMissing > 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold text-red-700">{t('companionsMissing', { count: gaps.companionsMissing })}</p>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 self-start bg-white"
              onClick={() => companions.append({ lastName: '', firstName: '', birthDate: '', taxExempt: false })}
            >
              <Plus size={18} aria-hidden="true" />
              {t('addCompanion')}
            </Button>
          </div>
        )}
      </section>

      <section aria-labelledby="blatt-aufenthalt" className="flex flex-col gap-3 rounded-lg border bg-ds-surface p-4">
        <h2 id="blatt-aufenthalt" className="text-xl">
          {t('stay')}
        </h2>
        <dl className="grid gap-3 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <dt className="text-sm text-ds-neutral-800">{t('arrival')}</dt>
            <dd className="font-semibold tabular-nums">{formatDate(stay.arrival)}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-sm text-ds-neutral-800">{t('plannedDeparture')}</dt>
            <dd className="font-semibold tabular-nums">{formatDate(stay.plannedDeparture)}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-sm text-ds-neutral-800">{t('actualDeparture')}</dt>
            <dd className="text-ds-neutral-700">{t('actualDepartureLater')}</dd>
          </div>
        </dl>
      </section>
    </div>
  )
}
