// @vitest-environment node
//
// PROJ-15: Ortstaxe je Wohnung gegen „apppa-dev“ (übersprungen ohne .env.local).
// Die Rechenfälle entsprechen src/lib/tourist-tax.test.ts (App-Fassung) – beide Fassungen müssen gleich rechnen.
import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { Json } from '../../src/types/database'
import { type Client, hasSupabaseEnv, serviceClient } from './helpers'
import { sharedClient } from './shared-sessions'

type Saved = { status: 'saved'; id: string } | { status: 'warnings' }
type Rate = {
  id?: string | null
  valid_from: string
  label?: string
  method?: 'per_person_night' | 'percent'
  amount_cents?: number | null
  percent_rate?: string | null
  base?: 'net' | 'gross' | null
  exempt_under_age?: number | null
  vat_rate?: string
}

describe.skipIf(!hasSupabaseEnv)('PROJ-15 Ortstaxe je Wohnung', () => {
  let service: Client
  const tenants: string[] = []
  let tenantA: string
  let ownerA: Client, staffA: Client, ownerB: Client
  const runId = randomUUID().slice(0, 8)

  const newTenant = async (members: [string, 'owner' | 'staff'][]) => {
    const { data, error } = await service.from('tenants').insert({ name: `PROJ-15 Test ${runId}` }).select('id').single()
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
          .insert({ tenant_id: tenantId, name: 'Haus Ortstaxe', street: 'Seeweg 1', postal_code: '5340', city: 'St. Gilgen', municipality_code: '50330' })
          .select('id')
          .single()
      ).data!.id
    const { data, error } = await service
      .from('apartments')
      .insert({ tenant_id: tenantId, property_id: propertyId, name, max_guests: 8, price_cents: 10000 })
      .select('id')
      .single()
    if (error) throw error
    return data.id
  }
  const guest = async (tenantId: string, birthDate: string | null = '1980-05-01') => {
    const { data, error } = await service
      .from('guests')
      .insert({ tenant_id: tenantId, last_name: 'Gast', country: 'AT', birth_date: birthDate })
      .select('id')
      .single()
    if (error) throw error
    return data.id
  }
  const rate = (r: Rate): Rate => ({
    id: null,
    label: 'Nächtigungsabgabe',
    method: 'per_person_night',
    amount_cents: 250,
    percent_rate: null,
    base: null,
    exempt_under_age: null,
    vat_rate: '0.00',
    ...r,
  })
  const percentRate = (validFrom: string, percent: string, base: 'net' | 'gross') =>
    rate({ valid_from: validFrom, label: 'Ortstaxe', method: 'percent', amount_cents: null, percent_rate: percent, base })
  const saveRates = (client: Client, apartmentId: string, rates: Rate[]) =>
    client.rpc('save_tourist_tax_rates', { p_apartment_id: apartmentId, p_rates: rates.map(rate) as unknown as Json })
  const ratesOf = async (apartmentId: string) =>
    (await service.from('apartment_tourist_tax_rates').select('*').eq('apartment_id', apartmentId).order('valid_from')).data!

  const input = (apartmentId: string, guestId: string, arrival: string, departure: string, over: Record<string, unknown> = {}) => ({
    tenant_id: tenantA,
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
    amounts: { nights_cents: 40000, nights_vat_rate: '10.00', charges: [] },
    ...over,
  })
  const save = async (client: Client, p: Record<string, unknown>) => {
    const { data, error } = await client.rpc('save_booking', { p_input: p as Json, p_confirm: true })
    expect(error).toBeNull()
    expect((data as unknown as Saved).status).toBe('saved')
    return (data as unknown as { id: string }).id
  }
  const booking = async (id: string) => (await service.from('bookings').select('*').eq('id', id).single()).data!
  const charges = async (id: string) =>
    (
      await service
        .from('booking_charges')
        .select('id, position, label, amount_cents, vat_rate, tourist_tax, tourist_tax_rate_id, tax_person_nights')
        .eq('booking_id', id)
        .order('position')
    ).data!
  const taxAmounts = async (id: string) => (await charges(id)).filter((c) => c.tourist_tax).map((c) => c.amount_cents)
  // Gespeicherte Positionen so zurückschicken, wie das Formular sie sendet
  const sent = async (id: string) =>
    (await charges(id)).map((c) => ({
      id: c.id,
      label: c.label,
      amount_cents: c.amount_cents,
      vat_rate: Number(c.vat_rate).toFixed(2),
      tourist_tax: c.tourist_tax ? { rate_id: c.tourist_tax_rate_id, person_nights: c.tax_person_nights } : null,
    }))
  const update = async (client: Client, id: string, p: Record<string, unknown>) => {
    const b = await booking(id)
    return save(client, { ...p, id, updated_at: b.updated_at })
  }
  const companions = async (client: Client, id: string, list: { birth_date: string | null; tourist_tax_exempt?: boolean }[]) => {
    const b = await booking(id)
    const { error } = await client.rpc('save_companions', {
      p_booking_id: id,
      p_updated_at: b.updated_at,
      p_companions: list.map((c, i) => ({ first_name: `P${i}`, last_name: 'Gast', ...c })) as unknown as Json,
    })
    expect(error).toBeNull()
  }

  beforeAll(async () => {
    service = serviceClient()
    const [oa, sa, ob] = await Promise.all([sharedClient('ownerA'), sharedClient('staffA'), sharedClient('ownerB')])
    ;[ownerA, staffA, ownerB] = [oa.client, sa.client, ob.client]
    tenantA = await newTenant([
      [oa.user.id, 'owner'],
      [sa.user.id, 'staff'],
    ])
    await newTenant([[ob.user.id, 'owner']])
  }, 60_000)

  afterAll(async () => {
    if (!service) return
    for (const id of tenants) {
      const { error } = await service.from('tenants').delete().eq('id', id)
      if (error) console.error('Aufräumen fehlgeschlagen', error.message)
    }
  }, 60_000)

  describe('Tarife', () => {
    it('Inhaber speichert die Liste; unveränderte Einträge behalten Kennung; entfernte verschwinden', async () => {
      const apt = await apartment(tenantA, 'Tarife')
      expect((await saveRates(ownerA, apt, [{ valid_from: '2026-01-01', exempt_under_age: 15 }])).error).toBeNull()
      const [first] = await ratesOf(apt)
      expect(first).toMatchObject({ label: 'Nächtigungsabgabe', amount_cents: 250, exempt_under_age: 15, vat_rate: 0 })
      expect((await saveRates(ownerA, apt, [{ id: first.id, valid_from: '2026-01-01', exempt_under_age: 15 }, { valid_from: '2027-01-01', amount_cents: 300 }])).error).toBeNull()
      const both = await ratesOf(apt)
      expect(both.map((r) => r.id)[0]).toBe(first.id)
      expect(both[0].updated_at).toBe(first.updated_at)
      expect((await saveRates(ownerA, apt, [{ id: both[1].id, valid_from: '2027-01-01', amount_cents: 300 }])).error).toBeNull()
      expect((await ratesOf(apt)).map((r) => r.valid_from)).toEqual(['2027-01-01'])
    })

    it('Datum je Wohnung einmal (23505 mit Regelname); Felder je Berechnungsart; Daten tauschen geht', async () => {
      const apt = await apartment(tenantA, 'Tarifregeln')
      const dup = await saveRates(ownerA, apt, [{ valid_from: '2026-01-01' }, { valid_from: '2026-01-01', amount_cents: 300 }])
      expect(dup.error?.code).toBe('23505')
      expect(dup.error?.message).toContain('apartment_tourist_tax_rates')
      expect((await saveRates(ownerA, apt, [rate({ valid_from: '2026-01-01', method: 'percent', amount_cents: null, percent_rate: '3.20' })])).error?.code).toBe('23514')
      expect((await saveRates(ownerA, apt, [{ valid_from: '2026-01-01', exempt_under_age: 19 }])).error?.code).toBe('23514')
      expect((await saveRates(ownerA, apt, [{ valid_from: '2026-01-01', vat_rate: '101' }])).error?.code).toBe('22023')
      await saveRates(ownerA, apt, [{ valid_from: '2026-01-01' }, { valid_from: '2027-01-01', amount_cents: 300 }])
      const [a, b] = await ratesOf(apt)
      const swap = await saveRates(ownerA, apt, [
        { id: a.id, valid_from: '2027-01-01' },
        { id: b.id, valid_from: '2026-01-01', amount_cents: 300 },
      ])
      expect(swap.error).toBeNull()
    })

    it('Mitarbeiter und fremde Inhaber: weder lesen noch speichern', async () => {
      const apt = await apartment(tenantA, 'Tarifrechte')
      await saveRates(ownerA, apt, [{ valid_from: '2026-01-01' }])
      expect((await staffA.from('apartment_tourist_tax_rates').select('id').eq('apartment_id', apt)).data).toEqual([])
      expect((await ownerB.from('apartment_tourist_tax_rates').select('id').eq('apartment_id', apt)).data).toEqual([])
      expect((await saveRates(staffA, apt, [])).error?.code).toBe('42501')
      expect((await saveRates(ownerB, apt, [])).error?.code).toBe('42501')
      const { error } = await staffA.from('apartment_tourist_tax_rates').insert({ tenant_id: tenantA, apartment_id: apt, valid_from: '2028-01-01', label: 'X', method: 'per_person_night', amount_cents: 1 })
      expect(error).not.toBeNull()
      expect(await ratesOf(apt)).toHaveLength(1)
    })
  })

  describe('Berechnung (Beispielfälle der Spec)', () => {
    it('2 Erwachsene + 1 Kind, 4 Nächte, € 2,50 → € 30,00 mit 0 % und 12 Personennächten, nach der Reinigung', async () => {
      const apt = await apartment(tenantA, 'Grundfall')
      await saveRates(ownerA, apt, [{ valid_from: '2026-01-01' }])
      const [r] = await ratesOf(apt)
      const id = await save(
        ownerA,
        input(apt, await guest(tenantA), '2027-07-01', '2027-07-05', {
          child_ages: [4],
          amounts: { nights_cents: 40000, nights_vat_rate: '10.00', charges: [{ label: 'Reinigung', amount_cents: 6000, vat_rate: '10.00' }] },
        })
      )
      expect((await booking(id)).tourist_tax_mode).toBe('auto')
      const list = await charges(id)
      expect(list.map((c) => [c.position, c.label, c.amount_cents, Number(c.vat_rate), c.tourist_tax, c.tax_person_nights])).toEqual([
        [1, 'Reinigung', 6000, 10, false, null],
        [2, 'Nächtigungsabgabe', 3000, 0, true, 12],
      ])
      expect(list[1].tourist_tax_rate_id).toBe(r.id)
    })

    it('Altersgrenze tagesgenau über Mitreisende; Personen ohne Geburtsdatum zahlen; Häkchen befreit', async () => {
      const apt = await apartment(tenantA, 'Alter')
      await saveRates(ownerA, apt, [{ valid_from: '2026-01-01', amount_cents: 100, exempt_under_age: 15 }])
      // 1 Erwachsener (Hauptgast) + 1 Kind, 5 Nächte; ohne Geburtsdatum zahlt das Kind voll
      const id = await save(ownerA, input(apt, await guest(tenantA), '2027-07-01', '2027-07-06', { adults: 1, child_ages: [14] }))
      expect(await taxAmounts(id)).toEqual([1000])
      // Kind wird am 3. Tag 15: Nächte 1–2 frei
      await companions(staffA, id, [{ birth_date: '2012-07-03' }])
      expect(await taxAmounts(id)).toEqual([800])
      // Kind befreit, dann auch der Hauptgast: keine Position mehr
      await companions(staffA, id, [{ birth_date: '2012-07-03', tourist_tax_exempt: true }])
      expect(await taxAmounts(id)).toEqual([500])
      await update(ownerA, id, input(apt, (await booking(id)).guest_id!, '2027-07-01', '2027-07-06', {
        adults: 1,
        child_ages: [14],
        main_guest_tourist_tax_exempt: true,
        amounts: { nights_cents: 40000, nights_vat_rate: '10.00', charges: await sent(id) },
      }))
      expect(await taxAmounts(id)).toEqual([])
      expect((await booking(id)).main_guest_tourist_tax_exempt).toBe(true)
    })

    it('Tarifwechsel 01.01.: zwei Positionen € 12,00 und € 10,00', async () => {
      const apt = await apartment(tenantA, 'Wechsel')
      await saveRates(ownerA, apt, [{ valid_from: '2026-01-01', amount_cents: 200 }, { valid_from: '2027-01-01', amount_cents: 250 }])
      const id = await save(ownerA, input(apt, await guest(tenantA), '2026-12-29', '2027-01-03'))
      expect((await charges(id)).map((c) => [c.amount_cents, c.tax_person_nights])).toEqual([
        [1200, 6],
        [1000, 4],
      ])
    })

    it('Nächte vor dem ersten Tarif sind frei', async () => {
      const apt = await apartment(tenantA, 'Vorlauf')
      await saveRates(ownerA, apt, [{ valid_from: '2027-01-01' }])
      const id = await save(ownerA, input(apt, await guest(tenantA), '2026-12-29', '2027-01-03'))
      expect(await taxAmounts(id)).toEqual([1000])
    })

    it('Prozent: 3,20 % netto von € 440,00 → € 12,80; brutto → € 14,08; Kleinunternehmer netto = brutto', async () => {
      const net = await apartment(tenantA, 'Prozent netto')
      const gross = await apartment(tenantA, 'Prozent brutto')
      await saveRates(ownerA, net, [percentRate('2026-01-01', '3.20', 'net')])
      await saveRates(ownerA, gross, [percentRate('2026-01-01', '3.20', 'gross')])
      const amounts = { nights_cents: 44000, nights_vat_rate: '10.00', charges: [] }
      const a = await save(ownerA, input(net, await guest(tenantA), '2027-08-01', '2027-08-05', { amounts }))
      const b = await save(ownerA, input(gross, await guest(tenantA), '2027-08-01', '2027-08-05', { amounts }))
      expect(await taxAmounts(a)).toEqual([1280])
      expect(await taxAmounts(b)).toEqual([1408])
      expect((await charges(a))[0].tax_person_nights).toBeNull()

      const ku = await newTenant([])
      await service.from('memberships').insert({ tenant_id: ku, user_id: (await ownerA.auth.getUser()).data.user!.id, role: 'owner' })
      await service.from('vat_status_changes').insert({ tenant_id: ku, valid_from: '2026-01-01', small_business: true })
      const kuApt = await apartment(ku, 'Kleinunternehmer')
      await saveRates(ownerA, kuApt, [percentRate('2026-01-01', '3.20', 'net')])
      const c = await save(ownerA, { ...input(kuApt, await guest(ku), '2027-08-01', '2027-08-05', { amounts }), tenant_id: ku })
      expect(await taxAmounts(c)).toEqual([1408])
    })

    it('Prozent bei früherer Abreise: Basis bleibt der ganze abgerechnete Preis', async () => {
      const apt = await apartment(tenantA, 'Prozent früh')
      await saveRates(ownerA, apt, [percentRate('2026-01-01', '10.00', 'gross')])
      const id = await save(
        ownerA,
        input(apt, await guest(tenantA), '2027-09-01', '2027-09-04', {
          planned_departure: '2027-09-06',
          amounts: { nights_cents: 50000, nights_vat_rate: '10.00', charges: [] },
        })
      )
      expect(await taxAmounts(id)).toEqual([5000])
    })

    it('„Wohnsitz angemeldet“ und Wohnung ohne Tarif: keine Abgabe; Option wie Buchung', async () => {
      const apt = await apartment(tenantA, 'Keine')
      const none = await apartment(tenantA, 'Ohne Tarif')
      await saveRates(ownerA, apt, [{ valid_from: '2026-01-01' }])
      const g = await guest(tenantA)
      expect(await taxAmounts(await save(ownerA, input(apt, g, '2027-10-01', '2027-10-05', { residence_registered: true })))).toEqual([])
      expect(await taxAmounts(await save(ownerA, input(none, g, '2027-10-10', '2027-10-12')))).toEqual([])
      expect(await taxAmounts(await save(ownerA, input(apt, g, '2027-10-20', '2027-10-24', { kind: 'option', option_until: '2027-01-01' })))).toEqual([2000])
    })
  })

  describe('Zustände automatisch, von Hand, noch nicht berechnet', () => {
    it('Tarifänderung zieht nicht nach; „Abgabe neu berechnen“ übernimmt sie; Kennung bleibt', async () => {
      const apt = await apartment(tenantA, 'Nachziehen')
      await saveRates(ownerA, apt, [{ valid_from: '2026-01-01' }])
      const g = await guest(tenantA)
      const id = await save(ownerA, input(apt, g, '2027-11-01', '2027-11-05'))
      const [before] = await charges(id)
      const [r] = await ratesOf(apt)
      await saveRates(ownerA, apt, [{ id: r.id, valid_from: '2026-01-01', amount_cents: 300 }])
      await update(ownerA, id, input(apt, g, '2027-11-01', '2027-11-05', { note: 'nur Notiz', amounts: { nights_cents: 40000, nights_vat_rate: '10.00', charges: await sent(id) } }))
      expect(await taxAmounts(id)).toEqual([2000])
      await update(ownerA, id, input(apt, g, '2027-11-01', '2027-11-05', { tourist_tax_mode: 'auto', tourist_tax_recalculate: true, amounts: { nights_cents: 40000, nights_vat_rate: '10.00', charges: await sent(id) } }))
      const [after] = await charges(id)
      expect(after.amount_cents).toBe(2400)
      expect(after.id).toBe(before.id)
    })

    it('Automatisch: gesendete Abgabe-Beträge werden nicht übernommen', async () => {
      const apt = await apartment(tenantA, 'Manipulation')
      await saveRates(ownerA, apt, [{ valid_from: '2026-01-01' }])
      const g = await guest(tenantA)
      const id = await save(ownerA, input(apt, g, '2027-11-10', '2027-11-14'))
      const forged = (await sent(id)).map((c) => ({ ...c, amount_cents: 1 }))
      await update(ownerA, id, input(apt, g, '2027-11-10', '2027-11-14', { amounts: { nights_cents: 40000, nights_vat_rate: '10.00', charges: forged } }))
      expect(await taxAmounts(id)).toEqual([2000])
      // neue Buchung mit erfundener Abgabe-Position
      const fresh = await save(
        ownerA,
        input(apt, g, '2027-11-20', '2027-11-22', {
          amounts: { nights_cents: 20000, nights_vat_rate: '10.00', charges: [{ label: 'Nächtigungsabgabe', amount_cents: 1, vat_rate: '0.00', tourist_tax: { rate_id: null, person_nights: 0 } }] },
        })
      )
      expect(await taxAmounts(fresh)).toEqual([1000])
    })

    it('Von Hand: Betrag bleibt; Mitarbeiter-Änderung → „Preis prüfen“; Mitarbeiter darf den Zustand nicht ändern', async () => {
      const apt = await apartment(tenantA, 'Von Hand')
      await saveRates(ownerA, apt, [{ valid_from: '2026-01-01' }])
      const g = await guest(tenantA)
      const id = await save(ownerA, input(apt, g, '2027-12-01', '2027-12-05'))
      const own = (await sent(id)).map((c) => ({ ...c, amount_cents: 999 }))
      await update(ownerA, id, input(apt, g, '2027-12-01', '2027-12-05', { tourist_tax_mode: 'manual', amounts: { nights_cents: 40000, nights_vat_rate: '10.00', charges: own } }))
      expect(await taxAmounts(id)).toEqual([999])
      expect((await booking(id)).tourist_tax_mode).toBe('manual')
      await update(staffA, id, { ...input(apt, g, '2027-12-01', '2027-12-05', { adults: 3, tourist_tax_mode: 'auto', tourist_tax_recalculate: true }), amounts: null })
      const b = await booking(id)
      expect(b.tourist_tax_mode).toBe('manual')
      expect(b.price_review).toBe(true)
      expect(await taxAmounts(id)).toEqual([999])
    })

    it('Automatisch: Mitarbeiter ändert Personen → neu berechnet; neue Mitarbeiter-Buchung rechnet nach der Reinigung', async () => {
      const apt = await apartment(tenantA, 'Mitarbeiter')
      await service.from('apartments').update({ cleaning_fee_cents: 5000 }).eq('id', apt)
      await saveRates(ownerA, apt, [{ valid_from: '2026-01-01' }])
      const g = await guest(tenantA)
      const id = await save(staffA, { ...input(apt, g, '2028-01-10', '2028-01-14'), amounts: null })
      expect((await charges(id)).map((c) => [c.label, c.amount_cents])).toEqual([
        ['Endreinigung', 5000],
        ['Nächtigungsabgabe', 2000],
      ])
      await update(staffA, id, { ...input(apt, g, '2028-01-10', '2028-01-14', { adults: 3 }), amounts: null })
      expect(await taxAmounts(id)).toEqual([3000])
      expect((await booking(id)).price_review).toBe(false)
    })

    it('Noch nicht berechnet (Bestand): bleibt beim Speichern; „Abgabe berechnen“ setzt automatisch', async () => {
      const apt = await apartment(tenantA, 'Bestand')
      await saveRates(ownerA, apt, [{ valid_from: '2026-01-01' }])
      const g = await guest(tenantA)
      const id = await save(ownerA, input(apt, g, '2028-02-01', '2028-02-05', { residence_registered: true }))
      await service.from('bookings').update({ tourist_tax_mode: 'pending' }).eq('id', id)
      const pendingInput = (over: Record<string, unknown> = {}) => input(apt, g, '2028-02-01', '2028-02-05', { tourist_tax_mode: 'pending', ...over })
      await update(ownerA, id, pendingInput({ adults: 3 }))
      expect(await taxAmounts(id)).toEqual([])
      await update(staffA, id, { ...pendingInput({ adults: 2 }), amounts: null })
      expect(await taxAmounts(id)).toEqual([])
      expect((await booking(id)).tourist_tax_mode).toBe('pending')
      await update(ownerA, id, pendingInput({ tourist_tax_mode: 'auto', tourist_tax_recalculate: true }))
      expect(await taxAmounts(id)).toEqual([2000])
      expect((await booking(id)).tourist_tax_mode).toBe('auto')
    })

    it('Neuberechnung behält die vom Inhaber gewählte Stelle der Abgabe-Position', async () => {
      const apt = await apartment(tenantA, 'Reihenfolge')
      await saveRates(ownerA, apt, [{ valid_from: '2026-01-01' }])
      const g = await guest(tenantA)
      const id = await save(
        ownerA,
        input(apt, g, '2028-03-01', '2028-03-05', {
          amounts: {
            nights_cents: 40000,
            nights_vat_rate: '10.00',
            charges: [
              { label: 'Reinigung', amount_cents: 6000, vat_rate: '10.00' },
              { label: 'Rabatt', amount_cents: -1000, vat_rate: '20.00' },
            ],
          },
        })
      )
      // Abgabe ganz nach oben schieben, dann Personen ändern
      const list = await sent(id)
      const reordered = [list[2], list[0], list[1]]
      await update(ownerA, id, input(apt, g, '2028-03-01', '2028-03-05', { adults: 3, amounts: { nights_cents: 40000, nights_vat_rate: '10.00', charges: reordered } }))
      expect((await charges(id)).map((c) => [c.label, c.amount_cents])).toEqual([
        ['Nächtigungsabgabe', 3000],
        ['Reinigung', 6000],
        ['Rabatt', -1000],
      ])
    })

    it('Mehr als 20 Positionen mit Abgabe: Fehler mit Regelname, nichts gespeichert (QA BUG-4)', async () => {
      const apt = await apartment(tenantA, 'Viele Positionen')
      await saveRates(ownerA, apt, [{ valid_from: '2026-01-01' }])
      const many = Array.from({ length: 20 }, (_, i) => ({ label: `Posten ${i + 1}`, amount_cents: 100, vat_rate: '20.00' }))
      const { error } = await ownerA.rpc('save_booking', {
        p_input: input(apt, await guest(tenantA), '2028-05-01', '2028-05-03', { amounts: { nights_cents: 20000, nights_vat_rate: '10.00', charges: many } }) as Json,
        p_confirm: true,
      })
      expect(error?.code).toBe('23514')
      expect(error?.message).toContain('booking_charges_position_check')
      expect((await service.from('bookings').select('id').eq('apartment_id', apt)).data).toEqual([])
    })

    it('Gelöschter Tarif: Abgabe-Position bleibt mit Kennzeichen, Verweis leer', async () => {
      const apt = await apartment(tenantA, 'Tarif weg')
      await saveRates(ownerA, apt, [{ valid_from: '2026-01-01' }])
      const id = await save(ownerA, input(apt, await guest(tenantA), '2028-04-01', '2028-04-03'))
      await saveRates(ownerA, apt, [])
      const [c] = await charges(id)
      expect(c).toMatchObject({ tourist_tax: true, tourist_tax_rate_id: null, amount_cents: 1000 })
    })
  })
})
