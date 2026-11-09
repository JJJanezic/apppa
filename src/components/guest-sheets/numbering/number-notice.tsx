import { WarningCircle } from '@phosphor-icons/react/ssr'
import { useTranslations } from 'next-intl'

import { Alert, AlertDescription } from '@/components/ui/alert'
import type { NumberingState } from '@/lib/guest-sheet-numbering'

// Text des Nummern-Hinweises (PROJ-26, Erweiterung 2026-11-09): „Nur noch 7 Nummern frei“, „Nummernbereich für Bad Ischl
// aufgebraucht“, „Kein Nummernbereich für …“. Gleich in Einstellungen, Buchungsdetail und Dashboard.
export function useNumberNoticeText() {
  const t = useTranslations('guestSheets.numbering.notice')
  return (state: Exclude<NumberingState, 'ok'>, municipality: string, free: number) => t(state, { municipality, count: free })
}

// Hinweis in Warnfarbe; im Buchungsdetail mit Verweis auf Einstellungen → Gästeblatt
export function NumberNotice({
  state,
  municipality,
  free,
  settingsHint,
}: {
  state: NumberingState
  municipality: string
  free: number
  settingsHint?: boolean
}) {
  const text = useNumberNoticeText()
  const t = useTranslations('guestSheets.numbering.notice')
  if (state === 'ok') return null
  return (
    <Alert className="border-ds-accent-2-700/40 bg-ds-accent-2-100 text-ds-accent-2-800">
      <WarningCircle size={18} weight="duotone" aria-hidden="true" />
      <AlertDescription className="text-ds-accent-2-800">
        {text(state, municipality, free)}
        {settingsHint && state !== 'low' && ` ${t('settingsHint')}`}
      </AlertDescription>
    </Alert>
  )
}
