import { useTranslations } from 'next-intl'

import { Badge } from '@/components/ui/badge'
import { formatCents } from '@/lib/format'
import { type PaymentState, refundLabel } from '@/lib/payments'
import { cn } from '@/lib/utils'

// Zahlungsstand als Kennzeichen (PROJ-45) in Rechnungsliste, Rechnungsdetail und Buchungsdetail:
// offen / teilweise / bezahlt / überzahlt, dazu „überfällig“ (rot); stornierte Rechnung „Guthaben € …“;
// Gutschrift „Rückzahlung offen € …“ bzw. „erstattet“. Ohne Zahlungsstand (Entwurf, Altrechnung ≤ 0) „–“.
export function PaymentStatusBadge({ state, dash = true }: { state: PaymentState; dash?: boolean }) {
  const t = useTranslations('payments.status')
  const none = dash ? <span className="text-ds-neutral-700">–</span> : null

  if (state.mode === 'payable' && state.status) {
    const tone =
      state.status === 'paid'
        ? 'border-ds-accent-700 text-ds-accent-700'
        : state.status === 'overpaid'
          ? 'border-ds-accent-700 text-ds-accent-800'
          : 'border-ds-neutral-500 text-ds-neutral-800'
    return (
      <span className="flex flex-wrap items-center gap-1.5">
        <Badge variant="outline" className={cn('font-normal', tone)}>
          {t(state.status)}
        </Badge>
        {state.overdue && (
          <Badge variant="outline" className="border-destructive font-normal text-destructive">
            {t('overdue')}
          </Badge>
        )}
      </span>
    )
  }
  if (state.mode === 'cancelled') {
    return state.balanceCents > 0 ? (
      <Badge variant="outline" className="border-ds-accent-2-700 font-normal text-ds-accent-2-800">
        {t('balance', { amount: formatCents(state.balanceCents) })}
      </Badge>
    ) : (
      none
    )
  }
  const refund = refundLabel(state)
  if (refund) {
    return (
      <Badge
        variant="outline"
        className={refund === 'refundOpen' ? 'border-ds-accent-2-700 font-normal text-ds-accent-2-800' : 'border-ds-accent-700 font-normal text-ds-accent-700'}
      >
        {refund === 'refundOpen' ? t('refundOpen', { amount: formatCents(state.balanceCents) }) : t('refunded')}
      </Badge>
    )
  }
  return none
}
