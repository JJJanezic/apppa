import { useTranslations } from 'next-intl'

import { KpiGrid, KpiTile } from '@/components/kpi-tile'
import { PreviousLine } from '@/components/statistics/compare'
import { formatCents, formatNumber, formatPercent } from '@/lib/format'
import { averageRate, averageStay, type Compared, occupancy, pointChange, relativeChange } from '@/lib/statistics'

const DASH = '–'
const pct = (v: number | null) => (v === null ? null : formatPercent(v))
const cents = (v: number | null) => (v === null ? null : formatCents(v))

// „inkl. € 7.910,00 USt“ bzw. „ohne USt“ (z. B. Kleinunternehmer)
export function useVatText() {
  const t = useTranslations('statistics.vat')
  return (vatCents: number) => (vatCents === 0 ? t('none') : t('included', { amount: formatCents(vatCents) }))
}

// Fünf Kacheln der Auswertung (PROJ-18), je mit Vorjahr und Veränderung; Inhalt zentriert wie im Dashboard (refine)
export function StatsKpis({ totals }: { totals: Compared }) {
  const t = useTranslations('statistics.kpi')
  const vat = useVatText()
  const { current: c, previous: p, previousKnown } = totals
  const prev = <T,>(v: T | null) => (previousKnown ? v : null)

  const occ = occupancy(c)
  const prevOcc = prev(occupancy(p))
  const rate = averageRate(c)
  const prevRate = prev(averageRate(p))
  const stay = averageStay(c)

  return (
    <KpiGrid label={t('label')} columns={5}>
      <KpiTile
        compact
        centered
        label={t('occupancy')}
        value={pct(occ) ?? DASH}
        sub={t('occupancySub', { occupied: formatNumber(c.occupiedNights), available: formatNumber(c.availableNights), blocked: c.blockedNights })}
        note={<PreviousLine previous={pct(prevOcc)} change={pointChange(occ, prevOcc)} />}
      />
      <KpiTile
        compact
        centered
        label={t('revenue')}
        value={formatCents(c.revenueCents)}
        sub={vat(c.vatCents)}
        note={<PreviousLine previous={cents(prev(p.revenueCents))} change={relativeChange(c.revenueCents, prev(p.revenueCents))} />}
      />
      <KpiTile
        compact
        centered
        label={t('rate')}
        value={cents(rate) ?? DASH}
        note={<PreviousLine previous={cents(prevRate)} change={relativeChange(rate, prevRate)} />}
      />
      <KpiTile
        compact
        centered
        label={t('bookings')}
        value={formatNumber(c.bookings)}
        sub={stay === null ? undefined : t('bookingsSub', { nights: formatNumber(stay, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) })}
        note={<PreviousLine previous={prev(p.bookings) === null ? null : formatNumber(p.bookings)} change={relativeChange(c.bookings, prev(p.bookings))} />}
      />
      <KpiTile
        compact
        centered
        label={t('guestNights')}
        value={formatNumber(c.guestNights)}
        sub={t('guestNightsSub', { count: c.arrivals })}
        note={<PreviousLine previous={prev(p.guestNights) === null ? null : formatNumber(p.guestNights)} change={relativeChange(c.guestNights, prev(p.guestNights))} />}
      />
    </KpiGrid>
  )
}
