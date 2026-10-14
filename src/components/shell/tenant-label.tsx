'use client'

import { CaretUpDown } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'

import { TruncatedText } from '@/components/shell/truncated-text'
import { useShell } from '@/components/shell/shell-context'

// Kundenname unter der Wortmarke. Bei mehreren Mitgliedschaften wird daraus die Kunden-Auswahl (PROJ-4).
export function TenantLabel() {
  const t = useTranslations('shell')
  const { tenant } = useShell()
  const name = tenant.name ?? t('tenantPlaceholder')

  if (!tenant.hasOthers) {
    return <TruncatedText text={name} className="text-[13px] text-ds-neutral-700" />
  }

  return (
    <button
      type="button"
      disabled
      aria-label={`${t('switchTenant')}: ${name}`}
      className="flex min-h-11 w-full min-w-0 items-center gap-1 text-left text-[13px] text-ds-neutral-700"
    >
      <TruncatedText text={name} />
      <CaretUpDown size={14} aria-hidden="true" />
    </button>
  )
}
