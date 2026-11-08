// @vitest-environment node
//
// PROJ-50: Firmenliste gegen „apppa-dev“ (übersprungen ohne .env.local)
import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { type Client, hasSupabaseEnv, serviceClient } from './helpers'
import { sharedClient } from './shared-sessions'

describe.skipIf(!hasSupabaseEnv)('PROJ-50 Firmenliste', () => {
  let service: Client
  const tenants: string[] = []
  let tenantA: string, tenantB: string
  let ownerA: Client, staffA: Client, ownerB: Client
  const runId = randomUUID().slice(0, 8)

  const newTenant = async (members: [string, 'owner' | 'staff'][]) => {
    const { data, error } = await service.from('tenants').insert({ name: `PROJ-50 Test ${runId}` }).select('id').single()
    if (error) throw error
    tenants.push(data.id)
    for (const [userId, role] of members) {
      const { error: e } = await service.from('memberships').insert({ tenant_id: data.id, user_id: userId, role })
      if (e) throw e
    }
    return data.id
  }
  const company = async (client: Client, tenantId: string, fields: { name: string } & Record<string, string | null>) => {
    const { data, error } = await client.from('companies').insert({ tenant_id: tenantId, ...fields }).select('id, updated_at').single()
    if (error) throw error
    return data
  }
  const guestInput = (tenantId: string, lastName: string, extra: Record<string, unknown> = {}) => ({
    tenant_id: tenantId,
    last_name: lastName,
    country: 'AT',
    gender: 'unspecified',
    ...extra,
  })
  const saveGuest = (client: Client, input: Record<string, unknown>) => client.rpc('save_guest', { p_input: input as never })
  const guestRow = async (id: string) =>
    (await service.from('guests').select('id, company_id, updated_at, email_source').eq('id', id).single()).data!
  const choice = (over: Record<string, 'a' | 'b'> = {}) => ({ name: 'a', vatId: 'a', address: 'a', email: 'a', website: 'a', contact: 'a', ...over })

  beforeAll(async () => {
    service = serviceClient()
    const [oa, sa, ob] = await Promise.all([sharedClient('ownerA'), sharedClient('staffA'), sharedClient('ownerB')])
    ;[ownerA, staffA, ownerB] = [oa.client, sa.client, ob.client]
    tenantA = await newTenant([
      [oa.user.id, 'owner'],
      [sa.user.id, 'staff'],
    ])
    tenantB = await newTenant([[ob.user.id, 'owner']])
  }, 60_000)

  afterAll(async () => {
    if (!service) return
    for (const id of tenants) {
      const { error } = await service.from('tenants').delete().eq('id', id)
      if (error) console.error('Aufräumen fehlgeschlagen', error.message)
    }
  }, 60_000)

  describe('Abschottung und Rollen', () => {
    it('Inhaber legt an und ändert; Mitglieder lesen; fremde Kunden sehen nichts', async () => {
      const c = await company(ownerA, tenantA, { name: `Rolle ${runId}` })
      expect((await staffA.from('companies').select('id').eq('id', c.id)).data).toHaveLength(1)
      expect((await ownerB.from('companies').select('id').eq('id', c.id)).data).toHaveLength(0)
      expect((await ownerB.from('companies').insert({ tenant_id: tenantA, name: 'Fremd' })).error).not.toBeNull()
      expect((await ownerA.from('companies').update({ city: 'Graz' }).eq('id', c.id).select('id')).data).toHaveLength(1)
    })

    it('Mitarbeiter legen nicht direkt an, ändern und löschen nicht', async () => {
      const c = await company(ownerA, tenantA, { name: `Staff ${runId}` })
      expect((await staffA.from('companies').insert({ tenant_id: tenantA, name: 'Staff GmbH' })).error).not.toBeNull()
      expect((await staffA.from('companies').update({ city: 'Linz' }).eq('id', c.id).select('id')).data ?? []).toHaveLength(0)
      expect((await ownerA.from('companies').delete().eq('id', c.id)).error).not.toBeNull()
      expect((await staffA.rpc('delete_company', { p_company_id: c.id })).error?.code).toBe('P0701')
      expect((await staffA.rpc('company_duplicate_pairs', { p_tenant_id: tenantA })).error?.code).toBe('P0701')
    })

    it('alte Firmenspalten am Gast sind nicht mehr beschreibbar', async () => {
      const { error } = await ownerA.from('guests').insert({ tenant_id: tenantA, last_name: 'Alt', country: 'AT', company_name: 'Alt GmbH' } as never)
      expect(error).not.toBeNull()
    })
  })

  describe('Regeln in der Datenbank', () => {
    it('verlangt den Namen und prüft Längen, E-Mail und Webadresse', async () => {
      const bad = [{ name: '  ' }, { name: 'x'.repeat(201) }, { name: 'A', email: 'Info@Firma.at' }, { name: 'A', website: 'www.fir ma.at' }, { name: 'A', address_line1: 'x'.repeat(201) }, { name: 'A', country: 'at' }]
      for (const fields of bad) {
        const { error } = await ownerA.from('companies').insert({ tenant_id: tenantA, ...fields })
        expect(error?.code, JSON.stringify(fields)).toBe('23514')
      }
    })

    it('Merker „Name fehlt“ fällt bei der ersten Namensänderung weg', async () => {
      const c = await company(ownerA, tenantA, { name: 'Firma ohne Namen' })
      await service.from('companies').update({ name_missing: true }).eq('id', c.id)
      await ownerA.from('companies').update({ vat_id: 'ATU55' }).eq('id', c.id)
      expect((await service.from('companies').select('name_missing').eq('id', c.id).single()).data?.name_missing).toBe(true)
      await ownerA.from('companies').update({ name: `Benannt ${runId}` }).eq('id', c.id)
      expect((await service.from('companies').select('name_missing').eq('id', c.id).single()).data?.name_missing).toBe(false)
    })
  })

  describe('Gast speichern (save_guest)', () => {
    it('legt Gast mit neuer Firma in einem Schritt an; ohne Namen nichts', async () => {
      const name = `Neu GmbH ${runId}`
      const bad = await saveGuest(ownerA, guestInput(tenantA, `Neu ${runId}`, { new_company: { name: ' ' } }))
      expect(bad.error).not.toBeNull()
      expect((await service.from('guests').select('id').eq('last_name', `Neu ${runId}`)).data).toHaveLength(0)

      const ok = await saveGuest(ownerA, guestInput(tenantA, `Neu ${runId}`, { new_company: { name, city: 'Wien', email: 'office@neu.at' } }))
      expect(ok.error).toBeNull()
      const g = await guestRow(ok.data as string)
      const c = (await service.from('companies').select('tenant_id, name, city, email').eq('id', g.company_id!).single()).data
      expect(c).toEqual({ tenant_id: tenantA, name, city: 'Wien', email: 'office@neu.at' })
    })

    it('verknüpft eine bestehende Firma; fremde oder unbekannte Firma → P0707', async () => {
      const c = await company(ownerA, tenantA, { name: `Bestand ${runId}` })
      const foreign = await company(ownerB, tenantB, { name: `Fremd ${runId}` })
      const ok = await saveGuest(ownerA, guestInput(tenantA, `Bestand ${runId}`, { company_id: c.id }))
      expect((await guestRow(ok.data as string)).company_id).toBe(c.id)
      expect((await saveGuest(ownerA, guestInput(tenantA, 'X', { company_id: foreign.id }))).error?.code).toBe('P0707')
      expect((await saveGuest(ownerA, guestInput(tenantA, 'X', { company_id: randomUUID() }))).error?.code).toBe('P0707')
    })

    it('Bearbeiten: veralteter Stand → P0706; „Keine Firma“ löst, Firma bleibt; Mitarbeiter → P0701', async () => {
      const c = await company(ownerA, tenantA, { name: `Lösen ${runId}` })
      const id = (await saveGuest(ownerA, guestInput(tenantA, `Lösen ${runId}`, { company_id: c.id }))).data as string
      const before = await guestRow(id)
      const edit = await saveGuest(ownerA, guestInput(tenantA, `Lösen ${runId}`, { id, updated_at: before.updated_at, company_id: null, email: 'a@b.at', email_source: 'direct' }))
      expect(edit.error).toBeNull()
      expect((await guestRow(id)).company_id).toBeNull()
      expect((await service.from('companies').select('id').eq('id', c.id)).data).toHaveLength(1)
      const stale = await saveGuest(ownerA, guestInput(tenantA, `Lösen ${runId}`, { id, updated_at: before.updated_at }))
      expect(stale.error?.code).toBe('P0706')
      expect((await saveGuest(staffA, guestInput(tenantA, 'Staff'))).error?.code).toBe('P0701')
      expect((await saveGuest(ownerB, guestInput(tenantA, 'Fremd'))).error?.code).toBe('P0701')
    })
  })

  describe('Liste und Suche', () => {
    it('sucht nach Name und UID ohne Schreibung und Umlaute, zählt Gäste, findet gleiche Namen', async () => {
      const c = await company(ownerA, tenantA, { name: `Hotel Müller KG ${runId}`, vat_id: 'ATU 123 456' })
      await saveGuest(ownerA, guestInput(tenantA, `Müllergast ${runId}`, { company_id: c.id }))
      const byName = await staffA.rpc('company_list', { p_tenant_id: tenantA, p_query: `muller ${runId}` })
      expect(byName.data?.map((r) => [r.id, r.guest_count])).toEqual([[c.id, 1]])
      const byVat = await staffA.rpc('company_list', { p_tenant_id: tenantA, p_query: 'atu123456' })
      expect(byVat.data?.map((r) => r.id)).toContain(c.id)
      const exact = await staffA.rpc('company_list', { p_tenant_id: tenantA, p_exact_name: ` HOTEL MULLER KG ${runId} ` })
      expect(exact.data?.map((r) => r.id)).toEqual([c.id])
      const excluded = await staffA.rpc('company_list', { p_tenant_id: tenantA, p_query: `muller ${runId}`, p_exclude_id: c.id })
      expect(excluded.data).toHaveLength(0)
      expect((await ownerB.rpc('company_list', { p_tenant_id: tenantA, p_query: `muller ${runId}` })).data).toHaveLength(0)
    })

    it('Gästeliste findet Gäste über den Firmennamen, auch nach Umbenennung', async () => {
      const c = await company(ownerA, tenantA, { name: `Søren Bau ${runId}` })
      const id = (await saveGuest(ownerA, guestInput(tenantA, `Sorengast ${runId}`, { company_id: c.id }))).data as string
      const found = await staffA.rpc('guest_list', { p_tenant_id: tenantA, p_query: `soren bau ${runId}` })
      expect(found.data?.map((r) => [r.id, r.company_id, r.company_name])).toEqual([[id, c.id, `Søren Bau ${runId}`]])
      await ownerA.from('companies').update({ name: `Holding ${runId}` }).eq('id', c.id)
      expect((await staffA.rpc('guest_list', { p_tenant_id: tenantA, p_query: `holding ${runId}` })).data?.map((r) => r.id)).toEqual([id])
    })
  })

  describe('Mögliche doppelte Firmen', () => {
    it('Paare nach Name oder UID, ohne Platzhalter-Namen; „Keine doppelte Firma“ blendet aus', async () => {
      const a = await company(ownerA, tenantA, { name: `Doppel GmbH ${runId}` })
      const b = await company(ownerA, tenantA, { name: ` doppel gmbh ${runId}`, vat_id: 'DE111' })
      const c = await company(ownerA, tenantA, { name: `Anders ${runId}`, vat_id: 'de 111' })
      const p1 = await company(ownerA, tenantA, { name: 'Firma ohne Namen' })
      const p2 = await company(ownerA, tenantA, { name: 'Firma ohne Namen' })
      await service.from('companies').update({ name_missing: true }).in('id', [p1.id, p2.id])
      const pairs = (await ownerA.rpc('company_duplicate_pairs', { p_tenant_id: tenantA })).data ?? []
      const key = (x: string, y: string) => [x, y].sort().join()
      const byKey = new Map(pairs.map((p) => [key(p.company_a, p.company_b), p.reasons]))
      expect(byKey.get(key(a.id, b.id))).toEqual(['name'])
      expect(byKey.get(key(b.id, c.id))).toEqual(['vatId'])
      expect(byKey.has(key(p1.id, p2.id))).toBe(false)

      const [x, y] = [a.id, b.id].sort()
      expect((await ownerA.from('company_duplicate_dismissals').insert({ tenant_id: tenantA, company_a: x, company_b: y })).error).toBeNull()
      const after = (await ownerA.rpc('company_duplicate_pairs', { p_tenant_id: tenantA })).data ?? []
      expect(after.some((p) => key(p.company_a, p.company_b) === key(a.id, b.id))).toBe(false)
      expect((await staffA.from('company_duplicate_dismissals').insert({ tenant_id: tenantA, company_a: x, company_b: y })).error).not.toBeNull()
    })
  })

  describe('Löschen', () => {
    it('löscht mit verknüpften Gästen, leert die Verknüpfung und die Altwerte im Protokoll', async () => {
      const c = await company(ownerA, tenantA, { name: `Weg ${runId}`, contact: 'Frau Maier', email: 'maier@weg.at' })
      const g1 = (await saveGuest(ownerA, guestInput(tenantA, `Weg1 ${runId}`, { company_id: c.id }))).data as string
      const g2 = (await saveGuest(ownerA, guestInput(tenantA, `Weg2 ${runId}`, { company_id: c.id }))).data as string
      const del = await ownerA.rpc('delete_company', { p_company_id: c.id })
      expect(del.error).toBeNull()
      expect(del.data).toBe(2)
      expect((await guestRow(g1)).company_id).toBeNull()
      expect((await guestRow(g2)).company_id).toBeNull()
      const log = await service.from('audit_log').select('old_data, new_data').eq('table_name', 'companies').eq('record_id', c.id)
      expect(log.data?.length).toBeGreaterThan(0)
      expect(log.data?.every((e) => e.old_data === null && e.new_data === null)).toBe(true)
      expect((await ownerA.rpc('delete_company', { p_company_id: c.id })).error?.code).toBe('P0702')
    })
  })

  describe('Zusammenführen', () => {
    it('übernimmt gewählte Angaben (Adresse als Ganzes), hängt Gäste um und löscht die zweite Firma', async () => {
      const keep = await company(ownerA, tenantA, { name: `Keep ${runId}`, vat_id: 'ATU9', city: 'Graz', address_line1: 'Alt 1' })
      const remove = await company(ownerA, tenantA, { name: `Remove ${runId}`, city: 'Wien', postal_code: '1010', email: 'neu@firma.at' })
      const g = (await saveGuest(ownerA, guestInput(tenantA, `Merge ${runId}`, { company_id: remove.id }))).data as string
      const res = await ownerA.rpc('merge_companies', { p_keep: keep.id, p_remove: remove.id, p_choice: choice({ address: 'b', email: 'b' }) })
      expect(res.error).toBeNull()
      const kept = (await service.from('companies').select('name, vat_id, address_line1, postal_code, city, email').eq('id', keep.id).single()).data
      expect(kept).toEqual({ name: `Keep ${runId}`, vat_id: 'ATU9', address_line1: null, postal_code: '1010', city: 'Wien', email: 'neu@firma.at' })
      expect((await service.from('companies').select('id').eq('id', remove.id)).data).toHaveLength(0)
      expect((await guestRow(g)).company_id).toBe(keep.id)
      const log = await service.from('audit_log').select('new_data').eq('table_name', 'companies').eq('record_id', keep.id)
      expect(log.data?.some((e) => (e.new_data as { merged_from?: string } | null)?.merged_from === remove.id)).toBe(true)
    })

    it('verweigert sich selbst, fremde Kunden und Mitarbeiter', async () => {
      const a = await company(ownerA, tenantA, { name: `SoloA ${runId}` })
      const b = await company(ownerA, tenantA, { name: `SoloB ${runId}` })
      const foreign = await company(ownerB, tenantB, { name: `SoloF ${runId}` })
      expect((await ownerA.rpc('merge_companies', { p_keep: a.id, p_remove: a.id, p_choice: choice() })).error?.code).toBe('P0704')
      expect((await ownerA.rpc('merge_companies', { p_keep: a.id, p_remove: foreign.id, p_choice: choice() })).error?.code).toBe('P0704')
      expect((await staffA.rpc('merge_companies', { p_keep: a.id, p_remove: b.id, p_choice: choice() })).error?.code).toBe('P0701')
      expect((await service.from('companies').select('id').in('id', [a.id, b.id])).data).toHaveLength(2)
    })
  })

  describe('Gäste zusammenführen und anonymisieren', () => {
    it('wählt beim Zusammenführen die Verknüpfung; Anonymisieren löst die Firma, die bleibt bestehen', async () => {
      const x = await company(ownerA, tenantA, { name: `GX ${runId}` })
      const y = await company(ownerA, tenantA, { name: `GY ${runId}` })
      const keep = (await saveGuest(ownerA, guestInput(tenantA, `GKeep ${runId}`, { company_id: x.id }))).data as string
      const remove = (await saveGuest(ownerA, guestInput(tenantA, `GRemove ${runId}`, { company_id: y.id }))).data as string
      const guestChoice = { name: 'a', country: 'a', email: 'a', phone: 'a', language: 'a', birthDate: 'a', address: 'a', marketing: 'a', company: 'b', note: 'a', titles: 'a', gender: 'a', document: 'a' }
      expect((await ownerA.rpc('merge_guests', { p_keep: keep, p_remove: remove, p_choice: guestChoice })).error).toBeNull()
      expect((await guestRow(keep)).company_id).toBe(y.id)

      expect((await service.rpc('anonymize_guest', { p_guest_id: keep })).error).toBeNull()
      expect((await guestRow(keep)).company_id).toBeNull()
      expect((await service.from('companies').select('id').eq('id', y.id)).data).toHaveLength(1)
    })
  })
})
