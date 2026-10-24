// @vitest-environment node
//
// Prüft die Zugriffsregeln aus PROJ-1 direkt gegen das Entwicklungsprojekt „apppa“.
// Legt Testnutzer (test-*@example.com) und zwei Test-Mandanten an und räumt danach auf.
// Protokolleinträge der Test-Mandanten bleiben bewusst stehen: das Protokoll kann niemand löschen
// (nur die Bereinigung nach 2 Jahren).
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  anonClient,
  type Client,
  createTestUser,
  hasSupabaseEnv,
  serviceClient,
  signIn,
  type TestUser,
  totp,
} from './helpers'

describe.skipIf(!hasSupabaseEnv)('PROJ-1 Zugriffsregeln (RLS)', () => {
  let service: Client
  // A: Inhaber T1 · B: Mitarbeiter T1 + Inhaber T2 · C: ohne Mitgliedschaft · admin: Betreiber-Admin
  let userA: TestUser, userB: TestUser, userC: TestUser, userAdmin: TestUser
  let a: Client, b: Client, c: Client, adminAal1: Client, adminAal2: Client
  let t1: string, t2: string
  const users: TestUser[] = []

  beforeAll(async () => {
    service = serviceClient()
    ;[userA, userB, userC, userAdmin] = await Promise.all([
      createTestUser(service),
      createTestUser(service),
      createTestUser(service),
      createTestUser(service),
    ])
    users.push(userA, userB, userC, userAdmin)

    const { data: tenants, error: tenantError } = await service
      .from('tenants')
      .insert([{ name: 'Test-Mandant 1' }, { name: 'Test-Mandant 2' }])
      .select('id, name')
      .order('name')
    if (tenantError || !tenants) throw tenantError
    ;[t1, t2] = tenants.map((t) => t.id)

    const { error: memberError } = await service.from('memberships').insert([
      { tenant_id: t1, user_id: userA.id, role: 'owner' },
      { tenant_id: t1, user_id: userB.id, role: 'staff' },
      { tenant_id: t2, user_id: userB.id, role: 'owner' },
    ])
    if (memberError) throw memberError

    const { error: adminError } = await service
      .from('profiles')
      .update({ is_operator_admin: true })
      .eq('id', userAdmin.id)
    if (adminError) throw adminError

    ;[a, b, c] = await Promise.all([signIn(userA), signIn(userB), signIn(userC)])

    // Admin: TOTP einrichten und bestätigen → Sitzung mit aal2
    adminAal2 = await signIn(userAdmin)
    const { data: factor, error: enrollError } = await adminAal2.auth.mfa.enroll({ factorType: 'totp' })
    if (enrollError) throw enrollError
    const { error: verifyError } = await adminAal2.auth.mfa.challengeAndVerify({
      factorId: factor.id,
      code: totp(factor.totp.secret),
    })
    if (verifyError) throw verifyError

    // Zweite Admin-Sitzung ohne 2FA-Bestätigung → aal1
    adminAal1 = await signIn(userAdmin)
  }, 60_000)

  afterAll(async () => {
    if (!service) return
    const tenantIds = [t1, t2].filter(Boolean)
    if (tenantIds.length) await service.from('tenants').delete().in('id', tenantIds)
    await Promise.all(users.map((u) => service.auth.admin.deleteUser(u.id)))
  }, 60_000)

  async function tenantName(id: string) {
    const { data } = await service.from('tenants').select('name').eq('id', id).single()
    return data?.name
  }

  describe('Mandanten & Abschottung', () => {
    it('ohne Anmeldung gibt es keine Mandantendaten', async () => {
      const { data } = await anonClient().from('tenants').select('id')
      expect(data ?? []).toHaveLength(0)
    })

    it('Mitglied sieht nur die eigenen Mandanten', async () => {
      const { data, error } = await a.from('tenants').select('id')
      expect(error).toBeNull()
      expect(data!.map((t) => t.id)).toEqual([t1])
    })

    it('fremder Mandant lässt sich nicht ändern', async () => {
      await a.from('tenants').update({ name: 'Gehackt' }).eq('id', t2)
      expect(await tenantName(t2)).toBe('Test-Mandant 2')
    })

    it('in fremden Mandanten lassen sich keine Mitglieder anlegen oder löschen', async () => {
      const { error } = await a.from('memberships').insert({ tenant_id: t2, user_id: userC.id, role: 'staff' })
      expect(error).not.toBeNull()

      await a.from('memberships').delete().eq('tenant_id', t2)
      const { count } = await service
        .from('memberships')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', t2)
      expect(count).toBe(1)
    })

    it('Mandanten anlegen und löschen geht nicht über die App', async () => {
      const { error } = await a.from('tenants').insert({ name: 'Neu' })
      expect(error).not.toBeNull()
      await a.from('tenants').delete().eq('id', t1)
      expect(await tenantName(t1)).toBeDefined()
    })

    it('Person ohne Mitgliedschaft sieht keinerlei Mandantendaten', async () => {
      const [tenants, memberships, log] = await Promise.all([
        c.from('tenants').select('id'),
        c.from('memberships').select('id'),
        c.from('audit_log').select('id'),
      ])
      expect(tenants.data).toHaveLength(0)
      expect(memberships.data).toHaveLength(0)
      expect(log.data).toHaveLength(0)
    })

    // Seit PROJ-4 entstehen Mitgliedschaften nur durch Annehmen einer Einladung – auch Inhaber fügen niemanden
    // direkt hinzu. Die Rechte je Mandant zeigen sich deshalb an den Einladungen.
    it('Rechte gelten je Mandant: B ist Inhaber in T2, aber nur Mitarbeiter in T1', async () => {
      const invite = (tenantId: string) =>
        b
          .from('invitations')
          .insert({
            tenant_id: tenantId,
            email: `rls-${Date.now()}@example.com`,
            role: 'staff',
            kind: 'existing_account',
            invited_by: userB.id,
            expires_at: new Date(Date.now() + 60_000).toISOString(),
          })
          .select('id')
          .single()
      const inT2 = await invite(t2)
      expect(inT2.error).toBeNull()
      await service.from('invitations').delete().eq('id', inT2.data!.id)

      expect((await invite(t1)).error).not.toBeNull()
      expect((await b.from('memberships').insert({ tenant_id: t2, user_id: userC.id, role: 'staff' })).error).not.toBeNull()
    })

    it('Mitarbeiter kann Inhaber-Daten nicht ändern', async () => {
      await b.from('tenants').update({ name: 'Vom Mitarbeiter' }).eq('id', t1)
      expect(await tenantName(t1)).toBe('Test-Mandant 1')

      await b.from('memberships').update({ role: 'owner' }).eq('tenant_id', t1).eq('user_id', userB.id)
      const { data } = await service
        .from('memberships')
        .select('role')
        .eq('tenant_id', t1)
        .eq('user_id', userB.id)
        .single()
      expect(data!.role).toBe('staff')
    })

    it('deaktivierter Mandant sperrt seine Mitglieder, Daten bleiben erhalten', async () => {
      await service.from('tenants').update({ status: 'deactivated' }).eq('id', t2)
      const { data } = await b.from('tenants').select('id')
      expect(data!.map((t) => t.id)).toEqual([t1])
      expect(await tenantName(t2)).toBe('Test-Mandant 2')
      await service.from('tenants').update({ status: 'active' }).eq('id', t2)
    })
  })

  describe('Mitgliedschaften', () => {
    it('keine doppelte Mitgliedschaft', async () => {
      const { error } = await a.from('memberships').insert({ tenant_id: t1, user_id: userB.id, role: 'staff' })
      expect(error).not.toBeNull()
    })

    it('der letzte Inhaber kann nicht herabgestuft oder entfernt werden', async () => {
      const demote = await a
        .from('memberships')
        .update({ role: 'staff' })
        .eq('tenant_id', t1)
        .eq('user_id', userA.id)
      expect(demote.error?.message).toContain('mindestens einen Inhaber')

      const remove = await a.from('memberships').delete().eq('tenant_id', t1).eq('user_id', userA.id)
      expect(remove.error?.message).toContain('mindestens einen Inhaber')
    })
  })

  describe('Betreiber-Admin', () => {
    it('ohne 2FA-bestätigte Sitzung sieht der Admin nichts', async () => {
      const { data } = await adminAal1.from('tenants').select('id').in('id', [t1, t2])
      expect(data).toHaveLength(0)
    })

    it('mit 2FA liest der Admin alle Mandanten, Mitglieder und Protokolle', async () => {
      const tenants = await adminAal2.from('tenants').select('id').in('id', [t1, t2])
      expect(tenants.data).toHaveLength(2)
      const members = await adminAal2.from('memberships').select('id').in('tenant_id', [t1, t2])
      expect(members.data).toHaveLength(3)
      const log = await adminAal2.from('audit_log').select('id').eq('tenant_id', t1)
      expect(log.data!.length).toBeGreaterThan(0)
    })

    it('der Admin kann ohne Mitgliedschaft nichts ändern', async () => {
      await adminAal2.from('tenants').update({ name: 'Vom Admin' }).eq('id', t1)
      expect(await tenantName(t1)).toBe('Test-Mandant 1')

      const { error } = await adminAal2
        .from('memberships')
        .insert({ tenant_id: t1, user_id: userAdmin.id, role: 'owner' })
      expect(error).not.toBeNull()
    })

    it('niemand kann sich oder anderen über die App Admin-Rechte geben oder entziehen', async () => {
      const grant = await a.from('profiles').update({ is_operator_admin: true }).eq('id', userA.id)
      expect(grant.error).not.toBeNull()

      const revoke = await adminAal2.from('profiles').update({ is_operator_admin: false }).eq('id', userAdmin.id)
      expect(revoke.error).not.toBeNull()

      const { data } = await service.from('profiles').select('id, is_operator_admin').in('id', [userA.id, userAdmin.id])
      const flags = Object.fromEntries(data!.map((p) => [p.id, p.is_operator_admin]))
      expect(flags).toEqual({ [userA.id]: false, [userAdmin.id]: true })
    })
  })

  describe('Nachvollziehbarkeit', () => {
    it('Standardfelder und Protokoll werden bei Änderungen geschrieben', async () => {
      const before = await service.from('tenants').select('created_at, created_by').eq('id', t1).single()

      const { error } = await a.from('tenants').update({ name: 'Test-Mandant 1 (neu)' }).eq('id', t1)
      expect(error).toBeNull()

      const after = await service.from('tenants').select('*').eq('id', t1).single()
      expect(after.data!.updated_by).toBe(userA.id)
      expect(after.data!.created_at).toBe(before.data!.created_at)
      expect(after.data!.created_by).toBe(before.data!.created_by)

      const { data: log } = await a
        .from('audit_log')
        .select('*')
        .eq('table_name', 'tenants')
        .eq('record_id', t1)
        .eq('action', 'update')
        .order('created_at', { ascending: false })
        .limit(1)
      expect(log).toHaveLength(1)
      expect(log![0].actor_id).toBe(userA.id)
      expect((log![0].old_data as { name: string }).name).toBe('Test-Mandant 1')
      expect((log![0].new_data as { name: string }).name).toBe('Test-Mandant 1 (neu)')

      await service.from('tenants').update({ name: 'Test-Mandant 1' }).eq('id', t1)
    })

    it('serverseitige Änderungen werden als System protokolliert', async () => {
      const { data } = await service
        .from('audit_log')
        .select('actor_id, actor_label')
        .eq('table_name', 'tenants')
        .eq('record_id', t2)
        .eq('action', 'insert')
        .single()
      expect(data).toEqual({ actor_id: null, actor_label: 'system' })
    })

    it('Mitarbeiter sehen das Protokoll nicht', async () => {
      const { data } = await b.from('audit_log').select('id').eq('tenant_id', t1)
      expect(data).toHaveLength(0)
    })

    it('Protokolleinträge kann niemand ändern oder löschen – auch nicht der Secret Key', async () => {
      const { data: entry } = await a.from('audit_log').select('id').eq('tenant_id', t1).limit(1).single()

      const asOwner = await a.from('audit_log').delete().eq('id', entry!.id)
      expect(asOwner.error).not.toBeNull()

      const asService = await service.from('audit_log').delete().eq('id', entry!.id)
      expect(asService.error).not.toBeNull()

      const edit = await service.from('audit_log').update({ actor_label: 'manipuliert' } as never).eq('id', entry!.id)
      expect(edit.error).not.toBeNull()
    })
  })
})
