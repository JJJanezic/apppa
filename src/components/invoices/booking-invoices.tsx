import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { Amount } from '@/components/amount'
import { InvoiceStatus } from '@/components/invoices/invoice-status'
import { RecordPaymentButton } from '@/components/payments/payment-buttons'
import { PaymentStatusBadge } from '@/components/payments/payment-status'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { todayIso } from '@/lib/bookings'
import { formatCents, formatDate } from '@/lib/format'
import { invoiceHref } from '@/lib/invoices'
import { getBookingInvoices } from '@/lib/invoices-data'
import { canRecordPayment } from '@/lib/payments'
import { getPaymentMethods, getPaymentStates, getPlatformBookings } from '@/lib/payments-data'

// Abschnitt „Rechnungen“ im Buchungsdetail (PROJ-37), Seite und Kalender-Panel, für alle Mitglieder.
// Nur sichtbar, wenn mindestens eine Rechnung verknüpft ist. Verrechnet mehr als den Gesamtpreis: nur ein Hinweis.
// Entwürfe (PROJ-40) stehen mit Status „Entwurf“ in der Liste; „Verrechnet“ zählt sie nicht, sie stehen darunter als
// „In Entwürfen“. Gutschriften (PROJ-44) stehen mit negativem Betrag darin, stornierte Rechnungen gekennzeichnet.
// Zahlungsstand je Rechnung, „Bezahlt“ und „Offen“ über die zahlbaren Rechnungen und „Zahlung erfassen“ (PROJ-45).
export async function BookingInvoicesSection({ bookingId, headingSize }: { bookingId: string; headingSize: string }) {
  const { invoices, billedCents, draftCents, bookingTotalCents } = await getBookingInvoices(bookingId)
  if (invoices.length === 0) return null
  const [t, tp, states, platform, methods] = await Promise.all([
    getTranslations('invoices.booking'),
    getTranslations('payments'),
    getPaymentStates(invoices.map((i) => ({ id: i.id, origin: i.origin, kind: i.kind, totalCents: i.totalCents, cancelled: i.cancelledBy !== null }))),
    getPlatformBookings([bookingId]),
    getPaymentMethods(),
  ])
  const over = bookingTotalCents !== null && billedCents > bookingTotalCents
  const payable = invoices.filter((i) => states.get(i.id) && canRecordPayment(states.get(i.id)!))
  const paidCents = payable.reduce((sum, i) => sum + (states.get(i.id)?.settledCents ?? 0), 0)
  const openCents = payable.reduce((sum, i) => sum + (states.get(i.id)?.openCents ?? 0), 0)
  const choices = payable.map((i) => ({
    id: i.id,
    label: i.number ?? '–',
    openCents: states.get(i.id)?.openCents ?? 0,
    platform: platform.has(bookingId),
    bookingId,
  }))

  return (
    <section className="flex flex-col gap-3">
      <h2 className={headingSize}>{t('title')}</h2>
      <ul className="flex flex-col divide-y rounded-lg bg-ds-surface px-4">
        {invoices.map((i) => (
          <li key={i.id} className="flex flex-col gap-1 py-3">
            <span className="flex items-baseline justify-between gap-4">
              <Link href={invoiceHref(i.id)} className="min-w-0 break-words font-medium text-ds-accent-700 underline underline-offset-[3px] hover:decoration-2">
                {i.number ?? t('draft')}
              </Link>
              <Amount cents={i.totalCents} className="shrink-0" />
            </span>
            <span className="break-words text-[13px] text-ds-neutral-800">
              {formatDate(i.invoiceDate)} · {i.recipient}
            </span>
            <span className="flex flex-wrap items-center gap-1.5">
              <InvoiceStatus origin={i.origin} kind={i.kind} hasPdf={i.hasPdf} cancelled={i.cancelledBy !== null} />
              {states.get(i.id) && <PaymentStatusBadge state={states.get(i.id)!} dash={false} />}
            </span>
            {states.get(i.id)?.mode === 'payable' && (states.get(i.id)?.openCents ?? 0) !== 0 && (
              <span className="text-[13px] text-ds-neutral-800">{tp('openShort', { amount: formatCents(states.get(i.id)!.openCents) })}</span>
            )}
          </li>
        ))}
      </ul>
      <dl className="flex flex-col divide-y rounded-lg bg-ds-surface px-4">
        <div className="flex items-baseline justify-between gap-4 py-3 font-semibold">
          <dt>{t('billed')}</dt>
          <dd>
            <Amount cents={billedCents} />
          </dd>
        </div>
        {invoices.some((i) => i.origin === 'draft') && (
          <div className="flex items-baseline justify-between gap-4 py-3">
            <dt>{t('inDrafts')}</dt>
            <dd>
              <Amount cents={draftCents} />
            </dd>
          </div>
        )}
        {bookingTotalCents !== null && (
          <div className="flex items-baseline justify-between gap-4 py-3">
            <dt>{t('bookingTotal')}</dt>
            <dd>
              <Amount cents={bookingTotalCents} />
            </dd>
          </div>
        )}
        {payable.length > 0 && (
          <>
            <div className="flex items-baseline justify-between gap-4 py-3">
              <dt>{tp('booking.paid')}</dt>
              <dd>
                <Amount cents={paidCents} />
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 py-3 font-semibold">
              <dt>{tp('booking.open')}</dt>
              <dd>
                <Amount cents={openCents} />
              </dd>
            </div>
          </>
        )}
      </dl>
      {choices.length > 0 && <RecordPaymentButton kind="payment" invoices={choices} methods={methods} today={todayIso()} variant="outline" />}
      {over && (
        <Alert className="border-ds-accent-700/40 bg-ds-accent-100">
          <AlertDescription>{t('overBilled')}</AlertDescription>
        </Alert>
      )}
    </section>
  )
}
