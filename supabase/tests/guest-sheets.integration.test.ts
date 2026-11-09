// @vitest-environment node
//
// PROJ-26: Gästeblatt gegen „apppa-dev“ (übersprungen ohne .env.local). Prüft die Datenbank: Datenschutz-Texte (nur Inhaber,
// Stand, Platzhalter), Feld-Speichern für Inhaber und Mitarbeiter (nur Blatt-Felder, Stand, Protokoll „Gästeblatt“), Hochladen,
// Fertigstellen nur für den Server mit allen Prüfungen, Unveränderlichkeit, Lesesichten (geändert, fehlt), Abreise-Nachtrag,
// Löschen/Anonymisieren/Zusammenführen von Gästen, Speicherregeln, Kontakt in den Stammdaten, Mandantentrennung.
import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { Json } from '../../src/types/database'
import { type Client, hasSupabaseEnv, serviceClient, type TestUser } from './helpers'
import { sharedClient } from './shared-sessions'

const BUCKET = 'guest-sheets'
const SHA = 'd'.repeat(64)
const doc = (text: string) => ({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] })

describe.skipIf(!hasSupabaseEnv)('PROJ-26 Gästeblatt', () => {
  let service: Client
  let owner: Client, staff: Client, ownerB: Client
  let ownerUser: TestUser, staffUser: TestUser
  const tenants: string[] = []
  let tenant: string, tenantB: string, apartment: string
  const runId = randomUUID().slice(0, 8)
  let day = 0

  // Vollständiger Gast (Italien → Reisedokument nötig)
  const newGuest = async (over: Record<string, unknown> = {}) => {
    const { data, error } = await service
      .from('guests')
      .insert({
        tenant_id: tenant,
        last_name: `Rossi ${runId}`,
        first_name: 'Giulia',
        country: 'IT',
        birth_date: '1985-04-03',
        street: 'Via Roma 1',
        postal_code: '39100',
        city: 'Bolzano',
        address_country: 'IT',
        document_type: 'passport',
        document_number: 'YA1234567',
        document_issued_on: '2020-02-01',
        document_authority: 'Questura',
        document_country: 'IT',
        ...over,
      })
      .select('id')
      .single()
    if (error) throw error
    return data.id
  }
  const newBooking = async (guestId: string | null, over: Record<string, unknown> = {}) => {
    const start = new Date(Date.UTC(2028, 2, 1) + day * 86_400_000)
    day += 4
    const iso = (d: Date) => d.toISOString().slice(0, 10)
    const { data, error } = await owner.rpc('save_booking', {
      p_input: {
        tenant_id: tenant,
        kind: 'booking',
        apartment_id: apartment,
        arrival: iso(start),
        planned_departure: iso(new Date(start.getTime() + 3 * 86_400_000)),
        departure: iso(new Date(start.getTime() + 3 * 86_400_000)),
        guest_id: guestId,
        adults: 1,
        child_ages: [],
        source: 'none',
        amounts: { nights_cents: 30000, nights_vat_rate: '10.00', charges: [] },
        ...over,
      } as Json,
      p_confirm: true,
    })
    if (error) throw error
    return (data as { id: string }).id
  }
  const stamps = async (bookingId: string) => {
    const { data: b } = await service.from('bookings').select('updated_at, guest_id').eq('id', bookingId).single()
    const { data: g } = b!.guest_id ? await service.from('guests').select('updated_at').eq('id', b!.guest_id).single() : { data: null }
    return { booking: b!.updated_at, guest: g?.updated_at ?? null, guestId: b!.guest_id }
  }
  const upload = async (ext: 'pdf' | 'png' = 'pdf', tenantId = tenant) => {
    const path = `${tenantId}/${randomUUID()}.${ext}`
    const type = ext === 'pdf' ? 'application/pdf' : 'image/png'
    const { error } = await service.storage.from(BUCKET).upload(path, new Blob(['x'], { type }), { contentType: type })
    if (error) throw error
    return path
  }
  // Fertigstellen wie /api/gaesteblatt/fertig (Service-Rolle, im Namen der Person)
  const finish = async (bookingId: string, over: Record<string, unknown> = {}) => {
    const s = await stamps(bookingId)
    const { data: current } = await service.from('guest_sheets').select('id').eq('booking_id', bookingId).is('replaced_at', null).maybeSingle()
    return service.rpc('finish_guest_sheet', {
      p_input: {
        tenant_id: tenant,
        booking_id: bookingId,
        guest_id: s.guestId,
        actor_id: staffUser.id,
        booking_updated_at: s.booking,
        guest_updated_at: s.guest,
        previous_sheet_id: current?.id ?? null,
        sheet_number: 'A-1',
        marketing_consent: false,
        snapshot: { version: 1, stay: {}, companions: [] },
        signed_at_1: new Date().toISOString(),
        signed_at_2: new Date().toISOString(),
        signature_1_path: await upload('png'),
        signature_2_path: await upload('png'),
        pdf_path: await upload('pdf'),
        pdf_sha256: SHA,
        ...over,
      } as Json,
    })
  }
  const field = (client: Client, bookingId: string, target: string, values: Record<string, unknown>, expected: string | null) =>
    client.rpc('save_guest_sheet_field', { p_booking_id: bookingId, p_target: target, p_values: values as Json, p_expected_updated_at: expected! })

  beforeAll(async () => {
    service = serviceClient()
    const o = await sharedClient('ownerA')
    const s = await sharedClient('staffA')
    const ob = await sharedClient('ownerB')
    owner = o.client
    staff = s.client
    ownerB = ob.client
    ownerUser = o.user
    staffUser = s.user
    for (const name of ['A', 'B']) {
      const { data: t, error } = await service.from('tenants').insert({ name: `PROJ-26 Test ${name} ${runId}` }).select('id').single()
      if (error) throw error
      tenants.push(t.id)
    }
    ;[tenant, tenantB] = tenants
    await service.from('memberships').insert([
      { tenant_id: tenant, user_id: ownerUser.id, role: 'owner' },
      { tenant_id: tenant, user_id: staffUser.id, role: 'staff' },
      { tenant_id: tenantB, user_id: ob.user.id, role: 'owner' },
    ])
    // Hochladen nur mit „Gästeblätter nacherfassen“ (Erweiterung 2026-11-09)
    await service.from('guest_sheet_options').upsert({ tenant_id: tenant, backfill_enabled: true }, { onConflict: 'tenant_id' })
    const { data: property } = await service
      .from('properties')
      .insert({ tenant_id: tenant, name: `Haus ${runId}`, street: 'Seeweg 12', postal_code: '5340', city: 'St. Gilgen', municipality_code: '50330' })
      .select('id')
      .single()
    const { data: ap } = await service.from('apartments').insert({ tenant_id: tenant, property_id: property!.id, name: `Top ${runId}`, max_guests: 4, price_cents: 10000 }).select('id').single()
    apartment = ap!.id
  }, 60_000)

  afterAll(async () => {
    if (!service) return
    for (const id of tenants) {
      const { data } = await service.storage.from(BUCKET).list(id, { limit: 1000 })
      if (data?.length) await service.storage.from(BUCKET).remove(data.map((f) => `${id}/${f.name}`))
      const { error } = await service.from('tenants').delete().eq('id', id)
      expect(error).toBeNull()
    }
  }, 60_000)

  describe('Einstellungen und Stammdaten', () => {
    it('Inhaber speichert die Texte mit Stand; Mitarbeiter liest, darf aber nicht speichern', async () => {
      const { data: at, error } = await owner.rpc('save_guest_sheet_texts', {
        p_tenant_id: tenant,
        p_expected_updated_at: null as unknown as string,
        p_privacy: doc('Verantwortlich ist {Kundenname}, {E-Mail}.') as Json,
        p_marketing: null as unknown as Json,
      })
      expect(error).toBeNull()
      const stale = await owner.rpc('save_guest_sheet_texts', {
        p_tenant_id: tenant,
        p_expected_updated_at: null as unknown as string,
        p_privacy: null as unknown as Json,
        p_marketing: null as unknown as Json,
      })
      expect(stale.error?.code).toBe('P0970')
      const denied = await staff.rpc('save_guest_sheet_texts', {
        p_tenant_id: tenant,
        p_expected_updated_at: at as string,
        p_privacy: null as unknown as Json,
        p_marketing: null as unknown as Json,
      })
      expect(denied.error?.code).toBe('42501')
      const { data: read } = await staff.from('guest_sheet_settings').select('privacy_text, marketing_text').eq('tenant_id', tenant).single()
      expect(read).toEqual({ privacy_text: doc('Verantwortlich ist {Kundenname}, {E-Mail}.'), marketing_text: null })
      expect((await ownerB.from('guest_sheet_settings').select('id').eq('tenant_id', tenant)).data).toEqual([])
    })

    it('lehnt unbekannte Platzhalter und leere Texte ab', async () => {
      const { data: row } = await service.from('guest_sheet_settings').select('updated_at').eq('tenant_id', tenant).single()
      for (const bad of [doc('Hallo {Gast}'), doc('   ')]) {
        const r = await owner.rpc('save_guest_sheet_texts', {
          p_tenant_id: tenant,
          p_expected_updated_at: row!.updated_at,
          p_privacy: bad as Json,
          p_marketing: null as unknown as Json,
        })
        expect(r.error?.code).toBe('22023')
      }
    })

    it('Stammdaten speichern E-Mail (Kleinbuchstaben) und Telefon', async () => {
      const { data: t } = await service.from('tenants').select('updated_at, name').eq('id', tenant).single()
      const { error } = await owner.rpc('update_tenant_master_data', {
        p_tenant_id: tenant,
        p_expected_updated_at: t!.updated_at,
        p_data: { name: t!.name, email: ' Office@Pichler.AT ', phone: '+43 512 123456' } as Json,
      })
      expect(error).toBeNull()
      const { data } = await service.from('tenants').select('email, phone').eq('id', tenant).single()
      expect(data).toEqual({ email: 'office@pichler.at', phone: '+43 512 123456' })
    })
  })

  describe('Felder auf Seite 1', () => {
    it('Mitarbeiter ergänzt Blatt-Felder am Gast; Protokoll mit Quelle „Gästeblatt“', async () => {
      const guest = await newGuest({ birth_date: null })
      const booking = await newBooking(guest)
      const s = await stamps(booking)
      const { data: at, error } = await field(staff, booking, 'guest', { birth_date: '1985-04-03', city: ' Meran ' }, s.guest)
      expect(error).toBeNull()
      const { data: g } = await service.from('guests').select('birth_date, city, updated_at').eq('id', guest).single()
      expect(g).toMatchObject({ birth_date: '1985-04-03', city: 'Meran', updated_at: at })
      const { data: log } = await service.from('audit_log').select('actor_label, actor_id').eq('table_name', 'guests').eq('record_id', guest).order('id', { ascending: false }).limit(1).single()
      expect(log).toEqual({ actor_label: 'Gästeblatt', actor_id: staffUser.id })
    })

    it('ohne Staatsangehörigkeit kein Blatt; nach dem Ergänzen über das Blatt möglich (refine PROJ-7 2026-11-09)', async () => {
      const guest = await newGuest({ country: null, document_type: null, document_number: null, document_issued_on: null, document_authority: null, document_country: null })
      const booking = await newBooking(guest)
      expect((await finish(booking)).error?.code).toBe('P0974')
      const s = await stamps(booking)
      expect((await field(staff, booking, 'guest', { country: 'AT' }, s.guest)).error).toBeNull()
      expect((await finish(booking)).error).toBeNull()
    })

    it('nur Blatt-Felder, mit Stand; ungültige Werte und unvollständiges Dokument werden abgelehnt', async () => {
      const guest = await newGuest({ document_type: null, document_number: null, document_issued_on: null, document_authority: null, document_country: null })
      const booking = await newBooking(guest)
      const s = await stamps(booking)
      expect((await field(staff, booking, 'guest', { city: 'Wien' }, '2000-01-01T00:00:00Z')).error?.code).toBe('P0975')
      expect((await field(staff, booking, 'guest', { document_issued_on: '2020-01-01' }, s.guest)).error?.code).toBe('22023')
      expect((await field(staff, booking, 'guest', { country: 'X1' }, s.guest)).error?.code).toBe('22023')
      const ok = await field(staff, booking, 'guest', { document_type: 'passport', document_number: 'P1', document_issued_on: '2020-01-01' }, s.guest)
      expect(ok.error).toBeNull()
    })

    it('E-Mail nur, solange der Gast keine hat; Ausweisbilder über das Blatt (Nachbesserung)', async () => {
      const withMail = await newGuest({ email: `alt-${runId}@example.at` })
      const b1 = await newBooking(withMail)
      expect((await field(staff, b1, 'guest', { email: 'neu@example.at' }, (await stamps(b1)).guest)).error?.code).toBe('22023')

      const guest = await newGuest()
      const booking = await newBooking(guest)
      expect((await field(staff, booking, 'guest', { email: ' Neu@Example.AT ' }, (await stamps(booking)).guest)).error).toBeNull()
      const path = `${tenant}/${randomUUID()}.jpg`
      const { error: up } = await service.storage.from('guest-documents').upload(path, new Blob(['x'], { type: 'image/jpeg' }), { contentType: 'image/jpeg' })
      expect(up).toBeNull()
      expect((await field(staff, booking, 'guest', { document_front_path: path }, (await stamps(booking)).guest)).error).toBeNull()
      const { data } = await service.from('guests').select('email, document_front_path').eq('id', guest).single()
      expect(data).toEqual({ email: 'neu@example.at', document_front_path: path })
      await service.storage.from('guest-documents').remove([path])
    })

    it('Mitreisende an der Buchung, Höchstzahl wie im Buchungsformular; die Lfd.-Nr. ist auf dem Blatt nicht änderbar', async () => {
      const booking = await newBooking(await newGuest(), { adults: 2, guest_sheet_number: '2026/7' })
      let s = await stamps(booking)
      // Erweiterung 2026-11-09: kein Ziel „booking“ mehr
      expect((await field(staff, booking, 'booking', { guest_sheet_number: '9' }, s.booking)).error?.code).toBe('22023')
      const one = [{ last_name: 'Rossi', first_name: 'Luca', birth_date: '2016-07-09', tourist_tax_exempt: false }]
      expect((await field(staff, booking, 'companions', { companions: one }, s.booking)).error).toBeNull()
      s = await stamps(booking)
      expect((await field(staff, booking, 'companions', { companions: [...one, ...one] }, s.booking)).error?.code).toBe('P0979')
      const { data } = await service.from('bookings').select('guest_sheet_number').eq('id', booking).single()
      expect(data!.guest_sheet_number).toBe('2026/7')
    })

    it('kein Blatt bei Option bzw. „Wohnsitz angemeldet“; fremder Kunde sieht die Buchung nicht', async () => {
      const guest = await newGuest()
      const option = await newBooking(guest, { kind: 'option', option_until: "2028-01-15" })
      const residence = await newBooking(guest, { residence_registered: true })
      const s1 = await stamps(option)
      expect((await field(staff, option, 'companions', { companions: [] }, s1.booking)).error?.code).toBe('P0976')
      const s2 = await stamps(residence)
      expect((await field(staff, residence, 'companions', { companions: [] }, s2.booking)).error?.code).toBe('P0976')
      const booking = await newBooking(guest)
      const s3 = await stamps(booking)
      expect((await field(ownerB, booking, 'companions', { companions: [] }, s3.booking)).error?.code).toBe('42501')
    })
  })

  describe('Hochladen und Fertigstellen', () => {
    it('Hochladen: Datei muss im Ordner des Kunden liegen; ersetzt das vorige Blatt; Einwilligung am Gast', async () => {
      const guest = await newGuest()
      const booking = await newBooking(guest, { guest_sheet_number: '0017' })
      // Erweiterung 2026-11-09: nur mit „Gästeblätter nacherfassen“
      await service.from('guest_sheet_options').upsert({ tenant_id: tenant, backfill_enabled: false }, { onConflict: 'tenant_id' })
      const off = await staff.rpc('register_guest_sheet_upload', { p_input: { booking_id: booking, pdf_path: await upload(), previous_sheet_id: null } as Json })
      expect(off.error?.code).toBe('P0987')
      await service.from('guest_sheet_options').upsert({ tenant_id: tenant, backfill_enabled: true }, { onConflict: 'tenant_id' })
      const missing = await staff.rpc('register_guest_sheet_upload', {
        p_input: { booking_id: booking, pdf_path: `${tenant}/${randomUUID()}.pdf`, previous_sheet_id: null } as Json,
      })
      expect(missing.error?.code).toBe('P0980')
      const { data: first, error } = await staff.rpc('register_guest_sheet_upload', {
        p_input: { booking_id: booking, pdf_path: await upload(), sheet_number: '99', signed_on: '2025-08-12', marketing_consent: true, previous_sheet_id: null } as Json,
      })
      expect(error).toBeNull()
      const conflict = await staff.rpc('register_guest_sheet_upload', { p_input: { booking_id: booking, pdf_path: await upload(), previous_sheet_id: null } as Json })
      expect(conflict.error?.code).toBe('P0973')
      const { data: second } = await staff.rpc('register_guest_sheet_upload', { p_input: { booking_id: booking, pdf_path: await upload(), previous_sheet_id: first } as Json })
      const { data: rows } = await staff.from('guest_sheets').select('id, replaced_at, replaced_by').eq('booking_id', booking).order('created_at')
      expect(rows!.map((r) => [r.id, r.replaced_by, r.replaced_at !== null])).toEqual([
        [first, second, true],
        [second, null, false],
      ])
      const { data: g } = await service.from('guests').select('marketing_consent_at, marketing_consent_sheet_id').eq('id', guest).single()
      expect(g!.marketing_consent_sheet_id).toBe(first)
      expect(new Date(g!.marketing_consent_at!).toISOString()).toBe('2025-08-11T22:00:00.000Z')
      // Lfd.-Nr. aus der Buchung, eine mitgeschickte Nummer zählt nicht
      const { data: sheet } = await service.from('guest_sheets').select('sheet_number').eq('id', first as string).single()
      expect(sheet!.sheet_number).toBe('0017')
    })

    it('Fertigstellen nur für den Server; prüft Pflichtangaben, Stand und aktuelles Blatt', async () => {
      const incompleteGuest = await newGuest({ birth_date: null })
      const incomplete = await newBooking(incompleteGuest)
      expect((await finish(incomplete)).error?.code).toBe('P0974')

      const guest = await newGuest()
      const booking = await newBooking(guest)
      const direct = await staff.rpc('finish_guest_sheet', { p_input: { tenant_id: tenant } as Json })
      expect(direct.error).not.toBeNull()
      expect((await finish(booking, { booking_updated_at: '2000-01-01T00:00:00Z' })).error?.code).toBe('P0975')
      const { data: id, error } = await finish(booking, { marketing_consent: true })
      expect(error).toBeNull()
      expect((await finish(booking, { previous_sheet_id: null })).error?.code).toBe('P0973')
      const { data: row } = await staff.from('guest_sheets').select('kind, created_by, marketing_consent, sheet_number').eq('id', id as string).single()
      expect(row).toEqual({ kind: 'signed', created_by: staffUser.id, marketing_consent: true, sheet_number: 'A-1' })
      const { data: g } = await service.from('guests').select('marketing_consent_sheet_id').eq('id', guest).single()
      expect(g!.marketing_consent_sheet_id).toBe(id)
    })

    it('Gästeblätter sind unveränderlich und nicht löschbar', async () => {
      const booking = await newBooking(await newGuest())
      const { data: id } = await finish(booking)
      expect((await service.from('guest_sheets').update({ sheet_number: 'X' }).eq('id', id as string)).error?.code).toBe('P0981')
      expect((await service.from('guest_sheets').delete().eq('id', id as string)).error?.code).toBe('P0981')
      expect((await owner.from('guest_sheets').delete().eq('id', id as string)).error).not.toBeNull()
    })
  })

  describe('Lesesichten und Nachträge', () => {
    it('„geändert“ nach verschobener Ankunft; Abreise-Nachtrag mit Person; „fehlt“ ohne Wohnsitz-Buchungen', async () => {
      const guest = await newGuest()
      const booking = await newBooking(guest)
      const { data: b } = await service.from('bookings').select('arrival, planned_departure').eq('id', booking).single()
      const { data: id } = await finish(booking, {
        snapshot: { version: 1, stay: { arrival: b!.arrival, plannedDeparture: b!.planned_departure, persons: 1 }, companions: [] },
      })
      const list = async () => (await staff.from('guest_sheet_list').select('changed, departure_noted_at, departure_noted_by_name').eq('id', id as string).single()).data!
      expect((await list()).changed).toBe(false)
      expect((await list()).departure_noted_at).toBeNull()

      const later = new Date(new Date(`${b!.planned_departure}T12:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10)
      const { error } = await owner.from('bookings').update({ departure: later }).eq('id', booking)
      if (error) {
        // Abreise nur über save_booking änderbar: dann direkt mit der Service-Rolle (Trigger gilt gleich)
        await service.from('bookings').update({ departure: later }).eq('id', booking)
      }
      expect((await list()).departure_noted_at).not.toBeNull()

      await service.from('bookings').update({ arrival: new Date(new Date(`${b!.arrival}T12:00:00Z`).getTime() - 86_400_000).toISOString().slice(0, 10) }).eq('id', booking)
      expect((await list()).changed).toBe(true)

      const residence = await newBooking(guest, { residence_registered: true })
      // „Buchungen ohne Gästeblatt“ = ohne Gästeblattnummer (refine 2026-11-09)
      await service.from('bookings').update({ guest_sheet_number: `T-${runId}` }).eq('id', booking)
      const missing = (await staff.from('guest_sheet_missing').select('booking_id').eq('tenant_id', tenant)).data!.map((r) => r.booking_id)
      expect(missing).not.toContain(booking)
      expect(missing).not.toContain(residence)
      expect((await ownerB.from('guest_sheet_list').select('id').eq('tenant_id', tenant)).data).toEqual([])
    })
  })

  describe('Gäste löschen, anonymisieren, zusammenführen', () => {
    it('ohne Aufenthalt, aber mit Gästeblatt wird anonymisiert; Einwilligung verschwindet, Blatt bleibt', async () => {
      const guest = await newGuest()
      const booking = await newBooking(guest)
      const { data: id } = await finish(booking, { marketing_consent: true })
      // anderer Gast an der Buchung: der alte Gast hat keinen Aufenthalt mehr, nur das Blatt
      const other = await newGuest({ last_name: `Neu ${runId}` })
      await service.from('bookings').update({ guest_id: other }).eq('id', booking)
      const { data, error } = await owner.rpc('delete_guest', { p_guest_id: guest })
      expect(error).toBeNull()
      expect(data).toBe('anonymized')
      const { data: g } = await service.from('guests').select('marketing_consent_at, marketing_consent_sheet_id').eq('id', guest).single()
      expect(g).toEqual({ marketing_consent_at: null, marketing_consent_sheet_id: null })
      const { data: sheet } = await service.from('guest_sheets').select('guest_id').eq('id', id as string).single()
      expect(sheet!.guest_id).toBe(guest)
    })

    it('BUG-3: Anonymisieren entfernt die Mitreisenden, das Blatt gilt trotzdem nicht als „geändert“', async () => {
      const guest = await newGuest()
      const booking = await newBooking(guest, { adults: 2 })
      const s = await stamps(booking)
      const companion = { last_name: 'Rossi', first_name: 'Luca', birth_date: '2016-07-09', tourist_tax_exempt: false }
      expect((await field(owner, booking, 'companions', { companions: [companion] }, s.booking)).error).toBeNull()
      const { data: b } = await service.from('bookings').select('arrival, planned_departure').eq('id', booking).single()
      const { data: id } = await finish(booking, {
        snapshot: {
          version: 1,
          stay: { arrival: b!.arrival, plannedDeparture: b!.planned_departure, persons: 2 },
          companions: [{ lastName: 'Rossi', firstName: 'Luca', birthDate: '2016-07-09' }],
        },
      })
      const changed = async () => (await owner.from('guest_sheet_list').select('changed').eq('id', id as string).single()).data!.changed
      expect(await changed()).toBe(false)
      expect((await owner.rpc('delete_guest', { p_guest_id: guest })).data).toBe('anonymized')
      expect((await service.from('booking_companions').select('id').eq('booking_id', booking)).data).toEqual([])
      expect(await changed()).toBe(false)
    })

    it('Zusammenführen hängt Blätter um und behält die jüngere Einwilligung', async () => {
      const keep = await newGuest({ last_name: `Keep ${runId}` })
      const remove = await newGuest({ last_name: `Remove ${runId}` })
      const booking = await newBooking(remove)
      const { data: id } = await finish(booking, { marketing_consent: true })
      const { error } = await owner.rpc('merge_guests', { p_keep: keep, p_remove: remove, p_choice: {} as Json })
      expect(error).toBeNull()
      const { data: sheet } = await service.from('guest_sheets').select('guest_id').eq('id', id as string).single()
      expect(sheet!.guest_id).toBe(keep)
      const { data: g } = await service.from('guests').select('marketing_consent_sheet_id').eq('id', keep).single()
      expect(g!.marketing_consent_sheet_id).toBe(id)
    })
  })

  describe('Liste „Gästeblätter“ (refine 2026-11-09)', () => {
    it('Buchungen mit Nummer absteigend nach der Zahl am Ende, mit aktuellem Blatt; ohne Storno, Option, Wohnsitz', async () => {
      const prefix = `R${runId}-`
      const guest = await newGuest()
      const make = async (n: string, over: Record<string, unknown> = {}) => newBooking(guest, { guest_sheet_number: `${prefix}${n}`, ...over })
      const first = await make('0001')
      const top = await make('0054')
      const middle = await make('0053')
      const cancelled = await make('0099')
      await service.from('bookings').update({ cancelled_at: new Date().toISOString() }).eq('id', cancelled)
      const residence = await make('0098', { residence_registered: true })
      // Blatt zur mittleren Buchung (nacherfasst)
      const { data: sheetId, error } = await staff.rpc('register_guest_sheet_upload', {
        p_input: { booking_id: middle, pdf_path: await upload(), previous_sheet_id: null } as Json,
      })
      expect(error).toBeNull()

      const { data } = await staff
        .from('guest_sheet_register')
        .select('booking_id, sheet_number, sheet_id, sheet_kind, guest_id, guest_anonymized')
        .eq('tenant_id', tenant)
        .ilike('search_text', `%${prefix}%`)
        .order('sort_value', { ascending: false, nullsFirst: false })
        .order('sort_prefix', { ascending: false })
      expect(data!.map((r) => r.booking_id)).toEqual([top, middle, first])
      expect(data![1]).toMatchObject({ sheet_id: sheetId, sheet_kind: 'uploaded', guest_id: guest, guest_anonymized: false })
      expect(data![0].sheet_id).toBeNull()
      expect(data!.map((r) => r.booking_id)).not.toContain(cancelled)
      expect(data!.map((r) => r.booking_id)).not.toContain(residence)

      // ohne Nummer erscheint die Buchung unter „Buchungen ohne Gästeblatt“, mit Wohnung und Gast
      const none = await newBooking(guest)
      const { data: missing } = await staff.from('guest_sheet_missing').select('booking_id, apartment_id, guest_id').eq('tenant_id', tenant).eq('booking_id', none)
      expect(missing).toEqual([{ booking_id: none, apartment_id: apartment, guest_id: guest }])
      expect((await staff.from('guest_sheet_missing').select('booking_id').in('booking_id', [first, top, middle])).data).toEqual([])
      // fremder Kunde sieht nichts
      expect((await ownerB.from('guest_sheet_register').select('booking_id').eq('tenant_id', tenant)).data).toEqual([])
    })
  })

  describe('Speicher', () => {
    it('Mitglieder laden PDFs in den eigenen Ordner, keine Bilder und nichts in fremde Ordner; Bereinigung nur für den Server', async () => {
      const pdf = new Blob(['%PDF-1.4'], { type: 'application/pdf' })
      expect((await staff.storage.from(BUCKET).upload(`${tenant}/${randomUUID()}.pdf`, pdf, { contentType: 'application/pdf' })).error).toBeNull()
      expect((await staff.storage.from(BUCKET).upload(`${tenant}/${randomUUID()}.png`, new Blob(['x'], { type: 'image/png' }), { contentType: 'image/png' })).error).not.toBeNull()
      expect((await staff.storage.from(BUCKET).upload(`${tenantB}/${randomUUID()}.pdf`, pdf, { contentType: 'application/pdf' })).error).not.toBeNull()
      expect((await staff.rpc('unused_guest_sheet_files', { p_limit: 1 })).error).not.toBeNull()
      expect((await service.rpc('unused_guest_sheet_files', { p_limit: 1 })).error).toBeNull()
    })
  })
})
