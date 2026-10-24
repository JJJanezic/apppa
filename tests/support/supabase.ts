import { createHmac, randomUUID } from 'node:crypto'

import { expect, type Page } from '@playwright/test'
import { createServerClient } from '@supabase/ssr'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { SESSION_COOKIE, startSession } from '../../src/lib/auth/session-limits'
import type { Database } from '../../src/types/database'

// Testnutzer für die E2E-Tests in „apppa“. Adressen test-e2e-*@example.com; Mails werden nie verschickt
// (Links kommen aus admin.generateLink), damit Brevo nicht an Wegwerf-Adressen zustellt.

try {
  process.loadEnvFile('.env.local')
} catch {
  // ohne .env.local werden die Tests übersprungen
}

// Gemeinsamer angemeldeter Testnutzer (tests/auth.setup.ts, gelöscht in tests/auth.teardown.ts)
export const STORAGE_STATE = 'tests/.auth/owner.json'
export const SHARED_USER_FILE = 'tests/.auth/owner-user.json'

export const hasSupabaseEnv = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY && process.env.SUPABASE_SECRET_KEY
)

export function service(): SupabaseClient<Database> {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export function anon(): SupabaseClient<Database> {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export type E2EUser = { id: string; email: string; password: string; displayName: string | null }

export const newPassword = () => `Neu${randomUUID().replaceAll('-', '').slice(0, 10)}7A`

export async function createUser(opts: { displayName?: string | null; admin?: boolean } = {}): Promise<E2EUser> {
  const email = `test-e2e-${randomUUID()}@example.com`
  const password = `Test${randomUUID().replaceAll('-', '').slice(0, 12)}9a`
  const svc = service()
  const { data, error } = await svc.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data.user) throw error ?? new Error('Testnutzer nicht angelegt')
  const displayName = opts.displayName === undefined ? 'Erika Testerin' : opts.displayName
  const { error: profileError } = await svc
    .from('profiles')
    .update({ display_name: displayName, is_operator_admin: opts.admin ?? false })
    .eq('id', data.user.id)
  if (profileError) throw profileError
  return { id: data.user.id, email, password, displayName }
}

export async function deleteUser(user: { id: string; email: string } | undefined) {
  if (!user) return
  await clearFailures(user.email)
  // Kunden, bei denen der Testnutzer Inhaber war, mit entfernen (PROJ-4)
  const { data } = await service().from('memberships').select('tenant_id').eq('user_id', user.id).eq('role', 'owner')
  for (const m of data ?? []) await service().from('tenants').delete().eq('id', m.tenant_id)
  await service().auth.admin.deleteUser(user.id)
}

// Kunde anlegen und Person als Mitglied eintragen (Systemrechte; in der App nur über Einladung bzw. PROJ-5)
export async function createTenant(name: string, members: { user: { id: string }; role: 'owner' | 'staff' }[]) {
  const svc = service()
  const { data, error } = await svc.from('tenants').insert({ name }).select('id').single()
  if (error) throw error
  for (const m of members) {
    const { error: memberError } = await svc.from('memberships').insert({ tenant_id: data.id, user_id: m.user.id, role: m.role })
    if (memberError) throw memberError
  }
  return data.id
}

// Gleicher Hash wie src/lib/auth/lockout.ts
export function accountHash(email: string): string {
  const key = createHmac('sha256', process.env.SUPABASE_SECRET_KEY!).update('apppa:login-failures').digest()
  return createHmac('sha256', key).update(email.trim().toLowerCase()).digest('hex')
}

export async function clearFailures(email: string) {
  await service().from('login_failures').delete().eq('account_hash', accountHash(email))
}

export async function emailLink(type: 'invite' | 'recovery', email: string) {
  const { data, error } = await service().auth.admin.generateLink({ type, email })
  if (error) throw error
  return { url: `/bestaetigen?token_hash=${data.properties.hashed_token}&type=${type}`, userId: data.user.id }
}

// TOTP nach RFC 6238 (30 s, 6 Stellen, SHA-1)
export function totp(base32Secret: string, now = Date.now()): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const char of base32Secret.replace(/=+$/, '').toUpperCase()) bits += alphabet.indexOf(char).toString(2).padStart(5, '0')
  const bytes = Buffer.alloc(Math.floor(bits.length / 8))
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2)
  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 1000 / 30)))
  const hmac = createHmac('sha1', bytes).update(counter).digest()
  const offset = hmac[hmac.length - 1] & 0xf
  return ((hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).toString().padStart(6, '0')
}

