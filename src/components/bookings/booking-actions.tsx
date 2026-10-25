'use client'

import { CheckCircle, NotePencil, PencilSimple, Prohibit, UsersThree } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'

import { confirmOption, saveBookingNote } from '@/app/(app)/buchungen/actions'
import { callAction, FormError } from '@/components/auth/form-error'
import { BlockPanel } from '@/components/bookings/block-panel'
import { BookingPanel } from '@/components/bookings/booking-panel'
import { CancelDialog } from '@/components/bookings/cancel-dialog'
import { CompanionsPanel } from '@/components/bookings/companions-panel'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { DetailPanel } from '@/components/detail-panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { amountInput, type BookableApartment, type Booking, bookingState, LIMITS } from '@/lib/bookings'

interface BookingActionsProps {
  booking: Booking
  apartments: BookableApartment[]
  owner: boolean
  today: string
}

type Dialog = 'edit' | 'note' | 'confirm' | 'confirmOverride' | 'cancel' | 'companions' | null

// Aktionen im Buchungs-Detail (PROJ-8). Aktive Einträge: Bearbeiten, Option bestätigen, Stornieren (Inhaber).
// Stornierte und verfallene: nur Notiz (Inhaber zusätzlich Stornogebühr); verfallene Optionen lassen sich bestätigen.
export function BookingActions({ booking, apartments, owner, today }: BookingActionsProps) {
  const t = useTranslations('bookings')
  const te = useTranslations('bookings.errors')
  const router = useRouter()
  const [dialog, setDialog] = useState<Dialog>(null)
  const close = (open: boolean) => !open && setDialog(null)
  const state = bookingState(booking, today)
  const isBlock = booking.kind === 'block'

  async function confirm(confirmOverride = false) {
    setDialog(null)
    const result = await callAction(() => confirmOption({ id: booking.id, confirmOverride }))
    if (!result.ok) {
      // Überschneidung oder Überbelegung: Inhaber dürfen bewusst trotzdem bestätigen
      if (result.error === 'warnings') setDialog('confirmOverride')
      else if (result.error !== 'sessionExpired') toast.error(te(result.error === 'ownerOnly' ? 'warnings' : result.error))
      return
    }
    toast.success(t('done.confirmed'))
    router.refresh()
  }

  return (
    <>
      <div className="flex flex-wrap gap-3">
        {state === 'active' ? (
          <Button className="min-h-11" onClick={() => setDialog('edit')}>
            <PencilSimple size={18} weight="bold" aria-hidden="true" />
            {t('detail.edit')}
          </Button>
        ) : (
          <Button variant="outline" className="min-h-11" onClick={() => setDialog('note')}>
            <NotePencil size={18} aria-hidden="true" />
            {t('detail.editNote')}
          </Button>
        )}
        {booking.kind === 'option' && state !== 'cancelled' && (
          <Button variant="outline" className="min-h-11" onClick={() => setDialog('confirm')}>
            <CheckCircle size={18} aria-hidden="true" />
            {t('detail.confirm')}
          </Button>
        )}
        {!isBlock && state === 'active' && (
          <Button variant="outline" className="min-h-11" onClick={() => setDialog('companions')}>
            <UsersThree size={18} aria-hidden="true" />
            {t('detail.editCompanions')}
          </Button>
        )}
        {owner && !isBlock && state !== 'cancelled' && (
          <Button variant="ghost" className="min-h-11 text-ds-accent-2-700" onClick={() => setDialog('cancel')}>
            <Prohibit size={18} aria-hidden="true" />
            {t('detail.cancel')}
          </Button>
        )}
      </div>

      {/* Neuer Schlüssel bei geänderter Fassung: „Aktuelle Fassung laden“ startet das Formular mit den neuen Werten */}
      {dialog === 'edit' &&
        (isBlock ? (
          <BlockPanel key={booking.updatedAt} open onOpenChange={close} apartments={apartments} block={booking} owner={owner} today={today} />
        ) : (
          <BookingPanel key={booking.updatedAt} open onOpenChange={close} apartments={apartments} booking={booking} owner={owner} today={today} />
        ))}
      {dialog === 'note' && <NotePanel key={booking.updatedAt} open onOpenChange={close} booking={booking} owner={owner} />}
      {dialog === 'companions' && <CompanionsPanel key={booking.updatedAt} open onOpenChange={close} booking={booking} today={today} />}
      {dialog === 'cancel' && <CancelDialog open onOpenChange={close} booking={booking} />}
      {dialog === 'confirm' && (
        <ConfirmDialog
          open
          onOpenChange={close}
          title={t('confirmOption.title', { number: booking.number ?? '' })}
          text={t('confirmOption.text')}
          confirmLabel={t('confirmOption.confirm')}
          cancelLabel={t('confirmOption.cancel')}
          onConfirm={() => confirm()}
        />
      )}
      {dialog === 'confirmOverride' && (
        <ConfirmDialog
          open
          onOpenChange={close}
          title={t('confirmOption.overrideTitle')}
          text={t('confirmOption.overrideText')}
          confirmLabel={t('confirmOption.overrideConfirm')}
          cancelLabel={t('confirmOption.cancel')}
          onConfirm={() => confirm(true)}
        />
      )}
    </>
  )
}

// Notiz (und beim Inhaber die Stornogebühr) eines nicht mehr aktiven Eintrags
function NotePanel({ open, onOpenChange, booking, owner }: { open: boolean; onOpenChange: (o: boolean) => void; booking: Booking; owner: boolean }) {
  const t = useTranslations('bookings')
  const router = useRouter()
  const withFee = owner && booking.cancelledAt !== null && booking.kind !== 'block'
  const [note, setNote] = useState(booking.note ?? '')
  const [fee, setFee] = useState(amountInput(booking.amounts?.cancellationFeeCents ?? null))
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function save(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const result = await callAction(() => saveBookingNote({ id: booking.id, updatedAt: booking.updatedAt, note, fee: withFee ? fee : undefined }))
    setPending(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    toast.success(t('done.saved'))
    onOpenChange(false)
    router.refresh()
  }

  return (
    <DetailPanel
      open={open}
      onOpenChange={onOpenChange}
      title={t('notePanel.title')}
      eyebrow={[t(`kind.${booking.kind}`), booking.number].filter(Boolean).join(' · ')}
      description={withFee ? t('notePanel.description') : t('notePanel.descriptionStaff')}
    >
      <form onSubmit={save} noValidate className="flex flex-col gap-6">
        <FormError error={error} namespace="bookings.errors" />
        <div className="flex flex-col gap-2">
          <Label htmlFor="notiz">{t('panel.note')}</Label>
          <Textarea id="notiz" rows={4} maxLength={LIMITS.noteMax} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        {withFee && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="stornogebuehr">{t('cancel.fee')}</Label>
            <Input id="stornogebuehr" inputMode="decimal" autoComplete="off" className="min-h-11 w-40" value={fee} onChange={(e) => setFee(e.target.value)} />
          </div>
        )}
        <Button type="submit" disabled={pending} aria-busy={pending} className="min-h-11">
          {t('notePanel.save')}
        </Button>
      </form>
    </DetailPanel>
  )
}
