// @vitest-environment node
//
// PROJ-7: Gäste-Datenbank gegen „apppa-dev“ (übersprungen ohne .env.local)
import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { type Client, createTestUser, hasSupabaseEnv, serviceClient, signIn, type TestUser } from './helpers'

describe.skipIf(!hasSupabaseEnv)('PROJ-7 Gäste-Datenbank', () => {
  let service: Client
  const users: TestUser[] = []
  const tenants: string[] = []
  let tenantA: string, tenantB: string
  let ownerA: Client, staffA: Client, ownerB: Client
  let ownerUserA: TestUser, staffUserA: TestUser
  const runId = randomUUID().slice(0, 8)

  const user = async () => {
    const u = await createTestUser(service)
    users.push(u)
    return u
  }
  const newTenant = async (members: [TestUser, 'owner' | 'staff'][]) => {
    const { data, error } = await service.from('tenants').insert({ name: `PROJ-7 Test ${runId}` }).select('id').single()
    if (error) throw error
    tenants.push(data.id)
    for (const [u, role] of members) {
      const { error: e } = await service.from('memberships').insert({ tenant_id: data.id, user_id: u.id, role })
      if (e) throw e
    }
    return data.id
  }
  type GuestFields = { last_name: string; country: string } & Record<string, string | null>
  const guest = async (client: Client, tenantId: string, fields: GuestFields) => {
    const { data, error } = await client.from('guests').insert({ tenant_id: tenantId, ...fields }).select('id, updated_at').single()
    if (error) throw error
    return data
  }

  beforeAll(async () => {
    service = serviceClient()
    const [a, s, b] = await Promise.all([user(), user(), user()])
    ownerUserA = a
    staffUserA = s
    tenantA = await newTenant([
      [a, 'owner'],
      [s, 'staff'],
    ])
    tenantB = await newTenant([[b, 'owner']])
    ;[ownerA, staffA, ownerB] = await Promise.all([signIn(a), signIn(s), signIn(b)])
  }, 60_000)

  afterAll(async () => {
    if (!service) return
    for (const id of tenants) {
      const { error } = await service.from('tenants').delete().eq('id', id)
      if (error) console.error('Aufräumen fehlgeschlagen', error.message)
    }
    for (const u of users) await service.auth.admin.deleteUser(u.id)
  }, 60_000)

  describe('Abschottung und Rollen', () => {
    it('Inhaber legt an; Mitglieder lesen; fremde Kunden sehen nichts', async () => {
      const g = await guest(ownerA, tenantA, { last_name: 'Huber', first_name: 'Anna', country: 'AT' })
      const asStaff = await staffA.from('guests').select('id').eq('id', g.id)
      expect(asStaff.data).toHaveLength(1)
      const asOther = await ownerB.from('guests').select('id').eq('id', g.id)
      expect(asOther.data).toHaveLength(0)
      const insertForeign = await ownerB.from('guests').insert({ tenant_id: tenantA, last_name: 'X', country: 'AT' })
      expect(insertForeign.error).not.toBeNull()
    })

    it('Mitarbeiter legen nicht direkt an und ändern nicht', async () => {
      const g = await guest(ownerA, tenantA, { last_name: 'Rossi', country: 'IT' })
      const insert = await staffA.from('guests').insert({ tenant_id: tenantA, last_name: 'Staff', country: 'AT' })
      expect(insert.error).not.toBeNull()
      const update = await staffA.from('guests').update({ note: 'geändert' }).eq('id', g.id).select('id')
      expect(update.data ?? []).toHaveLength(0)
      const del = await ownerA.from('guests').delete().eq('id', g.id)
      expect(del.error).not.toBeNull()
      const rpc = await staffA.rpc('delete_guest', { p_guest_id: g.id })
      expect(rpc.error?.code).toBe('P0701')
    })
  })

  describe('Regeln in der Datenbank', () => {
    it('verlangt Nachname und gültiges Land, lehnt Geburtsdaten in der Zukunft ab', async () => {
      expect((await ownerA.from('guests').insert({ tenant_id: tenantA, last_name: '', country: 'AT' })).error).not.toBeNull()
      expect((await ownerA.from('guests').insert({ tenant_id: tenantA, last_name: 'X', country: 'at' })).error).not.toBeNull()
      const future = await ownerA.from('guests').insert({ tenant_id: tenantA, last_name: 'X', country: 'AT', birth_date: '2999-01-01' })
      expect(future.error?.code).toBe('23514')
      const both = await ownerA
        .from('guests')
        .insert({ tenant_id: tenantA, last_name: 'X', country: 'AT', marketing_source: 'website', marketing_custom: 'Messe' })
      expect(both.error).not.toBeNull()
    })

    it('schützt vor Überschreiben: Änderung mit veraltetem Stand trifft nichts', async () => {
      const g = await guest(ownerA, tenantA, { last_name: 'Stale', country: 'AT' })
      const first = await ownerA.from('guests').update({ note: 'eins' }).eq('id', g.id).eq('updated_at', g.updated_at).select('id')
      expect(first.data).toHaveLength(1)
      const second = await ownerA.from('guests').update({ note: 'zwei' }).eq('id', g.id).eq('updated_at', g.updated_at).select('id')
      expect(second.data).toHaveLength(0)
    })
  })

  describe('Suche', () => {
    it('findet ohne Groß-/Kleinschreibung und Akzente, auch über Firma und Telefon; blättert', async () => {
      await guest(ownerA, tenantA, { last_name: 'Dupré', first_name: 'René', country: 'FR', company_name: 'Søren Bau GmbH', phone: '+43 664 9876543' })
      const byName = await ownerA.rpc('guest_list', { p_tenant_id: tenantA, p_query: 'rene dupre' })
      expect(byName.data?.map((r) => r.last_name)).toContain('Dupré')
      const byCompany = await ownerA.rpc('guest_list', { p_tenant_id: tenantA, p_query: 'soren' })
      expect(byCompany.data?.map((r) => r.last_name)).toContain('Dupré')
      const byPhone = await ownerA.rpc('guest_list', { p_tenant_id: tenantA, p_query: '9876543' })
      expect(byPhone.data?.map((r) => r.last_name)).toContain('Dupré')
      const wildcard = await ownerA.rpc('guest_list', { p_tenant_id: tenantA, p_query: '%' })
      expect(wildcard.data).toHaveLength(0)
      const byCountry = await ownerA.rpc('guest_list', { p_tenant_id: tenantA, p_country: 'FR' })
      expect(byCountry.data?.every((r) => r.country === 'FR')).toBe(true)
      const page = await ownerA.rpc('guest_list', { p_tenant_id: tenantA, p_limit: 1, p_offset: 0 })
      expect(page.data).toHaveLength(1)
      expect(Number(page.data?.[0].total)).toBeGreaterThan(1)
      const foreign = await ownerB.rpc('guest_list', { p_tenant_id: tenantA })
      expect(foreign.data).toHaveLength(0)
    })

    it('filtert nach eigener Angabe und „keine Angabe“', async () => {
      const t = await newTenant([[ownerUserA, 'owner']])
      await guest(ownerA, t, { last_name: 'Quelle1', country: 'AT', marketing_custom: 'Messe Graz 2026' })
      await guest(ownerA, t, { last_name: 'Quelle2', country: 'AT', marketing_source: 'instagram' })
      await guest(ownerA, t, { last_name: 'Quelle3', country: 'AT' })
      const custom = await ownerA.rpc('guest_list', { p_tenant_id: t, p_marketing: 'custom' })
      expect(custom.data?.map((r) => r.last_name)).toEqual(['Quelle1'])
      const none = await ownerA.rpc('guest_list', { p_tenant_id: t, p_marketing: 'none' })
      expect(none.data?.map((r) => r.last_name)).toEqual(['Quelle3'])
      const insta = await ownerA.rpc('guest_list', { p_tenant_id: t, p_marketing: 'instagram' })
      expect(insta.data?.map((r) => r.last_name)).toEqual(['Quelle2'])
    })
  })

  describe('Dubletten', () => {
    let t: string
    beforeAll(async () => {
      t = await newTenant([
        [ownerUserA, 'owner'],
        [staffUserA, 'staff'],
      ])
    })

    it('findet Paare nach E-Mail, Telefon und Name; ignoriert Relay-Adressen; nur für Inhaber', async () => {
      const a = await guest(ownerA, t, { last_name: 'Berger', first_name: 'Eva', country: 'AT', email: 'eva@example.at' })
      const b = await guest(ownerA, t, { last_name: 'Bergér', first_name: 'eva', country: 'AT', email: 'eva@example.at', phone: '+43 316 123456' })
      const c = await guest(ownerA, t, { last_name: 'Anders', country: 'DE', phone: '0043 316 123456' })
      await guest(ownerA, t, { last_name: 'Relay1', country: 'AT', email: 'x@guest.booking.com' })
      await guest(ownerA, t, { last_name: 'Relay2', country: 'AT', email: 'x@guest.booking.com' })

      const pairs = await ownerA.rpc('guest_duplicate_pairs', { p_tenant_id: t })
      expect(pairs.error).toBeNull()
      const key = (x: string, y: string) => [x, y].sort().join()
      const found = new Map((pairs.data ?? []).map((p) => [key(p.guest_a, p.guest_b), p.reasons]))
      expect(found.get(key(a.id, b.id))).toEqual(['email', 'name'])
      // „0043 316 …“ und „+43 316 …“ haben verschiedene Ziffern → kein Telefon-Paar
      expect(found.has(key(b.id, c.id))).toBe(false)
      expect(found.size).toBe(1)

      const staff = await staffA.rpc('guest_duplicate_pairs', { p_tenant_id: t })
      expect(staff.error?.code).toBe('P0701')

      const candidates = await ownerA.rpc('guest_duplicate_candidates', {
        p_tenant_id: t,
        p_last_name: 'BERGER',
        p_first_name: 'Éva',
        p_email: '',
        p_phone: '',
      })
      expect(candidates.data?.map((d) => d.id).sort()).toEqual([a.id, b.id].sort())
    })

    it('„Kein Doppeleintrag“ blendet das Paar dauerhaft aus', async () => {
      const a = await guest(ownerA, t, { last_name: 'Gleich', first_name: 'Max', country: 'AT' })
      const b = await guest(ownerA, t, { last_name: 'Gleich', first_name: 'Max', country: 'DE' })
      const [x, y] = [a.id, b.id].sort()
      expect((await staffA.from('guest_duplicate_dismissals').insert({ tenant_id: t, guest_a: x, guest_b: y })).error).not.toBeNull()
      expect((await ownerA.from('guest_duplicate_dismissals').insert({ tenant_id: t, guest_a: x, guest_b: y })).error).toBeNull()
      const pairs = await ownerA.rpc('guest_duplicate_pairs', { p_tenant_id: t })
      expect((pairs.data ?? []).some((p) => [p.guest_a, p.guest_b].sort().join() === [x, y].join())).toBe(false)
    })
  })

  describe('Zusammenführen', () => {
    const choice = (over: Record<string, 'a' | 'b'> = {}) => ({
      name: 'a', country: 'a', email: 'a', phone: 'a', language: 'a', birthDate: 'a', address: 'a', marketing: 'a', company: 'a', note: 'a', ...over,
    })

    it('übernimmt je Angabe den gewählten Wert und entfernt den zweiten Gast (mit Protokoll-Verknüpfung)', async () => {
      const keep = await guest(ownerA, tenantA, { last_name: 'Merge', first_name: 'Ana', country: 'AT', email: 'a.relay@guest.booking.com', note: 'Notiz A' })
      await service.from('guests').update({ email_source: 'platform' }).eq('id', keep.id)
      const remove = await guest(ownerA, tenantA, { last_name: 'Merge', first_name: 'Anna', country: 'AT', email: 'anna@example.at', phone: '+43 1 234567' })

      const { error } = await ownerA.rpc('merge_guests', { p_keep: keep.id, p_remove: remove.id, p_choice: choice({ name: 'b', email: 'b', phone: 'b' }) })
      expect(error).toBeNull()
      const { data } = await ownerA.from('guests').select('first_name, email, email_source, phone, note').eq('id', keep.id).single()
      expect(data).toEqual({ first_name: 'Anna', email: 'anna@example.at', email_source: 'direct', phone: '+43 1 234567', note: 'Notiz A' })
      expect((await ownerA.from('guests').select('id').eq('id', remove.id)).data).toHaveLength(0)

      const log = await ownerA.from('audit_log').select('new_data').eq('table_name', 'guests').eq('record_id', keep.id)
      expect((log.data ?? []).some((e) => (e.new_data as { merged_from?: string } | null)?.merged_from === remove.id)).toBe(true)
    })

    it('verweigert sich selbst, fremde Kunden und Mitarbeiter', async () => {
      const a = await guest(ownerA, tenantA, { last_name: 'Solo', country: 'AT' })
      const foreign = await guest(ownerB, tenantB, { last_name: 'Fremd', country: 'AT' })
      expect((await ownerA.rpc('merge_guests', { p_keep: a.id, p_remove: a.id, p_choice: choice() })).error?.code).toBe('P0704')
      expect((await ownerA.rpc('merge_guests', { p_keep: a.id, p_remove: foreign.id, p_choice: choice() })).error?.code).toBe('P0704')
      const b = await guest(ownerA, tenantA, { last_name: 'Solo2', country: 'AT' })
      expect((await staffA.rpc('merge_guests', { p_keep: a.id, p_remove: b.id, p_choice: choice() })).error?.code).toBe('P0701')
      // nichts verändert
      expect((await ownerA.from('guests').select('id').in('id', [a.id, b.id])).data).toHaveLength(2)
    })
  })

  describe('Löschen und Anonymisieren', () => {
    it('löscht einen Gast ohne Buchungen endgültig und entfernt seine Altwerte aus dem Protokoll', async () => {
      const g = await guest(ownerA, tenantA, { last_name: 'Weg', first_name: 'Willi', country: 'AT', email: 'willi@example.at' })
      await ownerA.from('guests').update({ note: 'vorher' }).eq('id', g.id)
      const { data, error } = await ownerA.rpc('delete_guest', { p_guest_id: g.id })
      expect(error).toBeNull()
      expect(data).toBe('deleted')
      expect((await service.from('guests').select('id').eq('id', g.id)).data).toHaveLength(0)
      const log = await service.from('audit_log').select('action, old_data, new_data').eq('table_name', 'guests').eq('record_id', g.id)
      expect(log.data?.map((e) => e.action)).toContain('delete')
      expect(log.data?.every((e) => e.old_data === null && e.new_data === null)).toBe(true)
    })

    it('anonymisiert: Personenangaben weg, Herkunftsland bleibt, keine Änderungen mehr möglich', async () => {
      const g = await guest(ownerA, tenantA, { last_name: 'Anonym', first_name: 'Anja', country: 'NL', email: 'anja@example.nl', note: 'privat' })
      // Bis PROJ-8 hat kein Gast Buchungen; anonymisiert wird daher direkt (nur mit dem Secret Key möglich)
      expect((await ownerA.rpc('anonymize_guest', { p_guest_id: g.id })).error).not.toBeNull()
      const { error } = await service.rpc('anonymize_guest', { p_guest_id: g.id })
      expect(error).toBeNull()
      const { data } = await ownerA.from('guests').select('last_name, first_name, email, note, country, anonymized_at').eq('id', g.id).single()
      expect(data).toMatchObject({ last_name: 'Gelöschter Gast', first_name: null, email: null, note: null, country: 'NL' })
      expect(data?.anonymized_at).not.toBeNull()
      const update = await ownerA.from('guests').update({ note: 'neu' }).eq('id', g.id).select('id')
      expect(update.data ?? []).toHaveLength(0)
      expect((await ownerA.rpc('delete_guest', { p_guest_id: g.id })).error?.code).toBe('P0703')
      const log = await service.from('audit_log').select('old_data, new_data').eq('table_name', 'guests').eq('record_id', g.id)
      expect(log.data?.every((e) => e.old_data === null && e.new_data === null)).toBe(true)
    })
  })
})
