import { useTranslations } from 'next-intl'

import { formatNumber } from '@/lib/format'
import type { Change } from '@/lib/statistics'

// Vorzeichen immer zeigen: „+4“, „−10“, „0“
export const signed = (n: number) => (n > 0 ? `+${formatNumber(n)}` : n < 0 ? `−${formatNumber(-n)}` : formatNumber(0))

// Veränderung zum Vorjahr mit Pfeil, ohne Farbwertung (PROJ-18): „↑ +4 Pp.“, „↓ −10 %“, „→ 0 %“
export function ChangeText({ change }: { change: Change }) {
  const t = useTranslations('statistics.compare')
  if (!change) return null
  const dir = change.value > 0 ? 'up' : change.value < 0 ? 'down' : 'same'
  const arrow = dir === 'up' ? '↑' : dir === 'down' ? '↓' : '→'
  const value = signed(change.value)
  return (
    <span className="whitespace-nowrap">
      <span aria-hidden="true">{arrow} </span>
      <span className="sr-only">{t(dir)}, </span>
      {change.unit === 'pp' ? (
        <>
          <span aria-hidden="true">{t('pp', { value })}</span>
          <span className="sr-only">{t('ppLong', { value })}</span>
        </>
      ) : (
        t('percent', { value })
      )}
    </span>
  )
}

// „Vorjahr 58 % · ↑ +4 Pp.“; ohne bekannten Vorjahreswert „Vorjahr –“
export function PreviousLine({ previous, change, prefix = true }: { previous: string | null; change: Change; prefix?: boolean }) {
  const t = useTranslations('statistics.compare')
  if (previous === null) return <>{prefix ? t('previousUnknown') : '–'}</>
  return (
    <>
      {prefix ? t('previous', { value: previous }) : previous}
      {change && (
        <>
          {' · '}
          <ChangeText change={change} />
        </>
      )}
    </>
  )
}
