'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'

import { saveInvoiceTextBlock } from '@/app/(app)/einstellungen/rechnungen/actions'
import { callAction, FormError } from '@/components/auth/form-error'
import { DetailPanel } from '@/components/detail-panel'
import { RichTextField } from '@/components/invoice-settings/rich-text-field'
import { RichTextGuardProvider, useRichTextGuard } from '@/components/invoice-settings/rich-text-guard'
import { StaleAlert } from '@/components/invoice-settings/section-shell'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Switch } from '@/components/ui/switch'
import { formatNumber } from '@/lib/format'
import {
  DUE_BASES,
  INVOICE_TEXT_LIMITS as L,
  placeholderValues,
  SAMPLE_TEXT_CONTEXT,
  type TextBlock,
  type TextBlockKind,
  textBlockNameKey,
} from '@/lib/invoice-texts'
import { emptyDoc } from '@/lib/rich-text'
import { previewPaymentRules, textBlockSchema, type TextBlockInput } from '@/lib/validation/invoice-settings'

const toInput = (kind: TextBlockKind, b: TextBlock | null): TextBlockInput => ({
  kind,
  name: b?.name ?? '',
  body: b?.body ?? emptyDoc(),
  deposit: b?.payment?.depositPercent != null,
  depositPercent: b?.payment?.depositPercent != null ? formatNumber(b.payment.depositPercent, { maximumFractionDigits: 2 }) : '',
  depositDays: b?.payment?.depositDays != null ? String(b.payment.depositDays) : '',
  dueDays: b?.payment ? String(b.payment.dueDays) : '14',
  dueBasis: b?.payment?.dueBasis ?? 'after_invoice',
})

interface TextBlockPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  tenantId: string
  kind: TextBlockKind
  // null: neuer Baustein
  block: TextBlock | null
  // Namen der anderen Bausteine dieses Blocks (Eindeutigkeit schon im Browser)
  otherNames: string[]
  // Rechnungsnummer der Vorschau im eingestellten Format
  sampleNumber: string
  readOnly: boolean
}

