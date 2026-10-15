import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { AuthCard } from '@/components/auth/auth-card'
import { MfaChallenge } from '@/components/auth/mfa-challenge'
import { getSessionUser, pendingMfaStep } from '@/lib/auth/session'
import { safeRedirectPath } from '@/lib/safe-redirect'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.mfa')
  return { title: t('title') }
}

type SearchParams = Promise<{ next?: string }>

// Code-Abfrage nach dem Passwort (nur Betreiber-Admin)
export default async function MfaPage({ searchParams }: { searchParams: SearchParams }) {
  const { next } = await searchParams
  const target = next ? safeRedirectPath(next, 'https://app.local') : undefined

  // Nur für den Admin mit Gerät und noch unbestätigter Sitzung; sonst weiter zum Ziel bzw. zur Einrichtung
  const user = await getSessionUser()
  if (!user) redirect('/anmelden')
  const step = await pendingMfaStep(user)
  if (step === null) redirect(target ?? '/')
  if (step === '/2fa/einrichten') redirect(step)

  const t = await getTranslations('auth.mfa')
  return (
    <AuthCard title={t('title')} intro={t('intro')}>
      <MfaChallenge next={target} />
    </AuthCard>
  )
}
