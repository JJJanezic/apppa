import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { EstablishmentNumbersForm } from '@/components/tenant/establishment-numbers-form'
import { TenantMasterDataForm } from '@/components/tenant/tenant-master-data-form'
import { loadEstablishmentNumbers } from '@/lib/guest-sheet-numbering-data'
import { getOwnTenantMasterData } from '@/lib/team-data'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('settings')
  return { title: t('tenant') }
}

// Einstellungen → Stammdaten (PROJ-28, bis PROJ-38 „Kunde“), nur für Inhaber; darunter die Kennzahlen je Gemeinde
// (PROJ-26, Erweiterung 2026-11-09)
export default async function TenantSettingsPage() {
  const data = await getOwnTenantMasterData()
  const establishment = await loadEstablishmentNumbers(data.id)
  return (
    <div className="flex min-w-0 flex-col gap-10">
      <TenantMasterDataForm key={data.updatedAt} data={data} mode="owner" />
      <EstablishmentNumbersForm
        key={establishment.items.map((i) => `${i.code}:${i.number ?? ''}`).join('|')}
        tenantId={data.id}
        items={establishment.items}
        ready={establishment.ready}
        level={2}
      />
    </div>
  )
}
