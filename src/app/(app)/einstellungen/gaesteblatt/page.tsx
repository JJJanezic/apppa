import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'

import { GuestSheetTextsForm } from '@/components/guest-sheets/guest-sheet-texts-form'
import { sheetPlaceholderValues } from '@/lib/guest-sheet'
import { getGuestSheetSettings } from '@/lib/guest-sheets-data'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('settings')
  return { title: t('guestSheet') }
}

// Einstellungen → Gästeblatt (PROJ-26), nur für Inhaber: Datenschutz-Information (Teil A) und Marketing-Einwilligung (Teil B)
export default async function GuestSheetSettingsPage() {
  const [{ tenantId, texts, issuer }, locale] = await Promise.all([getGuestSheetSettings(), getLocale()])
  return <GuestSheetTextsForm key={texts.updatedAt ?? 'standard'} tenantId={tenantId} texts={texts} values={sheetPlaceholderValues(issuer, locale)} />
}
