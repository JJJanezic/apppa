'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'
import { toast } from 'sonner'

// Bestätigung „Gast gelöscht“ nach dem endgültigen Löschen (BUG-1 aus QA PROJ-7): Die Liste wird danach frisch
// geladen, deshalb kommt die Meldung über ?geloescht=1 und der Zusatz verschwindet gleich wieder aus der Adresse.
// Auch für „Rechnung gelöscht“ (PROJ-45, QA BUG-2) mit eigenem Text.
export function DeletedNotice({ message }: { message?: string }) {
  const t = useTranslations('guests.done')
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const shown = useRef(false)

  useEffect(() => {
    if (shown.current || params.get('geloescht') !== '1') return
    shown.current = true
    toast.success(message ?? t('deleted'))
    const rest = new URLSearchParams(params)
    rest.delete('geloescht')
    const search = rest.toString()
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false })
  }, [message, params, pathname, router, t])

  return null
}
