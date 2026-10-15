import { z } from 'zod'

// Prüfregeln der Anmelde-Formulare (PROJ-3). Werden im Browser und in den Server-Aktionen genutzt.
// Fehlermeldungen kommen als übersetzte Texte über `t` (messages/de.json, Bereich „auth.validation“).

type T = (key: string) => string

// Passwortregel aus PROJ-1 (supabase/config.toml): mind. 10 Zeichen, a-z, A-Z, 0-9
export const PASSWORD_RULES = [
  { key: 'minLength', test: (v: string) => v.length >= 10 },
  { key: 'lower', test: (v: string) => /[a-z]/.test(v) },
  { key: 'upper', test: (v: string) => /[A-Z]/.test(v) },
  { key: 'digit', test: (v: string) => /[0-9]/.test(v) },
] as const

export const DISPLAY_NAME_MAX = 200
export const OTP_LENGTH = 6

// E-Mail-Adressen ohne Leerzeichen am Rand und in Kleinbuchstaben vergleichen
export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

// Vorname für die Begrüßung: erstes Wort des Anzeigenamens
export function firstNameOf(displayName: string | null | undefined): string | null {
  const first = displayName?.trim().split(/\s+/)[0]
  return first ? first : null
}

const email = (t: T) =>
  z
    .string()
    .trim()
    .min(1, t('emailRequired'))
    .pipe(z.email(t('emailInvalid')))
    .transform(normalizeEmail)

const newPassword = (t: T) =>
  z.string().superRefine((value, ctx) => {
    for (const rule of PASSWORD_RULES) {
      if (!rule.test(value)) {
        ctx.addIssue({ code: 'custom', message: t('passwordRules') })
        return
      }
    }
  })

const passwordPair = (t: T) =>
  z
    .object({ password: newPassword(t), passwordRepeat: z.string() })
    .refine((v) => v.password === v.passwordRepeat, { path: ['passwordRepeat'], message: t('passwordMismatch') })

const displayName = (t: T) =>
  z.string().trim().min(1, t('nameRequired')).max(DISPLAY_NAME_MAX, t('nameTooLong'))

export const loginSchema = (t: T) =>
  z.object({ email: email(t), password: z.string().min(1, t('passwordRequired')) })

export const forgotPasswordSchema = (t: T) => z.object({ email: email(t) })

export const newPasswordSchema = passwordPair

export const completeInviteSchema = (t: T) =>
  z.object({ displayName: displayName(t) }).and(passwordPair(t))

export const displayNameSchema = (t: T) => z.object({ displayName: displayName(t) })

export const changePasswordSchema = (t: T) =>
  z.object({ currentPassword: z.string().min(1, t('passwordRequired')) }).and(passwordPair(t))

export const otpSchema = (t: T) =>
  z.object({ code: z.string().regex(new RegExp(`^\\d{${OTP_LENGTH}}$`), t('codeInvalid')) })

export type LoginValues = z.infer<ReturnType<typeof loginSchema>>
export type ForgotPasswordValues = z.infer<ReturnType<typeof forgotPasswordSchema>>
export type NewPasswordValues = z.infer<ReturnType<typeof newPasswordSchema>>
export type CompleteInviteValues = z.infer<ReturnType<typeof completeInviteSchema>>
export type DisplayNameValues = z.infer<ReturnType<typeof displayNameSchema>>
export type ChangePasswordValues = z.infer<ReturnType<typeof changePasswordSchema>>
export type OtpValues = z.infer<ReturnType<typeof otpSchema>>
