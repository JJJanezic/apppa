'use client'

import { CaretDown, Info } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { useFormContext, useWatch } from 'react-hook-form'

import { findSameNameCompanies } from '@/app/(app)/gaeste/firmen/actions'
import { callAction } from '@/components/auth/form-error'
import { CompanyCard } from '@/components/companies/company-card'
import { CompanyFields } from '@/components/companies/company-fields'
import { CompanyPicker } from '@/components/companies/company-picker'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { FormField, FormItem, FormMessage } from '@/components/ui/form'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import type { CompanyRow, CompanySummary } from '@/lib/companies'
import { EMPTY_COMPANY_INPUT } from '@/lib/validation/companies'
import { COMPANY_MODES, type CompanyMode, type GuestInput } from '@/lib/validation/guests'

const SAME_NAME_DELAY_MS = 300

type CardCompany = Pick<CompanyRow, 'name' | 'nameMissing' | 'vatId' | 'postalCode' | 'city' | 'addressLine1'>

interface CompanySectionProps {
  // Firma des bearbeiteten Gastes (Karte beim Öffnen)
  initialCompany?: CompanySummary | null
}

// Bereich „Firma“ im Gastformular (PROJ-50): „Keine Firma“, „Bestehende Firma“ (Suche → Karte nur zum Lesen) oder
// „Neue Firma“ (leere Felder). Gilt für Gästeseite, Buchungsformular und Rechnungsnacherfassung.
// Die Firma selbst wird nur im Reiter „Firmen“ bearbeitet.
export function CompanySection({ initialCompany = null }: CompanySectionProps) {
  const t = useTranslations('companies.section')
  const { control, setValue, getValues, clearErrors, formState } = useFormContext<GuestInput>()
  const [mode, companyId, companyName] = useWatch({ control, name: ['companyMode', 'companyId', 'companyName'] })
  // Angezeigte Karte; beim Bearbeiten die Firma des Gastes
  const [card, setCard] = useState<CardCompany | null>(initialCompany)
  // „Ändern“ geklickt: Suche zeigen, bisherige Verknüpfung bleibt bis zur Auswahl einer anderen Firma
  const [searching, setSearching] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [open, setOpen] = useState(() => getValues('companyMode') !== 'none')
  const [sameName, setSameName] = useState<CompanyRow[]>([])
  const companyError = Boolean(
    formState.errors.companyId ||
      formState.errors.companyName ||
      formState.errors.companyEmail ||
      formState.errors.companyWebsite ||
      formState.errors.companyAddressLine1
  )

  // Hinweis „Diese Firma gibt es bereits“ bei „Neue Firma“ (verzögert beim Tippen)
  const typedName = mode === 'new' ? companyName.trim() : ''
  useEffect(() => {
    if (!typedName) return
    let cancelled = false
    const timer = setTimeout(async () => {
      const result = await callAction(() => findSameNameCompanies({ name: typedName }))
      if (!cancelled) setSameName(result.ok && result.data ? result.data : [])
    }, SAME_NAME_DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [typedName])
  const sameNameShown = typedName ? sameName : []

  // Wechsel der Auswahl verwirft die Eingaben des vorherigen Punkts ohne Rückfrage
  function changeMode(next: CompanyMode) {
    for (const [k, v] of Object.entries(EMPTY_COMPANY_INPUT)) setValue(k as keyof typeof EMPTY_COMPANY_INPUT, v, { shouldDirty: true })
    setValue('companyId', '', { shouldDirty: true })
    setValue('companyMode', next, { shouldDirty: true })
    clearErrors()
    setCard(null)
    setSearching(false)
    setSearchQuery('')
    setSameName([])
  }

  function pick(row: CompanyRow) {
    setValue('companyId', row.id, { shouldDirty: true })
    // Name für den Rechnungsempfänger beim Nacherfassen (PROJ-37); gespeichert wird nur die Verknüpfung
    setValue('companyName', row.name, { shouldDirty: true })
    clearErrors('companyId')
    setCard(row)
    setSearching(false)
  }

  function switchToExisting() {
    const name = getValues('companyName').trim()
    changeMode('existing')
    if (sameName.length === 1) pick(sameName[0])
    else setSearchQuery(name)
  }

  const showCard = mode === 'existing' && companyId && card && !searching

  return (
    <Collapsible open={open || companyError} onOpenChange={setOpen} className="rounded-lg border">
      <CollapsibleTrigger className="flex min-h-11 w-full items-center justify-between gap-3 px-4 py-2 text-left">
        <span className="flex flex-col">
          <span className="text-sm font-semibold">{t('title')}</span>
          <span className="text-[13px] text-ds-neutral-700">{mode === 'existing' && card ? card.name : t('hint')}</span>
        </span>
        <CaretDown size={16} aria-hidden="true" className={open || companyError ? 'rotate-180 transition-transform' : 'transition-transform'} />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-4 px-4 pb-4">
        <fieldset className="flex flex-col gap-2">
          <legend className="sr-only">{t('title')}</legend>
          <RadioGroup value={mode} onValueChange={(v) => changeMode(v as CompanyMode)} className="flex flex-wrap gap-x-6 gap-y-1">
            {COMPANY_MODES.map((m) => (
              <div key={m} className="flex min-h-11 items-center gap-2">
                <RadioGroupItem value={m} id={`company-mode-${m}`} />
                <Label htmlFor={`company-mode-${m}`} className="cursor-pointer font-normal">
                  {t(`mode.${m}`)}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </fieldset>

        {mode === 'existing' && (
          <FormField
            control={control}
            name="companyId"
            render={() => (
              <FormItem>
                {showCard ? (
                  <CompanyCard
                    company={card}
                    onChange={() => {
                      setSearchQuery('')
                      setSearching(true)
                    }}
                  />
                ) : (
                  <div className="flex flex-col gap-2">
                    <CompanyPicker
                      key={searchQuery}
                      label={t('pickLabel')}
                      initialQuery={searchQuery}
                      excludeId={searching && companyId ? companyId : undefined}
                      onSelect={pick}
                    />
                    {searching && companyId && card && (
                      <Button type="button" variant="ghost" className="min-h-11 self-start" onClick={() => setSearching(false)}>
                        {t('keepCurrent', { name: card.name })}
                      </Button>
                    )}
                  </div>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {mode === 'new' && (
          <CompanyFields
            nameHint={
              sameNameShown.length > 0 && (
                <Alert className="border-ds-accent-700/40 bg-ds-accent-100">
                  <Info size={18} weight="duotone" aria-hidden="true" />
                  <AlertDescription className="flex flex-col items-start gap-2">
                    <span>{t('sameName', { count: sameNameShown.length })}</span>
                    <Button type="button" variant="outline" className="min-h-11" onClick={switchToExisting}>
                      {t('useExisting')}
                    </Button>
                  </AlertDescription>
                </Alert>
              )
            }
          />
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
