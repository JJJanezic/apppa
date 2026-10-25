import Link from 'next/link'
import { useFormatter, useTranslations } from 'next-intl'

import { BookingBadges } from '@/components/bookings/booking-badges'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCurrency, formatNumber } from '@/lib/format'
import { bookingHref, type BookingRow, nightsBetween } from '@/lib/bookings'

interface BookingListProps {
  rows: BookingRow[]
  // Beträge nur für Inhaber
  showAmounts: boolean
  // Bei der Suche über alle Monate steht das Jahr dabei
  withYear: boolean
}

// Buchungsliste (PROJ-8): ab 768 px Tabelle (ganze Zeile klickbar über den Namen), darunter Karten
export function BookingList({ rows, showAmounts, withYear }: BookingListProps) {
  const t = useTranslations('bookings')
  const format = useFormatter()
  const day = (iso: string) =>
    format.dateTime(new Date(`${iso}T12:00:00`), withYear ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' })
  const period = (r: BookingRow) => `${day(r.arrival)} – ${day(r.departure)}`
  const title = (r: BookingRow) => r.guestName ?? (r.blockReason ? `${t('kind.block')}: ${t(`blockReason.${r.blockReason}`)}` : t('kind.block'))
  const amount = (r: BookingRow) => (r.totalCents === null ? '–' : formatCurrency(r.totalCents / 100, { cents: r.totalCents % 100 !== 0 }))
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
            {showAmounts && <TableHead className="text-right">{t('col.amount')}</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id} className={r.state === 'active' ? 'relative' : 'relative text-ds-neutral-800'}>
              <TableCell className="whitespace-nowrap tabular-nums">{period(r)}</TableCell>
              <TableCell className="max-w-[320px]">
                {/* Link über die ganze Zeile (after:inset-0), bleibt aber ein einzelner Tab-Stopp */}
                <Link
                  href={bookingHref(r.id)}
                  className="font-medium underline-offset-[3px] hover:underline after:absolute after:inset-0 after:content-['']"
                >
                  {title(r)}
                </Link>
                {r.number && <span className="block text-[13px] tabular-nums text-ds-neutral-700">{r.number}</span>}
              </TableCell>
              <TableCell className="max-w-[240px] break-words">{r.apartmentLabel}</TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(nightsBetween(r.arrival, r.departure))}</TableCell>
              <TableCell className="text-right tabular-nums">{r.kind === 'block' ? '–' : formatNumber(r.persons)}</TableCell>
              <TableCell>{badges(r)}</TableCell>
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
                {period(r)} · {t('nightsCount', { nights: nightsBetween(r.arrival, r.departure) })}
                {r.kind !== 'block' && <> · {t('personsCount', { persons: r.persons })}</>}
              </span>
              <span className="break-words text-[13px] text-ds-neutral-800">
                {r.apartmentLabel}
                {r.number && <> · {r.number}</>}
              </span>
              {badges(r)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
