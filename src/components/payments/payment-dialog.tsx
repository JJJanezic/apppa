'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { MagnifyingGlass } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useMemo, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'

import { type PayableInvoiceOption, type PaymentWarning, recordPayment, searchPayableInvoices, updatePayment } from '@/app/(app)/zahlungen/actions'
import { AmountInput } from '@/components/amount-input'
import { callAction, FormError } from '@/components/auth/form-error'
import { DetailPanel } from '@/components/detail-panel'
import { ReceiptField } from '@/components/payments/receipt-field'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { amountInput, formatCents, formatDate, parseAmountCents } from '@/lib/format'
import { type Payment, PAYMENT_LIMITS as L, type PaymentKind, type PaymentMethod, settledOf, suggestedAmountCents } from '@/lib/payments'
import { type PaymentInput, paymentSchema } from '@/lib/validation/payments'

// Rechnung zur Auswahl: Offen-Betrag (bei Gutschriften: Rückzahlung offen) und ob die Buchung über eine Plattform lief
export type InvoiceChoice = { id: string; label: string; openCents: number; platform: boolean; bookingId: string | null }

interface PaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  kind: PaymentKind
  // Eine Rechnung: fest; mehrere (Buchungsdetail): Auswahl
  invoices: InvoiceChoice[]
  // Bearbeiten (nur Inhaber); sonst Erfassen
  payment?: Payment | null
  methods: PaymentMethod[]
  today: string
}

const toInput = (invoices: InvoiceChoice[], payment: Payment | null | undefined, methods: PaymentMethod[], today: string): PaymentInput => {
  const methodId = payment?.method?.id ?? methods.find((m) => m.isDefault && m.active)?.id ?? methods.find((m) => m.active)?.id ?? ''
  if (payment) {
    return {
      invoiceId: payment.invoiceId,
      paidOn: payment.paidOn,
      amount: amountInput(payment.amountCents),
      commission: payment.commissionCents ? amountInput(payment.commissionCents) : '',
      fee: payment.feeCents ? amountInput(payment.feeCents) : '',
      methodId,
      note: payment.note ?? '',
      receiptPath: payment.receipt?.path ?? '',
    }
  }
  const only = invoices.length === 1 ? invoices[0] : null
  return {
    invoiceId: only?.id ?? '',
    paidOn: today,
    amount: amountInput(only ? suggestedAmountCents(only.openCents) : null),
    commission: '',
    fee: '',
    methodId,
    note: '',
    receiptPath: '',
  }
}

const centsOf = (value: string) => {
  const c = parseAmountCents(value)
  return c === null || Number.isNaN(c) ? 0 : c
}

