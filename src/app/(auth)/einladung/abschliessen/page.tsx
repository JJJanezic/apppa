import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { AuthCard } from '@/components/auth/auth-card'
import { CompleteInviteForm } from '@/components/auth/complete-invite-form'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.invite')
  return { title: t('title') }
}

// Nach dem Einlösen der Einladung: Anzeigename und Passwort festlegen
export default async function CompleteInvitePage() {
  const t = await getTranslations('auth.invite')
  return (
    <AuthCard title={t('title')} intro={t('intro')}>
      <CompleteInviteForm />
    </AuthCard>
  )
}
