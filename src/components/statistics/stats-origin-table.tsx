'use client'

import { CaretDown, CaretRight } from '@phosphor-icons/react'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'

import { Amount } from '@/components/amount'
import { PreviousLine } from '@/components/statistics/compare'
import { HEAD, ScrollRegion, STICKY } from '@/components/statistics/stats-cells'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatCents, formatNumber, formatPercent } from '@/lib/format'
import { countryName } from '@/lib/guests'
import { type OriginLine, type OriginView, relativeChange } from '@/lib/statistics'
import { cn } from '@/lib/utils'

const CELL = 'whitespace-nowrap px-2 py-2 text-right align-top'
const SMALL = 'block text-[12px] font-normal text-ds-neutral-700'
const COLUMNS = ['arrivals', 'guestNights', 'revenue', 'share'] as const

// Tabelle „Gästeherkunft“ (PROJ-18): die ersten zehn Länder einzeln, darunter „Übrige Länder“ (aufklappbar) und „Gesamt“
export function StatsOriginTable({ view }: { view: OriginView }) {
  const t = useTranslations('statistics.origin')
  const locale = useLocale()
  const [open, setOpen] = useState(false)
  const prev = (v: number) => (view.previousKnown ? v : null)

  const cells = (l: OriginLine, bold = false) => {
    const cell = cn(CELL, bold && 'font-semibold')
    return (
      <>
        <TableCell className={cell}>
          {formatNumber(l.current.arrivals)}
          <span className={SMALL}>
            <PreviousLine previous={prev(l.previous.arrivals) === null ? null : formatNumber(l.previous.arrivals)} change={relativeChange(l.current.arrivals, prev(l.previous.arrivals))} prefix={false} />
          </span>
        </TableCell>
        <TableCell className={cell}>
          {formatNumber(l.current.guestNights)}
          <span className={SMALL}>
            <PreviousLine previous={prev(l.previous.guestNights) === null ? null : formatNumber(l.previous.guestNights)} change={relativeChange(l.current.guestNights, prev(l.previous.guestNights))} prefix={false} />
          </span>
        </TableCell>
        <TableCell className={cell}>
          <Amount cents={l.current.revenueCents} />
          <span className={SMALL}>
            <PreviousLine previous={prev(l.previous.revenueCents) === null ? null : formatCents(l.previous.revenueCents)} change={relativeChange(l.current.revenueCents, prev(l.previous.revenueCents))} prefix={false} />
          </span>
        </TableCell>
        <TableCell className={cn(cell, 'pr-0')}>{l.share === null ? '–' : formatPercent(l.share)}</TableCell>
      </>
    )
  }

  const nameCell = (label: React.ReactNode, className?: string) => (
    <TableHead scope="row" className={cn(STICKY, 'h-auto max-w-[14rem] break-words py-2 pl-0 pr-2 align-top font-normal text-ds-text', className)}>
      {label}
    </TableHead>
  )

  return (
    <ScrollRegion label={t('tableLabel')}>
      <Table className="min-w-[34rem] tabular-nums">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead scope="col" className={cn(HEAD, STICKY, 'pl-0')}>
              {t('col.country')}
            </TableHead>
            {COLUMNS.map((k, i) => (
              <TableHead key={k} scope="col" className={cn(HEAD, 'text-right', i === COLUMNS.length - 1 && 'pr-0')}>
                {t(`col.${k}`)}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {view.top.map((l) => (
            <TableRow key={l.country} className="hover:bg-transparent">
              {nameCell(countryName(l.country, locale))}
              {cells(l)}
            </TableRow>
          ))}
          {view.restSum && (
            <TableRow className="hover:bg-transparent">
              {nameCell(
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls="auswertung-uebrige-laender"
                  onClick={() => setOpen((o) => !o)}
                  className="-ml-1 inline-flex min-h-11 items-center gap-1 rounded-md px-1 text-left hover:bg-ds-neutral-300 focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {open ? <CaretDown size={14} aria-hidden="true" /> : <CaretRight size={14} aria-hidden="true" />}
                  {t('others', { count: view.rest.length })}
                </button>
              )}
              {cells(view.restSum)}
            </TableRow>
          )}
        </TableBody>
        {/* Übrige Länder als eigener Zeilenblock, damit „aria-controls“ ein Ziel hat */}
        <TableBody id="auswertung-uebrige-laender" hidden={!open}>
          {view.rest.map((l) => (
            <TableRow key={l.country} className="hover:bg-transparent">
              {nameCell(countryName(l.country, locale), 'pl-5')}
              {cells(l)}
            </TableRow>
          ))}
        </TableBody>
        {view.top.length > 1 && (
          <TableBody>
            <TableRow className="border-t-2 border-t-ds-text hover:bg-transparent">
              {nameCell(t('total'), 'font-semibold')}
              {cells(view.total, true)}
            </TableRow>
          </TableBody>
        )}
      </Table>
    </ScrollRegion>
  )
}
