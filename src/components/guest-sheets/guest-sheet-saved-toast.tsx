'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { toast } from 'sonner'

// Nach „Fertig“ (PROJ-26) kommt die Vollbild-Seite mit ?gaesteblatt=gespeichert zur Buchung zurück: einmal melden und die
// Adresse bereinigen, damit „Neu laden“ die Meldung nicht wiederholt
export function GuestSheetSavedToast() {
  const t = useTranslations('guestSheets.signing')
  const params = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const saved = params.get('gaesteblatt') === 'gespeichert'
  useEffect(() => {
    if (!saved) return
    toast.success(t('savedToast'))
    router.replace(pathname, { scroll: false })
  }, [saved, pathname, router, t])
  return null
}
