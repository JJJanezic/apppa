'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'

import { saveInvoiceNumbering } from '@/app/(app)/einstellungen/rechnungen/actions'
import { callAction, FormError } from '@/components/auth/form-error'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { StaleAlert } from '@/components/invoice-settings/section-shell'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { todayIso } from '@/lib/bookings'
import {
  NUMBER_SEPARATORS,
  NUMBERING_LIMITS as NL,
  nextInvoiceNumber,
  type NumberingSettings,
  type NumberSeparator,
  sameNumbering,
} from '@/lib/invoice-numbering'
import type { InvoiceSettingsData } from '@/lib/invoice-settings'
import { numberingSchema, type NumberingInput } from '@/lib/validation/invoice-settings'

// Radix-Select kennt keinen leeren Wert: „kein Trennzeichen“ heißt in der Auswahl „none“
const NONE = 'none'
const DIGITS = Array.from({ length: NL.digitsMax - NL.digitsMin + 1 }, (_, i) => String(NL.digitsMin + i))

const toInput = (n: NumberingSettings): NumberingInput => ({
  prefix: n.prefix,
  withYear: n.withYear,
  separator: n.separator,
  digits: String(n.digits),
  yearlyReset: n.yearlyReset,
  startNumber: String(n.startNumber),
})

// Eingaben → Format für die Vorschau; Unfertiges fällt auf den gespeicherten Stand zurück
function previewSettings(v: NumberingInput, saved: NumberingSettings, year: number): NumberingSettings {
  const digits = Number(v.digits)
  const start = /^\d{1,9}$/.test(v.startNumber.trim()) && Number(v.startNumber) >= 1 ? Number(v.startNumber) : saved.startNumber
  return {
    prefix: v.prefix.trim(),
    withYear: v.withYear,
    separator: v.separator,
    digits: digits >= NL.digitsMin && digits <= NL.digitsMax ? digits : saved.digits,
    yearlyReset: v.withYear && v.yearlyReset,
    startNumber: start,
    // Eine geänderte Startnummer gilt ab dem Jahr, in dem sie gespeichert wird
    startYear: start === saved.startNumber ? saved.startYear : year,
  }
}

interface NumberingSectionProps {
  tenantId: string
  data: InvoiceSettingsData
  readOnly: boolean
}

