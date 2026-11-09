import { FilePdf } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

import { ListPagination } from '@/components/list-pagination'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { bookingHref } from '@/lib/bookings'
import { formatDate } from '@/lib/format'
import { guestSheetListUrl, type GuestSheetPage, guestSheetPdfHref, type GuestSheetRow } from '@/lib/guest-sheet'
import { guestHref } from '@/lib/guests'

const LINK = 'text-ds-accent-700 underline-offset-[3px] hover:underline'

// Liste „Gästeblätter“ (PROJ-26, refine 2026-11-09): Buchungen mit Gästeblattnummer, absteigend nach Nummer. Spalten Lfd.-Nr.
// (Link zum PDF, wenn ein Blatt vorhanden ist), Buchung, Hauptgast (Link zur Gastseite), Ankunft, Abreise, Wohnung, Art.
// Mit „Buchungen ohne Gästeblatt“ die Buchungen ohne Nummer. Ab 768 px Tabelle, darunter Karten; keine Zeile als Ganzes
// verlinkt (Safari-Regel).
export function GuestSheetList({ page }: { page: GuestSheetPage }) {
  const t = useTranslations('guestSheets.list')
  const dash = <span className="text-ds-neutral-700">–</span>
  const booking = (id: string, number: string | null) => (
    <Link href={bookingHref(id)} className={LINK}>
      {number ?? t('toBooking')}
    </Link>
  )
  // Gastseite; anonymisierte Gäste ohne Link
  const guest = (r: { guestId: string | null; guestName: string | null; guestAnonymized: boolean }) =>
    r.guestId && r.guestName && !r.guestAnonymized ? (
      <Link href={guestHref(r.guestId)} className={LINK}>
        {r.guestName}
      </Link>
    ) : (
      (r.guestName ?? dash)
    )
  const number = (r: GuestSheetRow) =>
    r.sheetId ? (
      <a
        href={guestSheetPdfHref(r.sheetId)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t('openPdf', { number: r.sheetNumber })}
        className="inline-flex items-center gap-1.5 font-medium text-ds-accent-700 underline underline-offset-[3px] hover:decoration-2"
      >
        <FilePdf size={16} aria-hidden="true" />
        {r.sheetNumber}
      </a>
    ) : (
      <span className="font-medium">{r.sheetNumber}</span>
    )
  const pagination =
    page.pageCount > 1 ? (
      <ListPagination
        page={page.page}
        pageCount={page.pageCount}
        href={(n) => guestSheetListUrl({ ...page, page: n })}
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
                <TableCell className="max-w-[280px] break-words">{guest(r)}</TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">{formatDate(r.arrival)}</TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">{formatDate(r.departure)}</TableCell>
                <TableCell className="max-w-[240px] break-words">{r.apartmentLabel}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <ul className="flex flex-col gap-3 md:hidden">
          {page.missingRows.map((r) => (
            <li key={r.bookingId} className="flex flex-col gap-1.5 rounded-lg bg-ds-surface p-4">
              <span className="break-words font-semibold">{r.guestName ? guest(r) : t('noGuest')}</span>
              <span className="text-[13px] tabular-nums text-ds-neutral-800">
                {formatDate(r.arrival)} – {formatDate(r.departure)}
              </span>
              <span className="text-[13px] text-ds-neutral-800">{r.apartmentLabel}</span>
              <span className="flex min-h-11 items-center">{booking(r.bookingId, r.bookingNumber)}</span>
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
            <TableHead>{t('col.booking')}</TableHead>
            <TableHead>{t('col.guest')}</TableHead>
            <TableHead>{t('col.arrival')}</TableHead>
            <TableHead>{t('col.departure')}</TableHead>
            <TableHead>{t('col.apartment')}</TableHead>
            <TableHead>{t('col.kind')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {page.rows.map((r) => (
            <TableRow key={r.bookingId}>
              <TableCell className="whitespace-nowrap">{number(r)}</TableCell>
              <TableCell className="whitespace-nowrap">{booking(r.bookingId, r.bookingNumber)}</TableCell>
              <TableCell className="max-w-[260px] break-words">{guest(r)}</TableCell>
              <TableCell className="whitespace-nowrap tabular-nums">{formatDate(r.arrival)}</TableCell>
              <TableCell className="whitespace-nowrap tabular-nums">{formatDate(r.departure)}</TableCell>
              <TableCell className="max-w-[220px] break-words">{r.apartmentLabel}</TableCell>
              <TableCell className="whitespace-nowrap">{t(`kind.${r.kind}`)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Handy: Karte mit Links (PDF, Gast, Buchung), keine Karte als Ganzes verlinkt */}
      <ul className="flex flex-col gap-3 md:hidden">
        {page.rows.map((r) => (
          <li key={r.bookingId} className="flex flex-col gap-1.5 rounded-lg bg-ds-surface p-4">
            <span className="flex items-start justify-between gap-3">
              <span className="flex min-h-11 items-center">{number(r)}</span>
              <span className="shrink-0 pt-3 text-[13px] text-ds-neutral-800">{t(`kind.${r.kind}`)}</span>
            </span>
            <span className="break-words font-semibold">{r.guestName ? guest(r) : t('noGuest')}</span>
            <span className="text-[13px] tabular-nums text-ds-neutral-800">
              {formatDate(r.arrival)} – {formatDate(r.departure)} · {r.apartmentLabel}
            </span>
            <span className="flex min-h-11 items-center">{booking(r.bookingId, r.bookingNumber)}</span>
          </li>
        ))}
      </ul>
      {pagination}
    </div>
  )
}
