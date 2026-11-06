import { ArrowCounterClockwise, Info, Prohibit } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { creditEntry } from '@/lib/invoice-credit'
import { formatDatePlain } from '@/lib/format'
import { creditNoteHref, type Invoice, invoiceHref } from '@/lib/invoices'

const LINK = 'flex min-h-11 w-fit items-center text-ds-accent-700 underline underline-offset-[3px] sm:min-h-0'

// Storno auf der Detailseite einer ausgestellten Rechnung bzw. Gutschrift (PROJ-44):
// - Gutschrift: Verweis auf die stornierte Rechnung
// - stornierte Rechnung: Verweis auf die Gutschrift (alle Rollen)
// - sonst für Inhaber der Knopf „Gutschrift erstellen“, gesperrt, solange eine gültige Schlussrechnung die Teilrechnung abzieht
export async function CreditStatus({ invoice, owner }: { invoice: Invoice; owner: boolean }) {
  const t = await getTranslations('invoiceCredit.detail')
  const credit = invoice.issued?.snapshot.credit
  if (credit) {
    return (
      <p className="flex flex-wrap items-center gap-x-1.5">
        {t('creditFor')}
        <Link href={invoiceHref(credit.invoiceId)} className={LINK}>
          {t('invoiceRef', {
            number: credit.number,
            date: formatDatePlain(credit.invoiceDate),
          })}
        </Link>
      </p>
    )
  }
  if (invoice.cancelledBy) {
    return (
      <Alert role="note" className="max-w-2xl border-ds-accent-2-700/40 bg-ds-accent-2-100 text-ds-accent-2-800">
        <Info size={18} weight="duotone" aria-hidden="true" />
        <AlertDescription className="flex flex-col items-start gap-1">
          <span>{t('cancelled')}</span>
          <Link href={invoiceHref(invoice.cancelledBy.id)} className={LINK}>
            {t('toCredit', { number: invoice.cancelledBy.number })}
          </Link>
        </AlertDescription>
      </Alert>
    )
  }
  if (!owner) return null
  const entry = creditEntry(invoice)
  if (entry.state === 'none') return null
  if (entry.state === 'deducted') {
    return (
      <div className="flex max-w-2xl flex-col items-start gap-2">
        <Button type="button" variant="outline" className="min-h-11" disabled aria-describedby="gutschrift-gesperrt">
          <ArrowCounterClockwise size={18} aria-hidden="true" />
          {t('create')}
        </Button>
        <p id="gutschrift-gesperrt" className="flex flex-wrap items-center gap-x-1.5 text-sm text-ds-neutral-800">
          <Prohibit size={16} weight="duotone" aria-hidden="true" className="text-ds-accent-2-800" />
          {t('deducted', { number: entry.final.number })}
          <Link href={invoiceHref(entry.final.id)} className={LINK}>
            {t('toFinal')}
          </Link>
        </p>
      </div>
    )
  }
  return (
    <div className="flex max-w-2xl flex-col items-start gap-2">
      <Button asChild variant="outline" className="min-h-11">
        <Link href={creditNoteHref(invoice.id)}>
          <ArrowCounterClockwise size={18} aria-hidden="true" />
          {t('create')}
        </Link>
      </Button>
      <p className="text-sm text-ds-neutral-800">{t('createHint')}</p>
    </div>
  )
}
