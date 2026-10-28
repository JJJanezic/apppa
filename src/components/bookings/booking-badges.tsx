import { useTranslations } from 'next-intl'

import { Badge } from '@/components/ui/badge'
import type { BookingKind, BookingState } from '@/lib/bookings'
import { formatDate } from '@/lib/format'

interface BookingBadgesProps {
  kind: BookingKind
  state: BookingState
  optionUntil: string | null
  overlapping?: boolean
  // nur für Inhaber
  priceReview?: boolean
}

// Kennzeichen eines Eintrags in Liste und Detail: Art, Zustand, Option bis …, Überschneidung, „Preis prüfen“
export function BookingBadges({ kind, state, optionUntil, overlapping = false, priceReview = false }: BookingBadgesProps) {
  const t = useTranslations('bookings')
  const muted = state !== 'active'
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Badge variant={kind === 'block' || muted ? 'secondary' : kind === 'option' ? 'outline' : 'default'} className="font-normal">
        {t(`kind.${kind}`)}
      </Badge>
      {state !== 'active' && (
        <Badge variant="outline" className="border-ds-neutral-500 font-normal text-ds-neutral-800">
          {t(`state.${state}`)}
        </Badge>
      )}
      {kind === 'option' && state === 'active' && optionUntil && (
        <span className="text-[13px] text-ds-neutral-800">
          {t('optionUntil', { date: formatDate(optionUntil) })}
        </span>
      )}
      {overlapping && (
        <Badge variant="outline" className="border-ds-accent-2-700/50 bg-ds-accent-2-100 font-normal text-ds-accent-2-800">
          {t('overlapping')}
        </Badge>
      )}
      {priceReview && (
        <Badge variant="outline" className="border-ds-accent-700/50 bg-ds-accent-100 font-normal text-ds-accent-800">
          {t('priceReview')}
        </Badge>
      )}
    </span>
  )
}
