'use client'

import { WarningCircle } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'

import { BackfillSection } from '@/components/invoice-settings/backfill-section'
import { FixedTextsSection } from '@/components/invoice-settings/fixed-texts-section'
import { NumberingSection } from '@/components/invoice-settings/numbering-section'
import { SettingsSection } from '@/components/invoice-settings/section-shell'
import { TextBlocksSection } from '@/components/invoice-settings/text-blocks-section'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { InvoiceSettingsData } from '@/lib/invoice-settings'

interface InvoiceSettingsProps {
  tenantId: string
  // null: nicht lesbar
  data: InvoiceSettingsData | null
  // Einstellungen → Rechnungen: Abschnitte als h2; Kunden-Detailseite des Betreibers: unter „Rechnungen“ als h3
  level: 2 | 3
  readOnly?: boolean
}

// Einstellungen → Rechnungen (PROJ-39), gleich für Inhaber und Betreiber: Nummernkreis, Textbausteine, feste Texte und
// der Schalter „Rechnungen nacherfassen“. Jeder Abschnitt speichert für sich.
// Die Seite setzt key auf die Stände der Abschnitte: Nach „Aktuelle Fassung laden“ starten die Formulare neu.
export function InvoiceSettings({ tenantId, data, level, readOnly = false }: InvoiceSettingsProps) {
  const t = useTranslations('invoiceSettings')

  if (!data) {
    return (
      <Alert role="alert" className="max-w-[720px] border-ds-accent-2-700/40 bg-ds-accent-2-100 text-ds-accent-2-800">
        <WarningCircle size={18} weight="duotone" aria-hidden="true" />
        <AlertDescription>{t('loadFailed')}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="flex min-w-0 flex-col gap-10">
      {readOnly && <p className="text-ds-neutral-800">{t('readOnlyHint')}</p>}
      <SettingsSection level={level} title={t('numbering.title')} lead={t('numbering.lead')}>
        <NumberingSection key={data.numbering.updatedAt} tenantId={tenantId} data={data} readOnly={readOnly} />
      </SettingsSection>
      <SettingsSection level={level} title={t('blocks.title')} lead={t('blocks.lead')}>
        <TextBlocksSection tenantId={tenantId} data={data} readOnly={readOnly} level={level === 2 ? 3 : 4} />
      </SettingsSection>
      <SettingsSection level={level} title={t('fixedTexts.title')} lead={t('fixedTexts.lead')}>
        <FixedTextsSection key={data.fixedTexts.updatedAt} tenantId={tenantId} data={data} readOnly={readOnly} />
      </SettingsSection>
      <SettingsSection level={level} title={t('backfill.title')}>
        <BackfillSection key={data.backfill.updatedAt} tenantId={tenantId} data={data} readOnly={readOnly} />
      </SettingsSection>
    </div>
  )
}
