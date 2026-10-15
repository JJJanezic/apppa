import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { ConfirmLink } from '@/components/auth/confirm-link'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('auth.confirm')
  return { title: t('inviteTitle') }
}

type SearchParams = Promise<{ token_hash?: string; type?: string }>

// Bestätigungsseite für Mail-Links (Einladung, Passwort-Reset). Der Aufruf allein löst nichts ein.
export default async function ConfirmPage({ searchParams }: { searchParams: SearchParams }) {
  const { token_hash: tokenHash, type } = await searchParams
  const validType = type === 'invite' || type === 'recovery' ? type : null
  return <ConfirmLink tokenHash={tokenHash && validType ? tokenHash : null} type={validType ?? 'invite'} />
}
