'use client'

import { Info } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { dismissIdReadingPrivacyHint } from '@/app/(app)/einstellungen/gaesteblatt/actions'
import { callAction, FormError } from '@/components/auth/form-error'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

// Einstellungen → Gästeblatt (PROJ-51): Nach dem Freischalten von „Ausweis automatisch auslesen“ einmalig der Hinweis, den
// eigenen Datenschutz-Text (Teil A) zu prüfen. Nur bei eigenem Text; der Standardtext enthält den Satz bereits.
export function IdReadingPrivacyHint({ tenantId }: { tenantId: string }) {
  const t = useTranslations('idReading.privacyHint')
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function dismiss() {
    setError(null)
    setPending(true)
    const result = await callAction(() => dismissIdReadingPrivacyHint({ tenantId }))
    setPending(false)
    if (!result.ok) return setError(result.error)
    router.refresh()
  }

  return (
    <Alert className="border-ds-accent-700/40 bg-ds-accent-100">
      <Info size={18} aria-hidden="true" />
      <AlertTitle>{t('title')}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3">
        <p>{t('text')}</p>
        <FormError error={error} namespace="guestSheets.errors" />
        <Button type="button" variant="outline" className="min-h-11 self-start" disabled={pending} onClick={() => void dismiss()}>
          {t('dismiss')}
        </Button>
      </AlertDescription>
    </Alert>
  )
}
