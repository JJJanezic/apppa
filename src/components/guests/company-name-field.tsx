'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { useFormContext } from 'react-hook-form'

import { suggestCompanies } from '@/app/(app)/gaeste/actions'
import { callAction } from '@/components/auth/form-error'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { LabelCombobox } from '@/components/vat/label-combobox'
import { COMPANY_SUGGESTION_MIN_CHARS, type CompanySuggestion, companySuggestionDetail, LIMITS } from '@/lib/guests'
import { companyInputFromSuggestion, type GuestInput } from '@/lib/validation/guests'

const DELAY_MS = 200

interface CompanyNameFieldProps {
  // Der bearbeitete Gast liefert keine Vorschläge (seine eigene Fassung)
  guestId?: string
  // Ein Vorschlag wurde übernommen (z. B. Merker der PLZ-Automatik zurücksetzen)
  onApplied: () => void
}

// Firmenname mit Vorschlägen (PROJ-49): Ab 2 Zeichen schlägt das Feld Firmen anderer Gäste desselben Kunden vor.
// Ein gewählter Vorschlag ersetzt alle sieben Firmenfelder (Kopie, keine Verknüpfung). Ohne Auswahl bleibt es ein
// normales Textfeld. Fehler beim Laden zeigen keine Meldung, die Liste bleibt dann einfach leer.
export function CompanyNameField({ guestId, onApplied }: CompanyNameFieldProps) {
  const t = useTranslations('guests.panel')
  const { control, setValue, formState } = useFormContext<GuestInput>()
  const [suggestions, setSuggestions] = useState<CompanySuggestion[]>([])
  const [announcement, setAnnouncement] = useState('')
  const sequence = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  // Nur Eingaben im Feld lösen die Suche aus, nicht das Öffnen eines Gastes mit Firma
  const search = (query: string) => {
    const current = ++sequence.current
    clearTimeout(timer.current)
    if (query.trim().length < COMPANY_SUGGESTION_MIN_CHARS) {
      setSuggestions([])
      return
    }
    timer.current = setTimeout(async () => {
      const result = await callAction(() => suggestCompanies({ query, excludeId: guestId }))
      // Inzwischen weitergetippt oder übernommen: veraltete Antwort verwerfen
      if (current !== sequence.current) return
      const rows = result.ok && result.data ? result.data : []
      setSuggestions(rows)
      setAnnouncement(rows.length ? t('companySuggestionsFound', { count: rows.length }) : '')
    }, DELAY_MS)
  }

  const apply = (s: CompanySuggestion) => {
    sequence.current++
    clearTimeout(timer.current)
    const values = companyInputFromSuggestion(s)
    for (const [name, value] of Object.entries(values) as [keyof typeof values, string][])
      setValue(name, value, { shouldDirty: true, shouldValidate: formState.isSubmitted })
    setSuggestions([])
    setAnnouncement(t('companySuggestionApplied', { name: s.name }))
    onApplied()
  }

  return (
    <FormField
      control={control}
      name="companyName"
      render={({ field }) => (
        <FormItem>
          <FormLabel>{t('companyName')}</FormLabel>
          <FormControl>
            <LabelCombobox
              maxLength={LIMITS.companyNameMax}
              className="min-h-11"
              filter={false}
              choices={suggestions.map((s, i) => ({ key: String(i), label: s.name, detail: companySuggestionDetail(s) || undefined }))}
              listLabel={t('companySuggestions')}
              {...field}
              value={field.value ?? ''}
              onValueChange={(v) => {
                field.onChange(v)
                search(v)
              }}
              onChoose={(choice) => {
                const s = suggestions[Number(choice.key)]
                if (s) apply(s)
              }}
            />
          </FormControl>
          <FormMessage />
          <p className="sr-only" aria-live="polite">
            {announcement}
          </p>
        </FormItem>
      )}
    />
  )
}
