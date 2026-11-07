'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { toast } from 'sonner'

// Hinweis nach dem Kundenwechsel ohne Zugriff (?hinweis=kein-zugriff): einmal anzeigen, dann aus der Adresse entfernen
export function DashboardNotice() {
  const t = useTranslations('dashboard')
  const router = useRouter()
  useEffect(() => {
    toast.error(t('noAccess'))
    router.replace('/', { scroll: false })
  }, [router, t])
  return null
}
