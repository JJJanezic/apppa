import { useTranslations } from 'next-intl'

import { Amount } from '@/components/amount'
import { PreviousLine } from '@/components/statistics/compare'
import { useVatText } from '@/components/statistics/stats-kpis'
import { TableCell, TableHead } from '@/components/ui/table'
import { formatCents, formatNumber, formatPercent } from '@/lib/format'
import { averageRate, type Compared, occupancy, pointChange, relativeChange } from '@/lib/statistics'
import { cn } from '@/lib/utils'

// Gemeinsame Bausteine der Tabellen „Je Monat“ und „Je Wohnung“ (PROJ-18)

// Erste Spalte bleibt beim seitlichen Scrollen am Handy stehen (wie bei der Ortstaxe)
export const STICKY = 'sticky left-0 z-10 bg-ds-surface'
export const HEAD = 'h-auto whitespace-nowrap px-2 pb-1.5 text-[13px] font-normal text-ds-neutral-700'
const CELL = 'whitespace-nowrap px-2 py-2 text-right align-top'
const SMALL = 'block text-[12px] text-ds-neutral-700'
const DASH = '–'

export const METRIC_KEYS = ['occupancy', 'occupied', 'blocked', 'revenue', 'rate'] as const
export type MetricKey = (typeof METRIC_KEYS)[number]

// Spaltenköpfe der Kennzahlen (rechtsbündig)
export function MetricHeads({ namespace }: { namespace: 'statistics.months.col' | 'statistics.apartments.col' }) {
  const t = useTranslations(namespace)
  return (
    <>
      {METRIC_KEYS.map((k, i) => (
        <TableHead key={k} scope="col" className={cn(HEAD, 'text-right', i === METRIC_KEYS.length - 1 && 'pr-0')}>
          {t(k)}
        </TableHead>
      ))}
    </>
  )
}

// Wert, darunter klein Vorjahr und Veränderung
export function MetricCells({ line, bold = false }: { line: Compared; bold?: boolean }) {
  const vat = useVatText()
  const { current: c, previous: p, previousKnown } = line
  const prev = <T,>(v: T | null) => (previousKnown ? v : null)
  const occ = occupancy(c)
  const prevOcc = prev(occupancy(p))
  const rate = averageRate(c)
  const prevRate = prev(averageRate(p))
  const count = (v: number | null) => (v === null ? null : formatNumber(v))
  const amount = (v: number | null) => (v === null ? null : formatCents(v))
  const cell = cn(CELL, bold && 'font-semibold')
  const small = cn(SMALL, bold && 'font-normal')

  return (
    <>
      <TableCell className={cell}>
        {occ === null ? DASH : formatPercent(occ)}
        <span className={small}>
          <PreviousLine previous={prevOcc === null ? null : formatPercent(prevOcc)} change={pointChange(occ, prevOcc)} prefix={false} />
        </span>
      </TableCell>
      <TableCell className={cell}>
        {formatNumber(c.occupiedNights)}
        <span className={small}>
          <PreviousLine previous={count(prev(p.occupiedNights))} change={relativeChange(c.occupiedNights, prev(p.occupiedNights))} prefix={false} />
        </span>
      </TableCell>
      <TableCell className={cell}>
        {formatNumber(c.blockedNights)}
        <span className={small}>
          <PreviousLine previous={count(prev(p.blockedNights))} change={null} prefix={false} />
        </span>
      </TableCell>
      <TableCell className={cell}>
        <Amount cents={c.revenueCents} />
        <span className={small}>{vat(c.vatCents)}</span>
        <span className={small}>
          <PreviousLine previous={amount(prev(p.revenueCents))} change={relativeChange(c.revenueCents, prev(p.revenueCents))} prefix={false} />
        </span>
      </TableCell>
      <TableCell className={cn(cell, 'pr-0')}>
        {rate === null ? DASH : formatCents(rate)}
        <span className={small}>
          <PreviousLine previous={amount(prevRate)} change={relativeChange(rate, prevRate)} prefix={false} />
        </span>
      </TableCell>
    </>
  )
}

// Karte mit Überschrift wie bei der Ortstaxe
export function StatsCard({ id, title, lead, children }: { id: string; title: string; lead?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-3 rounded-lg bg-ds-surface p-4 sm:p-6">
      <div className="flex flex-col gap-0.5">
        <h2 id={id} className="text-[22px]">
          {title}
        </h2>
        {lead && <p className="text-[13px] text-ds-neutral-700">{lead}</p>}
      </div>
      {children}
    </section>
  )
}

// Eigener Scrollbereich mit Tastaturfokus; der innere der Tabelle läuft nicht über (axe scrollable-region-focusable)
export function ScrollRegion({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div role="region" aria-label={label} tabIndex={0} className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 [&>div]:overflow-visible">
      {children}
    </div>
  )
}
