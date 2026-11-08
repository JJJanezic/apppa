import { useTranslations } from 'next-intl'

import { HEAD, MetricCells, MetricHeads, ScrollRegion, STICKY } from '@/components/statistics/stats-cells'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { StatsView } from '@/lib/statistics'
import { cn } from '@/lib/utils'

// Tabelle „Je Monat“ (PROJ-18) mit Summenzeile „Gesamt“; Auslastung und Ø-Preis der Summe aus den Summen
export function StatsMonthTable({ view, year }: { view: Pick<StatsView, 'months' | 'totals'>; year: number }) {
  const t = useTranslations('statistics')
  return (
    <ScrollRegion label={t('months.tableLabel')}>
      <Table className="min-w-[40rem] tabular-nums">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead scope="col" className={cn(HEAD, STICKY, 'pl-0')}>
              {t('months.col.month')}
            </TableHead>
            <MetricHeads namespace="statistics.months.col" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {view.months.map((m) => (
            <TableRow key={m.month} className="hover:bg-transparent">
              <TableHead scope="row" className={cn(STICKY, 'h-auto whitespace-nowrap py-2 pl-0 pr-2 align-top font-normal text-ds-text')}>
                {t('monthName', { month: String(m.month) })} {year}
              </TableHead>
              <MetricCells line={m} />
            </TableRow>
          ))}
          {view.months.length > 1 && (
            <TableRow className="border-t-2 border-t-ds-text hover:bg-transparent">
              <TableHead scope="row" className={cn(STICKY, 'h-auto py-2 pl-0 pr-2 align-top font-semibold text-ds-text')}>
                {t('months.total')}
              </TableHead>
              <MetricCells line={view.totals} bold />
            </TableRow>
          )}
        </TableBody>
      </Table>
    </ScrollRegion>
  )
}
