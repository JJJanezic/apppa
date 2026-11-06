import { Paperclip } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

import { Amount } from '@/components/amount'
import { ListPagination } from '@/components/list-pagination'
import { ReceiptLink } from '@/components/payments/receipt-link'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { bookingHref } from '@/lib/bookings'
import { formatDate } from '@/lib/format'
import { invoiceHref } from '@/lib/invoices'
import { type PaymentListRow, paymentListHref, type PaymentPage, signedCents } from '@/lib/payments'

// Zahlungsliste (PROJ-45): ab 768 px Tabelle (nur die Rechnungsnummer ist der Link – Safari), darunter Karten, die zur
// Rechnung führen. Rückzahlungen stehen mit Minus in Rot. Darunter die Summen über alle Seiten des Filters.
export function PaymentList({ page, today }: { page: PaymentPage; today: string }) {
  const t = useTranslations('payments.list')
  const dash = <span className="text-ds-neutral-700">–</span>
  const cents = (c: number) => (c ? <Amount cents={c} /> : dash)
  const booking = (r: PaymentListRow) =>
    r.booking ? (
      <Link href={bookingHref(r.booking.id)} className="text-ds-accent-700 underline-offset-[3px] hover:underline">
        {r.booking.number ?? t('toBooking')}
      </Link>
    ) : (
      dash
    )

  return (
    <div className="flex flex-col gap-4">
      <Table className="hidden md:table">
        <TableHeader>
          <TableRow>
            <TableHead>{t('col.date')}</TableHead>
            <TableHead>{t('col.invoice')}</TableHead>
            <TableHead>{t('col.recipient')}</TableHead>
            <TableHead>{t('col.booking')}</TableHead>
            <TableHead>{t('col.method')}</TableHead>
            <TableHead className="text-right">{t('col.amount')}</TableHead>
            <TableHead className="text-right">{t('col.commission')}</TableHead>
            <TableHead className="text-right">{t('col.fee')}</TableHead>
            <TableHead>
              <span className="sr-only">{t('col.receipt')}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {page.rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="whitespace-nowrap tabular-nums">{formatDate(r.paidOn)}</TableCell>
              <TableCell className="max-w-[180px]">
                <Link href={invoiceHref(r.invoice.id)} className="break-words font-medium text-ds-accent-700 underline underline-offset-[3px] hover:decoration-2">
                  {r.invoice.number ?? '–'}
                </Link>
                {r.kind === 'refund' && <span className="block text-[13px] text-ds-neutral-800">{t('refund')}</span>}
              </TableCell>
              <TableCell className="max-w-[280px] break-words">{r.invoice.recipient}</TableCell>
              <TableCell className="whitespace-nowrap">{booking(r)}</TableCell>
              <TableCell className="max-w-[180px] break-words">{r.methodName}</TableCell>
              <TableCell className="whitespace-nowrap text-right">
                <Amount cents={signedCents(r.kind, r.amountCents)} />
              </TableCell>
              <TableCell className="whitespace-nowrap text-right">{cents(r.commissionCents)}</TableCell>
              <TableCell className="whitespace-nowrap text-right">{cents(r.feeCents)}</TableCell>
              <TableCell className="w-12 py-0">{r.receiptType && <ReceiptLink paymentId={r.id} type={r.receiptType} />}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Handy: die Karte ist der Link zur Rechnung; Buchung und Beleg stehen als Text darin (kein Link im Link) */}
      <ul className="flex flex-col gap-3 md:hidden">
        {page.rows.map((r) => (
          <li key={r.id}>
            <Link href={invoiceHref(r.invoice.id)} className="flex flex-col gap-1.5 rounded-lg bg-ds-surface p-4 hover:bg-ds-neutral-200">
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0 break-words font-semibold">
                  {r.invoice.number ?? '–'}
                  {r.kind === 'refund' && <span className="font-normal text-ds-neutral-800"> · {t('refund')}</span>}
                </span>
                <Amount cents={signedCents(r.kind, r.amountCents)} className="shrink-0 font-semibold" />
              </span>
              <span className="break-words text-sm">{r.invoice.recipient}</span>
              <span className="text-[13px] tabular-nums text-ds-neutral-800">
                {formatDate(r.paidOn)} · {r.methodName}
                {r.booking && <> · {t('bookingShort', { number: r.booking.number ?? '–' })}</>}
              </span>
              {(r.commissionCents > 0 || r.feeCents > 0) && (
                <span className="text-[13px] text-ds-neutral-800">
                  {r.commissionCents > 0 && (
                    <>
                      {t('col.commission')} <Amount cents={r.commissionCents} />
                    </>
                  )}
                  {r.commissionCents > 0 && r.feeCents > 0 && ' · '}
                  {r.feeCents > 0 && (
                    <>
                      {t('col.fee')} <Amount cents={r.feeCents} />
                    </>
                  )}
                </span>
              )}
              {r.receiptType && (
                <span className="flex items-center gap-1 text-[13px] text-ds-neutral-800">
                  <Paperclip size={14} aria-hidden="true" />
                  {t('withReceipt')}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>

      <dl aria-label={t('totalsLabel')} className="grid gap-x-6 gap-y-1 rounded-lg bg-ds-surface px-4 py-3 sm:grid-cols-3">
        <div className="flex items-baseline justify-between gap-3 sm:flex-col sm:items-start">
          <dt className="text-[13px] text-ds-neutral-800">{t('totalReceived')}</dt>
          <dd className="font-semibold">
            <Amount cents={page.totals.receivedCents} />
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 sm:flex-col sm:items-start">
          <dt className="text-[13px] text-ds-neutral-800">{t('totalCommission')}</dt>
          <dd>
            <Amount cents={page.totals.commissionCents} />
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 sm:flex-col sm:items-start">
          <dt className="text-[13px] text-ds-neutral-800">{t('totalFee')}</dt>
          <dd>
            <Amount cents={page.totals.feeCents} />
          </dd>
        </div>
      </dl>

      {page.pageCount > 1 && (
        <ListPagination
          page={page.page}
          pageCount={page.pageCount}
          href={(n) => paymentListHref({ ...page, page: n }, today)}
          labels={{
            nav: t('pagination'),
            previous: t('previous'),
            next: t('next'),
            pageOf: t('pageOf', { page: page.page, pageCount: page.pageCount }),
          }}
        />
      )}
    </div>
  )
}
