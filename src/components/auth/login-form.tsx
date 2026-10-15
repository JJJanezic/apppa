'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'

import { signIn } from '@/app/(auth)/actions'
import { callAction, FormError } from '@/components/auth/form-error'
import { PasswordInput } from '@/components/auth/password-input'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import type { AuthErrorCode } from '@/lib/auth/result'
import { loginSchema, type LoginValues } from '@/lib/validation/auth'

interface LoginFormProps {
  next?: string
}

export function LoginForm({ next }: LoginFormProps) {
  const t = useTranslations('auth')
  const tv = useTranslations('auth.validation')
  const schema = useMemo(() => loginSchema(tv), [tv])
  const form = useForm<LoginValues>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } })
  const [error, setError] = useState<{ code: AuthErrorCode; minutes?: number } | null>(null)

  async function onSubmit(values: LoginValues) {
    setError(null)
    const result = await callAction(() => signIn({ ...values, next }))
    if (result.ok) {
      // Vollständiger Seitenwechsel, damit die neue Sitzung überall gilt
      window.location.href = result.redirectTo ?? '/'
      return
    }
    setError({ code: result.error, minutes: result.retryAfterMinutes })
    form.resetField('password')
  }

  const pending = form.formState.isSubmitting

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        <FormError error={error?.code ?? null} retryAfterMinutes={error?.minutes} />
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('email')}</FormLabel>
              <FormControl>
                <Input type="email" autoComplete="username" inputMode="email" className="min-h-11" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-baseline justify-between gap-2">
                <FormLabel>{t('password')}</FormLabel>
                <Link href="/passwort-vergessen" className="text-sm text-ds-accent-700 underline-offset-[3px] hover:underline">
                  {t('login.forgot')}
                </Link>
              </div>
              <FormControl>
                <PasswordInput autoComplete="current-password" className="min-h-11" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={pending} aria-busy={pending} className="min-h-11">
          {t('login.submit')}
        </Button>
      </form>
    </Form>
  )
}
