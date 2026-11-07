'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useTransition } from 'react'

import { Button } from '@/components/ui/button'

// „Erneut versuchen“ eines Dashboard-Abschnitts: lädt die Seite vom Server neu
export function SectionRetry() {
  const t = useTranslations('dashboard')
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return (
    <Button variant="outline" className="min-h-11" disabled={pending} aria-busy={pending} onClick={() => startTransition(() => router.refresh())}>
      {t('retry')}
    </Button>
  )
}
