'use client'

import { ArrowsClockwise, Warning } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'

import { useShell } from '@/components/shell/shell-context'

// Sync-Status der Plattform-Verbindungen; echte Werte mit PROJ-10/11
export function SyncStatus() {
  const t = useTranslations('shell')
  const { sync } = useShell()
  const problem = sync.problems > 0

  return (
    <div
      role="status"
      className={`flex items-center gap-2 text-[13px] ${problem ? 'text-ds-accent-2-700' : 'text-ds-neutral-700'}`}
    >
      {problem ? (
        <Warning size={16} weight="duotone" aria-hidden="true" />
      ) : (
        <ArrowsClockwise size={16} weight="duotone" aria-hidden="true" />
      )}
      <span>{problem ? t('syncProblem', { count: sync.problems }) : t('sync', { count: sync.connections })}</span>
    </div>
  )
}
