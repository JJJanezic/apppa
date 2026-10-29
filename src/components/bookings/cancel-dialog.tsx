'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { cancelBooking } from '@/app/(app)/buchungen/actions'
import { AmountInput } from '@/components/amount-input'
import { callAction, FormError } from '@/components/auth/form-error'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Textarea } from '@/components/ui/textarea'
import { useVatStatus } from '@/components/vat/vat-status-context'
import { VatRateInput } from '@/components/vat/vat-rate-input'
import { type Booking, LIMITS, todayIso } from '@/lib/bookings'
import { type CancelInput, cancelSchema } from '@/lib/validation/bookings'
import { VAT_DEFAULTS, vatRateInput } from '@/lib/vat'
import { vatStatusOn } from '@/lib/vat-status'

interface CancelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  booking: Booking
  // Im Kalender-Panel (PROJ-9): danach dorthin (Panel schließt), sonst Seite erneuern
  afterCancelHref?: string
}

// Stornieren (nur Inhaber): optional Grund und Stornogebühr, danach nicht mehr aktivierbar
export function CancelDialog({ open, onOpenChange, booking, afterCancelHref }: CancelDialogProps) {
  const t = useTranslations('bookings.cancel')
  const tv = useTranslations('bookings.validation')
  const td = useTranslations('bookings.done')
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const form = useForm<CancelInput>({
    resolver: zodResolver(cancelSchema(tv), undefined, { raw: true }),
    defaultValues: { reason: '', fee: '', feeVat: vatRateInput(VAT_DEFAULTS.cancellationFee) },
  })
  // Storniert wird heute: Kleinunternehmer am heutigen Tag → kein Satz-Feld, gespeichert wird 0,00 (PROJ-35/36)
  const showVat = !vatStatusOn(useVatStatus(), todayIso()).smallBusiness

  async function cancel(values: CancelInput) {
    setError(null)
    const result = await callAction(() => cancelBooking({ id: booking.id, values }))
    if (!result.ok) {
      setError(result.error)
      return
    }
    toast.success(td('cancelled'))
    onOpenChange(false)
    if (afterCancelHref) router.replace(afterCancelHref, { scroll: false })
    else router.refresh()
  }

  const submitting = form.formState.isSubmitting

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title', { number: booking.number ?? '' })}</DialogTitle>
          <DialogDescription>{t('text')}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(cancel)} noValidate className="flex flex-col gap-4">
            <FormError error={error} namespace="bookings.errors" />
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('reason')}</FormLabel>
                  <FormControl>
                    <Textarea rows={2} maxLength={LIMITS.cancelReasonMax} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex flex-wrap items-start gap-3">
              <FormField
                control={form.control}
                name="fee"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('fee')}</FormLabel>
                    <FormControl>
                      <AmountInput className="min-h-11 w-40" {...field} onValueChange={field.onChange} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {showVat && (
                <FormField
                  control={form.control}
                  name="feeVat"
                  render={({ field }) => (
                    <FormItem className="w-28">
                      <FormLabel>{t('feeVat')}</FormLabel>
                      <FormControl>
                        <VatRateInput className="min-h-11" {...field} onValueChange={field.onChange} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" className="min-h-11" onClick={() => onOpenChange(false)}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={submitting} aria-busy={submitting} className="min-h-11">
                {t('confirm')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
