import { Bank, UserCircleDashed } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { EmptyState } from '@/components/empty-state'
import { PageHeader } from '@/components/page-header'
import { TaxReportExportButtons } from '@/components/tourist-tax/export-buttons'
import { TaxReportFilterBar } from '@/components/tourist-tax/report-filters'
import { TaxReportBookings, TaxReportSummary } from '@/components/tourist-tax/report-tables'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { requireArea } from '@/lib/areas'
import { todayIso } from '@/lib/bookings'
import { buildTaxReport, parseTaxReportFilters, periodLabel, periodOpen, type TaxReportFilters, taxReportFileName } from '@/lib/tourist-tax-report'
import { getTouristTaxReport, hasTouristTaxRates } from '@/lib/tourist-tax-report-data'
import { getTenantContext } from '@/lib/tenant'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('touristTaxReport')
  return { title: t('title') }
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

// Ortstaxen-Berichte (PROJ-16), nur Inhaber, gewählter Kunde: je Gemeinde Personennächte und Betrag im gewählten
// Zeitraum, darunter die eingerechneten Buchungen; Export als PDF und CSV. Zahlen wie im Dashboard (PROJ-14).
export default async function TouristTaxReportPage({ searchParams }: { searchParams: SearchParams }) {
  await requireArea('tax')
  const t = await getTranslations('touristTaxReport')
  const { active } = await getTenantContext()
  if (!active) {
    const tTenant = await getTranslations('tenant')
    return (
      <>
        <PageHeader title={t('title')} />
        <EmptyState icon={UserCircleDashed} title={tTenant('noTenantTitle')} text={tTenant('noTenantText')} />
      </>
    )
  }

  const today = todayIso()
  const requested = parseTaxReportFilters(await searchParams, today)
  const [report, hasRates] = await Promise.all([getTouristTaxReport(requested), hasTouristTaxRates(active.id)])
  const view = buildTaxReport(report.rows, requested.municipality)
  // Gemeinde ohne Ortstaxe im Zeitraum: Filter fällt auf „Alle Gemeinden“ zurück
  const filters: TaxReportFilters = { ...requested, municipality: view.municipality }
  const empty = view.groups.length === 0
  const period = periodLabel((key, values) => t(key as never, values as never), filters)
  const municipalityName = view.municipalities.find((m) => m.id === filters.municipality)?.name ?? null

  return (
    <>
      <PageHeader
        eyebrow={active.name}
        title={t('title')}
        lead={t('lead')}
        action={
          <TaxReportExportButtons
            filters={filters}
            disabled={empty || !report.ready || report.failed}
            fileNames={{ pdf: taxReportFileName('pdf', filters, municipalityName, today), csv: taxReportFileName('csv', filters, municipalityName, today) }}
          />
        }
      />
      <div className="flex flex-col gap-6">
        <TaxReportFilterBar filters={filters} municipalities={view.municipalities} today={today} />

        {periodOpen(filters, today) && (
          <Alert>
            <AlertDescription>{t('periodOpen')}</AlertDescription>
          </Alert>
        )}

        {!report.ready ? (
          <Alert>
            <AlertDescription>{t('notReady')}</AlertDescription>
          </Alert>
        ) : report.failed ? (
          <Alert variant="destructive">
            <AlertDescription>{t('failed')}</AlertDescription>
          </Alert>
        ) : empty ? (
          <EmptyState
            icon={Bank}
            title={t('empty.title')}
            text={hasRates ? undefined : t('empty.noRates')}
            action={
              hasRates ? undefined : (
                <Link href="/einstellungen/wohnungen" className="text-sm text-ds-accent-700 underline underline-offset-4">
                  {t('empty.toApartments')}
                </Link>
              )
            }
          />
        ) : (
          <>
            <TaxReportSummary view={view} period={period} />
            <TaxReportBookings view={view} />
          </>
        )}
      </div>
    </>
  )
}
