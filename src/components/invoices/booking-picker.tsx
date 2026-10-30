'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

import { searchInvoiceBookings } from '@/app/(app)/rechnungen/actions'
import { callAction } from '@/components/auth/form-error'
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { formatPeriod } from '@/lib/format'
import type { InvoiceBookingOption } from '@/lib/invoices'

const DELAY_MS = 200

// Zeile eines Treffers bzw. der gewählten Buchung: „Huber Maria · Top 3 · Mi, 14.10.2026 – Sa, 17.10.2026“
export function useBookingOptionLabel() {
  const t = useTranslations('invoices.form')
  return (b: InvoiceBookingOption) => [b.guestName ?? t('bookingNoGuest'), b.apartmentLabel, formatPeriod(b.arrival, b.departure)].join(' · ')
}

// Buchungssuche im Formular „Rechnung nacherfassen“ (PROJ-37): Gastname, Wohnung oder Zeitraum, ab 2 Zeichen.
// Buchungen und Optionen inkl. stornierter, keine Sperren; höchstens 20 Treffer, neueste zuerst (Datenbank).
export function BookingPicker({ onSelect, label }: { onSelect: (booking: InvoiceBookingOption) => void; label: string }) {
  const t = useTranslations('invoices.form')
  const tb = useTranslations('bookings')
  const optionLabel = useBookingOptionLabel()
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [rows, setRows] = useState<InvoiceBookingOption[]>([])
  const tooShort = query.trim().length < 2

  useEffect(() => {
    if (tooShort) return
    let cancelled = false
    const timer = setTimeout(async () => {
      setLoading(true)
      const result = await callAction(() => searchInvoiceBookings({ query }))
      if (cancelled) return
      setLoading(false)
      setRows(result.ok && result.data ? result.data : [])
    }, DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, tooShort])

  return (
    <Command shouldFilter={false} className="rounded-lg border" label={label}>
      <CommandInput value={query} onValueChange={setQuery} placeholder={t('bookingPlaceholder')} aria-label={label} />
      {/* Hinweise neben der Trefferliste: role="listbox" darf nur Optionen enthalten (WCAG, axe aria-required-children) */}
      {tooShort && <p className="px-3 py-2 text-sm text-ds-neutral-700">{t('bookingMinChars')}</p>}
      {!tooShort && loading && <p className="px-3 py-2 text-sm text-ds-neutral-700">{t('bookingLoading')}</p>}
      {!tooShort && !loading && rows.length === 0 && (
        <p role="status" className="px-3 py-2 text-sm text-ds-neutral-700">
          {t('bookingNone')}
        </p>
      )}
      <CommandList>
        {!tooShort && rows.length > 0 && (
          <CommandGroup>
            {rows.map((row) => (
              <CommandItem key={row.id} value={row.id} onSelect={() => onSelect(row)} className="min-h-11 flex-col items-start gap-0">
                <span className="font-medium">{optionLabel(row)}</span>
                <span className="text-[13px] text-ds-neutral-700">
                  {[tb(`kind.${row.kind}`), row.number, row.cancelled && tb('state.cancelled')].filter(Boolean).join(' · ')}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  )
}
