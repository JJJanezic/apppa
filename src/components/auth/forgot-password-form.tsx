'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { EnvelopeSimple } from '@phosphor-icons/react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'

import { requestPasswordReset } from '@/app/(auth)/actions'
import { callAction, FormError } from '@/components/auth/form-error'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import type { AuthErrorCode } from '@/lib/auth/result'
import { forgotPasswordSchema, type ForgotPasswordValues } from '@/lib/validation/auth'

export function ForgotPasswordForm({ defaultEmail = '' }: { defaultEmail?: string }) {
  const t = useTranslations('auth')
  const tv = useTranslations('auth.validation')
  const schema = useMemo(() => forgotPasswordSchema(tv), [tv])
  const form = useForm<ForgotPasswordValues>({ resolver: zodResolver(schema), defaultValues: { email: defaultEmail } })
  const [error, setError] = useState<AuthErrorCode | null>(null)
  const [sent, setSent] = useState(false)

  async function onSubmit(values: ForgotPasswordValues) {
    setError(null)
    const result = await callAction(() => requestPasswordReset(values))
    // Neutral: Erfolg zeigt immer dieselbe Bestätigung, egal ob das Konto existiert
    if (result.ok) setSent(true)
    else setError(result.error)
  }

  if (sent) {
    return (
      <div role="status" className="flex flex-col items-start gap-3 rounded-lg bg-ds-surface p-5">
        <EnvelopeSimple size={28} weight="duotone" aria-hidden="true" className="text-ds-accent-700" />
        <p>{t('forgot.sent')}</p>
        <p className="text-sm text-ds-neutral-700">{t('forgot.sentHint')}</p>
        <Link href="/anmelden" className="text-ds-accent-700 underline-offset-[3px] hover:underline">
          {t('forgot.back')}
        </Link>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        <FormError error={error} />
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
        <Button type="submit" disabled={form.formState.isSubmitting} className="min-h-11">
          {t('forgot.submit')}
        </Button>
        <Link href="/anmelden" className="text-sm text-ds-accent-700 underline-offset-[3px] hover:underline">
          {t('forgot.back')}
        </Link>
      </form>
    </Form>
  )
}
