'use client'

import { PencilSimple, Plus, Trash } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'

import { deletePayment } from '@/app/(app)/zahlungen/actions'
import { callAction } from '@/components/auth/form-error'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { type InvoiceChoice, PaymentDialog } from '@/components/payments/payment-dialog'
import { Button } from '@/components/ui/button'
import { formatCents, formatDate } from '@/lib/format'
import type { Payment, PaymentKind, PaymentMethod } from '@/lib/payments'

// „Zahlung erfassen“ bzw. „Rückzahlung erfassen“ (Inhaber und Mitarbeiter)
export function RecordPaymentButton({
  kind,
  invoices,
  methods,
  today,
  variant = 'default',
}: {
  kind: PaymentKind
  invoices: InvoiceChoice[]
  methods: PaymentMethod[]
  today: string
  variant?: 'default' | 'outline'
}) {
  const t = useTranslations('payments')
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant={variant} className="min-h-11 w-fit" onClick={() => setOpen(true)}>
        <Plus size={18} weight="bold" aria-hidden="true" />
        {t(kind === 'refund' ? 'recordRefund' : 'record')}
      </Button>
      {open && <PaymentDialog open onOpenChange={setOpen} kind={kind} invoices={invoices} methods={methods} today={today} />}
    </>
  )
}

// „Bearbeiten“ und „Löschen“ je Zahlung (nur Inhaber)
export function PaymentRowActions({
  payment,
  invoice,
  methods,
  today,
}: {
  payment: Payment
  invoice: InvoiceChoice
  methods: PaymentMethod[]
  today: string
}) {
  const t = useTranslations('payments')
  const router = useRouter()
  const [dialog, setDialog] = useState<'edit' | 'delete' | null>(null)
  const [pending, setPending] = useState(false)
  const close = (open: boolean) => !open && setDialog(null)
  const refund = payment.kind === 'refund'

  async function remove() {
    setDialog(null)
    setPending(true)
    const result = await callAction(() => deletePayment({ id: payment.id }))
    setPending(false)
    if (!result.ok) {
      if (result.error !== 'sessionExpired') toast.error(t(`errors.${result.error}`))
      return
    }
    toast.success(t(refund ? 'deletedRefund' : 'deleted'))
    router.refresh()
  }

  return (
    <>
      <span className="flex gap-1">
        <Button variant="ghost" size="icon" className="size-11" aria-label={t('editLabel', { date: formatDate(payment.paidOn) })} onClick={() => setDialog('edit')}>
          <PencilSimple size={18} aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-11 text-ds-accent-2-700"
          disabled={pending}
          aria-label={t('deleteLabel', { date: formatDate(payment.paidOn) })}
          onClick={() => setDialog('delete')}
        >
          <Trash size={18} aria-hidden="true" />
        </Button>
      </span>
      {dialog === 'edit' && (
        <PaymentDialog key={payment.updatedAt} open onOpenChange={close} kind={payment.kind} invoices={[invoice]} payment={payment} methods={methods} today={today} />
      )}
      {dialog === 'delete' && (
        <ConfirmDialog
          open
          onOpenChange={close}
          title={t(refund ? 'deleteRefundTitle' : 'deleteTitle')}
          text={t(payment.receipt ? 'deleteTextReceipt' : 'deleteText', { date: formatDate(payment.paidOn), amount: formatCents(payment.amountCents) })}
          confirmLabel={t('deleteConfirm')}
          cancelLabel={t('cancel')}
          onConfirm={remove}
        />
      )}
    </>
  )
}
