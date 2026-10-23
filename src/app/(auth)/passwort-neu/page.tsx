import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { AuthCard } from '@/components/auth/auth-card'
import { AuthNotice } from '@/components/auth/auth-notice'
import { NewPasswordForm } from '@/components/auth/new-password-form'
import { getSessionUser, pendingMfaStep } from '@/lib/auth/session'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.newPassword')
  return { title: t('title') }
}

// Nach dem Einlösen des Reset-Links: neues Passwort festlegen.
// Der Admin bestätigt vorher seinen Code (Supabase verlangt für Passwortänderungen mit 2FA-Gerät aal2).
type SearchParams = Promise<{ hinweis?: string }>

// ?hinweis=abgemeldet: Beim Einlösen wurde eine andere Person in diesem Browser abgemeldet
export default async function NewPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const { hinweis } = await searchParams
  const user = await getSessionUser()
  if (!user) redirect('/anmelden')
  if ((await pendingMfaStep(user)) === '/2fa') redirect('/2fa?next=/passwort-neu')

  const t = await getTranslations('auth')
  return (
    <AuthCard title={t('newPassword.title')} intro={t('newPassword.intro')}>
      {hinweis === 'abgemeldet' && <AuthNotice>{t('confirm.signedOutOther')}</AuthNotice>}
      <NewPasswordForm />
    </AuthCard>
  )
}
