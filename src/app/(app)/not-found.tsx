import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { Button } from '@/components/ui/button'

// „Seite nicht gefunden“ innerhalb des App-Rahmens (z. B. Kunde gelöscht, während die Seite offen war).
// Ohne eigenes <main>: das stellt der App-Rahmen (BUG-2 aus QA PROJ-5: sonst doppelte Hauptregion).
export default async function AppNotFound() {
  const t = await getTranslations()
  return (
    <section className="flex max-w-md flex-col items-start gap-3">
      <p className="text-[13px] uppercase tracking-[0.08em] text-ds-neutral-700">404</p>
      <h1 className="text-[34px] leading-tight">{t('errors.notFoundTitle')}</h1>
      <p className="text-ds-neutral-800">{t('errors.notFoundText')}</p>
      <Button asChild className="min-h-11">
        <Link href="/">{t('common.toDashboard')}</Link>
      </Button>
    </section>
  )
}
