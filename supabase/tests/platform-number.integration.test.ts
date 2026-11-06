// @vitest-environment node
//
// PROJ-47: Plattform-Buchungsnummer gegen „apppa-dev“ (übersprungen ohne .env.local)
import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { Json } from '../../src/types/database'
import { type Client, hasSupabaseEnv, serviceClient } from './helpers'
import { sharedClient } from './shared-sessions'

type Duplicate = {
  first: { id: string; kind: string; number: string | null; apartment_label: string; arrival: string; departure: string; cancelled: boolean }
  more: number
} | null
type Saved = { status: 'saved'; id: string } | { status: 'warnings'; warnings: unknown }

describe.skipIf(!hasSupabaseEnv)('PROJ-47 Plattform-Buchungsnummer', () => {
  let service: Client
  const tenants: string[] = []
  let tenantA: string, tenantB: string
  let ownerA: Client, staffA: Client, ownerB: Client
  let aptA: string, aptA2: string, guestA: string, aptB: string, guestB: string
  const runId = randomUUID().slice(0, 8)
  // Je Lauf eigene Nummern, damit Reste früherer Läufe nicht stören
  const num = (suffix: string) => `${runId}${suffix}`.replace(/[^A-Za-z0-9-]/g, '').slice(0, 30)

  const newTenant = async (members: [string, 'owner' | 'staff'][]) => {
    const { data, error } = await service.from('tenants').insert({ name: `PROJ-47 Test ${runId}` }).select('id').single()
    if (error) throw error
    tenants.push(data.id)
    for (const [userId, role] of members) {
      const { error: e } = await service.from('memberships').insert({ tenant_id: data.id, user_id: userId, role })
      if (e) throw e
    }
    return data.id
  }
  const apartment = async (tenantId: string, name: string) => {
    const { data: p } = await service.from('properties').select('id').eq('tenant_id', tenantId).limit(1).maybeSingle()
    const propertyId =
      p?.id ??
      (
        await service
          .from('properties')
          .insert({ tenant_id: tenantId, name: 'Haus Test', street: 'Seeweg 12', postal_code: '5340', city: 'St. Gilgen', municipality_code: '50330' })
          .select('id')
          .single()
      ).data!.id
    const { data, error } = await service
      .from('apartments')
      .insert({ tenant_id: tenantId, property_id: propertyId, name, max_guests: 4, price_cents: 10000 })
      .select('id')
      .single()
    if (error) throw error
    return data.id
  }
  const guest = async (tenantId: string) => {
    const { data, error } = await service.from('guests').insert({ tenant_id: tenantId, last_name: 'Plattform', country: 'AT' }).select('id').single()
    if (error) throw error
    return data.id
  }
  const input = (tenantId: string, apartmentId: string, guestId: string, arrival: string, departure: string, over: Record<string, unknown> = {}) => ({
    tenant_id: tenantId,
    kind: 'booking',
    apartment_id: apartmentId,
    arrival,
    planned_departure: departure,
    departure,
    check_in: '15:00',
    check_out: '10:00',
    guest_id: guestId,
    adults: 2,
    child_ages: [],
    option_until: null,
    note: null,
    amounts: { nights_cents: 30000, nights_vat_rate: '10.00', charges: [] },
    ...over,
  })
  const save = async (client: Client, values: Record<string, unknown>) => {
    const { data, error } = await client.rpc('save_booking', { p_input: values as Json, p_confirm: false })
    return { result: data as unknown as Saved | null, error }
  }
  const savedId = (r: { result: Saved | null; error: unknown }) => {
    expect(r.error).toBeNull()
    expect(r.result?.status).toBe('saved')
    return (r.result as { id: string }).id
  }
  const row = async (id: string) => (await service.from('bookings').select('*').eq('id', id).single()).data!
  const duplicate = async (client: Client, tenantId: string, apartmentId: string, source: string, number: string, exclude?: string) => {
    const { data, error } = await client.rpc('booking_warnings', {
      p_tenant_id: tenantId,
      p_apartment_id: apartmentId,
      p_arrival: '2028-12-01',
      p_departure: '2028-12-02',
      p_persons: 1,
      p_exclude: exclude,
      p_source: source,
      p_platform_number: number,
    })
    expect(error).toBeNull()
    return (data as { platform_number_duplicate: Duplicate }).platform_number_duplicate
  }

  beforeAll(async () => {
    service = serviceClient()
    const [oa, sa, ob] = await Promise.all([sharedClient('ownerA'), sharedClient('staffA'), sharedClient('ownerB')])
    ;[ownerA, staffA, ownerB] = [oa.client, sa.client, ob.client]
    tenantA = await newTenant([
      [oa.user.id, 'owner'],
      [sa.user.id, 'staff'],
    ])
    tenantB = await newTenant([[ob.user.id, 'owner']])
    // Nacheinander: die erste Wohnung legt das Objekt des Kunden an
    aptA = await apartment(tenantA, 'Plattform 1')
    aptA2 = await apartment(tenantA, 'Plattform 2')
    aptB = await apartment(tenantB, 'Plattform B')
    ;[guestA, guestB] = await Promise.all([guest(tenantA), guest(tenantB)])
  }, 60_000)

  afterAll(async () => {
    if (!service) return
    for (const id of tenants) {
      const { error } = await service.from('tenants').delete().eq('id', id)
      if (error) console.error('Aufräumen fehlgeschlagen', error.message)
    }
  }, 60_000)

  it('speichert die Nummer ohne Leerzeichen und mit Schreibweise; Mitarbeiter dürfen; andere Quelle löscht sie', async () => {
    const n = num('Ab 12')
    const id = savedId(await save(staffA, input(tenantA, aptA, guestA, '2028-01-01', '2028-01-03', { source: 'airbnb', platform_number: ` ${n} ` })))
    expect((await row(id)).platform_number).toBe(n.replace(/\s/g, ''))

    // Quelle „Website“: Server speichert keine Nummer, auch wenn die Anfrage eine mitschickt
    const r = await row(id)
    savedId(await save(staffA, { ...input(tenantA, aptA, guestA, '2028-01-01', '2028-01-03', { source: 'website', platform_number: n }), id, updated_at: r.updated_at }))
    expect((await row(id)).platform_number).toBeNull()

    // Änderung steht im Änderungsprotokoll (alte und neue Nummer)
    const { data: log } = await service.from('audit_log').select('old_data, new_data').eq('table_name', 'bookings').eq('record_id', id).eq('action', 'update')
    expect(log!.some((l) => (l.old_data as { platform_number: string | null })?.platform_number === n.replace(/\s/g, '') && (l.new_data as { platform_number: string | null })?.platform_number === null)).toBe(true)
  })

  it('lehnt unerlaubte Zeichen und mehr als 30 Zeichen ab; leer = keine Nummer', async () => {
    for (const bad of ['4123/456', '#4123', '1'.repeat(31)]) {
      const r = await save(ownerA, input(tenantA, aptA, guestA, '2028-02-01', '2028-02-02', { source: 'booking_com', platform_number: bad }))
      expect(r.error?.code).toBe('P0807')
    }
    const id = savedId(await save(ownerA, input(tenantA, aptA, guestA, '2028-02-01', '2028-02-02', { source: 'booking_com', platform_number: '   ' })))
    expect((await row(id)).platform_number).toBeNull()
    // Auch direkt in der Tabelle: Nummer nur bei booking.com/Airbnb und nur im erlaubten Format
    expect((await service.from('bookings').update({ platform_number: 'X1' }).eq('id', id)).error).toBeNull()
    expect((await service.from('bookings').update({ source: 'website' }).eq('id', id)).error?.code).toBe('23514')
    expect((await service.from('bookings').update({ platform_number: 'a b' }).eq('id', id)).error?.code).toBe('23514')
  })

  it('Hinweis bei gleicher Nummer: gleiche Quelle, ohne Groß/Klein, storniert zählt, eigene Buchung ausgenommen, Anzahl weiterer', async () => {
    const n = num('HMdup')
    const first = savedId(await save(ownerA, input(tenantA, aptA, guestA, '2028-03-01', '2028-03-04', { source: 'airbnb', platform_number: n.toLowerCase() })))
    // Speichern einer zweiten Buchung mit derselben Nummer blockiert nie
    const second = savedId(await save(ownerA, input(tenantA, aptA2, guestA, '2028-03-01', '2028-03-04', { source: 'airbnb', platform_number: n.toUpperCase() })))
    expect((await ownerA.rpc('cancel_booking', { p_booking_id: first, p_reason: 'Test' })).error).toBeNull()

    const hit = await duplicate(ownerA, tenantA, aptA, 'airbnb', n.toUpperCase())
    expect(hit?.more).toBe(1)
    expect([first, second]).toContain(hit?.first.id)

    // Bearbeiten der zweiten Buchung: nur die stornierte erste ist ein Treffer
    const own = await duplicate(staffA, tenantA, aptA2, 'airbnb', n, second)
    expect(own).toMatchObject({ more: 0, first: { id: first, cancelled: true, arrival: '2028-03-01', departure: '2028-03-04', apartment_label: 'Haus Test · Plattform 1' } })
    expect((own?.first.number ?? '').length).toBeGreaterThan(0)

    // Andere Quelle oder keine Nummer: kein Hinweis
    expect(await duplicate(ownerA, tenantA, aptA, 'booking_com', n)).toBeNull()
    expect(await duplicate(ownerA, tenantA, aptA, 'website', n)).toBeNull()
    expect(await duplicate(ownerA, tenantA, aptA, 'airbnb', '')).toBeNull()

    // Nur sie selbst trägt die Nummer → kein Hinweis
    const single = num('solo')
    const solo = savedId(await save(ownerA, input(tenantA, aptA, guestA, '2028-04-01', '2028-04-02', { source: 'booking_com', platform_number: single })))
    expect(await duplicate(ownerA, tenantA, aptA, 'booking_com', single, solo)).toBeNull()
  })

  it('Mandantentrennung: fremde Nummern bleiben unsichtbar; fremder Kunde wird abgelehnt', async () => {
    const n = num('tenant')
    savedId(await save(ownerA, input(tenantA, aptA, guestA, '2028-05-01', '2028-05-02', { source: 'booking_com', platform_number: n })))
    expect(await duplicate(ownerB, tenantB, aptB, 'booking_com', n)).toBeNull()
    // Lesen und Suchen über die Tabelle: nur eigene Buchungen
    const { data } = await ownerB.from('bookings').select('id').ilike('platform_number', `%${n}%`)
    expect(data).toEqual([])
    // Warnungs-Abfrage für einen fremden Kunden
    const { error } = await ownerB.rpc('booking_warnings', {
      p_tenant_id: tenantA, p_apartment_id: aptA, p_arrival: '2028-05-01', p_departure: '2028-05-02', p_persons: 1, p_source: 'booking_com', p_platform_number: n,
    })
    expect(error?.code).toBe('P0801')
    // Speichern bei einem fremden Kunden
    const foreign = await save(ownerB, input(tenantA, aptA, guestA, '2028-06-01', '2028-06-02', { source: 'booking_com', platform_number: n }))
    expect(foreign.error?.code).toBe('P0801')
    savedId(await save(ownerB, input(tenantB, aptB, guestB, '2028-06-01', '2028-06-02', { source: 'booking_com', platform_number: n })))
  })

  it('Sperren haben nie eine Nummer', async () => {
    const { data, error } = await staffA.rpc('save_block', {
      p_input: { tenant_id: tenantA, apartment_id: aptA, arrival: '2028-07-01', departure: '2028-07-03', block_reason: 'renovation', note: null, platform_number: 'X1' } as Json,
    })
    expect(error).toBeNull()
    const id = (data as { id: string }).id
    expect((await row(id)).platform_number).toBeNull()
    expect((await service.from('bookings').update({ platform_number: 'X1' }).eq('id', id)).error?.code).toBe('23514')
  })
})
