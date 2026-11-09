// @vitest-environment node
//
// PROJ-26 Erweiterung (2026-11-09): Kennzahl und Gästeblattnummer je Gemeinde gegen „apppa-dev“ (übersprungen ohne
// .env.local). Prüft Nummernregel und Vergabe (Weiterzählen mit Stellenzahl, belegte Nummern überspringen, Sprung in den
// nächsten Bereich, gleichzeitige Vergabe, keine Nummer), Bereiche (Prüfungen, Stand, Rechte), Lesesichten, Kennzahlen,
// Schalter „Gästeblätter nacherfassen“, Buchung speichern ohne Nummernfeld und die Doppelt-Prüfung je Gemeinde.
import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { Json } from '../../src/types/database'
import { type Client, hasSupabaseEnv, serviceClient, type TestUser } from './helpers'
import { sharedClient } from './shared-sessions'

const GEMEINDE_A = '50330'
const GEMEINDE_B = '10101'

describe.skipIf(!hasSupabaseEnv)('PROJ-26 Gästeblattnummer je Gemeinde', () => {
  let service: Client
  let owner: Client, staff: Client, ownerB: Client
  let staffUser: TestUser
  const tenants: string[] = []
  let tenant: string, tenantB: string
  const apartments: Record<string, string> = {}
  const runId = randomUUID().slice(0, 8)
  let day = 0

  const newGuest = async () => {
    const { data, error } = await service.from('guests').insert({ tenant_id: tenant, last_name: `Huber ${runId}`, country: 'AT' }).select('id').single()
    if (error) throw error
    return data.id
  }
  const newBooking = async (gemeinde: string, over: Record<string, unknown> = {}) => {
    const start = new Date(Date.UTC(2028, 5, 1) + day * 86_400_000)
    day += 3
    const iso = (d: Date) => d.toISOString().slice(0, 10)
    const { data, error } = await owner.rpc('save_booking', {
      p_input: {
        tenant_id: tenant,
        kind: 'booking',
        apartment_id: apartments[gemeinde],
        arrival: iso(start),
        planned_departure: iso(new Date(start.getTime() + 2 * 86_400_000)),
        departure: iso(new Date(start.getTime() + 2 * 86_400_000)),
        guest_id: await newGuest(),
        adults: 1,
        child_ages: [],
        source: 'none',
        amounts: { nights_cents: 20000, nights_vat_rate: '10.00', charges: [] },
        confirm_guest_sheet_number: true,
        ...over,
      } as Json,
      p_confirm: true,
    })
    if (error) throw error
    return (data as { id: string }).id
  }
  const booking = async (id: string) => {
    const { data } = await service.from('bookings').select('*').eq('id', id).single()
    return data!
  }
  // Vergabe wie /api/gaesteblatt/fertig (Service-Rolle, im Namen der Mitarbeiterin)
  const assign = async (bookingId: string) => {
    const b = await booking(bookingId)
    return service.rpc('assign_guest_sheet_number', { p_booking_id: bookingId, p_actor_id: staffUser.id, p_expected_updated_at: b.updated_at })
  }
  const numberOf = async (bookingId: string) => {
    const { data, error } = await assign(bookingId)
    if (error) throw error
    return (data as { sheet_number: string }).sheet_number
  }
  const saveRange = (client: Client, input: Record<string, unknown>, gemeinde = GEMEINDE_A) =>
    client.rpc('save_guest_sheet_number_range', {
      p_input: { tenant_id: tenant, municipality_code: gemeinde, id: null, updated_at: null, ...input } as Json,
    })
  const ranges = async (gemeinde: string) => {
    const { data } = await owner.from('guest_sheet_number_range_list').select('*').eq('tenant_id', tenant).eq('municipality_code', gemeinde).order('position')
    return data!
  }
  const state = async (client: Client, gemeinde: string) => {
    const { data } = await client.from('guest_sheet_numbering').select('next_number, free_count, has_ranges').eq('tenant_id', tenant).eq('municipality_code', gemeinde).maybeSingle()
    return data
  }
  const clearRanges = (gemeinde: string) => service.from('guest_sheet_number_ranges').delete().eq('tenant_id', tenant).eq('municipality_code', gemeinde)

  beforeAll(async () => {
    service = serviceClient()
    const o = await sharedClient('ownerA')
    const s = await sharedClient('staffA')
    const ob = await sharedClient('ownerB')
    owner = o.client
    staff = s.client
    ownerB = ob.client
    staffUser = s.user
    for (const name of ['A', 'B']) {
      const { data: t, error } = await service.from('tenants').insert({ name: `PROJ-26 Nummern ${name} ${runId}` }).select('id').single()
      if (error) throw error
      tenants.push(t.id)
    }
    ;[tenant, tenantB] = tenants
    await service.from('memberships').insert([
      { tenant_id: tenant, user_id: o.user.id, role: 'owner' },
      { tenant_id: tenant, user_id: staffUser.id, role: 'staff' },
      { tenant_id: tenantB, user_id: ob.user.id, role: 'owner' },
    ])
    for (const code of [GEMEINDE_A, GEMEINDE_B]) {
      const { data: property, error } = await service
        .from('properties')
        .insert({ tenant_id: tenant, name: `Haus ${code} ${runId}`, street: 'Seeweg 1', postal_code: '5340', city: 'Ort', municipality_code: code })
        .select('id')
        .single()
      if (error) throw error
      const { data: ap } = await service.from('apartments').insert({ tenant_id: tenant, property_id: property.id, name: `Top ${code}`, max_guests: 4, price_cents: 10000 }).select('id').single()
      apartments[code] = ap!.id
    }
  }, 60_000)

  afterAll(async () => {
    if (!service) return
    for (const id of tenants) {
      const { error } = await service.from('tenants').delete().eq('id', id)
      expect(error).toBeNull()
    }
  }, 60_000)

  describe('Vergabe', () => {
    it('zählt mit gleicher Stellenzahl weiter und springt nach „bis“ in den nächsten Bereich', async () => {
      await clearRanges(GEMEINDE_A)
      expect((await saveRange(owner, { range_from: 'A-0098', range_to: 'A-0100' })).error).toBeNull()
      expect((await saveRange(owner, { range_from: '9999', range_to: '10001' })).error).toBeNull()
      const got: string[] = []
      for (let i = 0; i < 5; i++) got.push(await numberOf(await newBooking(GEMEINDE_A)))
      expect(got).toEqual(['A-0098', 'A-0099', 'A-0100', '9999', '10000'])
      const list = await ranges(GEMEINDE_A)
      expect(list.map((r) => r.state)).toEqual(['exhausted', 'active'])
      expect(list[1].next_number).toBe('10001')
      // Protokoll der Buchung mit Quelle „Gästeblatt“ und der Mitarbeiterin
      const b = await newBooking(GEMEINDE_A)
      await numberOf(b)
      const { data: log } = await service.from('audit_log').select('actor_label, actor_id').eq('table_name', 'bookings').eq('record_id', b).order('id', { ascending: false }).limit(1).single()
      expect(log).toMatchObject({ actor_id: staffUser.id })
      expect(log!.actor_label).toContain('Gästeblatt')
    })

    it('überspringt nacherfasste Nummern derselben Gemeinde, nicht die einer anderen Gemeinde', async () => {
      await clearRanges(GEMEINDE_A)
      await saveRange(owner, { range_from: '0042', range_to: '0050' })
      await newBooking(GEMEINDE_A, { guest_sheet_number: '0043' })
      // andere Schreibweise und andere Gemeinde belegen nichts
      await newBooking(GEMEINDE_A, { guest_sheet_number: '042' })
      await newBooking(GEMEINDE_B, { guest_sheet_number: '0042' })
      expect(await state(owner, GEMEINDE_A)).toMatchObject({ next_number: '0042', free_count: 8, has_ranges: true })
      expect(await numberOf(await newBooking(GEMEINDE_A))).toBe('0042')
      expect(await numberOf(await newBooking(GEMEINDE_A))).toBe('0044')
      expect(await state(owner, GEMEINDE_A)).toMatchObject({ next_number: '0045', free_count: 6 })
    })

    it('vorhandene Nummer bleibt; ohne freie Nummer P0986; gleichzeitige Vergabe ohne Doppelte', async () => {
      await clearRanges(GEMEINDE_A)
      const kept = await newBooking(GEMEINDE_A, { guest_sheet_number: 'X-7' })
      expect(await numberOf(kept)).toBe('X-7')
      expect((await assign(await newBooking(GEMEINDE_A))).error?.code).toBe('P0986')
      await saveRange(owner, { range_from: '100', range_to: '199' })
      const ids = await Promise.all([1, 2, 3, 4].map(() => newBooking(GEMEINDE_A)))
      const numbers = await Promise.all(ids.map(numberOf))
      expect(new Set(numbers).size).toBe(4)
      // veralteter Stand der Buchung
      const stale = await service.rpc('assign_guest_sheet_number', { p_booking_id: await newBooking(GEMEINDE_A), p_actor_id: staffUser.id, p_expected_updated_at: '2000-01-01T00:00:00Z' })
      expect(stale.error?.code).toBe('P0975')
    })

    it('nur für den Server', async () => {
      const id = await newBooking(GEMEINDE_A)
      const b = await booking(id)
      const denied = await staff.rpc('assign_guest_sheet_number', { p_booking_id: id, p_actor_id: staffUser.id, p_expected_updated_at: b.updated_at })
      expect(denied.error).not.toBeNull()
    })
  })

  describe('Nummernbereiche', () => {
    it('prüft Format, Vorsatz, Reihenfolge und Überschneidung; nur Inhaber', async () => {
      await clearRanges(GEMEINDE_B)
      expect((await saveRange(owner, { range_from: '0001', range_to: '0500', next_number: '0042' }, GEMEINDE_B)).error).toBeNull()
      expect((await saveRange(owner, { range_from: '0400', range_to: '0600' }, GEMEINDE_B)).error?.code).toBe('P0983')
      expect((await saveRange(owner, { range_from: 'B-0400', range_to: 'B-0600' }, GEMEINDE_B)).error).toBeNull()
      expect((await saveRange(owner, { range_from: '12A', range_to: '0600' }, GEMEINDE_B)).error?.code).toBe('P0984')
      expect((await saveRange(owner, { range_from: 'A-1', range_to: 'B-9' }, GEMEINDE_B)).error?.code).toBe('P0984')
      expect((await saveRange(owner, { range_from: '0900', range_to: '0800' }, GEMEINDE_B)).error?.code).toBe('P0984')
      expect((await saveRange(staff, { range_from: '0700', range_to: '0800' }, GEMEINDE_B)).error?.code).toBe('42501')
      expect((await saveRange(ownerB, { range_from: '0700', range_to: '0800' }, GEMEINDE_B)).error?.code).toBe('42501')
      // Gemeinde ohne Objekt des Kunden
      expect((await saveRange(owner, { range_from: '0700', range_to: '0800' }, '10201')).error?.code).toBe('P0984')
      const list = await ranges(GEMEINDE_B)
      expect(list.map((r) => [r.state, r.next_number])).toEqual([
        ['active', '0042'],
        ['queued', null],
      ])
    })

    it('Bereich in Verwendung: „von“ fest, „bis“ nicht unter die belegte Nummer; Löschen nur folgende; Stand', async () => {
      await clearRanges(GEMEINDE_B)
      await saveRange(owner, { range_from: 'C-001', range_to: 'C-100' }, GEMEINDE_B)
      await saveRange(owner, { range_from: 'D-001', range_to: 'D-100' }, GEMEINDE_B)
      await newBooking(GEMEINDE_B, { guest_sheet_number: 'C-050' })
      const [active, queued] = await ranges(GEMEINDE_B)
      expect(active.last_issued).toBe('C-050')
      const edit = (r: typeof active, input: Record<string, unknown>) =>
        saveRange(owner, { id: r.id, updated_at: r.updated_at, range_from: r.range_from, range_to: r.range_to, ...input }, GEMEINDE_B)
      expect((await edit(active, { range_from: 'C-002' })).error?.code).toBe('P0985')
      expect((await edit(active, { range_to: 'C-040' })).error?.code).toBe('P0984')
      expect((await edit(active, { range_to: 'C-200', next_number: 'C-060' })).error).toBeNull()
      expect((await edit(active, { range_to: 'C-300' })).error?.code).toBe('P0982')
      expect((await owner.rpc('delete_guest_sheet_number_range', { p_id: active.id!, p_expected_updated_at: active.updated_at! })).error?.code).toBe('P0982')
      const [fresh] = await ranges(GEMEINDE_B)
      expect(fresh.next_number).toBe('C-060')
      expect((await owner.rpc('delete_guest_sheet_number_range', { p_id: fresh.id!, p_expected_updated_at: fresh.updated_at! })).error?.code).toBe('P0985')
      expect((await staff.rpc('delete_guest_sheet_number_range', { p_id: queued.id!, p_expected_updated_at: queued.updated_at! })).error?.code).toBe('42501')
      expect((await owner.rpc('delete_guest_sheet_number_range', { p_id: queued.id!, p_expected_updated_at: queued.updated_at! })).error).toBeNull()
      expect(await state(staff, GEMEINDE_B)).toMatchObject({ next_number: 'C-060', free_count: 141 })
      // fremder Kunde sieht nichts
      expect(await state(ownerB, GEMEINDE_B)).toBeNull()
    })

    it('ohne Bereich „nicht festgelegt“; mit Wohnung als Hinweis für das Dashboard', async () => {
      await clearRanges(GEMEINDE_B)
      const { data } = await staff.from('guest_sheet_numbering').select('free_count, has_ranges, has_apartments, tenant_name, municipality_name').eq('tenant_id', tenant).eq('municipality_code', GEMEINDE_B).single()
      expect(data).toMatchObject({ free_count: 0, has_ranges: false, has_apartments: true, municipality_name: 'Eisenstadt' })
    })
  })

  describe('Kennzahlen und Schalter', () => {
    it('Inhaber speichert Kennzahlen mit führenden Nullen; Mitarbeiter liest; ungültige und fremde Gemeinden abgelehnt', async () => {
      const save = (client: Client, items: unknown[]) => client.rpc('save_establishment_numbers', { p_tenant_id: tenant, p_items: items as Json })
      expect((await save(owner, [{ municipality_code: GEMEINDE_A, establishment_number: '00123' }, { municipality_code: GEMEINDE_B, establishment_number: '' }])).error).toBeNull()
      const { data } = await staff.from('establishment_number_list').select('municipality_code, establishment_number, has_properties').eq('tenant_id', tenant).order('municipality_code')
      expect(data).toEqual([
        { municipality_code: GEMEINDE_B, establishment_number: null, has_properties: true },
        { municipality_code: GEMEINDE_A, establishment_number: '00123', has_properties: true },
      ])
      expect((await save(staff, [{ municipality_code: GEMEINDE_A, establishment_number: '1' }])).error?.code).toBe('42501')
      expect((await save(owner, [{ municipality_code: GEMEINDE_A, establishment_number: '12 3' }])).error?.code).toBe('22023')
      expect((await save(owner, [{ municipality_code: '10201', establishment_number: '1' }])).error?.code).toBe('22023')
    })

    it('Schalter „Gästeblätter nacherfassen“: Inhaber schaltet, Mitarbeiter nicht', async () => {
      expect((await owner.rpc('save_guest_sheet_backfill', { p_tenant_id: tenant, p_enabled: true })).error).toBeNull()
      expect((await staff.rpc('save_guest_sheet_backfill', { p_tenant_id: tenant, p_enabled: false })).error?.code).toBe('42501')
      const { data } = await staff.from('tenants').select('guest_sheet_backfill_enabled').eq('id', tenant).single()
      expect(data!.guest_sheet_backfill_enabled).toBe(true)
    })
  })

  describe('Buchung speichern', () => {
    it('ohne Nummernfeld bleibt die Nummer; Doppelt-Hinweis nur in derselben Gemeinde', async () => {
      const id = await newBooking(GEMEINDE_A, { guest_sheet_number: 'Q-1' })
      const b = await booking(id)
      const { data, error } = await owner.rpc('save_booking', {
        p_input: {
          id,
          updated_at: b.updated_at,
          tenant_id: tenant,
          apartment_id: b.apartment_id,
          arrival: b.arrival,
          planned_departure: b.planned_departure,
          departure: b.departure,
          guest_id: b.guest_id,
          adults: 2,
          child_ages: [],
          source: 'none',
          amounts: { nights_cents: 20000, nights_vat_rate: '10.00', charges: [] },
        } as Json,
        p_confirm: true,
      })
      expect(error).toBeNull()
      expect((data as { status?: string }).status).not.toBe('warnings')
      expect((await booking(id)).guest_sheet_number).toBe('Q-1')

      const warn = async (gemeinde: string) => {
        const { data: w } = await owner.rpc('booking_warnings', {
          p_tenant_id: tenant,
          p_apartment_id: apartments[gemeinde],
          p_arrival: '2029-01-01',
          p_departure: '2029-01-02',
          p_persons: 1,
          p_guest_sheet_number: 'q-1',
        })
        return (w as { guest_sheet_duplicates: unknown[] }).guest_sheet_duplicates.length
      }
      expect(await warn(GEMEINDE_A)).toBe(1)
      expect(await warn(GEMEINDE_B)).toBe(0)
    })
  })
})
