// @vitest-environment node
//
// PROJ-16: Ortstaxen-Berichte gegen „apppa-dev“ (übersprungen ohne .env.local). Prüft tourist_tax_report (je Buchung und
// Gemeinde: Betrag, Personennächte, befreite Personennächte, Kennzeichen) und die Gleichheit mit tourist_tax_monthly
// (Dashboard), jeweils mit Rechten: Person ist Inhaberin bei A und Mitarbeiterin bei B.
import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { anonClient, type Client, hasSupabaseEnv, serviceClient } from './helpers'
import { sharedClient } from './shared-sessions'

type ReportRow = {
  booking_id: string
  booking_number: string | null
  guest_last_name: string | null
  guest_first_name: string | null
  guest_anonymized: boolean
  property_name: string
  apartment_name: string
  municipality_id: string
  municipality_name: string
  arrival: string
  departure: string
  persons: number
  amount_cents: number
  taxable_person_nights: number | null
  known_taxable_person_nights: number
  exempt_person_nights: number | null
  unknown_positions: number
  partial: boolean
  legacy: boolean
  percent: boolean
}
type TaxRow = { tenant_id: string; municipality_id: string; month: string; amount_cents: number }

describe.skipIf(!hasSupabaseEnv)('PROJ-16 Ortstaxen-Berichte', () => {
  let service: Client
  let ownerA: Client, staffA: Client
  let tenantA = '', tenantB = ''
  const runId = randomUUID().slice(0, 8)
  const ids: Record<string, string> = {}
  let seq = 0

  const property = async (tenant: string, code: string) => {
    const { data, error } = await service
      .from('properties')
      .insert({ tenant_id: tenant, name: `Haus ${code} ${runId}`, street: 'Seeweg 12', postal_code: '5340', city: 'Ort', municipality_code: code })
      .select('id')
      .single()
    if (error) throw error
    return data.id
  }
  const apartment = async (tenant: string, propertyId: string, name: string) => {
    const { data, error } = await service.from('apartments').insert({ tenant_id: tenant, property_id: propertyId, name, max_guests: 6, price_cents: 10000 }).select('id').single()
    if (error) throw error
    return data.id
  }
  const rate = async (tenant: string, apartmentId: string, validFrom: string, cents: number | null) => {
    const { data, error } = await service
      .from('apartment_tourist_tax_rates')
      .insert({
        tenant_id: tenant,
        apartment_id: apartmentId,
        valid_from: validFrom,
        label: 'Ortstaxe',
        method: cents === null ? 'percent' : 'per_person_night',
        amount_cents: cents,
        percent_rate: cents === null ? 3 : null,
        base: cents === null ? 'net' : null,
      } as never)
      .select('id')
      .single()
    if (error) throw error
    return (data as { id: string }).id
  }
  const booking = async (
    tenant: string,
    apartmentId: string,
    arrival: string,
    departure: string,
    opts: { kind?: 'booking' | 'option'; cancelledAt?: string; adults?: number; childAges?: number[]; lastName?: string } = {}
  ) => {
    const kind = opts.kind ?? 'booking'
    const { data: g } = await service
      .from('guests')
      .insert({ tenant_id: tenant, last_name: opts.lastName ?? `Gast ${runId}`, first_name: 'Anna', country: 'AT' })
      .select('id')
      .single()
    const { data, error } = await service
      .from('bookings')
      .insert({
        tenant_id: tenant,
        apartment_id: apartmentId,
        kind,
        arrival,
        departure,
        planned_departure: departure,
        guest_id: g!.id,
        check_in: '15:00',
        check_out: '10:00',
        adults: opts.adults ?? 2,
        child_ages: opts.childAges ?? [],
        number_year: Number(arrival.slice(0, 4)),
        number_seq: 7000 + ++seq,
        option_until: kind === 'option' ? '2099-01-01' : null,
        cancelled_at: opts.cancelledAt ?? null,
      } as never)
      .select('id')
      .single()
    if (error) throw error
    const id = (data as { id: string }).id
    const { error: e2 } = await service.from('booking_amounts').insert({ id, tenant_id: tenant, nights_cents: 30000 } as never)
    if (e2) throw e2
    return id
  }
  const charge = async (tenant: string, bookingId: string, cents: number, rateId: string | null, position = 1) => {
    const { error } = await service.from('booking_charges').insert({
      tenant_id: tenant,
      booking_id: bookingId,
      position,
      label: 'Ortstaxe',
      amount_cents: cents,
      vat_rate: 0,
      tourist_tax: true,
      tourist_tax_rate_id: rateId,
    } as never)
    if (error) throw error
  }
  const report = async (client: Client, tenant: string, from: string, to: string): Promise<ReportRow[]> => {
    const { data, error } = await client.rpc('tourist_tax_report' as never, { p_tenant_id: tenant, p_from: from, p_to: to } as never)
    if (error) throw error
    return (data ?? []) as ReportRow[]
  }
  const monthly = async (client: Client, tenant: string, from: string, to: string): Promise<TaxRow[]> => {
    const { data, error } = await client.rpc('tourist_tax_monthly', { p_tenant_ids: [tenant], p_from: from, p_to: to })
    if (error) throw error
    return (data ?? []) as TaxRow[]
  }
  const byId = (rows: ReportRow[]) => new Map(rows.map((r) => [r.booking_id, r]))

  beforeAll(async () => {
    service = serviceClient()
    const oa = await sharedClient('ownerA')
    const sa = await sharedClient('staffA')
    ownerA = oa.client
    staffA = sa.client
    const made: string[] = []
    for (const name of ['A', 'B']) {
      const { data: t, error } = await service.from('tenants').insert({ name: `PROJ-16 Test ${name} ${runId}` }).select('id').single()
      if (error) throw error
      made.push(t.id)
    }
    ;[tenantA, tenantB] = made
    const { error: mErr } = await service.from('memberships').insert([
      { tenant_id: tenantA, user_id: oa.user.id, role: 'owner' },
      { tenant_id: tenantA, user_id: sa.user.id, role: 'staff' },
      { tenant_id: tenantB, user_id: oa.user.id, role: 'staff' },
    ])
    if (mErr) throw mErr

    const p1 = await property(tenantA, '50330')
    const p2 = await property(tenantA, '50101')
    const ap = await apartment(tenantA, p1, `Top 1 ${runId}`)
    const apPercent = await apartment(tenantA, p1, `Top 2 ${runId}`)
    const apOther = await apartment(tenantA, p2, `Top 3 ${runId}`)
    const r25 = await rate(tenantA, ap, '2026-01-01', 250)
    const r28 = await rate(tenantA, ap, '2026-12-01', 280)
    const rPercent = await rate(tenantA, apPercent, '2026-01-01', null)
    await rate(tenantA, apOther, '2026-01-01', 200)

    // 2 Erwachsene + 1 Kind (befreit), 3 Nächte im Oktober: 6 abgabepflichtige, 3 befreite Personennächte
    ids.family = await booking(tenantA, ap, '2026-10-02', '2026-10-05', { childAges: [5], lastName: 'Huber' })
    await charge(tenantA, ids.family, 1500, r25)
    // über die Monatsgrenze, 2 Personen: im Oktober 2 Nächte = 4 Personennächte, „anteilig“
    ids.edge = await booking(tenantA, ap, '2026-09-30', '2026-10-03')
    await charge(tenantA, ids.edge, 1500, r25)
    // Tarifwechsel im Aufenthalt (1 Person): eine Zeile mit beiden Positionen
    ids.change = await booking(tenantA, ap, '2026-11-29', '2026-12-03', { adults: 1 })
    await charge(tenantA, ids.change, 500, r25, 1)
    await charge(tenantA, ids.change, 560, r28, 2)
    // Alt-Position, Vielfaches des Tarifs: Personennächte bekannt, befreite nicht bestimmbar
    ids.legacyKnown = await booking(tenantA, ap, '2026-10-10', '2026-10-13')
    await charge(tenantA, ids.legacyKnown, 1500, null)
    // Alt-Position, kein Vielfaches: Personennächte unbekannt, Kennzeichen „Alt-Position“
    ids.legacyOdd = await booking(tenantA, ap, '2026-10-14', '2026-10-17')
    await charge(tenantA, ids.legacyOdd, 1001, null)
    // Prozent-Tarif
    ids.percent = await booking(tenantA, apPercent, '2026-10-05', '2026-10-08')
    await charge(tenantA, ids.percent, 900, rPercent)
    // Personenzahl nachträglich verringert: befreite Personennächte nie unter 0
    ids.reduced = await booking(tenantA, ap, '2026-10-20', '2026-10-23', { adults: 1 })
    await charge(tenantA, ids.reduced, 1500, r25)
    // zweite Gemeinde, Wohnung archiviert
    ids.archived = await booking(tenantA, apOther, '2026-10-01', '2026-10-03')
    await charge(tenantA, ids.archived, 800, null)
    await service.from('apartments').update({ archived_at: new Date().toISOString() } as never).eq('id', apOther)
    // ausgenommen: Option, Storno
    ids.option = await booking(tenantA, ap, '2026-10-24', '2026-10-26', { kind: 'option' })
    await charge(tenantA, ids.option, 1000, r25)
    ids.storno = await booking(tenantA, ap, '2026-10-26', '2026-10-28', { cancelledAt: '2026-10-01T10:00:00Z' })
    await charge(tenantA, ids.storno, 1000, r25)
    // anonymisierter Gast
    await service
      .from('guests')
      .update({ anonymized_at: new Date().toISOString() } as never)
      .eq('id', (await service.from('bookings').select('guest_id').eq('id', ids.reduced).single()).data!.guest_id!)
    // Kunde B (ownerA ist dort nur Mitarbeiterin)
    const pB = await property(tenantB, '50330')
    const apB = await apartment(tenantB, pB, `Top B ${runId}`)
    ids.foreign = await booking(tenantB, apB, '2026-10-05', '2026-10-07')
    await charge(tenantB, ids.foreign, 400, null)
  }, 120_000)

  afterAll(async () => {
    if (!service) return
    for (const t of [tenantA, tenantB].filter(Boolean)) await service.from('tenants').delete().eq('id', t)
  })

  it('Personennächte, befreite Personennächte und Betrag je Buchung', async () => {
    const r = byId(await report(ownerA, tenantA, '2026-10-01', '2026-10-31'))
    expect(r.get(ids.family)).toMatchObject({
      persons: 3,
      amount_cents: 1500,
      taxable_person_nights: 6,
      known_taxable_person_nights: 6,
      exempt_person_nights: 3,
      unknown_positions: 0,
      partial: false,
      legacy: false,
      percent: false,
      guest_last_name: 'Huber',
      guest_anonymized: false,
      municipality_id: '50330',
      apartment_name: `Top 1 ${runId}`,
    })
  })

  it('über die Monatsgrenze nur der Anteil im Zeitraum, „anteilig“', async () => {
    const oct = byId(await report(ownerA, tenantA, '2026-10-01', '2026-10-31')).get(ids.edge)
    expect(oct).toMatchObject({ amount_cents: 1000, taxable_person_nights: 4, exempt_person_nights: 0, partial: true })
    const sep = byId(await report(ownerA, tenantA, '2026-09-01', '2026-09-30')).get(ids.edge)
    expect(sep).toMatchObject({ amount_cents: 500, taxable_person_nights: 2, partial: true })
  })

  it('Tarifwechsel im Aufenthalt: eine Zeile mit beiden Positionen', async () => {
    const rows = (await report(ownerA, tenantA, '2026-11-01', '2026-12-31')).filter((x) => x.booking_id === ids.change)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ amount_cents: 1060, taxable_person_nights: 4, exempt_person_nights: 0, partial: false })
  })

  it('Alt-Positionen: Vielfaches mit Personennächten, sonst unbekannt und gekennzeichnet; befreite nie bestimmbar', async () => {
    const r = byId(await report(ownerA, tenantA, '2026-10-01', '2026-10-31'))
    expect(r.get(ids.legacyKnown)).toMatchObject({ taxable_person_nights: 6, exempt_person_nights: null, unknown_positions: 0, legacy: false })
    expect(r.get(ids.legacyOdd)).toMatchObject({
      amount_cents: 1001,
      taxable_person_nights: null,
      known_taxable_person_nights: 0,
      exempt_person_nights: null,
      unknown_positions: 1,
      legacy: true,
    })
  })

  it('Prozent-Tarif: Betrag zählt, Personennächte unbekannt', async () => {
    const p = byId(await report(ownerA, tenantA, '2026-10-01', '2026-10-31')).get(ids.percent)
    expect(p).toMatchObject({ amount_cents: 900, taxable_person_nights: null, exempt_person_nights: null, unknown_positions: 1, percent: true, legacy: false })
  })

  it('befreite Personennächte nie unter 0; anonymisierter Gast gekennzeichnet', async () => {
    const r = byId(await report(ownerA, tenantA, '2026-10-01', '2026-10-31')).get(ids.reduced)
    expect(r).toMatchObject({ persons: 1, taxable_person_nights: 6, exempt_person_nights: 0, guest_anonymized: true })
  })

  it('archivierte Wohnung zählt in ihrer Gemeinde; Option und Storno zählen nicht', async () => {
    const rows = await report(ownerA, tenantA, '2026-10-01', '2026-10-31')
    const r = byId(rows)
    expect(r.get(ids.archived)).toMatchObject({ municipality_id: '50101', amount_cents: 800 })
    expect(r.has(ids.option)).toBe(false)
    expect(r.has(ids.storno)).toBe(false)
  })

  it('Summe je Gemeinde und Monat wie im Dashboard', async () => {
    for (const [from, to] of [
      ['2026-09-01', '2026-09-30'],
      ['2026-10-01', '2026-10-31'],
      ['2026-11-01', '2026-11-30'],
      ['2026-12-01', '2026-12-31'],
    ]) {
      const rows = await report(ownerA, tenantA, from, to)
      const fromReport = new Map<string, number>()
      for (const x of rows) fromReport.set(x.municipality_id, (fromReport.get(x.municipality_id) ?? 0) + Number(x.amount_cents))
      const fromDashboard = new Map((await monthly(ownerA, tenantA, from, to)).map((m) => [m.municipality_id, Number(m.amount_cents)]))
      expect(fromReport).toEqual(fromDashboard)
    }
  })

  it('Quartal ist die Summe seiner Monate', async () => {
    const sum = async (from: string, to: string) => (await report(ownerA, tenantA, from, to)).reduce((s, x) => s + Number(x.amount_cents), 0)
    expect(await sum('2026-10-01', '2026-12-31')).toBe((await sum('2026-10-01', '2026-10-31')) + (await sum('2026-11-01', '2026-11-30')) + (await sum('2026-12-01', '2026-12-31')))
  })

  it('nur für Inhaber: Mitarbeiter, Inhaberin eines anderen Kunden als Mitarbeiterin und ohne Anmeldung erhalten nichts', async () => {
    expect(await report(staffA, tenantA, '2026-10-01', '2026-10-31')).toEqual([])
    expect(await report(ownerA, tenantB, '2026-10-01', '2026-10-31')).toEqual([])
    const { data, error } = await anonClient().rpc('tourist_tax_report' as never, { p_tenant_id: tenantA, p_from: '2026-10-01', p_to: '2026-10-31' } as never)
    expect(error ?? (data as unknown[]).length === 0).toBeTruthy()
  })

  it('der Rechenkern ist von außen nicht aufrufbar', async () => {
    const { error } = await ownerA.rpc('tourist_tax_parts' as never, { p_tenant_ids: [tenantA], p_from: '2026-10-01', p_to: '2026-10-31' } as never)
    expect(error).not.toBeNull()
  })
})
