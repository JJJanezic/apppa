'use client'

import { Plus, Trash } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'
import { useFieldArray, useWatch, type Control } from 'react-hook-form'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { todayIso } from '@/lib/bookings'
import { formatDate } from '@/lib/format'
import type { TenantMasterDataInput } from '@/lib/validation/tenant'
import { isPlannedChange, VAT_STATUS_KEYS, vatStatusOn, type VatStatusChange } from '@/lib/vat-status'

interface VatStatusFieldsProps {
  control: Control<TenantMasterDataInput>
  // gespeicherter Verlauf; daraus die Zeile „Aktuell“ (nicht aus den ungespeicherten Eingaben)
  saved: VatStatusChange[]
  readOnly: boolean
}

// Bereich „Umsatzsteuer“ im Stammdaten-Formular (PROJ-36): aktueller Status und Verlauf der Wechsel.
// Gespeichert wird mit dem übrigen Formular. Neue Zeilen kommen oben dazu; die Reihenfolge springt beim
// Bearbeiten nicht, sortiert wird erst nach dem Speichern (Seite lädt neu).
export function VatStatusFields({ control, saved, readOnly }: VatStatusFieldsProps) {
  const t = useTranslations('tenantData.vat')
  const rows = useFieldArray({ control, name: 'vatStatus' })
  const values = useWatch({ control, name: 'vatStatus' })
  const today = todayIso()
  const current = vatStatusOn(saved, today)

  const currentText = current.smallBusiness
    ? t('currentSmall', { date: formatDate(current.since!) })
    : current.since
      ? t('currentRegularSince', { date: formatDate(current.since) })
      : t('currentRegular')

  function add() {
    // Vorbelegung: das Gegenteil des heutigen Status, Datum leer
    rows.prepend({ validFrom: '', status: current.smallBusiness ? 'regular' : 'small' }, { shouldFocus: true })
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-lg">{t('title')}</h3>
      <p className="font-medium">{currentText}</p>
      {rows.fields.length === 0 ? (
        <p className="text-ds-neutral-800">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-3" aria-label={t('listLabel')}>
          {rows.fields.map((row, i) => {
            const validFrom = values?.[i]?.validFrom ?? ''
            return (
              <li
                key={row.id}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-2 gap-y-3 rounded-lg border p-3 sm:grid-cols-[11rem_minmax(0,1fr)_auto]"
              >
                <FormField
                  control={control}
                  name={`vatStatus.${i}.validFrom`}
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2">
                        {t('validFrom')}
                        {validFrom && isPlannedChange({ validFrom }, today) && (
                          <Badge variant="secondary" className="font-normal">
                            {t('planned')}
                          </Badge>
                        )}
                      </FormLabel>
                      <FormControl>
                        <Input type="date" className="min-h-11" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={control}
                  name={`vatStatus.${i}.status`}
                  render={({ field }) => (
                    <FormItem className="col-span-2 row-start-2 sm:col-span-1 sm:col-start-2 sm:row-start-1">
                      <FormLabel>{t('status')}</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                        <FormControl>
                          <SelectTrigger className="min-h-11 w-full">
                            <SelectValue placeholder={t('statusPlaceholder')} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {VAT_STATUS_KEYS.map((key) => (
                            <SelectItem key={key} value={key} className="min-h-11">
                              {t(`statuses.${key}`)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {!readOnly && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="col-start-2 row-start-1 mt-6 size-11 sm:col-start-3"
                    aria-label={t('remove', { date: validFrom ? formatDate(validFrom) : t('noDate') })}
                    onClick={() => rows.remove(i)}
                  >
                    <Trash size={18} aria-hidden="true" />
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {!readOnly && (
        <Button type="button" variant="outline" className="min-h-11 self-start" onClick={add}>
          <Plus size={16} aria-hidden="true" />
          {t('add')}
        </Button>
      )}
    </div>
  )
}
