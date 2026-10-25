'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Trash, WarningCircle } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'

import { deleteBlock, saveBlock } from '@/app/(app)/buchungen/actions'
import { callAction, FormError } from '@/components/auth/form-error'
import { BookingWarningsAlert, hasWarnings } from '@/components/bookings/booking-warnings'
import { useBookingWarnings } from '@/components/bookings/use-booking-warnings'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { DetailPanel } from '@/components/detail-panel'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { addDays, BLOCK_REASONS, type BookableApartment, type Booking, bookingHref, isIsoDate, LIMITS } from '@/lib/bookings'
import { type BlockInput, blockSchema } from '@/lib/validation/bookings'

interface BlockPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  apartments: BookableApartment[]
  // Bearbeiten: die Sperre; Anlegen: null
  block: Booking | null
  owner: boolean
  today: string
}

// Detail-Panel „Neue Sperre / Sperre bearbeiten“ (PROJ-8): Wohnung, Zeitraum, Grund. Dieselbe Konfliktprüfung
// wie bei Buchungen; löschen darf nur der Inhaber.
export function BlockPanel({ open, onOpenChange, apartments, block, owner, today }: BlockPanelProps) {
  const t = useTranslations('bookings')
  const tv = useTranslations('bookings.validation')
  const te = useTranslations('bookings.errors')
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const [override, setOverride] = useState<{ version: string } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const active = apartments.filter((a) => !a.archived)

  const form = useForm<BlockInput>({
    resolver: zodResolver(blockSchema(tv, { today }), undefined, { raw: true }),
    defaultValues: block
      ? { apartmentId: block.apartment.id, arrival: block.arrival, departure: block.departure, reason: block.blockReason ?? 'other', note: block.note ?? '' }
      : { apartmentId: active.length === 1 ? active[0].id : '', arrival: '', departure: '', reason: 'owner_use', note: '' },
  })
  const [apartmentId, arrival, departure, reason] = useWatch({ control: form.control, name: ['apartmentId', 'arrival', 'departure', 'reason'] })
  const { warnings, version } = useBookingWarnings({ id: block?.id ?? null, apartmentId, arrival, departure, persons: 0 })
  const warn = hasWarnings(warnings)
  const overrideOk = owner && override?.version === version
  const options = apartments.filter((a) => !a.archived || a.id === block?.apartment.id)

  async function save(values: BlockInput) {
    setError(null)
    if (warn && !overrideOk) return
    const result = await callAction(() => saveBlock({ id: block?.id, updatedAt: block?.updatedAt, values, confirmOverride: overrideOk }))
    if (!result.ok) {
      if (result.error === 'staleBooking') setStale(true)
      else setError(result.error)
      return
    }
    toast.success(t('done.blockSaved'))
    onOpenChange(false)
    if (!block && result.data) router.push(bookingHref(result.data.id))
    else router.refresh()
  }

  async function remove() {
    if (!block) return
    setConfirmDelete(false)
    const result = await callAction(() => deleteBlock({ id: block.id }))
    if (!result.ok) {
      if (result.error !== 'sessionExpired') toast.error(te(result.error))
      return
    }
    toast.success(t('done.blockDeleted'))
    window.location.assign('/buchungen')
  }

  const submitting = form.formState.isSubmitting

  return (
    <DetailPanel
      open={open}
      onOpenChange={onOpenChange}
      title={block ? t('block.editTitle') : t('block.createTitle')}
      description={block ? undefined : t('block.description')}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(save)} noValidate className="flex flex-col gap-6">
          <FormError error={error} namespace="bookings.errors" />
          {stale && (
            <Alert role="alert" className="border-ds-accent-2-700/40 bg-ds-accent-2-100 text-ds-accent-2-800">
              <WarningCircle size={18} weight="duotone" aria-hidden="true" />
              <AlertDescription className="flex flex-col items-start gap-3">
                {t('stale.text')}
                <Button type="button" variant="outline" className="min-h-11" onClick={() => router.refresh()}>
                  {t('stale.reload')}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <FormField
            control={form.control}
            name="apartmentId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('panel.apartment')}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="min-h-11">
                      <SelectValue placeholder={t('panel.apartmentPlaceholder')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {options.map((a) => (
                      <SelectItem key={a.id} value={a.id} className="min-h-11">
                        {a.archived ? t('panel.archived', { label: a.label }) : a.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="arrival"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('block.from')}</FormLabel>
                  <FormControl>
                    <Input type="date" className="min-h-11" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="departure"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('block.to')}</FormLabel>
                  <FormControl>
                    <Input type="date" min={isIsoDate(arrival) ? addDays(arrival, 1) : undefined} className="min-h-11" {...field} />
                  </FormControl>
                  <FormDescription>{t('block.toHint')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="reason"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('block.reason')}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="min-h-11">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {BLOCK_REASONS.map((r) => (
                      <SelectItem key={r} value={r} className="min-h-11">
                        {t(`blockReason.${r}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="note"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('block.note')}</FormLabel>
                <FormControl>
                  <Textarea rows={3} maxLength={LIMITS.noteMax} {...field} />
                </FormControl>
                {reason === 'other' && <FormDescription>{t('block.noteHintOther')}</FormDescription>}
                <FormMessage />
              </FormItem>
            )}
          />

          {warn && (
            <BookingWarningsAlert
              warnings={warnings}
              owner={owner}
              override={overrideOk}
              onOverrideChange={(v) => setOverride(v ? { version } : null)}
            />
          )}

          <Button type="submit" disabled={submitting || (warn && !overrideOk)} aria-busy={submitting} className="min-h-11">
            {t('block.save')}
          </Button>
          {block && owner && (
            <Button type="button" variant="ghost" className="min-h-11 text-ds-accent-2-700" onClick={() => setConfirmDelete(true)}>
              <Trash size={18} aria-hidden="true" />
              {t('detail.deleteBlock')}
            </Button>
          )}
        </form>
      </Form>
      {confirmDelete && (
        <ConfirmDialog
          open
          onOpenChange={setConfirmDelete}
          title={t('block.deleteTitle')}
          text={t('block.deleteText')}
          confirmLabel={t('block.deleteConfirm')}
          cancelLabel={t('block.cancel')}
          onConfirm={remove}
        />
      )}
    </DetailPanel>
  )
}
