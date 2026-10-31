import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { Amount } from '@/components/amount'
import { InvoiceStatus } from '@/components/invoices/invoice-status'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { formatDate } from '@/lib/format'
import { invoiceHref } from '@/lib/invoices'
import { getBookingInvoices } from '@/lib/invoices-data'

// Abschnitt „Rechnungen“ im Buchungsdetail (PROJ-37), Seite und Kalender-Panel, für alle Mitglieder.
// Nur sichtbar, wenn mindestens eine Rechnung verknüpft ist. Verrechnet mehr als den Gesamtpreis: nur ein Hinweis.
// Entwürfe (PROJ-40) stehen mit Status „Entwurf“ in der Liste; „Verrechnet“ zählt sie nicht, sie stehen darunter als
// „In Entwürfen“.
export async function BookingInvoicesSection({ bookingId, headingSize }: { bookingId: string; headingSize: string }) {
  const { invoices, billedCents, draftCents, bookingTotalCents } = await getBookingInvoices(bookingId)
  if (invoices.length === 0) return null
  const t = await getTranslations('invoices.booking')
  const over = bookingTotalCents !== null && billedCents > bookingTotalCents

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
            <InvoiceStatus origin={i.origin} kind={i.kind} hasPdf={i.hasPdf} />
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
      </dl>
      {over && (
        <Alert className="border-ds-accent-700/40 bg-ds-accent-100">
          <AlertDescription>{t('overBilled')}</AlertDescription>
        </Alert>
      )}
    </section>
  )
}