// Baustein anlegen bzw. bearbeiten: Name, bei Zahlungsmodalitäten die Zahlungsregeln, Text mit Vorschau.
// Die Seite setzt key auf Baustein + Stand, damit „Aktuelle Fassung laden“ mit dem neuen Stand beginnt.
export function TextBlockPanel({ open, onOpenChange, tenantId, kind, block, otherNames, sampleNumber, readOnly }: TextBlockPanelProps) {
  const t = useTranslations('invoiceSettings.blocks')
  const tv = useTranslations('invoiceSettings.validation')
  const router = useRouter()
  const schema = useMemo(() => textBlockSchema(tv), [tv])
  const form = useForm<TextBlockInput>({ resolver: zodResolver(schema, undefined, { raw: true }), defaultValues: toInput(kind, block) })
  const [error, setError] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const guard = useRichTextGuard()

  const values = useWatch({ control: form.control }) as TextBlockInput
  const payment = kind === 'payment'
  const deposit = payment && values.deposit
  const sample = placeholderValues({ ...SAMPLE_TEXT_CONTEXT, invoiceNumber: sampleNumber, payment: previewPaymentRules(values) })
  const taken = new Set(otherNames.map(textBlockNameKey))

  async function onSubmit(v: TextBlockInput) {
    setError(null)
    if (taken.has(textBlockNameKey(v.name))) {
      form.setError('name', { message: tv('nameTaken') }, { shouldFocus: true })
      return
    }
    const result = await callAction(() =>
      saveInvoiceTextBlock({ tenantId, id: block?.id ?? null, updatedAt: block?.updatedAt ?? null, block: v })
    )
    if (!result.ok) {
      if (result.error === 'staleSettings') setStale(true)
      else if (result.error === 'nameTaken') form.setError('name', { message: tv('nameTaken') }, { shouldFocus: true })
      else setError(result.error)
      return
    }
    toast.success(block ? t('saved') : t('created'))
    onOpenChange(false)
    router.refresh()
  }

  const days = (name: 'depositDays' | 'dueDays', label: string, hint?: string) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <div className="flex items-center gap-2">
            <FormControl>
              <Input inputMode="numeric" autoComplete="off" className="min-h-11 w-24" {...field} />
            </FormControl>
            <span className="text-ds-neutral-800">{t('days')}</span>
          </div>
          {hint && <FormDescription>{hint}</FormDescription>}
          <FormMessage />
        </FormItem>
      )}
    />
  )

  return (
    <DetailPanel
      open={open}
      onOpenChange={onOpenChange}
      eyebrow={t(`kinds.${kind}`)}
      title={readOnly ? block?.name : block ? t('editTitle') : t('newTitle')}
      description={payment ? t('paymentLead') : undefined}
    >
      <Form {...form}>
        <RichTextGuardProvider value={guard.checks}>
          <form onSubmit={guard.guardSubmit(form.handleSubmit(onSubmit))} noValidate className="flex min-w-0 flex-col gap-5">
            <FormError error={error} namespace="invoiceSettings.errors" />
            {stale && <StaleAlert onReload={() => onOpenChange(false)} />}

            <fieldset disabled={readOnly} className="flex min-w-0 flex-col gap-5">
              <legend className="sr-only">{t(`kinds.${kind}`)}</legend>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('name')}</FormLabel>
                    <FormControl>
                      <Input maxLength={L.nameMax + 10} autoComplete="off" className="min-h-11" {...field} />
                    </FormControl>
                    <FormDescription>{t('nameHint')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {payment && (
                <div className="flex flex-col gap-4 rounded-md border p-4">
                  <FormField
                    control={form.control}
                    name="deposit"
                    render={({ field }) => (
                      <FormItem className="flex items-start gap-3">
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={(on) => {
                              field.onChange(on)
                              // Anzahlungs-Platzhalter sind nur mit Anzahlung erlaubt: Text neu prüfen
                              if (form.formState.isSubmitted) void form.trigger('body')
                            }}
                            className="mt-0.5"
                          />
                        </FormControl>
                        <div className="flex flex-col gap-0.5">
                          <FormLabel className="font-normal">{t('deposit')}</FormLabel>
                          <FormDescription>{t('depositHint')}</FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                  {deposit && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="depositPercent"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('depositPercent')}</FormLabel>
                            <div className="flex items-center gap-2">
                              <FormControl>
                                <Input inputMode="decimal" autoComplete="off" className="min-h-11 w-24" {...field} />
                              </FormControl>
                              <span className="text-ds-neutral-800">%</span>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {days('depositDays', t('depositDays'), t('depositDaysHint'))}
                    </div>
                  )}

                  <div className="flex flex-col gap-3">
                    {days('dueDays', deposit ? t('dueDaysRest') : t('dueDays'))}
                    <FormField
                      control={form.control}
                      name="dueBasis"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="sr-only">{t('dueBasis')}</FormLabel>
                          <FormControl>
                            <RadioGroup value={field.value} onValueChange={field.onChange} className="flex flex-col gap-1">
                              {DUE_BASES.map((basis) => (
                                <FormItem key={basis} className="flex min-h-11 items-center gap-3 space-y-0">
                                  <FormControl>
                                    <RadioGroupItem value={basis} />
                                  </FormControl>
                                  <FormLabel className="font-normal">{t(`dueBases.${basis}`)}</FormLabel>
                                </FormItem>
                              ))}
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>
              )}
            </fieldset>

            <RichTextField
              control={form.control}
              name="body"
              label={t('body')}
              hint={payment ? (deposit ? t('bodyHintDeposit') : t('bodyHintPayment')) : t('bodyHint')}
              context={{ kind, deposit }}
              max={L.bodyMax}
              readOnly={readOnly}
              preview={{ values: sample }}
            />

            <div className="flex flex-wrap gap-3">
              {!readOnly && (
                <Button type="submit" disabled={form.formState.isSubmitting} className="min-h-11">
                  {t('save')}
                </Button>
              )}
              <Button type="button" variant="outline" className="min-h-11" onClick={() => onOpenChange(false)}>
                {readOnly ? t('close') : t('cancel')}
              </Button>
            </div>
          </form>
        </RichTextGuardProvider>
      </Form>
    </DetailPanel>
  )
}
