import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { LetterheadSettings } from '@/components/letterhead/letterhead-settings'
import { getOwnLetterhead } from '@/lib/letterhead-data'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('settings')
  return { title: t('letterhead') }
}

// Einstellungen → Briefpapier (PROJ-41), nur für Inhaber
export default async function LetterheadPage() {
  const data = await getOwnLetterhead()
  return <LetterheadSettings key={data.updatedAt} data={data} stammdatenHref="/einstellungen/stammdaten" footerHref="/einstellungen/rechnungen" />
}
