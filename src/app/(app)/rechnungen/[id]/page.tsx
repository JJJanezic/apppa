import { ArrowSquareOut, CaretLeft, DownloadSimple } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { Amount } from '@/components/amount'
import { InvoiceActions } from '@/components/invoices/invoice-buttons'
import { InvoiceStatus } from '@/components/invoices/invoice-status'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import { requireArea } from '@/lib/areas'
import { bookingHref, todayIso } from '@/lib/bookings'
import { formatDate, formatPeriod } from '@/lib/format'
import { guestDisplayName, guestHref } from '@/lib/guests'
import { invoiceVatShares, linesTotal } from '@/lib/invoices'
import { getInvoice } from '@/lib/invoices-data'
import { getTenantContext } from '@/lib/tenant'
import { formatVatRate } from '@/lib/vat'

type Params = Promise<{ id: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const [t, invoice] = await Promise.all([getTranslations('invoices'), getInvoice((await params).id)])
  return { title: t('detail.metaTitle', { number: invoice.number }) }
}

// Rechnungsdetail (PROJ-37) für alle Mitglieder; Bearbeiten und Löschen nur für Inhaber.
// Positionen sind eine Kopie: spätere Änderungen an der Buchung wirken nicht auf die Rechnung.
export default async function InvoiceDetailPage({ params }: { params: Params }) {
  await requireArea('invoices')
  const { id } = await params
  const t = await getTranslations('invoices')
  const tb = await getTranslations('bookings')
  const [invoice, { active }] = await Promise.all([getInvoice(id), getTenantContext()])
  const owner = active?.role === 'owner'
  const missing = <span className="text-ds-neutral-700">–</span>
  const shares = invoiceVatShares(invoice.lines, invoice.smallBusiness)
  const booking = invoice.booking

  return (
    <>
      <Link href="/rechnungen" className="-mb-6 flex min-h-11 w-fit items-center gap-1.5 text-ds-accent-700 underline-offset-[3px] hover:underline">
        <CaretLeft size={16} weight="bold" aria-hidden="true" />
        {t('detail.back')}
      </Link>
      <PageHeader eyebrow={t('detail.eyebrow')} title={<span className="break-words">{invoice.number}</span>} />

      <div className="-mt-4 flex flex-col gap-4">
        <InvoiceStatus origin={invoice.origin} hasPdf={invoice.pdfPath !== null} />
        {owner && <InvoiceActions invoice={invoice} today={todayIso()} />}
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <h2 className="text-2xl">{t('detail.data')}</h2>
          <dl className="flex flex-col divide-y rounded-lg bg-ds-surface px-4">
            <Fact label={t('detail.date')}>{formatDate(invoice.invoiceDate)}</Fact>
            <Fact label={t('detail.recipient')}>
              <span className="break-words">{invoice.recipient}</span>
            </Fact>
            <Fact label={t('detail.guest')}>
              {invoice.guest ? (
                <Link href={guestHref(invoice.guest.id)} className="text-ds-accent-700 underline-offset-[3px] hover:underline">
                  {guestDisplayName(invoice.guest)}
                </Link>
              ) : (
                missing
              )}
            </Fact>
            <Fact label={t('detail.booking')}>
              {booking ? (
                <span className="flex flex-col">
                  <Link href={bookingHref(booking.id)} className="w-fit text-ds-accent-700 underline-offset-[3px] hover:underline">
                    {[tb(`kind.${booking.kind}`), booking.number].filter(Boolean).join(' ')}
                  </Link>
                  <span className="text-[13px] text-ds-neutral-800">
                    {[booking.guestName, booking.apartmentLabel, formatPeriod(booking.arrival, booking.departure), booking.cancelled && tb('state.cancelled')]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
              ) : (
                missing
              )}
            </Fact>
          </dl>

          <h2 className="mt-5 text-2xl">{t('detail.pdf')}</h2>
          {invoice.pdf ? (
            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline" className="min-h-11">
                <a href={invoice.pdf.view} target="_blank" rel="noopener noreferrer">
                  <ArrowSquareOut size={18} aria-hidden="true" />
                  {t('detail.pdfOpen')}
                </a>
              </Button>
              <Button asChild variant="outline" className="min-h-11">
                <a href={invoice.pdf.download}>
                  <DownloadSimple size={18} aria-hidden="true" />
                  {t('detail.pdfDownload')}
                </a>
              </Button>
            </div>
          ) : (
            <p className="rounded-lg bg-ds-surface px-4 py-3 text-ds-neutral-800">{invoice.pdfPath ? t('detail.pdfUnavailable') : t('detail.pdfNone')}</p>
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-2xl">{t('detail.lines')}</h2>
          <dl className="flex flex-col divide-y rounded-lg bg-ds-surface px-4">
            {invoice.lines.map((l, i) => (
              <div key={i} className="flex items-baseline justify-between gap-4 py-3">
                <dt className="min-w-0 break-words">
                  {l.label}
                  {!invoice.smallBusiness && <span className="text-ds-neutral-800"> · {formatVatRate(l.vatBp)}</span>}
                </dt>
                <dd>
                  <Amount cents={l.amountCents} />
                </dd>
              </div>
            ))}
            <div className="flex items-baseline justify-between gap-4 py-3 font-semibold">
              <dt>{t('detail.total')}</dt>
              <dd>
                {/* Gesamtbetrag bildet die Datenbank; entspricht der Summe der Positionen */}
                <Amount cents={invoice.lines.length ? linesTotal(invoice.lines) : invoice.totalCents} />
              </dd>
            </div>
          </dl>
          {invoice.smallBusiness && <p className="text-[13px] text-ds-neutral-800">{t('detail.noVat')}</p>}
          {shares.length > 0 && (
            <div className="flex flex-col gap-1">
              <h3 id="enthaltene-ust" className="text-sm font-semibold">
                {t('detail.vatIncluded')}
              </h3>
              <dl aria-labelledby="enthaltene-ust" className="flex flex-col divide-y rounded-lg bg-ds-surface px-4 text-sm">
                {shares.map((s) => (
                  <div key={s.vatBp} className="flex items-baseline justify-between gap-4 py-2">
                    <dt>{formatVatRate(s.vatBp)}</dt>
                    <dd>
                      <Amount cents={s.vatCents} />
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          {booking && <p className="text-[13px] text-ds-neutral-800">{t('detail.copyNote')}</p>}
        </section>
      </div>
    </>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr] sm:gap-4">
      <dt className="text-[13px] text-ds-neutral-700 sm:text-sm">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}
