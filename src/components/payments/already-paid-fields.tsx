'use client'

import { useTranslations } from 'next-intl'
import { type UseFormReturn } from 'react-hook-form'

import { AmountInput } from '@/components/amount-input'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { formatCents, parseAmountCents } from '@/lib/format'
import type { PaymentMethod } from '@/lib/payments'
import type { AlreadyPaidInput } from '@/lib/validation/payments'

interface AlreadyPaidFieldsProps {
  form: UseFormReturn<AlreadyPaidInput>
  on: boolean
  onToggle: (on: boolean) => void
  // null: Zahlungsarten werden geladen; [] mit `unavailable`: Zahlungserfassung noch nicht eingerichtet
  methods: PaymentMethod[] | null
  unavailable: boolean
  // Buchung über booking.com oder Airbnb: Provision und Zahlungsgebühr
  platform: boolean
  // Rechnungsbetrag aus den Positionen (Vorschau „Ausbezahlt“)
  totalCents: number | null
  today: string
}

const centsOf = (value: string | undefined) => {
  const c = parseAmountCents(value ?? '')
  return c === null || Number.isNaN(c) ? 0 : c
}

// „Bereits bezahlt“ beim Nacherfassen (PROJ-45, nur beim Anlegen, nur bei Betrag > 0): Beim Speichern entsteht eine Zahlung,
// die den vollen Rechnungsbetrag begleicht (Betrag = Rechnungsbetrag − Provision − Zahlungsgebühr).
export function AlreadyPaidFields({ form, on, onToggle, methods, unavailable, platform, totalCents, today }: AlreadyPaidFieldsProps) {
  const t = useTranslations('payments.alreadyPaid')
  const values = form.watch()
  const paidOut = totalCents === null ? null : totalCents - centsOf(values.commission) - centsOf(values.fee)

  return (
    <div className="flex flex-col gap-4 rounded-md border p-4">
      <div className="flex items-start gap-3">
        <Switch id="bereits-bezahlt" checked={on} onCheckedChange={onToggle} disabled={unavailable} className="mt-0.5" aria-describedby="bereits-bezahlt-hinweis" />
        <div className="flex flex-col gap-0.5">
          <label htmlFor="bereits-bezahlt" className="text-sm font-medium">
            {t('label')}
          </label>
          <p id="bereits-bezahlt-hinweis" className="text-[13px] text-ds-neutral-800">
            {unavailable ? t('unavailable') : t('hint')}
          </p>
        </div>
      </div>

      {on && (
        <Form {...form}>
          <div className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="paidOn"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('date')}</FormLabel>
                  <FormControl>
                    <Input type="date" max={today} className="min-h-11" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="methodId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('method')}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange} disabled={methods === null}>
                    <FormControl>
                      <SelectTrigger className="min-h-11">
                        <SelectValue placeholder={methods === null ? t('loading') : t('methodPlaceholder')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {(methods ?? []).map((m) => (
                        <SelectItem key={m.id} value={m.id} className="min-h-11">
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            {platform && (
              <div className="grid gap-4 sm:grid-cols-2">
                {(['commission', 'fee'] as const).map((name) => (
                  <FormField
                    key={name}
                    control={form.control}
                    name={name}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t(name)}</FormLabel>
                        <FormControl>
                          <AmountInput className="min-h-11" {...field} value={field.value ?? ''} onValueChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            )}
            {/* Kein FormDescription: der braucht ein umgebendes FormField (QA BUG-1) */}
            {paidOut !== null && (
              <p className="text-sm text-muted-foreground">{t(platform ? 'paidOutPlatform' : 'paidOut', { amount: formatCents(paidOut) })}</p>
            )}
          </div>
        </Form>
      )}
    </div>
  )
}
