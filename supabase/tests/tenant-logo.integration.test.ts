// @vitest-environment node
//
// PROJ-38: Kunden-Logo gegen „apppa-dev“ (übersprungen ohne .env.local): Speicherfunktion, Speicherbereich
// „tenant-logos“ mit Zugriffsregeln, Bereinigung
import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { anonClient, type Client, hasSupabaseEnv, serviceClient, type TestUser } from './helpers'
import { sharedClient } from './shared-sessions'

const BUCKET = 'tenant-logos'
// 1×1 Pixel, durchsichtig
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
)

describe.skipIf(!hasSupabaseEnv)('PROJ-38 Kunden-Logo', () => {
  let service: Client
  const tenants: string[] = []
  let tenantA: string, tenantB: string
  let ownerA: Client, staffA: Client, ownerB: Client, admin: Client, adminAal1: Client
  const runId = randomUUID().slice(0, 8)

  const newTenant = async (members: [TestUser, 'owner' | 'staff'][]) => {
    const { data, error } = await service.from('tenants').insert({ name: `PROJ-38 Test ${runId}` }).select('id').single()
    if (error) throw error
    tenants.push(data.id)
    for (const [u, role] of members) {
      const { error: e } = await service.from('memberships').insert({ tenant_id: data.id, user_id: u.id, role })
      if (e) throw e
    }
    return data.id
  }
  const path = (tenantId: string) => `${tenantId}/${randomUUID()}.png`
  // Hochladen im Namen der Person (Zugriffsregeln des Speichers gelten)
  const upload = (client: Client, p: string, body: Buffer = PNG, contentType = 'image/png') =>
    client.storage.from(BUCKET).upload(p, body, { contentType })
  const canRead = async (client: Client, p: string) => {
    const { data, error } = await client.storage.from(BUCKET).createSignedUrl(p, 60)
    return !error && Boolean(data?.signedUrl)
  }
  const row = async (tenantId: string) => {
    const { data, error } = await service.from('tenants').select('name, logo_path, updated_at').eq('id', tenantId).single()
    if (error) throw error
    return data
  }
  // Stammdaten speichern wie die App; logo undefined = Schlüssel fehlt
  const save = async (client: Client, tenantId: string, logo?: string | null) => {
    const current = await row(tenantId)
    const data: Record<string, string | null> = { name: current.name }
    if (logo !== undefined) data.logo_path = logo
    return client.rpc('update_tenant_master_data', {
      p_tenant_id: tenantId,
      p_expected_updated_at: current.updated_at,
      p_data: data,
    })
  }
  const logEntries = async (tenantId: string) => {
    const { data } = await service.from('operator_log').select('changed_fields').eq('tenant_id', tenantId).eq('action', 'master_data')
    return data ?? []
  }

  beforeAll(async () => {
    service = serviceClient()
    const [oa, sa, ob, ad, ad1] = await Promise.all([
      sharedClient('ownerA'),
      sharedClient('staffA'),
      sharedClient('ownerB'),
      sharedClient('adminAal2'),
      sharedClient('adminAal1'),
    ])
    ;[ownerA, staffA, ownerB, admin, adminAal1] = [oa.client, sa.client, ob.client, ad.client, ad1.client]
    tenantA = await newTenant([
      [oa.user, 'owner'],
      [sa.user, 'staff'],
    ])
    tenantB = await newTenant([[ob.user, 'owner']])
  }, 60_000)

  afterAll(async () => {
    if (!service) return
    for (const id of tenants) {
      const { data } = await service.storage.from(BUCKET).list(id, { limit: 1000 })
      if (data?.length) await service.storage.from(BUCKET).remove(data.map((f) => `${id}/${f.name}`))
      const { error } = await service.from('tenants').delete().eq('id', id)
      if (error) console.error('Aufräumen fehlgeschlagen', error.message)
    }
  }, 60_000)

  it('Inhaber: hochladen, eintragen, ersetzen, entfernen; altes Logo wird gemeldet und ist nicht mehr lesbar', async () => {
    // Signierter Upload wie in der App
    const first = path(tenantA)
    const signed = await ownerA.storage.from(BUCKET).createSignedUploadUrl(first)
    expect(signed.error).toBeNull()
    const uploaded = await ownerA.storage.from(BUCKET).uploadToSignedUrl(first, signed.data!.token, PNG, { contentType: 'image/png' })
    expect(uploaded.error).toBeNull()
    // Nicht eingetragen: für niemanden lesbar
    expect(await canRead(ownerA, first)).toBe(false)
    expect(await canRead(admin, first)).toBe(false)

    const saved = await save(ownerA, tenantA, first)
    expect(saved.error).toBeNull()
    expect(saved.data).toEqual({ unused_logo: null })
    expect((await row(tenantA)).logo_path).toBe(first)
    expect(await canRead(ownerA, first)).toBe(true)

    // Fehlt der Schlüssel, bleibt das Logo; ohne Änderung kein Protokolleintrag
    const before = (await logEntries(tenantA)).length
    expect((await save(ownerA, tenantA)).data).toEqual({ unused_logo: null })
    expect((await row(tenantA)).logo_path).toBe(first)
    expect(await logEntries(tenantA)).toHaveLength(before)

    const second = path(tenantA)
    expect((await upload(ownerA, second)).error).toBeNull()
    expect((await save(ownerA, tenantA, second)).data).toEqual({ unused_logo: first })
    expect(await canRead(ownerA, first)).toBe(false)
    expect(await canRead(ownerA, second)).toBe(true)

    expect((await save(ownerA, tenantA, null)).data).toEqual({ unused_logo: second })
    expect((await row(tenantA)).logo_path).toBeNull()
    expect(await canRead(ownerA, second)).toBe(false)

    const log = await logEntries(tenantA)
    expect(log).toHaveLength(before + 2)
    expect(log.slice(-2).map((e) => e.changed_fields)).toEqual([['logo_path'], ['logo_path']])
  })

  it('lehnt fehlende Dateien, falsche Formate und fremde Ordner ab, auch direkt an der Tabelle', async () => {
    expect((await save(ownerA, tenantA, path(tenantA))).error?.code).toBe('P0018')
    expect((await save(ownerA, tenantA, `${tenantA}/logo.svg`)).error?.code).toBe('P0018')

    const foreign = path(tenantB)
    expect((await upload(ownerB, foreign)).error).toBeNull()
    expect((await save(ownerA, tenantA, foreign)).error?.code).toBe('P0018')
    await ownerA.from('tenants').update({ logo_path: foreign }).eq('id', tenantA)
    expect((await row(tenantA)).logo_path).toBeNull()
    // Auch der Server kann kein fremdes Logo eintragen (Prüfregel der Tabelle)
    expect((await service.from('tenants').update({ logo_path: foreign }).eq('id', tenantA)).error?.code).toBe('23514')
  })

  it('Speicherbereich: nur PNG bis 5 MB, nur Speicherort <Kunde>/<zufällig>.png', async () => {
    expect((await upload(ownerA, path(tenantA), Buffer.from('<svg/>'), 'image/svg+xml')).error).not.toBeNull()
    expect((await upload(ownerA, path(tenantA), PNG, 'image/jpeg')).error).not.toBeNull()
    expect((await upload(ownerA, path(tenantA), Buffer.alloc(5 * 1024 * 1024 + 1))).error).not.toBeNull()
    expect((await upload(ownerA, `${tenantA}/${randomUUID()}.jpg`)).error).not.toBeNull()
    expect((await upload(ownerA, `${tenantA}/logo.png`)).error).not.toBeNull()
  })

  it('Mitarbeiter, fremde Inhaber und Unangemeldete: kein Hochladen, Lesen oder Eintragen', async () => {
    const p = path(tenantA)
    expect((await upload(ownerA, p)).error).toBeNull()
    expect((await save(ownerA, tenantA, p)).error).toBeNull()

    expect((await upload(staffA, path(tenantA))).error).not.toBeNull()
    expect(await canRead(staffA, p)).toBe(false)
    expect((await save(staffA, tenantA, null)).error?.code).toBe('42501')

    expect(await canRead(ownerB, p)).toBe(false)
    expect((await upload(ownerB, path(tenantA))).error).not.toBeNull()
    expect((await save(ownerB, tenantA, null)).error?.code).toBe('42501')

    const anon = anonClient()
    expect(await canRead(anon, p)).toBe(false)
    expect((await anon.storage.from(BUCKET).download(p)).data).toBeNull()
    expect((await upload(anon, path(tenantA))).error).not.toBeNull()

    // Bereinigung nur für den Server
    expect((await ownerA.rpc('unused_tenant_logos', { p_limit: 10 })).error).not.toBeNull()
    expect((await row(tenantA)).logo_path).toBe(p)
  })

  it('Betreiber: bei aktivem Kunden hochladen und eintragen, bei deaktiviertem nur lesen; ohne 2FA nichts', async () => {
    const tenant = await newTenant([])
    const p = path(tenant)
    expect((await upload(admin, p)).error).toBeNull()
    expect((await save(admin, tenant, p)).error).toBeNull()
    expect(await canRead(admin, p)).toBe(true)

    expect(await canRead(adminAal1, p)).toBe(false)
    expect((await upload(adminAal1, path(tenant))).error).not.toBeNull()

    const { error } = await service.from('tenants').update({ status: 'deactivated' }).eq('id', tenant)
    expect(error).toBeNull()
    expect(await canRead(admin, p)).toBe(true)
    expect((await upload(admin, path(tenant))).error).not.toBeNull()
    expect((await save(admin, tenant, null)).error?.code).toBe('P0016')
    expect((await row(tenant)).logo_path).toBe(p)
  })

  it('Bereinigung meldet frische und eingetragene Logos nicht', async () => {
    const used = path(tenantB)
    const fresh = path(tenantB)
    expect((await upload(ownerB, used)).error).toBeNull()
    expect((await upload(ownerB, fresh)).error).toBeNull()
    expect((await save(ownerB, tenantB, used)).error).toBeNull()
    const { data, error } = await service.rpc('unused_tenant_logos', { p_limit: 1000 })
    expect(error).toBeNull()
    expect(data).not.toContain(used)
    expect(data).not.toContain(fresh)
  })
})
