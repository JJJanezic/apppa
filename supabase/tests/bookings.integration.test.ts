// @vitest-environment node
//
// PROJ-8: Manuelle Buchungen gegen „apppa-dev“ (übersprungen ohne .env.local)
import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { Json } from '../../src/types/database'
import { type Client, createTestUser, hasSupabaseEnv, serviceClient, signIn, type TestUser } from './helpers'

type Saved = { status: 'saved'; id: string } | { status: 'warnings'; warnings: { conflicts: { id: string }[]; over_capacity: unknown } }

describe.skipIf(!hasSupabaseEnv)('PROJ-8 Manuelle Buchungen', () => {
  let service: Client
  const users: TestUser[] = []
  const tenants: string[] = []
  let tenantA: string
  let ownerA: Client, staffA: Client, ownerB: Client
  let ownerUserA: TestUser, staffUserA: TestUser
  const runId = randomUUID().slice(0, 8)

  const user = async () => {
    const u = await createTestUser(service)
    users.push(u)
    return u
  }
  const newTenant = async (members: [TestUser, 'owner' | 'staff'][]) => {
    const { data, error } = await service.from('tenants').insert({ name: `PROJ-8 Test ${runId}` }).select('id').single()
    if (error) throw error
    tenants.push(data.id)
    for (const [u, role] of members) {
      const { error: e } = await service.from('memberships').insert({ tenant_id: data.id, user_id: u.id, role })
      if (e) throw e
    }
    return data.id
  }
  type ApartmentExtra = {
    max_guests?: number
    max_adults?: number | null
    price_cents?: number | null
    cleaning_fee_cents?: number | null
    price_mode?: string
    adult_price_cents?: number | null
    child_prices?: Json
  }
  const apartment = async (tenantId: string, name: string, extra: ApartmentExtra = {}) => {
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
      .insert({ tenant_id: tenantId, property_id: propertyId, name, max_guests: 4, price_cents: 10000, ...extra })
      .select('id')
      .single()
    if (error) throw error
    return data.id
  }
  const guest = async (tenantId: string, lastName: string) => {
    const { data, error } = await service.from('guests').insert({ tenant_id: tenantId, last_name: lastName, country: 'AT' }).select('id').single()
    if (error) throw error
    return data.id
  }
  const save = async (client: Client, input: Record<string, unknown>, confirm = false) => {
    const { data, error } = await client.rpc('save_booking', { p_input: input as Json, p_confirm: confirm })
    return { result: data as unknown as Saved | null, error }
  }
  const savedId = (r: { result: Saved | null; error: unknown }) => {
    expect(r.error).toBeNull()
    expect(r.result?.status).toBe('saved')
    return (r.result as { id: string }).id
  }
  const bookingInput = (tenantId: string, apartmentId: string, guestId: string, arrival: string, departure: string, over: Record<string, unknown> = {}) => ({
    tenant_id: tenantId,
    kind: 'booking',
    apartment_id: apartmentId,
    arrival,
    departure,
    check_in: '15:00',
    check_out: '10:00',
    guest_id: guestId,
    adults: 2,
    child_ages: [],
    option_until: null,
    note: null,
    amounts: { nights_cents: 30000, charges: [{ label: 'Reinigung', amount_cents: 6000 }] },
    ...over,
  })
  const row = async (id: string) => (await service.from('bookings').select('*').eq('id', id).single()).data!

  beforeAll(async () => {
    service = serviceClient()
    const [a, s, b] = await Promise.all([user(), user(), user()])
    ownerUserA = a
    staffUserA = s
    tenantA = await newTenant([
      [a, 'owner'],
      [s, 'staff'],
    ])
    await newTenant([[b, 'owner']])
    ;[ownerA, staffA, ownerB] = await Promise.all([signIn(a), signIn(s), signIn(b)])
  }, 60_000)

  afterAll(async () => {
    if (!service) return
    // Löschen des Kunden entfernt Buchungen, Wohnungen und Gäste in einer Anweisung (Löschsperre NO ACTION)
    for (const id of tenants) {
      const { error } = await service.from('tenants').delete().eq('id', id)
      if (error) console.error('Aufräumen fehlgeschlagen', error.message)
    }
    for (const u of users) await service.auth.admin.deleteUser(u.id)
  }, 60_000)

  describe('Anlegen, Nummern und Rechte', () => {
    it('Inhaber legt an; Nummer je Jahr fortlaufend; Beträge nur für Inhaber; fremde Kunden sehen nichts', async () => {
      const apt = await apartment(tenantA, 'Nummern')
      const g = await guest(tenantA, 'Huber')
      const first = savedId(await save(ownerA, bookingInput(tenantA, apt, g, '2027-03-01', '2027-03-04')))
      const second = savedId(await save(ownerA, bookingInput(tenantA, apt, g, '2027-03-04', '2027-03-06')))
      const [b1, b2] = [await row(first), await row(second)]
      expect(b2.number_seq).toBe(b1.number_seq! + 1)
      expect(b1.number).toMatch(/^2027-\d{4}$/)

      expect((await ownerA.from('booking_amounts').select('nights_cents').eq('id', first)).data).toEqual([{ nights_cents: 30000 }])
      expect((await ownerA.from('booking_charges').select('label, amount_cents').eq('booking_id', first)).data).toEqual([{ label: 'Reinigung', amount_cents: 6000 }])
      expect((await staffA.from('bookings').select('id').eq('id', first)).data).toHaveLength(1)
      expect((await staffA.from('booking_amounts').select('nights_cents').eq('id', first)).data).toHaveLength(0)
      expect((await staffA.from('booking_charges').select('id').eq('booking_id', first)).data).toHaveLength(0)
      expect((await ownerB.from('bookings').select('id').eq('id', first)).data).toHaveLength(0)

      // Direktes Schreiben ist nicht erlaubt, fremde Kunden können nicht über die Funktion buchen
      const direct = await ownerA.from('bookings').update({ note: 'x' }).eq('id', first).select('id')
      expect(direct.error ?? (direct.data?.length === 0 ? 'keine Zeile' : null)).not.toBeNull()
      const foreign = await save(ownerB, bookingInput(tenantA, apt, g, '2027-05-01', '2027-05-02'))
      expect(foreign.error?.code).toBe('P0801')
    })

    it('vergibt bei gleichzeitigem Anlegen eindeutige, lückenlose Nummern', async () => {
      const t = await newTenant([[ownerUserA, 'owner']])
      // Objekt zuerst anlegen, dann die Wohnungen (sonst legt jede Wohnung ihr eigenes Objekt an)
      const apts = [await apartment(t, 'Parallel 1')]
      apts.push(...(await Promise.all([2, 3, 4, 5].map((n) => apartment(t, `Parallel ${n}`)))))
      const g = await guest(t, 'Parallel')
      const ids = await Promise.all(apts.map((a) => save(ownerA, bookingInput(t, a, g, '2028-01-10', '2028-01-12')).then(savedId)))
      const seqs = (await service.from('bookings').select('number_seq').in('id', ids)).data!.map((r) => r.number_seq).sort()
      expect(seqs).toEqual([1, 2, 3, 4, 5])
    })

    it('Mitarbeiter-Buchungen erhalten den Preisvorschlag; mitgeschickte Beträge zählen nicht', async () => {
      const apt = await apartment(tenantA, 'Vorschlag', { price_cents: 12000, cleaning_fee_cents: 5500 })
      const g = await guest(tenantA, 'Staffgast')
      const id = savedId(await save(staffA, bookingInput(tenantA, apt, g, '2027-06-01', '2027-06-04', { amounts: { nights_cents: 1, charges: [] } })))
      expect((await service.from('booking_amounts').select('nights_cents').eq('id', id)).data).toEqual([{ nights_cents: 36000 }])
      expect((await service.from('booking_charges').select('label, amount_cents').eq('booking_id', id)).data).toEqual([{ label: 'Reinigung', amount_cents: 5500 }])

      // Änderung des Zeitraums durch Mitarbeiter: Preis bleibt, „Preis prüfen“ wird gesetzt
      const b = await row(id)
      savedId(await save(staffA, { ...bookingInput(tenantA, apt, g, '2027-06-01', '2027-06-05'), id, updated_at: b.updated_at }))
      expect((await row(id)).price_review).toBe(true)
      expect((await service.from('booking_amounts').select('nights_cents').eq('id', id)).data).toEqual([{ nights_cents: 36000 }])
    })

    it('legt einen neuen Gast nur zusammen mit der Buchung an (alles oder nichts), auch für Mitarbeiter', async () => {
      const apt = await apartment(tenantA, 'Neugast')
      const newGuest = { last_name: `Neu ${runId}`, first_name: 'Nina', country: 'DE' }
      const bad = await save(staffA, bookingInput(tenantA, apt, '', '2027-07-05', '2027-07-01', { guest_id: null, new_guest: newGuest }))
      expect(bad.error).not.toBeNull()
      expect((await service.from('guests').select('id').eq('last_name', newGuest.last_name)).data).toHaveLength(0)

      const id = savedId(await save(staffA, bookingInput(tenantA, apt, '', '2027-07-01', '2027-07-05', { guest_id: null, new_guest: newGuest })))
      const created = (await service.from('guests').select('id, tenant_id').eq('last_name', newGuest.last_name)).data!
      expect(created).toHaveLength(1)
      expect((await row(id)).guest_id).toBe(created[0].id)
    })

    it('lehnt archivierte Wohnungen und anonymisierte Gäste für neue Buchungen ab', async () => {
      const apt = await apartment(tenantA, 'Archiv')
      const g = await guest(tenantA, 'Archivgast')
      await service.from('apartments').update({ archived_at: new Date().toISOString() }).eq('id', apt)
      expect((await save(ownerA, bookingInput(tenantA, apt, g, '2027-08-01', '2027-08-03'))).error?.code).toBe('P0806')
      const apt2 = await apartment(tenantA, 'Anonym')
      await service.rpc('anonymize_guest', { p_guest_id: g })
      expect((await save(ownerA, bookingInput(tenantA, apt2, g, '2027-08-01', '2027-08-03'))).error?.code).toBe('P0804')
    })
  })

  describe('Überschneidung und Kapazität', () => {
    let apt: string, g: string
    beforeAll(async () => {
      apt = await apartment(tenantA, 'Konflikt', { max_guests: 3 })
      g = await guest(tenantA, 'Konfliktgast')
      savedId(await save(ownerA, bookingInput(tenantA, apt, g, '2027-09-10', '2027-09-15')))
    })

    it('Wechseltag ist erlaubt; Überschneidung liefert Warnungen und speichert nichts', async () => {
      savedId(await save(staffA, bookingInput(tenantA, apt, g, '2027-09-15', '2027-09-17')))
      const before = (await service.from('bookings').select('id').eq('apartment_id', apt)).data!.length
      const owner = await save(ownerA, bookingInput(tenantA, apt, g, '2027-09-14', '2027-09-16'))
      expect(owner.result?.status).toBe('warnings')
      expect((owner.result as { warnings: { conflicts: unknown[] } }).warnings.conflicts).toHaveLength(2)
      const staff = await save(staffA, bookingInput(tenantA, apt, g, '2027-09-14', '2027-09-16'), true)
      expect(staff.result?.status).toBe('warnings')
      expect((await service.from('bookings').select('id').eq('apartment_id', apt)).data).toHaveLength(before)
    })

    it('Inhaber übersteuern bewusst; die Person wird vermerkt', async () => {
      const id = savedId(await save(ownerA, bookingInput(tenantA, apt, g, '2027-09-11', '2027-09-12'), true))
      expect((await row(id)).override_by).toBe(ownerUserA.id)
    })

    it('warnt bei Überbelegung', async () => {
      const r = await save(ownerA, bookingInput(tenantA, apt, g, '2027-10-01', '2027-10-03', { adults: 2, child_ages: [3, 5] }))
      expect((r.result as { warnings: { over_capacity: unknown } }).warnings.over_capacity).toEqual({ persons: 4, max_guests: 3, adults: 2, max_adults: null })
    })

    it('stornierte und verfallene Einträge zählen nicht; Vorschau nur für Mitglieder', async () => {
      const t = await newTenant([
        [ownerUserA, 'owner'],
        [staffUserA, 'staff'],
      ])
      const a = await apartment(t, 'Frei')
      const gg = await guest(t, 'Frei')
      const cancelled = savedId(await save(ownerA, bookingInput(t, a, gg, '2027-11-01', '2027-11-05')))
      expect((await staffA.rpc('cancel_booking', { p_booking_id: cancelled })).error?.code).toBe('P0801')
      expect((await ownerA.rpc('cancel_booking', { p_booking_id: cancelled, p_reason: 'Krankheit', p_fee_cents: 5000 })).error).toBeNull()
      expect((await service.from('booking_amounts').select('cancellation_fee_cents').eq('id', cancelled)).data).toEqual([{ cancellation_fee_cents: 5000 }])

      // verfallene Option (Ablaufdatum gestern) direkt in der Datenbank
      const { data: n } = await service.from('booking_numbers').select('last_seq').eq('tenant_id', t).eq('year', 2027).single()
      await service.from('bookings').insert({
        tenant_id: t, apartment_id: a, kind: 'option', number_year: 2027, number_seq: n!.last_seq + 100, arrival: '2027-11-02', departure: '2027-11-04',
        guest_id: gg, adults: 1, option_until: '2020-01-01',
      })
      const preview = await staffA.rpc('booking_warnings', { p_tenant_id: t, p_apartment_id: a, p_arrival: '2027-11-01', p_departure: '2027-11-05', p_persons: 2 })
      expect((preview.data as { conflicts: unknown[] }).conflicts).toHaveLength(0)
      expect((await ownerB.rpc('booking_warnings', { p_tenant_id: t, p_apartment_id: a, p_arrival: '2027-11-01', p_departure: '2027-11-05', p_persons: 2 })).error?.code).toBe('P0801')
      savedId(await save(staffA, bookingInput(t, a, gg, '2027-11-01', '2027-11-05')))
    })
  })

  describe('Optionen, Sperren, Mitreisende, Stand', () => {
    it('Option wird zur Buchung mit derselben Nummer', async () => {
      const apt = await apartment(tenantA, 'Option')
      const g = await guest(tenantA, 'Optionsgast')
      const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
      const id = savedId(await save(staffA, bookingInput(tenantA, apt, g, '2027-12-01', '2027-12-03', { kind: 'option', option_until: tomorrow })))
      const before = await row(id)
      expect(before.kind).toBe('option')
      const confirmed = await staffA.rpc('confirm_option', { p_booking_id: id })
      expect((confirmed.data as unknown as Saved).status).toBe('saved')
      const after = await row(id)
      expect(after.kind).toBe('booking')
      expect(after.option_until).toBeNull()
      expect(after.number).toBe(before.number)
    })

    it('Sperren: alle legen an, nur Inhaber löschen; Wohnung mit Einträgen lässt sich nicht löschen', async () => {
      const apt = await apartment(tenantA, 'Sperre')
      const { data, error } = await staffA.rpc('save_block', {
        p_input: { tenant_id: tenantA, apartment_id: apt, arrival: '2027-04-01', departure: '2027-04-05', block_reason: 'renovation', note: null } as Json,
      })
      expect(error).toBeNull()
      const id = (data as unknown as { id: string }).id
      expect((await row(id)).number).toBeNull()
      const other = await staffA.rpc('save_block', {
        p_input: { tenant_id: tenantA, apartment_id: apt, arrival: '2027-04-10', departure: '2027-04-11', block_reason: 'other', note: null } as Json,
      })
      expect(other.error?.code).toBe('23514')

      expect((await ownerA.from('apartments').delete().eq('id', apt)).error?.code).toBe('23503')
      expect((await staffA.from('bookings').delete().eq('id', id).select('id')).data ?? []).toHaveLength(0)
      expect((await ownerA.from('bookings').delete().eq('id', id).select('id')).data).toHaveLength(1)
    })

    it('Mitreisende: höchstens Personen minus Hauptgast; Stand schützt vor Überschreiben', async () => {
      const apt = await apartment(tenantA, 'Mitreise')
      const g = await guest(tenantA, 'Mitreisegast')
      const id = savedId(await save(ownerA, bookingInput(tenantA, apt, g, '2027-02-01', '2027-02-03', { adults: 2, child_ages: [6] })))
      const b = await row(id)
      const three = [1, 2, 3].map((n) => ({ first_name: `P${n}`, last_name: 'Mitreise', birth_date: null }))
      expect((await staffA.rpc('save_companions', { p_booking_id: id, p_updated_at: b.updated_at, p_companions: three as Json })).error?.code).toBe('P0808')
      expect((await staffA.rpc('save_companions', { p_booking_id: id, p_updated_at: b.updated_at, p_companions: three.slice(0, 2) as Json })).error).toBeNull()
      // alter Stand: Änderung wird abgelehnt
      expect((await staffA.rpc('save_companions', { p_booking_id: id, p_updated_at: b.updated_at, p_companions: [] })).error?.code).toBe('P0803')
      // Personenzahl nicht unter Hauptgast + Mitreisende
      const fresh = await row(id)
      const lower = await save(ownerA, { ...bookingInput(tenantA, apt, g, '2027-02-01', '2027-02-03', { adults: 1, child_ages: [] }), id, updated_at: fresh.updated_at })
      expect(lower.error?.code).toBe('P0808')
    })
  })

  describe('Regeln auch bei direktem Aufruf (QA BUG-2, BUG-4)', () => {
    it('Anreise und Ablaufdatum höchstens 3 Jahre voraus, keine leeren Kinderalter, kein Geburtsdatum in der Zukunft', async () => {
      const apt = await apartment(tenantA, 'Regeln')
      const g = await guest(tenantA, 'Regelgast')
      const far = new Date(Date.now() + 4 * 365 * 86_400_000).toISOString().slice(0, 10)
      const farEnd = new Date(Date.now() + (4 * 365 + 2) * 86_400_000).toISOString().slice(0, 10)
      expect((await save(ownerA, bookingInput(tenantA, apt, g, far, farEnd))).error?.code).toBe('P0807')
      const block = await staffA.rpc('save_block', {
        p_input: { tenant_id: tenantA, apartment_id: apt, arrival: far, departure: farEnd, block_reason: 'renovation', note: null } as Json,
      })
      expect(block.error?.code).toBe('P0807')
      expect((await save(staffA, bookingInput(tenantA, apt, g, '2027-05-01', '2027-05-03', { kind: 'option', option_until: far }))).error?.code).toBe('P0807')
      expect((await save(ownerA, bookingInput(tenantA, apt, g, '2027-05-01', '2027-05-03', { child_ages: [4, null] }))).error?.code).toBe('23514')

      const id = savedId(await save(ownerA, bookingInput(tenantA, apt, g, '2027-05-01', '2027-05-03', { adults: 2 })))
      const b = await row(id)
      const future = [{ first_name: 'Zukunft', last_name: 'Kind', birth_date: far }]
      expect((await staffA.rpc('save_companions', { p_booking_id: id, p_updated_at: b.updated_at, p_companions: future as Json })).error?.code).toBe('P0807')
    })

    it('Check-in-/Check-out-Zeit beim Ändern optional; beim Anlegen ohne Angabe die Zeiten der Wohnung', async () => {
      const apt = await apartment(tenantA, 'Zeiten')
      const g = await guest(tenantA, 'Zeitgast')
      const id = savedId(await save(staffA, bookingInput(tenantA, apt, g, '2027-06-01', '2027-06-03', { check_in: null, check_out: null })))
      const created = await row(id)
      expect([created.check_in, created.check_out]).toEqual(['15:00:00', '10:00:00'])
      savedId(await save(staffA, { ...bookingInput(tenantA, apt, g, '2027-06-01', '2027-06-03', { check_in: null, check_out: null }), id, updated_at: created.updated_at }))
      const changed = await row(id)
      expect([changed.check_in, changed.check_out]).toEqual([null, null])
    })
  })

  describe('Personenpreise und Erwachsenen-Grenze (PROJ-27)', () => {
    // Beispiel der Spec: Erwachsene € 50, bis 2 Jahre € 0, bis 11 Jahre € 20; Reinigung € 60
    const perPerson = {
      max_guests: 6,
      max_adults: 2,
      price_mode: 'person',
      adult_price_cents: 5000,
      child_prices: [
        { to_age: 2, price_cents: 0 },
        { to_age: 11, price_cents: 2000 },
      ] as Json,
      cleaning_fee_cents: 6000,
    }

    it('bestehende und neue Wohnungen haben die Preisart „Wohnung“ und keine Erwachsenen-Grenze', async () => {
      const apt = await apartment(tenantA, 'Vorgabe')
      const { data } = await service.from('apartments').select('price_mode, max_adults, child_prices').eq('id', apt).single()
      expect(data).toEqual({ price_mode: 'apartment', max_adults: null, child_prices: [] })
    })

    it('Mitarbeiter-Buchung erhält den Vorschlag nach Personenpreisen, Reinigung genau einmal', async () => {
      const apt = await apartment(tenantA, 'Personen', perPerson)
      const g = await guest(tenantA, 'Personengast')
      // 2 Erwachsene + Kinder 1, 8, 14 Jahre: 3 × (100 + 0 + 20 + 50) = € 510
      const id = savedId(await save(staffA, bookingInput(tenantA, apt, g, '2027-07-01', '2027-07-04', { adults: 2, child_ages: [1, 8, 14] })))
      const { data: amounts } = await service.from('booking_amounts').select('nights_cents').eq('id', id).single()
      expect(amounts?.nights_cents).toBe(51000)
      const { data: charges } = await service.from('booking_charges').select('label, amount_cents').eq('booking_id', id)
      expect(charges).toEqual([{ label: 'Reinigung', amount_cents: 6000 }])
      expect((await row(id)).price_review).toBe(false)
    })

    it('QA BUG-2: Vorschlag über dem Höchstbetrag → Mitarbeiter-Buchung mit € 0 und „Preis prüfen“ statt Fehler', async () => {
      // 50 Erwachsene × € 10.000 × 300 Nächte = € 150 Mio. (über € 1 Mio. und über dem Ganzzahlbereich)
      const apt = await apartment(tenantA, 'Teuer', { ...perPerson, max_guests: 50, max_adults: null, adult_price_cents: 1_000_000 })
      const g = await guest(tenantA, 'Teuergast')
      const id = savedId(await save(staffA, bookingInput(tenantA, apt, g, '2027-08-01', '2028-05-27', { adults: 50, child_ages: [] })))
      const { data: amounts } = await service.from('booking_amounts').select('nights_cents').eq('id', id).single()
      expect(amounts?.nights_cents).toBe(0)
      expect((await row(id)).price_review).toBe(true)
    })

    it('Inhaber speichert einen abweichenden vereinbarten Preis mit eigenen Gebühren', async () => {
      const apt = await apartment(tenantA, 'Vereinbart', perPerson)
      const g = await guest(tenantA, 'Vereinbartgast')
      const id = savedId(
        await save(
          ownerA,
          bookingInput(tenantA, apt, g, '2027-07-10', '2027-07-13', {
            adults: 2,
            child_ages: [1, 8, 14],
            amounts: { nights_cents: 45000, charges: [{ label: 'Reinigung', amount_cents: 7000 }, { label: 'Haustier', amount_cents: 1500 }] },
          })
        )
      )
      const { data: amounts } = await service.from('booking_amounts').select('nights_cents').eq('id', id).single()
      expect(amounts?.nights_cents).toBe(45000)
      const { data: charges } = await service.from('booking_charges').select('label, amount_cents').eq('booking_id', id).order('position')
      expect(charges).toEqual([
        { label: 'Reinigung', amount_cents: 7000 },
        { label: 'Haustier', amount_cents: 1500 },
      ])
    })

    it('Erwachsenen-Grenze: 3 Erwachsene warnen (Mitarbeiter blockiert, Inhaber übersteuert); 1 + 3 Kinder nicht', async () => {
      const apt = await apartment(tenantA, 'Grenze', { ...perPerson, max_guests: 4 })
      const g = await guest(tenantA, 'Grenzgast')
      const tooMany = bookingInput(tenantA, apt, g, '2027-08-01', '2027-08-03', { adults: 3 })
      const blocked = await save(staffA, tooMany)
      expect(blocked.result?.status).toBe('warnings')
      expect((blocked.result as { warnings: { over_capacity: unknown } }).warnings.over_capacity).toEqual({
        persons: 3,
        max_guests: 4,
        adults: 3,
        max_adults: 2,
      })
      expect((await save(staffA, tooMany, true)).result?.status).toBe('warnings')
      savedId(await save(ownerA, tooMany, true))
      savedId(await save(staffA, bookingInput(tenantA, apt, g, '2027-08-10', '2027-08-12', { adults: 1, child_ages: [3, 5, 8] })))

      const preview = await staffA.rpc('booking_warnings', {
        p_tenant_id: tenantA,
        p_apartment_id: apt,
        p_arrival: '2027-09-01',
        p_departure: '2027-09-03',
        p_persons: 3,
        p_adults: 3,
      })
      expect((preview.data as { over_capacity: { max_adults: number } }).over_capacity.max_adults).toBe(2)
    })

    it('Mitarbeiter ändert Personen bei Personenpreisen: Preis bleibt, „Preis prüfen“ wird gesetzt', async () => {
      const apt = await apartment(tenantA, 'Prüfen', perPerson)
      const flatApt = await apartment(tenantA, 'Pauschal', { price_cents: 12000 })
      const g = await guest(tenantA, 'Prüfgast')
      const id = savedId(await save(ownerA, bookingInput(tenantA, apt, g, '2027-10-01', '2027-10-03', { adults: 2 })))
      const before = await row(id)
      savedId(await save(staffA, { ...bookingInput(tenantA, apt, g, '2027-10-01', '2027-10-03', { adults: 2, child_ages: [8] }), id, updated_at: before.updated_at }))
      expect((await row(id)).price_review).toBe(true)
      const { data: amounts } = await service.from('booking_amounts').select('nights_cents').eq('id', id).single()
      expect(amounts?.nights_cents).toBe(30000)

      // Wohnungspreis: Personenänderung ändert den Preis nicht, daher kein „Preis prüfen“
      const flatId = savedId(await save(ownerA, bookingInput(tenantA, flatApt, g, '2027-10-10', '2027-10-12', { adults: 2 })))
      const flatBefore = await row(flatId)
      savedId(await save(staffA, { ...bookingInput(tenantA, flatApt, g, '2027-10-10', '2027-10-12', { adults: 1 }), id: flatId, updated_at: flatBefore.updated_at }))
      expect((await row(flatId)).price_review).toBe(false)
    })

    it('Datenbank lehnt ungültige Preis-Konfigurationen ab', async () => {
      const apt = await apartment(tenantA, 'Ungültig')
      const update = (values: Record<string, unknown>) => ownerA.from('apartments').update(values as never).eq('id', apt)
      expect((await update({ price_mode: 'person' })).error?.code).toBe('23514')
      expect((await update({ max_adults: 9 })).error?.code).toBe('23514')
      expect((await update({ child_prices: [{ to_age: 11, price_cents: 0 }, { to_age: 2, price_cents: 0 }] })).error?.code).toBe('23514')
      expect((await update({ child_prices: [{ to_age: 18, price_cents: 0 }] })).error?.code).toBe('23514')
      expect((await update({ child_prices: [1, 2, 3, 4] })).error?.code).toBe('23514')
      expect((await update({ price_mode: 'person', adult_price_cents: 5000, child_prices: [{ to_age: 2, price_cents: 0 }] })).error).toBeNull()
      // Mitarbeiter dürfen die Preis-Konfiguration nicht ändern (Regel aus PROJ-6)
      const staffUpdate = await staffA.from('apartments').update({ adult_price_cents: 1 } as never).eq('id', apt).select('id')
      expect(staffUpdate.data ?? []).toHaveLength(0)
    })
  })

  describe('Belegungskalender (PROJ-9)', () => {
    // Gleiche Spalten wie src/lib/calendar-data.ts: bewusst ohne Beträge
    const CALENDAR_COLUMNS =
      'id, kind, channel, apartment_id, arrival, departure, adults, child_ages, block_reason, option_until, cancelled_at, guest:guests(last_name, first_name)'

    it('Mitarbeiter lesen die Einträge des eigenen Kunden im Bereich; fremde Kunden sehen nichts', async () => {
      const apt = await apartment(tenantA, 'Kalender')
      const g = await guest(tenantA, 'Kalender')
      const id = savedId(await save(ownerA, bookingInput(tenantA, apt, g, '2028-05-10', '2028-05-14')))
      const range = (client: Client, tenantId: string) =>
        client.from('bookings').select(CALENDAR_COLUMNS).eq('tenant_id', tenantId).is('cancelled_at', null).lt('arrival', '2028-05-15').gte('departure', '2028-05-14')
      const staff = await range(staffA, tenantA)
      expect(staff.error).toBeNull()
      expect(staff.data?.map((b) => b.id)).toContain(id)
      expect(staff.data?.find((b) => b.id === id)?.guest?.last_name).toBe('Kalender')
      // Fremder Inhaber: weder über die Kundenkennung noch über die Buchung
      expect((await range(ownerB, tenantA)).data ?? []).toHaveLength(0)
      expect((await ownerB.from('bookings').select('id').eq('id', id)).data ?? []).toHaveLength(0)
      expect((await ownerB.from('apartments').select('id').eq('id', apt)).data ?? []).toHaveLength(0)
    })

    it('Beträge gelangen nicht an Mitarbeiter, auch nicht über eingebettete Abfragen', async () => {
      const apt = await apartment(tenantA, 'Kalender Preise')
      const g = await guest(tenantA, 'Preis')
      const id = savedId(await save(ownerA, bookingInput(tenantA, apt, g, '2028-06-10', '2028-06-12')))
      const embedded = await staffA.from('bookings').select('id, amounts:booking_amounts(nights_cents), charges:booking_charges(amount_cents)').eq('id', id).single()
      expect(embedded.data?.amounts ?? []).toHaveLength(0)
      expect(embedded.data?.charges ?? []).toHaveLength(0)
      expect((await staffA.from('booking_amounts').select('nights_cents').eq('id', id)).data ?? []).toHaveLength(0)
      const owner = await ownerA.from('booking_amounts').select('nights_cents').eq('id', id).single()
      expect(owner.data?.nights_cents).toBe(30000)
    })
  })

  describe('Gäste (PROJ-7) mit Buchungen', () => {
    it('Zusammenführen hängt Buchungen um; Löschen anonymisiert und entfernt Mitreisende; Gästeliste zählt Aufenthalte', async () => {
      const apt = await apartment(tenantA, 'Gäste')
      const keep = await guest(tenantA, `Keep ${runId}`)
      const remove = await guest(tenantA, `Remove ${runId}`)
      const id = savedId(await save(ownerA, bookingInput(tenantA, apt, remove, '2026-01-10', '2026-01-12', { adults: 2 })))
      await ownerA.rpc('save_companions', {
        p_booking_id: id,
        p_updated_at: (await row(id)).updated_at,
        p_companions: [{ first_name: 'Max', last_name: 'Begleiter', birth_date: '1990-01-01' }] as Json,
      })
      const choice = { name: 'a', country: 'a', email: 'a', phone: 'a', language: 'a', birthDate: 'a', address: 'a', marketing: 'a', company: 'a', note: 'a' }
      expect((await ownerA.rpc('merge_guests', { p_keep: keep, p_remove: remove, p_choice: choice })).error).toBeNull()
      expect((await row(id)).guest_id).toBe(keep)

      const list = await ownerA.rpc('guest_list', { p_tenant_id: tenantA, p_query: `keep ${runId}` })
      expect(list.data?.[0]).toMatchObject({ stay_count: 1, last_stay: '2026-01-10' })

      expect((await ownerA.from('guests').delete().eq('id', keep).select('id')).data ?? []).toHaveLength(0)
      const deleted = await ownerA.rpc('delete_guest', { p_guest_id: keep })
      expect(deleted.data).toBe('anonymized')
      expect((await service.from('booking_companions').select('id').eq('booking_id', id)).data).toHaveLength(0)
      const log = await service.from('audit_log').select('old_data, new_data').eq('table_name', 'booking_companions').eq('tenant_id', tenantA)
      expect((log.data ?? []).filter((l) => JSON.stringify(l).includes('Begleiter'))).toHaveLength(0)
      const b = await row(id)
      expect(b.guest_id).toBe(keep)
      expect(b.adults).toBe(2)
    })
  })
})
