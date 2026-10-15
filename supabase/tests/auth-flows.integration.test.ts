// @vitest-environment node
//
// PROJ-3: Anmelde-Sperre, Mail-Links und Sitzungen gegen „apppa“ (übersprungen ohne .env.local)
import { randomUUID } from 'node:crypto'

import { NextRequest } from 'next/server'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { anonClient, type Client, createTestUser, hasSupabaseEnv, serviceClient, signIn, type TestUser } from './helpers'

vi.mock('server-only', () => ({}))

const { accountHash, clearFailures, getLockState, recordFailure } = await import('../../src/lib/auth/lockout')
const { GET: confirmRoute } = await import('../../src/app/auth/confirm/route')

describe.skipIf(!hasSupabaseEnv)('PROJ-3 Anmeldung gegen apppa', () => {
  let service: Client
  let user: TestUser

  beforeAll(async () => {
    service = serviceClient()
    user = await createTestUser(service)
  }, 30_000)

  afterAll(async () => {
    if (!service || !user) return
    await clearFailures(accountHash(user.email))
    await service.auth.admin.deleteUser(user.id)
  }, 30_000)

  describe('Sperre nach Fehlversuchen', () => {
    it('sperrt nach 5 Fehlversuchen, Zurücksetzen hebt die Sperre auf', async () => {
      const hash = accountHash(user.email)
      for (let i = 0; i < 4; i++) await recordFailure(hash, i % 2 ? 'mfa' : 'password')
      expect(await getLockState(hash)).toEqual({ locked: false })

      await recordFailure(hash, 'password')
      expect(await getLockState(hash)).toEqual({ locked: true, retryAfterMinutes: 15 })

      await clearFailures(hash)
      expect(await getLockState(hash)).toEqual({ locked: false })
    }, 30_000)

    it('Hash ist unabhängig von Groß-/Kleinschreibung und Leerzeichen', () => {
      expect(accountHash(`  ${user.email.toUpperCase()} `)).toBe(accountHash(user.email))
    })

    it('Fehlversuch-Tabelle ist für angemeldete Nutzer und Anonyme gesperrt', async () => {
      const client = await signIn(user)
      for (const c of [client, anonClient()]) {
        const read = await c.from('login_failures').select('id').limit(1)
        expect(read.error).not.toBeNull()
        const write = await c.from('login_failures').insert({ account_hash: 'a'.repeat(64), kind: 'password' })
        expect(write.error).not.toBeNull()
      }
    }, 30_000)
  })

  describe('Mail-Links', () => {
    it('Aufruf des Links (Linkscanner) löst nicht ein; der Klick genau einmal', async () => {
      const { data, error } = await service.auth.admin.generateLink({ type: 'recovery', email: user.email })
      expect(error).toBeNull()
      const tokenHash = data.properties!.hashed_token

      // Linkscanner: ruft die alte und die neue Adresse per GET auf
      const res = confirmRoute(new NextRequest(`https://app.example/auth/confirm?token_hash=${tokenHash}&type=recovery`))
      expect(res.headers.get('location')).toBe(`https://app.example/bestaetigen?token_hash=${tokenHash}&type=recovery`)

      // Klick auf „Neues Passwort festlegen“
      const first = await anonClient().auth.verifyOtp({ type: 'recovery', token_hash: tokenHash })
      expect(first.error).toBeNull()
      expect(first.data.user?.id).toBe(user.id)

      const second = await anonClient().auth.verifyOtp({ type: 'recovery', token_hash: tokenHash })
      expect(second.error).not.toBeNull()
    }, 30_000)

    it('Einladungslink meldet die eingeladene Person an', async () => {
      const email = `test-invite-${randomUUID()}@example.com`
      const { data, error } = await service.auth.admin.generateLink({ type: 'invite', email })
      expect(error).toBeNull()
      try {
        const result = await anonClient().auth.verifyOtp({ type: 'invite', token_hash: data.properties!.hashed_token })
        expect(result.error).toBeNull()
        expect(result.data.user?.email).toBe(email)
      } finally {
        if (data.user) await service.auth.admin.deleteUser(data.user.id)
      }
    }, 30_000)
  })

  describe('Sitzungen', () => {
    it('Passwortänderung mit „andere abmelden“ beendet die Sitzung auf dem zweiten Gerät', async () => {
      const deviceA = await signIn(user)
      const deviceB = await signIn(user)

      const newPassword = `Neu${randomUUID().replaceAll('-', '').slice(0, 10)}7A`
      expect((await deviceA.auth.updateUser({ password: newPassword })).error).toBeNull()
      expect((await deviceA.auth.signOut({ scope: 'others' })).error).toBeNull()
      user.password = newPassword

      expect((await deviceB.auth.refreshSession()).error).not.toBeNull()
      expect((await deviceA.auth.getUser()).error).toBeNull()
    }, 30_000)
  })
})