// Zahlung bzw. Rückzahlung erfassen oder bearbeiten (PROJ-45). Provision und Zahlungsgebühr nur bei Plattform-Buchungen
// (booking.com, Airbnb): Der Vorschlag für „Ausbezahlt“ sinkt mit ihnen, solange der Nutzer den Betrag nicht selbst geändert hat.
// Hinweise der Datenbank (Überzahlung, gleiche Zahlung, Rückzahlung über Guthaben) bestätigt der Nutzer in einem Dialog.
export function PaymentDialog({ open, onOpenChange, kind, invoices, payment = null, methods, today }: PaymentDialogProps) {
  const t = useTranslations('payments.dialog')
  const tv = useTranslations('payments.validation')
  const router = useRouter()
  const schema = useMemo(() => paymentSchema(tv, { today }), [tv, today])
  const form = useForm<PaymentInput>({ resolver: zodResolver(schema, undefined, { raw: true }), defaultValues: toInput(invoices, payment, methods, today) })
  const [error, setError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<PaymentWarning[] | null>(null)
  // Beim Umhängen gefundene Rechnungen kommen zu den wählbaren hinzu
  const [found, setFound] = useState<InvoiceChoice[]>([])
  const [searching, setSearching] = useState(false)
  const amountTouched = useRef(Boolean(payment))
  const editing = payment !== null
  const refund = kind === 'refund'

  const values = useWatch({ control: form.control }) as PaymentInput
  const choices = [...invoices, ...found.filter((f) => !invoices.some((i) => i.id === f.id))]
  const current = choices.find((i) => i.id === values.invoiceId) ?? null
  // Offen-Betrag der gewählten Rechnung; beim Bearbeiten an derselben Rechnung zählt die Zahlung selbst nicht mit
  const ownSettled = payment && payment.invoiceId === values.invoiceId ? (refund ? payment.amountCents : settledOf(payment)) : 0
  const openCents = current ? current.openCents + ownSettled : 0
  const hasDeductions = centsOf(values.commission ?? '') > 0 || centsOf(values.fee ?? '') > 0
  // Felder bleiben sichtbar, solange ein Wert eingetragen ist (z. B. Buchungsquelle später geändert)
  const showDeductions = !refund && (current?.platform || hasDeductions)
  const activeMethods = methods.filter((m) => m.active || m.id === payment?.method?.id)

  function suggest(next: { commission?: string; fee?: string; open?: number }) {
    if (amountTouched.current) return
    const c = centsOf(next.commission ?? values.commission ?? '')
    const f = centsOf(next.fee ?? values.fee ?? '')
    form.setValue('amount', amountInput(suggestedAmountCents(next.open ?? openCents, c, f)))
  }

  async function save(v: PaymentInput, confirmed: boolean) {
    setError(null)
    const target = choices.find((i) => i.id === v.invoiceId)
    if (target && !target.platform && !refund && (centsOf(v.commission ?? '') > 0 || centsOf(v.fee ?? '') > 0)) {
      form.setError('invoiceId', { message: tv('commissionNotAllowed') }, { shouldFocus: true })
      return
    }
    const result = await callAction(() =>
      payment
        ? updatePayment({ id: payment.id, updatedAt: payment.updatedAt, kind, values: v, confirmed })
        : recordPayment({ kind, values: v, confirmed })
    )
    if (!result.ok) {
      if (result.error === 'commissionNotAllowed') form.setError('invoiceId', { message: tv('commissionNotAllowed') }, { shouldFocus: true })
      else if (result.error === 'methodInactive') form.setError('methodId', { message: tv('methodInactive') }, { shouldFocus: true })
      else if (result.error === 'dateInFuture') form.setError('paidOn', { message: tv('dateInFuture') }, { shouldFocus: true })
      else if (result.error !== 'sessionExpired') setError(result.error)
      return
    }
    if (result.data && 'warnings' in result.data) {
      setWarnings(result.data.warnings)
      return
    }
    setWarnings(null)
    toast.success(t(editing ? 'saved' : refund ? 'createdRefund' : 'created'))
    onOpenChange(false)
    router.refresh()
  }

  async function search(query: string) {
    setSearching(true)
    const result = await callAction(() => searchPayableInvoices({ query, bookingId: current?.bookingId ?? null }))
    setSearching(false)
    if (!result.ok) {
      if (result.error !== 'sessionExpired') setError(result.error)
      return
    }
    setFound(
      (result.data ?? []).map((r: PayableInvoiceOption) => ({
        id: r.id,
        label: [r.number ?? '–', r.recipient].join(' · '),
        openCents: r.openCents,
        platform: r.platform,
        bookingId: r.bookingId,
      }))
    )
  }

  const warningText = (w: PaymentWarning) => {
    if (w.code === 'overpaid') return t('warnOverpaid', { amount: formatCents(w.cents) })
    if (w.code === 'duplicate') return t('warnDuplicate', { amount: formatCents(w.cents), date: formatDate(w.date) })
    return t('warnRefundOver', { amount: formatCents(w.cents) })
  }

  const amountField = (name: 'commission' | 'fee', label: string) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <AmountInput
              className="min-h-11"
              {...field}
              value={field.value ?? ''}
              onValueChange={(next) => {
                field.onChange(next)
                suggest({ [name]: next })
              }}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )

  const title = t(`${editing ? 'edit' : 'new'}${refund ? 'Refund' : ''}`)

  return (
    <DetailPanel open={open} onOpenChange={onOpenChange} title={title} description={refund ? t('refundLead') : undefined}>
      <Form {...form}>
        <form onSubmit={form.handleSubmit((v) => save(v, false))} noValidate className="flex min-w-0 flex-col gap-5">
          <FormError error={error} namespace="payments.errors" />

          <FormField
            control={form.control}
            name="invoiceId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t(refund ? 'creditNote' : 'invoice')}</FormLabel>
                {choices.length > 1 ? (
                  <Select
                    value={field.value}
                    onValueChange={(id) => {
                      field.onChange(id)
                      const next = choices.find((i) => i.id === id)
                      const own = payment && payment.invoiceId === id ? (refund ? payment.amountCents : settledOf(payment)) : 0
                      if (next) suggest({ open: next.openCents + own })
                    }}
                  >
                    <FormControl>
                      <SelectTrigger className="min-h-11">
                        <SelectValue placeholder={t('invoicePlaceholder')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {choices.map((i) => (
                        <SelectItem key={i.id} value={i.id} className="min-h-11">
                          {i.label} · {t('openShort', { amount: formatCents(i.openCents) })}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="flex min-h-11 items-center rounded-md bg-ds-surface px-3">{current?.label ?? '–'}</p>
                )}
                {current && (
                  <FormDescription>
                    {t(refund ? 'refundOpen' : 'open', { amount: formatCents(openCents) })}
                  </FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Umhängen: andere zahlbare Rechnung suchen (nur beim Bearbeiten einer Zahlung, nur Inhaber) */}
          {editing && !refund && <ReassignSearch searching={searching} onSearch={search} />}

          <FormField
            control={form.control}
            name="paidOn"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t(refund ? 'refundDate' : 'date')}</FormLabel>
                <FormControl>
                  <Input type="date" max={today} className="min-h-11" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {showDeductions && (
            <div className="grid gap-4 sm:grid-cols-2">
              {amountField('commission', t('commission'))}
              {amountField('fee', t('fee'))}
            </div>
          )}

          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t(showDeductions ? 'paidOut' : 'amount')}</FormLabel>
                <FormControl>
                  <AmountInput
                    className="min-h-11"
                    {...field}
                    onValueChange={(next) => {
                      amountTouched.current = true
                      field.onChange(next)
                    }}
                  />
                </FormControl>
                {showDeductions && <FormDescription>{t('paidOutHint')}</FormDescription>}
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
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="min-h-11">
                      <SelectValue placeholder={t('methodPlaceholder')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {activeMethods.map((m) => (
                      <SelectItem key={m.id} value={m.id} className="min-h-11">
                        {m.active ? m.name : t('methodInactive', { name: m.name })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {activeMethods.length === 0 && <FormDescription>{t('noMethods')}</FormDescription>}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="note"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('note')}</FormLabel>
                <FormControl>
                  <Textarea rows={2} maxLength={L.noteMax + 20} {...field} value={field.value ?? ''} />
                </FormControl>
                <FormDescription>{t('noteCount', { count: (values.note ?? '').length, max: L.noteMax })}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="receiptPath"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="zahlung-beleg">{t('receipt')}</FormLabel>
                <ReceiptField
                  id="zahlung-beleg"
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  saved={payment?.receipt ? { paymentId: payment.id, path: payment.receipt.path } : undefined}
                />
                <FormDescription>{t('receiptHint')}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex flex-wrap gap-3">
            <Button type="submit" className="min-h-11" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? t('saving') : t('save')}
            </Button>
            <Button type="button" variant="ghost" className="min-h-11" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
          </div>
        </form>
      </Form>

      <AlertDialog open={warnings !== null} onOpenChange={(o) => !o && setWarnings(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('warnTitle')}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <ul className="flex list-disc flex-col gap-1 pl-5">
                {(warnings ?? []).map((w) => (
                  <li key={w.code}>{warningText(w)}</li>
                ))}
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">{t('warnBack')}</AlertDialogCancel>
            <AlertDialogAction className="min-h-11" onClick={() => void form.handleSubmit((v) => save(v, true))()}>
              {t('warnConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DetailPanel>
  )
}

// Suche nach einer anderen zahlbaren Rechnung (Nummer oder Empfänger); Treffer erscheinen in der Auswahl „Rechnung“
function ReassignSearch({ searching, onSearch }: { searching: boolean; onSearch: (query: string) => void }) {
  const t = useTranslations('payments.dialog')
  const [query, setQuery] = useState('')
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="zahlung-umhaengen" className="text-sm font-medium">
        {t('reassign')}
      </label>
      <div className="flex gap-2">
        <Input
          id="zahlung-umhaengen"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onSearch(query)
            }
          }}
          placeholder={t('reassignPlaceholder')}
          autoComplete="off"
          className="min-h-11"
        />
        <Button type="button" variant="outline" className="min-h-11 shrink-0" disabled={searching} onClick={() => onSearch(query)}>
          <MagnifyingGlass size={18} aria-hidden="true" />
          {t('reassignSearch')}
        </Button>
      </div>
      <p className="text-[13px] text-ds-neutral-800" aria-live="polite">
        {searching ? t('reassignSearching') : t('reassignHint')}
      </p>
    </div>
  )
}
