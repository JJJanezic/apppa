import { ChartLineUp, UserCircleDashed } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getLocale, getTranslations } from 'next-intl/server'

import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { ReportExportButtons } from '@/components/report-export-buttons'
import { StatsApartmentTable } from '@/components/statistics/stats-apartment-table'
import { StatsCard } from '@/components/statistics/stats-cells'
import { StatsChart } from '@/components/statistics/stats-chart'
import { StatsFilterBar } from '@/components/statistics/stats-filters'
import { StatsKpis } from '@/components/statistics/stats-kpis'
import { StatsMonthTable } from '@/components/statistics/stats-month-table'
import { StatsOriginTable } from '@/components/statistics/stats-origin-table'
import { StatsTenantTable } from '@/components/statistics/stats-tenant-table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { requireArea } from '@/lib/areas'
import { todayIso } from '@/lib/bookings'
import { countryName } from '@/lib/guests'
import {
  buildOrigin,
  buildStats,
  filteredApartmentIds,
  groupProperties,
  parseStatsFilters,
  resolveStatsFilters,
  statsExportHref,
  statsFileName,
} from '@/lib/statistics'
import { getStatsData } from '@/lib/statistics-data'
import { periodLabel, periodOpen } from '@/lib/tourist-tax-report'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('statistics')
  return { title: t('title') }
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

// Statistische Auswertungen (PROJ-18): Auslastung, Umsatz und Gästeherkunft im gewählten Zeitraum mit Vorjahresvergleich,
// filterbar nach Objekt und Wohnung; Export als PDF und CSV. Seit refine 2026-11-08 über alle Kunden, bei denen die Person
// Inhaber ist, oder einen davon (Kundenauswahl in der Adresse, unabhängig vom gewählten Kunden der übrigen Seiten).
export default async function StatisticsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireArea('reports')
  const t = await getTranslations('statistics')
  const tTax = await getTranslations('touristTaxReport')

  const today = todayIso()
  const locale = await getLocale()
  const requested = parseStatsFilters(await searchParams, today)
  const data = await getStatsData(requested)
  if (data.tenants.length === 0) {
    const tTenant = await getTranslations('tenant')
    return (
      <>
        <PageHeader title={t('title')} />
        <EmptyState icon={UserCircleDashed} title={tTenant('noTenantTitle')} text={tTenant('noTenantText')} />
      </>
    )
  }
  const filters = resolveStatsFilters(requested, data.apartments, data.tenants)
  const view = buildStats(data.rows, data.apartments, filters, data.tenants)
  const chosenTenant = data.tenants.find((x) => x.id === filters.tenant) ?? (data.tenants.length === 1 ? data.tenants[0] : null)
  const origin = buildOrigin(data.origin, filteredApartmentIds(filters, data.apartments), (c) => countryName(c, locale))
  // Objekte der Kunden in der Auswahl (bei „Alle Kunden“ alle Inhaber-Kunden)
  const properties = groupProperties(data.apartments.filter((a) => !filters.tenant || a.tenantId === filters.tenant))
  const hasApartments = data.apartments.some((a) => !filters.tenant || a.tenantId === filters.tenant)
  const unavailable = !data.ready || data.failed
  // Zeitraum in Worten wie bei der Ortstaxe („Jänner – Dezember 2026“ heißt dort „2026“)
  const period = periodLabel((key, values) => tTax(key as never, values as never), filters)

  return (
    <>
      <PageHeader
        eyebrow={chosenTenant?.name ?? t('allTenants')}
        title={t('title')}
        lead={t('lead')}
        action={
          <ReportExportButtons
            hrefs={{ pdf: statsExportHref('pdf', filters), csv: statsExportHref('csv', filters) }}
            namespace="statistics.export"
            disabled={view.empty || unavailable}
            fileNames={{
              pdf: statsFileName('pdf', filters, data.apartments, data.tenants, today),
              csv: statsFileName('csv', filters, data.apartments, data.tenants, today),
            }}
          />
        }
      />
      <div className="flex flex-col gap-6">
        <StatsFilterBar filters={filters} properties={properties} tenants={data.tenants} multiTenant={view.multiTenant} today={today} />

        {periodOpen(filters, today) && (
          <Alert>
            <AlertDescription>{t('periodOpen')}</AlertDescription>
          </Alert>
        )}

        {!data.ready ? (
          <Alert>
            <AlertDescription>{t('notReady')}</AlertDescription>
          </Alert>
        ) : data.failed ? (
          <Alert variant="destructive">
            <AlertDescription>{t('failed')}</AlertDescription>
          </Alert>
        ) : view.empty ? (
          <EmptyState
            icon={ChartLineUp}
            title={t('empty.title')}
            text={hasApartments ? undefined : t('empty.noApartments')}
            action={
              !hasApartments ? (
                <Link href="/einstellungen/wohnungen" className="text-sm text-ds-accent-700 underline underline-offset-4">
                  {t('empty.toApartments')}
                </Link>
              ) : undefined
            }
          />
        ) : (
          <>
            <StatsKpis totals={view.totals} />
            <StatsCard id="auswertung-monate" title={t('chart.title')} lead={`${period} · ${t('months.previousHint')}`}>
              <StatsChart view={view} year={filters.year} />
              <StatsMonthTable view={view} year={filters.year} />
            </StatsCard>
            {view.tenants.length > 0 && (
              <StatsCard id="auswertung-kunden" title={t('tenants.title')}>
                <StatsTenantTable view={view} />
              </StatsCard>
            )}
            {view.apartments.length > 0 && (
              <StatsCard id="auswertung-wohnungen" title={t('apartments.title')}>
                <StatsApartmentTable lines={view.apartments} multiTenant={view.multiTenant} />
              </StatsCard>
            )}
            <StatsCard id="auswertung-herkunft" title={t('origin.title')} lead={t('origin.lead')}>
              {origin.top.length === 0 ? <p className="text-ds-neutral-800">{t('origin.empty')}</p> : <StatsOriginTable view={origin} />}
            </StatsCard>
          </>
        )}
      </div>
    </>
  )
}
