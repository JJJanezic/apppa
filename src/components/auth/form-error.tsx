'use client'

import { WarningCircle } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'

import { Alert, AlertDescription } from '@/components/ui/alert'
import type { ActionResult, AuthErrorCode } from '@/lib/auth/result'

interface FormErrorProps {
  error: string | null
  retryAfterMinutes?: number
  // Bereich der Meldungstexte in messages/de.json (Standard: Anmeldung)
  namespace?: 'auth.errors' | 'team.errors' | 'operator.errors' | 'apartments.errors' | 'guests.errors' | 'bookings.errors' | 'tenantData.errors' | 'invoices.errors'
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
  } catch (e) {
    // Weiterleitung aus der Aktion (redirect()): Next.js navigiert selbst, für den Aufrufer ist das ein Erfolg
    const target = redirectTarget(e)
    if (target !== null) return { ok: true, redirectTo: target }
    return { ok: false, error: 'network' }
  }
  if (!result.ok && result.error === 'sessionExpired') {
    const next = encodeURIComponent(`${window.location.pathname}${window.location.search}`)
    window.location.href = `/anmelden?grund=sitzung-abgelaufen&next=${next}`
  }
  return result
}

// Ziel einer Weiterleitung aus einer Server-Aktion; Next.js kennzeichnet sie mit digest „NEXT_REDIRECT;<Art>;<Ziel>;<Status>;“
export function redirectTarget(error: unknown): string | null {
  const digest = typeof error === 'object' && error !== null && 'digest' in error ? (error as { digest: unknown }).digest : null
  if (typeof digest !== 'string' || !digest.startsWith('NEXT_REDIRECT;')) return null
  return digest.split(';')[2] ?? null
}
