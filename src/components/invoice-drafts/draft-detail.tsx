import { Info } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'

import { Amount } from '@/components/amount'
import { DraftActions } from '@/components/invoice-drafts/draft-actions'
import { RequiredChecks } from '@/components/invoice-drafts/required-checks'
import { InvoiceStatus } from '@/components/invoices/invoice-status'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { bookingHref } from '@/lib/bookings'
import { formatDate, formatPeriod } from '@/lib/format'
import { addressLines } from '@/lib/guests'
import { invoiceEditHref, requiredChecks } from '@/lib/invoice-drafts'
import type { DraftView } from '@/lib/invoice-drafts-data'
import { buildPreviewModel } from '@/lib/invoice-preview'
import { formatVatRate } from '@/lib/vat'

// Detailseite eines Rechnungsentwurfs (PROJ-40) für Inhaber und Mitarbeiter: Status „Entwurf“, Art, Empfänger,
// Rechnungsdatum, Positionen bzw. Teilbetrag/Abzüge, Summen, Pflichtangaben. Zeitraum, Wohnung und Gastnamen kommen
// immer aktuell aus der Buchung; Positionen sind eine Kopie (Hinweis, wenn sich die Buchung geändert hat).
export async function DraftDetail({ view, owner }: { view: DraftView; owner: boolean }) {
  const t = await getTranslations('invoiceDrafts')
  const tb = await getTranslations('bookings')
  const locale = await getLocale()
  const { draft, booking, others, preview, smallBusiness, bookingChanged } = view
  const model = buildPreviewModel({
    kind: draft.kind,
    invoiceDate: draft.invoiceDate,
    recipientKind: draft.recipientKind,
    recipient: draft.recipient,
    companySalutation: draft.companySalutation,
    guestNameMode: draft.guestNames,
    lines: draft.lines,
    deductionIds: draft.deductionIds,
    texts: { intro: draft.texts.intro.body, payment: draft.texts.payment.body, closing: draft.texts.closing.body },
    payment: draft.payment,
    booking,
    others,
    preview,
    smallBusiness,
  })
  const checks = requiredChecks({
    issuer: preview.issuer,
    smallBusiness,
    kind: draft.kind,
    invoiceDate: draft.invoiceDate,
    booking,
    lineCount: draft.lines.length,
    partialCents: draft.kind === 'partial' ? model.totals.linesCents : 0,
    totalCents: model.totals.totalCents,
    recipient: draft.recipient,
  })
  const r = draft.recipient
  const recipientLines = addressLines({ lines: [r.line1, r.line2], postalCode: r.postalCode || null, city: r.city || null, country: r.country || null }, locale)
  const rate = (bp: number) => (smallBusiness ? null : formatVatRate(bp))
  const s = model.schedule

  return (
    <>
      <div className="-mt-4 flex flex-col gap-4">
        <InvoiceStatus origin="draft" kind={draft.kind} hasPdf={false} />
        {bookingChanged && (
          <Alert role="status" className="max-w-2xl border-ds-accent-700/40 bg-ds-accent-100">
            <Info size={18} weight="duotone" aria-hidden="true" />
            <AlertDescription className="flex flex-col items-start gap-3">
              {t('changed.text')}
              {owner && (
                <Button asChild variant="outline" className="min-h-11">
                  <Link href={invoiceEditHref(draft.id)}>{t('changed.reload')}</Link>
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}
        {(draft.deductionRemoved || model.missingDeductions > 0) && (
          <Alert className="max-w-2xl border-ds-neutral-400 bg-ds-surface">
            <Info size={18} weight="duotone" aria-hidden="true" />
            <AlertDescription>{t('deductions.removed')}</AlertDescription>
          </Alert>
        )}
        <DraftActions id={draft.id} owner={owner} />
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <h2 className="text-2xl">{t('detail.data')}</h2>
          <dl className="flex flex-col divide-y rounded-lg bg-ds-surface px-4">
            <Fact label={t('detail.kind')}>{t(`kind.${draft.kind}`)}</Fact>
            <Fact label={t('detail.number')}>{t('detail.noNumber')}</Fact>
            <Fact label={t('date.label')}>{formatDate(draft.invoiceDate)}</Fact>
            <Fact label={t('detail.recipient')}>
              <span className="flex flex-col break-words">
                <span className="text-[13px] text-ds-neutral-800">{t(`recipient.${draft.recipientKind}`)}</span>
                <span className="font-medium">{r.name || '–'}</span>
                {recipientLines.map((line) => (
                  <span key={line}>{line}</span>
                ))}
                {r.vatId && <span>{t('detail.vatId', { id: r.vatId })}</span>}
              </span>
            </Fact>
            <Fact label={t('detail.booking')}>
              <span className="flex flex-col">
                <Link href={bookingHref(booking.id)} className="w-fit text-ds-accent-700 underline-offset-[3px] hover:underline">
                  {[tb(`kind.${booking.kind}`), booking.number].filter(Boolean).join(' ')}
                </Link>
                <span className="text-[13px] text-ds-neutral-800">
                  {[booking.apartmentLabel, formatPeriod(booking.arrival, booking.departure), booking.cancelledAt && tb('state.cancelled')].filter(Boolean).join(' · ')}
                </span>
              </span>
            </Fact>
            <Fact label={t('guestNames.label')}>{model.guestNames.length ? model.guestNames.join(', ') : t('guestNames.none')}</Fact>
            <Fact label={t('detail.due')}>
              <span className="flex flex-col">
                <span>{formatDate(s.due)}</span>
                {s.depositCents !== null && s.depositDue && (
                  <span className="text-[13px] text-ds-neutral-800">
                    {t('detail.depositDue', { date: formatDate(s.depositDue) })} <Amount cents={s.depositCents} />
                  </span>
                )}
              </span>
            </Fact>
          </dl>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-2xl">{draft.kind === 'partial' ? t('partial.title') : t('lines.title')}</h2>
          <dl className="flex flex-col divide-y rounded-lg bg-ds-surface px-4">
            {model.partialLabel && <div className="break-words py-3 font-medium">{model.partialLabel}</div>}
            {draft.lines.length === 0 && <div className="py-3 text-ds-neutral-800">{t('detail.noLines')}</div>}
            {draft.lines.map((l, i) => (
              <div key={i} className="flex items-baseline justify-between gap-4 py-3">
                <dt className="min-w-0 break-words">
                  {model.partialLabel ? t('partial.share', { rate: formatVatRate(l.vatBp) }) : l.label}
                  {!model.partialLabel && rate(l.vatBp) && <span className="text-ds-neutral-800"> · {rate(l.vatBp)}</span>}
                </dt>
                <dd>
                  <Amount cents={l.amountCents} />
                </dd>
              </div>
            ))}
            {model.deductions.length > 0 && (
              <>
                <Row label={t('totals.lines')} cents={model.totals.linesCents} />
                {model.deductions.map((d) => (
                  <Row
                    key={d.id}
                    label={
                      d.origin === 'backfilled'
                        ? t('deductions.backfilled', { number: d.number ?? '–' })
                        : d.number
                          ? t('deductions.partial', { number: d.number })
                          : t('deductions.partialDraft')
                    }
                    cents={-d.totalCents}
                  />
                ))}
              </>
            )}
            <Row label={t('totals.total')} cents={model.totals.totalCents} strong />
          </dl>
          {smallBusiness && <p className="text-[13px] text-ds-neutral-800">{t('totals.noVat')}</p>}
          {model.totals.vatShares.length > 0 && (
            <div className="flex flex-col gap-1">
              <h3 id="entwurf-ust" className="text-sm font-semibold">
                {t('totals.vatIncluded')}
              </h3>
              <dl aria-labelledby="entwurf-ust" className="flex flex-col divide-y rounded-lg bg-ds-surface px-4 text-sm">
                {model.totals.vatShares.map((v) => (
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
          <p className="text-[13px] text-ds-neutral-800">{t('detail.copyNote')}</p>
        </section>
      </div>

      <div className="max-w-2xl">
        <RequiredChecks checks={checks} formHref={owner ? invoiceEditHref(draft.id) : undefined} settingsLink={owner} />
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
