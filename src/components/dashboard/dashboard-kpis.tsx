import { getTranslations } from 'next-intl/server'

import { KpiGrid, KpiTile } from '@/components/kpi-tile'
import { Skeleton } from '@/components/ui/skeleton'
import { leadKind } from '@/lib/dashboard'
import { type DashboardScope, getOpenInvoices, getTodayOverview } from '@/lib/dashboard-data'
import { formatCents, formatNumber } from '@/lib/format'

// Kacheln zur Tageslage (PROJ-14): Anreisen, Abreisen, belegte Wohnungen, offene Rechnungen
export async function DashboardKpis({ scope, today }: { scope: DashboardScope; today: string }) {
  const t = await getTranslations('dashboard')
  const [day, open] = await Promise.all([getTodayOverview(scope, today), getOpenInvoices(scope)])
  const dash = t('kpiUnavailable')
  const openKnown = open.ready && !open.failed

  return (
    <KpiGrid label={t('kpiLabel')}>
      <KpiTile
        label={t('kpiArrivals')}
        value={day.failed ? dash : formatNumber(day.arrivals.length)}
        sub={day.failed ? undefined : t('kpiArrivalsSub', { count: day.arrivingGuests })}
      />
      <KpiTile
        label={t('kpiDepartures')}
        value={day.failed ? dash : formatNumber(day.departures.length)}
        sub={day.departuresUnbilled ? t('kpiDeparturesSub', { count: formatNumber(day.departuresUnbilled) }) : undefined}
      />
      <KpiTile
        label={t('kpiOccupied')}
        value={day.failed ? dash : `${formatNumber(day.occupied)} / ${formatNumber(day.apartments)}`}
        sub={t('kpiOccupiedSub')}
      />
      <KpiTile
        label={t('kpiOpen')}
        value={openKnown ? formatCents(open.totalCents) : dash}
        sub={openKnown ? t('kpiOpenSub', { count: open.count, overdue: open.overdue }) : undefined}
      />
    </KpiGrid>
  )
}

export function DashboardKpisSkeleton() {
  return (
    <div aria-busy="true" className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-28 w-full rounded-lg" />
      ))}
    </div>
  )
}

// Unterzeile unter dem Gruß: Satz über den Tag (ohne Wohnungen die bisherige Begrüßung)
export async function DashboardLead({ scope, today }: { scope: DashboardScope; today: string }) {
  const t = await getTranslations('dashboard')
  const day = await getTodayOverview(scope, today)
  if (day.failed) return t('lead')
  const kind = leadKind(day)
  if (kind === 'none') return t('lead')
  const occupancy = { occupied: formatNumber(day.occupied), total: formatNumber(day.apartments) }
  return kind === 'noMovement'
    ? t('leadNoMovement', occupancy)
    : t('leadMovement', { arrivals: day.arrivingGuests, departures: day.departures.length, ...occupancy })
}
