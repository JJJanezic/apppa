import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { AuthCard } from '@/components/auth/auth-card'
import { MfaChallenge } from '@/components/auth/mfa-challenge'
import { safeRedirectPath } from '@/lib/safe-redirect'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.mfa')
  return { title: t('title') }
}

type SearchParams = Promise<{ next?: string }>

// Code-Abfrage nach dem Passwort (nur Betreiber-Admin)
export default async function MfaPage({ searchParams }: { searchParams: SearchParams }) {
  const { next } = await searchParams
  const t = await getTranslations('auth.mfa')
  return (
    <AuthCard title={t('title')} intro={t('intro')}>
      <MfaChallenge next={next ? safeRedirectPath(next, 'https://app.local') : undefined} />
    </AuthCard>
  )
}
