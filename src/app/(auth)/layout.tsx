import { getTranslations } from 'next-intl/server'

import { Wordmark } from '@/components/shell/wordmark'

// Schlichter Rahmen der Anmelde-Seiten: Papierhintergrund, Wortmarke mittig, schmales Formular, ohne App-Navigation
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('auth')
  return (
    <div className="flex min-h-svh flex-col items-center bg-ds-bg px-4 py-10 sm:justify-center sm:py-16">
      <main aria-label={t('layoutLabel')} className="flex w-full max-w-[400px] flex-col gap-10">
        <div className="text-center">
          <Wordmark />
        </div>
        {children}
      </main>
    </div>
  )
}
