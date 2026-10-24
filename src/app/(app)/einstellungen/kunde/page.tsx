import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { TenantNameForm } from '@/components/settings/tenant-name-form'
import { getTeam } from '@/lib/team-data'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('tenant')
  return { title: t('title') }
}

// Kundenkonto: vorerst nur der Name (weitere Firmendaten mit PROJ-15/16)
export default async function TenantSettingsPage() {
  const { tenantName } = await getTeam()
  return <TenantNameForm name={tenantName} />
}
