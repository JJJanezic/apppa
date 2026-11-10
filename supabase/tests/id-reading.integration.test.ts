// @vitest-environment node
//
// PROJ-51: Ausweis automatisch auslesen gegen „apppa-dev“ (übersprungen ohne .env.local). Prüft Schalter und Tageslimit des
// Betreibers (Rechte, Protokoll), Lesen der Einstellungen, Vormerken/Abschließen nur durch den Server mit Tageslimit und
// „nicht erreichbar zählt nicht“, Monatszähler, Hinweis „Datenschutz-Text prüfen“, Herkunftsvermerk im Änderungsprotokoll
// und das Leeren des Gastbezugs beim Anonymisieren.
import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { Json } from '../../src/types/database'
import { type Client, hasSupabaseEnv, serviceClient } from './helpers'
import { sharedClient } from './shared-sessions'

describe.skipIf(!hasSupabaseEnv)('PROJ-51 Ausweis automatisch auslesen', () => {
  let service: Client
  let owner: Client, staff: Client, ownerB: Client, admin: Client, adminAal1: Client
  let ownerId: string
  let tenant: string, tenantB: string
  const tenants: string[] = []
  const runId = randomUUID().slice(0, 8)

  const setReading = (client: Client, enabled: boolean, limit = 50, tenantId = tenant) =>
    client.rpc('admin_set_id_reading', { p_tenant_id: tenantId, p_enabled: enabled, p_daily_limit: limit })
  const reserve = (client: Client, tenantId = tenant, guestId: string | null = null) =>
    client.rpc('reserve_id_reading', { p_tenant_id: tenantId, p_user_id: ownerId, p_guest_id: guestId as string, p_place: 'guestForm' })
  const finish = (id: string, outcome: string) =>
    service.rpc('finish_id_reading', { p_id: id, p_outcome: outcome, p_model: 'test', p_input_tokens: 10, p_output_tokens: 5 })
  const settings = async (client: Client, tenantId = tenant) =>
    (await client.from('id_reading_settings').select('enabled, daily_limit, privacy_hint_seen_at').eq('tenant_id', tenantId).maybeSingle()).data
  const clearReadings = () => service.from('id_readings').delete().eq('tenant_id', tenant)

  beforeAll(async () => {
    service = serviceClient()
    const [o, s, ob, a2, a1] = await Promise.all([
      sharedClient('ownerA'),
      sharedClient('staffA'),
      sharedClient('ownerB'),
      sharedClient('adminAal2'),
      sharedClient('adminAal1'),
    ])
    ;[owner, staff, ownerB, admin, adminAal1] = [o.client, s.client, ob.client, a2.client, a1.client]
    ownerId = o.user.id
    for (const name of ['A', 'B']) {
      const { data: t, error } = await service.from('tenants').insert({ name: `PROJ-51 Ausweis ${name} ${runId}` }).select('id').single()
      if (error) throw error
      tenants.push(t.id)
    }
    ;[tenant, tenantB] = tenants
    await service.from('memberships').insert([
      { tenant_id: tenant, user_id: o.user.id, role: 'owner' },
      { tenant_id: tenant, user_id: s.user.id, role: 'staff' },
      { tenant_id: tenantB, user_id: ob.user.id, role: 'owner' },
    ])
  }, 60_000)

  afterAll(async () => {
    if (!service) return
    // Über die Admin-Funktion löschen, damit auch das Betreiber-Protokoll keine Reste behält
    for (const id of tenants) {
      await admin.rpc('admin_set_tenant_status', { p_tenant_id: id, p_active: false })
      const { data } = await service.from('tenants').select('name').eq('id', id).single()
      const { error } = await admin.rpc('admin_delete_tenant', { p_tenant_id: id, p_confirm_name: data!.name })
      if (error) await service.from('tenants').delete().eq('id', id)
    }
  }, 60_000)

  describe('Schalter und Tageslimit (Betreiber)', () => {
    it('nur der Admin mit 2FA schaltet; Inhaber und Admin ohne 2FA werden abgewiesen', async () => {
      for (const client of [owner, staff, adminAal1]) expect((await setReading(client, true)).error?.code).toBe('42501')
      expect(await settings(service)).toBeNull()
      expect((await setReading(admin, true, 20)).error).toBeNull()
      expect(await settings(service)).toMatchObject({ enabled: true, daily_limit: 20, privacy_hint_seen_at: null })
    })

    it('prüft das Tageslimit (1–1.000)', async () => {
      for (const limit of [0, 1001]) expect((await setReading(admin, true, limit)).error?.code).toBe('22023')
    })

    it('schreibt Ein, Aus und Limit ins Betreiber-Protokoll', async () => {
      await setReading(admin, true, 20)
      await setReading(admin, true, 30)
      await setReading(admin, false, 30)
      await setReading(admin, false, 30)
      const { data } = await admin
        .from('operator_log')
        .select('action, target_label')
        .eq('tenant_id', tenant)
        .like('action', 'id_reading%')
        .order('id')
      expect(data).toEqual([
        { action: 'id_reading_on', target_label: '20' },
        { action: 'id_reading_limit', target_label: '30' },
        { action: 'id_reading_off', target_label: '30' },
      ])
    })

    it('Mitglieder lesen die Einstellung ihres Kunden, fremde Inhaber nicht', async () => {
      await setReading(admin, true, 50)
      expect(await settings(owner)).toMatchObject({ enabled: true })
      expect(await settings(staff)).toMatchObject({ enabled: true })
      expect(await settings(ownerB)).toBeNull()
      expect((await owner.from('id_reading_settings').update({ daily_limit: 999 }).eq('tenant_id', tenant).select()).data ?? []).toEqual([])
    })
  })

  describe('Vormerken und Tageslimit (Server)', () => {
    it('nur die Service-Rolle merkt vor', async () => {
      expect((await reserve(owner)).error).not.toBeNull()
      expect((await owner.rpc('finish_id_reading', { p_id: randomUUID(), p_outcome: 'read', p_model: null as never, p_input_tokens: null as never, p_output_tokens: null as never })).error).not.toBeNull()
    })

    it('nicht freigeschaltet → P0990', async () => {
      expect((await reserve(service, tenantB)).error?.code).toBe('P0990')
    })

    it('Tageslimit: Auslesung über dem Limit → P0991; „nicht erreichbar“ zählt nicht', async () => {
      await clearReadings()
      await setReading(admin, true, 2)
      const a = await reserve(service)
      const b = await reserve(service)
      expect(a.error).toBeNull()
      expect(b.error).toBeNull()
      expect((await reserve(service)).error?.code).toBe('P0991')
      expect((await finish(b.data as string, 'unreachable')).error).toBeNull()
      const c = await reserve(service)
      expect(c.error).toBeNull()
      await finish(a.data as string, 'read')
      await finish(c.data as string, 'no_document')
      const { data } = await service.from('id_readings').select('outcome, counted, model, input_tokens').eq('tenant_id', tenant).order('started_at')
      expect(data!.map((r) => [r.outcome, r.counted])).toEqual([
        ['read', true],
        ['unreachable', false],
        ['no_document', true],
      ])
    })

    it('gleichzeitige Auslesungen überschreiten das Limit nicht', async () => {
      await clearReadings()
      await setReading(admin, true, 3)
      const results = await Promise.all(Array.from({ length: 6 }, () => reserve(service)))
      expect(results.filter((r) => !r.error)).toHaveLength(3)
      expect(results.filter((r) => r.error?.code === 'P0991')).toHaveLength(3)
    })

    it('Auslesungen sieht nur der Betreiber; Monatszähler nur für ihn', async () => {
      expect((await owner.from('id_readings').select('id').eq('tenant_id', tenant)).data).toEqual([])
      expect(((await admin.from('id_readings').select('id').eq('tenant_id', tenant)).data ?? []).length).toBe(3)
      const usage = await admin.rpc('id_reading_usage', { p_tenant_id: tenant })
      expect(usage.error).toBeNull()
      expect(usage.data).toEqual([{ this_month: 3, last_month: 0 }])
      expect((await owner.rpc('id_reading_usage', { p_tenant_id: tenant })).error?.code).toBe('42501')
    })
  })

  describe('Hinweis „Datenschutz-Text prüfen“', () => {
    it('nur der Inhaber bestätigt; erneutes Einschalten zeigt ihn wieder', async () => {
      await setReading(admin, true, 50)
      expect((await staff.rpc('dismiss_id_reading_privacy_hint', { p_tenant_id: tenant })).error?.code).toBe('42501')
      expect((await ownerB.rpc('dismiss_id_reading_privacy_hint', { p_tenant_id: tenant })).error?.code).toBe('42501')
      expect((await owner.rpc('dismiss_id_reading_privacy_hint', { p_tenant_id: tenant })).error).toBeNull()
      expect((await settings(service))!.privacy_hint_seen_at).not.toBeNull()
      await setReading(admin, true, 40)
      expect((await settings(service))!.privacy_hint_seen_at).not.toBeNull()
      await setReading(admin, false, 40)
      await setReading(admin, true, 40)
      expect((await settings(service))!.privacy_hint_seen_at).toBeNull()
    })
  })

  describe('Herkunftsvermerk und Gastbezug', () => {
    it('Gast speichern aus dem Ausweis → Protokoll „Ausweis“', async () => {
      const { data: id, error } = await owner.rpc('save_guest_from_id_document', {
        p_input: { tenant_id: tenant, last_name: `Mustermann ${runId}`, first_name: 'Erika', country: 'DE', gender: 'female' } as Json,
      })
      expect(error).toBeNull()
      const { data: log } = await service.from('audit_log').select('actor_label').eq('table_name', 'guests').eq('record_id', id as string).single()
      expect(log!.actor_label).toBe('Ausweis')
      // ohne Hülle wie bisher „user“
      const plain = await owner.rpc('save_guest', { p_input: { tenant_id: tenant, last_name: `Huber ${runId}`, country: 'AT', gender: 'unspecified' } as Json })
      const { data: plainLog } = await service.from('audit_log').select('actor_label').eq('table_name', 'guests').eq('record_id', plain.data as string).single()
      expect(plainLog!.actor_label).toBe('user')
    })

    it('Gästeblatt-Feld aus dem Ausweis → „Gästeblatt, aus Ausweis gelesen“, sonst „Gästeblatt“', async () => {
      const { data: property } = await service
        .from('properties')
        .insert({ tenant_id: tenant, name: `Haus ${runId}`, street: 'Seeweg 1', postal_code: '5340', city: 'St. Gilgen', municipality_code: '50330' })
        .select('id')
        .single()
      const { data: ap } = await service.from('apartments').insert({ tenant_id: tenant, property_id: property!.id, name: 'Top 1', max_guests: 4, price_cents: 10000 }).select('id').single()
      const { data: guest } = await service.from('guests').insert({ tenant_id: tenant, last_name: `Rossi ${runId}`, country: 'IT' }).select('id, updated_at').single()
      const { data: booking, error } = await owner.rpc('save_booking', {
        p_input: {
          tenant_id: tenant,
          kind: 'booking',
          apartment_id: ap!.id,
          arrival: '2028-07-01',
          planned_departure: '2028-07-03',
          departure: '2028-07-03',
          guest_id: guest!.id,
          adults: 1,
          child_ages: [],
          source: 'none',
          amounts: { nights_cents: 20000, nights_vat_rate: '10.00', charges: [] },
        } as Json,
        p_confirm: true,
      })
      expect(error).toBeNull()
      const bookingId = (booking as { id: string }).id
      const stamp = async () => (await service.from('guests').select('updated_at').eq('id', guest!.id).single()).data!.updated_at
      const lastLabel = async () =>
        (await service.from('audit_log').select('actor_label').eq('table_name', 'guests').eq('record_id', guest!.id).order('id', { ascending: false }).limit(1).single()).data!.actor_label

      const fromId = await staff.rpc('save_guest_sheet_field_from_id_document', {
        p_booking_id: bookingId,
        p_target: 'guest',
        p_values: { first_name: 'Giulia', birth_date: '1985-04-03' } as Json,
        p_expected_updated_at: await stamp(),
      })
      expect(fromId.error).toBeNull()
      expect(await lastLabel()).toBe('Gästeblatt, aus Ausweis gelesen')

      const plain = await staff.rpc('save_guest_sheet_field', {
        p_booking_id: bookingId,
        p_target: 'guest',
        p_values: { street: 'Via Roma 1' } as Json,
        p_expected_updated_at: await stamp(),
      })
      expect(plain.error).toBeNull()
      expect(await lastLabel()).toBe('Gästeblatt')
    })

    it('Anonymisieren leert den Gastbezug der Auslesungen', async () => {
      await clearReadings()
      await setReading(admin, true, 50)
      const { data: guest } = await service.from('guests').insert({ tenant_id: tenant, last_name: `Anonym ${runId}`, country: 'DE' }).select('id').single()
      const r = await reserve(service, tenant, guest!.id)
      expect(r.error).toBeNull()
      await service.from('guests').update({ anonymized_at: new Date().toISOString() }).eq('id', guest!.id)
      const { data } = await service.from('id_readings').select('guest_id').eq('id', r.data as string).single()
      expect(data!.guest_id).toBeNull()
    })
  })
})
