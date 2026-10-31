import { useLocale, useTranslations } from 'next-intl'

import { Amount } from '@/components/amount'
import { RichTextView } from '@/components/invoice-settings/rich-text-view'
import { Badge } from '@/components/ui/badge'
import { DRAFT_NUMBER_TEXT } from '@/lib/invoice-drafts'
import type { InvoicePreviewModel, PreviewDeduction } from '@/lib/invoice-preview'
import { textDate } from '@/lib/invoice-texts'
import { countryName } from '@/lib/guests'
import type { RichDoc } from '@/lib/rich-text'
import { isDocEmpty } from '@/lib/rich-text'
import { formatVatRate, type VatShare } from '@/lib/vat'

// Vorschau des Rechnungsentwurfs (PROJ-40) in Seitenform, gemeinsam für Vorschau-Seite und Formular (ungespeicherter
// Stand). Reihenfolge wie PROJ-39: Kopfzeile, Block 1, 2a, 2b, 2c, 3, 4, 5, Kleinunternehmer-Hinweis, 6, 7, Fußzeile.
// Platzhalter ersetzt, Datumsangaben ohne Wochentag, deutlich als „Entwurf“ gekennzeichnet. Schlicht: Logo, Schrift
// und Anordnung folgen mit dem PDF (PROJ-41).
export function InvoicePreview({ model }: { model: InvoicePreviewModel }) {
  const t = useTranslations('invoiceDrafts.preview')
  const locale = useLocale()
  const m = model
  const issuer = m.issuer
  const r = m.recipient
  const place = (postalCode: string | null, city: string | null) => [postalCode, city].filter(Boolean).join(' ')
  const vatRate = (bp: number) => (m.smallBusiness ? null : formatVatRate(bp))

  return (
    <article
      aria-label={t('label')}
      className="relative flex min-w-0 max-w-[820px] flex-col gap-7 break-words rounded-lg border border-ds-neutral-400 bg-ds-bg px-4 py-6 text-[15px] leading-relaxed sm:px-10 sm:py-10"
    >
      <Badge variant="outline" className="absolute right-4 top-4 border-ds-accent-2-700 font-semibold uppercase tracking-[0.12em] text-ds-accent-2-700 sm:right-10 sm:top-10">
        {t('draftMark')}
      </Badge>

      {/* Kopfzeile: Aussteller */}
      <header className="flex flex-col pr-24 text-sm text-ds-neutral-800">
        {issuer ? (
          <>
            <span className="font-semibold text-ds-text">{issuer.name}</span>
            {issuer.nameLine2 && <span>{issuer.nameLine2}</span>}
            {issuer.addressLine1 && <span>{issuer.addressLine1}</span>}
            {issuer.addressLine2 && <span>{issuer.addressLine2}</span>}
            {place(issuer.postalCode, issuer.city) && <span>{place(issuer.postalCode, issuer.city)}</span>}
            {issuer.country && <span>{countryName(issuer.country, locale)}</span>}
            {issuer.vatId && <span>{t('vatId', { id: issuer.vatId })}</span>}
          </>
        ) : (
          <span>{t('issuerMissing')}</span>
        )}
      </header>

      {/* Block 1: Empfänger */}
      <section aria-label={t('recipient')} className="flex flex-col">
        {r.name ? <span className="font-medium">{r.name}</span> : <span className="text-ds-neutral-700">{t('recipientMissing')}</span>}
        {r.line1 && <span>{r.line1}</span>}
        {r.line2 && <span>{r.line2}</span>}
        {place(r.postalCode, r.city) && <span>{place(r.postalCode, r.city)}</span>}
        {r.country && <span>{countryName(r.country, locale)}</span>}
        {r.vatId && <span>{t('vatId', { id: r.vatId })}</span>}
      </section>

      {/* Block 2b: Ort, Rechnungsdatum */}
      <p className="sm:text-right">{[issuer?.city, m.invoiceDate ? textDate(m.invoiceDate) : null].filter(Boolean).join(', ')}</p>

      <div className="flex flex-col gap-1">
        <h2 className="text-2xl">{t(`title.${m.kind}`)}</h2>
        {/* Block 2c: Nummer erst beim Ausstellen (PROJ-41) */}
        <p>{t('number', { number: DRAFT_NUMBER_TEXT })}</p>
        {/* Block 2a */}
        <p>{t('period', { apartment: m.booking.apartmentLabel, arrival: textDate(m.booking.arrival), departure: textDate(m.booking.departure) })}</p>
        {/* Block 3 */}
        {m.guestNames.length > 0 && <p>{t('guests', { names: m.guestNames.join(', ') })}</p>}
      </div>

      <Text doc={m.texts.intro} values={m.values} />

      {/* Block 5: Leistungen */}
      <section aria-label={t('services')} className="flex flex-col gap-2">
        <dl className="flex flex-col divide-y border-y">
          {m.partialLabel ? (
            <>
              <div className="py-2 font-medium">{m.partialLabel}</div>
              {m.lines.map((l, i) => (
                <Row key={i} label={vatRate(l.vatBp) ? t('partialShare', { rate: vatRate(l.vatBp) ?? '' }) : t('partialAmount')} cents={l.amountCents} muted />
              ))}
            </>
          ) : m.lines.length ? (
            m.lines.map((l, i) => <Row key={i} label={l.label} rate={vatRate(l.vatBp)} cents={l.amountCents} />)
          ) : (
            <div className="py-2 text-ds-neutral-700">{t('noLines')}</div>
          )}
          {m.deductions.length > 0 && (
            <>
              <Row label={t('subtotal')} cents={m.totals.linesCents} strong />
              {m.deductions.map((d) => (
                <Deduction key={d.id} d={d} />
              ))}
            </>
          )}
          <Row label={t('total')} cents={m.totals.totalCents} strong />
        </dl>
        {m.missingDeductions > 0 && <p className="text-sm text-ds-accent-2-800">{t('deductionMissing')}</p>}
        {m.totals.vatShares.length > 0 && <VatList shares={m.totals.vatShares} title={t('vatIncluded')} />}
      </section>

      {/* Kleinunternehmer-Hinweis (fest, nicht änderbar) */}
      {m.smallBusiness && <RichTextView doc={m.smallBusinessNote} className="text-sm" />}

      <Text doc={m.texts.payment} values={m.values} />
      <Text doc={m.texts.closing} values={m.values} />

      {m.footer && !isDocEmpty(m.footer) && (
        <footer className="border-t pt-4 text-[13px] text-ds-neutral-800">
          <RichTextView doc={m.footer} />
        </footer>
      )}
    </article>
  )
}

