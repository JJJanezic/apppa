import { CheckCircle, Info } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { getInvoiceBackfillEnabled } from '@/lib/invoices-data'

// Bestätigung nach dem Ausstellen einer Rechnung (PROJ-42) bzw. einer Gutschrift (PROJ-44)
export async function IssuedNotes({ done, credit }: { done: boolean; credit: boolean }) {
  if (!done) return null
  const t = await getTranslations('invoiceIssue.detail')
  return (
    <Alert role="status" className="max-w-2xl border-ds-accent-700/40 bg-ds-accent-100">
      <CheckCircle size={18} weight="duotone" aria-hidden="true" />
      <AlertDescription>{t(credit ? 'creditDone' : 'issuedDone')}</AlertDescription>
    </Alert>
  )
}

// Korrektur einer nacherfassten Rechnung (nur Inhaber): Eine Gutschrift aus der App gibt es nur zu in der App ausgestellten
// Rechnungen (PROJ-44); hier bleibt der Weg über eine außerhalb erstellte, nacherfasste Gutschrift.
export async function BackfilledCreditHint() {
  const t = await getTranslations('invoiceIssue.detail')
  const backfill = await getInvoiceBackfillEnabled()
  return (
    <Alert role="note" className="max-w-2xl border-ds-neutral-400 bg-ds-surface">
      <Info size={18} weight="duotone" aria-hidden="true" />
      <AlertDescription className="flex flex-col items-start gap-1">
        <span className="font-medium">{t('correctionTitle')}</span>
        <span>{t('correctionBackfilled')}</span>
        {!backfill && <span>{t('correctionSwitch')}</span>}
        {!backfill && (
          <Link href="/einstellungen/rechnungen" className="flex min-h-11 w-fit items-center text-sm text-ds-accent-700 underline underline-offset-[3px] sm:min-h-0">
            {t('toSettings')}
          </Link>
        )}
      </AlertDescription>
    </Alert>
  )
}
