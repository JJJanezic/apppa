import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { InvoiceSettings } from '@/components/invoice-settings/invoice-settings'
import { getOwnInvoiceSettings } from '@/lib/invoice-settings-data'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('settings')
  return { title: t('invoices') }
}

// Einstellungen → Rechnungen (PROJ-39), nur für Inhaber: Nummernkreis, Textbausteine, feste Texte, Nacherfassen
export default async function InvoiceSettingsPage() {
  const { tenantId, data } = await getOwnInvoiceSettings()
  return <InvoiceSettings tenantId={tenantId} data={data} level={2} />
}
