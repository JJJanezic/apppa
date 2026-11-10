'use client'

import { SignOut } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { FormError } from '@/components/auth/form-error'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import type { AuthErrorCode } from '@/lib/auth/result'
import { requestSignOut } from '@/lib/auth/requests'

// „Auf allen Geräten abmelden“ mit Bestätigung; beendet auch die aktuelle Sitzung
export function SignOutEverywhere() {
  const t = useTranslations('account')
  const [error, setError] = useState<AuthErrorCode | null>(null)
  const [pending, setPending] = useState(false)

  async function confirm() {
    setPending(true)
    setError(null)
    const result = await requestSignOut({ everywhere: true })
    if (result.ok) {
      window.location.href = '/anmelden?grund=abgemeldet'
      return
    }
    if (result.error === 'sessionExpired') {
      const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`)
      window.location.href = `/anmelden?grund=sitzung-abgelaufen&next=${next}`
      return
    }
    setPending(false)
    setError(result.error)
  }

  return (
    <div className="flex flex-col gap-4">
      <FormError error={error} />
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="outline" className="min-h-11 self-start" disabled={pending}>
            <SignOut size={18} aria-hidden="true" />
            {t('sessionsButton')}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('sessionsConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('sessionsConfirmText')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">{t('cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirm} className="min-h-11">
              {t('sessionsConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
