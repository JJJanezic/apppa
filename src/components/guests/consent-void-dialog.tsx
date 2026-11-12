'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'

import { voidConsentEntry } from '@/app/(app)/gaeste/consent-actions'
import { callAction, FormError } from '@/components/auth/form-error'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Textarea } from '@/components/ui/textarea'
import { formatDate } from '@/lib/format'
import { CONSENT_LIMITS as L, type ConsentEntry } from '@/lib/marketing-consent'
import { type VoidInput, voidSchema } from '@/lib/validation/marketing-consent'

interface ConsentVoidDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  guestId: string
  entry: ConsentEntry
}

// Von Hand erfassten Eintrag als irrtümlich markieren (PROJ-19, nur Inhaber): Grund Pflicht, nicht rückgängig zu machen.
// Der Eintrag bleibt durchgestrichen im Verlauf und zählt nicht mehr für den Stand.
export function ConsentVoidDialog({ open, onOpenChange, guestId, entry }: ConsentVoidDialogProps) {
  const t = useTranslations('guests.consent.void')
  const tk = useTranslations('guests.consent.kind')
  const tv = useTranslations('guests.consent.validation')
  const router = useRouter()
  const schema = useMemo(() => voidSchema(tv), [tv])
  const form = useForm<VoidInput>({ resolver: zodResolver(schema, undefined, { raw: true }), defaultValues: { reason: '' } })
  const [error, setError] = useState<string | null>(null)
  const reason = useWatch({ control: form.control, name: 'reason' }) ?? ''

  async function submit(v: VoidInput) {
    setError(null)
    const result = await callAction(() => voidConsentEntry({ guestId, entryId: entry.id, reason: v.reason }))
    if (!result.ok) {
      if (result.error !== 'sessionExpired') setError(result.error)
      return
    }
    toast.success(t('done'))
    onOpenChange(false)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>
            {t('lead', { entry: tk(entry.kind), date: formatDate(entry.occurredOn) })}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(submit)} noValidate className="flex flex-col gap-5">
            <FormError error={error} namespace="guests.errors" />
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('reason')}</FormLabel>
                  <FormControl>
                    <Textarea rows={2} maxLength={L.voidReasonMax + 20} placeholder={t('reasonPlaceholder')} {...field} />
                  </FormControl>
                  <FormDescription>{t('reasonCount', { count: reason.length, max: L.voidReasonMax })}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="gap-3 sm:gap-2">
              <Button type="button" variant="ghost" className="min-h-11" onClick={() => onOpenChange(false)}>
                {t('cancel')}
              </Button>
              <Button type="submit" variant="destructive" className="min-h-11" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? t('saving') : t('confirm')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
