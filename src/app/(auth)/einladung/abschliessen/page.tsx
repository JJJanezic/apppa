import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { AuthCard } from '@/components/auth/auth-card'
import { AuthNotice } from '@/components/auth/auth-notice'
import { CompleteInviteForm } from '@/components/auth/complete-invite-form'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.invite')
  return { title: t('title') }
}

type SearchParams = Promise<{ hinweis?: string }>

// Nach dem Einlösen der Einladung: Anzeigename und Passwort festlegen.
// ?hinweis=abgemeldet: Beim Einlösen wurde eine andere Person in diesem Browser abgemeldet
export default async function CompleteInvitePage({ searchParams }: { searchParams: SearchParams }) {
  const { hinweis } = await searchParams
  const t = await getTranslations('auth')
  return (
    <AuthCard title={t('invite.title')} intro={t('invite.intro')}>
      {hinweis === 'abgemeldet' && <AuthNotice>{t('confirm.signedOutOther')}</AuthNotice>}
      <CompleteInviteForm />
    </AuthCard>
  )
}
