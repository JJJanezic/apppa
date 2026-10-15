'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'

import { callAction, FormError } from '@/components/auth/form-error'
import { OtpInput } from '@/components/auth/otp-input'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import type { ActionResult, AuthErrorCode } from '@/lib/auth/result'
import { otpSchema, type OtpValues } from '@/lib/validation/auth'

interface OtpFormProps {
  submitLabel: string
  onSubmitCode: (code: string) => Promise<ActionResult>
  onSuccess: (result: ActionResult) => void
}

// Code-Eingabe mit Absenden (Code-Abfrage beim Login, Einrichtung eines Geräts)
export function OtpForm({ submitLabel, onSubmitCode, onSuccess }: OtpFormProps) {
  const t = useTranslations('auth')
  const tv = useTranslations('auth.validation')
  const schema = useMemo(() => otpSchema(tv), [tv])
  const form = useForm<OtpValues>({ resolver: zodResolver(schema), defaultValues: { code: '' } })
  const [error, setError] = useState<{ code: AuthErrorCode; minutes?: number } | null>(null)

  async function onSubmit(values: OtpValues) {
    setError(null)
    const result = await callAction(() => onSubmitCode(values.code))
    if (result.ok) {
      onSuccess(result)
      return
    }
    setError({ code: result.error, minutes: result.retryAfterMinutes })
    form.resetField('code')
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        <FormError error={error?.code ?? null} retryAfterMinutes={error?.minutes} />
        <FormField
          control={form.control}
          name="code"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('mfa.code')}</FormLabel>
              <FormControl>
                <OtpInput value={field.value} onChange={field.onChange} />
              </FormControl>
              <FormDescription>{t('mfa.clockHint')}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" disabled={form.formState.isSubmitting} className="min-h-11">
          {submitLabel}
        </Button>
      </form>
    </Form>
  )
}
