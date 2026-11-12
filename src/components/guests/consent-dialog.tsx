'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'

import { prepareConsentReceiptUpload, recordConsent } from '@/app/(app)/gaeste/consent-actions'
import { callAction, FormError } from '@/components/auth/form-error'
import { DetailPanel } from '@/components/detail-panel'
import { ReceiptField } from '@/components/payments/receipt-field'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { formatDate } from '@/lib/format'
import { channelsFor, CONSENT_LIMITS as L, CONSENT_RECEIPT_BUCKET, type ConsentKind, type ConsentWarning } from '@/lib/marketing-consent'
import { type ConsentInput, consentSchema } from '@/lib/validation/marketing-consent'

interface ConsentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  guestId: string
  kind: ConsentKind
  birthDate: string | null
  today: string
  // Datum des jüngsten gültigen Eintrags: Hinweis schon im Formular, wenn das gewählte Datum davor liegt
  latestOn: string | null
}

// Erteilung oder Widerruf von Hand erfassen (PROJ-19): Datum (heute vorbelegt), Weg, Notiz, Beleg. „Mündlich/telefonisch“
// nur beim Widerruf. Liegt der Eintrag vor dem maßgeblichen Eintrag, meldet die Datenbank das; der Nutzer bestätigt.
export function ConsentDialog({ open, onOpenChange, guestId, kind, birthDate, today, latestOn }: ConsentDialogProps) {
  const t = useTranslations('guests.consent.dialog')
  const tc = useTranslations('guests.consent.channel')
  const tv = useTranslations('guests.consent.validation')
  const router = useRouter()
  const schema = useMemo(() => consentSchema(tv, { kind, today, birthDate }), [tv, kind, today, birthDate])
  const form = useForm<ConsentInput>({
    resolver: zodResolver(schema, undefined, { raw: true }),
    defaultValues: { occurredOn: today, channel: '', note: '', receiptPath: '' },
  })
  const [error, setError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<ConsentWarning[] | null>(null)
  const values = useWatch({ control: form.control }) as ConsentInput
  const grant = kind === 'grant'
  const before = Boolean(latestOn && values.occurredOn && values.occurredOn < latestOn)

  async function save(v: ConsentInput, confirmed: boolean) {
    setError(null)
    const result = await callAction(() => recordConsent({ guestId, kind, values: v, confirmed }))
    if (!result.ok) {
      if (result.error === 'consentDateInFuture') form.setError('occurredOn', { message: tv('dateInFuture') }, { shouldFocus: true })
      else if (result.error === 'consentDateBeforeBirth') form.setError('occurredOn', { message: tv('dateBeforeBirth') }, { shouldFocus: true })
      else if (result.error === 'consentChannelInvalid') form.setError('channel', { message: tv('channelRequired') }, { shouldFocus: true })
      else if (result.error !== 'sessionExpired') setError(result.error)
      return
    }
    if (result.data && 'warnings' in result.data) {
      setWarnings(result.data.warnings)
      return
    }
    setWarnings(null)
    toast.success(t(grant ? 'createdGrant' : 'createdRevoke'))
    onOpenChange(false)
    router.refresh()
  }

  const warningText = (w: ConsentWarning) =>
    t(`warn.${kind}Before${w.latestKind === 'grant' ? 'Grant' : 'Revoke'}`, { date: formatDate(w.latestOn) })

  return (
    <DetailPanel
      open={open}
      onOpenChange={onOpenChange}
      title={t(grant ? 'titleGrant' : 'titleRevoke')}
      description={t(grant ? 'leadGrant' : 'leadRevoke')}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit((v) => save(v, false))} noValidate className="flex min-w-0 flex-col gap-5">
          <FormError error={error} namespace="guests.errors" />

          <FormField
            control={form.control}
            name="occurredOn"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t(grant ? 'dateGrant' : 'dateRevoke')}</FormLabel>
                <FormControl>
                  <Input type="date" max={today} min={birthDate ?? undefined} className="min-h-11" {...field} />
                </FormControl>
                {before && <FormDescription>{t('beforeHint', { date: formatDate(latestOn ?? '') })}</FormDescription>}
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="channel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('channel')}</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="min-h-11">
                      <SelectValue placeholder={t('channelPlaceholder')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {channelsFor(kind).map((c) => (
                      <SelectItem key={c} value={c} className="min-h-11">
                        {tc(c)}
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
                <FormLabel>{t('note')}</FormLabel>
                <FormControl>
                  <Textarea rows={2} maxLength={L.noteMax + 20} placeholder={t('notePlaceholder')} {...field} value={field.value ?? ''} />
                </FormControl>
                <FormDescription>{t('noteCount', { count: (values.note ?? '').length, max: L.noteMax })}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="receiptPath"
            render={({ field }) => (
              <FormItem>
                <FormLabel htmlFor="einwilligung-beleg">{t('receipt')}</FormLabel>
                <ReceiptField
                  id="einwilligung-beleg"
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  bucket={CONSENT_RECEIPT_BUCKET}
                  prepareUpload={prepareConsentReceiptUpload}
                  textNamespace="guests.consent.receipt"
                />
                <FormDescription className={grant && !field.value ? 'text-ds-accent-2-700' : undefined}>
                  {grant && !field.value ? t('receiptMissingHint') : t('receiptHint')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex flex-wrap gap-3">
            <Button type="submit" className="min-h-11" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? t('saving') : t('save')}
            </Button>
            <Button type="button" variant="ghost" className="min-h-11" onClick={() => onOpenChange(false)}>
              {t('cancel')}
            </Button>
          </div>
        </form>
      </Form>

      <AlertDialog open={warnings !== null} onOpenChange={(o) => !o && setWarnings(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('warnTitle')}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="flex flex-col gap-1">
                {(warnings ?? []).map((w) => (
                  <p key={w.code}>{warningText(w)}</p>
                ))}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11">{t('warnBack')}</AlertDialogCancel>
            <AlertDialogAction className="min-h-11" onClick={() => void form.handleSubmit((v) => save(v, true))()}>
              {t('warnConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DetailPanel>
  )
}
