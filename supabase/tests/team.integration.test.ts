// @vitest-environment node
//
// PROJ-4: Datenbank-Regeln für Team und Einladungen gegen „apppa-dev“ (übersprungen ohne .env.local)
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { type Client, createTestUser, hasSupabaseEnv, serviceClient, signIn, type TestUser } from './helpers'

describe.skipIf(!hasSupabaseEnv)('PROJ-4 Team & Einladungen', () => {
  let service: Client
  const users: TestUser[] = []
  const tenants: string[] = []
  let ownerA: TestUser, ownerB: TestUser, staff: TestUser, outsider: TestUser, invitee: TestUser
  let tenant: string
  let a: Client, s: Client, x: Client, inv: Client

  const user = async () => {
    const u = await createTestUser(service)
    users.push(u)
    return u
  }
  const newTenant = async (name: string) => {
    const { data, error } = await service.from('tenants').insert({ name }).select('id').single()
    if (error) throw error
    tenants.push(data.id)
    return data.id
  }
  const member = async (tenantId: string, u: TestUser, role: 'owner' | 'staff') => {
    const { error } = await service.from('memberships').insert({ tenant_id: tenantId, user_id: u.id, role })
    if (error) throw error
  }
  const roleOf = async (tenantId: string, u: TestUser) =>
    (await service.from('memberships').select('role').eq('tenant_id', tenantId).eq('user_id', u.id).maybeSingle()).data?.role ?? null
  const invite = (client: Client, email: string, kind: 'new_account' | 'existing_account', invitedBy: string, expires = 60) =>
    client
      .from('invitations')
      .insert({
        tenant_id: tenant,
        email,
        role: 'staff',
        kind,
        invited_by: invitedBy,
        expires_at: new Date(Date.now() + expires * 60_000).toISOString(),
      })
      .select('id')
      .single()

  beforeAll(async () => {
    service = serviceClient()
    ;[ownerA, ownerB, staff, outsider, invitee] = await Promise.all([user(), user(), user(), user(), user()])
    tenant = await newTenant('Testkunde PROJ-4')
    await member(tenant, ownerA, 'owner')
    await member(tenant, ownerB, 'owner')
    await member(tenant, staff, 'staff')
    ;[a, s, x, inv] = await Promise.all([signIn(ownerA), signIn(staff), signIn(outsider), signIn(invitee)])
  }, 60_000)

  afterAll(async () => {
    if (!service) return
    for (const id of tenants) await service.from('tenants').delete().eq('id', id)
    for (const u of users) await service.auth.admin.deleteUser(u.id)
  }, 60_000)

  describe('Mitgliedschaften', () => {
    it('Inhaber kann niemanden direkt hinzufügen (nur über Einladung)', async () => {
      const { error } = await a.from('memberships').insert({ tenant_id: tenant, user_id: outsider.id, role: 'staff' })
      expect(error).not.toBeNull()
      expect(await roleOf(tenant, outsider)).toBeNull()
    })

    it('Inhaber macht Mitarbeiter zum Inhaber', async () => {
      const { data } = await a.from('memberships').update({ role: 'owner' }).eq('tenant_id', tenant).eq('user_id', staff.id).select('id')
      expect(data).toHaveLength(1)
      expect(await roleOf(tenant, staff)).toBe('owner')
      await service.from('memberships').update({ role: 'staff' }).eq('tenant_id', tenant).eq('user_id', staff.id)
    })

    it('andere Inhaber sind geschützt: nicht herabstufen, nicht entfernen', async () => {
      const demote = await a.from('memberships').update({ role: 'staff' }).eq('tenant_id', tenant).eq('user_id', ownerB.id).select('id')
      expect(demote.data ?? []).toHaveLength(0)
      const remove = await a.from('memberships').delete().eq('tenant_id', tenant).eq('user_id', ownerB.id).select('id')
      expect(remove.data ?? []).toHaveLength(0)
      expect(await roleOf(tenant, ownerB)).toBe('owner')
    })

    it('Mitarbeiter ändert und entfernt niemand anderen', async () => {
      const promote = await s.from('memberships').update({ role: 'owner' }).eq('tenant_id', tenant).eq('user_id', staff.id).select('id')
      expect(promote.data ?? []).toHaveLength(0)
      const remove = await s.from('memberships').delete().eq('tenant_id', tenant).eq('user_id', ownerA.id).select('id')
      expect(remove.data ?? []).toHaveLength(0)
      expect(await roleOf(tenant, staff)).toBe('staff')
    })

    it('letzter Inhaber kann weder austreten noch sich herabstufen', async () => {
      const solo = await newTenant('Testkunde PROJ-4 solo')
      await member(solo, outsider, 'owner')
      const demote = await x.from('memberships').update({ role: 'staff' }).eq('tenant_id', solo).eq('user_id', outsider.id)
      expect(demote.error?.code).toBe('P0001')
      const leave = await x.from('memberships').delete().eq('tenant_id', solo).eq('user_id', outsider.id)
      expect(leave.error?.code).toBe('P0001')
      expect(await roleOf(solo, outsider)).toBe('owner')
    })

    it('Inhaber stuft sich selbst herab, wenn es einen weiteren Inhaber gibt', async () => {
      const { data } = await a.from('memberships').update({ role: 'staff' }).eq('tenant_id', tenant).eq('user_id', ownerA.id).select('id')
      expect(data).toHaveLength(1)
      await service.from('memberships').update({ role: 'owner' }).eq('tenant_id', tenant).eq('user_id', ownerA.id)
    })
  })

  describe('Einladungen', () => {
    it('Inhaber lädt ein; zweite offene Einladung an dieselbe Adresse wird abgewiesen', async () => {
      const first = await invite(a, `dup-${Date.now()}@example.com`, 'existing_account', ownerA.id)
      expect(first.error).toBeNull()
      const email = (await service.from('invitations').select('email').eq('id', first.data!.id).single()).data!.email
      const second = await invite(a, email, 'existing_account', ownerA.id)
      expect(second.error?.code).toBe('23505')
    })

    it('Mitarbeiter kann weder einladen noch Einladungen sehen', async () => {
      const created = await invite(s, `staff-${Date.now()}@example.com`, 'existing_account', staff.id)
      expect(created.error).not.toBeNull()
      const { data } = await s.from('invitations').select('id').eq('tenant_id', tenant)
      expect(data ?? []).toHaveLength(0)
    })

    it('bestehendes Konto: sieht die Einladung mit Kundenname, nimmt an, danach Mitglied; zweites Annehmen ungültig', async () => {
      const created = await invite(a, invitee.email, 'existing_account', ownerA.id)
      expect(created.error).toBeNull()

      const { data: mine } = await inv.rpc('my_open_invitations')
      expect(mine?.map((i) => i.tenant_name)).toContain('Testkunde PROJ-4')

      // Fremde Person kann die Einladung nicht annehmen
      const foreign = await x.rpc('accept_invitation', { p_invitation_id: created.data!.id })
      expect(foreign.error?.code).toBe('P0002')

      const accepted = await inv.rpc('accept_invitation', { p_invitation_id: created.data!.id })
      expect(accepted.error).toBeNull()
      expect(accepted.data).toBe(tenant)
      expect(await roleOf(tenant, invitee)).toBe('staff')

      const again = await inv.rpc('accept_invitation', { p_invitation_id: created.data!.id })
      expect(again.error?.code).toBe('P0002')
    })

    it('abgelaufene Einladung (bestehendes Konto) lässt sich nicht annehmen', async () => {
      const late = await user()
      const created = await invite(a, late.email, 'existing_account', ownerA.id, -1)
      const client = await signIn(late)
      const { error } = await client.rpc('accept_invitation', { p_invitation_id: created.data!.id })
      expect(error?.code).toBe('P0002')
      expect(await roleOf(tenant, late)).toBeNull()
    })

    it('Ablehnen schließt die Einladung, danach kann neu eingeladen werden', async () => {
      const declining = await user()
      const created = await invite(a, declining.email, 'existing_account', ownerA.id)
      const client = await signIn(declining)
      expect((await client.rpc('decline_invitation', { p_invitation_id: created.data!.id })).error).toBeNull()
      expect(await roleOf(tenant, declining)).toBeNull()
      expect((await invite(a, declining.email, 'existing_account', ownerA.id)).error).toBeNull()
    })

    it('neues Konto: nach dem Einrichten werden die Einladungen eingelöst', async () => {
      const fresh = await user()
      await invite(a, fresh.email, 'new_account', ownerA.id)
      const client = await signIn(fresh)
      const { data, error } = await client.rpc('accept_new_account_invitations')
      expect(error).toBeNull()
      expect(data).toBe(tenant)
      expect(await roleOf(tenant, fresh)).toBe('staff')
    })
  })
})
