'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'

import { callAction } from '@/components/auth/form-error'
import type { ActionResult } from '@/lib/auth/result'
import type { TeamErrorCode } from '@/lib/team'

// Führt eine Team-Aktion aus: Erfolg → Hinweis-Meldung und Seite neu laden (bzw. Weiterleitung),
// Fehler → Meldung aus „team.errors“. pending verhindert Doppelklicks.
export function useTeamAction() {
  const t = useTranslations('team.errors')
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function run(fn: () => Promise<ActionResult<undefined, TeamErrorCode>>, successMessage: string): Promise<boolean> {
    if (pending) return false
    setPending(true)
    const result = await callAction(fn)
    setPending(false)
    if (!result.ok) {
      if (result.error !== 'sessionExpired') toast.error(t(result.error))
      return false
    }
    toast.success(successMessage)
    if (result.redirectTo) window.location.href = result.redirectTo
    else router.refresh()
    return true
  }

  return { run, pending }
}
