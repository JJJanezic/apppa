'use client'

import { CaretDown, CaretUp, CaretUpDown } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { HEAD, METRIC_KEYS, type MetricKey, MetricCells, ScrollRegion, STICKY } from '@/components/statistics/stats-cells'
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { type ApartmentSort, type ApartmentSortKey, nextApartmentSort, sortApartmentLines, type StatsApartmentLine, withTenant } from '@/lib/statistics'
import { cn } from '@/lib/utils'

// Spalte der Tabelle → Sortierschlüssel der Regeldatei
const SORT_KEY: Record<MetricKey, ApartmentSortKey> = { occupancy: 'occupancy', occupied: 'occupied', blocked: 'blocked', revenue: 'revenue', rate: 'rate' }

// Tabelle „Je Wohnung“ (PROJ-18): Standard nach Objekt gruppiert, bei mehreren Kunden nach Kunde und Objekt (refine
// 2026-11-08); ein Klick auf einen Spaltenkopf sortiert absteigend, ein zweiter aufsteigend, ein dritter zurück zur
// Gruppierung. Sortiert ist die Tabelle ohne Gruppen, Objekt (und Kunde) stehen dann in der Zeile.
export function StatsApartmentTable({ lines, multiTenant = false }: { lines: StatsApartmentLine[]; multiTenant?: boolean }) {
  const t = useTranslations('statistics.apartments')
  const [sort, setSort] = useState<ApartmentSort>(null)
  const sorted = sortApartmentLines(lines, sort)
  const columns = METRIC_KEYS.length + 1

  // Gruppen nur ohne Sortierung (Zeilen kommen bereits nach Objekt und Wohnung geordnet)
  // Kunde als eigene Zwischenüberschrift über seinen Objekten (nur bei mehreren Kunden)
  const groups: { id: string; name: string; tenant: string | null; lines: StatsApartmentLine[] }[] = []
  if (!sort) {
    for (const l of sorted) {
      const last = groups.at(-1)
      if (last && last.id === l.apartment.propertyId) last.lines.push(l)
      else {
        const newTenant = multiTenant && (!last || last.lines[0].apartment.tenantId !== l.apartment.tenantId)
        groups.push({ id: l.apartment.propertyId, name: l.apartment.propertyName, tenant: newTenant ? l.apartment.tenantName : null, lines: [l] })
      }
    }
  }

  const row = (l: StatsApartmentLine, withProperty: boolean) => (
    <TableRow key={l.apartment.id} className="hover:bg-transparent">
      <TableHead scope="row" className={cn(STICKY, 'h-auto max-w-[14rem] break-words py-2 pl-0 pr-2 align-top font-normal text-ds-text')}>
        {withProperty && (
          <span className="block text-[12px] text-ds-neutral-700">{withTenant(l.apartment.propertyName, l.apartment.tenantName, multiTenant)}</span>
        )}
        {l.apartment.name}
        {l.apartment.archived && <span className="block text-[12px] text-ds-neutral-700">{t('archived')}</span>}
      </TableHead>
      <MetricCells line={l} />
    </TableRow>
  )

  return (
    <>
      <p className="text-[13px] text-ds-neutral-700">{t('sortHint')}</p>
      <ScrollRegion label={t('tableLabel')}>
        <Table className="min-w-[44rem] tabular-nums">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead scope="col" className={cn(HEAD, STICKY, 'pl-0')}>
                {t('col.apartment')}
              </TableHead>
              {METRIC_KEYS.map((k, i) => {
                const active = sort?.key === SORT_KEY[k] ? sort.dir : null
                const Icon = active === 'asc' ? CaretUp : active === 'desc' ? CaretDown : CaretUpDown
                return (
                  <TableHead
                    key={k}
                    scope="col"
                    aria-sort={active === 'asc' ? 'ascending' : active === 'desc' ? 'descending' : undefined}
                    className={cn(HEAD, 'px-0 text-right', i === METRIC_KEYS.length - 1 && 'pr-0')}
                  >
                    <button
                      type="button"
                      onClick={() => setSort(nextApartmentSort(sort, SORT_KEY[k]))}
                      className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 hover:bg-ds-neutral-300 focus-visible:outline-2 focus-visible:outline-offset-2"
                    >
                      {t(`col.${k}`)}
                      <Icon size={14} aria-hidden="true" className={active ? 'text-ds-text' : 'text-ds-neutral-600'} />
                      {active && <span className="sr-only">, {t(active === 'asc' ? 'sortedAsc' : 'sortedDesc')}</span>}
                    </button>
                  </TableHead>
                )
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sort
              ? sorted.map((l) => row(l, true))
              : groups.map((g) => (
                  <GroupRows key={g.id} name={g.name} tenant={g.tenant} columns={columns}>
                    {g.lines.map((l) => row(l, false))}
                  </GroupRows>
                ))}
          </TableBody>
        </Table>
      </ScrollRegion>
    </>
  )
}

function GroupRows({ name, tenant, columns, children }: { name: string; tenant: string | null; columns: number; children: React.ReactNode }) {
  return (
    <>
      {tenant && (
        <TableRow className="hover:bg-transparent">
          <TableHead scope="colgroup" colSpan={columns} className="h-auto px-0 pb-0 pt-6 text-left">
            <span className={cn(STICKY, 'inline-block pr-2 text-[13px] font-normal uppercase tracking-[0.06em] text-ds-neutral-700')}>{tenant}</span>
          </TableHead>
        </TableRow>
      )}
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
