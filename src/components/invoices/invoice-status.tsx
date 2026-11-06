import { useTranslations } from 'next-intl'

import { Badge } from '@/components/ui/badge'
import type { InvoiceDocKind } from '@/lib/invoice-drafts'
import type { InvoiceOrigin } from '@/lib/invoices'

// Status einer Rechnung in Liste, Detail und Buchungsdetail: Herkunft („nacherfasst“, „Entwurf“), bei Teil- und
// Schlussrechnungen und Gutschriften die Art, „storniert“ (PROJ-44), bei nacherfassten Rechnungen ggf. „ohne PDF“
export function InvoiceStatus({
  origin,
  kind = null,
  hasPdf,
  cancelled = false,
}: {
  origin: InvoiceOrigin
  kind?: InvoiceDocKind | null
  hasPdf: boolean
  cancelled?: boolean
}) {
  const t = useTranslations('invoices')
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Badge variant={origin === 'draft' ? 'outline' : 'secondary'} className={origin === 'draft' ? 'border-ds-accent-700 font-normal text-ds-accent-700' : 'font-normal'}>
        {t(`origin.${origin}`)}
      </Badge>
      {kind && kind !== 'invoice' && (
        <Badge variant="secondary" className="font-normal">
          {t(`kind.${kind}`)}
        </Badge>
      )}
      {cancelled && (
        <Badge variant="outline" className="border-ds-accent-2-700 font-normal text-ds-accent-2-800">
          {t('cancelled')}
        </Badge>
      )}
      {origin === 'backfilled' && !hasPdf && (
        <Badge variant="outline" className="border-ds-neutral-500 font-normal text-ds-neutral-800">
          {t('withoutPdf')}
        </Badge>
      )}
    </span>
  )
}
