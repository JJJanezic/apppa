'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { UserPlus } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { inviteOwner } from '@/app/(app)/betreiber/actions'
import { callAction, FormError } from '@/components/auth/form-error'
import { DetailPanel } from '@/components/detail-panel'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { ownerInviteSchema, type OwnerInviteInput, type OwnerInviteValues } from '@/lib/validation/operator'

// Knopf „Inhaber einladen“ mit Detail-Panel (nur E-Mail-Adresse; die Rolle ist immer Inhaber)
export function OwnerInvitePanel({ tenantId }: { tenantId: string }) {
  const t = useTranslations('operator')
  const tv = useTranslations('operator.validation')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const schema = useMemo(() => ownerInviteSchema(tv), [tv])
  const form = useForm<OwnerInviteInput, unknown, OwnerInviteValues>({ resolver: zodResolver(schema), defaultValues: { email: '' } })

  async function onSubmit(values: OwnerInviteValues) {
    setError(null)
    const result = await callAction(() => inviteOwner({ tenantId, ...values }))
    if (!result.ok && result.error !== 'mailFailed') {
      setError(result.error)
      return
    }
    // Einladung steht, nur die Mail fehlt: Panel schließen, Liste zeigt „Erneut senden“
    if (!result.ok) {
      toast.warning(t('errors.mailFailed'))
      form.reset()
      setOpen(false)
      router.refresh()
      return
    }
    toast.success(t('done.invited', { email: values.email }))
    form.reset()
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <Button variant="outline" className="min-h-11" onClick={() => setOpen(true)}>
        <UserPlus size={18} weight="bold" aria-hidden="true" />
        {t('inviteOwner')}
      </Button>
      <DetailPanel
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) {
            setError(null)
            form.reset()
          }
        }}
        title={t('invitePanel.title')}
        description={t('invitePanel.description')}
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
            <FormError error={error} namespace="operator.errors" />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('invitePanel.email')}</FormLabel>
                  <FormControl>
                    <Input type="email" inputMode="email" autoComplete="off" className="min-h-11" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" disabled={form.formState.isSubmitting} aria-busy={form.formState.isSubmitting} className="min-h-11">
              {t('invitePanel.submit')}
            </Button>
          </form>
        </Form>
      </DetailPanel>
    </>
  )
}
