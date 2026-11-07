'use client'

import { CaretDown, Funnel } from '@phosphor-icons/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { type FormEvent, useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { amountInput, parseAmountCents } from '@/lib/format'
import {
  activeInvoiceFilterCount,
  INVOICE_PAYMENT_FILTERS,
  INVOICE_STATUS_FILTERS,
  type InvoiceFilters,
  invoiceListHref,
  invoiceYearOptions,
  parseInvoiceYear,
} from '@/lib/invoices'
import { cn } from '@/lib/utils'

const ALL = '__alle'
const OTHER = '__anderes'

interface InvoiceFilterBarProps {
  filters: InvoiceFilters
  // Heutiges Datum (Wien) vom Server, damit Browser und Server dieselben Jahre anbieten
  today: string
}

// Filter der Rechnungsliste (PROJ-43): Jahr, Status, Zahlung, Betrag von/bis. Alles steht in der Adresse (teilbar,
// „Zurück“ funktioniert); jede Änderung beginnt wieder auf Seite 1, die Suche bleibt erhalten. Am Handy aufklappbar.
export function InvoiceFilterBar({ filters, today }: InvoiceFilterBarProps) {
  const t = useTranslations('invoices.filter')
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)
  const count = activeInvoiceFilterCount(filters)

  const go = (next: Partial<InvoiceFilters>) =>
    startTransition(() => router.replace(invoiceListHref({ ...filters, page: 1, ...next }), { scroll: false }))

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="flex flex-col gap-3" aria-busy={pending}>
      <CollapsibleTrigger asChild>
        <Button variant="outline" className="min-h-11 w-fit md:hidden">
          <Funnel size={18} aria-hidden="true" />
          {count > 0 ? t('toggleCount', { count }) : t('toggle')}
          <CaretDown size={16} aria-hidden="true" className={cn('transition-transform', open && 'rotate-180')} />
        </Button>
      </CollapsibleTrigger>
      {/* Ab 768 px immer sichtbar; darunter nur aufgeklappt */}
      <CollapsibleContent forceMount className="flex-col gap-3 data-[state=closed]:hidden md:flex md:data-[state=closed]:flex data-[state=open]:flex">
        <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-start">
          <YearFilter filters={filters} today={today} onChange={(year) => go({ year })} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filter-status" className="text-[13px] text-ds-neutral-800">
              {t('status')}
            </Label>
            <Select value={filters.status ?? ALL} onValueChange={(v) => go({ status: v === ALL ? null : (v as InvoiceFilters['status']) })}>
              <SelectTrigger id="filter-status" className="min-h-11 md:w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL} className="min-h-11">
                  {t('all')}
                </SelectItem>
                {INVOICE_STATUS_FILTERS.map((s) => (
                  <SelectItem key={s} value={s} className="min-h-11">
                    {t(`statusValue.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="filter-zahlung" className="text-[13px] text-ds-neutral-800">
              {t('payment')}
            </Label>
            <Select value={filters.payment ?? ALL} onValueChange={(v) => go({ payment: v === ALL ? null : (v as InvoiceFilters['payment']) })}>
              <SelectTrigger id="filter-zahlung" className="min-h-11 md:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL} className="min-h-11">
                  {t('all')}
                </SelectItem>
                {INVOICE_PAYMENT_FILTERS.map((p) => (
                  <SelectItem key={p} value={p} className="min-h-11">
                    {t(`paymentValue.${p}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Neuer Schlüssel bei geänderter Adresse: Felder zeigen nach „Zurück“ bzw. „Zurücksetzen“ die gültigen Werte */}
          <AmountFilter key={`${filters.minCents}|${filters.maxCents}`} filters={filters} onApply={(minCents, maxCents) => go({ minCents, maxCents })} />
        </div>
        {(count > 0 || filters.query) && (
          <Button asChild variant="ghost" className="min-h-11 w-fit">
            <Link href="/rechnungen" scroll={false}>
              {t('reset')}
            </Link>
          </Button>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}

// Jahr: „Alle Jahre“, Auswahl 7 zurück bis 5 voraus, „Anderes Jahr …“ mit Eingabefeld (vierstellig, 1990–2099)
function YearFilter({ filters, today, onChange }: { filters: InvoiceFilters; today: string; onChange: (year: number | null) => void }) {
  const t = useTranslations('invoices.filter')
  const options = invoiceYearOptions(today)
  const [other, setOther] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)
  // Frei eingegebenes Jahr außerhalb der Auswahl bleibt sichtbar
  const years = filters.year && !options.includes(filters.year) ? [...options, filters.year].sort((a, b) => b - a) : options

  function submit(e: FormEvent) {
    e.preventDefault()
    const year = parseInvoiceYear(value)
    if (year === null) {
      setError(true)
      return
    }
    setError(false)
    setOther(false)
    setValue('')
    onChange(year)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="filter-jahr" className="text-[13px] text-ds-neutral-800">
        {t('year')}
      </Label>
      <Select
        value={other ? OTHER : filters.year ? String(filters.year) : ALL}
        onValueChange={(v) => {
          if (v === OTHER) {
            setOther(true)
            return
          }
          setOther(false)
          setError(false)
          onChange(v === ALL ? null : Number(v))
        }}
      >
        <SelectTrigger id="filter-jahr" className="min-h-11 md:w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL} className="min-h-11">
            {t('allYears')}
          </SelectItem>
          {years.map((y) => (
            <SelectItem key={y} value={String(y)} className="min-h-11">
              {y}
            </SelectItem>
          ))}
          <SelectItem value={OTHER} className="min-h-11">
            {t('otherYear')}
          </SelectItem>
        </SelectContent>
      </Select>
      {other && (
        <form onSubmit={submit} className="flex flex-col gap-1.5" noValidate>
          <div className="flex gap-2">
            <Input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              inputMode="numeric"
              maxLength={4}
              placeholder={t('otherYearPlaceholder')}
              aria-label={t('otherYearLabel')}
              aria-invalid={error}
              aria-describedby={error ? 'filter-jahr-fehler' : undefined}
              className="min-h-11 w-24"
              autoFocus
            />
            <Button type="submit" variant="outline" className="min-h-11">
              {t('show')}
            </Button>
          </div>
          {error && (
            <p id="filter-jahr-fehler" role="alert" className="text-sm text-ds-accent-2-700">
              {t('yearInvalid')}
            </p>
          )}
        </form>
      )}
    </div>
  )
}

type AmountError = 'min' | 'max' | 'order' | null

// Betrag von/bis (Rechnungsbetrag brutto, Grenzen inklusive, negativ erlaubt); angewendet mit „Anwenden“ bzw. Eingabetaste.
// Ungültige Eingaben und „von“ größer als „bis“ zeigen einen Hinweis; der Betragsfilter bleibt dann unverändert.
function AmountFilter({ filters, onApply }: { filters: InvoiceFilters; onApply: (minCents: number | null, maxCents: number | null) => void }) {
  const t = useTranslations('invoices.filter')
  const [min, setMin] = useState(amountInput(filters.minCents))
  const [max, setMax] = useState(amountInput(filters.maxCents))
  const [error, setError] = useState<AmountError>(null)

  function submit(e: FormEvent) {
    e.preventDefault()
    const minCents = parseAmountCents(min, { negative: true })
    const maxCents = parseAmountCents(max, { negative: true })
    if (Number.isNaN(minCents)) return setError('min')
    if (Number.isNaN(maxCents)) return setError('max')
    if (minCents !== null && maxCents !== null && minCents > maxCents) return setError('order')
    setError(null)
    onApply(minCents, maxCents)
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-1.5" noValidate aria-label={t('amount')}>
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-von" className="text-[13px] text-ds-neutral-800">
            {t('amountFrom')}
          </Label>
          <Input
            id="filter-von"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            inputMode="decimal"
            autoComplete="off"
            aria-invalid={error === 'min' || error === 'order'}
            aria-describedby={error ? 'filter-betrag-fehler' : undefined}
            className="min-h-11 w-32 text-right tabular-nums"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-bis" className="text-[13px] text-ds-neutral-800">
            {t('amountTo')}
          </Label>
          <Input
            id="filter-bis"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            inputMode="decimal"
            autoComplete="off"
            aria-invalid={error === 'max' || error === 'order'}
            aria-describedby={error ? 'filter-betrag-fehler' : undefined}
            className="min-h-11 w-32 text-right tabular-nums"
          />
        </div>
        <Button type="submit" variant="outline" className="min-h-11">
          {t('apply')}
        </Button>
      </div>
      {error && (
        <p id="filter-betrag-fehler" role="alert" className="text-sm text-ds-accent-2-700">
          {t(`amountError.${error}`)}
        </p>
      )}
    </form>
  )
}
