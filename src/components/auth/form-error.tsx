'use client'

import { WarningCircle } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'

import { Alert, AlertDescription } from '@/components/ui/alert'
import type { ActionResult, AuthErrorCode } from '@/lib/auth/result'

interface FormErrorProps {
  error: string | null
  retryAfterMinutes?: number
  // Bereich der Meldungstexte in messages/de.json (Standard: Anmeldung)
  namespace?: 'auth.errors' | 'team.errors' | 'operator.errors' | 'apartments.errors' | 'guests.errors'
}

// Fehlermeldung einer Aktion über dem Formular; wird von Screenreadern sofort vorgelesen
export function FormError({ error, retryAfterMinutes, namespace = 'auth.errors' }: FormErrorProps) {
  const t = useTranslations(namespace) as (key: string, values?: Record<string, number>) => string
  if (!error) return null
  return (
    <Alert variant="destructive" role="alert" className="border-ds-accent-2-700/40 bg-ds-accent-2-100 text-ds-accent-2-800">
      <WarningCircle size={18} weight="duotone" aria-hidden="true" />
      <AlertDescription>{t(error, { minutes: retryAfterMinutes ?? 15 })}</AlertDescription>
    </Alert>
  )
}

// Netzwerkfehler beim Aufruf einer Server-Aktion als einheitliches Ergebnis.
// Abgelaufene Sitzung: zur Anmeldung mit Hinweis, danach zurück auf diese Seite.
export async function callAction<T, E extends string = AuthErrorCode>(
  fn: () => Promise<ActionResult<T, E>>
): Promise<ActionResult<T, E>> {
  let result: ActionResult<T, E>
  try {
    result = await fn()
  } catch {
    return { ok: false, error: 'network' }
  }
  if (!result.ok && result.error === 'sessionExpired') {
    const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`)
    window.location.href = `/anmelden?grund=sitzung-abgelaufen&next=${next}`
  }
  return result
}
