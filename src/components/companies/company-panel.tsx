'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { WarningCircle } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { createCompany, updateCompany } from '@/app/(app)/gaeste/firmen/actions'
import { callAction, FormError } from '@/components/auth/form-error'
import { CompanyFields } from '@/components/companies/company-fields'
import { DetailPanel } from '@/components/detail-panel'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import type { Company } from '@/lib/companies'
import { companyInput, type CompanyInput, companySchema, EMPTY_COMPANY_INPUT } from '@/lib/validation/companies'

interface CompanyPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Bearbeiten: die Firma; Anlegen: null
  company: Company | null
}

// Detail-Panel „Firma anlegen / bearbeiten“ (PROJ-50, nur Inhaber). Beim Bearbeiten schützt „zuletzt geändert am“ vor
// dem Überschreiben fremder Änderungen; die Änderung gilt sofort für alle verknüpften Gäste.
export function CompanyPanel({ open, onOpenChange, company }: CompanyPanelProps) {
  const t = useTranslations('companies')
  const tv = useTranslations('guests.validation')
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const form = useForm<CompanyInput>({
    resolver: zodResolver(companySchema(tv), undefined, { raw: true }),
    defaultValues: company ? companyInput(company) : EMPTY_COMPANY_INPUT,
  })

  async function save(values: CompanyInput) {
    setError(null)
    const result = await callAction(() =>
      company ? updateCompany({ id: company.id, updatedAt: company.updatedAt, ...values }) : createCompany(values)
    )
    if (!result.ok) {
      if (result.error === 'staleCompany') setStale(true)
      else setError(result.error)
      return
    }
    toast.success(company ? t('done.saved') : t('done.created', { name: values.companyName.trim() }))
    onOpenChange(false)
    // Nach dem Anlegen leitet die Aktion selbst zum Firmendetail weiter
    if (!result.redirectTo) router.refresh()
  }

  const submitting = form.formState.isSubmitting

  return (
    <DetailPanel
      open={open}
      onOpenChange={onOpenChange}
      title={company ? t('panel.editTitle') : t('panel.createTitle')}
      eyebrow={company?.name}
      description={company ? t('panel.editDescription', { count: company.guestCount }) : t('panel.createDescription')}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(save)} noValidate className="flex flex-col gap-6">
          <FormError error={error} namespace="companies.errors" />
          {stale && (
            <Alert role="alert" className="border-ds-accent-2-700/40 bg-ds-accent-2-100 text-ds-accent-2-800">
              <WarningCircle size={18} weight="duotone" aria-hidden="true" />
              <AlertDescription className="flex flex-col items-start gap-3">
                {t('stale.text')}
                {/* Neue Daten laden: Die Seite reicht die aktuelle Firma nach, das Panel startet mit deren Werten */}
                <Button type="button" variant="outline" className="min-h-11" onClick={() => router.refresh()}>
                  {t('stale.reload')}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <CompanyFields />

          <Button type="submit" disabled={submitting} aria-busy={submitting} className="min-h-11">
            {company ? t('panel.save') : t('panel.createSubmit')}
          </Button>
        </form>
      </Form>
    </DetailPanel>
  )
}
