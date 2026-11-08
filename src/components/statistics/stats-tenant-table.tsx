import { useTranslations } from 'next-intl'

import { HEAD, MetricCells, MetricHeads, ScrollRegion, STICKY } from '@/components/statistics/stats-cells'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { StatsView } from '@/lib/statistics'
import { cn } from '@/lib/utils'

// Tabelle „Je Kunde“ (PROJ-18, refine 2026-11-08): bei mehreren Kunden eine Zeile je Kunde mit Vorjahr, darunter „Gesamt“
export function StatsTenantTable({ view }: { view: Pick<StatsView, 'tenants' | 'totals'> }) {
  const t = useTranslations('statistics.tenants')
  return (
    <ScrollRegion label={t('tableLabel')}>
      <Table className="min-w-[40rem] tabular-nums">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead scope="col" className={cn(HEAD, STICKY, 'pl-0')}>
              {t('col.tenant')}
            </TableHead>
            <MetricHeads namespace="statistics.tenants.col" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {view.tenants.map((l) => (
            <TableRow key={l.tenant.id} className="hover:bg-transparent">
              <TableHead scope="row" className={cn(STICKY, 'h-auto max-w-[14rem] break-words py-2 pl-0 pr-2 align-top font-normal text-ds-text')}>
                {l.tenant.name}
              </TableHead>
              <MetricCells line={l} />
            </TableRow>
          ))}
          <TableRow className="border-t-2 border-t-ds-text hover:bg-transparent">
            <TableHead scope="row" className={cn(STICKY, 'h-auto py-2 pl-0 pr-2 align-top font-semibold text-ds-text')}>
              {t('total')}
            </TableHead>
            <MetricCells line={view.totals} bold />
          </TableRow>
        </TableBody>
      </Table>
    </ScrollRegion>
  )
}
