'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { formatCents, formatNumber, formatPercent } from '@/lib/format'
import { type ChartMode, chartModel, type StatsView } from '@/lib/statistics'
import { cn } from '@/lib/utils'

// Achsenbeschriftung kurz: „75 %“ bzw. „€ 250.000“
const axisLabel = (mode: ChartMode, v: number) => (mode === 'occupancy' ? formatPercent(v) : `€ ${formatNumber(v / 100, { maximumFractionDigits: 0 })}`)
const valueLabel = (mode: ChartMode, v: number | null) => (v === null ? '–' : mode === 'occupancy' ? formatPercent(v) : formatCents(v))

interface StatsChartProps {
  view: Pick<StatsView, 'months' | 'totals'>
  year: number
}

// Balkendiagramm „Je Monat“ (PROJ-18): Auslastung oder Umsatz je Monat, Vorjahr grau daneben. Ohne Diagramm-Paket, damit
// dieselbe Darstellung auch im PDF gezeichnet werden kann (Maßstab aus chartModel). Für Bildschirmleser ist das Diagramm
// ein Bild mit Beschreibung; die genauen Werte stehen in der Tabelle darunter. Zeigen oder Antippen eines Monats zeigt
// dessen Werte über dem Diagramm.
export function StatsChart({ view, year }: StatsChartProps) {
  const t = useTranslations('statistics')
  const [mode, setMode] = useState<ChartMode>('occupancy')
  const [selected, setSelected] = useState<number | null>(null)
  const model = chartModel(view, mode)
  const bar = model.bars.find((b) => b.month === selected) ?? null
  const many = model.bars.length > 6

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="group" aria-label={t('chart.mode')} className="flex gap-2">
          {(['occupancy', 'revenue'] as const).map((m) => (
            <Button key={m} type="button" variant={mode === m ? 'default' : 'outline'} className="min-h-11" aria-pressed={mode === m} onClick={() => setMode(m)}>
              {t(`chart.${m}`)}
            </Button>
          ))}
        </div>
        {/* Legende: Farbe nie allein – Jahr steht daneben */}
        <ul className="flex flex-wrap gap-4 text-[13px] text-ds-neutral-800">
          <li className="flex items-center gap-1.5">
            <span aria-hidden="true" className="size-3 rounded-[2px] bg-ds-accent" />
            {t('chart.current', { year: String(year) })}
          </li>
          {model.previousKnown && (
            <li className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-3 rounded-[2px] bg-ds-neutral-500" />
              {t('chart.previous', { year: String(year - 1) })}
            </li>
          )}
        </ul>
      </div>

      <p className="min-h-5 text-[13px] text-ds-neutral-800">
        {bar
          ? t('chart.readout', {
              month: t('monthName', { month: String(bar.month) }),
              year: String(year),
              value: valueLabel(mode, bar.current),
              previous: valueLabel(mode, bar.previous),
            })
          : t('chart.hint')}
      </p>

      <figure role="img" aria-label={t('chart.description', { mode: t(`chart.${mode}`) })} className="m-0">
        <div aria-hidden="true" className="flex gap-2">
          {/* Achse links */}
          <div className="relative h-48 w-16 shrink-0 text-right text-[11px] tabular-nums text-ds-neutral-700 sm:h-56">
            {model.scale.ticks.map((tick) => (
              <span key={tick} className="absolute right-0 -translate-y-1/2" style={{ bottom: `${(tick / model.scale.max) * 100}%` }}>
                {axisLabel(mode, tick)}
              </span>
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <div className="relative h-48 sm:h-56" onPointerLeave={() => setSelected(null)}>
              {/* Hilfslinien, zurückhaltend */}
              {model.scale.ticks.map((tick) => (
                <span
                  key={tick}
                  className={cn('absolute inset-x-0 border-t', tick === 0 ? 'border-ds-neutral-600' : 'border-ds-neutral-300')}
                  style={{ bottom: `${(tick / model.scale.max) * 100}%` }}
                />
              ))}
              <div className="absolute inset-0 flex">
                {model.bars.map((b) => (
                  <div
                    key={b.month}
                    className={cn('flex h-full flex-1 cursor-default items-end justify-center gap-0.5 rounded-t-[4px] px-0.5', selected === b.month && 'bg-ds-neutral-300/60')}
                    onPointerEnter={() => setSelected(b.month)}
                    onPointerDown={() => setSelected(b.month)}
                  >
                    {model.previousKnown && (
                      <span className="w-[38%] max-w-5 rounded-t-[4px] bg-ds-neutral-500" style={{ height: `${b.previousShare * 100}%` }} />
                    )}
                    <span className="w-[38%] max-w-5 rounded-t-[4px] bg-ds-accent" style={{ height: `${b.currentShare * 100}%` }} />
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-1 flex text-[11px] text-ds-neutral-700">
              {model.bars.map((b) => (
                <span key={b.month} className="flex-1 text-center">
                  {many ? t('monthShort', { month: String(b.month) }) : t('monthName', { month: String(b.month) })}
                </span>
              ))}
            </div>
          </div>
        </div>
      </figure>
    </div>
  )
}
