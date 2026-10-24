import { getTranslations } from 'next-intl/server'

import { PageHeader } from '@/components/page-header'
import { SettingsTabs } from '@/components/settings/settings-tabs'
import { requireArea } from '@/lib/areas'

// Einstellungen (nur Inhaber, PROJ-4): Reiter „Team“ und „Kunde“. Mitarbeiter bekommen „Seite nicht gefunden“.
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  await requireArea('settings')
  const t = await getTranslations('settings')
  return (
    <>
      <PageHeader title={t('title')} lead={t('lead')} />
      <div className="flex flex-col gap-8">
        <SettingsTabs />
        {children}
      </div>
    </>
  )
}
