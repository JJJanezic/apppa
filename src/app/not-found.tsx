import type { Metadata } from 'next'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { Button } from '@/components/ui/button'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('errors')
  return { title: t('notFoundTitle') }
}

// Unbekannte Adresse oder ausgeblendeter Bereich (requireArea)
export default async function NotFound() {
  const t = await getTranslations()
  return (
    <main className="flex min-h-svh items-center justify-center bg-ds-bg px-4">
      <section className="flex max-w-md flex-col items-start gap-3">
        <p className="text-[13px] uppercase tracking-[0.08em] text-ds-neutral-700">404</p>
        <h1 className="text-[34px] leading-tight">{t('errors.notFoundTitle')}</h1>
        <p className="text-ds-neutral-800">{t('errors.notFoundText')}</p>
        <Button asChild className="min-h-11">
          <Link href="/">{t('common.toDashboard')}</Link>
        </Button>
      </section>
    </main>
  )
}
