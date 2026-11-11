import Image from 'next/image'
import { getTranslations } from 'next-intl/server'

import { cn } from '@/lib/utils'

// Logo „apppa“ (Bildmarke + Schriftzug) aus public/brand; Name als Alternativtext zentral in messages/de.json (app.name)
export async function Logo({ className }: { className?: string }) {
  const t = await getTranslations('app')
  return (
    <Image
      src="/brand/apppa-logo.svg"
      alt={t('name')}
      width={1973}
      height={512}
      priority
      className={cn('h-10 w-auto', className)}
    />
  )
}
