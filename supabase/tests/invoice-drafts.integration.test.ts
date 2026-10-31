// @vitest-environment node
//
// PROJ-40: Rechnungsentwurf gegen „apppa-dev“ (übersprungen ohne .env.local)
import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { Json } from '../../src/types/database'
import { type Client, hasSupabaseEnv, serviceClient, type TestUser } from './helpers'
import { sharedClient } from './shared-sessions'

const doc = (...paragraphs: string[]): Json => ({
  type: 'doc',
  content: paragraphs.map((text) => ({ type: 'paragraph', content: [{ type: 'text', text }] })),
})

type Line = { label: string; amount_cents: number; vat_rate: string; source_kind?: string | null; source_charge_id?: string | null }

describe.skipIf(!hasSupabaseEnv)('PROJ-40 Rechnungsentwurf', () => {
  let service: Client
  const tenants: string[] = []
  let tenantA: string, tenantB: string
  let ownerA: Client, staffA: Client, ownerB: Client, admin: Client
  const runId = randomUUID().slice(0, 8)
  let apartmentA: string, apartmentB: string
  let guestA: string, guestB: string
  // Gästeblatt-, Zeitraum- und Konfliktwarnungen vermeiden: jede Buchung ein eigener Zeitraum
  let day = 0

  const newTenant = async (members: [TestUser, 'owner' | 'staff'][]) => {
    const { data, error } = await service.from('tenants').insert({ name: `PROJ-40 Test ${runId}` }).select('id').single()
    if (error) throw error
    tenants.push(data.id)
    for (const [u, role] of members) {
      const { error: e } = await service.from('memberships').insert({ tenant_id: data.id, user_id: u.id, role })
      if (e) throw e
    }
    return data.id
  }
  const newApartment = async (tenantId: string) => {
    const { data: property } = await service
      .from('properties')
      .insert({ tenant_id: tenantId, name: `Haus ${runId}`, street: 'Seeweg 12', postal_code: '5340', city: 'St. Gilgen', municipality_code: '50330' })
      .select('id')
      .single()
    const { data, error } = await service
      .from('apartments')
      .insert({ tenant_id: tenantId, property_id: property!.id, name: `Top ${runId}`, max_guests: 4, price_cents: 10000 })
      .select('id')
      .single()
    if (error) throw error
    return data.id
  }
  const newGuest = async (tenantId: string) => {
    const { data, error } = await service
      .from('guests')
      .insert({ tenant_id: tenantId, last_name: `Huber ${runId}`, first_name: 'Maria', country: 'AT' })
      .select('id')
      .single()
    if (error) throw error
    return data.id
  }
  const nextPeriod = () => {
    const start = new Date(Date.UTC(2028, 0, 1) + day * 86_400_000)
    day += 5
    const iso = (d: Date) => d.toISOString().slice(0, 10)
    return [iso(start), iso(new Date(start.getTime() + 3 * 86_400_000))]
  }
  // Übernachtung € 900 zu 10 %, Reinigung € 100 zu 20 % → Gesamtpreis € 1.000
  const newBooking = async (
    client: Client = ownerA,
    tenantId = tenantA,
    apartment = apartmentA,
    guest = guestA,
    charges: { id?: string; label: string; amount_cents: number; vat_rate: string }[] = [{ label: 'Reinigung', amount_cents: 10000, vat_rate: '20.00' }]
  ) => {
    const [arrival, departure] = nextPeriod()
    const { data, error } = await client.rpc('save_booking', {
      p_input: {
        tenant_id: tenantId,
        kind: 'booking',
        apartment_id: apartment,
        arrival,
        planned_departure: departure,
        departure,
        guest_id: guest,
        adults: 1,
        child_ages: [],
        amounts: { nights_cents: 90000, nights_vat_rate: '10.00', charges },
      } as Json,
      p_confirm: true,
    })
    if (error) throw error
    return (data as { id: string }).id
  }
  const chargeIds = async (bookingId: string) => {
    const { data } = await service.from('booking_charges').select('id, label, position').eq('booking_id', bookingId).order('position')
    return data ?? []
  }
  const bookingLines = async (bookingId: string): Promise<Line[]> => {
    const charges = await chargeIds(bookingId)
    return [
      { label: 'Übernachtung', amount_cents: 90000, vat_rate: '10.00', source_kind: 'nights', source_charge_id: null },
      ...charges.map((c) => ({ label: c.label, amount_cents: 10000, vat_rate: '20.00', source_kind: 'charge', source_charge_id: c.id })),
    ]
  }
  const input = (bookingId: string, over: Record<string, unknown> = {}) => ({
    id: null,
    updated_at: null,
    tenant_id: tenantA,
    booking_id: bookingId,
    kind: 'invoice',
    invoice_date: '2029-02-01',
    recipient_kind: 'guest',
    recipient: { name: 'Maria Huber', line1: 'Seeweg 1', line2: '', postal_code: '5020', city: 'Salzburg', country: 'at', vat_id: '' },
    company_salutation: 'generic',
    guest_names: 'none',
    partial: null,
    lines: [{ label: 'Übernachtung', amount_cents: 90000, vat_rate: '10.00', source_kind: 'nights', source_charge_id: null }],
    deduction_ids: [],
    texts: { intro: { block_id: null, body: doc('{Anrede}, danke für Ihren Aufenthalt in {Wohnung}.') }, payment: { block_id: null, body: null }, closing: { block_id: null, body: null } },
    payment: { deposit_percent: null, deposit_days: null, due_days: 14, due_basis: 'after_invoice' },
    booking_fingerprint: 'abcd1234',
    ...over,
  })
  const save = async (client: Client, bookingId: string, over: Record<string, unknown> = {}) => {
    const { data, error } = await client.rpc('save_invoice_draft', { p_input: input(bookingId, over) as Json })
    return { id: data as string | null, error }
  }
  const savedId = (r: { id: string | null; error: unknown }) => {
    expect(r.error).toBeNull()
    return r.id!
  }
  const invoice = async (id: string) => {
    const { data } = await service
      .from('invoices')
      .select('*, lines:invoice_lines(position, label, amount_cents, vat_rate, source_kind, source_charge_id), deductions:invoice_deductions!invoice_deductions_invoice_fkey(deducted_invoice_id)')
      .eq('id', id)
      .single()
    return data!
  }
  const partial = (amount: number, lines: Line[]) => ({
    kind: 'partial',
    partial: { mode: 'amount', percent: null, amount_cents: amount },
    lines,
  })
  const backfill = async (bookingId: string, amount: number, over: Record<string, unknown> = {}) => {
    const { data, error } = await ownerA.rpc('save_invoice', {
      p_input: {
        tenant_id: tenantA,
        number: `AR-${randomUUID().slice(0, 8)}`,
        invoice_date: '2025-03-14',
        booking_id: bookingId,
        recipient: 'Huber Maria',
        lines: [{ label: 'Anzahlung', amount_cents: amount, vat_rate: '10.00' }],
        ...over,
      } as Json,
    })
    if (error) throw error
    return (data as { id: string }).id
  }

  beforeAll(async () => {
    service = serviceClient()
    const [oa, sa, ob, ad] = await Promise.all([sharedClient('ownerA'), sharedClient('staffA'), sharedClient('ownerB'), sharedClient('adminAal2')])
    ;[ownerA, staffA, ownerB, admin] = [oa.client, sa.client, ob.client, ad.client]
    tenantA = await newTenant([
      [oa.user, 'owner'],
      [sa.user, 'staff'],
    ])
    tenantB = await newTenant([[ob.user, 'owner']])
    ;[apartmentA, apartmentB] = await Promise.all([newApartment(tenantA), newApartment(tenantB)])
    ;[guestA, guestB] = await Promise.all([newGuest(tenantA), newGuest(tenantB)])
  }, 60_000)

  afterAll(async () => {
    if (!service) return
    for (const id of tenants) {
      const { error } = await service.from('tenants').delete().eq('id', id)
      if (error) console.error('Aufräumen fehlgeschlagen', error.message)
    }
  }, 60_000)

  describe('Rechte', () => {
    it('nur Inhaber des Kunden legen an, ändern und löschen', async () => {
      const booking = await newBooking()
      expect((await save(staffA, booking)).error?.code).toBe('P0901')
      expect((await save(ownerB, booking)).error?.code).toBe('P0901')
      // fremde Buchung mit dem eigenen Kunden
      expect((await save(ownerB, booking, { tenant_id: tenantB })).error?.code).toBe('P0908')
      const id = savedId(await save(ownerA, booking))
      const inv = await invoice(id)
      expect((await save(staffA, booking, { id, updated_at: inv.updated_at })).error?.code).toBe('P0901')
      expect((await staffA.rpc('delete_invoice_draft', { p_invoice_id: id })).error?.code).toBe('P0901')
      expect((await ownerB.rpc('delete_invoice_draft', { p_invoice_id: id })).error?.code).toBe('P0902')
      // direktes Schreiben ist gesperrt
      expect((await ownerA.from('invoice_deductions').insert({ invoice_id: id, deducted_invoice_id: id, tenant_id: tenantA })).error).not.toBeNull()
      const upd = await ownerA.from('invoices').update({ total_cents: 1 }).eq('id', id).select('id')
      expect(upd.data ?? []).toHaveLength(0)
    })

    it('Mitarbeiter lesen Entwürfe samt Positionen; Betreiber und fremde Kunden nicht', async () => {
      const booking = await newBooking()
      const id = savedId(await save(ownerA, booking))
      const backfilled = await backfill(booking, 5000)
      const staff = await staffA.from('invoices').select('id, lines:invoice_lines(label)').eq('id', id).single()
      expect(staff.error).toBeNull()
      expect(staff.data?.lines).toHaveLength(1)
      expect((await ownerB.from('invoices').select('id').eq('id', id)).data).toEqual([])
      expect((await admin.from('invoices').select('id').eq('id', id)).data).toEqual([])
      expect((await admin.from('invoice_lines').select('id').eq('invoice_id', id)).data).toEqual([])
      // nacherfasste Rechnungen sieht der Betreiber weiterhin
      expect((await admin.from('invoices').select('id').eq('id', backfilled)).data).toHaveLength(1)
      const adminList = await admin.rpc('booking_invoices', { p_booking_id: booking })
      expect((adminList.data as { invoices: { id: string }[] }).invoices.map((i) => i.id)).toEqual([backfilled])
    })

    it('Vorschau-Daten für Inhaber und Mitarbeiter, nicht für fremde Kunden', async () => {
      await service.from('tenants').update({ address_line1: 'Seeweg 12', postal_code: '5340', city: 'St. Gilgen', country: 'AT', vat_id: 'ATU12345678' }).eq('id', tenantA)
      await service.from('vat_status_changes').insert({ tenant_id: tenantA, valid_from: '2020-01-01', small_business: false })
      const { data, error } = await staffA.rpc('invoice_preview_data', { p_tenant_id: tenantA })
      expect(error).toBeNull()
      const r = data as { issuer: Record<string, string>; small_business_note: unknown; vat_status: unknown[] }
      expect(r.issuer).toMatchObject({ address_line1: 'Seeweg 12', postal_code: '5340', city: 'St. Gilgen', country: 'AT', vat_id: 'ATU12345678' })
      expect(r.small_business_note).toBeTruthy()
      expect(r.vat_status).toEqual([{ valid_from: '2020-01-01', small_business: false }])
      expect((await ownerB.rpc('invoice_preview_data', { p_tenant_id: tenantA })).error?.code).toBe('42501')
      expect((await admin.rpc('invoice_preview_data', { p_tenant_id: tenantA })).error?.code).toBe('42501')
    })
  })

  describe('Anlegen und Ändern', () => {
    it('speichert den Entwurf ohne Nummer mit Empfänger, Positionen, Texten und Zahlungsregeln', async () => {
      const booking = await newBooking()
      const id = savedId(await save(ownerA, booking, { lines: await bookingLines(booking) }))
      const inv = await invoice(id)
      expect(inv).toMatchObject({
        number: null,
        number_key: null,
        origin: 'draft',
        kind: 'invoice',
        booking_id: booking,
        guest_id: guestA,
        recipient: 'Maria Huber',
        recipient_kind: 'guest',
        recipient_name: 'Maria Huber',
        recipient_line1: 'Seeweg 1',
        recipient_line2: null,
        recipient_country: 'AT',
        recipient_vat_id: null,
        total_cents: 100000,
        due_days: 14,
        due_basis: 'after_invoice',
        deposit_percent: null,
        payment_text: null,
        booking_fingerprint: 'abcd1234',
        deduction_removed: false,
      })
      const charges = await chargeIds(booking)
      expect([...inv.lines].sort((a, b) => a.position - b.position)).toEqual([
        { position: 1, label: 'Übernachtung', amount_cents: 90000, vat_rate: 10, source_kind: 'nights', source_charge_id: null },
        { position: 2, label: 'Reinigung', amount_cents: 10000, vat_rate: 20, source_kind: 'charge', source_charge_id: charges[0].id },
      ])
    })

    it('ändert mit Konfliktschutz, ersetzt Positionen und protokolliert', async () => {
      const booking = await newBooking()
      const id = savedId(await save(ownerA, booking))
      const first = await invoice(id)
      const changed = await save(ownerA, booking, { id, updated_at: first.updated_at, lines: [], recipient: { name: '' } })
      expect(changed.error).toBeNull()
      const after = await invoice(id)
      expect(after).toMatchObject({ total_cents: 0, recipient: '–', recipient_name: null })
      expect(after.lines).toHaveLength(0)
      expect((await save(ownerA, booking, { id, updated_at: first.updated_at })).error?.code).toBe('P0903')
      // Buchung wechseln geht nicht
      expect((await save(ownerA, await newBooking(), { id, updated_at: after.updated_at })).error?.code).toBe('P0908')

      expect((await ownerA.rpc('delete_invoice_draft', { p_invoice_id: id })).data).toBe(booking)
      const { data } = await service.from('audit_log').select('action, actor_id').eq('table_name', 'invoices').eq('record_id', id)
      expect(new Set((data ?? []).map((r) => r.action))).toEqual(new Set(['insert', 'update', 'delete']))
      expect((data ?? []).every((r) => r.actor_id)).toBe(true)
    })

    it('trennt Entwürfe und nacherfasste Rechnungen in den Funktionen', async () => {
      const booking = await newBooking()
      const draft = savedId(await save(ownerA, booking))
      const backfilled = await backfill(booking, 5000)
      const bf = await invoice(backfilled)
      expect((await save(ownerA, booking, { id: backfilled, updated_at: bf.updated_at })).error?.code).toBe('P0923')
      expect((await ownerA.rpc('delete_invoice_draft', { p_invoice_id: backfilled })).error?.code).toBe('P0923')
      const d = await invoice(draft)
      const viaBackfill = await ownerA.rpc('save_invoice', {
        p_input: { id: draft, updated_at: d.updated_at, tenant_id: tenantA, number: 'X-1', invoice_date: '2025-01-01', recipient: 'X', lines: [{ label: 'X', amount_cents: 1, vat_rate: '0' }] } as Json,
      })
      expect(viaBackfill.error?.code).toBe('P0902')
      expect((await ownerA.rpc('delete_invoice', { p_invoice_id: draft })).error?.code).toBe('P0902')
    })

    it('hält den Kleinunternehmer-Status nach der Buchung fest (Abreise)', async () => {
      await service.from('vat_status_changes').insert({ tenant_id: tenantB, valid_from: '2028-01-01', small_business: true })
      const booking = await newBooking(ownerB, tenantB, apartmentB, guestB)
      const id = savedId(await save(ownerB, booking, { tenant_id: tenantB, invoice_date: '2028-06-01' }))
      expect((await invoice(id)).small_business).toBe(true)
    })
  })

  describe('Summenregel beim Anlegen', () => {
    it('sperrt bei voll verrechnetem Gesamtpreis; Löschen gibt wieder frei', async () => {
      const booking = await newBooking()
      const full = savedId(await save(ownerA, booking, { lines: await bookingLines(booking) }))
      expect((await save(ownerA, booking)).error?.code).toBe('P0920')
      // Ändern bleibt möglich
      const inv = await invoice(full)
      expect((await save(ownerA, booking, { id: full, updated_at: inv.updated_at })).error).toBeNull()
      expect((await ownerA.rpc('delete_invoice_draft', { p_invoice_id: full })).error).toBeNull()
      expect((await save(ownerA, booking)).error).toBeNull()
    })

    it('zählt nacherfasste Rechnungen und Entwürfe zusammen', async () => {
      const booking = await newBooking()
      await backfill(booking, 20000)
      savedId(await save(ownerA, booking, { lines: [{ label: 'Teil', amount_cents: 10000, vat_rate: '10.00' }] }))
      expect((await save(ownerA, booking)).error).toBeNull()
    })

    it('Sperren und stornierte Buchungen ohne Gebühr haben nichts zu verrechnen; mit Gebühr bis zur Gebühr', async () => {
      const [arrival, departure] = nextPeriod()
      const { data: block } = await ownerA.rpc('save_block', {
        p_input: { tenant_id: tenantA, apartment_id: apartmentA, arrival, departure, block_reason: 'renovation' } as Json,
        p_confirm: true,
      })
      expect((await save(ownerA, (block as { id: string }).id)).error?.code).toBe('P0920')

      const noFee = await newBooking()
      expect((await ownerA.rpc('cancel_booking', { p_booking_id: noFee })).error).toBeNull()
      expect((await save(ownerA, noFee)).error?.code).toBe('P0920')

      const withFee = await newBooking()
      expect((await ownerA.rpc('cancel_booking', { p_booking_id: withFee, p_fee_cents: 12000, p_fee_vat_rate: '0.00' })).error).toBeNull()
      const fee = [{ label: 'Stornogebühr', amount_cents: 12000, vat_rate: '0.00', source_kind: 'cancellation_fee', source_charge_id: null }]
      savedId(await save(ownerA, withFee, { lines: fee }))
      expect((await save(ownerA, withFee, { lines: fee })).error?.code).toBe('P0920')
    })
  })

  describe('Prüfregeln', () => {
    it('lehnt ungültige Positionen, Teilbeträge, Zahlungsregeln und Texte ab (P0922)', async () => {
      const booking = await newBooking()
      const other = await newBooking()
      const foreignCharge = (await chargeIds(other))[0].id
      const bad: Record<string, unknown>[] = [
        { kind: 'gutschrift' },
        { invoice_date: 'kein Datum' },
        { recipient_kind: 'reisebuero' },
        { guest_names: 'alle' },
        { recipient: { name: 'x'.repeat(201) } },
        { recipient: { name: 'X', country: 'Österreich' } },
        { lines: Array.from({ length: 51 }, () => ({ label: 'X', amount_cents: 1, vat_rate: '10.00' })) },
        { lines: [{ label: 'x'.repeat(101), amount_cents: 1, vat_rate: '10.00' }] },
        { lines: [{ label: 'X', amount_cents: 1.5, vat_rate: '10.00' }] },
        { lines: [{ label: 'X', amount_cents: 1, vat_rate: '101' }] },
        { lines: [{ label: 'X', amount_cents: 1, vat_rate: '10.00', source_kind: 'charge', source_charge_id: foreignCharge }] },
        { lines: [{ label: 'X', amount_cents: 1, vat_rate: '10.00', source_kind: 'rabatt' }] },
        { payment: { deposit_percent: null, deposit_days: null, due_days: 366, due_basis: 'after_invoice' } },
        { payment: { deposit_percent: 0.5, deposit_days: 3, due_days: 0, due_basis: 'after_invoice' } },
        { payment: { deposit_percent: 20, deposit_days: null, due_days: 0, due_basis: 'after_invoice' } },
        { payment: { deposit_percent: null, deposit_days: null, due_days: 0, due_basis: 'nach_anreise' } },
        { texts: { intro: { block_id: null, body: doc('Hallo {Gastname}') } } },
        { texts: { payment: { block_id: null, body: doc('Anzahlung {Anzahlung}') } } },
        { texts: { closing: { block_id: null, body: { type: 'doc', content: [{ type: 'heading' }] } } } },
        partial(0, []),
        partial(20000, [{ label: 'Anzahlung', amount_cents: 19999, vat_rate: '10.00' }]),
        { kind: 'partial', partial: { mode: 'percent', percent: '0', amount_cents: 1 }, lines: [{ label: 'A', amount_cents: 1, vat_rate: '10.00' }] },
      ]
      for (const over of bad) {
        const r = await save(ownerA, booking, over)
        expect(r.error?.code, JSON.stringify(over)).toBe('P0922')
      }
    })

    it('nimmt {Anzahlung} mit Anzahlung und lange Bezeichnungen der Teilrechnung an', async () => {
      const booking = await newBooking()
      const ok = await save(ownerA, booking, {
        payment: { deposit_percent: 20, deposit_days: 3, due_days: 1, due_basis: 'before_arrival' },
        texts: { intro: { block_id: null, body: null }, payment: { block_id: null, body: doc('Anzahlung {Anzahlung} bis {Anzahlung fällig}, Rest {Restbetrag} bis {Fälligkeitsdatum}') }, closing: { block_id: null, body: null } },
      })
      expect(ok.error).toBeNull()
      expect(await invoice(ok.id!)).toMatchObject({ deposit_percent: 20, deposit_days: 3, due_days: 1, due_basis: 'before_arrival' })
      const label = `Anzahlung für Aufenthalt in ${'Haus '.repeat(30)}vom 01.01.2029 bis 04.01.2029`
      const p = await save(ownerA, booking, { ...partial(20000, [{ label, amount_cents: 18000, vat_rate: '10.00' }, { label, amount_cents: 2000, vat_rate: '20.00' }]) })
      expect(p.error).toBeNull()
      expect(await invoice(p.id!)).toMatchObject({ kind: 'partial', partial_mode: 'amount', partial_amount_cents: 20000, total_cents: 20000 })
    })

    it('übernimmt nur Bausteine des eigenen Kunden und Blocks als Verweis', async () => {
      const booking = await newBooking()
      const { data: own } = await service.from('invoice_text_blocks').select('id').eq('tenant_id', tenantA).eq('block', 'intro').limit(1).single()
      const { data: foreign } = await service.from('invoice_text_blocks').select('id').eq('tenant_id', tenantB).eq('block', 'intro').limit(1).single()
      const body = doc('Guten Tag')
      const a = savedId(await save(ownerA, booking, { texts: { intro: { block_id: own!.id, body } } }))
      const b = savedId(await save(ownerA, booking, { texts: { intro: { block_id: foreign!.id, body }, closing: { block_id: own!.id, body } } }))
      expect((await invoice(a)).intro_block_id).toBe(own!.id)
      expect(await invoice(b)).toMatchObject({ intro_block_id: null, closing_block_id: null, intro_text: body, closing_text: body })
    })
  })

  describe('Schlussrechnung und Abzüge', () => {
    it('zieht Teilrechnungen und gewählte nacherfasste Rechnungen ab', async () => {
      const booking = await newBooking()
      const part = savedId(await save(ownerA, booking, partial(20000, [{ label: 'A', amount_cents: 18000, vat_rate: '10.00' }, { label: 'A', amount_cents: 2000, vat_rate: '20.00' }])))
      const old = await backfill(booking, 5000)
      const final = savedId(await save(ownerA, booking, { kind: 'final', lines: await bookingLines(booking), deduction_ids: [part, old, part] }))
      const inv = await invoice(final)
      expect(inv.total_cents).toBe(100000 - 20000 - 5000)
      expect(new Set(inv.deductions.map((d: { deducted_invoice_id: string }) => d.deducted_invoice_id))).toEqual(new Set([part, old]))
      // Mitarbeiter lesen die Abzüge
      const staff = await staffA.from('invoice_deductions').select('deducted_invoice_id').eq('invoice_id', final)
      expect(staff.data).toHaveLength(2)
    })

    it('lehnt ungültige Abzüge ab (P0921)', async () => {
      const booking = await newBooking()
      const other = await newBooking()
      const plain = savedId(await save(ownerA, booking))
      const foreignPart = savedId(await save(ownerA, other, partial(1000, [{ label: 'A', amount_cents: 1000, vat_rate: '10.00' }])))
      const part = savedId(await save(ownerA, booking, partial(1000, [{ label: 'A', amount_cents: 1000, vat_rate: '10.00' }])))
      for (const over of [
        { kind: 'final', deduction_ids: [plain] },
        { kind: 'final', deduction_ids: [foreignPart] },
        { kind: 'final', deduction_ids: ['kein-uuid'] },
        { kind: 'final', deduction_ids: [randomUUID()] },
        { kind: 'invoice', deduction_ids: [part] },
      ]) {
        expect((await save(ownerA, booking, over)).error?.code, JSON.stringify(over)).toBe('P0921')
      }
      // nicht sich selbst
      const final = savedId(await save(ownerA, booking, { kind: 'final', deduction_ids: [part] }))
      const f = await invoice(final)
      expect((await save(ownerA, booking, { kind: 'final', id: final, updated_at: f.updated_at, deduction_ids: [final] })).error?.code).toBe('P0921')
    })

    it('bildet den Betrag neu, wenn sich die abgezogene Rechnung ändert oder gelöscht wird', async () => {
      const booking = await newBooking()
      const line = (n: number) => [{ label: 'A', amount_cents: n, vat_rate: '10.00' }]
      const part = savedId(await save(ownerA, booking, partial(20000, line(20000))))
      const old = await backfill(booking, 5000)
      const final = savedId(await save(ownerA, booking, { kind: 'final', lines: line(100000), deduction_ids: [part, old] }))
      expect((await invoice(final)).total_cents).toBe(75000)

      // Teilrechnung geändert
      const p = await invoice(part)
      savedId(await save(ownerA, booking, { id: part, updated_at: p.updated_at, ...partial(30000, line(30000)) }))
      expect((await invoice(final)).total_cents).toBe(65000)

      // nacherfasste Rechnung geändert
      const bf = await invoice(old)
      const changed = await ownerA.rpc('save_invoice', {
        p_input: { id: old, updated_at: bf.updated_at, tenant_id: tenantA, number: bf.number, invoice_date: '2025-03-14', booking_id: booking, recipient: 'Huber Maria', lines: line(8000) } as Json,
      })
      expect(changed.error).toBeNull()
      expect((await invoice(final)).total_cents).toBe(62000)

      // Teilrechnung gelöscht → Abzug entfällt mit Hinweis; Speichern setzt den Hinweis zurück
      expect((await ownerA.rpc('delete_invoice_draft', { p_invoice_id: part })).error).toBeNull()
      const afterDelete = await invoice(final)
      expect(afterDelete).toMatchObject({ total_cents: 92000, deduction_removed: true })
      expect(afterDelete.deductions.map((d: { deducted_invoice_id: string }) => d.deducted_invoice_id)).toEqual([old])
      savedId(await save(ownerA, booking, { kind: 'final', id: final, updated_at: afterDelete.updated_at, lines: line(100000), deduction_ids: [old] }))
      expect((await invoice(final)).deduction_removed).toBe(false)

      // nacherfasste Rechnung gelöscht
      expect((await ownerA.rpc('delete_invoice', { p_invoice_id: old })).error).toBeNull()
      expect(await invoice(final)).toMatchObject({ total_cents: 100000, deduction_removed: true })
    })

    it('Teilrechnung wird zur Rechnung: Schlussrechnungen verlieren den Abzug', async () => {
      const booking = await newBooking()
      const part = savedId(await save(ownerA, booking, partial(20000, [{ label: 'A', amount_cents: 20000, vat_rate: '10.00' }])))
      const final = savedId(await save(ownerA, booking, { kind: 'final', lines: [{ label: 'X', amount_cents: 100000, vat_rate: '10.00' }], deduction_ids: [part] }))
      const p = await invoice(part)
      savedId(await save(ownerA, booking, { id: part, updated_at: p.updated_at }))
      expect(await invoice(final)).toMatchObject({ total_cents: 100000, deduction_removed: true })
      expect((await invoice(final)).deductions).toHaveLength(0)
    })
  })

  describe('Buchung: stabile Zusatzkosten-Kennungen', () => {
    it('behält die Kennung beim Speichern; gelöschte Positionen lösen die Verbindung', async () => {
      const booking = await newBooking(ownerA, tenantA, apartmentA, guestA, [
        { label: 'Reinigung', amount_cents: 10000, vat_rate: '20.00' },
        { label: 'Frühstück', amount_cents: 5000, vat_rate: '10.00' },
      ])
      const [cleaning, breakfast] = await chargeIds(booking)
      const draft = savedId(await save(ownerA, booking, {
        lines: [{ label: 'Frühstück', amount_cents: 5000, vat_rate: '10.00', source_kind: 'charge', source_charge_id: breakfast.id }],
      }))
      const { data: b } = await service.from('bookings').select('*').eq('id', booking).single()
      const resave = (charges: { id?: string | null; label: string; amount_cents: number; vat_rate: string }[], updatedAt: string) =>
        ownerA.rpc('save_booking', {
          p_input: {
            id: booking,
            updated_at: updatedAt,
            tenant_id: tenantA,
            apartment_id: apartmentA,
            arrival: b!.arrival,
            planned_departure: b!.planned_departure,
            departure: b!.departure,
            guest_id: guestA,
            adults: 1,
            child_ages: [],
            amounts: { nights_cents: 90000, nights_vat_rate: '10.00', charges },
          } as Json,
          p_confirm: true,
        })
      // Reihenfolge getauscht, Betrag geändert, eine neue Position, eine fremde Kennung (wird neu angelegt)
      const r1 = await resave(
        [
          { id: breakfast.id, label: 'Frühstück', amount_cents: 6000, vat_rate: '10.00' },
          { id: cleaning.id, label: 'Reinigung', amount_cents: 10000, vat_rate: '20.00' },
          { id: randomUUID(), label: 'Parkplatz', amount_cents: 1500, vat_rate: '20.00' },
        ],
        b!.updated_at
      )
      expect(r1.error).toBeNull()
      const after = await chargeIds(booking)
      expect(after.map((c) => c.label)).toEqual(['Frühstück', 'Reinigung', 'Parkplatz'])
      expect(after[0].id).toBe(breakfast.id)
      expect(after[1].id).toBe(cleaning.id)
      expect((await service.from('booking_charges').select('amount_cents').eq('id', breakfast.id).single()).data?.amount_cents).toBe(6000)

      // Frühstück entfernt → Rechnungsposition bleibt, ohne Verbindung
      const { data: b2 } = await service.from('bookings').select('updated_at').eq('id', booking).single()
      expect((await resave([{ id: cleaning.id, label: 'Reinigung', amount_cents: 10000, vat_rate: '20.00' }], b2!.updated_at)).error).toBeNull()
      expect((await chargeIds(booking)).map((c) => c.id)).toEqual([cleaning.id])
      expect((await invoice(draft)).lines[0]).toMatchObject({ label: 'Frühstück', source_kind: 'charge', source_charge_id: null })
    })
  })

  describe('Lesen wie die App', () => {
    it('Rechnungen der Buchung mit Art; Summen getrennt nach Herkunft', async () => {
      const booking = await newBooking()
      const old = await backfill(booking, 20000)
      const draft = savedId(await save(ownerA, booking, partial(10000, [{ label: 'A', amount_cents: 10000, vat_rate: '10.00' }])))
      const { data, error } = await staffA.rpc('booking_invoices', { p_booking_id: booking })
      expect(error).toBeNull()
      const r = data as { booking_total_cents: number; invoices: { id: string; origin: string; kind: string | null; number: string | null; total_cents: number }[] }
      expect(r.booking_total_cents).toBe(100000)
      expect(r.invoices.find((i) => i.id === draft)).toMatchObject({ origin: 'draft', kind: 'partial', number: null, total_cents: 10000 })
      expect(r.invoices.find((i) => i.id === old)).toMatchObject({ origin: 'backfilled', kind: null })
    })

    it('Buchungsübersicht: Filter „ohne/mit Rechnung“ zählt Entwürfe nicht, die Spalte zeigt sie', async () => {
      const onlyDraft = await newBooking()
      const draft = savedId(await save(ownerA, onlyDraft))
      const billed = await newBooking()
      await backfill(billed, 1000)
      const list = (filter: 'with' | 'without') => {
        const cols = `id, invoices(id, number, origin), billed:invoices${filter === 'with' ? '!inner' : ''}(id)`
        let q = staffA.from('bookings').select(cols).eq('tenant_id', tenantA).in('id', [onlyDraft, billed]).neq('kind', 'block').neq('billed.origin' as 'id', 'draft')
        if (filter === 'without') q = q.is('billed' as 'id', null)
        return q
      }
      const without = await list('without')
      expect(without.error).toBeNull()
      const rows = (without.data ?? []) as unknown as { id: string; invoices: { id: string; origin: string }[] }[]
      expect(rows.map((r) => r.id)).toEqual([onlyDraft])
      expect(rows[0].invoices).toEqual([{ id: draft, number: null, origin: 'draft' }])
      const withInvoice = await list('with')
      expect(((withInvoice.data ?? []) as unknown as { id: string }[]).map((r) => r.id)).toEqual([billed])
    })

    it('Nummernliste ohne Entwürfe; Prüfung „hat ausgestellte Rechnungen“ ignoriert Entwürfe', async () => {
      const booking = await newBooking()
      savedId(await save(ownerA, booking))
      const { data, error } = await ownerA.rpc('invoice_numbers', { p_tenant_id: tenantA })
      expect(error).toBeNull()
      expect((data ?? []).every((n) => typeof n === 'string')).toBe(true)
      const { count } = await ownerA.from('invoices').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantA).eq('origin', 'issued')
      expect(count).toBe(0)
    })
  })
})
