import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'

import { AuthCard } from '@/components/auth/auth-card'
import { NewPasswordForm } from '@/components/auth/new-password-form'
import { getSessionUser, pendingMfaStep } from '@/lib/auth/session'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.newPassword')
  return { title: t('title') }
}

// Nach dem Einlösen des Reset-Links: neues Passwort festlegen.
// Der Admin bestätigt vorher seinen Code (Supabase verlangt für Passwortänderungen mit 2FA-Gerät aal2).
export default async function NewPasswordPage() {
  const user = await getSessionUser()
  if (!user) redirect('/anmelden')
  if ((await pendingMfaStep(user)) === '/2fa') redirect('/2fa?next=/passwort-neu')

  const t = await getTranslations('auth.newPassword')
  return (
    <AuthCard title={t('title')} intro={t('intro')}>
      <NewPasswordForm />
    </AuthCard>
  )
}
