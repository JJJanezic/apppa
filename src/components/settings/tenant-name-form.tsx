'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { updateTenantName } from '@/app/(app)/einstellungen/actions'
import { callAction, FormError } from '@/components/auth/form-error'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { TENANT_NAME_MAX, tenantNameSchema, type TenantNameValues } from '@/lib/validation/team'

// Kundenname ändern (nur Inhaber); erscheint danach sofort in Seitenleiste bzw. „Mehr“
export function TenantNameForm({ name }: { name: string }) {
  const t = useTranslations('tenant')
  const tv = useTranslations('team.validation')
  const router = useRouter()
  const schema = useMemo(() => tenantNameSchema(tv), [tv])
  const form = useForm<TenantNameValues>({ resolver: zodResolver(schema), defaultValues: { name } })
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(values: TenantNameValues) {
    setError(null)
    const result = await callAction(() => updateTenantName(values))
    if (!result.ok) {
      setError(result.error)
      return
    }
    toast.success(t('saved'))
    router.refresh()
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex max-w-[640px] flex-col gap-5">
        <FormError error={error} namespace="team.errors" />
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('nameLabel')}</FormLabel>
              <FormControl>
                <Input maxLength={TENANT_NAME_MAX} autoComplete="organization" className="min-h-11" {...field} />
              </FormControl>
              <FormDescription>{t('nameHint')}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={form.formState.isSubmitting} className="min-h-11 self-start">
          {t('save')}
        </Button>
      </form>
    </Form>
  )
}
