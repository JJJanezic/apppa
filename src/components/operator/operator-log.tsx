'use client'

import { useFormatter, useTranslations } from 'next-intl'

import type { OperatorLogEntry } from '@/lib/operator'

// Protokoll der Betreiber-Aktionen an einem Kunden, neueste zuerst
export function OperatorLog({ entries }: { entries: OperatorLogEntry[] }) {
  const t = useTranslations('operator')
  const tf = useTranslations('tenantData.fields')
  const format = useFormatter()

  if (entries.length === 0) return <p className="text-ds-neutral-800">{t('noLog')}</p>

  return (
    <ol className="flex flex-col divide-y rounded-lg bg-ds-surface">
      {entries.map((entry) => (
        <li key={entry.id} className="flex flex-col gap-0.5 px-4 py-3">
          <span className="break-all">{t(`log.${entry.action}`, {
              email: entry.targetEmail ?? '–',
              fields: entry.fields.map((f) => (tf.has(f) ? tf(f) : f)).join(', ') || '–',
            })}</span>
          <span className="text-[13px] text-ds-neutral-700">
            {t('log.by', {
              date: format.dateTime(new Date(entry.at), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
              actor: entry.actorName ?? '–',
            })}
          </span>
        </li>
      ))}
    </ol>
  )
}
