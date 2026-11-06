import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { PaymentMethodsSettings } from '@/components/payments/payment-methods-settings'
import { getPaymentMethodsWithUsage } from '@/lib/payments-data'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('settings')
  return { title: t('payments') }
}

// Einstellungen → Zahlungen (PROJ-45), nur für Inhaber (Layout prüft den Bereich): Zahlungsarten des Kunden
export default async function PaymentSettingsPage() {
  const { methods, ready } = await getPaymentMethodsWithUsage()
  return <PaymentMethodsSettings methods={methods} ready={ready} />
}
