// Von der Auswertung (PROJ-18) zu den fertigen Daten der PDF-Vorlage. Reine Regel.

import { formatCents, formatNumber, formatPercent } from '@/lib/format'
import { type LetterheadValues, logoBox, type LogoBox } from '@/lib/letterhead'
import {
  averageRate,
  averageStay,
  type Change,
  type ChartMode,
  chartModel,
  type Compared,
  occupancy,
  type OriginLine,
  type OriginView,
  pointChange,
  relativeChange,
  type StatsView,
} from '@/lib/statistics'
import { STATS_PDF_KIND, type StatsPdfCell, type StatsPdfChart, type StatsPdfRow, type StatsPdfTable, type StatsPdfView } from '@/lib/statistics-pdf/types'
import { addressParts, issuerLines, type TaxPdfIssuer } from '@/lib/tourist-tax-pdf/view'

type T = (key: string, values?: Record<string, string | number>) => string

export type StatsPdfInput = {
  view: StatsView
  // Herkunft mit allen Ländern (ohne „Übrige Länder“)
  origin: OriginView
  year: number
  // „Jänner – Dezember 2026“ bzw. „2026“
  period: string
  // „Alle Wohnungen“, Objekt oder „Objekt · Wohnung“
  scope: string
  periodOpen: boolean
  tenantName: string
  // Mehrere Kunden (refine 2026-11-08): deren Namen; dann ohne Aussteller-Block und Logo, Zeile „Kunden: …“
  tenantNames: string[] | null
  issuer: TaxPdfIssuer
  letterhead: LetterheadValues
  logo: { data: Uint8Array; widthPx: number; heightPx: number } | null
  // Übersetzungen des Bereichs „statistics“
  t: T
  countryName: (code: string) => string
  stand: string
  pageOf: string
  locale: string
}

const signed = (n: number) => (n > 0 ? `+${formatNumber(n)}` : n < 0 ? `−${formatNumber(-n)}` : formatNumber(0))
// Veränderung ohne Pfeil (nicht jede Briefpapier-Schrift hat Pfeile): „+4 Pp.“, „−10 %“
const changeText = (c: Change, t: T) => (!c ? null : c.unit === 'pp' ? t('compare.pp', { value: signed(c.value) }) : t('compare.percent', { value: signed(c.value) }))

// „Vorjahr 48 % · +2 Pp.“ bzw. „48 % · +2 Pp.“ (in Tabellen) oder „Vorjahr –“
function previousText(previous: string | null, change: Change, t: T, prefix = true): string {
  if (previous === null) return prefix ? t('compare.previousUnknown') : '–'
  const head = prefix ? t('compare.previous', { value: previous }) : previous
  const c = changeText(change, t)
  return c ? `${head} · ${c}` : head
}

const vatText = (vatCents: number, t: T) => (vatCents === 0 ? t('vat.none') : t('vat.included', { amount: formatCents(vatCents) }))
const pct = (v: number | null) => (v === null ? null : formatPercent(v))
const cents = (v: number | null) => (v === null ? null : formatCents(v))
const count = (v: number | null) => (v === null ? null : formatNumber(v))

function kpis(c: Compared, t: T) {
  const { current: cur, previous: p, previousKnown } = c
  const prev = <V,>(v: V | null) => (previousKnown ? v : null)
  const occ = occupancy(cur)
  const prevOcc = prev(occupancy(p))
  const rate = averageRate(cur)
  const prevRate = prev(averageRate(p))
  const stay = averageStay(cur)
  return [
    {
      label: t('kpi.occupancy'),
      value: pct(occ) ?? '–',
      sub: t('kpi.occupancySub', { occupied: formatNumber(cur.occupiedNights), available: formatNumber(cur.availableNights), blocked: cur.blockedNights }),
      previous: previousText(pct(prevOcc), pointChange(occ, prevOcc), t),
    },
    {
      label: t('kpi.revenue'),
      value: formatCents(cur.revenueCents),
      sub: vatText(cur.vatCents, t),
      previous: previousText(cents(prev(p.revenueCents)), relativeChange(cur.revenueCents, prev(p.revenueCents)), t),
    },
    { label: t('kpi.rate'), value: cents(rate) ?? '–', sub: null, previous: previousText(cents(prevRate), relativeChange(rate, prevRate), t) },
    {
      label: t('kpi.bookings'),
      value: formatNumber(cur.bookings),
      sub: stay === null ? null : t('kpi.bookingsSub', { nights: formatNumber(stay, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) }),
      previous: previousText(count(prev(p.bookings)), relativeChange(cur.bookings, prev(p.bookings)), t),
    },
    {
      label: t('kpi.guestNights'),
      value: formatNumber(cur.guestNights),
      sub: t('kpi.guestNightsSub', { count: cur.arrivals }),
      previous: previousText(count(prev(p.guestNights)), relativeChange(cur.guestNights, prev(p.guestNights)), t),
    },
  ]
}

