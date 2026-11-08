'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

import { searchCompanies } from '@/app/(app)/gaeste/firmen/actions'
import { callAction } from '@/components/auth/form-error'
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { COMPANY_SEARCH_MIN_CHARS, companyDetailLine, type CompanyRow } from '@/lib/companies'

const DELAY_MS = 200

interface CompanyPickerProps {
  // Diese Firma erscheint nicht in den Treffern (z. B. die Firma, mit der zusammengeführt wird)
  excludeId?: string
  onSelect: (company: CompanyRow) => void
  label: string
  // Vorbelegter Suchtext (z. B. Name bei mehreren gleichnamigen Firmen)
  initialQuery?: string
}

// Firmensuche mit Trefferliste (PROJ-50): Name oder UID, ab 2 Zeichen; Bauart wie GuestPicker
export function CompanyPicker({ excludeId, onSelect, label, initialQuery = '' }: CompanyPickerProps) {
  const t = useTranslations('companies.picker')
  const [query, setQuery] = useState(initialQuery)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)
  const [rows, setRows] = useState<CompanyRow[]>([])
  const tooShort = query.trim().length < COMPANY_SEARCH_MIN_CHARS

  useEffect(() => {
    if (tooShort) return
    let cancelled = false
    const timer = setTimeout(async () => {
      setLoading(true)
      const result = await callAction(() => searchCompanies({ query, excludeId }))
      if (cancelled) return
      setLoading(false)
      setFailed(!result.ok)
      setRows(result.ok && result.data ? result.data : [])
    }, DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, excludeId, tooShort])

  return (
    <Command shouldFilter={false} className="rounded-lg border" label={label}>
      <CommandInput value={query} onValueChange={setQuery} placeholder={t('placeholder')} aria-label={label} />
      {/* Hinweise neben der Trefferliste: role="listbox" darf nur Optionen enthalten (WCAG, axe aria-required-children) */}
      {tooShort && <p className="px-3 py-2 text-sm text-ds-neutral-700">{t('minChars')}</p>}
      {!tooShort && loading && <p className="px-3 py-2 text-sm text-ds-neutral-700">{t('loading')}</p>}
      {!tooShort && !loading && failed && (
        <p role="status" className="px-3 py-2 text-sm text-ds-accent-2-700">
          {t('failed')}
        </p>
      )}
      {!tooShort && !loading && !failed && rows.length === 0 && (
        <p role="status" className="px-3 py-2 text-sm text-ds-neutral-700">
          {t('none')}
        </p>
      )}
      <CommandList>
        {!tooShort && rows.length > 0 && (
          <CommandGroup>
            {rows.map((row) => (
              <CommandItem key={row.id} value={row.id} onSelect={() => onSelect(row)} className="min-h-11 flex-col items-start gap-0">
                <span className="break-words font-medium">{row.name}</span>
                {companyDetailLine(row) && <span className="break-words text-[13px] text-ds-neutral-700">{companyDetailLine(row)}</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </Command>
  )
}
