'use client'

import { useTranslations } from 'next-intl'
import type { Control, FieldValues, Path } from 'react-hook-form'
import { useWatch } from 'react-hook-form'

import { PasswordInput } from '@/components/auth/password-input'
import { PasswordRules } from '@/components/auth/password-rules'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'

interface NewPasswordFieldsProps<T extends FieldValues> {
  control: Control<T>
  label?: string
}

// Neues Passwort + Wiederholung mit sichtbaren Regeln (Einladung, Reset, Mein Konto)
export function NewPasswordFields<T extends FieldValues & { password: string; passwordRepeat: string }>({
  control,
  label,
}: NewPasswordFieldsProps<T>) {
  const t = useTranslations('auth')
  const value = (useWatch({ control, name: 'password' as Path<T> }) as string | undefined) ?? ''

  return (
    <>
      <FormField
        control={control}
        name={'password' as Path<T>}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{label ?? t('passwordNew')}</FormLabel>
            <FormControl>
              <PasswordInput autoComplete="new-password" aria-describedby="passwort-regeln" className="min-h-11" {...field} />
            </FormControl>
            <PasswordRules id="passwort-regeln" value={value} />
            <FormMessage />
          </FormItem>
        )}
      />
      <FormField
        control={control}
        name={'passwordRepeat' as Path<T>}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('passwordRepeat')}</FormLabel>
            <FormControl>
              <PasswordInput autoComplete="new-password" className="min-h-11" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  )
}
