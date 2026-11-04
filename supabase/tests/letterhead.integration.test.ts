// @vitest-environment node
//
// PROJ-41: Briefpapier gegen „apppa-dev“ (übersprungen ohne .env.local): Standardwerte, Rechte je Rolle, Grenzen am
// Formular vorbei, Konfliktschutz, Protokoll ohne Werte und Vorschau-Daten für Mitarbeiter.
import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { DEFAULT_LETTERHEAD, letterheadFromDb } from '@/lib/letterhead'
import type { Json } from '@/types/database'
import { anonClient, type Client, hasSupabaseEnv, serviceClient, type TestUser } from './helpers'
import { sharedClient } from './shared-sessions'

const valid = { font: 'tinos', font_size: 12.5, line_spacing: 'wide', paragraph_spacing: 'tight', logo_position: 'center', logo_height_mm: 30, show_issuer: false }

describe.skipIf(!hasSupabaseEnv)('PROJ-41 Briefpapier', () => {
  let service: Client
  const tenants: string[] = []
  let tenantA: string, tenantB: string
  let ownerA: Client, staffA: Client, ownerB: Client, admin: Client, adminAal1: Client
  const runId = randomUUID().slice(0, 8)

  const newTenant = async (members: [TestUser, 'owner' | 'staff'][]) => {
    const { data, error } = await service.from('tenants').insert({ name: `PROJ-41 Test ${runId}` }).select('id').single()
    if (error) throw error
    tenants.push(data.id)
    for (const [u, role] of members) {
      const { error: e } = await service.from('memberships').insert({ tenant_id: data.id, user_id: u.id, role })
      if (e) throw e
    }
    return data.id
  }
  const settings = async (tenantId: string) => {
    const { data, error } = await service.from('invoice_settings').select('*').eq('tenant_id', tenantId).single()
    if (error) throw error
    return data
  }
  const save = async (client: Client, tenantId: string, data: Record<string, unknown>, stamp?: string) =>
    client.rpc('save_invoice_letterhead', {
      p_tenant_id: tenantId,
      p_expected_updated_at: stamp ?? (await settings(tenantId)).letterhead_updated_at,
      p_data: data as Json,
    })
  const log = async (tenantId: string) => {
    const { data } = await service.from('operator_log').select('action, changed_fields').eq('tenant_id', tenantId).eq('action', 'invoice_settings').order('id')
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
      const { error } = await service.from('tenants').delete().eq('id', id)
      if (error) console.error('Aufräumen fehlgeschlagen', error.message)
    }
  }, 60_000)

  it('neuer Kunde hat die Standardwerte der Spec', async () => {
    const s = await settings(tenantB)
    expect(
      letterheadFromDb({
        font: s.letterhead_font,
        font_size: s.letterhead_font_size,
        line_spacing: s.letterhead_line_spacing,
        paragraph_spacing: s.letterhead_paragraph_spacing,
        logo_position: s.letterhead_logo_position,
        logo_height_mm: s.letterhead_logo_height_mm,
        show_issuer: s.letterhead_show_issuer,
      })
    ).toEqual(DEFAULT_LETTERHEAD)
  })

  it('Inhaber speichert, Stand und Protokoll ändern sich, das Protokoll enthält keine Werte', async () => {
    const before = await settings(tenantA)
    expect((await save(ownerA, tenantA, valid)).error).toBeNull()
    const s = await settings(tenantA)
    expect(s).toMatchObject({
      letterhead_font: 'tinos',
      letterhead_font_size: 12.5,
      letterhead_line_spacing: 'wide',
      letterhead_paragraph_spacing: 'tight',
      letterhead_logo_position: 'center',
      letterhead_logo_height_mm: 30,
      letterhead_show_issuer: false,
    })
    expect(s.letterhead_updated_at).not.toBe(before.letterhead_updated_at)
    // andere Abschnitte bleiben unberührt
    expect(s.texts_updated_at).toBe(before.texts_updated_at)
    const entries = await log(tenantA)
    expect(entries.at(-1)?.changed_fields).toEqual(['letterhead'])
    expect(JSON.stringify(entries)).not.toContain('tinos')
  })

  it('ohne Änderung: kein Protokolleintrag, Stand bleibt', async () => {
    const stamp = (await settings(tenantA)).letterhead_updated_at
    const count = (await log(tenantA)).length
    expect((await save(ownerA, tenantA, valid, stamp)).error).toBeNull()
    expect((await settings(tenantA)).letterhead_updated_at).toBe(stamp)
    expect(await log(tenantA)).toHaveLength(count)
  })

  it('zweiter Bearbeiter mit altem Stand: Konflikt', async () => {
    const stale = (await settings(tenantA)).letterhead_updated_at
    expect((await save(admin, tenantA, { ...valid, font_size: 13 }, stale)).error).toBeNull()
    expect((await save(ownerA, tenantA, { ...valid, font_size: 9 }, stale)).error?.code).toBe('P0910')
    expect((await settings(tenantA)).letterhead_font_size).toBe(13)
  })

  it('Rechte: Mitarbeiter, fremder Inhaber, Betreiber ohne 2FA und Anonym werden abgelehnt', async () => {
    const stamp = (await settings(tenantA)).letterhead_updated_at
    for (const client of [staffA, ownerB, adminAal1, anonClient()]) {
      const { error } = await save(client, tenantA, { ...valid, font_size: 8 }, stamp)
      expect(error, 'muss abgelehnt werden').not.toBeNull()
    }
    expect((await settings(tenantA)).letterhead_font_size).toBe(13)
  })

  it('Grenzen gelten auch am Formular vorbei', async () => {
    const cases: Record<string, unknown>[] = [
      { font_size: 7.5 },
      { font_size: 14.5 },
      { font_size: 11.3 },
      { font_size: '11' },
      { logo_height_mm: 9 },
      { logo_height_mm: 36 },
      { logo_height_mm: 20.5 },
      { font: 'comic-sans' },
      { font: null },
      { line_spacing: 'huge' },
      { paragraph_spacing: null },
      { logo_position: 'top' },
      { show_issuer: 'ja' },
    ]
    for (const c of cases) {
      const { error } = await save(ownerA, tenantA, { ...valid, ...c })
      expect(error?.code, JSON.stringify(c)).toBe('P0914')
    }
    expect((await save(ownerA, tenantA, { font: 'tinos' })).error?.code).toBe('P0914')
  })

  it('Grenzwerte 8 und 14 pt, 10 und 35 mm sind erlaubt', async () => {
    expect((await save(ownerB, tenantB, { ...valid, font_size: 8, logo_height_mm: 10 })).error).toBeNull()
    expect((await save(ownerB, tenantB, { ...valid, font_size: 14, logo_height_mm: 35 })).error).toBeNull()
  })

  it('direktes Schreiben in die Tabelle ist nicht möglich', async () => {
    const { data } = await ownerA.from('invoice_settings').update({ letterhead_font: 'arimo' }).eq('tenant_id', tenantA).select('id')
    expect(data ?? []).toHaveLength(0)
    expect((await settings(tenantA)).letterhead_font).not.toBe('arimo')
  })

  it('Mitarbeiter lesen die Einstellungen nicht, bekommen das Briefpapier aber in den Vorschau-Daten', async () => {
    const { data: rows } = await staffA.from('invoice_settings').select('letterhead_font').eq('tenant_id', tenantA)
    expect(rows ?? []).toHaveLength(0)
    const { data, error } = await staffA.rpc('invoice_preview_data', { p_tenant_id: tenantA })
    expect(error).toBeNull()
    const letterhead = letterheadFromDb((data as { letterhead?: Parameters<typeof letterheadFromDb>[0] }).letterhead)
    expect(letterhead).toMatchObject({ fontFamily: 'tinos', fontSize: 13, logoPosition: 'center', showIssuer: false })
    // fremder Inhaber nicht
    expect((await ownerB.rpc('invoice_preview_data', { p_tenant_id: tenantA })).error?.code).toBe('42501')
  })
})
