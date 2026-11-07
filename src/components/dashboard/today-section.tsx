import { SignIn, SignOut } from '@phosphor-icons/react/ssr'
import { getTranslations } from 'next-intl/server'

import { colorChannel } from '@/components/calendar/entry-style'
import { bookingHref } from '@/lib/bookings'
import type { TodayRow } from '@/lib/dashboard'
import type { DashboardScope } from '@/lib/dashboard-data'
import { getTodayOverview } from '@/lib/dashboard-data'
import { formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'

import { RowTarget } from './row-target'
import { DashboardSection, SectionEmpty, SectionProblem } from './section'

// Farbpunkt nach Kanal wie im Kalender; Optionen nur mit Rahmen
const DOT = { direct: 'bg-ds-neutral-800', booking_com: 'bg-ds-accent-700' } as const
const dotClass = (r: TodayRow) =>
  r.kind === 'option' ? `border ${r.source === 'booking_com' ? 'border-ds-accent-700' : 'border-ds-neutral-800'} bg-ds-bg` : DOT[colorChannel(r)]

// Abschnitt „Heute“ (PROJ-14): Anreisen und Abreisen; Abreisen ohne (Schluss-)Rechnung hervorgehoben
export async function TodaySection({ scope, today }: { scope: DashboardScope; today: string }) {
  const t = await getTranslations('dashboard')
  const data = await getTodayOverview(scope, today)

  return (
    <DashboardSection id="heute-titel" title={t('today.title')}>
      {data.failed ? (
        <SectionProblem text={t('sectionError')} retry />
      ) : (
        <div className="flex flex-col gap-4">
          <TodayList
            icon={<SignIn size={16} weight="duotone" aria-hidden="true" />}
            title={t('today.arrivals')}
            empty={t('today.noArrivals')}
            rows={data.arrivals}
            scope={scope}
            info={(r) => t('today.arrivalInfo', { persons: formatNumber(r.persons), nights: formatNumber(r.nights) })}
          />
          <TodayList
            icon={<SignOut size={16} weight="duotone" aria-hidden="true" />}
            title={t('today.departures')}
            empty={t('today.noDepartures')}
            rows={data.departures}
            scope={scope}
            info={(r) => (r.billing && r.billing !== 'billed' ? t(`billing.${r.billing}`) : t('today.cleaning'))}
            warn={(r) => r.billing !== null && r.billing !== 'billed'}
          />
        </div>
      )}
    </DashboardSection>
  )
}

async function TodayList({
  icon,
  title,
  empty,
  rows,
  scope,
  info,
  warn,
}: {
  icon: React.ReactNode
  title: string
  empty: string
  rows: TodayRow[]
  scope: DashboardScope
  info: (r: TodayRow) => string
  warn?: (r: TodayRow) => boolean
}) {
  const t = await getTranslations('dashboard')
  const tb = await getTranslations('bookings')
  return (
    <div className="flex flex-col gap-0.5">
      <h3 className="flex items-center gap-1.5 text-[13px] font-normal text-ds-neutral-700">
        {icon}
        {title}
      </h3>
      {rows.length === 0 ? (
        <SectionEmpty>{empty}</SectionEmpty>
      ) : (
        <ul className="flex flex-col">
          {rows.map((r) => {
            const highlighted = warn?.(r) ?? false
            return (
              <li key={r.id}>
                <RowTarget
                  tenantId={r.tenantId}
                  activeTenantId={scope.activeTenantId}
                  href={bookingHref(r.id)}
                  className={cn('grid min-h-11 grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-2.5', highlighted && 'bg-ds-accent-2-100 hover:bg-ds-accent-2-100')}
                >
                  <span className={cn('size-2.5 rounded-sm', dotClass(r))} aria-hidden="true" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">
                      {r.kind === 'option' && <span className="text-ds-neutral-700">{`${t('today.option')} · `}</span>}
                      {r.guestName ?? tb('kind.booking')}
                    </span>
                    <span className="truncate text-xs text-ds-neutral-700">{[r.apartmentLabel, r.tenantName].filter(Boolean).join(' · ')}</span>
                  </span>
                  <span className={cn('text-right text-[13px]', highlighted ? 'font-semibold text-ds-accent-2-700' : 'text-ds-neutral-800')}>{info(r)}</span>
                </RowTarget>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
