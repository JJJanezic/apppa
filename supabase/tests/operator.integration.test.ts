// @vitest-environment node
//
// PROJ-5: Admin-Funktionen des Betreibers gegen „apppa“ (übersprungen ohne .env.local)
import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { type Client, createTestUser, hasSupabaseEnv, serviceClient, signIn, type TestUser, totp } from './helpers'

describe.skipIf(!hasSupabaseEnv)('PROJ-5 Betreiber-Admin', () => {
  let service: Client
  const users: TestUser[] = []
  const tenants: string[] = []
  let admin: TestUser, owner: TestUser, owner2: TestUser, staff: TestUser, shared: TestUser
  let adminAal2: Client, adminAal1: Client, ownerClient: Client, staffClient: Client
  let tenant: string
  const runId = randomUUID().slice(0, 8)

  const user = async () => {
    const u = await createTestUser(service)
    users.push(u)
    return u
  }
  const newTenant = async (name: string, members: [TestUser, 'owner' | 'staff'][]) => {
    const { data, error } = await service.from('tenants').insert({ name }).select('id').single()
    if (error) throw error
    tenants.push(data.id)
    for (const [u, role] of members) {
      const { error: memberError } = await service.from('memberships').insert({ tenant_id: data.id, user_id: u.id, role })
      if (memberError) throw memberError
    }
    return data.id
  }
  const roleOf = async (tenantId: string, u: TestUser) =>
    (await service.from('memberships').select('role').eq('tenant_id', tenantId).eq('user_id', u.id).maybeSingle()).data?.role ??
    null
  const logOf = async (tenantId: string) =>
    (await adminAal2.from('operator_log').select('action, target_email, actor_id').eq('tenant_id', tenantId).order('id')).data ?? []

  beforeAll(async () => {
    service = serviceClient()
    ;[admin, owner, owner2, staff, shared] = await Promise.all([user(), user(), user(), user(), user()])
    const { error } = await service.from('profiles').update({ is_operator_admin: true }).eq('id', admin.id)
    if (error) throw error

    adminAal2 = await signIn(admin)
    const { data: factor, error: enrollError } = await adminAal2.auth.mfa.enroll({ factorType: 'totp' })
    if (enrollError) throw enrollError
    const { error: verifyError } = await adminAal2.auth.mfa.challengeAndVerify({ factorId: factor.id, code: totp(factor.totp.secret) })
    if (verifyError) throw verifyError
    adminAal1 = await signIn(admin)

    tenant = await newTenant(`PROJ-5 Test ${runId}`, [
      [owner, 'owner'],
      [staff, 'staff'],
      [shared, 'staff'],
    ])
    // shared gehört zusätzlich zu einem zweiten Kunden → beim Löschen kein verwaistes Konto
    await newTenant(`PROJ-5 Zweitkunde ${runId}`, [[shared, 'owner']])
    ;[ownerClient, staffClient] = await Promise.all([signIn(owner), signIn(staff)])
  }, 90_000)

  afterAll(async () => {
    if (!service) return
    // Über die Admin-Funktion löschen, damit Personenangaben auch aus dem Betreiber-Protokoll verschwinden
    for (const id of tenants) {
      const { data } = await service.from('tenants').select('name').eq('id', id).maybeSingle()
      if (!data) continue
      await adminAal2.rpc('admin_set_tenant_status', { p_tenant_id: id, p_active: false })
      const { error } = await adminAal2.rpc('admin_delete_tenant', { p_tenant_id: id, p_confirm_name: data.name })
      if (error) await service.from('tenants').delete().eq('id', id)
    }
    for (const u of users) await service.auth.admin.deleteUser(u.id)
  }, 90_000)

  describe('Zugang', () => {
    it('Nicht-Admins und Admin ohne 2FA werden abgewiesen', async () => {
      for (const client of [ownerClient, adminAal1]) {
        const create = await client.rpc('admin_create_tenant', { p_name: `Fremd ${runId}`, p_email: 'x@example.com' })
        expect(create.error?.code).toBe('42501')
        const overview = await client.rpc('admin_tenant_overview', {})
        expect(overview.error?.code).toBe('42501')
        const status = await client.rpc('admin_set_tenant_status', { p_tenant_id: tenant, p_active: false })
        expect(status.error?.code).toBe('42501')
        const change = await client.rpc('admin_change_member', { p_tenant_id: tenant, p_user_id: staff.id, p_action: 'promote' })
        expect(change.error?.code).toBe('42501')
      }
      expect(await roleOf(tenant, staff)).toBe('staff')
      const { data } = await service.from('tenants').select('status').eq('id', tenant).single()
      expect(data?.status).toBe('active')
    })

    it('das Betreiber-Protokoll lesen nur Admins mit 2FA; schreiben kann es niemand direkt', async () => {
      await adminAal2.rpc('admin_set_tenant_status', { p_tenant_id: tenant, p_active: true })
      const asOwner = await ownerClient.from('operator_log').select('id').eq('tenant_id', tenant)
      expect(asOwner.data ?? []).toHaveLength(0)
      const asAal1 = await adminAal1.from('operator_log').select('id').eq('tenant_id', tenant)
      expect(asAal1.data ?? []).toHaveLength(0)
      const insert = await adminAal2
        .from('operator_log')
        .insert({ tenant_id: tenant, tenant_name: 'x', action: 'created' } as never)
      expect(insert.error).not.toBeNull()
    })
  })

  describe('Kunde anlegen und Liste', () => {
    it('legt Kunde + Inhaber-Einladung an; Art richtet sich nach dem Konto', async () => {
      const name = `PROJ-5 Neu ${runId}`
      const fresh = `test-${randomUUID()}@example.com`
      const { data, error } = await adminAal2.rpc('admin_create_tenant', { p_name: name, p_email: fresh.toUpperCase() }).single()
      expect(error).toBeNull()
      tenants.push(data!.tenant_id)
      expect(data!.kind).toBe('new_account')
      const { data: inv } = await service.from('invitations').select('email, role, status, invited_by').eq('tenant_id', data!.tenant_id)
      expect(inv).toEqual([{ email: fresh, role: 'owner', status: 'open', invited_by: admin.id }])
      expect(await logOf(data!.tenant_id)).toEqual([{ action: 'created', target_email: fresh, actor_id: admin.id }])

      const existing = await adminAal2.rpc('admin_create_tenant', { p_name: `${name} B`, p_email: owner2.email }).single()
      tenants.push(existing.data!.tenant_id)
      expect(existing.data!.kind).toBe('existing_account')
    })

    it('gleicher Name nur nach Bestätigung', async () => {
      const name = `PROJ-5 Test ${runId}`
      const dup = await adminAal2.rpc('admin_create_tenant', { p_name: name.toLowerCase(), p_email: `test-${randomUUID()}@example.com` })
      expect(dup.error?.code).toBe('P0010')
      const ok = await adminAal2
        .rpc('admin_create_tenant', { p_name: name, p_email: `test-${randomUUID()}@example.com`, p_allow_duplicate: true })
        .single()
      expect(ok.error).toBeNull()
      tenants.push(ok.data!.tenant_id)
    })

    it('Suche nach Name und Mitglieds-Adresse, mit Mitgliederzahl, Inhabern und letzter Anmeldung', async () => {
      const byName = await adminAal2.rpc('admin_tenant_overview', { p_query: `test ${runId}` })
      expect(byName.error).toBeNull()
      const row = byName.data!.find((t) => t.id === tenant)!
      expect(row.member_count).toBe(3)
      expect(row.owners).toEqual([{ name: null, email: owner.email }])
      expect(row.last_sign_in_at).not.toBeNull()
      expect(Number(row.total)).toBe(byName.data!.length)

      const byEmail = await adminAal2.rpc('admin_tenant_overview', { p_query: staff.email.slice(0, 20).toUpperCase() })
      expect(byEmail.data!.map((t) => t.id)).toContain(tenant)

      const none = await adminAal2.rpc('admin_tenant_overview', { p_query: `kein-kunde-${randomUUID()}` })
      expect(none.data).toEqual([])
    })
  })

  describe('Inhaber verwalten', () => {
    it('Einladung: bereits Mitglied → P0014, doppelte offene Einladung → 23505', async () => {
      const member = await adminAal2.rpc('admin_invite_owner', { p_tenant_id: tenant, p_email: staff.email })
      expect(member.error?.code).toBe('P0014')
      const first = await adminAal2.rpc('admin_invite_owner', { p_tenant_id: tenant, p_email: owner2.email })
      expect(first.error).toBeNull()
      expect(first.data).toBe('existing_account')
      const again = await adminAal2.rpc('admin_invite_owner', { p_tenant_id: tenant, p_email: owner2.email })
      expect(again.error?.code).toBe('23505')
    })

    it('erneut senden verlängert, zurückziehen schließt die Einladung', async () => {
      const { data: inv } = await service
        .from('invitations')
        .select('id, sent_at')
        .eq('tenant_id', tenant)
        .eq('email', owner2.email.toLowerCase())
        .eq('status', 'open')
        .single()
      const resent = await adminAal2.rpc('admin_resend_invitation', { p_tenant_id: tenant, p_invitation_id: inv!.id }).single()
      expect(resent.error).toBeNull()
      expect(resent.data).toMatchObject({ email: owner2.email.toLowerCase(), role: 'owner', kind: 'existing_account' })
      const revoked = await adminAal2.rpc('admin_revoke_invitation', { p_tenant_id: tenant, p_invitation_id: inv!.id }).single()
      expect(revoked.error).toBeNull()
      const again = await adminAal2.rpc('admin_revoke_invitation', { p_tenant_id: tenant, p_invitation_id: inv!.id })
      expect(again.error?.code).toBe('P0015')
      const actions = (await logOf(tenant)).map((e) => e.action)
      expect(actions).toEqual(expect.arrayContaining(['invited', 'resent', 'revoked']))
    })

    it('befördern, herabstufen, entfernen – letzter Inhaber geschützt, Mitarbeiter entfernt der Betreiber nicht', async () => {
      const removeStaff = await adminAal2.rpc('admin_change_member', { p_tenant_id: tenant, p_user_id: staff.id, p_action: 'remove' })
      expect(removeStaff.error?.code).toBe('P0017')
      const demoteLast = await adminAal2.rpc('admin_change_member', { p_tenant_id: tenant, p_user_id: owner.id, p_action: 'demote' })
      expect(demoteLast.error?.code).toBe('P0001')
      expect(await roleOf(tenant, owner)).toBe('owner')

      expect((await adminAal2.rpc('admin_change_member', { p_tenant_id: tenant, p_user_id: staff.id, p_action: 'promote' })).error).toBeNull()
      expect(await roleOf(tenant, staff)).toBe('owner')
      expect((await adminAal2.rpc('admin_change_member', { p_tenant_id: tenant, p_user_id: staff.id, p_action: 'demote' })).error).toBeNull()
      expect(await roleOf(tenant, staff)).toBe('staff')

      // Zweiten Inhaber einsetzen, dann den ersten entfernen und zurückholen
      await adminAal2.rpc('admin_change_member', { p_tenant_id: tenant, p_user_id: staff.id, p_action: 'promote' })
      expect((await adminAal2.rpc('admin_change_member', { p_tenant_id: tenant, p_user_id: owner.id, p_action: 'remove' })).error).toBeNull()
      expect(await roleOf(tenant, owner)).toBeNull()
      await service.from('memberships').insert({ tenant_id: tenant, user_id: owner.id, role: 'owner' })
      await adminAal2.rpc('admin_change_member', { p_tenant_id: tenant, p_user_id: staff.id, p_action: 'demote' })

      const actions = (await logOf(tenant)).map((e) => e.action)
      expect(actions).toEqual(expect.arrayContaining(['promoted', 'demoted', 'removed']))
    })
  })

  describe('Deaktivieren, Reaktivieren, Löschen', () => {
    it('deaktiviert: Mitglieder sehen nichts und bekommen die Auskunft „deaktiviert“; Aktionen gesperrt', async () => {
      expect((await adminAal2.rpc('admin_set_tenant_status', { p_tenant_id: tenant, p_active: false })).error).toBeNull()
      const seen = await staffClient.from('tenants').select('id').eq('id', tenant)
      expect(seen.data ?? []).toHaveLength(0)
      expect((await staffClient.rpc('belongs_to_deactivated_tenant')).data).toBe(true)
      const blocked = await adminAal2.rpc('admin_change_member', { p_tenant_id: tenant, p_user_id: staff.id, p_action: 'promote' })
      expect(blocked.error?.code).toBe('P0016')

      expect((await adminAal2.rpc('admin_set_tenant_status', { p_tenant_id: tenant, p_active: true })).error).toBeNull()
      expect((await staffClient.from('tenants').select('id').eq('id', tenant)).data).toHaveLength(1)
      expect((await staffClient.rpc('belongs_to_deactivated_tenant')).data).toBe(false)
      expect(await roleOf(tenant, staff)).toBe('staff')
    })

    it('löschen nur deaktiviert und mit exaktem Namen; liefert nur verwaiste Konten; Löschnachweis ohne Personendaten', async () => {
      const { data: t } = await service.from('tenants').select('name').eq('id', tenant).single()
      // Admin ist zusätzlich Mitglied: sein Konto darf nie als verwaist gelten
      await service.from('memberships').insert({ tenant_id: tenant, user_id: admin.id, role: 'staff' })
      // Offene Einladung an eine neue Person (BUG-3 aus QA): wird gemeldet, damit ihr unbenutztes Konto wegkommt
      const newcomer = `test-${randomUUID()}@example.com`
      await service.from('invitations').insert({
        tenant_id: tenant,
        email: newcomer,
        role: 'owner',
        kind: 'new_account',
        invited_by: admin.id,
        expires_at: new Date(Date.now() + 60 * 60_000).toISOString(),
      })

      const active = await adminAal2.rpc('admin_delete_tenant', { p_tenant_id: tenant, p_confirm_name: t!.name })
      expect(active.error?.code).toBe('P0012')
      await adminAal2.rpc('admin_set_tenant_status', { p_tenant_id: tenant, p_active: false })
      const wrong = await adminAal2.rpc('admin_delete_tenant', { p_tenant_id: tenant, p_confirm_name: t!.name.toLowerCase() })
      expect(wrong.error?.code).toBe('P0013')

      const { data: orphans, error } = await adminAal2.rpc('admin_delete_tenant', { p_tenant_id: tenant, p_confirm_name: ` ${t!.name} ` })
      expect(error).toBeNull()
      expect(orphans!.flatMap((o) => (o.user_id ? [o.user_id] : [])).sort()).toEqual([owner.id, staff.id].sort())
      expect(orphans!.flatMap((o) => (o.invited_email ? [o.invited_email] : []))).toEqual([newcomer])

      expect((await service.from('tenants').select('id').eq('id', tenant)).data).toEqual([])
      expect((await service.from('memberships').select('id').eq('tenant_id', tenant)).data).toEqual([])
      expect((await service.from('invitations').select('id').eq('tenant_id', tenant)).data).toEqual([])
      expect((await service.from('audit_log').select('id').eq('tenant_id', tenant)).data).toEqual([])
      const log = await logOf(tenant)
      expect(log.every((e) => e.target_email === null)).toBe(true)
      expect(log.at(-1)).toMatchObject({ action: 'deleted', actor_id: admin.id })
      const { data: proof } = await adminAal2.from('operator_log').select('tenant_name').eq('tenant_id', tenant).eq('action', 'deleted')
      expect(proof).toEqual([{ tenant_name: t!.name }])

      const gone = await adminAal2.rpc('admin_set_tenant_status', { p_tenant_id: tenant, p_active: true })
      expect(gone.error?.code).toBe('P0011')
    })
  })
})
