import { createHmac, randomUUID } from 'node:crypto'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { assertTestableProject } from '../../src/lib/supabase/projects'
import type { Database } from '../../src/types/database'

export type Client = SupabaseClient<Database>

// Vitest lädt .env.local nicht von selbst
try {
  process.loadEnvFile('.env.local')
} catch {
  // keine .env.local (z. B. in CI) → Tests werden übersprungen
}

export const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
assertTestableProject(url)
export const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ''
export const secretKey = process.env.SUPABASE_SECRET_KEY ?? ''
export const hasSupabaseEnv = Boolean(url && publishableKey && secretKey)

const noSession = { auth: { autoRefreshToken: false, persistSession: false } }

export function serviceClient(): Client {
  return createClient<Database>(url, secretKey, noSession)
}

export function anonClient(): Client {
  return createClient<Database>(url, publishableKey, noSession)
}

export type TestUser = { id: string; email: string; password: string }

export async function createTestUser(service: Client): Promise<TestUser> {
  const email = `test-${randomUUID()}@example.com`
  // erfüllt die Passwortregel: mind. 10 Zeichen, a-z, A-Z, 0-9
  const password = `Test${randomUUID().replaceAll('-', '').slice(0, 12)}9a`
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm: true })
  if (error || !data.user) throw error ?? new Error('Testnutzer konnte nicht angelegt werden')
  return { id: data.user.id, email, password }
}

export async function signIn(user: TestUser): Promise<Client> {
  const client = anonClient()
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password })
  if (error) throw error
  return client
}

// TOTP nach RFC 6238 (30 s, 6 Stellen, SHA-1) für die 2FA-Tests des Admins
export function totp(base32Secret: string, now = Date.now()): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = ''
  for (const char of base32Secret.replace(/=+$/, '').toUpperCase()) {
    bits += alphabet.indexOf(char).toString(2).padStart(5, '0')
  }
  const bytes = Buffer.alloc(Math.floor(bits.length / 8))
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2)

  const counter = Buffer.alloc(8)
  counter.writeBigUInt64BE(BigInt(Math.floor(now / 1000 / 30)))
  const hmac = createHmac('sha1', bytes).update(counter).digest()
  const offset = hmac[hmac.length - 1] & 0xf
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000
  return code.toString().padStart(6, '0')
}
