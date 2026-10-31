'use client'

import { useTranslations } from 'next-intl'

import { formatDateTime } from '@/lib/format'
import type { OperatorLogEntry } from '@/lib/operator'

// Protokoll der Betreiber-Aktionen an einem Kunden, neueste zuerst
export function OperatorLog({ entries }: { entries: OperatorLogEntry[] }) {
  const t = useTranslations('operator')
  const tf = useTranslations('tenantData.fields')
  // PROJ-39: Felder der Rechnungseinstellungen und Blöcke der Textbausteine
  const ti = useTranslations('invoiceSettings')
  const field = (f: string) => (tf.has(f) ? tf(f) : ti.has(`logFields.${f}`) ? ti(`logFields.${f}`) : f)
  const block = (b: string | null) => (b && ti.has(`blocks.kinds.${b}`) ? ti(`blocks.kinds.${b}`) : (b ?? '–'))

  if (entries.length === 0) return <p className="text-ds-neutral-800">{t('noLog')}</p>

  return (
    <ol className="flex flex-col divide-y rounded-lg bg-ds-surface">
      {entries.map((entry) => (
        <li key={entry.id} className="flex flex-col gap-0.5 px-4 py-3">
          <span className="break-all">{t(`log.${entry.action}`, {
              email: entry.targetEmail ?? '–',
              fields: entry.fields.map(field).join(', ') || '–',
              block: block(entry.targetBlock),
              name: entry.targetLabel ?? '–',
            })}</span>
          <span className="text-[13px] text-ds-neutral-700">
            {t('log.by', {
              date: formatDateTime(entry.at),
              actor: entry.actorName ?? '–',
            })}
          </span>
        </li>
      ))}
    </ol>
  )
}