function Text({ doc, values }: { doc: RichDoc | null; values: InvoicePreviewModel['values'] }) {
  if (!doc || isDocEmpty(doc)) return null
  return <RichTextView doc={doc} values={values} />
}

function Row({ label, rate, cents, strong, muted }: { label: string; rate?: string | null; cents: number; strong?: boolean; muted?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-2 ${strong ? 'font-semibold' : ''} ${muted ? 'pl-4 text-sm text-ds-neutral-800' : ''}`}>
      <dt className="min-w-0 break-words">
        {label}
        {rate && <span className="text-ds-neutral-800"> · {rate}</span>}
      </dt>
      <dd className="shrink-0">
        <Amount cents={cents} />
      </dd>
    </div>
  )
}

// „abzüglich Teilrechnung 2026-0012 vom 03.10.2026“ mit Betrag und USt je Satz
function Deduction({ d }: { d: PreviewDeduction }) {
  const t = useTranslations('invoiceDrafts.preview')
  const what = d.origin === 'backfilled' ? 'invoice' : d.kind === 'partial' ? 'partial' : 'invoice'
  const label = t(d.number ? `deduction.${what}` : `deduction.${what}Draft`, { number: d.number ?? '', date: textDate(d.invoiceDate) })
  return (
    <div className="flex flex-col gap-1 py-2">
      <div className="flex items-baseline justify-between gap-4">
        <dt className="min-w-0 break-words">{label}</dt>
        <dd className="shrink-0">
          <Amount cents={-d.totalCents} />
        </dd>
      </div>
      {d.vatShares.length > 0 && (
        <p className="pl-4 text-[13px] text-ds-neutral-800">
          {d.vatShares.map((s, i) => (
            <span key={s.vatBp}>
              {i > 0 && ' · '}
              {t('deductionVat', { rate: formatVatRate(s.vatBp) })} <Amount cents={-s.vatCents} />
            </span>
          ))}
        </p>
      )}
    </div>
  )
}

function VatList({ shares, title }: { shares: VatShare[]; title: string }) {
  return (
    <div className="flex flex-col gap-1 text-sm">
      <span className="font-semibold">{title}</span>
      <dl className="flex flex-col">
        {shares.map((s) => (
          <div key={s.vatBp} className="flex items-baseline justify-between gap-4">
            <dt>{formatVatRate(s.vatBp)}</dt>
            <dd>
              <Amount cents={s.vatCents} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
