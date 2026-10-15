'use client'

import { WarningCircle } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'

import { Alert, AlertDescription } from '@/components/ui/alert'
import type { ActionResult, AuthErrorCode } from '@/lib/auth/result'

interface FormErrorProps {
  error: AuthErrorCode | null
  retryAfterMinutes?: number
}

// Fehlermeldung einer Aktion über dem Formular; wird von Screenreadern sofort vorgelesen
export function FormError({ error, retryAfterMinutes }: FormErrorProps) {
  const t = useTranslations('auth.errors')
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
export async function callAction<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  let result: ActionResult<T>
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
