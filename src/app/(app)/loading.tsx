import { getTranslations } from 'next-intl/server'

import { Skeleton } from '@/components/ui/skeleton'

// Ladezustand beim Seitenwechsel innerhalb des Rahmens
export default async function Loading() {
  const t = await getTranslations('common')
  return (
    <div role="status" aria-live="polite" className="flex flex-col gap-10">
      <span className="sr-only">{t('loading')}</span>
      <div className="flex max-w-[760px] flex-col gap-3">
        <Skeleton className="h-4 w-48 bg-ds-neutral-200" />
        <Skeleton className="h-12 w-full max-w-md bg-ds-neutral-200" />
        <Skeleton className="h-6 w-full max-w-lg bg-ds-neutral-200" />
      </div>
      <div className="grid grid-cols-1 gap-6 min-[400px]:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20 bg-ds-neutral-200" />
        ))}
      </div>
    </div>
  )
}
