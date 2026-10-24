'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'

import { setNewPassword } from '@/app/(auth)/actions'
import { callAction, FormError } from '@/components/auth/form-error'
import { NewPasswordFields } from '@/components/auth/new-password-fields'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import type { AuthErrorCode } from '@/lib/auth/result'
import { newPasswordSchema, type NewPasswordValues } from '@/lib/validation/auth'

export function NewPasswordForm({ email }: { email?: string }) {
  const t = useTranslations('auth')
  const tv = useTranslations('auth.validation')
  const schema = useMemo(() => newPasswordSchema(tv), [tv])
  const form = useForm<NewPasswordValues>({ resolver: zodResolver(schema), defaultValues: { password: '', passwordRepeat: '' } })
  const [error, setError] = useState<AuthErrorCode | null>(null)

  async function onSubmit(values: NewPasswordValues) {
    setError(null)
    const result = await callAction(() => setNewPassword(values))
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
        {email && <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />}
        <NewPasswordFields control={form.control} />
        <Button type="submit" disabled={form.formState.isSubmitting} className="min-h-11">
          {t('newPassword.submit')}
        </Button>
      </form>
    </Form>
  )
}
