// Legt die gemeinsamen Testnutzer an und meldet jeden einmal an (siehe shared-sessions.ts).
// Läuft nur, wenn Integrationstests im Lauf sind (Projekt „integration“ in vitest.config.ts).
import type { TestProject } from 'vitest/node'

import { type Client, createTestUser, hasSupabaseEnv, serviceClient, signIn, type TestUser, totp } from './helpers'
import type { SharedRole, SharedSession } from './shared-sessions'

async function session(client: Client, user: TestUser): Promise<SharedSession> {
  const { data } = await client.auth.getSession()
  if (!data.session) throw new Error('Keine Sitzung nach der Anmeldung')
  return { user, accessToken: data.session.access_token, refreshToken: data.session.refresh_token }
}

export default async function setup(project: TestProject) {
  if (!hasSupabaseEnv) {
    project.provide('sharedSessions', null)
    return
  }

  const service = serviceClient()
  const users: TestUser[] = []
  const teardown = async () => {
    for (const u of users) {
      const { error } = await service.auth.admin.deleteUser(u.id)
      if (error) console.error('Aufräumen fehlgeschlagen', error.message)
    }
  }

  try {
    const [ownerA, staffA, ownerB, admin] = await Promise.all([1, 2, 3, 4].map(() => createTestUser(service)))
    users.push(ownerA, staffA, ownerB, admin)
    const { error } = await service.from('profiles').update({ is_operator_admin: true }).eq('id', admin.id)
    if (error) throw error

    // Admin: TOTP einrichten und bestätigen → Sitzung mit aal2; zweite Sitzung ohne Bestätigung → aal1
    const adminAal2 = await signIn(admin)
    const { data: factor, error: enrollError } = await adminAal2.auth.mfa.enroll({ factorType: 'totp' })
    if (enrollError) throw enrollError
    const { error: verifyError } = await adminAal2.auth.mfa.challengeAndVerify({ factorId: factor.id, code: totp(factor.totp.secret) })
    if (verifyError) throw verifyError

    const [a, s, b, adminAal1] = await Promise.all([signIn(ownerA), signIn(staffA), signIn(ownerB), signIn(admin)])
    const sessions: Record<SharedRole, SharedSession> = {
      ownerA: await session(a, ownerA),
      staffA: await session(s, staffA),
      ownerB: await session(b, ownerB),
      adminAal2: await session(adminAal2, admin),
      adminAal1: await session(adminAal1, admin),
    }
    project.provide('sharedSessions', sessions)
  } catch (error) {
    await teardown()
    throw error
  }

  return teardown
}
