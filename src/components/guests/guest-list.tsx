'use client'

import { CaretLeft, CaretRight } from '@phosphor-icons/react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Pagination, PaginationContent, PaginationItem } from '@/components/ui/pagination'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, formatNumber } from '@/lib/format'
import { countryName, guestHref, guestListHref, type GuestPage, type GuestRow, guestSortName } from '@/lib/guests'

// Gästeliste (PROJ-7): ab 768 px Tabelle (der Name ist der Link), darunter Karten
export function GuestList({ page }: { page: GuestPage }) {
  const t = useTranslations('guests')
  const locale = useLocale()
  const lastStay = (row: GuestRow) =>
    row.lastStay ? formatDate(row.lastStay) : <span className="text-ds-neutral-700">{t('none')}</span>
  const anonymizedBadge = (row: GuestRow) =>
    row.anonymized ? (
      <Badge variant="secondary" className="font-normal">
        {t('anonymized')}
      </Badge>
    ) : null

  return (
    <div className="flex flex-col gap-4">
      <Table className="hidden md:table">
        <TableHeader>
          <TableRow>
            <TableHead>{t('colName')}</TableHead>
            <TableHead>{t('colCountry')}</TableHead>
            <TableHead className="text-right">{t('colStays')}</TableHead>
            <TableHead>{t('colLastStay')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {page.rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="max-w-[420px]">
                <span className="flex flex-wrap items-center gap-2">
                  {/* Nur der Name ist der Link: Safari kann Klickflächen über die ganze Zeile (after:inset-0) nicht an <tr> verankern */}
                  <Link href={guestHref(row.id)} className="font-medium text-ds-accent-700 underline underline-offset-[3px] hover:decoration-2">
                    {guestSortName(row)}
                  </Link>
                  {anonymizedBadge(row)}
                </span>
                {row.companyName && <span className="block break-words text-[13px] text-ds-neutral-800">{row.companyName}</span>}
              </TableCell>
              <TableCell>{countryName(row.country, locale)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(row.stayCount)}</TableCell>
              <TableCell className="whitespace-nowrap">{lastStay(row)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ul className="flex flex-col gap-3 md:hidden">
        {page.rows.map((row) => (
          <li key={row.id}>
            <Link href={guestHref(row.id)} className="flex flex-col gap-1 rounded-lg bg-ds-surface p-4 hover:bg-ds-neutral-200">
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0 break-words text-lg font-semibold">{guestSortName(row)}</span>
                {anonymizedBadge(row)}
              </span>
              {row.companyName && <span className="break-words text-sm text-ds-neutral-800">{row.companyName}</span>}
              <span className="text-[13px] text-ds-neutral-700">
                {countryName(row.country, locale)} · {t('staysShort', { count: row.stayCount })}
                {row.lastStay && <> · {t('lastStayShort', { date: formatDate(row.lastStay) })}</>}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {page.pageCount > 1 && <GuestPagination page={page} />}
    </div>
  )
}

function GuestPagination({ page }: { page: GuestPage }) {
  const t = useTranslations('guests')
  const href = (n: number) => guestListHref({ ...page, page: n })
  const step = (n: number, label: string, icon: React.ReactNode, iconFirst: boolean) => {
    const content = iconFirst ? (
      <>
        {icon}
        {label}
      </>
    ) : (
      <>
        {label}
        {icon}
      </>
    )
    return n >= 1 && n <= page.pageCount ? (
      <Button asChild variant="outline" className="min-h-11">
        <Link href={href(n)}>{content}</Link>
      </Button>
    ) : (
      <Button variant="outline" className="min-h-11" disabled>
        {content}
      </Button>
    )
  }

  return (
    <Pagination aria-label={t('pagination')}>
      <PaginationContent className="gap-3">
        <PaginationItem>{step(page.page - 1, t('previous'), <CaretLeft size={16} aria-hidden="true" />, true)}</PaginationItem>
        <PaginationItem className="text-sm text-ds-neutral-800" aria-current="page">
          {t('pageOf', { page: page.page, pageCount: page.pageCount })}
        </PaginationItem>
        <PaginationItem>{step(page.page + 1, t('next'), <CaretRight size={16} aria-hidden="true" />, false)}</PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
