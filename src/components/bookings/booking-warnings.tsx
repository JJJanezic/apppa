'use client'

import { WarningCircle } from '@phosphor-icons/react'
import { useFormatter, useTranslations } from 'next-intl'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import type { BookingWarnings, Conflict, GuestSheetDuplicate } from '@/lib/bookings'

export const hasWarnings = (w: BookingWarnings | null): w is BookingWarnings =>
  w !== null && (w.conflicts.length > 0 || w.overCapacity !== null)

interface BookingWarningsAlertProps {
  warnings: BookingWarnings
  owner: boolean
  override: boolean
  onOverrideChange: (value: boolean) => void
}

// Warnbereich bei Überschneidung oder Überbelegung (PROJ-8): Inhaber bestätigen „Trotzdem speichern“,
// für Mitarbeiter ist Speichern gesperrt
export function BookingWarningsAlert({ warnings, owner, override, onOverrideChange }: BookingWarningsAlertProps) {
  const t = useTranslations('bookings')
  const format = useFormatter()
  const day = (iso: string) => format.dateTime(new Date(`${iso}T12:00:00`), { day: 'numeric', month: 'short', year: 'numeric' })
  const what = (c: Conflict) =>
    c.kind === 'block'
      ? `${t('kind.block')}${c.blockReason ? `: ${t(`blockReason.${c.blockReason}`)}` : ''}`
      : [t(`kind.${c.kind}`), c.number, c.guestName].filter(Boolean).join(' · ')

  return (
    <Alert role="alert" className="border-ds-accent-2-700/40 bg-ds-accent-2-100 text-ds-accent-2-800">
      <WarningCircle size={18} weight="duotone" aria-hidden="true" />
      <AlertTitle>{t('warnings.title')}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3 text-ds-accent-2-800">
        <ul className="flex list-disc flex-col gap-1 pl-5">
          {warnings.conflicts.map((c) => (
            <li key={c.id}>{t('warnings.conflict', { what: what(c), from: day(c.arrival), to: day(c.departure) })}</li>
          ))}
          {warnings.overCapacity && warnings.overCapacity.persons > warnings.overCapacity.maxGuests && (
            <li>{t('warnings.capacity', { persons: warnings.overCapacity.persons, max: warnings.overCapacity.maxGuests })}</li>
          )}
          {warnings.overCapacity && warnings.overCapacity.maxAdults !== null && warnings.overCapacity.adults > warnings.overCapacity.maxAdults && (
            <li>{t('warnings.capacityAdults', { adults: warnings.overCapacity.adults, max: warnings.overCapacity.maxAdults })}</li>
          )}
        </ul>
        {owner ? (
          <div className="flex items-start gap-3">
            <Checkbox
              id="warnung-bestaetigen"
              checked={override}
              onCheckedChange={(v) => onOverrideChange(v === true)}
              className="mt-0.5 size-5"
            />
            <Label htmlFor="warnung-bestaetigen" className="flex flex-col items-start gap-0.5 font-normal leading-snug">
              <span className="font-semibold">{t('warnings.override')}</span>
              <span className="text-[13px]">{t('warnings.overrideHint')}</span>
            </Label>
          </div>
        ) : (
          <p>{t('warnings.staffBlocked')}</p>
        )}
      </AlertDescription>
    </Alert>
  )
}

export const hasGuestSheetDuplicates = (w: BookingWarnings | null): w is BookingWarnings => w !== null && w.guestSheetDuplicates.length > 0

interface GuestSheetWarningProps {
  duplicates: GuestSheetDuplicate[]
  confirmed: boolean
  onConfirmedChange: (value: boolean) => void
}

// Warnung „Gästeblattnummer bereits vergeben“ (PROJ-30): Inhaber und Mitarbeiter dürfen bewusst trotzdem speichern
export function GuestSheetWarning({ duplicates, confirmed, onConfirmedChange }: GuestSheetWarningProps) {
  const t = useTranslations('bookings')
  const what = (d: GuestSheetDuplicate) =>
    [t(`kind.${d.kind}`), d.number, d.guestName, d.cancelled ? t('state.cancelled') : null].filter(Boolean).join(' · ')

  return (
    <Alert role="alert" className="border-ds-accent-2-700/40 bg-ds-accent-2-100 text-ds-accent-2-800">
      <WarningCircle size={18} weight="duotone" aria-hidden="true" />
      <AlertTitle>{t('warnings.guestSheetTitle')}</AlertTitle>
      <AlertDescription className="flex flex-col gap-3 text-ds-accent-2-800">
        <p>{t('warnings.guestSheetText')}</p>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          {duplicates.map((d) => (
            <li key={d.id}>{what(d)}</li>
          ))}
        </ul>
        <div className="flex items-start gap-3">
          <Checkbox id="gaesteblatt-bestaetigen" checked={confirmed} onCheckedChange={(v) => onConfirmedChange(v === true)} className="mt-0.5 size-5" />
          <Label htmlFor="gaesteblatt-bestaetigen" className="flex flex-col items-start gap-0.5 font-normal leading-snug">
            <span className="font-semibold">{t('warnings.override')}</span>
            <span className="text-[13px]">{t('warnings.guestSheetHint')}</span>
          </Label>
        </div>
      </AlertDescription>
    </Alert>
  )
}
