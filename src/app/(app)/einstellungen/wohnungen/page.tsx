import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'

import { ApartmentsOverview } from '@/components/apartments/apartments-overview'
import { getProperties } from '@/lib/apartments-data'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('apartments')
  return { title: t('title') }
}

// Objekte und Wohnungen des gewählten Kunden (PROJ-6), nur für Inhaber (Einstellungen)
export default async function ApartmentsPage() {
  const properties = await getProperties()
  return <ApartmentsOverview properties={properties} />
}
