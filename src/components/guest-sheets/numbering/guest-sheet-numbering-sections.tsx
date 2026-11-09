'use client'

import { useTranslations } from 'next-intl'

import { SheetBackfillSwitch } from '@/components/guest-sheets/numbering/sheet-backfill-switch'
import { SheetNumberingSettings } from '@/components/guest-sheets/numbering/sheet-numbering-settings'
import { SettingsSection } from '@/components/invoice-settings/section-shell'
import type { SheetNumberingSettings as Data } from '@/lib/guest-sheet-numbering-data'

// Einstellungen → Gästeblatt bzw. Kunden-Detailseite des Betreibers (PROJ-26, Erweiterung 2026-11-09):
// „Laufende Nummer je Gemeinde“ und „Gästeblätter nacherfassen“
export function GuestSheetNumberingSections({ tenantId, data, level, readOnly = false }: { tenantId: string; data: Data; level: 2 | 3; readOnly?: boolean }) {
  const t = useTranslations('guestSheets')
  return (
    <>
      <SettingsSection level={level} title={t('numbering.title')} lead={t('numbering.lead')}>
        <SheetNumberingSettings tenantId={tenantId} municipalities={data.municipalities} ready={data.ready} readOnly={readOnly} level={level === 2 ? 3 : 4} />
      </SettingsSection>
      <SettingsSection level={level} title={t('backfill.title')}>
        <SheetBackfillSwitch key={String(data.backfill)} tenantId={tenantId} enabled={data.backfill} readOnly={readOnly || !data.ready} />
      </SettingsSection>
    </>
  )
}
