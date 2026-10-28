// @vitest-environment node
//
// PROJ-6: Objekte, Wohnungen und Gemeindeliste gegen „apppa-dev“ (übersprungen ohne .env.local)
import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { anonClient, type Client, hasSupabaseEnv, serviceClient, type TestUser } from './helpers'
import { sharedClient } from './shared-sessions'

const ST_GILGEN = '50330'
const SALZBURG = '50101'

describe.skipIf(!hasSupabaseEnv)('PROJ-6 Wohnungsverwaltung', () => {
  let service: Client
  const tenants: string[] = []
  let tenantA: string, tenantB: string
  let ownerA: Client, staffA: Client, ownerB: Client
  const runId = randomUUID().slice(0, 8)

  const newTenant = async (members: [TestUser, 'owner' | 'staff'][]) => {
    const { data, error } = await service.from('tenants').insert({ name: `PROJ-6 Test ${runId}` }).select('id').single()
    if (error) throw error
    tenants.push(data.id)
    for (const [u, role] of members) {
      const { error: e } = await service.from('memberships').insert({ tenant_id: data.id, user_id: u.id, role })
      if (e) throw e
    }
    return data.id
  }
  const property = (client: Client, tenantId: string, name: string, municipality = ST_GILGEN) =>
    client
      .from('properties')
      .insert({ tenant_id: tenantId, name, street: 'Seeweg 1', postal_code: '5340', city: 'St. Gilgen', municipality_code: municipality })
      .select('id')
      .single()
  const apartment = (client: Client, tenantId: string, propertyId: string, name: string) =>
    client.from('apartments').insert({ tenant_id: tenantId, property_id: propertyId, name, max_guests: 4 }).select('id').single()

  beforeAll(async () => {
    service = serviceClient()
    const [oa, sa, ob] = await Promise.all([sharedClient('ownerA'), sharedClient('staffA'), sharedClient('ownerB')])
    ;[ownerA, staffA, ownerB] = [oa.client, sa.client, ob.client]
    const [a, s, b] = [oa.user, sa.user, ob.user]
    tenantA = await newTenant([
      [a, 'owner'],
      [s, 'staff'],
    ])
    tenantB = await newTenant([[b, 'owner']])
  }, 60_000)

  afterAll(async () => {
    if (!service) return
    // Löschen des Kunden entfernt Objekte und Wohnungen gemeinsam (Prüfung am Ende der Anweisung)
    for (const id of tenants) {
      const { error } = await service.from('tenants').delete().eq('id', id)
      if (error) console.error('Aufräumen fehlgeschlagen', error.message)
    }
  }, 60_000)

  describe('Gemeindeliste', () => {
    it('ist vollständig, für Angemeldete lesbar, für niemanden über die App beschreibbar', async () => {
      const { count } = await ownerA.from('municipalities').select('code', { count: 'exact', head: true })
      expect(count).toBeGreaterThan(2000)
      const anon = await anonClient().from('municipalities').select('code').limit(1)
      expect(anon.data ?? []).toHaveLength(0)
      const insert = await ownerA.from('municipalities').insert({ code: '99999', name: 'X', state: 'wien', search_key: 'x' })
      expect(insert.error).not.toBeNull()
      const update = await ownerA.from('municipalities').update({ name: 'Gehackt' }).eq('code', ST_GILGEN).select('code')
      expect(update.data ?? []).toHaveLength(0)
    })

    it('Suchname findet „Sankt“ und Umlaute; Wien ist eine Gemeinde mit allen Bezirks-PLZ', async () => {
      const { data } = await ownerA.from('municipalities').select('code, name, state').like('search_key', '%sankt gilgen%')
      expect(data).toEqual([{ code: ST_GILGEN, name: 'St. Gilgen', state: 'salzburg' }])
      const wien = await ownerA.from('municipality_postal_codes').select('postal_code').eq('municipality_code', '90001')
      expect((wien.data ?? []).length).toBeGreaterThanOrEqual(23)
    })

    it('PLZ-Zuordnung: 5340 gehört nur zu St. Gilgen; 5360 zu mehreren Gemeinden (u. a. St. Gilgen, St. Wolfgang)', async () => {
      const own = await ownerA.from('municipality_postal_codes').select('municipality_code').eq('postal_code', '5340')
      expect((own.data ?? []).map((r) => r.municipality_code)).toEqual([ST_GILGEN])
      const shared = await ownerA.from('municipality_postal_codes').select('municipality_code').eq('postal_code', '5360')
      expect((shared.data ?? []).map((r) => r.municipality_code)).toEqual(expect.arrayContaining([ST_GILGEN, '40717']))
    })
  })

  describe('Rechte und Abschottung', () => {
    it('Inhaber legt an; Mitarbeiter liest, schreibt aber nicht; anderer Kunde sieht nichts', async () => {
      const p = await property(ownerA, tenantA, 'Haus Seeblick')
      expect(p.error).toBeNull()
      const a = await apartment(ownerA, tenantA, p.data!.id, 'Top 1')
      expect(a.error).toBeNull()

      expect((await staffA.from('apartments').select('id').eq('id', a.data!.id)).data).toHaveLength(1)
      expect((await apartment(staffA, tenantA, p.data!.id, 'Top 9')).error).not.toBeNull()
      const staffUpdate = await staffA.from('apartments').update({ max_guests: 9 }).eq('id', a.data!.id).select('id')
      expect(staffUpdate.data ?? []).toHaveLength(0)
      const staffDelete = await staffA.from('apartments').delete().eq('id', a.data!.id).select('id')
      expect(staffDelete.data ?? []).toHaveLength(0)

      expect((await ownerB.from('properties').select('id').eq('id', p.data!.id)).data).toHaveLength(0)
      expect((await ownerB.from('apartments').select('id').eq('id', a.data!.id)).data).toHaveLength(0)
      expect((await property(ownerB, tenantA, 'Fremd')).error).not.toBeNull()
    })

    it('Wohnung kann nicht an das Objekt eines anderen Kunden gehängt werden', async () => {
      const pB = await property(ownerB, tenantB, 'Haus B')
      const cross = await apartment(ownerA, tenantA, pB.data!.id, 'Eindringling')
      expect(cross.error).not.toBeNull()
    })

    it('Kunden-Kennung einer Wohnung lässt sich nicht ändern', async () => {
      const p = await property(ownerA, tenantA, 'Haus Kennung')
      const a = await apartment(ownerA, tenantA, p.data!.id, 'Top 1')
      const move = await ownerA.from('apartments').update({ tenant_id: tenantB } as never).eq('id', a.data!.id)
      expect(move.error).not.toBeNull()
    })
  })

  describe('Regeln', () => {
    it('Wohnungsname eindeutig je Objekt (ohne Groß-/Kleinschreibung), gleiche Namen in anderen Objekten erlaubt', async () => {
      const p1 = await property(ownerA, tenantA, 'Haus Eins')
      const p2 = await property(ownerA, tenantA, 'Haus Zwei')
      expect((await apartment(ownerA, tenantA, p1.data!.id, 'Top 1')).error).toBeNull()
      const dup = await apartment(ownerA, tenantA, p1.data!.id, 'top 1')
      expect(dup.error?.code).toBe('23505')
      expect(dup.error?.message).toContain('apartments_property_name_key')
      expect((await apartment(ownerA, tenantA, p2.data!.id, 'Top 1')).error).toBeNull()
    })

    it('Objektname eindeutig je Kunde; anderer Kunde darf denselben Namen haben', async () => {
      expect((await property(ownerA, tenantA, 'Haus Doppelt')).error).toBeNull()
      const dup = await property(ownerA, tenantA, 'haus doppelt')
      expect(dup.error?.message).toContain('properties_tenant_name_key')
      expect((await property(ownerB, tenantB, 'Haus Doppelt')).error).toBeNull()
    })

    it('Objekt mit Wohnungen (auch archivierten) ist nicht löschbar; danach schon', async () => {
      const p = await property(ownerA, tenantA, 'Haus Löschen')
      const a = await apartment(ownerA, tenantA, p.data!.id, 'Top 1')
      await ownerA.from('apartments').update({ archived_at: new Date().toISOString() }).eq('id', a.data!.id)
      const blocked = await ownerA.from('properties').delete().eq('id', p.data!.id)
      expect(blocked.error?.code).toBe('23503')
      expect(blocked.error?.message).toContain('apartments_property_fkey')
      await ownerA.from('apartments').delete().eq('id', a.data!.id)
      const ok = await ownerA.from('properties').delete().eq('id', p.data!.id).select('id')
      expect(ok.data).toHaveLength(1)
    })

    it('Wohnung samt neuem Objekt in einem Zug; scheitert die Wohnung, entsteht auch kein Objekt', async () => {
      const args = {
        p_tenant_id: tenantA,
        p_property_name: 'Haus Neu',
        p_street: 'Bergweg 2',
        p_postal_code: '5020',
        p_city: 'Salzburg',
        p_municipality_code: SALZBURG,
        p_name: 'Top 1',
        p_max_guests: 4,
        p_kind: 'service',
        p_price_cents: 9900,
        p_check_in: '14:00',
        p_check_out: '11:00',
        p_note: null as unknown as string,
      }
      const ok = await ownerA.rpc('create_apartment_with_property', args)
      expect(ok.error).toBeNull()
      const { data: created } = await ownerA.from('apartments').select('kind, price_cents, check_in, property:properties!inner(name)').eq('id', ok.data!).single()
      expect(created).toMatchObject({ kind: 'service', price_cents: 9900, check_in: '14:00:00', property: { name: 'Haus Neu' } })

      const failed = await ownerA.rpc('create_apartment_with_property', { ...args, p_property_name: 'Haus Fehler', p_max_guests: 0 })
      expect(failed.error).not.toBeNull()
      expect((await ownerA.from('properties').select('id').eq('name', 'Haus Fehler')).data).toHaveLength(0)

      const staff = await staffA.rpc('create_apartment_with_property', { ...args, p_property_name: 'Haus Mitarbeiter' })
      expect(staff.error).not.toBeNull()
    })

    it('Änderungen stehen im Änderungsprotokoll', async () => {
      const p = await property(ownerA, tenantA, 'Haus Protokoll')
      await ownerA.from('properties').update({ street: 'Neuer Weg 3' }).eq('id', p.data!.id)
      const { data } = await ownerA.from('audit_log').select('action').eq('table_name', 'properties').eq('record_id', p.data!.id)
      expect((data ?? []).map((r) => r.action).sort()).toEqual(['insert', 'update'])
    })
  })
})
