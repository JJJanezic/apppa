// @vitest-environment node
//
// PROJ-49: Firmenvorschläge im Gastformular gegen „apppa-dev“ (übersprungen ohne .env.local)
import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { type Client, hasSupabaseEnv, serviceClient } from './helpers'
import { sharedClient } from './shared-sessions'

describe.skipIf(!hasSupabaseEnv)('PROJ-49 Firmenvorschläge', () => {
  let service: Client
  const tenants: string[] = []
  let tenantA: string, tenantB: string
  let ownerA: Client, staffA: Client, ownerB: Client
  const runId = randomUUID().slice(0, 8)

  type Company = {
    company_name: string
    company_vat_id?: string | null
    company_address_line1?: string | null
    company_address_line2?: string | null
    company_postal_code?: string | null
    company_city?: string | null
    company_country?: string | null
  }
  const guest = async (tenantId: string, lastName: string, company: Company | null) => {
    const { data, error } = await ownerFor(tenantId)
      .from('guests')
      .insert({ tenant_id: tenantId, last_name: lastName, country: 'AT', ...(company ?? {}) })
      .select('id')
      .single()
    if (error) throw error
    return data.id
  }
  const ownerFor = (tenantId: string) => (tenantId === tenantA ? ownerA : ownerB)
  const suggest = (client: Client, tenantId: string, query: string, excludeId?: string) =>
    client.rpc('guest_company_suggestions', { p_tenant_id: tenantId, p_query: query, p_exclude_id: excludeId })
  const names = (rows: { company_name: string }[] | null) => (rows ?? []).map((r) => r.company_name)

  beforeAll(async () => {
    service = serviceClient()
    const [oa, sa, ob] = await Promise.all([sharedClient('ownerA'), sharedClient('staffA'), sharedClient('ownerB')])
    ;[ownerA, staffA, ownerB] = [oa.client, sa.client, ob.client]
    const newTenant = async (members: [typeof oa.user, 'owner' | 'staff'][]) => {
      const { data, error } = await service.from('tenants').insert({ name: `PROJ-49 Test ${runId}` }).select('id').single()
      if (error) throw error
      tenants.push(data.id)
      for (const [u, role] of members) {
        const { error: e } = await service.from('memberships').insert({ tenant_id: data.id, user_id: u.id, role })
        if (e) throw e
      }
      return data.id
    }
    tenantA = await newTenant([
      [oa.user, 'owner'],
      [sa.user, 'staff'],
    ])
    tenantB = await newTenant([[ob.user, 'owner']])
  }, 60_000)

  afterAll(async () => {
    if (!service) return
    for (const id of tenants) {
      const { error } = await service.from('tenants').delete().eq('id', id)
      if (error) console.error('Aufräumen fehlgeschlagen', error.message)
    }
  }, 60_000)

  it('findet im Firmennamen ohne Rücksicht auf Groß-/Kleinschreibung und Umlaute, ab 2 Zeichen', async () => {
    const name = `Hotel Müller ${runId} KG`
    await guest(tenantA, 'Gast1', { company_name: name, company_city: 'Wien' })
    const found = await suggest(ownerA, tenantA, `MULLER ${runId}`)
    expect(found.error).toBeNull()
    expect(names(found.data)).toEqual([name])
    expect(found.data?.[0]).toEqual({
      company_name: name,
      company_vat_id: null,
      company_address_line1: null,
      company_address_line2: null,
      company_postal_code: null,
      company_city: 'Wien',
      company_country: null,
    })
    const short = await suggest(ownerA, tenantA, 'h')
    expect(short.data).toEqual([])
  })

  it('sucht nur im Firmennamen, nicht im Gastnamen oder in der UID', async () => {
    await guest(tenantA, `Nachname${runId}`, { company_name: `Ohne Treffer ${runId}`, company_vat_id: `ATU${runId}` })
    const byLastName = await suggest(ownerA, tenantA, `nachname${runId}`)
    expect(byLastName.data).toEqual([])
    const byVat = await suggest(ownerA, tenantA, `ATU${runId}`)
    expect(byVat.data).toEqual([])
  })

  it('nimmt LIKE-Platzhalter wörtlich', async () => {
    await guest(tenantA, 'Gast2', { company_name: `Prozent ${runId} AG` })
    const wildcard = await suggest(ownerA, tenantA, `%${runId}%`)
    expect(wildcard.data).toEqual([])
  })

  it('fasst gleiche Fassungen zusammen (Schreibung, Leerzeichen) und zeigt die zuletzt geänderte', async () => {
    const base = { company_vat_id: 'ATU11111111', company_address_line1: 'Hauptstraße 1', company_postal_code: '1010', company_city: 'Wien', company_country: 'AT' }
    await guest(tenantA, 'Alt', { ...base, company_name: `Gleich ${runId} GmbH` })
    await guest(tenantA, 'Neu', { ...base, company_name: `gleich ${runId} gmbh `, company_city: 'wien' })
    const rows = await suggest(ownerA, tenantA, `gleich ${runId}`)
    expect(rows.data).toHaveLength(1)
    expect(rows.data?.[0].company_name.trim()).toBe(`gleich ${runId} gmbh`)
    expect(rows.data?.[0].company_city).toBe('wien')
  })

  it('zeigt unterschiedliche Fassungen getrennt, zuletzt geänderte zuerst', async () => {
    const name = `Fassung ${runId} GmbH`
    await guest(tenantA, 'Eins', { company_name: name, company_address_line1: 'Ringstraße 5' })
    await guest(tenantA, 'Zwei', { company_name: name, company_address_line1: 'Hauptstraße 1' })
    await guest(tenantA, 'Drei', { company_name: name, company_address_line1: 'Hauptstraße 1', company_vat_id: 'ATU22222222' })
    const rows = await suggest(ownerA, tenantA, `fassung ${runId}`)
    expect((rows.data ?? []).map((r) => [r.company_address_line1, r.company_vat_id])).toEqual([
      ['Hauptstraße 1', 'ATU22222222'],
      ['Hauptstraße 1', null],
      ['Ringstraße 5', null],
    ])
  })

  it('liefert höchstens 8 Vorschläge', async () => {
    for (let i = 0; i < 10; i++) await guest(tenantA, `Viele${i}`, { company_name: `Viele ${runId} Nr ${i}` })
    const rows = await suggest(ownerA, tenantA, `viele ${runId}`)
    expect(rows.data).toHaveLength(8)
    // zuletzt angelegt zuerst
    expect(rows.data?.[0].company_name).toBe(`Viele ${runId} Nr 9`)
  })

  it('schließt den bearbeiteten Gast und anonymisierte Gäste aus', async () => {
    const own = await guest(tenantA, 'Eigen', { company_name: `Eigen ${runId} OG` })
    expect(names((await suggest(ownerA, tenantA, `eigen ${runId}`)).data)).toHaveLength(1)
    expect((await suggest(ownerA, tenantA, `eigen ${runId}`, own)).data).toEqual([])

    const anon = await guest(tenantA, 'Anonym', { company_name: `Anonym ${runId} KG` })
    const { error } = await service.from('guests').update({ anonymized_at: new Date().toISOString() }).eq('id', anon)
    if (error) throw error
    expect((await suggest(ownerA, tenantA, `anonym ${runId}`)).data).toEqual([])
  })

  it('Mitarbeiter erhalten Vorschläge; fremde Kunden nie', async () => {
    const name = `Geteilt ${runId} GmbH`
    await guest(tenantA, 'Geteilt', { company_name: name })
    expect(names((await suggest(staffA, tenantA, `geteilt ${runId}`)).data)).toEqual([name])
    // Inhaber eines anderen Kunden fragt mit der Kennung von Kunde A
    expect((await suggest(ownerB, tenantA, `geteilt ${runId}`)).data).toEqual([])
    // und im eigenen Kunden gibt es die Firma nicht
    expect((await suggest(ownerB, tenantB, `geteilt ${runId}`)).data).toEqual([])
  })
})
