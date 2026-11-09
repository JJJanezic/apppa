'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useId, useState } from 'react'
import { toast } from 'sonner'

import { saveGuestSheetBackfill } from '@/app/(app)/einstellungen/gaesteblatt/numbering-actions'
import { callAction, FormError } from '@/components/auth/form-error'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'

// Schalter „Gästeblätter nacherfassen“ (PROJ-26, Erweiterung 2026-11-09), wie „Rechnungen nacherfassen“: ein = Feld
// „Gästeblattnummer“ im Buchungsformular und „Gästeblatt hochladen“ im Buchungsdetail; aus = beides nicht vorhanden
export function SheetBackfillSwitch({ tenantId, enabled: saved, readOnly }: { tenantId: string; enabled: boolean; readOnly: boolean }) {
  const t = useTranslations('guestSheets.backfill')
  const router = useRouter()
  const id = useId()
  const [enabled, setEnabled] = useState(saved)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const result = await callAction(() => saveGuestSheetBackfill({ tenantId, enabled }))
    setPending(false)
    if (!result.ok) return setError(result.error)
    toast.success(t('saved'))
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <FormError error={error} namespace="guestSheets.errors" />
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
        <Button type="submit" disabled={pending || enabled === saved} className="min-h-11 self-start">
          {t('save')}
        </Button>
      )}
    </form>
  )
}
