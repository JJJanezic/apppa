import { getTranslations } from 'next-intl/server'

import { KpiGrid, type KpiLink, KpiTile } from '@/components/kpi-tile'
import { Skeleton } from '@/components/ui/skeleton'
import { leadKind } from '@/lib/dashboard'
import { type DashboardScope, getOpenInvoices, getTodayOverview } from '@/lib/dashboard-data'
import { formatCents, formatNumber, formatPercent } from '@/lib/format'
import { currentMonth, currentMonthHref, occupancy } from '@/lib/statistics'
import { getDashboardStats } from '@/lib/statistics-data'

// Kacheln (PROJ-14, PROJ-18). Inhaber (mindestens ein Inhaber-Kunde im Filter) sehen wie im Entwurf Auslastung und Umsatz
// des laufenden Monats, offene Rechnungen und „Heute“ (An-/Abreisen); Auslastung und Umsatz zählen nur Inhaber-Kunden.
// Mitarbeiter sehen die Tageslage: Anreisen, Abreisen, belegte Wohnungen, offene Rechnungen.
export async function DashboardKpis({ scope, today }: { scope: DashboardScope; today: string }) {
  const t = await getTranslations('dashboard')
  const owner = scope.owned.length > 0
  const [day, open, stats] = await Promise.all([
    getTodayOverview(scope, today),
    getOpenInvoices(scope),
    owner ? getDashboardStats(scope.owned.map((o) => o.id), today) : null,
  ])
  const dash = t('kpiUnavailable')
  const openKnown = open.ready && !open.failed
  const openTile = (
    <KpiTile
      label={t('kpiOpen')}
      value={openKnown ? formatCents(open.totalCents) : dash}
      sub={openKnown ? t('kpiOpenSub', { count: open.count, overdue: open.overdue }) : undefined}
    />
  )

  if (stats) {
    const known = stats.ready && !stats.failed
    const month = String(currentMonth(today))
    const occ = occupancy(stats)
    // Klick öffnet die Auswertung des laufenden Monats – nur, wenn genau ein Inhaber-Kunde im Filter ist
    const single = scope.owned.length === 1 ? scope.owned[0] : null
    const link: KpiLink | undefined = single
      ? { href: currentMonthHref(today), switchTenantId: single.id === scope.activeTenantId ? null : single.id }
      : undefined
    const vat = await getTranslations('statistics.vat')
    return (
      <KpiGrid label={t('kpiLabel')}>
        <KpiTile
          label={t('kpiOccupancyMonth', { month })}
          value={known && occ !== null ? formatPercent(occ) : dash}
          sub={known ? t('kpiOccupancyMonthSub', { occupied: formatNumber(stats.occupiedNights), available: formatNumber(stats.availableNights) }) : undefined}
          link={link}
        />
        <KpiTile
          label={t('kpiRevenueMonth', { month })}
          value={known ? formatCents(stats.revenueCents) : dash}
          sub={known ? (stats.vatCents === 0 ? vat('none') : vat('included', { amount: formatCents(stats.vatCents) })) : undefined}
          link={link}
        />
        {openTile}
        <KpiTile
          label={t('kpiToday')}
          value={day.failed ? dash : `${formatNumber(day.arrivals.length)} / ${formatNumber(day.departures.length)}`}
          sub={day.departuresUnbilled ? `${t('kpiTodaySub')} · ${t('kpiTodayUnbilled', { count: formatNumber(day.departuresUnbilled) })}` : t('kpiTodaySub')}
        />
      </KpiGrid>
    )
  }

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
      {openTile}
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
