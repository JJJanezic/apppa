import { useTranslations } from 'next-intl'

import { Badge } from '@/components/ui/badge'
import type { InvoiceOrigin } from '@/lib/invoices'

// Status einer Rechnung in Liste, Detail und Buchungsdetail: Herkunft („nacherfasst“), ggf. „ohne PDF“
export function InvoiceStatus({ origin, hasPdf }: { origin: InvoiceOrigin; hasPdf: boolean }) {
  const t = useTranslations('invoices')
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Badge variant="secondary" className="font-normal">
        {t(`origin.${origin}`)}
      </Badge>
      {!hasPdf && (
        <Badge variant="outline" className="border-ds-neutral-500 font-normal text-ds-neutral-800">
          {t('withoutPdf')}
        </Badge>
      )}
    </span>
  )
}
