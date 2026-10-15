'use client'

import { LinkBreak } from '@phosphor-icons/react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { AuthCard } from '@/components/auth/auth-card'
import { ConfirmLinkForm } from '@/components/auth/confirm-link-form'
import { Button } from '@/components/ui/button'

interface ConfirmLinkProps {
  tokenHash: string | null
  type: 'invite' | 'recovery'
}

// Inhalt der Bestätigungsseite; zeigt bei fehlendem, abgelaufenem oder benutztem Link einen Ausweg
export function ConfirmLink({ tokenHash, type }: ConfirmLinkProps) {
  const t = useTranslations('auth.confirm')
  const [invalid, setInvalid] = useState(!tokenHash)

  if (invalid || !tokenHash) {
    return (
      <AuthCard title={t('invalidTitle')} intro={type === 'invite' ? t('invalidInvite') : t('invalidRecovery')}>
        <LinkBreak size={32} weight="duotone" aria-hidden="true" className="text-ds-accent-2-700" />
        {type === 'recovery' && (
          <Button asChild className="min-h-11">
            <Link href="/passwort-vergessen">{t('requestNew')}</Link>
          </Button>
        )}
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title={type === 'invite' ? t('inviteTitle') : t('recoveryTitle')}
      intro={type === 'invite' ? t('inviteText') : t('recoveryText')}
    >
      <ConfirmLinkForm tokenHash={tokenHash} type={type} onInvalid={() => setInvalid(true)} />
    </AuthCard>
  )
}
