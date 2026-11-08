'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { apartmentLabel } from '@/lib/apartments'
import {
  activeStatsQuickPick,
  STATS_QUICK_PICKS,
  type StatsFilters,
  type StatsProperty,
  statsHref,
  statsQuickPick,
  type StatsTenant,
  withTenant,
} from '@/lib/statistics'
import { selectableYears } from '@/lib/tourist-tax-report'

const ALL = '__alle'
const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1)
const LABEL = 'text-[13px] text-ds-neutral-800'

interface StatsFilterBarProps {
  filters: StatsFilters
  // Objekte der Kunden in der Auswahl
  properties: StatsProperty[]
  // Inhaber-Kunden der Person (Auswahl ab zwei Kunden)
  tenants: StatsTenant[]
  // mehrere Kunden in der Auswertung: Kundennamen hinter Objekten und Wohnungen
  multiTenant: boolean
  // Heutiges Datum (Wien) vom Server, damit Browser und Server denselben Monat meinen
  today: string
}

// Filter der Auswertungen (PROJ-18): Kunde (refine 2026-11-08), Schnellwahl, Jahr, Von/Bis-Monat, Objekt und Wohnung. Alles
// steht in der Adresse (Neu laden, Lesezeichen, „Zurück“); jede Änderung ist ein eigener Verlaufseintrag. Die Kundenauswahl
// ändert weder den gewählten Kunden der übrigen Seiten noch den Kundenfilter des Dashboards.
export function StatsFilterBar({ filters, properties, tenants, multiTenant, today }: StatsFilterBarProps) {
  const t = useTranslations('statistics')
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const go = (next: Partial<StatsFilters>) => startTransition(() => router.push(statsHref({ ...filters, ...next }), { scroll: false }))
  const active = activeStatsQuickPick(filters, today)
  const monthName = (m: number) => t('monthName', { month: String(m) })
  // Ohne Objektwahl stehen alle Wohnungen zur Wahl, nach Objekt gruppiert
  const shown = filters.property ? properties.filter((p) => p.id === filters.property) : properties

  return (
    <section aria-label={t('filters.label')} aria-busy={pending} className="flex flex-col gap-4">
      {tenants.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="auswertung-kunde" className={LABEL}>
            {t('filters.tenant')}
          </Label>
          {/* Kundenwechsel setzt Objekt und Wohnung zurück */}
          <Select value={filters.tenant ?? ALL} onValueChange={(v) => go({ tenant: v === ALL ? null : v, property: null, apartment: null })}>
            <SelectTrigger id="auswertung-kunde" className="min-h-11 w-full sm:w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL} className="min-h-11">
                {t('filters.allTenants')}
              </SelectItem>
              {tenants.map((x) => (
                <SelectItem key={x.id} value={x.id} className="min-h-11">
                  {x.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        <span id="auswertung-schnellwahl" className={LABEL}>
          {t('filters.quick')}
        </span>
        <div role="group" aria-labelledby="auswertung-schnellwahl" className="flex flex-wrap gap-2">
          {STATS_QUICK_PICKS.map((p) => (
            <Button key={p} asChild variant={active === p ? 'default' : 'outline'} className="min-h-11">
              <Link href={statsHref({ ...filters, ...statsQuickPick(p, today) })} aria-current={active === p ? 'true' : undefined} scroll={false}>
                {t(`filters.${p}`)}
              </Link>
            </Button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:flex lg:flex-wrap lg:items-end">
        <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
          <Label htmlFor="auswertung-jahr" className={LABEL}>
            {t('filters.year')}
          </Label>
          <Select value={String(filters.year)} onValueChange={(v) => go({ year: Number(v) })}>
            <SelectTrigger id="auswertung-jahr" className="min-h-11 lg:w-32">
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
          <Label htmlFor="auswertung-von" className={LABEL}>
            {t('filters.from')}
          </Label>
          {/* Liegt „von“ nach „bis“, zieht „bis“ mit */}
          <Select value={String(filters.from)} onValueChange={(v) => go({ from: Number(v), to: Math.max(Number(v), filters.to) })}>
            <SelectTrigger id="auswertung-von" className="min-h-11 lg:w-40">
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
          <Label htmlFor="auswertung-bis" className={LABEL}>
            {t('filters.to')}
          </Label>
          <Select value={String(filters.to)} onValueChange={(v) => go({ to: Number(v) })}>
            <SelectTrigger id="auswertung-bis" className="min-h-11 lg:w-40">
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
        <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-1">
          <Label htmlFor="auswertung-objekt" className={LABEL}>
            {t('filters.property')}
          </Label>
          {/* Objektwechsel setzt die Wohnung zurück */}
          <Select value={filters.property ?? ALL} onValueChange={(v) => go({ property: v === ALL ? null : v, apartment: null })}>
            <SelectTrigger id="auswertung-objekt" className="min-h-11 lg:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL} className="min-h-11">
                {t('filters.allProperties')}
              </SelectItem>
              {properties.map((p) => (
                <SelectItem key={p.id} value={p.id} className="min-h-11">
                  {withTenant(p.name, p.tenantName, multiTenant)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 flex flex-col gap-1.5 sm:col-span-2 lg:col-span-1">
          <Label htmlFor="auswertung-wohnung" className={LABEL}>
            {t('filters.apartment')}
          </Label>
          <Select value={filters.apartment ?? ALL} onValueChange={(v) => go({ apartment: v === ALL ? null : v })}>
            <SelectTrigger id="auswertung-wohnung" className="min-h-11 lg:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL} className="min-h-11">
                {t('filters.allApartments')}
              </SelectItem>
              {shown.flatMap((p) =>
                p.apartments.map((a) => {
                  const name = filters.property ? a.name : withTenant(apartmentLabel(p.name, a.name), p.tenantName, multiTenant)
                  return (
                    <SelectItem key={a.id} value={a.id} className="min-h-11">
                      {a.archived ? t('filters.archived', { name }) : name}
                    </SelectItem>
                  )
                })
              )}
            </SelectContent>
          </Select>
        </div>
      </div>
    </section>
  )
}
