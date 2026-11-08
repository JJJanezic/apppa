import { FilePdf, Warning } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

import { ListPagination } from '@/components/list-pagination'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { bookingHref } from '@/lib/bookings'
import { formatDate } from '@/lib/format'
import { guestSheetListUrl, type GuestSheetPage, guestSheetPdfHref, type GuestSheetRow } from '@/lib/guest-sheet'

// Liste „Gästeblätter“ (PROJ-26): ab 768 px Tabelle, darunter Karten. Keine Zeile als Ganzes verlinkt (Safari-Regel):
// Die Lfd.-Nr. öffnet das PDF, die Buchungsnummer die Buchung. Mit „Gästeblatt fehlt“ die Buchungen ohne Blatt.
export function GuestSheetList({ page, today }: { page: GuestSheetPage; today: string }) {
  const t = useTranslations('guestSheets.list')
  const dash = <span className="text-ds-neutral-700">–</span>
  const booking = (id: string, number: string | null) => (
    <Link href={bookingHref(id)} className="text-ds-accent-700 underline-offset-[3px] hover:underline">
      {number ?? t('toBooking')}
    </Link>
  )
  const pdf = (r: GuestSheetRow) => (
    <a
      href={guestSheetPdfHref(r.id)}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 font-medium text-ds-accent-700 underline underline-offset-[3px] hover:decoration-2"
    >
      <FilePdf size={16} aria-hidden="true" />
      {r.sheetNumber ?? t('noNumber')}
    </a>
  )
  const notes = (r: GuestSheetRow) => (
    <span className="flex flex-wrap gap-1.5">
      {r.changed && (
        <Badge variant="outline" className="gap-1 border-ds-accent-2-700/40 bg-ds-accent-2-100 text-ds-accent-2-800">
          <Warning size={14} weight="fill" aria-hidden="true" />
          {t('changed')}
        </Badge>
      )}
      {r.cancelled && (
        <Badge variant="outline" className="border-ds-neutral-400">
          {t('cancelled')}
        </Badge>
      )}
    </span>
  )
  const pagination =
    page.pageCount > 1 ? (
      <ListPagination
        page={page.page}
        pageCount={page.pageCount}
        href={(n) => guestSheetListUrl({ ...page, page: n }, today)}
        labels={{ nav: t('pagination'), previous: t('previous'), next: t('next'), pageOf: t('pageOf', { page: page.page, pageCount: page.pageCount }) }}
      />
    ) : null

  if (page.missing) {
    return (
      <div className="flex flex-col gap-4">
        <Table className="hidden md:table">
          <TableHeader>
            <TableRow>
              <TableHead>{t('col.booking')}</TableHead>
              <TableHead>{t('col.guest')}</TableHead>
              <TableHead>{t('col.arrival')}</TableHead>
              <TableHead>{t('col.departure')}</TableHead>
              <TableHead>{t('col.apartment')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {page.missingRows.map((r) => (
              <TableRow key={r.bookingId}>
                <TableCell className="whitespace-nowrap">{booking(r.bookingId, r.bookingNumber)}</TableCell>
                <TableCell className="max-w-[280px] break-words">{r.guestName ?? dash}</TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">{formatDate(r.arrival)}</TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">{formatDate(r.departure)}</TableCell>
                <TableCell className="max-w-[240px] break-words">{r.apartmentLabel}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <ul className="flex flex-col gap-3 md:hidden">
          {page.missingRows.map((r) => (
            <li key={r.bookingId}>
              <Link href={bookingHref(r.bookingId)} className="flex flex-col gap-1.5 rounded-lg bg-ds-surface p-4 hover:bg-ds-neutral-200">
                <span className="break-words font-semibold">{r.guestName ?? t('noGuest')}</span>
                <span className="text-[13px] tabular-nums text-ds-neutral-800">
                  {formatDate(r.arrival)} – {formatDate(r.departure)}
                </span>
                <span className="text-[13px] text-ds-neutral-800">
                  {r.apartmentLabel}
                  {r.bookingNumber && <> · {t('bookingShort', { number: r.bookingNumber })}</>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
        {pagination}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <Table className="hidden md:table">
        <TableHeader>
          <TableRow>
            <TableHead>{t('col.sheetNumber')}</TableHead>
            <TableHead>{t('col.guest')}</TableHead>
            <TableHead>{t('col.arrival')}</TableHead>
            <TableHead>{t('col.departure')}</TableHead>
            <TableHead>{t('col.apartment')}</TableHead>
            <TableHead>{t('col.kind')}</TableHead>
            <TableHead>{t('col.marketing')}</TableHead>
            <TableHead>{t('col.booking')}</TableHead>
            <TableHead>
              <span className="sr-only">{t('col.notes')}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {page.rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="whitespace-nowrap">{pdf(r)}</TableCell>
              <TableCell className="max-w-[260px] break-words">{r.guestName ?? dash}</TableCell>
              <TableCell className="whitespace-nowrap tabular-nums">{formatDate(r.arrival)}</TableCell>
              <TableCell className="whitespace-nowrap tabular-nums">{formatDate(r.departure)}</TableCell>
              <TableCell className="max-w-[220px] break-words">{r.apartmentLabel}</TableCell>
              <TableCell className="whitespace-nowrap">{t(`kind.${r.kind}`)}</TableCell>
              <TableCell className="whitespace-nowrap">{r.marketingConsent ? t('marketingYes') : t('marketingNo')}</TableCell>
              <TableCell className="whitespace-nowrap">{booking(r.bookingId, r.bookingNumber)}</TableCell>
              <TableCell>{notes(r)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Handy: Karte mit zwei Links (PDF, Buchung), keine Karte als Ganzes verlinkt */}
      <ul className="flex flex-col gap-3 md:hidden">
        {page.rows.map((r) => (
          <li key={r.id} className="flex flex-col gap-1.5 rounded-lg bg-ds-surface p-4">
            <span className="flex items-start justify-between gap-3">
              <span className="min-w-0 break-words font-semibold">{r.guestName ?? t('noGuest')}</span>
              <span className="shrink-0 text-[13px] text-ds-neutral-800">{t(`kind.${r.kind}`)}</span>
            </span>
            <span className="text-[13px] tabular-nums text-ds-neutral-800">
              {formatDate(r.arrival)} – {formatDate(r.departure)} · {r.apartmentLabel}
            </span>
            <span className="text-[13px] text-ds-neutral-800">
              {t('col.marketing')}: {r.marketingConsent ? t('marketingYes') : t('marketingNo')}
            </span>
            {notes(r)}
            <span className="flex flex-wrap gap-x-4">
              <span className="flex min-h-11 items-center">{pdf(r)}</span>
              <span className="flex min-h-11 items-center">{booking(r.bookingId, r.bookingNumber)}</span>
            </span>
          </li>
        ))}
      </ul>
      {pagination}
    </div>
  )
}
