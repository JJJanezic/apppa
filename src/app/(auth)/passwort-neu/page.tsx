import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { AuthCard } from '@/components/auth/auth-card'
import { NewPasswordForm } from '@/components/auth/new-password-form'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.newPassword')
  return { title: t('title') }
}

// Nach dem Einlösen des Reset-Links: neues Passwort festlegen
export default async function NewPasswordPage() {
  const t = await getTranslations('auth.newPassword')
  return (
    <AuthCard title={t('title')} intro={t('intro')}>
      <NewPasswordForm />
    </AuthCard>
  )
}
