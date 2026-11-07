import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { bookingHref, bookingListHref } from '@/lib/bookings'
import { type DashboardScope, getUnbilled } from '@/lib/dashboard-data'
import { formatDate, formatNumber } from '@/lib/format'

import { RowTarget } from './row-target'
import { DashboardSection, SectionEmpty, SectionProblem } from './section'

// Abschnitt „Noch nicht abgerechnet“ (PROJ-14, nur Inhaber-Kunden): die 5 ältesten, Anzahl und Link zur Buchungsliste
export async function UnbilledSection({ scope, today }: { scope: DashboardScope; today: string }) {
  const t = await getTranslations('dashboard')
  const tb = await getTranslations('bookings')
  const data = await getUnbilled(scope, today)

  return (
    <DashboardSection id="abrechnung-titel" title={t('unbilled.title')} aside={data.ready && !data.failed && data.count > 0 ? formatNumber(data.count) : undefined}>
      {!data.ready ? (
        <SectionProblem text={t('sectionUnavailable')} />
      ) : data.failed ? (
        <SectionProblem text={t('sectionError')} retry />
      ) : data.rows.length === 0 ? (
        <SectionEmpty>{t('unbilled.empty')}</SectionEmpty>
      ) : (
        <>
          <ul className="flex flex-col">
            {data.rows.map((r) => (
              <li key={r.id}>
                <RowTarget tenantId={r.tenantId} activeTenantId={scope.activeTenantId} href={bookingHref(r.id)} className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{r.guestName ?? tb('kind.booking')}</span>
                    <span className="truncate text-xs text-ds-neutral-700">
                      {[r.apartmentLabel, r.tenantName, t(r.cancelled ? 'unbilled.cancelled' : 'unbilled.departure', { date: formatDate(r.date) })]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <span className="text-right text-[13px] font-semibold text-ds-accent-2-700">{t(`billing.${r.billing}`)}</span>
                </RowTarget>
              </li>
            ))}
          </ul>
          {data.count > data.rows.length && (
            <Link href={bookingListHref({ invoice: 'without' }, today)} className="self-start text-sm text-ds-accent-700 underline underline-offset-4">
              {t('unbilled.all')}
            </Link>
          )}
        </>
      )}
    </DashboardSection>
  )
}
