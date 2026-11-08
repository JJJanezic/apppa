'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { activeQuickPick, QUICK_PICKS, quickPick, selectableYears, type TaxReportFilters, taxReportHref } from '@/lib/tourist-tax-report'

const ALL = '__alle'
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)

interface TaxReportFilterBarProps {
  filters: TaxReportFilters
  municipalities: { id: string; name: string }[]
  // Heutiges Datum (Wien) vom Server, damit Browser und Server denselben Monat meinen
  today: string
}

// Filter der Ortstaxen-Berichte (PROJ-16): Jahr, Von/Bis-Monat, Schnellwahl und Gemeinde. Alles steht in der Adresse
// (Neu laden, Lesezeichen, „Zurück“); jede Änderung ist ein eigener Verlaufseintrag.
export function TaxReportFilterBar({ filters, municipalities, today }: TaxReportFilterBarProps) {
  const t = useTranslations('touristTaxReport')
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const go = (next: Partial<TaxReportFilters>) => startTransition(() => router.push(taxReportHref({ ...filters, ...next }), { scroll: false }))
  const active = activeQuickPick(filters, today)
  const monthName = (m: number) => t('monthName', { month: String(m) })

  return (
    <section aria-label={t('filters.label')} aria-busy={pending} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <span id="ortstaxe-schnellwahl" className="text-[13px] text-ds-neutral-800">
          {t('filters.quick')}
        </span>
        <div role="group" aria-labelledby="ortstaxe-schnellwahl" className="flex flex-wrap gap-2">
          {QUICK_PICKS.map((p) => (
            <Button key={p} asChild variant={active === p ? 'default' : 'outline'} className="min-h-11">
              <Link href={taxReportHref({ ...quickPick(p, today), municipality: filters.municipality })} aria-current={active === p ? 'true' : undefined} scroll={false}>
                {t(`filters.${p}`)}
              </Link>
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:flex lg:flex-wrap lg:items-end">
        <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
          <Label htmlFor="ortstaxe-jahr" className="text-[13px] text-ds-neutral-800">
            {t('filters.year')}
          </Label>
          <Select value={String(filters.year)} onValueChange={(v) => go({ year: Number(v) })}>
            <SelectTrigger id="ortstaxe-jahr" className="min-h-11 lg:w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {selectableYears(today, filters.year).map((y) => (
                <SelectItem key={y} value={String(y)} className="min-h-11">
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ortstaxe-von" className="text-[13px] text-ds-neutral-800">
            {t('filters.from')}
          </Label>
          {/* Liegt „von“ nach „bis“, zieht „bis“ mit */}
          <Select value={String(filters.from)} onValueChange={(v) => go({ from: Number(v), to: Math.max(Number(v), filters.to) })}>
            <SelectTrigger id="ortstaxe-von" className="min-h-11 lg:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => (
                <SelectItem key={m} value={String(m)} className="min-h-11">
                  {monthName(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ortstaxe-bis" className="text-[13px] text-ds-neutral-800">
            {t('filters.to')}
          </Label>
          <Select value={String(filters.to)} onValueChange={(v) => go({ to: Number(v) })}>
            <SelectTrigger id="ortstaxe-bis" className="min-h-11 lg:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => (
                <SelectItem key={m} value={String(m)} disabled={m < filters.from} className="min-h-11">
                  {monthName(m)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-3 lg:col-span-1">
          <Label htmlFor="ortstaxe-gemeinde" className="text-[13px] text-ds-neutral-800">
            {t('filters.municipality')}
          </Label>
          <Select value={filters.municipality ?? ALL} onValueChange={(v) => go({ municipality: v === ALL ? null : v })}>
            <SelectTrigger id="ortstaxe-gemeinde" className="min-h-11 lg:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL} className="min-h-11">
                {t('filters.allMunicipalities')}
              </SelectItem>
              {municipalities.map((m) => (
                <SelectItem key={m.id} value={m.id} className="min-h-11">
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </section>
  )
}
