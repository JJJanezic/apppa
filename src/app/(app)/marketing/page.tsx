import { Megaphone, MagnifyingGlass, UserCircleDashed } from '@phosphor-icons/react/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { EmptyState } from '@/components/empty-state'
import { MarketingFilterBar } from '@/components/marketing/marketing-filters'
import { MarketingList } from '@/components/marketing/marketing-list'
import { SegmentBar } from '@/components/marketing/segment-bar'
import { PageHeader } from '@/components/page-header'
import { ReportExportButtons } from '@/components/report-export-buttons'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { requireArea } from '@/lib/areas'
import { todayIso } from '@/lib/bookings'
import { EMPTY_FILTERS, filtersOf, hasAnyFilter, marketingExportHref, marketingFileName, marketingHref, parseMarketingView } from '@/lib/marketing'
import { cleanPlaces, getMarketingPage, getMarketingPlaces, getSegments } from '@/lib/marketing-data'
import { getTenantContext } from '@/lib/tenant'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('marketing')
  return { title: t('title') }
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>

// Marketing: Segmente und CSV-Export (PROJ-52), nur Inhaber des gewählten Kunden. Zeigt Gäste mit Einwilligung „Erteilt“
// (PROJ-19) und eigener E-Mail-Adresse oder Anschrift; Plattform-E-Mail und -Telefon blendet die Datenbank aus.
export default async function MarketingPage({ searchParams }: { searchParams: SearchParams }) {
  await requireArea('marketing')
  const t = await getTranslations('marketing')
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
  const [places, segments] = await Promise.all([getMarketingPlaces(active.id), getSegments(active.id)])
  // Objekte und Wohnungen, die es nicht mehr gibt (gespeichertes Segment, alter Link), fallen aus dem Filter
  const { view, dropped } = cleanPlaces(parseMarketingView(await searchParams), places)
  const page = await getMarketingPage(active.id, view)
  const filtered = hasAnyFilter(filtersOf(view))
  const exportDisabled = !page.ready || page.total === 0

  return (
    <>
      <PageHeader
        eyebrow={active.name}
        title={t('title')}
        lead={t('lead')}
        action={
          <ReportExportButtons
            kinds={['csv']}
            hrefs={{ csv: marketingExportHref(view) }}
            fileNames={{ csv: marketingFileName(active.name) }}
            namespace="marketing.export"
            disabled={exportDisabled}
          />
        }
      />
      <div className="flex flex-col gap-6">
        <SegmentBar view={view} segments={segments} />
        <MarketingFilterBar view={view} places={places} today={today} />

        {dropped && (
          <Alert>
            <AlertDescription>{t('placesDropped')}</AlertDescription>
          </Alert>
        )}

        {!page.ready ? (
          <Alert>
            <AlertDescription>{t('notReady')}</AlertDescription>
          </Alert>
        ) : (
          <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <p className="text-sm text-ds-neutral-800" aria-live="polite">
                {t('count', { count: page.total })}
              </p>
              {page.withoutContact > 0 && <p className="text-sm text-ds-neutral-800">{t('withoutContact', { count: page.withoutContact })}</p>}
            </div>
            {page.total > 0 ? (
              <MarketingList page={page} view={view} />
            ) : filtered ? (
              <EmptyState
                icon={MagnifyingGlass}
                title={t('noResultsTitle')}
                text={t('noResultsText')}
                action={
                  <Button asChild variant="outline" className="min-h-11">
                    <Link href={marketingHref({ ...EMPTY_FILTERS, segment: view.segment })}>{t('filters.reset')}</Link>
                  </Button>
                }
              />
            ) : (
              <EmptyState icon={Megaphone} title={t('emptyTitle')} text={t('emptyText')} />
            )}
          </section>
        )}
      </div>
    </>
  )
}