// Anmelden über die Oberfläche
export async function login(page: Page, user: { email: string; password: string }, path = '/anmelden') {
  await page.goto(path)
  await page.getByLabel('E-Mail-Adresse').fill(user.email)
  await page.getByLabel('Passwort', { exact: true }).fill(user.password)
  await page.getByRole('button', { name: 'Anmelden' }).click()
}

export async function loginAndWait(page: Page, user: { email: string; password: string }) {
  await login(page, user)
  await expect(page).toHaveURL(/\/$/)
}

export async function typeCode(page: Page, code: string) {
  await page.locator('input[autocomplete="one-time-code"]').first().click()
  await page.keyboard.type(code)
}

// Sitzung ohne Login-Formular (schont die Supabase-Grenze „Anmeldungen pro IP“): Einmal-Link erzeugen,
// mit dem SSR-Client einlösen und dessen Cookies samt Sitzungsgrenzen-Cookie in den Browser übernehmen.
export async function sessionCookies(user: { id: string; email: string }, opts: { start?: number; enrollTotp?: boolean } = {}) {
  const jar = new Map<string, string>()
  const client = createServerClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => cookies.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
    },
  })
  const { data, error } = await service().auth.admin.generateLink({ type: 'magiclink', email: user.email })
  if (error) throw error
  const verified = await client.auth.verifyOtp({ type: 'magiclink', token_hash: data.properties.hashed_token })
  if (verified.error) throw verified.error
  // Admin (PROJ-5): 2FA-Gerät einrichten und die Sitzung damit bestätigen (aal2). Ein Code je Gerät –
  // derselbe Code wird nicht zweimal verwendet.
  if (opts.enrollTotp) {
    const { data: factor, error: enrollError } = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'e2e' })
    if (enrollError) throw enrollError
    const mfa = await client.auth.mfa.challengeAndVerify({ factorId: factor.id, code: totp(factor.totp.secret) })
    if (mfa.error) throw mfa.error
  }

  // start: Beginn der Sitzung bzw. letzte Aktivität (älter als 8 h = abgelaufen; 30-Tage-Grenze: Unit-Test)
  const limits = startSession(user.id, process.env.SUPABASE_SECRET_KEY!, opts.start ?? Date.now())
  return [...jar, [SESSION_COOKIE, limits] as [string, string]].map(([name, value]) => ({
    name,
    value,
    domain: 'localhost',
    path: '/',
    httpOnly: name === SESSION_COOKIE,
    sameSite: 'Lax' as const,
  }))
}

export async function signInAs(page: Page, user: { id: string; email: string }, opts?: { start?: number; enrollTotp?: boolean }) {
  await page.context().addCookies(await sessionCookies(user, opts))
}

// Einladung direkt anlegen (ohne Mailversand), z. B. für Annehmen-, Ablauf- und Zurückziehen-Tests (PROJ-4)
export async function createInvitation(opts: {
  tenantId: string
  email: string
  invitedBy: string
  role?: 'owner' | 'staff'
  kind?: 'new_account' | 'existing_account'
  minutes?: number
  sentMinutesAgo?: number
}) {
  const now = Date.now()
  const { data, error } = await service()
    .from('invitations')
    .insert({
      tenant_id: opts.tenantId,
      email: opts.email.toLowerCase(),
      role: opts.role ?? 'staff',
      kind: opts.kind ?? 'existing_account',
      invited_by: opts.invitedBy,
      sent_at: new Date(now - (opts.sentMinutesAgo ?? 0) * 60_000).toISOString(),
      expires_at: new Date(now + (opts.minutes ?? 14 * 24 * 60) * 60_000).toISOString(),
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

export async function membershipRole(tenantId: string, userId: string) {
  const { data } = await service().from('memberships').select('role').eq('tenant_id', tenantId).eq('user_id', userId).maybeSingle()
  return data?.role ?? null
}

// Betreiber-Admin anmelden, mit 2FA bestätigter Sitzung (PROJ-5). Nur einmal je Admin aufrufen (richtet das Gerät ein).
export async function signInAsAdmin(page: Page, admin: { id: string; email: string }) {
  await signInAs(page, admin, { enrollTotp: true })
}
