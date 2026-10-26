'use client'

import { WarningCircle } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useTransition } from 'react'

import { Button } from '@/components/ui/button'

// Fehler beim Laden der Belegung: nur dieser Abschnitt, der Rest der Seite bleibt nutzbar
export function CalendarError() {
  const t = useTranslations('calendar')
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  return (
    <section role="alert" className="flex max-w-xl flex-col items-start gap-3 rounded-lg bg-ds-surface p-6">
      <WarningCircle size={32} weight="duotone" aria-hidden="true" className="text-ds-accent-2-700" />
      <h2 className="text-2xl">{t('loadErrorTitle')}</h2>
      <p className="text-ds-neutral-800">{t('loadErrorText')}</p>
      <Button className="min-h-11" disabled={pending} aria-busy={pending} onClick={() => startTransition(() => router.refresh())}>
        {t('retry')}
      </Button>
    </section>
  )
}
