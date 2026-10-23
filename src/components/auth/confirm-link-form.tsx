'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { confirmEmailLink } from '@/app/(auth)/actions'
import { callAction, FormError } from '@/components/auth/form-error'
import { Button } from '@/components/ui/button'
import type { AuthErrorCode } from '@/lib/auth/result'

interface ConfirmLinkFormProps {
  tokenHash: string
  type: 'invite' | 'recovery'
  onInvalid: () => void
}

// Knopf auf der Bestätigungsseite: Erst dieser Klick löst den Mail-Link ein (Linkscanner rufen nur auf)
export function ConfirmLinkForm({ tokenHash, type, onInvalid }: ConfirmLinkFormProps) {
  const t = useTranslations('auth.confirm')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<AuthErrorCode | null>(null)

  async function confirm() {
    setPending(true)
    setError(null)
    const result = await callAction(() => confirmEmailLink({ tokenHash, type }))
    if (result.ok) {
      const target = result.redirectTo ?? (type === 'invite' ? '/einladung/abschliessen' : '/passwort-neu')
      // War vorher eine andere Person angemeldet, zeigt die Folgeseite einen Hinweis (BUG-2 aus QA)
      window.location.href = result.data?.signedOutOther ? `${target}?hinweis=abgemeldet` : target
      return
    }
    setPending(false)
    if (result.error === 'linkInvalid') onInvalid()
    else setError(result.error)
  }

  return (
    <div className="flex flex-col gap-5">
      <FormError error={error} />
      <Button type="button" onClick={confirm} disabled={pending} aria-busy={pending} className="min-h-11">
        {type === 'invite' ? t('inviteSubmit') : t('recoverySubmit')}
      </Button>
    </div>
  )
}