export function NumberingSection({ tenantId, data, readOnly }: NumberingSectionProps) {
  const t = useTranslations('invoiceSettings.numbering')
  const tv = useTranslations('invoiceSettings.validation')
  const router = useRouter()
  const schema = useMemo(() => numberingSchema(tv), [tv])
  const saved = data.numbering
  const form = useForm<NumberingInput>({ resolver: zodResolver(schema, undefined, { raw: true }), defaultValues: toInput(saved) })
  const [error, setError] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const [confirm, setConfirm] = useState<NumberingInput | null>(null)

  const values = useWatch({ control: form.control }) as NumberingInput
  const today = todayIso()
  const current = previewSettings(values, saved, Number(today.slice(0, 4)))
  const next = nextInvoiceNumber(current, data.invoiceNumbers, today)

  async function save(v: NumberingInput) {
    setError(null)
    const result = await callAction(() => saveInvoiceNumbering({ tenantId, updatedAt: saved.updatedAt, numbering: v }))
    if (!result.ok) {
      if (result.error === 'staleSettings') setStale(true)
      else setError(result.error)
      return
    }
    toast.success(t('saved'))
    router.refresh()
  }

  // Nach dem ersten Ausstellen (PROJ-41) erst nach Bestätigung speichern
  function onSubmit(v: NumberingInput) {
    if (data.hasIssued && !sameNumbering(previewSettings(v, saved, Number(today.slice(0, 4))), saved)) setConfirm(v)
    else return save(v)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        <FormError error={error} namespace="invoiceSettings.errors" />
        {stale && <StaleAlert />}

        <fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-5">
          <legend className="sr-only">{t('legend')}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="prefix"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('prefix')}</FormLabel>
                  <FormControl>
                    <Input maxLength={NL.prefixMax + 5} autoComplete="off" className="min-h-11" {...field} />
                  </FormControl>
                  <FormDescription>{t('prefixHint', { max: NL.prefixMax })}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="startNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('startNumber')}</FormLabel>
                  <FormControl>
                    <Input inputMode="numeric" autoComplete="off" className="min-h-11" {...field} />
                  </FormControl>
                  <FormDescription>{t('startNumberHint')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="withYear"
            render={({ field }) => (
              <FormItem className="flex items-start gap-3">
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={(on) => {
                      field.onChange(on)
                      // „jährlich neu“ braucht die Jahreszahl
                      if (!on) form.setValue('yearlyReset', false, { shouldValidate: form.formState.isSubmitted })
                    }}
                    className="mt-0.5"
                  />
                </FormControl>
                <div className="flex flex-col gap-0.5">
                  <FormLabel className="font-normal">{t('withYear')}</FormLabel>
                  <FormDescription>{t('withYearHint')}</FormDescription>
                </div>
              </FormItem>
            )}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="separator"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('separator')}</FormLabel>
                  <Select
                    value={field.value === '' ? NONE : field.value}
                    onValueChange={(v) => field.onChange((v === NONE ? '' : v) as NumberSeparator)}
                    disabled={readOnly || !values.withYear}
                  >
                    <FormControl>
                      <SelectTrigger className="min-h-11">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {NUMBER_SEPARATORS.map((s) => (
                        <SelectItem key={s || NONE} value={s || NONE} className="min-h-11">
                          {s ? t('separatorChar', { char: s }) : t('separatorNone')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!values.withYear && <FormDescription>{t('separatorNeedsYear')}</FormDescription>}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="digits"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('digits')}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={readOnly}>
                    <FormControl>
                      <SelectTrigger className="min-h-11">
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {DIGITS.map((d) => (
                        <SelectItem key={d} value={d} className="min-h-11">
                          {t('digitsOption', { digits: d, example: '1'.padStart(Number(d), '0') })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>{t('digitsHint')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="yearlyReset"
            render={({ field }) => (
              <FormItem className="flex items-start gap-3">
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} disabled={readOnly || !values.withYear} className="mt-0.5" />
                </FormControl>
                <div className="flex flex-col gap-0.5">
                  <FormLabel className="font-normal">{t('yearlyReset')}</FormLabel>
                  <FormDescription>{values.withYear ? t('yearlyResetHint') : t('yearlyNeedsYear')}</FormDescription>
                  <FormMessage />
                </div>
              </FormItem>
            )}
          />
        </fieldset>

        {/* Vorschau: rechnet bei jeder Eingabe neu, noch vor dem Speichern */}
        <div className="flex flex-col gap-1 rounded-md bg-ds-surface px-4 py-3" aria-live="polite">
          <span className="text-[13px] font-semibold uppercase tracking-wide text-ds-neutral-700">{t('previewLabel')}</span>
          <span className="break-all text-2xl font-semibold tabular-nums" data-testid="next-invoice-number">
            {next.number}
          </span>
          <span className="text-[13px] text-ds-neutral-700">{t('previewHint')}</span>
          {next.startIgnored && current.startNumber > 1 && <span className="text-[13px] text-ds-neutral-800">{t('startIgnored')}</span>}
        </div>

        {!readOnly && (
          <Button type="submit" disabled={form.formState.isSubmitting} className="min-h-11 self-start">
            {t('save')}
          </Button>
        )}
      </form>

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={t('confirm.title')}
        text={t('confirm.text')}
        confirmLabel={t('confirm.confirm')}
        cancelLabel={t('confirm.cancel')}
        onConfirm={() => {
          const v = confirm
          setConfirm(null)
          if (v) void save(v)
        }}
      />
    </Form>
  )
}
