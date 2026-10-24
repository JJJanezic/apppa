'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'

import { callAction } from '@/components/auth/form-error'
import type { ActionResult } from '@/lib/auth/result'

// Führt eine Team- bzw. Betreiber-Aktion aus: Erfolg → Hinweis-Meldung und Seite neu laden (bzw. Weiterleitung),
// Fehler → Meldung aus „team.errors“ bzw. „operator.errors“. pending verhindert Doppelklicks.
export function useTeamAction(namespace: 'team.errors' | 'operator.errors' | 'apartments.errors' = 'team.errors') {
  const t = useTranslations(namespace) as (key: string) => string
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function run<E extends string>(fn: () => Promise<ActionResult<unknown, E>>, successMessage: string): Promise<boolean> {
    if (pending) return false
    setPending(true)
    const result = await callAction(fn)
    setPending(false)
    if (!result.ok) {
      if (result.error !== 'sessionExpired') toast.error(t(result.error))
      // Betreiber-Bereich: Kunde wurde inzwischen gelöscht → zurück zur Liste (BUG-4 aus QA PROJ-5)
      if (result.error === 'tenantGone') router.replace('/betreiber')
      return false
    }
    toast.success(successMessage)
    if (result.redirectTo) window.location.href = result.redirectTo
    else router.refresh()
    return true
  }

  return { run, pending }
}
