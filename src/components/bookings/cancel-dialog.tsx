'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { cancelBooking } from '@/app/(app)/buchungen/actions'
import { callAction, FormError } from '@/components/auth/form-error'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { type Booking, LIMITS } from '@/lib/bookings'
import { type CancelInput, cancelSchema } from '@/lib/validation/bookings'

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
    defaultValues: { reason: '', fee: '' },
  })

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
            <FormField
              control={form.control}
              name="fee"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('fee')}</FormLabel>
                  <FormControl>
                    <Input inputMode="decimal" autoComplete="off" className="min-h-11 w-40" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
