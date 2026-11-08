import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

import { Amount } from '@/components/amount'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { type TaxLine, type TaxPeriod, taxPeriods, type TaxTenantBlock, touristTaxTable } from '@/lib/dashboard'
import { type DashboardScope, getTouristTaxMonths } from '@/lib/dashboard-data'
import { cn } from '@/lib/utils'

import { DashboardSection, SectionEmpty, SectionProblem } from './section'

// Erste Spalte bleibt beim seitlichen Scrollen am Handy stehen
const STICKY = 'sticky left-0 z-10 bg-ds-surface'

// Abschnitt „Ortstaxe“ (PROJ-14, nur Inhaber-Kunden): je Kunde und Gemeinde laufender Monat/Quartal/Jahr, Trennstrich,
// letzter abgelaufener Monat/Quartal/Jahr. Berichte stehen unter „Ortstaxe“ (PROJ-16), ohne Knopf hier.
export async function TouristTaxSection({ scope, today }: { scope: DashboardScope; today: string }) {
  const t = await getTranslations('dashboard')
  const data = await getTouristTaxMonths(scope, today)
  const periods = taxPeriods(today)
  const blocks = touristTaxTable(
    data.rows,
    periods,
    scope.owned.map((o) => ({ id: o.id, name: o.name }))
  )
  const label = (p: TaxPeriod) =>
    p.kind === 'month' ? t('tax.month', { month: String(p.index), year: p.year }) : p.kind === 'quarter' ? t('tax.quarter', { quarter: p.index, year: p.year }) : t('tax.year', { year: p.year })
  const showTenant = scope.owned.length > 1

  return (
    // Zwei Spalten breit, damit alle drei Zeiträume ohne seitliches Scrollen Platz haben
    <DashboardSection id="ortstaxe-titel" title={t('tax.title')} className="md:col-span-2">
      {!data.ready ? (
        <SectionProblem text={t('sectionUnavailable')} />
      ) : data.failed ? (
        <SectionProblem text={t('sectionError')} retry />
      ) : blocks.length === 0 ? (
        <div className="flex flex-col items-start gap-2">
          <SectionEmpty>{t('tax.empty')}</SectionEmpty>
          <Link href="/einstellungen/wohnungen" className="text-sm text-ds-accent-700 underline underline-offset-4">
            {t('tax.toApartments')}
          </Link>
        </div>
      ) : (
        // Eigener Scrollbereich mit Tastaturfokus; der innere der Tabelle läuft nicht über (axe scrollable-region-focusable, BUG-2)
        <div role="region" aria-label={t('tax.tableLabel')} tabIndex={0} className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-2 [&>div]:overflow-visible">
          <Table className="min-w-[22rem] tabular-nums">
            <Part heading={t('tax.current')} periods={periods.current} label={label} blocks={blocks} which="current" showTenant={showTenant} totalLabel={t('tax.total')} />
            <Part heading={t('tax.past')} periods={periods.past} label={label} blocks={blocks} which="past" showTenant={showTenant} totalLabel={t('tax.total')} separated />
          </Table>
        </div>
      )}
    </DashboardSection>
  )
}

function Part({
  heading,
  periods,
  label,
  blocks,
  which,
  showTenant,
  totalLabel,
  separated = false,
}: {
  heading: string
  periods: TaxPeriod[]
  label: (p: TaxPeriod) => string
  blocks: TaxTenantBlock[]
  which: 'current' | 'past'
  showTenant: boolean
  totalLabel: string
  separated?: boolean
}) {
  const line = (l: TaxLine, total: boolean, indent: boolean) => (
    <TableRow key={`${which}-${l.id}`} className={cn('hover:bg-transparent', total && 'font-semibold')}>
      <TableCell className={cn(STICKY, 'px-0 py-1.5 pr-3', indent && 'pl-3')}>{total ? totalLabel : l.name}</TableCell>
      {l[which].map((cents, i) => (
        <TableCell key={i} className="px-2 py-1.5 text-right last:pr-0">
          <Amount cents={cents} />
        </TableCell>
      ))}
    </TableRow>
  )
  // Kopfzeile des zweiten Teils steht im Tabellenkörper (nur ein <thead> je Tabelle), mit Trennstrich darüber
  const head = (
    <TableRow className={cn('hover:bg-transparent', separated && 'border-t-2 border-t-ds-text')}>
      <TableHead scope="col" className={cn(STICKY, 'h-auto px-0 pb-1.5 pr-3 pt-3 text-[13px] font-normal text-ds-neutral-700')}>
        {heading}
      </TableHead>
      {periods.map((p) => (
        <TableHead scope="col" key={p.months[0] + p.kind} className="h-auto whitespace-nowrap px-2 pb-1.5 pt-3 text-right text-[13px] font-normal text-ds-neutral-700 last:pr-0">
          {label(p)}
        </TableHead>
      ))}
    </TableRow>
  )
  return (
    <>
      {separated ? null : <TableHeader>{head}</TableHeader>}
      <TableBody>
        {separated && head}
        {blocks.map((b) => (
          <BlockRows key={`${which}-${b.tenantId}`} block={b} showTenant={showTenant} line={line} columns={periods.length + 1} />
        ))}
      </TableBody>
    </>
  )
}

function BlockRows({
  block,
  showTenant,
  line,
  columns,
}: {
  block: TaxTenantBlock
  showTenant: boolean
  line: (l: TaxLine, total: boolean, indent: boolean) => React.ReactNode
  columns: number
}) {
  return (
    <>
      {showTenant && (
        <TableRow className="hover:bg-transparent">
          <TableCell colSpan={columns} className="px-0 pb-0.5 pt-2 text-[13px] font-semibold">
            {block.tenantName}
          </TableCell>
        </TableRow>
      )}
      {block.municipalities.map((m) => line(m, false, showTenant))}
      {block.total && line(block.total, true, showTenant)}
    </>
  )
}
