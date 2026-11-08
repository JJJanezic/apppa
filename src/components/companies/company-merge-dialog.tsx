'use client'

import { WarningCircle } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { loadCompany, mergeCompanies } from '@/app/(app)/gaeste/firmen/actions'
import { callAction, FormError } from '@/components/auth/form-error'
import { CompanyPicker } from '@/components/companies/company-picker'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  type Company,
  companyAddress,
  companyHref,
  COMPANY_MERGE_FIELDS,
  type CompanyMergeChoice,
  type CompanyMergeField,
  defaultCompanyMergeChoice,
  sameCompanyMergeValue,
} from '@/lib/companies'

interface CompanyMergeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Firma A bleibt bestehen; Firma B wird gelöscht (ihre Gäste gehen auf A über)
  company: Company
  // Vorgewählte zweite Firma (aus „Mögliche doppelte Firmen“); sonst wählt der Inhaber per Suche
  presetOtherId?: string
}

// Dialog „Firmen zusammenführen“ (PROJ-50, nur Inhaber): je Angabe wählen, welcher Wert bleibt; Rechnungsadresse als Ganzes
export function CompanyMergeDialog({ open, onOpenChange, company, presetOtherId }: CompanyMergeDialogProps) {
  const t = useTranslations('companies.merge')
  const locale = useLocale()
  const router = useRouter()
  const [other, setOther] = useState<Company | null>(null)
  const [loading, setLoading] = useState(false)
  const [choice, setChoice] = useState<CompanyMergeChoice | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)

  async function pick(id: string) {
    setError(null)
    setLoading(true)
    const result = await callAction(() => loadCompany({ id }))
    setLoading(false)
    if (!result.ok || !result.data) {
      setError(result.ok ? 'unknown' : result.error)
      return
    }
    setOther(result.data)
    setChoice(defaultCompanyMergeChoice(company, result.data))
  }

  // Aus „Mögliche doppelte Firmen“: zweite Firma gleich laden
  useEffect(() => {
    if (presetOtherId) void pick(presetOtherId)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur beim Öffnen
  }, [presetOtherId])

  async function merge() {
    if (!other || !choice) return
    setConfirming(false)
    setPending(true)
    const result = await callAction(() => mergeCompanies({ keepId: company.id, removeId: other.id, choice }))
    setPending(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    toast.success(t('done'))
    onOpenChange(false)
    router.push(companyHref(company.id))
    router.refresh()
  }

  function display(c: Company, field: CompanyMergeField): string {
    switch (field) {
      case 'name':
        return c.name
      case 'vatId':
        return c.vatId ?? ''
      case 'address':
        return companyAddress(c, locale).join(', ')
      case 'email':
        return c.email ?? ''
      case 'website':
        return c.website ?? ''
      case 'contact':
        return c.contact ?? ''
    }
  }
  const valueOrDash = (value: string) => value || t('empty')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <FormError error={error} namespace="companies.errors" />

        {!other ? (
          loading ? (
            <p className="text-sm text-ds-neutral-700">{t('loading')}</p>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold">{t('pickLabel')}</p>
              <CompanyPicker excludeId={company.id} label={t('pickLabel')} onSelect={(row) => pick(row.id)} />
            </div>
          )
        ) : (
          choice && (
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-3 text-sm">
                {([company, other] as const).map((c, i) => (
                  <div key={c.id} className="rounded-lg bg-ds-surface p-3">
                    <p className="text-[13px] text-ds-neutral-700">{i === 0 ? t('companyA') : t('companyB')}</p>
                    <p className="break-words font-semibold">{c.name}</p>
                    <p className="text-[13px] text-ds-neutral-800">{t('guests', { count: c.guestCount })}</p>
                  </div>
                ))}
              </div>

              <ul className="flex flex-col gap-4">
                {COMPANY_MERGE_FIELDS.map((field) => (
                  <li key={field}>
                    {sameCompanyMergeValue(company, other, field) ? (
                      <div className="flex flex-col gap-0.5">
                        <p className="text-sm font-semibold">{t(`field.${field}`)}</p>
                        <p className="text-sm text-ds-neutral-800">
                          {valueOrDash(display(company, field))} <span className="text-ds-neutral-700">({t('same')})</span>
                        </p>
                      </div>
                    ) : (
                      <fieldset className="flex flex-col gap-2">
                        <legend className="mb-2 text-sm font-semibold">{t(`field.${field}`)}</legend>
                        {field === 'address' && <p className="-mt-1 mb-1 text-[13px] text-ds-neutral-700">{t('addressHint')}</p>}
                        <RadioGroup
                          value={choice[field]}
                          onValueChange={(v) => setChoice({ ...choice, [field]: v === 'b' ? 'b' : 'a' })}
                          className="grid gap-2 sm:grid-cols-2"
                        >
                          {(['a', 'b'] as const).map((side) => (
                            <div key={side} className="flex min-h-11 items-start gap-2 rounded-md border p-3">
                              <RadioGroupItem value={side} id={`company-merge-${field}-${side}`} className="mt-0.5" />
                              <Label htmlFor={`company-merge-${field}-${side}`} className="flex cursor-pointer flex-col gap-0.5 font-normal">
                                <span className="text-[12px] text-ds-neutral-700">{side === 'a' ? t('companyA') : t('companyB')}</span>
                                <span className="break-words">{valueOrDash(display(side === 'a' ? company : other, field))}</span>
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </fieldset>
                    )}
                  </li>
                ))}
              </ul>

              <Alert className="border-ds-accent-2-700/40 bg-ds-accent-2-100 text-ds-accent-2-800">
                <WarningCircle size={18} weight="duotone" aria-hidden="true" />
                <AlertDescription>{t('irreversible')}</AlertDescription>
              </Alert>
            </div>
          )
        )}

        <DialogFooter className="gap-3 sm:gap-2">
          {other && !presetOtherId && (
            <Button type="button" variant="ghost" className="min-h-11" disabled={pending} onClick={() => setOther(null)}>
              {t('change')}
            </Button>
          )}
          <Button type="button" variant="outline" className="min-h-11" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </Button>
          {other && (
            <Button type="button" className="min-h-11" disabled={pending} aria-busy={pending} onClick={() => setConfirming(true)}>
              {t('submit')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>

      {other && confirming && (
        <ConfirmDialog
          open
          onOpenChange={(next) => !next && setConfirming(false)}
          title={t('confirmTitle')}
          text={t('confirmText', { removed: other.name, kept: company.name, count: other.guestCount })}
          confirmLabel={t('submit')}
          cancelLabel={t('cancel')}
          onConfirm={merge}
        />
      )}
    </Dialog>
  )
}
