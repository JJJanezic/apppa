import type { Metadata } from 'next'
import { getLocale, getTranslations } from 'next-intl/server'

import { GuestSheetTextsForm } from '@/components/guest-sheets/guest-sheet-texts-form'
import { GuestSheetNumberingSections } from '@/components/guest-sheets/numbering/guest-sheet-numbering-sections'
import { IdReadingPrivacyHint } from '@/components/id-reading/privacy-hint'
import { sheetPlaceholderValues } from '@/lib/guest-sheet'
import { loadSheetNumbering } from '@/lib/guest-sheet-numbering-data'
import { getGuestSheetSettings } from '@/lib/guest-sheets-data'
import { loadIdReadingSettings } from '@/lib/id-reading-data'

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('settings')
  return { title: t('guestSheet') }
}

// Einstellungen → Gästeblatt (PROJ-26), nur für Inhaber: laufende Nummer je Gemeinde, „Gästeblätter nacherfassen“
// (Erweiterung 2026-11-09), Datenschutz-Information (Teil A) und Marketing-Einwilligung (Teil B)
export default async function GuestSheetSettingsPage() {
  const [{ tenantId, texts, issuer }, locale] = await Promise.all([getGuestSheetSettings(), getLocale()])
  const [numbering, idReading] = await Promise.all([loadSheetNumbering(tenantId), loadIdReadingSettings(tenantId)])
  // PROJ-51: einmaliger Hinweis nach dem Freischalten, nur bei eigenem Datenschutz-Text (Standard enthält den Satz)
  const privacyHint = idReading.enabled && !idReading.privacyHintSeen && texts.privacy !== null
  return (
    <div className="flex min-w-0 flex-col gap-10">
      {privacyHint && <IdReadingPrivacyHint tenantId={tenantId} />}
      <GuestSheetNumberingSections tenantId={tenantId} data={numbering} level={2} />
      <GuestSheetTextsForm key={texts.updatedAt ?? 'standard'} tenantId={tenantId} texts={texts} values={sheetPlaceholderValues(issuer, locale)} />
    </div>
  )
}
