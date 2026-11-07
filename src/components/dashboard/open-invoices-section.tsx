import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { Amount } from '@/components/amount'
import { OPEN_INVOICES_SHOWN } from '@/lib/dashboard'
import { type DashboardScope, getOpenInvoices } from '@/lib/dashboard-data'
import { invoiceHref, invoiceListHref } from '@/lib/invoices'

import { RowTarget } from './row-target'
import { DashboardSection, SectionEmpty, SectionProblem } from './section'

// Abschnitt „Offene Rechnungen“ (PROJ-14): Summe aller offenen Beträge, die ersten 5 (überfällige zuerst)
export async function OpenInvoicesSection({ scope }: { scope: DashboardScope }) {
  const t = await getTranslations('dashboard')
  const data = await getOpenInvoices(scope)
  const shown = data.rows.slice(0, OPEN_INVOICES_SHOWN)

  return (
    <DashboardSection
      id="offen-titel"
      title={t('openInvoices.title')}
      aside={data.ready && !data.failed && data.count > 0 ? <Amount cents={data.totalCents} className="font-semibold text-ds-accent-2-700" /> : undefined}
    >
      {!data.ready ? (
        <SectionProblem text={t('sectionUnavailable')} />
      ) : data.failed ? (
        <SectionProblem text={t('sectionError')} retry />
      ) : shown.length === 0 ? (
        <SectionEmpty>{t('openInvoices.empty')}</SectionEmpty>
      ) : (
        <>
          <ul className="flex flex-col">
            {shown.map((r) => (
              <li key={r.id}>
                <RowTarget tenantId={r.tenantId} activeTenantId={scope.activeTenantId} href={invoiceHref(r.id)} className="grid min-h-11 grid-cols-[minmax(0,1fr)_auto] items-center gap-2.5">
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{r.recipient}</span>
                    <span className="truncate text-xs text-ds-neutral-700">
                      {[r.number ?? t('openInvoices.noNumber'), r.apartmentLabel, r.tenantName].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                  <span className="flex flex-col items-end">
                    <Amount cents={r.openCents} />
                    {r.overdue && <span className="text-xs font-semibold text-destructive">{t('openInvoices.overdue')}</span>}
                  </span>
                </RowTarget>
              </li>
            ))}
          </ul>
          {data.count > shown.length && (
            <Link href={invoiceListHref({ payment: 'unpaid' })} className="self-start text-sm text-ds-accent-700 underline underline-offset-4">
              {t('openInvoices.all')}
            </Link>
          )}
        </>
      )}
    </DashboardSection>
  )
}
