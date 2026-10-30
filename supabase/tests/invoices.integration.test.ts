// @vitest-environment node
//
// PROJ-37: Rechnungen nacherfassen gegen „apppa-dev“ (übersprungen ohne .env.local)
import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { Json } from '../../src/types/database'
import { type Client, hasSupabaseEnv, serviceClient, type TestUser } from './helpers'
import { sharedClient } from './shared-sessions'

const BUCKET = 'invoices'
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Vienna' })

type Saved = { id: string; unused_pdf: string | null; previous_booking_id: string | null }

describe.skipIf(!hasSupabaseEnv)('PROJ-37 Rechnungen nacherfassen', () => {
  let service: Client
  const tenants: string[] = []
  let tenantA: string, tenantB: string
  let ownerA: Client, staffA: Client, ownerB: Client
  const runId = randomUUID().slice(0, 8)
  let apartmentA: string
  let guestA: string

  const newTenant = async (members: [TestUser, 'owner' | 'staff'][]) => {
    const { data, error } = await service.from('tenants').insert({ name: `PROJ-37 Test ${runId}` }).select('id').single()
    if (error) throw error
    tenants.push(data.id)
    for (const [u, role] of members) {
      const { error: e } = await service.from('memberships').insert({ tenant_id: data.id, user_id: u.id, role })
      if (e) throw e
    }
    return data.id
  }
  const newGuest = async (tenantId: string, fields: Record<string, string | null> = {}) => {
    const { data, error } = await service
      .from('guests')
      .insert({ tenant_id: tenantId, last_name: `Huber ${runId}`, first_name: 'Maria', country: 'AT', ...fields })
      .select('id')
      .single()
    if (error) throw error
    return data.id
  }
  const newBooking = async (arrival: string, departure: string, over: Record<string, unknown> = {}) => {
    const { data, error } = await ownerA.rpc('save_booking', {
      p_input: {
        tenant_id: tenantA,
        kind: 'booking',
        apartment_id: apartmentA,
        arrival,
        planned_departure: departure,
        departure,
        guest_id: guestA,
        adults: 1,
        child_ages: [],
        amounts: { nights_cents: 30000, nights_vat_rate: '10.00', charges: [{ label: 'Reinigung', amount_cents: 6000, vat_rate: '10.00' }] },
        ...over,
      } as Json,
      p_confirm: true,
    })
    if (error) throw error
    return (data as { id: string }).id
  }
  const number = () => `R-${randomUUID().slice(0, 8)}`
  const input = (over: Record<string, unknown> = {}) => ({
    tenant_id: tenantA,
    number: number(),
    invoice_date: '2025-03-14',
    recipient: 'Huber Maria',
    lines: [
      { label: 'Übernachtung', amount_cents: 33000, vat_rate: '10.00' },
      { label: 'Extra', amount_cents: 12000, vat_rate: '20.00' },
    ],
    ...over,
  })
  const save = async (client: Client, over: Record<string, unknown> = {}) => {
    const { data, error } = await client.rpc('save_invoice', { p_input: input(over) as Json })
    return { result: data as unknown as Saved | null, error }
  }
  const savedId = (r: { result: Saved | null; error: unknown }) => {
    expect(r.error).toBeNull()
    return r.result!.id
  }
  const invoice = async (id: string) => {
    const { data } = await service.from('invoices').select('*, lines:invoice_lines(position, label, amount_cents, vat_rate)').eq('id', id).single()
    return data!
  }
  const upload = async (client: Client, tenantId: string, body: Buffer = PDF, contentType = 'application/pdf') => {
    const p = `${tenantId}/${randomUUID()}.pdf`
    const { error } = await client.storage.from(BUCKET).upload(p, body, { contentType })
    return { path: p, error }
  }

  beforeAll(async () => {
    service = serviceClient()
    const [oa, sa, ob] = await Promise.all([sharedClient('ownerA'), sharedClient('staffA'), sharedClient('ownerB')])
    ;[ownerA, staffA, ownerB] = [oa.client, sa.client, ob.client]
    tenantA = await newTenant([
      [oa.user, 'owner'],
      [sa.user, 'staff'],
    ])
    tenantB = await newTenant([[ob.user, 'owner']])
    const { data: property } = await service
      .from('properties')
      .insert({ tenant_id: tenantA, name: `Haus ${runId}`, street: 'Seeweg 12', postal_code: '5340', city: 'St. Gilgen', municipality_code: '50330' })
      .select('id')
      .single()
    const { data: apt, error } = await service
      .from('apartments')
      .insert({ tenant_id: tenantA, property_id: property!.id, name: `Top ${runId}`, max_guests: 4, price_cents: 10000 })
      .select('id')
      .single()
    if (error) throw error
    apartmentA = apt.id
    guestA = await newGuest(tenantA)
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

  describe('Speichern', () => {
    it('legt Rechnung und Positionen an; Gesamtbetrag und Kleinunternehmer bildet die Datenbank', async () => {
      const id = savedId(await save(ownerA, { number: ` ${runId}-A1 `, recipient: ' Huber Maria ' }))
      const inv = await invoice(id)
      expect(inv).toMatchObject({ number: `${runId}-A1`, number_key: `${runId}-a1`, recipient: 'Huber Maria', total_cents: 45000, small_business: false, origin: 'backfilled' })
      expect([...inv.lines].sort((a, b) => a.position - b.position)).toEqual([
        { position: 1, label: 'Übernachtung', amount_cents: 33000, vat_rate: 10 },
        { position: 2, label: 'Extra', amount_cents: 12000, vat_rate: 20 },
      ])
    })

    it('erlaubt negative Positionen und einen Gesamtbetrag unter 0', async () => {
      const id = savedId(await save(ownerA, { lines: [{ label: 'Gutschrift', amount_cents: -5000, vat_rate: '20.00' }] }))
      expect((await invoice(id)).total_cents).toBe(-5000)
    })

    it('lehnt doppelte Nummern je Kunde ab (Groß-/Kleinschreibung, Leerzeichen) und meldet das Datum', async () => {
      savedId(await save(ownerA, { number: `${runId}-R-1`, invoice_date: '2025-02-01' }))
      for (const n of [`${runId}-r-1`, ` ${runId}-R-1 `]) {
        const r = await save(ownerA, { number: n })
        expect(r.error?.code).toBe('P0904')
        expect(r.error?.details).toBe('2025-02-01')
      }
    })

    it('erlaubt dieselbe Nummer bei einem anderen Kunden', async () => {
      savedId(await save(ownerA, { number: `${runId}-X` }))
      expect((await save(ownerB, { tenant_id: tenantB, number: `${runId}-X` })).error).toBeNull()
    })

    it('lehnt Datum in der Zukunft, leere Positionen und fehlende Pflichtangaben ab', async () => {
      expect((await save(ownerA, { invoice_date: '2999-01-01' })).error?.code).toBe('P0906')
      expect((await save(ownerA, { invoice_date: today() })).error).toBeNull()
      expect((await save(ownerA, { lines: [] })).error?.code).toBe('22023')
      expect((await save(ownerA, { recipient: '  ' })).error?.code).toBe('22023')
      expect((await save(ownerA, { number: 'x'.repeat(31) })).error?.code).toBe('22023')
      expect((await save(ownerA, { lines: [{ label: 'X', amount_cents: 1, vat_rate: '101' }] })).error?.code).toBe('22023')
    })

    it('legt den Kleinunternehmer-Status nach dem Rechnungsdatum fest', async () => {
      await service.from('vat_status_changes').insert({ tenant_id: tenantB, valid_from: '2024-01-01', small_business: true })
      const before = savedId(await save(ownerB, { tenant_id: tenantB, invoice_date: '2023-12-31' }))
      const after = savedId(await save(ownerB, { tenant_id: tenantB, invoice_date: '2024-01-01' }))
      expect((await invoice(before)).small_business).toBe(false)
      expect((await invoice(after)).small_business).toBe(true)
    })

    it('legt einen neuen Gast im selben Vorgang an', async () => {
      const id = savedId(await save(ownerA, { new_guest: { last_name: `Neu ${runId}`, first_name: 'Nina', country: 'DE' } }))
      const { data } = await service.from('invoices').select('guest:guests(last_name, tenant_id)').eq('id', id).single()
      expect(data?.guest).toEqual({ last_name: `Neu ${runId}`, tenant_id: tenantA })
    })

    it('lehnt fremde Buchungen, fremde Gäste und Sperren ab', async () => {
      const guestB = await newGuest(tenantB)
      expect((await save(ownerA, { guest_id: guestB })).error?.code).toBe('P0909')
      const { data: block } = await ownerA.rpc('save_block', {
        p_input: { tenant_id: tenantA, apartment_id: apartmentA, arrival: '2028-01-05', departure: '2028-01-07', block_reason: 'renovation' } as Json,
        p_confirm: true,
      })
      expect((await save(ownerA, { booking_id: (block as { id: string }).id })).error?.code).toBe('P0908')
      expect((await save(ownerB, { tenant_id: tenantB, booking_id: await newBooking('2028-02-01', '2028-02-03') })).error?.code).toBe('P0908')
    })
  })

  describe('Ändern und Löschen', () => {
    it('ändert mit Konfliktschutz und ersetzt die Positionen', async () => {
      const id = savedId(await save(ownerA))
      const first = await invoice(id)
      const changed = await save(ownerA, { id, updated_at: first.updated_at, number: first.number, lines: [{ label: 'Neu', amount_cents: 100, vat_rate: '0' }] })
      expect(changed.error).toBeNull()
      const after = await invoice(id)
      expect(after.total_cents).toBe(100)
      expect(after.lines).toHaveLength(1)
      // zweiter Bearbeiter mit altem Stand
      expect((await save(ownerA, { id, updated_at: first.updated_at, number: first.number })).error?.code).toBe('P0903')
    })

    it('Schalter aus: Anlegen abgelehnt, Ändern und Löschen erlaubt', async () => {
      const id = savedId(await save(ownerB, { tenant_id: tenantB }))
      await service.from('tenants').update({ invoice_backfill_enabled: false }).eq('id', tenantB)
      try {
        expect((await save(ownerB, { tenant_id: tenantB })).error?.code).toBe('P0905')
        const inv = await invoice(id)
        expect((await save(ownerB, { tenant_id: tenantB, id, updated_at: inv.updated_at, number: inv.number, recipient: 'Neu' })).error).toBeNull()
        expect((await ownerB.rpc('delete_invoice', { p_invoice_id: id })).error).toBeNull()
      } finally {
        await service.from('tenants').update({ invoice_backfill_enabled: true }).eq('id', tenantB)
      }
    })

    it('löscht Rechnung samt Positionen und meldet das PDF', async () => {
      const { path, error } = await upload(ownerA, tenantA)
      expect(error).toBeNull()
      const id = savedId(await save(ownerA, { pdf_path: path }))
      const { data, error: e } = await ownerA.rpc('delete_invoice', { p_invoice_id: id })
      expect(e).toBeNull()
      expect(data).toBe(path)
      const { count } = await service.from('invoice_lines').select('id', { count: 'exact', head: true }).eq('invoice_id', id)
      expect(count).toBe(0)
    })

    it('protokolliert Anlegen, Ändern und Löschen', async () => {
      const id = savedId(await save(ownerA))
      const inv = await invoice(id)
      await save(ownerA, { id, updated_at: inv.updated_at, number: inv.number, recipient: 'Anders' })
      await ownerA.rpc('delete_invoice', { p_invoice_id: id })
      const { data } = await service.from('audit_log').select('action, actor_id').eq('table_name', 'invoices').eq('record_id', id)
      expect(new Set((data ?? []).map((r) => r.action))).toEqual(new Set(['insert', 'update', 'delete']))
      expect((data ?? []).every((r) => r.actor_id)).toBe(true)
    })
  })

  describe('PDF', () => {
    it('nimmt nur PDF bis 10 MB, nur Inhaber in den eigenen Ordner', async () => {
      expect((await upload(ownerA, tenantA)).error).toBeNull()
      expect((await upload(staffA, tenantA)).error).not.toBeNull()
      expect((await upload(ownerB, tenantA)).error).not.toBeNull()
      expect((await upload(ownerA, tenantA, PDF, 'image/jpeg')).error).not.toBeNull()
      expect((await upload(ownerA, tenantA, Buffer.alloc(10 * 1024 * 1024 + 1))).error).not.toBeNull()
    })

    it('verlangt ein vorhandenes, eigenes, unbenutztes PDF', async () => {
      expect((await save(ownerA, { pdf_path: `${tenantA}/${randomUUID()}.pdf` })).error?.code).toBe('P0907')
      const { path } = await upload(ownerB, tenantB)
      expect((await save(ownerA, { pdf_path: path })).error?.code).toBe('P0907')
      const own = await upload(ownerA, tenantA)
      savedId(await save(ownerA, { pdf_path: own.path }))
      expect((await save(ownerA, { pdf_path: own.path })).error?.code).toBe('P0907')
    })

    it('meldet ersetzte PDFs als unbenutzt; lesen dürfen Mitglieder, nicht fremde Kunden', async () => {
      const a = await upload(ownerA, tenantA)
      const id = savedId(await save(ownerA, { pdf_path: a.path }))
      expect((await staffA.storage.from(BUCKET).createSignedUrl(a.path, 60)).error).toBeNull()
      expect((await ownerB.storage.from(BUCKET).createSignedUrl(a.path, 60)).error).not.toBeNull()

      const b = await upload(ownerA, tenantA)
      const inv = await invoice(id)
      const r = await save(ownerA, { id, updated_at: inv.updated_at, number: inv.number, pdf_path: b.path })
      expect(r.result?.unused_pdf).toBe(a.path)
      // Das alte PDF hängt an keiner Rechnung mehr: nicht mehr lesbar
      expect((await staffA.storage.from(BUCKET).createSignedUrl(a.path, 60)).error).not.toBeNull()
    })

    it('Bereinigung erfasst nur alte, unbenutzte PDFs und ist nur für den Server', async () => {
      expect((await ownerA.rpc('unused_invoice_pdfs', { p_limit: 10 })).error).not.toBeNull()
      const { data, error } = await service.rpc('unused_invoice_pdfs', { p_limit: 1000 })
      expect(error).toBeNull()
      // frische Uploads dieses Laufs (jünger als 24 Stunden) sind nicht dabei
      expect((data ?? []).some((p) => p.startsWith(tenantA))).toBe(false)
    })
  })

  describe('Lesen wie die App (src/lib/invoices-data.ts)', () => {
    it('Liste mit Suche nach Nummer oder Empfänger, sortiert nach Datum und Nummer', async () => {
      const booking = await newBooking('2028-06-01', '2028-06-03')
      savedId(await save(ownerA, { number: `${runId}/L-1`, invoice_date: '2020-05-05', booking_id: booking }))
      savedId(await save(ownerA, { number: `${runId}/L-2`, invoice_date: '2020-05-05', recipient: `Firma ${runId}` }))
      const { data, error, count } = await staffA
        .from('invoices')
        .select('id, number, invoice_date, recipient, total_cents, origin, pdf_path, booking:bookings(id, number)', { count: 'exact' })
        .eq('tenant_id', tenantA)
        .or(`number.ilike."%${runId}/L%",recipient.ilike."%${runId}/L%"`)
        .order('invoice_date', { ascending: false })
        .order('number', { ascending: false })
        .range(0, 49)
      expect(error).toBeNull()
      expect(count).toBe(2)
      expect(data?.map((r) => r.number)).toEqual([`${runId}/L-2`, `${runId}/L-1`])
      expect(data?.[1]?.booking?.id).toBe(booking)
      const byRecipient = await staffA.from('invoices').select('id').eq('tenant_id', tenantA).or(`number.ilike."%Firma ${runId}%",recipient.ilike."%Firma ${runId}%"`)
      expect(byRecipient.data).toHaveLength(1)
    })

    it('Detail mit Positionen, Gast und Buchung', async () => {
      const booking = await newBooking('2028-07-01', '2028-07-03')
      const id = savedId(await save(ownerA, { booking_id: booking, guest_id: guestA }))
      const { data, error } = await staffA
        .from('invoices')
        .select(
          'id, number, invoice_date, origin, recipient, small_business, total_cents, pdf_path, updated_at, ' +
            'lines:invoice_lines(position, label, amount_cents, vat_rate), ' +
            'guest:guests(id, last_name, first_name, title_prefix, title_suffix, country, company_name, anonymized_at), ' +
            'booking:bookings(id, kind, number, arrival, departure, cancelled_at, guest:guests(last_name, first_name), apartment:apartments!inner(name, property:properties!inner(name)))'
        )
        .eq('id', id)
        .eq('tenant_id', tenantA)
        .maybeSingle()
      expect(error).toBeNull()
      const row = data as unknown as { lines: unknown[]; guest: { id: string }; booking: { id: string; apartment: { name: string } } }
      expect(row.lines).toHaveLength(2)
      expect(row.guest.id).toBe(guestA)
      expect(row.booking).toMatchObject({ id: booking, apartment: { name: `Top ${runId}` } })
    })
  })

  describe('Rechte', () => {
    it('Mitarbeiter lesen, schreiben aber nichts', async () => {
      const id = savedId(await save(ownerA))
      const { data } = await staffA.from('invoices').select('id').eq('id', id)
      expect(data).toHaveLength(1)
      expect((await save(staffA)).error?.code).toBe('P0901')
      expect((await staffA.rpc('delete_invoice', { p_invoice_id: id })).error?.code).toBe('P0901')
      expect((await staffA.rpc('search_invoice_bookings', { p_tenant_id: tenantA, p_query: 'Huber' })).error?.code).toBe('P0901')
      const direct = await staffA.from('invoices').insert({ tenant_id: tenantA, number: 'x', invoice_date: '2025-01-01', recipient: 'x' })
      expect(direct.error?.code).toBe('42501')
    })

    it('fremde Kunden sehen nichts und können nichts ändern', async () => {
      const id = savedId(await save(ownerA))
      expect((await ownerB.from('invoices').select('id').eq('id', id)).data).toHaveLength(0)
      expect((await ownerB.from('invoice_lines').select('id').eq('invoice_id', id)).data).toHaveLength(0)
      expect((await save(ownerB)).error?.code).toBe('P0901')
      expect((await ownerB.rpc('delete_invoice', { p_invoice_id: id })).error?.code).toBe('P0902')
    })
  })

  describe('Buchungen', () => {
    it('findet Buchungen nach Gast, Wohnung, Tag und Monat, auch stornierte, keine Sperren', async () => {
      const booking = await newBooking('2028-10-14', '2028-10-17')
      const cancelled = await newBooking('2028-11-02', '2028-11-04')
      await ownerA.rpc('cancel_booking', { p_booking_id: cancelled, p_fee_cents: 9000 })
      const ids = async (q: string) => ((await ownerA.rpc('search_invoice_bookings', { p_tenant_id: tenantA, p_query: q })).data ?? []).map((r) => r.id)
      expect(await ids(`Huber ${runId}`)).toEqual(expect.arrayContaining([booking, cancelled]))
      expect(await ids(`Top ${runId} 15.10.2028`)).toEqual([booking])
      expect(await ids(`${runId} 11.2028`)).toEqual([cancelled])
      const hit = (await ownerA.rpc('search_invoice_bookings', { p_tenant_id: tenantA, p_query: `${runId} 11.2028` })).data?.[0]
      expect(hit).toMatchObject({ cancelled: true, kind: 'booking', guest_last_name: `Huber ${runId}`, apartment_name: `Top ${runId}` })
      expect(await ids('31.02.2030')).toEqual([])
    })

    it('liefert Rechnungen einer Buchung mit Gesamtpreis, auch für Mitarbeiter', async () => {
      const booking = await newBooking('2028-12-01', '2028-12-04')
      savedId(await save(ownerA, { booking_id: booking, invoice_date: '2025-01-01' }))
      savedId(await save(ownerA, { booking_id: booking, invoice_date: '2025-01-02' }))
      const { data, error } = await staffA.rpc('booking_invoices', { p_booking_id: booking })
      expect(error).toBeNull()
      const r = data as { booking_total_cents: number; invoices: { total_cents: number; has_pdf: boolean }[] }
      expect(r.booking_total_cents).toBe(36000)
      expect(r.invoices).toHaveLength(2)
      expect(r.invoices[0]).toMatchObject({ total_cents: 45000, has_pdf: false })
      // fremder Kunde: nichts
      const other = (await ownerB.rpc('booking_invoices', { p_booking_id: booking })).data as { booking_total_cents: number | null; invoices: unknown[] }
      expect(other).toEqual({ booking_total_cents: null, invoices: [] })
    })

    it('Gesamtpreis einer stornierten Buchung ist die Stornogebühr', async () => {
      const booking = await newBooking('2028-03-01', '2028-03-03')
      await ownerA.rpc('cancel_booking', { p_booking_id: booking, p_fee_cents: 7000 })
      const { data } = await ownerA.rpc('booking_invoices', { p_booking_id: booking })
      expect((data as { booking_total_cents: number }).booking_total_cents).toBe(7000)
    })
  })

  describe('Gäste und Schalter', () => {
    it('Gast nur mit Rechnung wird anonymisiert statt gelöscht; die Rechnung bleibt unverändert', async () => {
      const g = await newGuest(tenantA, { last_name: `Nur Rechnung ${runId}` })
      const id = savedId(await save(ownerA, { guest_id: g, recipient: 'Firma X' }))
      const { data, error } = await ownerA.rpc('delete_guest', { p_guest_id: g })
      expect(error).toBeNull()
      expect(data).toBe('anonymized')
      expect(await invoice(id)).toMatchObject({ guest_id: g, recipient: 'Firma X', total_cents: 45000 })
      const { data: guest } = await service.from('guests').select('last_name').eq('id', g).single()
      expect(guest?.last_name).toBe('Gelöschter Gast')
    })

    it('Zusammenführen hängt die Rechnungen an den verbleibenden Gast', async () => {
      const keep = await newGuest(tenantA, { last_name: `Bleibt ${runId}` })
      const remove = await newGuest(tenantA, { last_name: `Geht ${runId}` })
      const id = savedId(await save(ownerA, { guest_id: remove }))
      expect((await ownerA.rpc('merge_guests', { p_keep: keep, p_remove: remove, p_choice: {} })).error).toBeNull()
      expect((await invoice(id)).guest_id).toBe(keep)
    })

    it('Inhaber schaltet das Nacherfassen über die Stammdaten um; Mitarbeiter nicht', async () => {
      const { data: t } = await service.from('tenants').select('name, updated_at, invoice_backfill_enabled').eq('id', tenantA).single()
      expect(t?.invoice_backfill_enabled).toBe(true)
      const update = (client: Client, updatedAt: string, value: unknown) =>
        client.rpc('update_tenant_master_data', {
          p_tenant_id: tenantA,
          p_expected_updated_at: updatedAt,
          p_data: { name: t!.name, invoice_backfill_enabled: value } as Json,
        })
      expect((await update(staffA, t!.updated_at, false)).error?.code).toBe('42501')
      expect((await update(ownerA, t!.updated_at, 'nein')).error?.code).toBe('22023')
      expect((await update(ownerA, t!.updated_at, false)).error).toBeNull()
      const { data: after } = await service.from('tenants').select('updated_at, invoice_backfill_enabled').eq('id', tenantA).single()
      expect(after?.invoice_backfill_enabled).toBe(false)
      const { data: log } = await service
        .from('operator_log')
        .select('changed_fields')
        .eq('tenant_id', tenantA)
        .eq('action', 'master_data')
        .order('created_at', { ascending: false })
        .limit(1)
      expect(log?.[0]?.changed_fields).toContain('invoice_backfill_enabled')
      expect((await update(ownerA, after!.updated_at, true)).error).toBeNull()
    })
  })
})
