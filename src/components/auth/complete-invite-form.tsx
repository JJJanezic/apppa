'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'

import { completeInvite } from '@/app/(auth)/actions'
import { callAction, FormError } from '@/components/auth/form-error'
import { NewPasswordFields } from '@/components/auth/new-password-fields'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import type { AuthErrorCode } from '@/lib/auth/result'
import { completeInviteSchema, type CompleteInviteValues, DISPLAY_NAME_MAX } from '@/lib/validation/auth'

export function CompleteInviteForm({ email }: { email?: string }) {
  const t = useTranslations('auth')
  const tv = useTranslations('auth.validation')
  const schema = useMemo(() => completeInviteSchema(tv), [tv])
  const form = useForm<CompleteInviteValues>({
    resolver: zodResolver(schema),
    defaultValues: { displayName: '', password: '', passwordRepeat: '' },
  })
  const [error, setError] = useState<AuthErrorCode | null>(null)

  async function onSubmit(values: CompleteInviteValues) {
    setError(null)
    const result = await callAction(() => completeInvite(values))
    if (result.ok) {
      window.location.assign(result.redirectTo ?? '/')
      return
    }
    setError(result.error)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        <FormError error={error} />
        {/* Für Passwortmanager: zu welchem Konto das neue Passwort gehört */}
        {email && <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />}
        <FormField
          control={form.control}
          name="displayName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('displayName')}</FormLabel>
              <FormControl>
                <Input autoComplete="name" maxLength={DISPLAY_NAME_MAX} className="min-h-11" {...field} />
              </FormControl>
              <FormDescription>{t('displayNameHint')}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <NewPasswordFields control={form.control} label={t('password')} />
        <Button type="submit" disabled={form.formState.isSubmitting} className="min-h-11">
          {t('invite.submit')}
        </Button>
      </form>
    </Form>
  )
}
