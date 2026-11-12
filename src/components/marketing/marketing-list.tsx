import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'

import { ListPagination } from '@/components/list-pagination'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatDate, formatNumber } from '@/lib/format'
import { countryName, guestHref, guestSortName, languageName } from '@/lib/guests'
import { marketingHref, type MarketingPage, type MarketingRow, type MarketingView, reachOf } from '@/lib/marketing'

// Trefferliste der Seite „Marketing“ (PROJ-52): nur lesen. Ab 768 px Tabelle (der Name führt zur Gastseite), darunter Karten.
export function MarketingList({ page, view }: { page: MarketingPage; view: MarketingView }) {
  const t = useTranslations('marketing.list')
  const locale = useLocale()
  const place = (r: MarketingRow) => [r.city, r.country ? countryName(r.country, locale) : null].filter(Boolean).join(', ') || t('none')
  const reach = (r: MarketingRow) => {
    const x = reachOf(r)
    return [x.email && t('email'), x.post && t('post')].filter(Boolean).join(', ')
  }
  const language = (r: MarketingRow) => (r.language ? languageName(r.language, locale) : t('none'))

  return (
    <div className="flex flex-col gap-4">
      <Table className="hidden md:table">
        <TableHeader>
          <TableRow>
            <TableHead>{t('colName')}</TableHead>
            <TableHead>{t('colPlace')}</TableHead>
            <TableHead>{t('colLanguage')}</TableHead>
            <TableHead>{t('colReach')}</TableHead>
            <TableHead className="text-right">{t('colStays')}</TableHead>
            <TableHead>{t('colLastStay')}</TableHead>
            <TableHead>{t('colConsent')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {page.rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="max-w-[320px]">
                {/* Nur der Name ist der Link (Safari, siehe Gästeliste) */}
                <Link href={guestHref(r.id)} className="font-medium text-ds-accent-700 underline underline-offset-[3px] hover:decoration-2">
                  {guestSortName(r)}
                </Link>
                {r.companyName && <span className="block break-words text-[13px] text-ds-neutral-800">{r.companyName}</span>}
              </TableCell>
              <TableCell>{place(r)}</TableCell>
              <TableCell>{language(r)}</TableCell>
              <TableCell>{reach(r)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatNumber(r.stayCount)}</TableCell>
              <TableCell className="whitespace-nowrap">{r.lastStay ? formatDate(r.lastStay) : t('none')}</TableCell>
              <TableCell className="whitespace-nowrap">{formatDate(r.consentOn)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <ul className="flex flex-col gap-3 md:hidden">
        {page.rows.map((r) => (
          <li key={r.id}>
            <Link href={guestHref(r.id)} className="flex flex-col gap-1 rounded-lg bg-ds-surface p-4 hover:bg-ds-neutral-200">
              <span className="min-w-0 break-words text-lg font-semibold">{guestSortName(r)}</span>
              {r.companyName && <span className="break-words text-sm text-ds-neutral-800">{r.companyName}</span>}
              <span className="text-sm">
                {place(r)} · {language(r)} · {reach(r)}
              </span>
              <span className="text-[13px] text-ds-neutral-700">
                {t('stays', { count: r.stayCount })}
                {r.lastStay && <> · {t('lastStay', { date: formatDate(r.lastStay) })}</>} · {t('consentSince', { date: formatDate(r.consentOn) })}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {page.pageCount > 1 && (
        <ListPagination
          page={page.page}
          pageCount={page.pageCount}
          href={(n) => marketingHref({ ...view, page: n })}
          labels={{
            nav: t('pagination'),
            previous: t('previous'),
            next: t('next'),
            pageOf: t('pageOf', { page: page.page, count: page.pageCount }),
          }}
        />
      )}
    </div>
  )
}
