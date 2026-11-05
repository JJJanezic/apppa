import { ArrowSquareOut, DownloadSimple } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'

import { Amount } from '@/components/amount'
import { Button } from '@/components/ui/button'
import { bookingHref } from '@/lib/bookings'
import { formatDate, formatDateTime, formatPeriod } from '@/lib/format'
import { addressLines, guestDisplayName, guestHref } from '@/lib/guests'
import type { Invoice } from '@/lib/invoices'
import { formatVatRate } from '@/lib/vat'

// Angaben einer ausgestellten Rechnung (PROJ-42): nur aus der festgeschriebenen Fassung. Spätere Änderungen an Buchung, Gast oder
// Stammdaten wirken hier nicht; Links führen nur zu den noch verknüpften Datensätzen.
export async function IssuedDetail({ invoice, issued }: { invoice: Invoice; issued: NonNullable<Invoice['issued']> }) {
  const t = await getTranslations('invoices.detail')
  const td = await getTranslations('invoiceDrafts')
  const tb = await getTranslations('bookings')
  const locale = await getLocale()
  const s = issued.snapshot
  const r = s.recipient
  const i = s.issuer
  const recipientLines = addressLines({ lines: [r.line1, r.line2], postalCode: r.postalCode || null, city: r.city || null, country: r.country || null }, locale)
  const issuerLines = i ? addressLines({ lines: [i.addressLine1 ?? '', i.addressLine2 ?? ''], postalCode: i.postalCode, city: i.city, country: i.country }, locale) : []
  const rate = (bp: number) => (s.smallBusiness ? null : formatVatRate(bp))

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section className="flex flex-col gap-3">
        <h2 className="text-2xl">{t('data')}</h2>
        <dl className="flex flex-col divide-y rounded-lg bg-ds-surface px-4">
          <Fact label={t('kind')}>{td(`kind.${s.kind}`)}</Fact>
          <Fact label={t('date')}>{formatDate(invoice.invoiceDate)}</Fact>
          <Fact label={t('issuedAt')}>{formatDateTime(issued.at)}</Fact>
          {issued.byName && <Fact label={t('issuedBy')}>{issued.byName}</Fact>}
          <Fact label={t('recipient')}>
            <span className="flex flex-col break-words">
              <span className="font-medium">{r.name || '–'}</span>
              {recipientLines.map((line) => (
                <span key={line}>{line}</span>
              ))}
              {r.vatId && <span>{td('detail.vatId', { id: r.vatId })}</span>}
            </span>
          </Fact>
          {i && (
            <Fact label={t('issuer')}>
              <span className="flex flex-col break-words">
                <span className="font-medium">{[i.name, i.nameLine2].filter(Boolean).join(' ')}</span>
                {issuerLines.map((line) => (
                  <span key={line}>{line}</span>
                ))}
                {i.vatId && <span>{td('detail.vatId', { id: i.vatId })}</span>}
              </span>
            </Fact>
          )}
          <Fact label={t('period')}>
            {s.period.apartmentLabel} · {formatPeriod(s.period.arrival, s.period.departure)}
          </Fact>
          {s.guestNames.length > 0 && <Fact label={t('guestNames')}>{s.guestNames.join(', ')}</Fact>}
          {invoice.guest && (
            <Fact label={t('guest')}>
              <Link href={guestHref(invoice.guest.id)} className="text-ds-accent-700 underline-offset-[3px] hover:underline">
                {guestDisplayName(invoice.guest)}
              </Link>
            </Fact>
          )}
          {invoice.booking && (
            <Fact label={t('booking')}>
              <Link href={bookingHref(invoice.booking.id)} className="text-ds-accent-700 underline-offset-[3px] hover:underline">
                {[tb(`kind.${invoice.booking.kind}`), invoice.booking.number].filter(Boolean).join(' ')}
              </Link>
            </Fact>
          )}
          <Fact label={t('due')}>
            <span className="flex flex-col">
              <span>{formatDate(s.schedule.due)}</span>
              {s.schedule.depositCents !== null && s.schedule.depositDue && (
                <span className="text-[13px] text-ds-neutral-800">
                  {t('depositDue', { date: formatDate(s.schedule.depositDue) })} <Amount cents={s.schedule.depositCents} />
                </span>
              )}
            </span>
          </Fact>
        </dl>

        <h2 className="mt-5 text-2xl">{t('pdf')}</h2>
        {invoice.pdf ? (
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="outline" className="min-h-11">
              <a href={invoice.pdf.view} target="_blank" rel="noopener noreferrer">
                <ArrowSquareOut size={18} aria-hidden="true" />
                {t('pdfOpen')}
              </a>
            </Button>
            <Button asChild variant="outline" className="min-h-11">
              <a href={invoice.pdf.download}>
                <DownloadSimple size={18} aria-hidden="true" />
                {t('pdfDownload')}
              </a>
            </Button>
          </div>
        ) : (
          <p className="rounded-lg bg-ds-surface px-4 py-3 text-ds-neutral-800">{t('pdfUnavailable')}</p>
        )}
        {issued.withoutLogo && <p className="text-[13px] text-ds-neutral-800">{t('withoutLogo')}</p>}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-2xl">{t('lines')}</h2>
        <dl className="flex flex-col divide-y rounded-lg bg-ds-surface px-4">
          {s.partialLabel && <div className="break-words py-3 font-medium">{s.partialLabel}</div>}
          {s.lines.map((l, index) => (
            <Row
              key={index}
              label={s.partialLabel ? td('partial.share', { rate: formatVatRate(l.vatBp) }) : [l.label, rate(l.vatBp)].filter(Boolean).join(' · ')}
              cents={l.amountCents}
            />
          ))}
          {s.deductions.length > 0 && <Row label={t('linesTotal')} cents={s.totals.linesCents} />}
          {s.deductions.map((d, index) => (
            <Row key={index} label={t(d.origin === 'backfilled' ? 'deductionBackfilled' : 'deductionPartial', { number: d.number ?? '–' })} cents={-d.totalCents} />
          ))}
          <Row label={t('total')} cents={s.totals.totalCents} strong />
        </dl>
        {s.smallBusiness && <p className="text-[13px] text-ds-neutral-800">{t('noVat')}</p>}
        {s.totals.vatShares.length > 0 && (
          <div className="flex flex-col gap-1">
            <h3 id="enthaltene-ust" className="text-sm font-semibold">
              {t('vatIncluded')}
            </h3>
            <dl aria-labelledby="enthaltene-ust" className="flex flex-col divide-y rounded-lg bg-ds-surface px-4 text-sm">
              {s.totals.vatShares.map((v) => (
                <div key={v.vatBp} className="flex items-baseline justify-between gap-4 py-2">
                  <dt>{formatVatRate(v.vatBp)}</dt>
                  <dd>
                    <Amount cents={v.vatCents} />
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </section>
    </div>
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

function Row({ label, cents, strong }: { label: string; cents: number; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-3 ${strong ? 'font-semibold' : ''}`}>
      <dt className="min-w-0 break-words">{label}</dt>
      <dd className="shrink-0">
        <Amount cents={cents} />
      </dd>
    </div>
  )
}