// Kennzahlen-Zellen einer Zeile wie am Bildschirm (Auslastung, belegt, gesperrt, Umsatz, Ø-Preis)
function metricCells(c: Compared, t: T): StatsPdfCell[] {
  const { current: cur, previous: p, previousKnown } = c
  const prev = <V,>(v: V | null) => (previousKnown ? v : null)
  const occ = occupancy(cur)
  const prevOcc = prev(occupancy(p))
  const rate = averageRate(cur)
  const prevRate = prev(averageRate(p))
  return [
    { main: pct(occ) ?? '–', small: [previousText(pct(prevOcc), pointChange(occ, prevOcc), t, false)] },
    { main: formatNumber(cur.occupiedNights), small: [previousText(count(prev(p.occupiedNights)), relativeChange(cur.occupiedNights, prev(p.occupiedNights)), t, false)] },
    { main: formatNumber(cur.blockedNights), small: [previousText(count(prev(p.blockedNights)), null, t, false)] },
    {
      main: formatCents(cur.revenueCents),
      small: [vatText(cur.vatCents, t), previousText(cents(prev(p.revenueCents)), relativeChange(cur.revenueCents, prev(p.revenueCents)), t, false)],
    },
    { main: cents(rate) ?? '–', small: [previousText(cents(prevRate), relativeChange(rate, prevRate), t, false)] },
  ]
}

const metricColumns = (t: T, ns: 'months' | 'apartments') =>
  (['occupancy', 'occupied', 'blocked', 'revenue', 'rate'] as const).map((k) => t(`${ns}.col.${k}`))

function chart(view: StatsView, mode: ChartMode, year: number, t: T): StatsPdfChart {
  const m = chartModel(view, mode)
  const many = m.bars.length > 6
  const axis = (v: number) => (mode === 'occupancy' ? formatPercent(v) : `€ ${formatNumber(v / 100, { maximumFractionDigits: 0 })}`)
  return {
    title: t(`chart.${mode}`),
    legend: { current: t('chart.current', { year: String(year) }), previous: m.previousKnown ? t('chart.previous', { year: String(year - 1) }) : null },
    ticks: m.scale.ticks.map((tick) => ({ share: tick / m.scale.max, label: axis(tick) })),
    bars: m.bars.map((b) => ({
      label: many ? t('monthShort', { month: String(b.month) }) : t('monthName', { month: String(b.month) }),
      current: b.currentShare,
      previous: m.previousKnown ? b.previousShare : null,
    })),
  }
}

function originRow(l: OriginLine, label: string, previousKnown: boolean, t: T, bold = false): StatsPdfRow {
  const prev = (v: number) => (previousKnown ? v : null)
  return {
    bold,
    cells: [
      { main: label, small: [] },
      { main: formatNumber(l.current.arrivals), small: [previousText(count(prev(l.previous.arrivals)), relativeChange(l.current.arrivals, prev(l.previous.arrivals)), t, false)] },
      {
        main: formatNumber(l.current.guestNights),
        small: [previousText(count(prev(l.previous.guestNights)), relativeChange(l.current.guestNights, prev(l.previous.guestNights)), t, false)],
      },
      {
        main: formatCents(l.current.revenueCents),
        small: [previousText(cents(prev(l.previous.revenueCents)), relativeChange(l.current.revenueCents, prev(l.previous.revenueCents)), t, false)],
      },
      { main: pct(l.share) ?? '–', small: [] },
    ],
  }
}

