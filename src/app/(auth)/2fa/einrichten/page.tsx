import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { AuthCard } from '@/components/auth/auth-card'
import { MfaSetup } from '@/components/auth/mfa-setup'
import { getSessionUser, pendingMfaStep } from '@/lib/auth/session'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.mfaSetup')
  return { title: t('title') }
}

// Pflicht-Einrichtung der Zwei-Faktor-Anmeldung für den Betreiber-Admin
export default async function MfaSetupPage() {
  // Nur solange der Admin noch kein Gerät hat; weitere Geräte unter „Mein Konto“
  const user = await getSessionUser()
  if (!user) redirect('/anmelden')
  const step = await pendingMfaStep(user)
  if (step !== '/2fa/einrichten') redirect(step ?? '/')

  const t = await getTranslations('auth.mfaSetup')
  return (
    <AuthCard title={t('title')} intro={t('intro')}>
      <MfaSetup />
    </AuthCard>
  )
}
