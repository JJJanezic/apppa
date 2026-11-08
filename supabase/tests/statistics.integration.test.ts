// @vitest-environment node
//
// PROJ-18: Statistische Auswertungen gegen „apppa-dev“ (übersprungen ohne .env.local). Prüft statistics_rows (Nächte,
// Umsatz, USt, Gäste je Wohnung und Monat inkl. Vorjahr), statistics_origin und dashboard_statistics mit Rechten:
// Person ist Inhaberin bei A und C (Kleinunternehmer) und Mitarbeiterin bei B.
import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { anonClient, type Client, hasSupabaseEnv, serviceClient } from './helpers'
import { sharedClient } from './shared-sessions'

type Row = {
  apartment_id: string
  month: string
  available_nights: number
  occupied_nights: number
  blocked_nights: number
  revenue_cents: number
  revenue_vat_cents: number
  fee_cents: number
  fee_vat_cents: number
  guest_nights: number
  arrivals: number
  bookings: number
  stay_nights: number
}
type OriginRow = { apartment_id: string; country: string; previous: boolean; arrivals: number; guest_nights: number; revenue_cents: number }
type DashRow = { tenant_id: string; available_nights: number; occupied_nights: number; revenue_cents: number; vat_cents: number }

describe.skipIf(!hasSupabaseEnv)('PROJ-18 Statistische Auswertungen', () => {
  let service: Client
  let ownerA: Client, staffA: Client
  let tenantA = '', tenantB = '', tenantC = ''
  const runId = randomUUID().slice(0, 8)
  const ids: Record<string, string> = {}
  let seq = 0

  const property = async (tenant: string) => {
    const { data, error } = await service
      .from('properties')
      .insert({ tenant_id: tenant, name: `Haus ${runId}`, street: 'Seeweg 12', postal_code: '5340', city: 'Ort', municipality_code: '50330' })
      .select('id')
      .single()
    if (error) throw error
    return data.id
  }
  const apartment = async (tenant: string, propertyId: string, name: string, archivedAt: string | null = null) => {
    const { data, error } = await service
      .from('apartments')
      .insert({ tenant_id: tenant, property_id: propertyId, name: `${name} ${runId}`, max_guests: 6, price_cents: 10000, archived_at: archivedAt })
      .select('id')
      .single()
    if (error) throw error
    return data.id
  }
  const booking = async (
    tenant: string,
    apartmentId: string,
    arrival: string,
    departure: string,
    opts: {
      kind?: 'booking' | 'option' | 'block'
      cancelledAt?: string
      adults?: number
      childAges?: number[]
      country?: string
      nightsCents?: number
      feeCents?: number
    } = {}
  ) => {
    const kind = opts.kind ?? 'booking'
    let guestId: string | null = null
    if (kind !== 'block') {
      const { data: g, error: gErr } = await service
        .from('guests')
        .insert({ tenant_id: tenant, last_name: `Gast ${runId}`, first_name: 'Anna', country: opts.country ?? 'AT' })
        .select('id')
        .single()
      if (gErr) throw gErr
      guestId = g.id
    }
    const { data, error } = await service
      .from('bookings')
      .insert({
        tenant_id: tenant,
        apartment_id: apartmentId,
        kind,
        arrival,
        departure,
        planned_departure: departure,
        guest_id: guestId,
        check_in: '15:00',
        check_out: '10:00',
        adults: kind === 'block' ? null : (opts.adults ?? 2),
        child_ages: opts.childAges ?? [],
        number_year: kind === 'block' ? null : Number(arrival.slice(0, 4)),
        number_seq: kind === 'block' ? null : 8000 + ++seq,
        option_until: kind === 'option' ? '2099-01-01' : null,
        block_reason: kind === 'block' ? 'owner_use' : null,
        cancelled_at: opts.cancelledAt ?? null,
      } as never)
      .select('id')
      .single()
    if (error) throw error
    const id = (data as { id: string }).id
    if (kind !== 'block') {
      const nights = opts.nightsCents ?? 0
      const { error: e2 } = await service.from('booking_amounts').insert({
        id,
        tenant_id: tenant,
        nights_cents: nights,
        billed_nights_cents: nights,
        nights_vat_rate: 10,
        cancellation_fee_cents: opts.feeCents ?? null,
        cancellation_fee_vat_rate: 20,
      } as never)
      if (e2) throw e2
    }
    return id
  }
  const charge = async (tenant: string, bookingId: string, position: number, cents: number, vatRate: number, touristTax = false) => {
    const { error } = await service
      .from('booking_charges')
      .insert({ tenant_id: tenant, booking_id: bookingId, position, label: touristTax ? 'Ortstaxe' : `Position ${position}`, amount_cents: cents, vat_rate: vatRate, tourist_tax: touristTax } as never)
    if (error) throw error
  }

  const rows = async (client: Client, tenant: string, from: string, to: string): Promise<Row[]> => {
    const { data, error } = await client.rpc('statistics_rows', { p_tenant_id: tenant, p_from: from, p_to: to })
    if (error) throw error
    return ((data ?? []) as unknown as Row[]).map((r) => ({
      ...r,
      revenue_cents: Number(r.revenue_cents),
      revenue_vat_cents: Number(r.revenue_vat_cents),
      fee_cents: Number(r.fee_cents),
      fee_vat_cents: Number(r.fee_vat_cents),
    }))
  }
  const origin = async (client: Client, tenant: string, from: string, to: string): Promise<OriginRow[]> => {
    const { data, error } = await client.rpc('statistics_origin', { p_tenant_id: tenant, p_from: from, p_to: to })
    if (error) throw error
    return ((data ?? []) as unknown as OriginRow[]).map((r) => ({ ...r, revenue_cents: Number(r.revenue_cents) }))
  }
  const dashboard = async (client: Client, tenants: string[], month: string): Promise<DashRow[]> => {
    const { data, error } = await client.rpc('dashboard_statistics', { p_tenant_ids: tenants, p_month: month })
    if (error) throw error
    return ((data ?? []) as unknown as DashRow[]).map((r) => ({ ...r, revenue_cents: Number(r.revenue_cents), vat_cents: Number(r.vat_cents) }))
  }
  const find = (list: Row[], apartmentId: string, month: string) => list.find((r) => r.apartment_id === apartmentId && r.month === month)

  beforeAll(async () => {
    service = serviceClient()
    const oa = await sharedClient('ownerA')
    const sa = await sharedClient('staffA')
    ownerA = oa.client
    staffA = sa.client
    const made: string[] = []
    for (const name of ['A', 'B', 'C']) {
      const { data: t, error } = await service.from('tenants').insert({ name: `PROJ-18 Test ${name} ${runId}` }).select('id').single()
      if (error) throw error
      made.push(t.id)
    }
    ;[tenantA, tenantB, tenantC] = made
    const { error: mErr } = await service.from('memberships').insert([
      { tenant_id: tenantA, user_id: oa.user.id, role: 'owner' },
      { tenant_id: tenantA, user_id: sa.user.id, role: 'staff' },
      { tenant_id: tenantB, user_id: oa.user.id, role: 'staff' },
      { tenant_id: tenantC, user_id: oa.user.id, role: 'owner' },
    ])
    if (mErr) throw mErr

    const p = await property(tenantA)
    ids.ap1 = await apartment(tenantA, p, 'Top 1')
    // ohne aktive Buchung: zählt ab Anlage (heute)
    ids.ap2 = await apartment(tenantA, p, 'Top 2')
    // am 20.10.2026 archiviert
    ids.ap3 = await apartment(tenantA, p, 'Top 3', '2026-10-20T10:00:00+02:00')

    // Top 1: 6 Nächte über die Monatsgrenze (4 im Oktober, 2 im November), 2 Erwachsene + 1 Kind.
    // Übernachtung € 600 (10 %), Endreinigung € 60 (20 %), Rabatt -€ 10 (10 %), Ortstaxe € 18 (zählt nicht)
    ids.main = await booking(tenantA, ids.ap1, '2026-10-28', '2026-11-03', { childAges: [5], nightsCents: 60000 })
    await charge(tenantA, ids.main, 1, 6000, 20)
    await charge(tenantA, ids.main, 2, -1000, 10)
    await charge(tenantA, ids.main, 3, 1800, 0, true)
    // Doppelbuchung 01.–03.10. und 02.–04.10.: belegt sind 3 Nächte
    ids.dbl1 = await booking(tenantA, ids.ap1, '2026-10-01', '2026-10-03', { nightsCents: 20000 })
    ids.dbl2 = await booking(tenantA, ids.ap1, '2026-10-02', '2026-10-04', { nightsCents: 20000 })
    // Sperre 03.–05.10. (Nacht 3 ist gebucht, nur Nacht 4 gesperrt) und 10.–12.10. (2 Nächte)
    await booking(tenantA, ids.ap1, '2026-10-03', '2026-10-05', { kind: 'block' })
    await booking(tenantA, ids.ap1, '2026-10-10', '2026-10-12', { kind: 'block' })
    // Option und stornierte Buchung ohne Gebühr zählen nicht
    await booking(tenantA, ids.ap1, '2026-10-15', '2026-10-18', { kind: 'option', nightsCents: 30000 })
    await booking(tenantA, ids.ap1, '2026-10-20', '2026-10-22', { cancelledAt: '2026-09-01T10:00:00Z', nightsCents: 30000 })
    // Vorjahr: 2 Nächte im Oktober 2025
    ids.prev = await booking(tenantA, ids.ap1, '2025-10-05', '2025-10-07', { nightsCents: 22000, country: 'DE' })

    // Top 2: storniert mit Stornogebühr € 80 (20 %) im Dezember, Gast aus Deutschland
    ids.fee = await booking(tenantA, ids.ap2, '2026-12-05', '2026-12-08', { cancelledAt: '2026-11-01T10:00:00Z', nightsCents: 30000, feeCents: 8000, country: 'DE' })

    // Top 3 (archiviert am 20.10.): Buchung 18.–23.10., 1 Erwachsener aus den Niederlanden
    await booking(tenantA, ids.ap3, '2026-10-18', '2026-10-23', { adults: 1, nightsCents: 50000, country: 'NL' })

    // Kunde C: Kleinunternehmer → keine USt
    const { error: vErr } = await service.from('vat_status_changes').insert({ tenant_id: tenantC, valid_from: '2020-01-01', small_business: true } as never)
    if (vErr) throw vErr
    const pc = await property(tenantC)
    ids.apC = await apartment(tenantC, pc, 'Studio')
    await booking(tenantC, ids.apC, '2026-10-05', '2026-10-08', { nightsCents: 30000 })

    // Kunde B (dort nur Mitarbeiterin)
    const pb = await property(tenantB)
    const apB = await apartment(tenantB, pb, 'Top B')
    await booking(tenantB, apB, '2026-10-05', '2026-10-08', { nightsCents: 30000 })
  })

  afterAll(async () => {
    if (!service) return
    for (const t of [tenantA, tenantB, tenantC].filter(Boolean)) await service.from('tenants').delete().eq('id', t)
  })

  it('Nächte: Doppelbuchung einmal, Sperre ohne gebuchte Nacht, Option und Storno frei', async () => {
    const r = find(await rows(ownerA, tenantA, '2026-10-01', '2026-10-31'), ids.ap1, '2026-10-01')
    // belegt 1.–3. und 28.–31. Oktober; gesperrt 4., 10., 11.
    expect(r).toMatchObject({ occupied_nights: 7, blocked_nights: 3, available_nights: 28 })
  })

  it('Umsatz ohne Ortstaxe, je Nacht verteilt, Rest in der letzten Nacht; USt je Satz', async () => {
    const list = await rows(ownerA, tenantA, '2026-10-01', '2026-11-30')
    const oct = find(list, ids.ap1, '2026-10-01')!
    const nov = find(list, ids.ap1, '2026-11-01')!
    // Hauptbuchung € 650,00: 6 Nächte zu 10.833 Cent, Rest 2 Cent in der letzten Nacht; dazu Doppelbuchung 2 × € 200
    expect(oct.revenue_cents).toBe(43332 + 40000)
    expect(nov.revenue_cents).toBe(21668)
    // USt: 10 % aus € 590 = 5.364, 20 % aus € 60 = 1.000 → 6.364, je Nacht 1.060, Rest 4; Doppelbuchung 2 × 1.818
    expect(oct.revenue_vat_cents).toBe(4240 + 2 * 1818)
    expect(nov.revenue_vat_cents).toBe(2124)
  })

  it('Gäste, Ankünfte und Buchungen nach Anreisemonat', async () => {
    const list = await rows(ownerA, tenantA, '2026-10-01', '2026-11-30')
    const oct = find(list, ids.ap1, '2026-10-01')!
    const nov = find(list, ids.ap1, '2026-11-01')!
    // Hauptbuchung 3 Personen × 4 Nächte, Doppelbuchung 2 × 2 Personen × 2 Nächte
    expect(oct).toMatchObject({ guest_nights: 12 + 8, arrivals: 3 + 4, bookings: 3, stay_nights: 6 + 2 + 2 })
    expect(nov).toMatchObject({ guest_nights: 6, arrivals: 0, bookings: 0, stay_nights: 0 })
  })

  it('Stornogebühr im Anreisemonat mit eigenem Satz, ohne Nächte; Wohnung ohne Buchung zählt ab Anlage', async () => {
    const list = await rows(ownerA, tenantA, '2026-12-01', '2026-12-31')
    expect(find(list, ids.ap2, '2026-12-01')).toMatchObject({ fee_cents: 8000, fee_vat_cents: 1333, occupied_nights: 0, revenue_cents: 0, available_nights: 31 })
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Vienna' }).format(new Date())
    const month = `${today.slice(0, 7)}-01`
    const lastDay = new Date(Date.UTC(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0)).getUTCDate()
    const current = find(await rows(ownerA, tenantA, month, `${today.slice(0, 7)}-${lastDay}`), ids.ap2, month)
    expect(current?.available_nights).toBe(lastDay - Number(today.slice(8, 10)) + 1)
  })

  it('archivierte Wohnung zählt bis zur Archivierung; spätere belegte Nächte als verfügbar (nie über 100 %)', async () => {
    const r = find(await rows(ownerA, tenantA, '2026-10-01', '2026-10-31'), ids.ap3, '2026-10-01')
    // 1.–19. Oktober verfügbar (19), dazu die belegten Nächte 20.–22. (3)
    expect(r).toMatchObject({ available_nights: 22, occupied_nights: 5 })
    expect(find(await rows(ownerA, tenantA, '2026-11-01', '2026-11-30'), ids.ap3, '2026-11-01')).toBeUndefined()
  })

  it('Vorjahr kommt mit: dieselben Monate ein Jahr früher; verfügbar ab Monat der ersten Buchung', async () => {
    const list = await rows(ownerA, tenantA, '2026-10-01', '2026-10-31')
    expect(find(list, ids.ap1, '2025-10-01')).toMatchObject({ occupied_nights: 2, available_nights: 31, revenue_cents: 22000 })
    expect(list.every((r) => ['2025-10-01', '2026-10-01'].includes(r.month))).toBe(true)
  })

  it('Summe einer Buchung über alle Monate gleich dem Buchungsbetrag ohne Ortstaxe', async () => {
    const list = await rows(ownerA, tenantA, '2026-01-01', '2026-12-31')
    const sum = list.filter((r) => r.apartment_id === ids.ap1 && r.month.startsWith('2026')).reduce((s, r) => s + r.revenue_cents, 0)
    expect(sum).toBe(65000 + 40000)
  })

  it('Kleinunternehmer: keine USt', async () => {
    const r = find(await rows(ownerA, tenantC, '2026-10-01', '2026-10-31'), ids.apC, '2026-10-01')
    expect(r).toMatchObject({ revenue_cents: 30000, revenue_vat_cents: 0 })
  })

  it('Gästeherkunft je Land, Vorjahr getrennt, Stornogebühr beim Land der Buchung', async () => {
    const list = await origin(ownerA, tenantA, '2026-10-01', '2026-12-31')
    const at = list.filter((r) => r.country === 'AT' && !r.previous && r.apartment_id === ids.ap1)
    expect(at).toEqual([{ apartment_id: ids.ap1, country: 'AT', previous: false, arrivals: 7, guest_nights: 26, revenue_cents: 105000 }])
    expect(list.find((r) => r.country === 'DE' && r.previous)).toMatchObject({ apartment_id: ids.ap1, arrivals: 2, guest_nights: 4, revenue_cents: 22000 })
    expect(list.find((r) => r.country === 'DE' && !r.previous)).toMatchObject({ apartment_id: ids.ap2, arrivals: 0, guest_nights: 0, revenue_cents: 8000 })
    expect(list.find((r) => r.country === 'NL')).toMatchObject({ arrivals: 1, guest_nights: 5 })
  })

  it('Dashboard: je Inhaber-Kunde, gleiche Zahlen wie die Seite', async () => {
    const dash = await dashboard(ownerA, [tenantA, tenantB, tenantC], '2026-10-01')
    expect(dash.map((d) => d.tenant_id).sort()).toEqual([tenantA, tenantC].sort())
    const page = (await rows(ownerA, tenantA, '2026-10-01', '2026-10-31')).filter((r) => r.month === '2026-10-01')
    const a = dash.find((d) => d.tenant_id === tenantA)!
    expect(a.available_nights).toBe(page.reduce((s, r) => s + r.available_nights, 0))
    expect(a.occupied_nights).toBe(page.reduce((s, r) => s + r.occupied_nights, 0))
    expect(a.revenue_cents).toBe(page.reduce((s, r) => s + r.revenue_cents + r.fee_cents, 0))
    expect(a.vat_cents).toBe(page.reduce((s, r) => s + r.revenue_vat_cents + r.fee_vat_cents, 0))
  })

  it('mehr als ein Jahr Zeitraum liefert nichts', async () => {
    expect(await rows(ownerA, tenantA, '2025-01-01', '2026-12-31')).toEqual([])
  })

  it('nur für Inhaber: Mitarbeiter, Mitarbeiterin eines anderen Kunden und ohne Anmeldung erhalten nichts', async () => {
    expect(await rows(staffA, tenantA, '2026-10-01', '2026-10-31')).toEqual([])
    expect(await origin(staffA, tenantA, '2026-10-01', '2026-10-31')).toEqual([])
    expect(await rows(ownerA, tenantB, '2026-10-01', '2026-10-31')).toEqual([])
    expect(await dashboard(staffA, [tenantA], '2026-10-01')).toEqual([])
    const { data, error } = await anonClient().rpc('statistics_rows', { p_tenant_id: tenantA, p_from: '2026-10-01', p_to: '2026-10-31' })
    expect(error ?? (data as unknown[]).length === 0).toBeTruthy()
  })

  it('über mehrere Kunden (refine): nur Inhaber-Kunden, Kunde je Zeile, Summe gleich den Einzelabfragen', async () => {
    const { data, error } = await ownerA.rpc('statistics_tenant_rows', { p_tenant_ids: [tenantA, tenantB, tenantC], p_from: '2026-10-01', p_to: '2026-10-31' })
    if (error) throw error
    const list = (data ?? []) as unknown as (Row & { tenant_id: string })[]
    // B (nur Mitarbeiterin) liefert nichts
    expect(new Set(list.map((r) => r.tenant_id))).toEqual(new Set([tenantA, tenantC]))
    const single = [...(await rows(ownerA, tenantA, '2026-10-01', '2026-10-31')), ...(await rows(ownerA, tenantC, '2026-10-01', '2026-10-31'))]
    const sum = (xs: { occupied_nights: number; revenue_cents: number | string }[]) => xs.reduce((s, r) => [s[0] + r.occupied_nights, s[1] + Number(r.revenue_cents)], [0, 0])
    expect(sum(list)).toEqual(sum(single))
    expect(list.find((r) => r.apartment_id === ids.apC)?.tenant_id).toBe(tenantC)
  })

  it('Herkunft über mehrere Kunden mit Kunde je Zeile; Mitarbeiter erhält nichts', async () => {
    const { data, error } = await ownerA.rpc('statistics_tenant_origin', { p_tenant_ids: [tenantA, tenantB, tenantC], p_from: '2026-10-01', p_to: '2026-12-31' })
    if (error) throw error
    const list = (data ?? []) as unknown as (OriginRow & { tenant_id: string })[]
    expect(new Set(list.map((r) => r.tenant_id))).toEqual(new Set([tenantA, tenantC]))
    expect(list.find((r) => r.country === 'NL')?.tenant_id).toBe(tenantA)
    const staff = await staffA.rpc('statistics_tenant_rows', { p_tenant_ids: [tenantA], p_from: '2026-10-01', p_to: '2026-10-31' })
    expect(staff.error ?? (staff.data as unknown[]).length === 0).toBeTruthy()
  })

  it('die Rechenkerne sind von außen nicht aufrufbar', async () => {
    const { error } = await ownerA.rpc('statistics_apartment_months' as never, { p_tenant_ids: [tenantA], p_months: ['2026-10-01'] } as never)
    expect(error).not.toBeNull()
    const { error: e2 } = await ownerA.rpc('statistics_booking_parts' as never, { p_tenant_ids: [tenantA], p_months: ['2026-10-01'] } as never)
    expect(e2).not.toBeNull()
  })
})
