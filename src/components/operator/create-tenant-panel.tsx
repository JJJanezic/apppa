'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Plus } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { createTenant } from '@/app/(app)/betreiber/actions'
import { callAction, FormError } from '@/components/auth/form-error'
import { DetailPanel } from '@/components/detail-panel'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { tenantHref } from '@/lib/operator'
import { TENANT_NAME_MAX } from '@/lib/validation/team'
import { createTenantSchema, type CreateTenantInput, type CreateTenantValues } from '@/lib/validation/operator'

// Knopf „Kunde anlegen“ mit Detail-Panel: Kundenname + E-Mail des ersten Inhabers.
// Gibt es den Namen schon, erscheint ein Hinweis; ein zweiter Klick („Trotzdem anlegen“) legt trotzdem an.
export function CreateTenantPanel() {
  const t = useTranslations('operator')
  const tv = useTranslations('operator.validation')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [duplicate, setDuplicate] = useState(false)
  const schema = useMemo(() => createTenantSchema(tv), [tv])
  const form = useForm<CreateTenantInput, unknown, CreateTenantValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', email: '' },
  })

  async function onSubmit(values: CreateTenantValues) {
    setError(null)
    const result = await callAction(() => createTenant({ ...values, allowDuplicate: duplicate }))
    if (!result.ok) {
      if (result.error === 'duplicateName') setDuplicate(true)
      else setError(result.error)
      return
    }
    if (result.data?.mailFailed) toast.warning(t('done.createdMailFailed', { tenant: values.name }))
    else toast.success(t('done.created', { tenant: values.name, email: values.email }))
    reset()
    setOpen(false)
    router.push(result.data ? tenantHref(result.data.tenantId) : '/betreiber')
  }

  function reset() {
    setError(null)
    setDuplicate(false)
    form.reset()
  }

  return (
    <>
      <Button className="min-h-11" onClick={() => setOpen(true)}>
        <Plus size={18} weight="bold" aria-hidden="true" />
        {t('create')}
      </Button>
      <DetailPanel
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) reset()
        }}
        title={t('createPanel.title')}
        description={t('createPanel.description')}
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-6">
            <FormError error={error} namespace="operator.errors" />
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('createPanel.name')}</FormLabel>
                  <FormControl>
                    <Input
                      autoComplete="off"
                      maxLength={TENANT_NAME_MAX}
                      className="min-h-11"
                      {...field}
                      onChange={(e) => {
                        setDuplicate(false)
                        field.onChange(e)
                      }}
                    />
                  </FormControl>
                  <FormDescription>{t('createPanel.nameHint')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('createPanel.email')}</FormLabel>
                  <FormControl>
                    <Input type="email" inputMode="email" autoComplete="off" className="min-h-11" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {duplicate && (
              <Alert role="status" className="border-ds-accent-2-700/40 bg-ds-accent-2-100 text-ds-accent-2-800">
                <AlertDescription>{t('createPanel.duplicateHint')}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" disabled={form.formState.isSubmitting} aria-busy={form.formState.isSubmitting} className="min-h-11">
              {t(duplicate ? 'createPanel.submitDuplicate' : 'createPanel.submit')}
            </Button>
          </form>
        </Form>
      </DetailPanel>
    </>
  )
}
