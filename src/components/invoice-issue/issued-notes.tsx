import { CheckCircle, Info } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { getInvoiceBackfillEnabled } from '@/lib/invoices-data'

// Bestätigung nach dem Ausstellen und Korrekturhinweis auf der Detailseite einer ausgestellten Rechnung (PROJ-42).
// Der Weg über die nacherfasste Gutschrift gilt bis zum Rechnungsstorno (PROJ-44).
export async function IssuedNotes({ done, owner }: { done: boolean; owner: boolean }) {
  const t = await getTranslations('invoiceIssue.detail')
  const backfill = await getInvoiceBackfillEnabled()
  return (
    <div className="flex max-w-2xl flex-col gap-3">
      {done && (
        <Alert role="status" className="border-ds-accent-700/40 bg-ds-accent-100">
          <CheckCircle size={18} weight="duotone" aria-hidden="true" />
          <AlertDescription>{t('issuedDone')}</AlertDescription>
        </Alert>
      )}
      <Alert className="border-ds-neutral-400 bg-ds-surface">
        <Info size={18} weight="duotone" aria-hidden="true" />
        <AlertDescription className="flex flex-col items-start gap-1">
          <span className="font-medium">{t('correctionTitle')}</span>
          <span>{t('correction')}</span>
          {!backfill && <span>{t('correctionSwitch')}</span>}
          {!backfill && owner && (
            <Link href="/einstellungen/rechnungen" className="flex min-h-11 w-fit items-center text-sm text-ds-accent-700 underline underline-offset-[3px] sm:min-h-0">
              {t('toSettings')}
            </Link>
          )}
        </AlertDescription>
      </Alert>
    </div>
  )
}
