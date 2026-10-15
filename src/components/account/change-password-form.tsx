'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'

import { changePassword } from '@/app/(app)/konto/actions'
import { callAction, FormError } from '@/components/auth/form-error'
import { NewPasswordFields } from '@/components/auth/new-password-fields'
import { PasswordInput } from '@/components/auth/password-input'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import type { AuthErrorCode } from '@/lib/auth/result'
import { changePasswordSchema, type ChangePasswordValues } from '@/lib/validation/auth'

export function ChangePasswordForm({ email }: { email: string | null }) {
  const t = useTranslations('account')
  const ta = useTranslations('auth')
  const tv = useTranslations('auth.validation')
  const schema = useMemo(() => changePasswordSchema(tv), [tv])
  const form = useForm<ChangePasswordValues>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', password: '', passwordRepeat: '' },
  })
  const [error, setError] = useState<{ code: AuthErrorCode; minutes?: number } | null>(null)

  async function onSubmit(values: ChangePasswordValues) {
    setError(null)
    const result = await callAction(() => changePassword(values))
    if (!result.ok) {
      setError({ code: result.error, minutes: result.retryAfterMinutes })
      form.resetField('currentPassword')
      return
    }
    form.reset()
    toast.success(t('passwordSaved'))
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        <FormError error={error?.code ?? null} retryAfterMinutes={error?.minutes} />
        {email && <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />}
        <FormField
          control={form.control}
          name="currentPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{ta('passwordCurrent')}</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="current-password" className="min-h-11" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <NewPasswordFields control={form.control} />
        <Button type="submit" disabled={form.formState.isSubmitting} className="min-h-11 self-start">
          {t('savePassword')}
        </Button>
      </form>
    </Form>
  )
}
