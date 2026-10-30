import Link from 'next/link'
import { useTranslations } from 'next-intl'

import { Amount } from '@/components/amount'
import { BookingBadges } from '@/components/bookings/booking-badges'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, formatNumber, formatPeriod } from '@/lib/format'
import { bookingHref, type BookingRow, nightsBetween } from '@/lib/bookings'
import { invoiceHref } from '@/lib/invoices'

interface BookingListProps {
  rows: BookingRow[]
  // Beträge nur für Inhaber
  showAmounts: boolean
}

// Buchungsliste (PROJ-8): ab 768 px Tabelle (der Name ist der Link), darunter Karten
export function BookingList({ rows, showAmounts }: BookingListProps) {
  const t = useTranslations('bookings')
  // „Mi, 28.10.2026 – Di, 03.11.2026“ (PROJ-31), immer mit Jahr
  const period = (r: BookingRow) => formatPeriod(r.arrival, r.departure)
  const title = (r: BookingRow) => r.guestName ?? (r.blockReason ? `${t('kind.block')}: ${t(`blockReason.${r.blockReason}`)}` : t('kind.block'))
  const amount = (r: BookingRow) => (r.totalCents === null ? '–' : <Amount cents={r.totalCents} />)
  // Buchungs- und Gästeblattnummer (PROJ-30)
  const numbers = (r: BookingRow) => [r.number, r.guestSheetNumber && t('guestSheetShort', { number: r.guestSheetNumber })].filter(Boolean).join(' · ')
  const badges = (r: BookingRow) => (
    <BookingBadges kind={r.kind} state={r.state} optionUntil={r.optionUntil} overlapping={r.overlapping} priceReview={showAmounts && r.priceReview} />
  )

  return (
    <div className="flex flex-col gap-4">
      <Table className="hidden md:table">
        <TableHeader>
          <TableRow>
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
              {/* Zeitraum zweizeilig wie die Spalte „Gast bzw. Sperre“ (PROJ-31): oben Anreise, darunter Abreise */}
              <TableCell className="whitespace-nowrap tabular-nums">
                <span className="block">{formatDate(r.arrival)}</span>
                <span className="sr-only"> – </span>
                <span className="block">{formatDate(r.departure)}</span>
              </TableCell>
              <TableCell className="max-w-[320px]">
                {/* Nur der Name ist der Link: Safari kann Klickflächen über die ganze Zeile (after:inset-0) nicht an <tr> verankern */}
                <Link href={bookingHref(r.id)} className="font-medium text-ds-accent-700 underline underline-offset-[3px] hover:decoration-2">
                  {title(r)}
                </Link>
                {(r.number || r.guestSheetNumber) && <span className="block break-words text-[13px] tabular-nums text-ds-neutral-700">{numbers(r)}</span>}
              </TableCell>
              <TableCell className="max-w-[240px] break-words">{r.apartmentLabel}</TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(nightsBetween(r.arrival, r.departure))}</TableCell>
              <TableCell className="text-right tabular-nums">{r.kind === 'block' ? '–' : formatNumber(r.persons)}</TableCell>
              <TableCell>{badges(r)}</TableCell>
              {/* Rechnungen der Buchung (PROJ-37): Nummern als Links, untereinander nach Rechnungsdatum; sonst leer */}
              <TableCell className="max-w-[160px]">
                {r.invoices.length > 0 && (
                  <ul className="flex flex-col gap-1">
                    {r.invoices.map((i) => (
                      <li key={i.id}>
                        <Link href={invoiceHref(i.id)} className="break-words text-ds-accent-700 underline underline-offset-[3px] hover:decoration-2">
                          {i.number}
                        </Link>
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
          <li key={r.id}>
            <Link href={bookingHref(r.id)} className="flex flex-col gap-1.5 rounded-lg bg-ds-surface p-4 hover:bg-ds-neutral-200">
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
                {(r.number || r.guestSheetNumber) && <> · {numbers(r)}</>}
              </span>
              {/* Handy: die Karte ist der Link zur Buchung, Rechnungsnummern daher als Text (kein Link im Link) */}
              {r.invoices.length > 0 && (
                <span className="break-words text-[13px] text-ds-neutral-800">{t('invoicesLine', { numbers: r.invoices.map((i) => i.number).join(', ') })}</span>
              )}
              {badges(r)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
