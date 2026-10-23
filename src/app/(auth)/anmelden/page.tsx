import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { AuthCard } from '@/components/auth/auth-card'
import { AuthNotice } from '@/components/auth/auth-notice'
import { LoginForm } from '@/components/auth/login-form'
import { safeRedirectPath } from '@/lib/safe-redirect'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.login')
  return { title: t('title') }
}

type SearchParams = Promise<{ next?: string; grund?: string }>

// Hinweise nach Weiterleitungen: ?grund=abgemeldet | sitzung-abgelaufen
export default async function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  const { next, grund } = await searchParams
  const t = await getTranslations('auth.login')
  // Rücksprung nur auf Seiten der App (Schutz aus PROJ-1)
  const safeNext = next ? safeRedirectPath(next, 'https://app.local') : undefined
  const notice = grund === 'abgemeldet' ? t('loggedOut') : grund === 'sitzung-abgelaufen' ? t('sessionExpired') : null

  return (
    <AuthCard title={t('title')}>
      {notice && <AuthNotice>{notice}</AuthNotice>}
      <LoginForm next={safeNext} />
    </AuthCard>
  )
}
