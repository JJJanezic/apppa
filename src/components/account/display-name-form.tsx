'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { updateDisplayName } from '@/app/(app)/konto/actions'
import { callAction, FormError } from '@/components/auth/form-error'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { AuthErrorCode } from '@/lib/auth/result'
import { DISPLAY_NAME_MAX, displayNameSchema, type DisplayNameValues } from '@/lib/validation/auth'

interface DisplayNameFormProps {
  email: string | null
  displayName: string | null
}

export function DisplayNameForm({ email, displayName }: DisplayNameFormProps) {
  const t = useTranslations('account')
  const ta = useTranslations('auth')
  const tv = useTranslations('auth.validation')
  const router = useRouter()
  const schema = useMemo(() => displayNameSchema(tv), [tv])
  const form = useForm<DisplayNameValues>({ resolver: zodResolver(schema), defaultValues: { displayName: displayName ?? '' } })
  const [error, setError] = useState<AuthErrorCode | null>(null)

  async function onSubmit(values: DisplayNameValues) {
    setError(null)
    const result = await callAction(() => updateDisplayName(values))
    if (!result.ok) {
      setError(result.error)
      return
    }
    toast.success(t('nameSaved'))
    // Rahmen (Seitenleiste, Begrüßung) mit dem neuen Namen neu laden
    router.refresh()
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        <FormError error={error} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="konto-email">{t('emailLabel')}</Label>
          <Input id="konto-email" type="email" value={email ?? ''} readOnly disabled className="min-h-11" aria-describedby="konto-email-hinweis" />
          <p id="konto-email-hinweis" className="text-sm text-ds-neutral-700">
            {t('emailHint')}
          </p>
        </div>
        <FormField
          control={form.control}
          name="displayName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{ta('displayName')}</FormLabel>
              <FormControl>
                <Input autoComplete="name" maxLength={DISPLAY_NAME_MAX} className="min-h-11" {...field} />
              </FormControl>
              <FormDescription>{ta('displayNameHint')}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={form.formState.isSubmitting} className="min-h-11 self-start">
          {t('saveName')}
        </Button>
      </form>
    </Form>
  )
}
