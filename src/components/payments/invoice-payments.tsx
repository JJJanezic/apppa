import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { Amount } from '@/components/amount'
import { PaymentRowActions, RecordPaymentButton } from '@/components/payments/payment-buttons'
import { PaymentStatusBadge } from '@/components/payments/payment-status'
import { ReceiptLink } from '@/components/payments/receipt-link'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { todayIso } from '@/lib/bookings'
import { formatDate } from '@/lib/format'
import { type Invoice, invoiceHref } from '@/lib/invoices'
import { canRecordPayment, canRecordRefund, signedCents } from '@/lib/payments'
import { getInvoicePayments, getPaymentMethods } from '@/lib/payments-data'
import { cn } from '@/lib/utils'

// Abschnitt „Zahlungen“ (Rechnung) bzw. „Rückzahlungen“ (Gutschrift) im Rechnungsdetail (PROJ-45), für Inhaber und Mitarbeiter.
// Erfassen dürfen beide, Bearbeiten und Löschen nur Inhaber. Ohne Zahlungsstand (Altrechnung mit Betrag ≤ 0) und ohne
// Einträge bleibt der Abschnitt weg.
export async function InvoicePaymentsSection({ invoice }: { invoice: Invoice }) {
  const [t, { state, payments, platform, owner, ready }, methods] = await Promise.all([
    getTranslations('payments'),
    getInvoicePayments(invoice),
    getPaymentMethods(),
  ])
  if (state.mode === 'none' && payments.length === 0) return null
  const today = todayIso()
  const credit = state.mode === 'credit'
  const choice = {
    id: invoice.id,
    label: invoice.number,
    openCents: credit ? state.balanceCents : state.openCents,
    platform,
    bookingId: invoice.booking?.id ?? null,
  }
  const schedule = invoice.issued && !credit ? invoice.issued.snapshot.schedule : null
  const showDeductions = state.commissionCents > 0 || state.feeCents > 0
  const canRecord = credit ? canRecordRefund(state) : canRecordPayment(state)
  const headingId = `zahlungen-${invoice.id}`

  return (
    <section className="flex flex-col gap-3" aria-labelledby={headingId}>
      <div className="flex flex-wrap items-center gap-3">
        <h2 id={headingId} className="text-2xl">
          {t(credit ? 'refundsTitle' : 'title')}
        </h2>
        <PaymentStatusBadge state={state} dash={false} />
      </div>

      {!ready && (
        <Alert>
          <AlertDescription>{t('notReady')}</AlertDescription>
        </Alert>
      )}

      {state.mode === 'cancelled' && state.balanceCents > 0 && (
        <p className="rounded-lg bg-ds-surface px-4 py-3 text-sm">
          {t('cancelledHint')}{' '}
          {invoice.cancelledBy && (
            <Link href={invoiceHref(invoice.cancelledBy.id)} className="text-ds-accent-700 underline underline-offset-[3px]">
              {t('toCreditNote', { number: invoice.cancelledBy.number })}
            </Link>
          )}
        </p>
      )}

      {payments.length > 0 ? (
        <ul className="flex flex-col divide-y rounded-lg bg-ds-surface px-4">
          {payments.map((p) => (
            <li key={p.id} className="flex items-start justify-between gap-3 py-3">
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="flex flex-wrap items-baseline gap-x-2">
                  <span className="tabular-nums">{formatDate(p.paidOn)}</span>
                  <span className="text-ds-neutral-800">· {p.method?.name ?? '–'}</span>
                </span>
                <span className="flex flex-wrap items-baseline gap-x-1.5 font-medium">
                  <Amount cents={signedCents(p.kind, p.amountCents)} />
                  {p.commissionCents > 0 && (
                    <span className="text-sm font-normal text-ds-neutral-800">
                      + {t('commissionShort')} <Amount cents={p.commissionCents} />
                    </span>
                  )}
                  {p.feeCents > 0 && (
                    <span className="text-sm font-normal text-ds-neutral-800">
                      + {t('feeShort')} <Amount cents={p.feeCents} />
                    </span>
                  )}
                </span>
                {p.note && <span className="break-words text-sm">{p.note}</span>}
                <span className="text-[13px] text-ds-neutral-800">
                  {p.createdBy ? t('createdBy', { name: p.createdBy, date: formatDate(p.createdAt) }) : t('createdAt', { date: formatDate(p.createdAt) })}
                </span>
              </span>
              <span className="flex shrink-0 items-center">
                {p.receipt && <ReceiptLink paymentId={p.id} type={p.receipt.type} />}
                {owner && <PaymentRowActions payment={p} invoice={choice} methods={methods} today={today} />}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg bg-ds-surface px-4 py-3 text-ds-neutral-800">{t(credit ? 'noRefunds' : 'none')}</p>
      )}

      <dl className="flex flex-col divide-y rounded-lg bg-ds-surface px-4">
        {credit ? (
          <>
            <Row label={t('sum.refunded')} cents={-state.refundedCents} />
            <Row label={t('sum.refundOpen')} cents={state.balanceCents} strong />
          </>
        ) : state.mode === 'cancelled' ? (
          <>
            <Row label={t('sum.received')} cents={state.receivedCents} />
            <Row label={t('sum.balance')} cents={state.balanceCents} strong />
          </>
        ) : (
          <>
            <Row label={t('sum.total')} cents={state.totalCents} />
            <Row label={t('sum.received')} cents={state.receivedCents} />
            {showDeductions && (
              <>
                <Row label={t('sum.commission')} cents={state.commissionCents} />
                <Row label={t('sum.fee')} cents={state.feeCents} />
                <Row label={t('sum.settled')} cents={state.settledCents} />
              </>
            )}
            <Row label={t('sum.open')} cents={state.openCents} strong />
          </>
        )}
      </dl>

      {schedule && state.mode === 'payable' && (
        <p className="text-sm">
          {schedule.depositCents !== null && schedule.depositDue && schedule.remainderCents !== null ? (
            <>
              {t('dueDeposit', { date: formatDate(schedule.depositDue) })} <Amount cents={schedule.depositCents} />
              <br />
              {t('dueRest', { date: formatDate(schedule.due) })} <Amount cents={schedule.remainderCents} />
            </>
          ) : (
            t('due', { date: formatDate(schedule.due) })
          )}
          {state.overdue && <span className="ml-2 font-semibold text-destructive">{t('status.overdue')}</span>}
        </p>
      )}

      {canRecord && (
        <RecordPaymentButton kind={credit ? 'refund' : 'payment'} invoices={[choice]} methods={methods} today={today} />
      )}
    </section>
  )
}

function Row({ label, cents, strong = false }: { label: string; cents: number; strong?: boolean }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4 py-3', strong && 'font-semibold')}>
      <dt>{label}</dt>
      <dd>
        <Amount cents={cents} />
      </dd>
    </div>
  )
}
