'use client'

import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'

import { ListPagination } from '@/components/list-pagination'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { companyHref, companyListHref, type CompanyPage, type CompanyRow } from '@/lib/companies'
import { formatNumber } from '@/lib/format'
import { countryName } from '@/lib/guests'

// Firmenliste (PROJ-50): ab 768 px Tabelle (der Name ist der Link), darunter Karten
export function CompanyList({ page }: { page: CompanyPage }) {
  const t = useTranslations('companies.list')
  const locale = useLocale()
  const none = <span className="text-ds-neutral-700">–</span>
  const place = (r: CompanyRow) => [r.postalCode, r.city].filter(Boolean).join(' ')
  const nameMissing = (r: CompanyRow) =>
    r.nameMissing ? (
      <Badge variant="secondary" className="font-normal">
        {t('nameMissing')}
      </Badge>
    ) : null

  return (
    <div className="flex flex-col gap-4">
      <Table className="hidden md:table">
        <TableHeader>
          <TableRow>
            <TableHead>{t('colName')}</TableHead>
            <TableHead>{t('colVatId')}</TableHead>
            <TableHead>{t('colPlace')}</TableHead>
            <TableHead>{t('colCountry')}</TableHead>
            <TableHead className="text-right">{t('colGuests')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {page.rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="max-w-[360px]">
                <span className="flex flex-wrap items-center gap-2">
                  {/* Nur der Name ist der Link: Safari kann Klickflächen über die ganze Zeile (after:inset-0) nicht an <tr> verankern */}
                  <Link href={companyHref(row.id)} className="break-words font-medium text-ds-accent-700 underline underline-offset-[3px] hover:decoration-2">
                    {row.name}
                  </Link>
                  {nameMissing(row)}
                </span>
              </TableCell>
              <TableCell className="whitespace-nowrap">{row.vatId ?? none}</TableCell>
              <TableCell className="max-w-[240px] break-words">{place(row) || none}</TableCell>
              <TableCell>{row.country ? countryName(row.country, locale) : none}</TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(row.guestCount)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ul className="flex flex-col gap-3 md:hidden">
        {page.rows.map((row) => (
          <li key={row.id}>
            <Link href={companyHref(row.id)} className="flex flex-col gap-1 rounded-lg bg-ds-surface p-4 hover:bg-ds-neutral-200">
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0 break-words text-lg font-semibold">{row.name}</span>
                {nameMissing(row)}
              </span>
              {row.vatId && <span className="text-sm text-ds-neutral-800">{row.vatId}</span>}
              <span className="break-words text-[13px] text-ds-neutral-700">
                {[place(row), row.country ? countryName(row.country, locale) : null].filter(Boolean).join(' · ')}
                {(place(row) || row.country) && ' · '}
                {t('guestsShort', { count: row.guestCount })}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {page.pageCount > 1 && (
        <ListPagination
          page={page.page}
          pageCount={page.pageCount}
          href={(n) => companyListHref({ ...page, page: n })}
          labels={{
            nav: t('pagination'),
            previous: t('previous'),
            next: t('next'),
            pageOf: t('pageOf', { page: page.page, pageCount: page.pageCount }),
          }}
        />
      )}
    </div>
  )
}