export function buildStatsPdfView(p: StatsPdfInput): { view: StatsPdfView; logo: LogoBox | null } {
  const { view, origin, t, letterhead: v } = p
  const box = p.logo ? logoBox({ widthPx: p.logo.widthPx, heightPx: p.logo.heightPx }, v) : null
  const customer = [p.issuer?.name ?? p.tenantName, ...(p.issuer ? addressParts(p.issuer, p.locale) : [])].join(', ')

  const monthRows: StatsPdfRow[] = view.months.map((m) => ({
    cells: [{ main: `${t('monthName', { month: String(m.month) })} ${p.year}`, small: [] }, ...metricCells(m, t)],
  }))
  if (view.months.length > 1) monthRows.push({ bold: true, cells: [{ main: t('months.total'), small: [] }, ...metricCells(view.totals, t)] })

  const tables: StatsPdfTable[] = [
    { title: t('chart.title'), note: t('months.previousHint'), columns: [t('months.col.month'), ...metricColumns(t, 'months')], firstWidth: 112, groups: {}, rows: monthRows },
  ]

  // Je Kunde (refine 2026-11-08), nur bei mehreren Kunden
  if (view.tenants.length > 0) {
    tables.push({
      title: t('tenants.title'),
      note: null,
      columns: [t('tenants.col.tenant'), ...metricColumns(t, 'months')],
      firstWidth: 112,
      groups: {},
      rows: [
        ...view.tenants.map((l) => ({ cells: [{ main: l.tenant.name, small: [] }, ...metricCells(l, t)] })),
        { bold: true, cells: [{ main: t('tenants.total'), small: [] }, ...metricCells(view.totals, t)] },
      ],
    })
  }

  if (view.apartments.length > 0) {
    const groups: Record<number, string> = {}
    view.apartments.forEach((l, i) => {
      // bei mehreren Kunden „Kunde · Objekt“ als Zwischenüberschrift
      if (i === 0 || view.apartments[i - 1].apartment.propertyId !== l.apartment.propertyId)
        groups[i] = view.multiTenant ? `${l.apartment.tenantName} · ${l.apartment.propertyName}` : l.apartment.propertyName
    })
    tables.push({
      title: t('apartments.title'),
      note: null,
      columns: [t('apartments.col.apartment'), ...metricColumns(t, 'apartments')],
      firstWidth: 112,
      groups,
      rows: view.apartments.map((l) => ({
        cells: [{ main: l.apartment.name, small: l.apartment.archived ? [t('apartments.archived')] : [] }, ...metricCells(l, t)],
      })),
    })
  }

  const originLines = [...origin.top, ...origin.rest]
  if (originLines.length > 0) {
    const rows = originLines.map((l) => originRow(l, p.countryName(l.country), origin.previousKnown, t))
    if (originLines.length > 1) rows.push(originRow(origin.total, t('origin.total'), origin.previousKnown, t, true))
    tables.push({
      title: t('origin.title'),
      note: t('origin.lead'),
      columns: (['country', 'arrivals', 'guestNights', 'revenue', 'share'] as const).map((k) => t(`origin.col.${k}`)),
      firstWidth: 130,
      groups: {},
      rows,
    })
  }

  return {
    logo: box,
    view: {
      kind: STATS_PDF_KIND,
      title: `${t('title')} ${p.period}`,
      letterhead: v,
      logo: !p.tenantNames && p.logo && box ? { data: p.logo.data, widthMm: box.widthMm, heightMm: box.heightMm } : null,
      issuer: p.tenantNames ? null : issuerLines(p.issuer, v, t, p.locale),
      heading: t('pdf.heading'),
      meta: [
        t('pdf.period', { period: p.period }),
        t('pdf.scope', { scope: p.scope }),
        p.tenantNames ? t('pdf.customers', { customers: p.tenantNames.join(', ') }) : t('pdf.customer', { customer }),
      ],
      notice: p.periodOpen ? t('periodOpen') : null,
      kpis: kpis(view.totals, t),
      charts: [chart(view, 'occupancy', p.year, t), chart(view, 'revenue', p.year, t)],
      tables,
      stand: t('pdf.stand', { stand: p.stand }),
      pageOf: p.pageOf,
    },
  }
}
