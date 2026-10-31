import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { TenantMasterDataForm } from '@/components/tenant/tenant-master-data-form'
import { getOwnTenantMasterData } from '@/lib/team-data'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('settings')
  return { title: t('tenant') }
}

// Einstellungen → Stammdaten (PROJ-28, bis PROJ-38 „Kunde“), nur für Inhaber
export default async function TenantSettingsPage() {
  const data = await getOwnTenantMasterData()
  return <TenantMasterDataForm key={data.updatedAt} data={data} mode="owner" />
}
