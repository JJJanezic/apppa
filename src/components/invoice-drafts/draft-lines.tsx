'use client'

import { Plus, Trash } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'
import { type UseFieldArrayReturn, useFormContext, useWatch } from 'react-hook-form'

import { AmountInput } from '@/components/amount-input'
import { chargeMoneyCell, SortableChargeList, SortableChargeRow } from '@/components/bookings/sortable-charges'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { LabelCombobox } from '@/components/vat/label-combobox'
import { VatRateInput } from '@/components/vat/vat-rate-input'
import type { LineUse } from '@/lib/invoice-drafts'
import { textDate } from '@/lib/invoice-texts'
import { INVOICE_LIMITS as L } from '@/lib/invoices'
import type { DraftInput } from '@/lib/validation/invoice-drafts'
import { CHARGE_CHOICES, VAT_DEFAULTS, vatRateInput } from '@/lib/vat'

interface DraftLinesProps {
  lines: UseFieldArrayReturn<DraftInput, 'lines'>
  showVat: boolean
  // Verwendung der Buchungspositionen in anderen Rechnungen (Hinweis „bereits in Rechnung …“)
  usedBy: Map<string, LineUse>
  // Während eine Position verschoben wird bzw. die Bezeichnungsauswahl offen ist (Escape nicht weiterreichen)
  sortingRef: React.RefObject<boolean>
}

// Positionen des Entwurfs (Art Rechnung und Schlussrechnung): anwählen, Bezeichnung/Betrag/Satz ändern, eigene
// hinzufügen, Reihenfolge per Griff (Baustein aus PROJ-34). Gespeichert werden nur angewählte Positionen.
export function DraftLines({ lines, showVat, usedBy, sortingRef }: DraftLinesProps) {
  const t = useTranslations('invoiceDrafts.lines')
  const tb = useTranslations('bookings')
  const form = useFormContext<DraftInput>()
  const rows = useWatch({ control: form.control, name: 'lines' })
  const validate = () => ({ shouldValidate: form.formState.isSubmitted })
  const chargeChoices = CHARGE_CHOICES.map((c) => ({ key: c.key, label: tb(`chargeSuggestions.${c.key}`) }))
  const sortable = lines.fields.length > 1
  const noteFor = (u: LineUse) => (u.draft ? t('inDraft', { date: textDate(u.date) }) : t('inInvoice', { number: u.number ?? '–' }))

  return (
    <div className="flex flex-col gap-3">
      {lines.fields.length === 0 && <p className="rounded-lg bg-ds-surface px-4 py-3 text-sm text-ds-neutral-800">{t('empty')}</p>}
      <SortableChargeList
        ids={lines.fields.map((l) => l.id)}
        labelAt={(i) => form.getValues(`lines.${i}.label`) ?? ''}
        onMove={lines.move}
        onDraggingChange={(d) => {
          sortingRef.current = d
        }}
      >
        {lines.fields.map((line, i) => {
          const row = rows[i]
          const selected = row?.selected ?? true
          const use = row?.source ? usedBy.get(row.source) : undefined
          const name = row?.label?.trim() || tb('panel.chargeFallback', { n: i + 1 })
          return (
            <div key={line.id} className="flex flex-col gap-1">
              <SortableChargeRow id={line.id} sortable={sortable} withVat={showVat} handleLabel={tb('panel.moveCharge', { label: name })}>
                <div className="flex min-w-0 items-start gap-2">
                  <FormField
                    control={form.control}
                    name={`lines.${i}.selected`}
                    render={({ field }) => (
                      <FormItem className="flex size-11 shrink-0 items-center justify-center space-y-0">
                        <FormControl>
                          <Checkbox checked={field.value} onCheckedChange={(c) => field.onChange(c === true)} aria-label={t('select', { label: name })} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name={`lines.${i}.label`}
                    render={({ field }) => (
                      <FormItem className="min-w-0 flex-1">
                        <FormLabel className="sr-only">{t('label', { n: i + 1 })}</FormLabel>
                        <FormControl>
                          <LabelCombobox
                            maxLength={L.lineLabelMax}
                            placeholder={t('labelPlaceholder')}
                            className="min-h-11"
                            choices={chargeChoices}
                            listLabel={tb('panel.chargeChoices')}
                            onListOpenChange={(o) => {
                              sortingRef.current = o
                            }}
                            {...field}
                            disabled={!selected}
                            onValueChange={field.onChange}
                            onChoose={(choice) => {
                              const bp = CHARGE_CHOICES.find((c) => c.key === choice.key)?.vatBp
                              if (bp !== undefined) form.setValue(`lines.${i}.vat`, vatRateInput(bp), validate())
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className={chargeMoneyCell(sortable, showVat)}>
                  <FormField
                    control={form.control}
                    name={`lines.${i}.amount`}
                    render={({ field }) => (
                      <FormItem className={showVat ? 'w-28 shrink-0' : undefined}>
                        <FormLabel className="sr-only">{t('amount', { n: i + 1 })}</FormLabel>
                        <FormControl>
                          <AmountInput negative placeholder={t('amountPlaceholder')} className="min-h-11 w-28" {...field} disabled={!selected} onValueChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  {showVat && (
                    <FormField
                      control={form.control}
                      name={`lines.${i}.vat`}
                      render={({ field }) => (
                        <FormItem className="w-32 shrink-0">
                          <FormLabel className="sr-only">{t('vat', { n: i + 1 })}</FormLabel>
                          <div className="flex items-center gap-1.5">
                            <FormControl>
                              <VatRateInput className="min-h-11 w-20" {...field} disabled={!selected} onValueChange={field.onChange} />
                            </FormControl>
                            <span className="text-sm text-ds-neutral-800" aria-hidden="true">
                              {tb('panel.vatSuffix')}
                            </span>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
                <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={t('remove', { n: i + 1 })} onClick={() => lines.remove(i)}>
                  <Trash size={18} aria-hidden="true" />
                </Button>
              </SortableChargeRow>
              {use && <p className="pl-2 text-[13px] text-ds-neutral-800">{noteFor(use)}</p>}
            </div>
          )
        })}
      </SortableChargeList>
      {lines.fields.length < L.linesMax && (
        <Button
          type="button"
          variant="outline"
          className="min-h-11 self-start"
          onClick={() => lines.append({ selected: true, source: '', label: '', amount: '', vat: vatRateInput(VAT_DEFAULTS.charge) }, { shouldFocus: true })}
        >
          <Plus size={16} aria-hidden="true" />
          {t('add')}
        </Button>
      )}
    </div>
  )
}
