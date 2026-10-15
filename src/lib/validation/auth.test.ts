import { describe, expect, it } from 'vitest'

import messages from '../../../messages/de.json'
import {
  changePasswordSchema,
  completeInviteSchema,
  displayNameSchema,
  firstNameOf,
  forgotPasswordSchema,
  loginSchema,
  newPasswordSchema,
  normalizeEmail,
  otpSchema,
  PASSWORD_RULES,
} from './auth'

const v = messages.auth.validation as Record<string, string>
const t = (key: string) => v[key] ?? key
const firstError = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.success ? null : result.error!.issues[0].message

describe('Anmelden', () => {
  it('normalisiert die E-Mail-Adresse (Leerzeichen, Großbuchstaben)', () => {
    const r = loginSchema(t).safeParse({ email: '  Johanna@Example.AT ', password: 'x' })
    expect(r.success && r.data.email).toBe('johanna@example.at')
  })

  it('meldet leere Felder und ungültige Adressen deutsch', () => {
    expect(firstError(loginSchema(t).safeParse({ email: '', password: 'x' }))).toBe(v.emailRequired)
    expect(firstError(loginSchema(t).safeParse({ email: 'keine-adresse', password: 'x' }))).toBe(v.emailInvalid)
    expect(firstError(loginSchema(t).safeParse({ email: 'a@b.at', password: '' }))).toBe(v.passwordRequired)
  })

  it('prüft beim Login keine Passwortregeln (alte Passwörter bleiben gültig)', () => {
    expect(loginSchema(t).safeParse({ email: 'a@b.at', password: 'kurz' }).success).toBe(true)
  })

  it('Passwort vergessen verlangt nur eine gültige Adresse', () => {
    expect(forgotPasswordSchema(t).safeParse({ email: 'a@b.at' }).success).toBe(true)
    expect(forgotPasswordSchema(t).safeParse({ email: 'a@' }).success).toBe(false)
  })
})

describe('Neues Passwort (Regel aus PROJ-1)', () => {
  it.each([
    ['zu kurz', 'Abcdef123'],
    ['ohne Großbuchstaben', 'abcdefgh12'],
    ['ohne Kleinbuchstaben', 'ABCDEFGH12'],
    ['ohne Ziffer', 'Abcdefghij'],
  ])('lehnt ab: %s', (_, password) => {
    expect(firstError(newPasswordSchema(t).safeParse({ password, passwordRepeat: password }))).toBe(v.passwordRules)
  })

  it('akzeptiert 10 Zeichen mit a-z, A-Z, 0-9', () => {
    expect(newPasswordSchema(t).safeParse({ password: 'Abcdefgh12', passwordRepeat: 'Abcdefgh12' }).success).toBe(true)
  })

  it('meldet unterschiedliche Wiederholung am zweiten Feld', () => {
    const r = newPasswordSchema(t).safeParse({ password: 'Abcdefgh12', passwordRepeat: 'Abcdefgh13' })
    expect(r.success).toBe(false)
    expect(r.error!.issues[0]).toMatchObject({ path: ['passwordRepeat'], message: v.passwordMismatch })
  })

  it('die Regel-Liste entspricht den Prüfungen', () => {
    expect(PASSWORD_RULES.map((r) => r.key)).toEqual(['minLength', 'lower', 'upper', 'digit'])
    expect(PASSWORD_RULES.every((r) => r.test('Abcdefgh12'))).toBe(true)
  })
})

describe('Einladung, Name, Konto, Code', () => {
  it('Einladung braucht Namen und gültiges Passwortpaar', () => {
    expect(completeInviteSchema(t).safeParse({ displayName: 'Johanna Pichler', password: 'Abcdefgh12', passwordRepeat: 'Abcdefgh12' }).success).toBe(true)
    expect(firstError(completeInviteSchema(t).safeParse({ displayName: '  ', password: 'Abcdefgh12', passwordRepeat: 'Abcdefgh12' }))).toBe(v.nameRequired)
  })

  it('Name höchstens 200 Zeichen', () => {
    expect(displayNameSchema(t).safeParse({ displayName: 'a'.repeat(200) }).success).toBe(true)
    expect(firstError(displayNameSchema(t).safeParse({ displayName: 'a'.repeat(201) }))).toBe(v.nameTooLong)
  })

  it('Passwort ändern braucht das aktuelle Passwort', () => {
    expect(firstError(changePasswordSchema(t).safeParse({ currentPassword: '', password: 'Abcdefgh12', passwordRepeat: 'Abcdefgh12' }))).toBe(v.passwordRequired)
  })

  it.each(['123456', '000000'])('akzeptiert Code %s', (code) => {
    expect(otpSchema(t).safeParse({ code }).success).toBe(true)
  })

  it.each(['12345', '1234567', '12a456', ''])('lehnt Code „%s“ ab', (code) => {
    expect(firstError(otpSchema(t).safeParse({ code }))).toBe(v.codeInvalid)
  })
})

describe('Hilfsfunktionen', () => {
  it.each([
    ['Johanna Pichler', 'Johanna'],
    ['  Mehmet   Yilmaz ', 'Mehmet'],
    ['Kerner', 'Kerner'],
    ['', null],
    [null, null],
  ])('Vorname aus „%s“ → %s', (name, expected) => {
    expect(firstNameOf(name)).toBe(expected)
  })

  it('normalizeEmail', () => {
    expect(normalizeEmail(' A@B.AT ')).toBe('a@b.at')
  })
})
