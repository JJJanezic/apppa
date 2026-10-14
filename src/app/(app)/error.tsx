'use client'

import { WarningCircle } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'

import { Button } from '@/components/ui/button'

// Fehlerzustand innerhalb des Rahmens: Navigation bleibt bedienbar
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations()

  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <section role="alert" className="flex max-w-xl flex-col items-start gap-3 rounded-lg bg-ds-surface p-6 sm:p-8">
      <WarningCircle size={32} weight="duotone" aria-hidden="true" className="text-ds-accent-2-700" />
      <h1 className="text-2xl">{t('errors.title')}</h1>
      <p className="text-ds-neutral-800">{t('errors.text')}</p>
      <Button onClick={reset} className="min-h-11">
        {t('common.retry')}
      </Button>
    </section>
  )
}
