'use client'

import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useId, useState } from 'react'
import { toast } from 'sonner'

import { adminSaveIdReading } from '@/app/(app)/betreiber/actions'
import { callAction, FormError } from '@/components/auth/form-error'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { formatNumber } from '@/lib/format'
import { ID_READING_LIMIT_MAX, ID_READING_LIMIT_MIN } from '@/lib/id-reading'
import type { IdReadingSettings, IdReadingUsage } from '@/lib/id-reading-data'

interface IdReadingSettingsProps {
  tenantId: string
  settings: IdReadingSettings
  usage: IdReadingUsage
  readOnly: boolean
}

// Betreiber-Admin → Kunde: „Ausweis automatisch auslesen (experimentell)“ (PROJ-51). Schalter (Standard aus), Tageslimit und
// Anzahl der Auslesungen im laufenden und letzten Monat. Inhaber und Mitarbeiter sehen davon nichts.
export function IdReadingSettingsForm({ tenantId, settings, usage, readOnly }: IdReadingSettingsProps) {
  const t = useTranslations('idReading.operator')
  const router = useRouter()
  const id = useId()
  const [enabled, setEnabled] = useState(settings.enabled)
  const [limit, setLimit] = useState(String(settings.dailyLimit))
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const limitNumber = Number(limit)
  const limitValid = /^\d+$/.test(limit) && limitNumber >= ID_READING_LIMIT_MIN && limitNumber <= ID_READING_LIMIT_MAX
  const changed = enabled !== settings.enabled || limitNumber !== settings.dailyLimit

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!limitValid) return
    setError(null)
    setPending(true)
    const result = await callAction(() => adminSaveIdReading({ tenantId, enabled, dailyLimit: limitNumber }))
    setPending(false)
    if (!result.ok) return setError(result.error)
    toast.success(t('saved'))
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      <FormError error={error} namespace="operator.errors" />
      <div className="flex items-start gap-3">
        <Switch
          id={`${id}-enabled`}
          checked={enabled}
          onCheckedChange={setEnabled}
          disabled={readOnly}
          aria-describedby={`${id}-hint`}
          className="mt-0.5"
        />
        <div className="flex flex-col gap-0.5">
          <Label htmlFor={`${id}-enabled`} className="font-normal">
            {t('label')}
          </Label>
          <p id={`${id}-hint`} className="text-sm text-muted-foreground">
            {t('hint')}
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:max-w-xs">
        <Label htmlFor={`${id}-limit`}>{t('dailyLimit')}</Label>
        <Input
          id={`${id}-limit`}
          inputMode="numeric"
          value={limit}
          onChange={(e) => setLimit(e.target.value.replace(/\D/g, '').slice(0, 4))}
          disabled={readOnly}
          aria-invalid={!limitValid || undefined}
          aria-describedby={`${id}-limit-hint`}
          className="min-h-11"
        />
        <p id={`${id}-limit-hint`} className={limitValid ? 'text-sm text-muted-foreground' : 'text-sm text-destructive'}>
          {limitValid ? t('dailyLimitHint') : t('dailyLimitInvalid', { min: ID_READING_LIMIT_MIN, max: ID_READING_LIMIT_MAX })}
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-4 sm:max-w-md">
        <div className="flex flex-col gap-0.5">
          <dt className="text-[13px] text-ds-neutral-700">{t('thisMonth')}</dt>
          <dd className="text-xl tabular-nums">{formatNumber(usage.thisMonth)}</dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-[13px] text-ds-neutral-700">{t('lastMonth')}</dt>
          <dd className="text-xl tabular-nums">{formatNumber(usage.lastMonth)}</dd>
        </div>
      </dl>
      {!readOnly && (
        <Button type="submit" disabled={pending || !changed || !limitValid} className="min-h-11 self-start">
          {t('save')}
        </Button>
      )}
    </form>
  )
}
