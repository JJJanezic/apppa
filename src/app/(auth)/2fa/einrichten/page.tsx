import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { AuthCard } from '@/components/auth/auth-card'
import { MfaSetup } from '@/components/auth/mfa-setup'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.mfaSetup')
  return { title: t('title') }
}

// Pflicht-Einrichtung der Zwei-Faktor-Anmeldung für den Betreiber-Admin
export default async function MfaSetupPage() {
  const t = await getTranslations('auth.mfaSetup')
  return (
    <AuthCard title={t('title')} intro={t('intro')}>
      <MfaSetup />
    </AuthCard>
  )
}
