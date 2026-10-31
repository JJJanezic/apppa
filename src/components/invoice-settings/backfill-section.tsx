'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useId, useState } from 'react'
import { toast } from 'sonner'

import { saveInvoiceBackfill } from '@/app/(app)/einstellungen/rechnungen/actions'
import { callAction, FormError } from '@/components/auth/form-error'
import { StaleAlert } from '@/components/invoice-settings/section-shell'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import type { InvoiceSettingsData } from '@/lib/invoice-settings'

// Schalter „Rechnungen nacherfassen“ (PROJ-37), seit PROJ-39 hier statt in den Stammdaten
export function BackfillSection({ tenantId, data, readOnly }: { tenantId: string; data: InvoiceSettingsData; readOnly: boolean }) {
  const t = useTranslations('invoiceSettings.backfill')
  const router = useRouter()
  const id = useId()
  const [enabled, setEnabled] = useState(data.backfill.enabled)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stale, setStale] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const result = await callAction(() => saveInvoiceBackfill({ tenantId, updatedAt: data.backfill.updatedAt, enabled }))
    setPending(false)
    if (!result.ok) {
      if (result.error === 'staleSettings') setStale(true)
      else setError(result.error)
      return
    }
    toast.success(t('saved'))
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <FormError error={error} namespace="invoiceSettings.errors" />
      {stale && <StaleAlert />}
      <div className="flex items-start gap-3">
        <Switch id={id} checked={enabled} onCheckedChange={setEnabled} disabled={readOnly} aria-describedby={`${id}-hint`} className="mt-0.5" />
        <div className="flex flex-col gap-0.5">
          <Label htmlFor={id} className="font-normal">
            {t('label')}
          </Label>
          <p id={`${id}-hint`} className="text-sm text-muted-foreground">
            {t('hint')}
          </p>
        </div>
      </div>
      {!readOnly && (
        <Button type="submit" disabled={pending} className="min-h-11 self-start">
          {t('save')}
        </Button>
      )}
    </form>
  )
}
