'use client'

import { WarningCircle } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useFormatter, useLocale, useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

import { loadGuest, mergeGuests } from '@/app/(app)/gaeste/actions'
import { callAction, FormError } from '@/components/auth/form-error'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { GuestPicker } from '@/components/guests/guest-picker'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  countryName,
  defaultMergeChoice,
  DOCUMENT_SIDES,
  type Guest,
  guestDisplayName,
  guestHref,
  languageName,
  MERGE_FIELDS,
  type MergeChoice,
  type MergeField,
  sameMergeValue,
} from '@/lib/guests'

interface MergeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Gast A bleibt bestehen; Gast B wird entfernt (seine Aufenthalte gehen auf A über)
  guest: Guest
  // Vorgewählter zweiter Gast (aus „Mögliche Dubletten“); sonst wählt der Inhaber per Suche
  presetOtherId?: string
}

// Dialog „Gäste zusammenführen“ (PROJ-7, nur Inhaber): je Angabe wählen, welcher Wert bleibt
export function MergeDialog({ open, onOpenChange, guest, presetOtherId }: MergeDialogProps) {
  const t = useTranslations('guests')
  const tm = useTranslations('guests.marketing')
  const tg = useTranslations('guests.gender')
  const tdt = useTranslations('guests.documentType')
  const format = useFormatter()
  const locale = useLocale()
  const router = useRouter()
  const [other, setOther] = useState<Guest | null>(null)
  const [loading, setLoading] = useState(false)
  const [choice, setChoice] = useState<MergeChoice | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [pending, setPending] = useState(false)

  async function pick(id: string) {
    setError(null)
    setLoading(true)
    const result = await callAction(() => loadGuest({ id }))
    setLoading(false)
    if (!result.ok || !result.data) {
      setError(result.ok ? 'unknown' : result.error)
      return
    }
    setOther(result.data)
    setChoice(defaultMergeChoice(guest, result.data))
  }

  // Aus „Mögliche Dubletten“: zweiten Gast gleich laden
  useEffect(() => {
    if (presetOtherId) void pick(presetOtherId)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nur beim Öffnen
  }, [presetOtherId])

  async function merge() {
    if (!other || !choice) return
    setConfirming(false)
    setPending(true)
    const result = await callAction(() => mergeGuests({ keepId: guest.id, removeId: other.id, choice }))
    setPending(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    toast.success(t('done.merged'))
    onOpenChange(false)
    router.push(guestHref(guest.id))
    router.refresh()
  }

  // Lesbarer Wert einer Angabe (mehrere Felder zusammengefasst)
  function display(g: Guest, field: MergeField): string {
    const join = (...parts: (string | null)[]) => parts.filter(Boolean).join(', ')
    switch (field) {
      case 'name':
        return guestDisplayName({ lastName: g.lastName, firstName: g.firstName })
      case 'titles':
        return join(g.titlePrefix, g.titleSuffix)
      case 'gender':
        return tg(g.gender)
      case 'country':
        return countryName(g.country, locale)
      case 'email':
        return g.email ? (g.emailSource === 'platform' ? `${g.email} (${t('detail.fromPlatform')})` : g.email) : ''
      case 'phone':
        return g.phone ? (g.phoneSource === 'platform' ? `${g.phone} (${t('detail.fromPlatform')})` : g.phone) : ''
      case 'language':
        return g.language ? languageName(g.language, locale) : ''
      case 'birthDate':
        return g.birthDate ? format.dateTime(new Date(`${g.birthDate}T12:00:00`), { day: 'numeric', month: 'long', year: 'numeric' }) : ''
      case 'address':
        return join(g.street, [g.postalCode, g.city].filter(Boolean).join(' ') || null, g.addressCountry ? countryName(g.addressCountry, locale) : null)
      case 'marketing':
        return g.marketingSource ? tm(g.marketingSource) : (g.marketingCustom ?? '')
      case 'company':
        return join(g.companyName, g.companyVatId, g.companyBillingAddress)
      case 'note':
        return g.note ?? ''
      case 'document': {
        const images = [g.documentFrontPath, g.documentBackPath].filter(Boolean).length
        return join(
          g.documentType ? tdt(g.documentType) : null,
          g.documentNumber,
          g.documentIssuedOn ? format.dateTime(new Date(`${g.documentIssuedOn}T12:00:00`), { day: 'numeric', month: 'long', year: 'numeric' }) : null,
          g.documentAuthority,
          g.documentCountry ? countryName(g.documentCountry, locale) : null,
          images ? t('merge.documentImages', { count: images }) : null
        )
      }
    }
  }

  // Kleine Vorschauen der Ausweisbilder beim Reisedokument
  const thumbnails = (g: Guest) => {
    const images = DOCUMENT_SIDES.map((side) => g.documentImages[side]).filter((i) => i !== undefined)
    if (!images.length) return null
    return (
      <span className="mt-1 flex gap-2">
        {images.map((image) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={image.view} src={image.view} alt="" className="h-14 w-auto rounded border bg-ds-surface object-contain" />
        ))}
      </span>
    )
  }
  const valueOrDash = (value: string) => value || t('merge.empty')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">{t('merge.title')}</DialogTitle>
          <DialogDescription>{t('merge.description')}</DialogDescription>
        </DialogHeader>

        <FormError error={error} namespace="guests.errors" />

        {!other ? (
          loading ? (
            <p className="text-sm text-ds-neutral-700">{t('merge.loading')}</p>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold">{t('merge.pickLabel')}</p>
              <GuestPicker excludeId={guest.id} label={t('merge.pickLabel')} onSelect={(row) => pick(row.id)} />
            </div>
          )
        ) : (
          choice && (
            <div className="flex flex-col gap-5">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg bg-ds-surface p-3">
                  <p className="text-[13px] text-ds-neutral-700">{t('merge.guestA')}</p>
                  <p className="font-semibold">{guestDisplayName(guest)}</p>
                  <p className="text-[13px] text-ds-neutral-800">{t('merge.stays', { count: guest.stays.count })}</p>
                </div>
                <div className="rounded-lg bg-ds-surface p-3">
                  <p className="text-[13px] text-ds-neutral-700">{t('merge.guestB')}</p>
                  <p className="font-semibold">{guestDisplayName(other)}</p>
                  <p className="text-[13px] text-ds-neutral-800">{t('merge.stays', { count: other.stays.count })}</p>
                </div>
              </div>

              <ul className="flex flex-col gap-4">
                {MERGE_FIELDS.map((field) => (
                  <li key={field}>
                    {sameMergeValue(guest, other, field) ? (
                      <div className="flex flex-col gap-0.5">
                        <p className="text-sm font-semibold">{t(`merge.field.${field}`)}</p>
                        <p className="text-sm text-ds-neutral-800">
                          {valueOrDash(display(guest, field))} <span className="text-ds-neutral-700">({t('merge.same')})</span>
                        </p>
                      </div>
                    ) : (
                      <fieldset className="flex flex-col gap-2">
                        <legend className="mb-2 text-sm font-semibold">{t(`merge.field.${field}`)}</legend>
                        {field === 'document' && <p className="-mt-1 mb-1 text-[13px] text-ds-neutral-700">{t('merge.documentHint')}</p>}
                        <RadioGroup
                          value={choice[field]}
                          onValueChange={(v) => setChoice({ ...choice, [field]: v === 'b' ? 'b' : 'a' })}
                          className="grid gap-2 sm:grid-cols-2"
                        >
                          {(['a', 'b'] as const).map((side) => (
                            <div key={side} className="flex min-h-11 items-start gap-2 rounded-md border p-3">
                              <RadioGroupItem value={side} id={`merge-${field}-${side}`} className="mt-0.5" />
                              <Label htmlFor={`merge-${field}-${side}`} className="flex cursor-pointer flex-col gap-0.5 font-normal">
                                <span className="text-[12px] text-ds-neutral-700">{side === 'a' ? t('merge.guestA') : t('merge.guestB')}</span>
                                <span className="break-words">{valueOrDash(display(side === 'a' ? guest : other, field))}</span>
                                {field === 'document' && thumbnails(side === 'a' ? guest : other)}
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
                <AlertDescription>{t('merge.irreversible')}</AlertDescription>
              </Alert>
            </div>
          )
        )}

        <DialogFooter className="gap-3 sm:gap-2">
          {other && !presetOtherId && (
            <Button type="button" variant="ghost" className="min-h-11" disabled={pending} onClick={() => setOther(null)}>
              {t('merge.change')}
            </Button>
          )}
          <Button type="button" variant="outline" className="min-h-11" onClick={() => onOpenChange(false)}>
            {t('merge.cancel')}
          </Button>
          {other && (
            <Button type="button" className="min-h-11" disabled={pending} aria-busy={pending} onClick={() => setConfirming(true)}>
              {t('merge.submit')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>

      {other && confirming && (
        <ConfirmDialog
          open
          onOpenChange={(next) => !next && setConfirming(false)}
          title={t('merge.confirmTitle')}
          text={t('merge.confirmText', { removed: guestDisplayName(other), kept: guestDisplayName(guest) })}
          confirmLabel={t('merge.submit')}
          cancelLabel={t('merge.cancel')}
          onConfirm={merge}
        />
      )}
    </Dialog>
  )
}
