import { WarningCircle } from '@phosphor-icons/react/ssr'
import { getTranslations } from 'next-intl/server'

import { RowTarget } from '@/components/dashboard/row-target'
import type { DashboardScope } from '@/lib/dashboard-data'
import { getNumberAlerts } from '@/lib/guest-sheet-numbering-data'

const SETTINGS_HREF = '/einstellungen/gaesteblatt'

// Hinweisblock „Gästeblattnummern“ (PROJ-26, Erweiterung 2026-11-09) unter den Kacheln: je Kunde im Filter und Gemeinde
// mit Wohnungen ein Hinweis, wenn nur noch wenige Nummern frei sind, der Bereich aufgebraucht oder nicht festgelegt ist.
// Immer mit Kundenname. Für Inhaber führt die Zeile zu Einstellungen → Gästeblatt dieses Kunden, für Mitarbeiter nur Text.
export async function GuestSheetNumberAlerts({ scope }: { scope: DashboardScope }) {
  const alerts = await getNumberAlerts(scope.scope.map((s) => s.id))
  if (!alerts.length) return null
  const t = await getTranslations('guestSheets.numbering')
  const owned = new Set(scope.owned.map((s) => s.id))

  return (
    <section aria-labelledby="gaesteblattnummern" className="flex flex-col gap-2 rounded-lg border border-ds-accent-2-700/40 bg-ds-accent-2-100 px-4 py-3 text-ds-accent-2-800">
      <h2 id="gaesteblattnummern" className="flex items-center gap-2 text-lg font-semibold">
        <WarningCircle size={20} weight="duotone" aria-hidden="true" />
        {t('dashboardTitle')}
      </h2>
      <ul className="flex flex-col">
        {alerts.map((a) => {
          const text = (
            <>
              <span className="font-semibold">{a.tenantName}</span> · {t(`notice.${a.state}`, { municipality: `${a.municipalityName} (${a.municipalityCode})`, count: a.free })}
            </>
          )
          return (
            <li key={`${a.tenantId}-${a.municipalityCode}`}>
              {owned.has(a.tenantId) ? (
                <RowTarget tenantId={a.tenantId} activeTenantId={scope.activeTenantId} href={SETTINGS_HREF} className="underline-offset-[3px] hover:underline">
                  {text}
                </RowTarget>
              ) : (
                <p className="px-1 py-2">{text}</p>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
