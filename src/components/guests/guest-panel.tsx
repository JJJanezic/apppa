'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { WarningCircle } from '@phosphor-icons/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'

import { checkGuestDuplicates, createGuest, updateGuest } from '@/app/(app)/gaeste/actions'
import { callAction, FormError } from '@/components/auth/form-error'
import { DetailPanel } from '@/components/detail-panel'
import { GuestFields } from '@/components/guests/guest-fields'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { countryName, type DuplicateMatch, type Guest, guestDisplayName, guestHref, guestSortName } from '@/lib/guests'
import { EMPTY_GUEST_INPUT, guestInput, type GuestInput, guestSchema } from '@/lib/validation/guests'

interface GuestPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Bearbeiten: der Gast; Anlegen: null
  guest: Guest | null
}

// Detail-Panel „Gast anlegen / bearbeiten“ (PROJ-7, nur Inhaber). Beim Anlegen warnt es vor möglichen
// Doppeleinträgen; beim Bearbeiten schützt „zuletzt geändert am“ vor dem Überschreiben fremder Änderungen.
export function GuestPanel({ open, onOpenChange, guest }: GuestPanelProps) {
  const t = useTranslations('guests')
  const tv = useTranslations('guests.validation')
  const locale = useLocale()
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  // Mögliche Doppeleinträge samt den geprüften Werten; „Trotzdem anlegen“ speichert danach ohne erneute Prüfung
  const [checked, setChecked] = useState<{ matches: DuplicateMatch[]; values: string } | null>(null)
  const form = useForm<GuestInput>({
    resolver: zodResolver(guestSchema(tv), undefined, { raw: true }),
    defaultValues: guest ? guestInput(guest) : EMPTY_GUEST_INPUT,
  })

  // Die Warnung gilt nur für die geprüften Werte; nach einer Änderung wird beim nächsten Speichern neu geprüft
  const current = JSON.stringify(useWatch({ control: form.control }))
  const duplicates = checked && checked.values === current ? checked.matches : null

  async function save(values: GuestInput, force = false) {
    setError(null)
    if (!guest && !force) {
      const check = await callAction(() => checkGuestDuplicates(values))
      if (check.ok && check.data && check.data.length > 0) {
        setChecked({ matches: check.data, values: JSON.stringify(values) })
        return
      }
    }
    const result = await callAction(() =>
      guest ? updateGuest({ id: guest.id, updatedAt: guest.updatedAt, ...values }) : createGuest(values)
    )
    if (!result.ok) {
      if (result.error === 'staleGuest') setStale(true)
      else setError(result.error)
      return
    }
    const name = guestDisplayName({ lastName: values.lastName.trim(), firstName: values.firstName.trim() || null })
    toast.success(guest ? t('done.saved') : t('done.created', { name }))
    onOpenChange(false)
    if (!guest && result.data && 'id' in result.data) router.push(guestHref(result.data.id))
    else router.refresh()
  }

  const submitting = form.formState.isSubmitting

  return (
    <DetailPanel
      open={open}
      onOpenChange={onOpenChange}
      title={guest ? t('panel.editTitle') : t('panel.createTitle')}
      eyebrow={guest ? guestDisplayName(guest) : undefined}
      description={guest ? undefined : t('panel.description')}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit((v) => save(v))} noValidate className="flex flex-col gap-6">
          <FormError error={error} namespace="guests.errors" />
          {stale && (
            <Alert role="alert" className="border-ds-accent-2-700/40 bg-ds-accent-2-100 text-ds-accent-2-800">
              <WarningCircle size={18} weight="duotone" aria-hidden="true" />
              <AlertDescription className="flex flex-col items-start gap-3">
                {t('stale.text')}
                {/* Neue Daten laden: Die Seite reicht den aktuellen Gast nach, das Panel startet mit dessen Werten */}
                <Button type="button" variant="outline" className="min-h-11" onClick={() => router.refresh()}>
                  {t('stale.reload')}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <GuestFields />

          {duplicates && (
            <Alert role="alert" className="border-ds-accent-700/40 bg-ds-accent-100">
              <WarningCircle size={18} weight="duotone" aria-hidden="true" />
              <AlertTitle>{t('duplicateWarning.title')}</AlertTitle>
              <AlertDescription className="flex flex-col gap-3">
                <p>{t('duplicateWarning.text')}</p>
                <ul className="flex flex-col gap-2">
                  {duplicates.map((m) => (
                    <li key={m.guest.id} className="flex flex-col">
                      <Link href={guestHref(m.guest.id)} className="font-medium text-ds-accent-700 underline underline-offset-[3px]">
                        {guestSortName(m.guest)}
                      </Link>
                      <span className="text-[13px] text-ds-neutral-800">
                        {countryName(m.guest.country, locale)} · {m.reasons.map((r) => t(`reason.${r}`)).join(', ')}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex flex-wrap gap-3">
                  <Button asChild variant="outline" className="min-h-11">
                    <Link href={guestHref(duplicates[0].guest.id)}>{t('duplicateWarning.open')}</Link>
                  </Button>
                  <Button
                    type="button"
                    className="min-h-11"
                    disabled={submitting}
                    onClick={form.handleSubmit((v) => save(v, true))}
                  >
                    {t('duplicateWarning.createAnyway')}
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {!duplicates && (
            <Button type="submit" disabled={submitting} aria-busy={submitting} className="min-h-11">
              {guest ? t('panel.save') : t('panel.createSubmit')}
            </Button>
          )}
        </form>
      </Form>
    </DetailPanel>
  )
}
