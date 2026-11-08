import Link from 'next/link'
import { useTranslations } from 'next-intl'

import { Amount } from '@/components/amount'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { bookingHref } from '@/lib/bookings'
import { formatDate } from '@/lib/format'
import { rowNotes, type TaxReportRow, type TaxReportSum, type TaxReportView } from '@/lib/tourist-tax-report'
import { cn } from '@/lib/utils'

// Erste Spalte bleibt beim seitlichen Scrollen am Handy stehen (wie die Ortstaxe im Dashboard)
const STICKY = 'sticky left-0 z-10 bg-ds-surface'
const Dash = () => <span className="text-ds-neutral-700">–</span>
const nights = (n: number | null) => (n === null ? <Dash /> : n)

// Übersicht je Gemeinde (PROJ-16): abgabepflichtige und befreite Personennächte, Betrag; „Gesamt“ nur bei mehreren
// Gemeinden. Unbekannte Personennächte (Alt-Positionen, Prozent-Tarife) zählen nicht und stehen als Hinweis darunter.
export function TaxReportSummary({ view, period }: { view: TaxReportView; period: string }) {
  const t = useTranslations('touristTaxReport.summary')
  const line = (key: string, name: string, s: TaxReportSum, total: boolean) => (
    <TableRow key={key} className={cn('hover:bg-transparent', total && 'border-t-2 border-t-ds-text font-semibold')}>
      <TableHead scope="row" className={cn('h-auto min-w-24 break-words px-0 py-2 pr-2 align-top font-normal text-ds-text', total && 'font-semibold')}>
        {name}
        {s.unknownPositions > 0 && <span className="block text-[13px] font-normal text-ds-neutral-800">{t('unknown', { count: s.unknownPositions })}</span>}
        {s.exemptUnknown > 0 && <span className="block text-[13px] font-normal text-ds-neutral-800">{t('exemptUnknown', { count: s.exemptUnknown })}</span>}
      </TableHead>
      <TableCell className="px-2 py-2 text-right align-top">{s.taxableNights}</TableCell>
      <TableCell className="px-2 py-2 text-right align-top">{s.exemptNights}</TableCell>
      <TableCell className="whitespace-nowrap py-2 pl-2 pr-0 text-right align-top">
        <Amount cents={s.amountCents} />
      </TableCell>
    </TableRow>
  )

  return (
    <section aria-labelledby="ortstaxe-uebersicht" className="flex flex-col gap-3 rounded-lg bg-ds-surface p-4 sm:p-6">
      <div className="flex flex-col gap-0.5">
        <h2 id="ortstaxe-uebersicht" className="text-[22px]">
          {t('title')}
        </h2>
        <p className="text-[13px] text-ds-neutral-700">{period}</p>
      </div>
      {/* Eigener Scrollbereich nur als Reserve (lange Gemeindenamen); am Handy kurze Spaltenköpfe */}
      <div role="region" aria-label={t('tableLabel')} tabIndex={0} className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 [&>div]:overflow-visible">
        <Table className="min-w-[18rem] tabular-nums">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead scope="col" className="h-auto px-0 pb-1.5 pr-3 text-[13px] font-normal text-ds-neutral-700">
                {t('municipality')}
              </TableHead>
              <TableHead scope="col" className="h-auto px-2 pb-1.5 text-right text-[13px] font-normal text-ds-neutral-700">
                <Short long={t('taxable')} short={t('taxableShort')} />
              </TableHead>
              <TableHead scope="col" className="h-auto px-2 pb-1.5 text-right text-[13px] font-normal text-ds-neutral-700">
                <Short long={t('exempt')} short={t('exemptShort')} />
              </TableHead>
              <TableHead scope="col" className="h-auto pb-1.5 pl-2 pr-0 text-right text-[13px] font-normal text-ds-neutral-700">
                {t('amount')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {view.groups.map((g) => line(g.id, g.name, g.sum, false))}
            {view.total && line('gesamt', t('total'), view.total, true)}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

// Langer Spaltenkopf ab 640 px, darunter die Abkürzung (vorgelesen wird immer die lange Form)
function Short({ long, short }: { long: string; short: string }) {
  return (
    <>
      <span className="hidden sm:inline">{long}</span>
      <abbr title={long} className="no-underline sm:hidden" aria-hidden="true">
        {short}
      </abbr>
      <span className="sr-only sm:hidden">{long}</span>
    </>
  )
}

// Buchungsliste je Gemeinde (PROJ-16), nach Anreise. Nur die Nummer ist ein Link (Safari-Zeilenklick, PROJ-29).
// Am Handy scrollt die Tabelle in eigenem Bereich seitlich, die Spalte „Nr.“ bleibt stehen.
export function TaxReportBookings({ view }: { view: TaxReportView }) {
  const t = useTranslations('touristTaxReport.bookings')
  const count = view.groups.reduce((n, g) => n + g.rows.length, 0)
  const head = 'h-auto whitespace-nowrap px-2 pb-1.5 text-[13px] font-normal text-ds-neutral-700'
  const columns = 9

  const guest = (r: TaxReportRow) =>
    r.anonymized ? <span className="text-ds-neutral-800">{t('anonymized')}</span> : (r.guestName ?? <span className="text-ds-neutral-800">{t('noGuest')}</span>)

  return (
    <section aria-labelledby="ortstaxe-buchungen" className="flex flex-col gap-3 rounded-lg bg-ds-surface p-4 sm:p-6">
      <div className="flex flex-col gap-0.5">
        <h2 id="ortstaxe-buchungen" className="text-[22px]">
          {t('title')}
        </h2>
        <p className="text-[13px] text-ds-neutral-700">{t('count', { count })}</p>
      </div>
      {/* Eigener Scrollbereich mit Tastaturfokus; der innere der Tabelle läuft nicht über (axe scrollable-region-focusable) */}
      <div role="region" aria-label={t('tableLabel')} tabIndex={0} className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 [&>div]:overflow-visible">
        <Table className="min-w-[56rem] tabular-nums">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead scope="col" className={cn(head, STICKY, 'pl-0')}>
                {t('col.number')}
              </TableHead>
              <TableHead scope="col" className={head}>
                {t('col.guest')}
              </TableHead>
              <TableHead scope="col" className={head}>
                {t('col.apartment')}
              </TableHead>
              <TableHead scope="col" className={head}>
                {t('col.stay')}
              </TableHead>
              <TableHead scope="col" className={cn(head, 'text-right')}>
                {t('col.persons')}
              </TableHead>
              <TableHead scope="col" className={cn(head, 'text-right')}>
                <abbr title={t('taxableLong')} className="no-underline">
                  {t('col.taxable')}
                </abbr>
              </TableHead>
              <TableHead scope="col" className={cn(head, 'text-right')}>
                <abbr title={t('exemptLong')} className="no-underline">
                  {t('col.exempt')}
                </abbr>
              </TableHead>
              <TableHead scope="col" className={cn(head, 'text-right')}>
                {t('col.amount')}
              </TableHead>
              <TableHead scope="col" className={cn(head, 'pr-0')}>
                {t('col.note')}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {view.groups.map((g) => (
              <GroupRows key={g.id} name={g.name} columns={columns}>
                {g.rows.map((r) => (
                  <TableRow key={r.bookingId} className="hover:bg-transparent">
                    <TableCell className={cn(STICKY, 'whitespace-nowrap py-2 pl-0 pr-2 align-top')}>
                      <Link href={bookingHref(r.bookingId)} className="font-medium text-ds-accent-700 underline underline-offset-[3px] hover:decoration-2">
                        {r.bookingNumber ?? t('noNumber')}
                      </Link>
                    </TableCell>
                    <TableCell className="max-w-[220px] break-words px-2 py-2 align-top">{guest(r)}</TableCell>
                    <TableCell className="max-w-[220px] break-words px-2 py-2 align-top">{r.apartment}</TableCell>
                    <TableCell className="whitespace-nowrap px-2 py-2 align-top">
                      {formatDate(r.arrival)} –
                      <span className="block">{formatDate(r.departure)}</span>
                    </TableCell>
                    <TableCell className="px-2 py-2 text-right align-top">{r.persons}</TableCell>
                    <TableCell className="px-2 py-2 text-right align-top">{nights(r.taxableNights)}</TableCell>
                    <TableCell className="px-2 py-2 text-right align-top">{nights(r.exemptNights)}</TableCell>
                    <TableCell className="whitespace-nowrap px-2 py-2 text-right align-top">
                      <Amount cents={r.amountCents} />
                    </TableCell>
                    <TableCell className="py-2 pl-2 pr-0 align-top text-[13px] text-ds-neutral-800">{rowNotes(r).map((n) => t(`notes.${n}`)).join(', ')}</TableCell>
                  </TableRow>
                ))}
              </GroupRows>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}

function GroupRows({ name, columns, children }: { name: string; columns: number; children: React.ReactNode }) {
  return (
    <>
      <TableRow className="hover:bg-transparent">
        {/* Zwischenüberschrift steht links fest, damit sie am Handy beim Scrollen sichtbar bleibt */}
        <TableHead scope="colgroup" colSpan={columns} className="h-auto px-0 pb-1 pt-4 text-left">
          <span className={cn(STICKY, 'inline-block pr-2 text-base font-semibold text-ds-text')}>{name}</span>
        </TableHead>
      </TableRow>
      {children}
    </>
  )
}
