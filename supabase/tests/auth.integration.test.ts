// @vitest-environment node
//
// QA PROJ-1: prüft die Auth-Konfiguration von „apppa-dev“ (Registrierung gesperrt, Passwortregel).
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  anonClient,
  type Client,
  createTestUser,
  hasSupabaseEnv,
  serviceClient,
  signIn,
  type TestUser,
} from './helpers'

describe.skipIf(!hasSupabaseEnv)('PROJ-1 Auth-Konfiguration', () => {
  let service: Client
  let user: TestUser
  let client: Client

  beforeAll(async () => {
    service = serviceClient()
    user = await createTestUser(service)
    client = await signIn(user)
  }, 30_000)

  afterAll(async () => {
    if (service && user) await service.auth.admin.deleteUser(user.id)
  }, 30_000)

  it('ohne Einladung ist keine Selbstregistrierung möglich', async () => {
    const { data, error } = await anonClient().auth.signUp({
      email: `test-signup-${Date.now()}@example.com`,
      password: 'Abcdefgh1234',
    })
    expect(error).not.toBeNull()
    expect(data.user).toBeNull()
  })

  it.each([
    ['zu kurz', 'Abc12345'],
    ['ohne Großbuchstaben', 'abcdefgh1234'],
    ['ohne Kleinbuchstaben', 'ABCDEFGH1234'],
    ['ohne Ziffer', 'Abcdefghijkl'],
  ])('Passwort %s wird abgelehnt', async (_, password) => {
    const { error } = await client.auth.updateUser({ password })
    expect(error).not.toBeNull()
  })

  it('Passwort mit 10 Zeichen, a-z, A-Z und 0-9 wird akzeptiert', async () => {
    const { error } = await client.auth.updateUser({ password: 'Qa1bcdefgh' })
    expect(error).toBeNull()
  })
})
