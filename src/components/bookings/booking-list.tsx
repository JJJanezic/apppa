import Link from 'next/link'
import { useTranslations } from 'next-intl'

import { Amount } from '@/components/amount'
import { BookingBadges } from '@/components/bookings/booking-badges'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, formatNumber, formatPeriod } from '@/lib/format'
import { bookingHref, type BookingRow, isPlatformSource, nightsBetween, platformNumberKey } from '@/lib/bookings'
import { guestSheetPdfHref } from '@/lib/guest-sheet'
import { guestHref } from '@/lib/guests'
import { invoiceHref } from '@/lib/invoices'

interface BookingListProps {
  rows: BookingRow[]
  // Beträge nur für Inhaber
  showAmounts: boolean
  // Suchbegriff der Buchungsübersicht: trifft er die Plattform-Nummer, steht sie bei der Buchungsnummer (PROJ-47)
  query?: string
  // Name als Link zur Gastseite (nicht auf der Gastseite selbst)
  guestLinks?: boolean
}

// Buchungsliste (PROJ-8): ab 768 px Tabelle, darunter Karten. In der Tabelle führt die Buchungsnummer (erste Spalte) zur
// Buchung und der Name des Gastes zur Gastseite (refine 2026-11-07); Sperren haben keine Nummer, dort führt der Text zur Sperre.
export function BookingList({ rows, showAmounts, query = '', guestLinks = true }: BookingListProps) {
  const t = useTranslations('bookings')
  // „Mi, 28.10.2026 – Di, 03.11.2026“ (PROJ-31), immer mit Jahr
  const period = (r: BookingRow) => formatPeriod(r.arrival, r.departure)
  const title = (r: BookingRow) => r.guestName ?? (r.blockReason ? `${t('kind.block')}: ${t(`blockReason.${r.blockReason}`)}` : t('kind.block'))
  const amount = (r: BookingRow) => (r.totalCents === null ? '–' : <Amount cents={r.totalCents} />)
  // Gästeblattnummer (PROJ-30) unter der Buchungsnummer; mit aktuellem Blatt führt die Nummer zum PDF (PROJ-26, refine
  // 2026-11-09), in einem neuen Tab wie in der Liste „Gästeblätter“
  // Plattform-Nummer nur bei einem Suchtreffer in ihr (gleiche Bereinigung wie die Suche, ab 2 Zeichen)
  const term = platformNumberKey(query.replace(/[^\p{L}\d\s-]/gu, ''))
  const platform = (r: BookingRow) =>
    term.length >= 2 && r.platformNumber && isPlatformSource(r.source) && platformNumberKey(r.platformNumber).includes(term)
      ? t(`platformNumberShort.${r.source}`, { number: r.platformNumber })
      : null
  const linkClass = 'font-medium text-ds-accent-700 underline underline-offset-[3px] hover:decoration-2'
  const sheetPdf = (r: BookingRow) =>
    r.guestSheetId && r.guestSheetNumber
      ? t.rich('guestSheetLink', {
          number: r.guestSheetNumber,
          pdf: (chunks) => (
            <a
              href={guestSheetPdfHref(r.guestSheetId!)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t('guestSheetPdf', { number: r.guestSheetNumber! })}
              className="text-ds-accent-700 underline underline-offset-[3px] hover:decoration-2"
            >
              {chunks}
            </a>
          ),
        })
      : null
  // Tabelle: Gästeblattnummer (Link oder Text) und Plattform-Nummer, mit „ · “ getrennt
  const extraNumbers = (r: BookingRow) => {
    const parts = [
      r.guestSheetNumber && (sheetPdf(r) ?? t('guestSheetShort', { number: r.guestSheetNumber })),
      platform(r),
    ].filter(Boolean)
    if (parts.length === 0) return null
    return parts.map((p, i) => (
      <span key={i}>
        {i > 0 && ' · '}
        {p}
      </span>
    ))
  }
  // Handy: Die Karte ist der Link zur Buchung; ein Gästeblatt-PDF steht deshalb als eigener Link unter der Karte
  const cardNumbers = (r: BookingRow) =>
    [r.guestSheetNumber && !sheetPdf(r) && t('guestSheetShort', { number: r.guestSheetNumber }), platform(r)].filter(Boolean).join(' · ')
  const badges = (r: BookingRow) => (
    <BookingBadges kind={r.kind} state={r.state} optionUntil={r.optionUntil} overlapping={r.overlapping} priceReview={showAmounts && r.priceReview} />
  )

  return (
    <div className="flex flex-col gap-4">
      <Table className="hidden md:table">
        <TableHeader>
          <TableRow>
            <TableHead>{t('col.number')}</TableHead>
            <TableHead>{t('col.period')}</TableHead>
            <TableHead>{t('col.guest')}</TableHead>
            <TableHead>{t('col.apartment')}</TableHead>
            <TableHead className="text-right">{t('col.nights')}</TableHead>
            <TableHead className="text-right">{t('col.persons')}</TableHead>
            <TableHead>{t('col.status')}</TableHead>
            <TableHead>{t('col.invoices')}</TableHead>
            {showAmounts && <TableHead className="text-right">{t('col.amount')}</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id} className={r.state === 'active' ? undefined : 'text-ds-neutral-800'}>
              {/* Nur Links in den Zellen: Safari kann Klickflächen über die ganze Zeile (after:inset-0) nicht an <tr> verankern */}
              <TableCell className="max-w-[160px] tabular-nums">
                {r.number ? (
                  <Link href={bookingHref(r.id)} className={`whitespace-nowrap ${linkClass}`}>
                    {r.number}
                  </Link>
                ) : (
                  <span aria-hidden="true">–</span>
                )}
                {extraNumbers(r) && <span className="block break-words text-[13px] text-ds-neutral-700">{extraNumbers(r)}</span>}
              </TableCell>
              {/* Zeitraum zweizeilig wie die Spalte „Gast bzw. Sperre“ (PROJ-31): oben Anreise, darunter Abreise */}
              <TableCell className="whitespace-nowrap tabular-nums">
                <span className="block">{formatDate(r.arrival)}</span>
                <span className="sr-only"> – </span>
                <span className="block">{formatDate(r.departure)}</span>
              </TableCell>
              <TableCell className="max-w-[320px] break-words">
                {r.guestId && guestLinks ? (
                  <Link href={guestHref(r.guestId)} className={linkClass}>
                    {title(r)}
                  </Link>
                ) : !r.number ? (
                  <Link href={bookingHref(r.id)} className={linkClass}>
                    {title(r)}
                  </Link>
                ) : (
                  <span className="font-medium">{title(r)}</span>
                )}
              </TableCell>
              <TableCell className="max-w-[240px] break-words">{r.apartmentLabel}</TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(nightsBetween(r.arrival, r.departure))}</TableCell>
              <TableCell className="text-right tabular-nums">{r.kind === 'block' ? '–' : formatNumber(r.persons)}</TableCell>
              <TableCell>{badges(r)}</TableCell>
              {/* Rechnungen der Buchung (PROJ-37): Nummern als Links, untereinander nach Rechnungsdatum; Entwürfe als
                  „Entwurf“ (PROJ-40), stornierte Rechnungen mit „(storniert)“ (PROJ-44); sonst leer */}
              <TableCell className="max-w-[160px]">
                {r.invoices.length > 0 && (
                  <ul className="flex flex-col gap-1">
                    {r.invoices.map((i) => (
                      <li key={i.id}>
                        <Link href={invoiceHref(i.id)} className="break-words text-ds-accent-700 underline underline-offset-[3px] hover:decoration-2">
                          {i.number ?? t('invoiceDraft')}
                        </Link>
                        {i.cancelled && <span className="text-[13px] text-ds-neutral-800"> {t('invoiceCancelled')}</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </TableCell>
              {showAmounts && <TableCell className="whitespace-nowrap text-right tabular-nums">{amount(r)}</TableCell>}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ul className="flex flex-col gap-3 md:hidden">
        {rows.map((r) => (
          <li key={r.id} className="flex flex-col rounded-lg bg-ds-surface">
            <Link href={bookingHref(r.id)} className="flex flex-col gap-1.5 rounded-lg p-4 hover:bg-ds-neutral-200">
              {r.number && <span className="text-[13px] font-medium tabular-nums text-ds-neutral-800">{r.number}</span>}
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0 break-words text-lg font-semibold">{title(r)}</span>
                {showAmounts && r.totalCents !== null && <span className="shrink-0 tabular-nums">{amount(r)}</span>}
              </span>
              <span className="text-sm tabular-nums">
                {/* Zahl und Wort bleiben zusammen (QA PROJ-31 BUG-5) */}
                {period(r)} · <span className="whitespace-nowrap">{t('nightsCount', { nights: nightsBetween(r.arrival, r.departure) })}</span>
                {r.kind !== 'block' && (
                  <>
                    {' '}
                    · <span className="whitespace-nowrap">{t('personsCount', { persons: r.persons })}</span>
                  </>
                )}
              </span>
              <span className="break-words text-[13px] text-ds-neutral-800">
                {r.apartmentLabel}
                {cardNumbers(r) && <> · {cardNumbers(r)}</>}
              </span>
              {/* Handy: die Karte ist der Link zur Buchung, Rechnungsnummern daher als Text (kein Link im Link) */}
              {r.invoices.length > 0 && (
                <span className="break-words text-[13px] text-ds-neutral-800">{t('invoicesLine', { numbers: r.invoices.map((i) => [i.number ?? t('invoiceDraft'), i.cancelled && t('invoiceCancelled')].filter(Boolean).join(' ')).join(', ') })}</span>
              )}
              {badges(r)}
            </Link>
            {sheetPdf(r) && (
              <span className="flex min-h-11 items-center break-words px-4 pb-2 text-[13px] text-ds-neutral-800">
                {sheetPdf(r)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
