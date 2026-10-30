import Link from 'next/link'
import { useTranslations } from 'next-intl'

import { Amount } from '@/components/amount'
import { InvoiceStatus } from '@/components/invoices/invoice-status'
import { ListPagination } from '@/components/list-pagination'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { bookingHref } from '@/lib/bookings'
import { formatDate } from '@/lib/format'
import { invoiceHref, invoiceListHref, type InvoicePage, type InvoiceRow } from '@/lib/invoices'

// Rechnungsliste (PROJ-37): ab 768 px Tabelle (die Nummer ist der Link), darunter Karten
export function InvoiceList({ page }: { page: InvoicePage }) {
  const t = useTranslations('invoices')
  const booking = (r: InvoiceRow) =>
    r.booking ? (
      <Link href={bookingHref(r.booking.id)} className="text-ds-accent-700 underline-offset-[3px] hover:underline">
        {r.booking.number ?? t('list.toBooking')}
      </Link>
    ) : (
      <span className="text-ds-neutral-700">–</span>
    )

  return (
    <div className="flex flex-col gap-4">
      <Table className="hidden md:table">
        <TableHeader>
          <TableRow>
            <TableHead>{t('col.number')}</TableHead>
            <TableHead>{t('col.date')}</TableHead>
            <TableHead>{t('col.recipient')}</TableHead>
            <TableHead>{t('col.booking')}</TableHead>
            <TableHead className="text-right">{t('col.amount')}</TableHead>
            <TableHead>{t('col.status')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {page.rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="max-w-[200px]">
                {/* Nur die Nummer ist der Link: Safari kann Klickflächen über die ganze Zeile (after:inset-0) nicht an <tr> verankern */}
                <Link href={invoiceHref(r.id)} className="break-words font-medium text-ds-accent-700 underline underline-offset-[3px] hover:decoration-2">
                  {r.number}
                </Link>
              </TableCell>
              <TableCell className="whitespace-nowrap tabular-nums">{formatDate(r.invoiceDate)}</TableCell>
              <TableCell className="max-w-[320px] break-words">{r.recipient}</TableCell>
              <TableCell className="whitespace-nowrap">{booking(r)}</TableCell>
              <TableCell className="whitespace-nowrap text-right">
                <Amount cents={r.totalCents} />
              </TableCell>
              <TableCell>
                <InvoiceStatus origin={r.origin} hasPdf={r.hasPdf} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Handy: die Karte ist der Link zur Rechnung; die Buchung steht als Text darin (kein Link im Link) */}
      <ul className="flex flex-col gap-3 md:hidden">
        {page.rows.map((r) => (
          <li key={r.id}>
            <Link href={invoiceHref(r.id)} className="flex flex-col gap-1.5 rounded-lg bg-ds-surface p-4 hover:bg-ds-neutral-200">
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0 break-words text-lg font-semibold">{r.number}</span>
                <Amount cents={r.totalCents} className="shrink-0" />
              </span>
              <span className="break-words text-sm">{r.recipient}</span>
              <span className="text-[13px] tabular-nums text-ds-neutral-800">
                {formatDate(r.invoiceDate)}
                {r.booking && <> · {t('list.bookingShort', { number: r.booking.number ?? '–' })}</>}
              </span>
              <InvoiceStatus origin={r.origin} hasPdf={r.hasPdf} />
            </Link>
          </li>
        ))}
      </ul>

      {page.pageCount > 1 && (
        <ListPagination
          page={page.page}
          pageCount={page.pageCount}
          href={(n) => invoiceListHref({ query: page.query, page: n })}
          labels={{
            nav: t('list.pagination'),
            previous: t('list.previous'),
            next: t('list.next'),
            pageOf: t('list.pageOf', { page: page.page, pageCount: page.pageCount }),
          }}
        />
      )}
    </div>
  )
}
