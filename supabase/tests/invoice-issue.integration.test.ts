// PROJ-42: Rechnung ausstellen. Prüft die Datenbank: nur der Server stellt aus, Stand und Nummer werden im Moment des Festschreibens
// geprüft, ausgestellte Rechnungen sind unveränderlich, abgezogene nacherfasste Rechnungen teilweise gesperrt, Löschsperre beim Kunden.
import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { Json } from '../../src/types/database'
import { type Client, hasSupabaseEnv, serviceClient, type TestUser } from './helpers'
import { sharedClient } from './shared-sessions'

const SHA = 'a'.repeat(64)
const LINES = [{ label: 'Übernachtung', amount_cents: 90000, vat_rate: '10.00', source_kind: 'nights', source_charge_id: null }]

describe.skipIf(!hasSupabaseEnv)('PROJ-42 Rechnung ausstellen', () => {
  let service: Client
  let owner: Client, staff: Client, admin: Client, ownerB: Client
  let ownerUser: TestUser, staffUser: TestUser
  const tenants: string[] = []
  let tenant: string, apartment: string, guest: string
  const runId = randomUUID().slice(0, 8)
  let day = 0
  let seq = 0

  const newTenant = async (name: string) => {
    const { data, error } = await service.from('tenants').insert({ name }).select('id').single()
    if (error) throw error
    tenants.push(data.id)
    return data.id
  }
  const member = async (tenantId: string, user: TestUser, role: 'owner' | 'staff') => {
    const { error } = await service.from('memberships').insert({ tenant_id: tenantId, user_id: user.id, role })
    if (error) throw error
  }
  const newBooking = async (tenantId = tenant, apartmentId = apartment, guestId = guest) => {
    const start = new Date(Date.UTC(2029, 0, 1) + day * 86_400_000)
    day += 5
    const iso = (d: Date) => d.toISOString().slice(0, 10)
    const { data, error } = await owner.rpc('save_booking', {
      p_input: {
        tenant_id: tenantId,
        kind: 'booking',
        apartment_id: apartmentId,
        arrival: iso(start),
        planned_departure: iso(new Date(start.getTime() + 3 * 86_400_000)),
        departure: iso(new Date(start.getTime() + 3 * 86_400_000)),
        guest_id: guestId,
        adults: 1,
        child_ages: [],
        amounts: { nights_cents: 90000, nights_vat_rate: '10.00', charges: [] },
      } as Json,
      p_confirm: true,
    })
    if (error) throw error
    return (data as { id: string }).id
  }
  const newDraft = async (bookingId: string, over: Record<string, unknown> = {}, tenantId = tenant) => {
    const { data, error } = await owner.rpc('save_invoice_draft', {
      p_input: {
        id: null,
        updated_at: null,
        tenant_id: tenantId,
        booking_id: bookingId,
        kind: 'invoice',
        invoice_date: '2026-01-10',
        recipient_kind: 'guest',
        recipient: { name: 'Maria Huber', line1: 'Gartenweg 3', line2: '', postal_code: '5020', city: 'Salzburg', country: 'AT', vat_id: '' },
        company_salutation: 'generic',
        guest_names: 'none',
        partial: null,
        lines: LINES,
        deduction_ids: [],
        texts: { intro: { block_id: null, body: null }, payment: { block_id: null, body: null }, closing: { block_id: null, body: null } },
        payment: { deposit_percent: null, deposit_days: null, due_days: 0, due_basis: 'after_invoice' },
        booking_fingerprint: 'abc',
        ...over,
      } as unknown as Json,
    })
    if (error) throw error
    return data as string
  }
  const backfill = async (bookingId: string | null, number: string, over: Record<string, unknown> = {}) => {
    const { data, error } = await owner.rpc('save_invoice', {
      p_input: { tenant_id: tenant, number, invoice_date: '2026-01-05', booking_id: bookingId, recipient: 'Huber Maria', small_business: false, lines: [{ label: 'Anzahlung', amount_cents: 20000, vat_rate: '10.00' }], ...over } as Json,
    })
    if (error) throw error
    return (data as { id: string }).id
  }
  const row = async (id: string) => {
    const { data } = await service.from('invoices').select('*').eq('id', id).single()
    return data!
  }
  const upload = async (tenantId = tenant) => {
    const path = `${tenantId}/${randomUUID()}.pdf`
    const { error } = await service.storage.from('invoices').upload(path, new Blob(['%PDF-1.4'], { type: 'application/pdf' }), { contentType: 'application/pdf' })
    if (error) throw error
    return path
  }
  const issueInput = async (id: string, over: Record<string, unknown> = {}) => {
    const r = await row(id)
    const { data: b } = await service.from('bookings').select('updated_at').eq('id', r.booking_id!).single()
    return {
      id,
      tenant_id: r.tenant_id,
      actor_id: ownerUser.id,
      updated_at: r.updated_at,
      booking_updated_at: b!.updated_at,
      number: `N-${randomUUID().slice(0, 8)}`,
      invoice_date: '2026-01-10',
      small_business: false,
      total_cents: r.total_cents,
      pdf_sha256: SHA,
      without_logo: false,
      snapshot: { kind: r.kind, lines: [] },
      pdf_path: await upload(r.tenant_id),
      ...over,
    }
  }
  const issue = async (id: string, over: Record<string, unknown> = {}) => service.rpc('issue_invoice', { p_input: (await issueInput(id, over)) as unknown as Json })
  const issued = async (bookingId?: string, over: Record<string, unknown> = {}, issueOver: Record<string, unknown> = {}) => {
    const id = await newDraft(bookingId ?? (await newBooking()), over)
    const { error } = await issue(id, issueOver)
    expect(error).toBeNull()
    return id
  }

  beforeAll(async () => {
    service = serviceClient()
    const o = await sharedClient('ownerA')
    const s = await sharedClient('staffA')
    owner = o.client
    ownerUser = o.user
    staff = s.client
    staffUser = s.user
    admin = (await sharedClient('adminAal2')).client
    ownerB = (await sharedClient('ownerB')).client
    tenant = await newTenant(`PROJ-42 Test ${runId}`)
    await member(tenant, ownerUser, 'owner')
    await member(tenant, staffUser, 'staff')
    const { data: property } = await service
      .from('properties')
      .insert({ tenant_id: tenant, name: `Haus ${runId}`, street: 'Seeweg 12', postal_code: '5340', city: 'St. Gilgen', municipality_code: '50330' })
      .select('id')
      .single()
    const { data: ap } = await service.from('apartments').insert({ tenant_id: tenant, property_id: property!.id, name: `Top ${runId}`, max_guests: 4, price_cents: 10000 }).select('id').single()
    apartment = ap!.id
    const { data: g } = await service.from('guests').insert({ tenant_id: tenant, last_name: `Huber ${seq++}${runId}`, first_name: 'Maria', country: 'AT' }).select('id').single()
    guest = g!.id
  })

  afterAll(async () => {
    // Die Kaskade beim Löschen des Kunden darf ausgestellte Rechnungen mitnehmen
    for (const id of tenants) {
      const { error } = await service.from('tenants').delete().eq('id', id)
      expect(error).toBeNull()
    }
  })

  describe('Festschreiben', () => {
    it('stellt einen Entwurf aus: Nummer, Datum, Kennzeichen, Person, Protokoll mit Person', async () => {
      const id = await newDraft(await newBooking())
      const input = await issueInput(id, { number: `  R-${runId}-1 `, invoice_date: '2026-01-12', small_business: true })
      const { data, error } = await service.rpc('issue_invoice', { p_input: input as unknown as Json })
      expect(error).toBeNull()
      expect(data).toBe(id)
      const r = await row(id)
      expect(r).toMatchObject({ origin: 'issued', number: `R-${runId}-1`, invoice_date: '2026-01-12', small_business: true, pdf_path: input.pdf_path, pdf_sha256: SHA, issued_by: ownerUser.id })
      expect(r.issued_at).not.toBeNull()
      const { data: log } = await service.from('audit_log').select('actor_id').eq('record_id', id).eq('action', 'update').order('created_at', { ascending: false }).limit(1)
      expect(log?.[0]?.actor_id).toBe(ownerUser.id)
    })

    it('zweiter Versuch: keine zweite Rechnung, bleibt bei der ersten Nummer und Datei', async () => {
      const id = await issued(undefined, {}, { number: `R-${runId}-2` })
      const before = await row(id)
      const again = await service.rpc('issue_invoice', {
        p_input: { id, tenant_id: tenant, actor_id: ownerUser.id, number: `R-${runId}-2b`, invoice_date: '2026-01-10', small_business: false, pdf_sha256: SHA, snapshot: {}, updated_at: before.updated_at } as unknown as Json,
      })
      expect(again.error).toBeNull()
      expect(again.data).toBe(id)
      expect(await row(id)).toMatchObject({ number: `R-${runId}-2`, pdf_path: before.pdf_path })
    })

    it('nur der Server: Inhaber, Mitarbeiter und Betreiber dürfen die Funktion nicht aufrufen', async () => {
      const id = await newDraft(await newBooking())
      const input = (await issueInput(id)) as unknown as Json
      for (const client of [owner, staff, admin, ownerB]) {
        const { error } = await client.rpc('issue_invoice', { p_input: input })
        expect(error?.code).toBe('42501')
      }
      expect((await row(id)).origin).toBe('draft')
    })

    it('Mitarbeiter als handelnde Person wird abgelehnt', async () => {
      const id = await newDraft(await newBooking())
      expect((await issue(id, { actor_id: staffUser.id })).error?.code).toBe('P0901')
    })

    it('deaktivierter Kunde: kein Ausstellen', async () => {
      const id = await newDraft(await newBooking())
      await service.from('tenants').update({ status: 'deactivated' }).eq('id', tenant)
      const { error } = await issue(id)
      await service.from('tenants').update({ status: 'active' }).eq('id', tenant)
      expect(error?.code).toBe('P0016')
    })

    it('fremder Kunde: nicht gefunden', async () => {
      const id = await newDraft(await newBooking())
      const other = randomUUID()
      expect((await issue(id, { tenant_id: other, pdf_path: `${other}/x.pdf` })).error?.code).toBe('P0902')
    })

    it('Entwurf oder Buchung inzwischen geändert: abgelehnt, Entwurf unverändert', async () => {
      const id = await newDraft(await newBooking())
      const stale = await issueInput(id, { updated_at: '2020-01-01T00:00:00Z' })
      expect((await service.rpc('issue_invoice', { p_input: stale as unknown as Json })).error?.code).toBe('P0903')
      const staleBooking = await issueInput(id, { booking_updated_at: '2020-01-01T00:00:00Z' })
      expect((await service.rpc('issue_invoice', { p_input: staleBooking as unknown as Json })).error?.code).toBe('P0903')
      expect((await row(id)).origin).toBe('draft')
    })

    it('Betrag weicht vom gespeicherten Stand ab: abgelehnt', async () => {
      const id = await newDraft(await newBooking())
      expect((await issue(id, { total_cents: 1 })).error?.code).toBe('P0903')
    })

    it('vergebene Nummer abgelehnt, auch nacherfasst und in anderer Schreibung; Nummer bleibt bei der ersten', async () => {
      await backfill(null, `ALT-${runId}`)
      const id = await newDraft(await newBooking())
      expect((await issue(id, { number: `alt-${runId}` })).error?.code).toBe('P0904')
      await issued(undefined, {}, { number: `R-${runId}-3` })
      expect((await issue(id, { number: `r-${runId}-3` })).error?.code).toBe('P0904')
      expect(await row(id)).toMatchObject({ origin: 'draft', number: null })
    })

    it('gleichzeitig dieselbe Nummer: genau eine gewinnt', async () => {
      const [a, b] = [await newDraft(await newBooking()), await newDraft(await newBooking())]
      const number = `R-${runId}-4`
      const inputs = [await issueInput(a, { number }), await issueInput(b, { number })]
      const results = await Promise.all(inputs.map((p) => service.rpc('issue_invoice', { p_input: p as unknown as Json })))
      expect(results.filter((r) => !r.error)).toHaveLength(1)
      expect(results.find((r) => r.error)?.error?.code).toBe('P0904')
    })

    it('Datum in der Zukunft abgelehnt', async () => {
      const id = await newDraft(await newBooking())
      expect((await issue(id, { invoice_date: '2099-01-01' })).error?.code).toBe('P0906')
    })

    it('PDF fehlt, fremd oder schon verwendet: abgelehnt', async () => {
      const id = await newDraft(await newBooking())
      expect((await issue(id, { pdf_path: `${tenant}/${randomUUID()}.pdf` })).error?.code).toBe('P0907')
      expect((await issue(id, { pdf_path: `${randomUUID()}/${randomUUID()}.pdf` })).error?.code).toBe('P0907')
      const other = await issued()
      expect((await issue(id, { pdf_path: (await row(other)).pdf_path })).error?.code).toBe('P0907')
    })

    it('ungültige Eingaben: keine Nummer, zu lang, ohne Prüfsumme, ohne Fassung', async () => {
      const id = await newDraft(await newBooking())
      for (const over of [{ number: ' ' }, { number: 'x'.repeat(31) }, { pdf_sha256: 'nope' }, { snapshot: null }, { small_business: null }]) {
        expect((await issue(id, over)).error?.code, JSON.stringify(over)).toBe('22023')
      }
    })

    it('Schlussrechnung: Teilrechnungs-Entwurf als Abzug sperrt, nach dessen Ausstellen geht es; Betrag nach Abzug', async () => {
      const booking = await newBooking()
      const partial = await newDraft(booking, { kind: 'partial', partial: { mode: 'amount', percent: null, amount_cents: 20000 }, lines: [{ label: 'Anteil', amount_cents: 20000, vat_rate: '10.00' }] })
      const final = await newDraft(booking, { kind: 'final', deduction_ids: [partial] })
      expect((await row(final)).total_cents).toBe(70000)
      expect((await issue(final)).error?.code).toBe('P0930')
      expect((await issue(partial)).error).toBeNull()
      expect((await issue(final)).error).toBeNull()
      expect(await row(final)).toMatchObject({ origin: 'issued', total_cents: 70000 })
    })

    it('entfernter Abzug sperrt, bis der Entwurf neu gespeichert ist', async () => {
      const booking = await newBooking()
      const partial = await newDraft(booking, { kind: 'partial', partial: { mode: 'amount', percent: null, amount_cents: 20000 }, lines: [{ label: 'Anteil', amount_cents: 20000, vat_rate: '10.00' }] })
      const final = await newDraft(booking, { kind: 'final', deduction_ids: [partial] })
      const { error } = await owner.rpc('delete_invoice_draft', { p_invoice_id: partial })
      expect(error).toBeNull()
      expect((await row(final)).deduction_removed).toBe(true)
      expect((await issue(final)).error?.code).toBe('P0930')
    })
  })

  describe('Unveränderlichkeit', () => {
    it('Spalten, Löschen, Positionen und Abzüge: auch mit Systemrechten abgelehnt', async () => {
      const id = await issued()
      for (const change of [{ total_cents: 1 }, { number: 'X' }, { recipient: 'X' }, { pdf_path: null }, { booking_id: null }, { origin: 'draft' }, { small_business: true }, { issued_snapshot: {} }, { invoice_date: '2026-02-02' }]) {
        const { error } = await service.from('invoices').update(change as never).eq('id', id)
        expect(error?.code, JSON.stringify(change)).toBe('P0932')
      }
      expect((await service.from('invoices').delete().eq('id', id)).error?.code).toBe('P0932')
      expect((await service.from('invoice_lines').update({ amount_cents: 1 }).eq('invoice_id', id)).error?.code).toBe('P0932')
      expect((await service.from('invoice_lines').delete().eq('invoice_id', id)).error?.code).toBe('P0932')
      const { error: ins } = await service.from('invoice_lines').insert({ tenant_id: tenant, invoice_id: id, position: 9, label: 'x', amount_cents: 1, vat_rate: 10 })
      expect(ins?.code).toBe('P0932')
    })

    it('Inhaber: weder über Entwurf- noch Nacherfassen-Funktionen', async () => {
      const id = await issued()
      const r = await row(id)
      expect((await owner.rpc('delete_invoice_draft', { p_invoice_id: id })).error?.code).toBe('P0923')
      expect((await owner.rpc('delete_invoice', { p_invoice_id: id })).error?.code).toBe('P0902')
      const save = await owner.rpc('save_invoice', { p_input: { id, updated_at: r.updated_at, tenant_id: tenant, number: 'X', invoice_date: '2026-01-01', recipient: 'x', lines: [{ label: 'a', amount_cents: 1, vat_rate: '10.00' }] } as Json })
      expect(save.error?.code).toBe('P0902')
    })

    it('Gastverknüpfung darf wechseln, Rechnung bleibt sonst gleich', async () => {
      const id = await issued()
      const before = await row(id)
      expect((await service.from('invoices').update({ guest_id: guest }).eq('id', id)).error).toBeNull()
      const after = await row(id)
      expect(after).toMatchObject({ guest_id: guest, number: before.number, total_cents: before.total_cents })
    })

    it('Entwürfe und nacherfasste Rechnungen bleiben wie bisher änderbar', async () => {
      const draft = await newDraft(await newBooking())
      expect((await owner.rpc('delete_invoice_draft', { p_invoice_id: draft })).error).toBeNull()
      const old = await backfill(null, `ALT-${runId}-2`)
      expect((await owner.rpc('delete_invoice', { p_invoice_id: old })).error).toBeNull()
    })
  })

  describe('Abgezogene nacherfasste Rechnungen', () => {
    const setup = async (issue_final: boolean) => {
      const booking = await newBooking()
      const old = await backfill(booking, `AB-${randomUUID().slice(0, 6)}`)
      const final = await newDraft(booking, { kind: 'final', deduction_ids: [old] })
      if (issue_final) expect((await issue(final, { number: `F-${randomUUID().slice(0, 8)}` })).error).toBeNull()
      return { booking, old, final }
    }
    const saveOld = async (id: string, booking: string | null, over: Record<string, unknown> = {}) => {
      const r = await row(id)
      return owner.rpc('save_invoice', {
        p_input: { id, updated_at: r.updated_at, tenant_id: tenant, number: r.number, invoice_date: r.invoice_date, booking_id: booking, recipient: r.recipient, small_business: r.small_business, lines: [{ label: 'Anzahlung', amount_cents: 20000, vat_rate: '10.00' }], ...over } as Json,
      })
    }

    it('Löschen und Änderungen an Beträgen, Positionen, Schalter und Buchung: abgelehnt, Meldung nennt die Schlussrechnung', async () => {
      const { old, final, booking } = await setup(true)
      const number = (await row(final)).number
      const del = await owner.rpc('delete_invoice', { p_invoice_id: old })
      expect(del.error?.code).toBe('P0933')
      expect(del.error?.details).toBe(number)
      for (const over of [
        { lines: [{ label: 'Anzahlung', amount_cents: 1, vat_rate: '10.00' }] },
        { lines: [{ label: 'Anders', amount_cents: 20000, vat_rate: '10.00' }] },
        { lines: [{ label: 'Anzahlung', amount_cents: 20000, vat_rate: '20.00' }] },
        { small_business: true },
      ]) {
        const r = await saveOld(old, booking, over)
        expect(r.error?.code, JSON.stringify(over)).toBe('P0933')
        expect(r.error?.details).toBe(number)
      }
      expect((await saveOld(old, null)).error?.code).toBe('P0933')
    })

    it('Nummer, Datum und Empfänger bleiben änderbar; Betrag der Schlussrechnung unverändert', async () => {
      const { old, final, booking } = await setup(true)
      const before = await row(final)
      const r = await saveOld(old, booking, { number: `AB2-${randomUUID().slice(0, 6)}`, invoice_date: '2026-01-02', recipient: 'Anderer Name' })
      expect(r.error).toBeNull()
      expect(await row(final)).toMatchObject({ total_cents: before.total_cents, updated_at: before.updated_at })
    })

    it('nur von einem Entwurf abgezogen: Ändern und Löschen wie bisher, Entwurf rechnet neu', async () => {
      const { old, final, booking } = await setup(false)
      expect((await saveOld(old, booking, { lines: [{ label: 'Anzahlung', amount_cents: 30000, vat_rate: '10.00' }] })).error).toBeNull()
      expect((await row(final)).total_cents).toBe(60000)
      expect((await owner.rpc('delete_invoice', { p_invoice_id: old })).error).toBeNull()
      expect(await row(final)).toMatchObject({ total_cents: 90000, deduction_removed: true })
    })
  })

  describe('QA: Zusammenspiel mit anderen Funktionen', () => {
    it('BUG-1: Buchung: eine Zusatzkosten-Position entfernen, die in einer ausgestellten Rechnung steht', async () => {
      const booking = await newBooking()
      const { data: b } = await service.from('bookings').select('*').eq('id', booking).single()
      const save = (charges: unknown[], updatedAt: string) =>
        owner.rpc('save_booking', {
          p_input: {
            id: booking,
            updated_at: updatedAt,
            tenant_id: tenant,
            kind: 'booking',
            apartment_id: apartment,
            arrival: b!.arrival,
            planned_departure: b!.planned_departure,
            departure: b!.departure,
            guest_id: guest,
            adults: 1,
            child_ages: [],
            amounts: { nights_cents: 90000, nights_vat_rate: '10.00', charges },
          } as Json,
          p_confirm: true,
        })
      const added = await save([{ label: 'Reinigung', amount_cents: 10000, vat_rate: '20.00' }], b!.updated_at)
      expect(added.error).toBeNull()
      const { data: charge } = await service.from('booking_charges').select('id').eq('booking_id', booking).single()
      const id = await newDraft(booking, {
        lines: [...LINES, { label: 'Reinigung', amount_cents: 10000, vat_rate: '20.00', source_kind: 'charge', source_charge_id: charge!.id }],
      })
      expect((await issue(id)).error).toBeNull()
      const { data: after } = await service.from('bookings').select('updated_at').eq('id', booking).single()
      const removed = await save([], after!.updated_at)
      expect(removed.error).toBeNull()
      const { data: lines } = await service.from('invoice_lines').select('label, amount_cents').eq('invoice_id', id).order('position')
      expect(lines).toEqual([{ label: 'Übernachtung', amount_cents: 90000 }, { label: 'Reinigung', amount_cents: 10000 }])
      // Nur die Verbindung darf sich so lösen, nicht andere Spalten
      expect((await service.from('invoice_lines').update({ label: 'Anders', source_charge_id: null }).eq('invoice_id', id).eq('label', 'Reinigung')).error?.code).toBe('P0932')
    })

    it('Textbaustein löschen, aus dem eine ausgestellte Rechnung stammt', async () => {
      const { data: block, error: be } = await service
        .from('invoice_text_blocks')
        .insert({ tenant_id: tenant, block: 'closing', name: `QA ${randomUUID().slice(0, 6)}`, body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Danke' }] }] } } as never)
        .select('id')
        .single()
      expect(be).toBeNull()
      const blockId = (block as { id: string }).id
      const id = await newDraft(await newBooking(), { texts: { intro: { block_id: null, body: null }, payment: { block_id: null, body: null }, closing: { block_id: blockId, body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Danke' }] }] } } } })
      expect((await issue(id)).error).toBeNull()
      expect((await service.from('invoice_text_blocks').delete().eq('id', blockId)).error).toBeNull()
      expect((await row(id)).closing_block_id).toBeNull()
    })

    it('Gäste zusammenführen und anonymisieren: Rechnung bleibt, Verknüpfung folgt', async () => {
      const newGuest = async () => (await service.from('guests').insert({ tenant_id: tenant, last_name: `M${randomUUID().slice(0, 6)}`, first_name: 'Q', country: 'AT' }).select('id').single()).data!.id
      const [keep, remove] = [await newGuest(), await newGuest()]
      const booking = await newBooking(tenant, apartment, remove)
      const id = await issued(booking)
      await service.from('invoices').update({ guest_id: remove }).eq('id', id)
      const before = await row(id)
      const { error } = await owner.rpc('merge_guests', { p_keep: keep, p_remove: remove, p_choice: {} as Json })
      expect(error).toBeNull()
      expect(await row(id)).toMatchObject({ guest_id: keep, recipient: before.recipient, number: before.number })
    })

    it('Inhaber schreibt direkt in die Tabellen: keine Wirkung', async () => {
      const id = await issued()
      const before = await row(id)
      await owner.from('invoices').update({ total_cents: 1 }).eq('id', id)
      await owner.from('invoices').delete().eq('id', id)
      await owner.from('invoice_lines').delete().eq('invoice_id', id)
      expect(await row(id)).toMatchObject({ total_cents: before.total_cents, origin: 'issued' })
      expect((await service.from('invoice_lines').select('id').eq('invoice_id', id)).data?.length).toBe(1)
    })

    it('PDF einer ausgestellten Rechnung: nicht überschreib- oder löschbar; Mitarbeiter liest, fremder Inhaber nicht', async () => {
      const id = await issued()
      const path = (await row(id)).pdf_path as string
      const original = await (await service.storage.from('invoices').download(path)).data!.text()
      const fake = new Blob(['%PDF-fake'], { type: 'application/pdf' })
      const upsert = await owner.storage.from('invoices').upload(path, fake, { upsert: true, contentType: 'application/pdf' })
      expect(upsert.error).not.toBeNull()
      await owner.storage.from('invoices').remove([path])
      expect(await (await service.storage.from('invoices').download(path)).data!.text()).toBe(original)
      expect((await staff.storage.from('invoices').createSignedUrl(path, 60)).error).toBeNull()
      expect((await ownerB.storage.from('invoices').createSignedUrl(path, 60)).error).not.toBeNull()
      expect((await ownerB.from('invoices').select('id').eq('id', id).maybeSingle()).data).toBeNull()
    })

    it('BUG-2: Nummern mit unsichtbarem Zeichen oder Zeilenumbruch werden abgelehnt', async () => {
      const number = `Z-${runId}`
      await issued(undefined, {}, { number })
      const id = await newDraft(await newBooking())
      const { error } = await issue(id, { number: `${number}\u200b` })
      expect(error?.code).toBe('22023')
      const other = await newDraft(await newBooking())
      expect((await issue(other, { number: `Z\n${runId}` })).error?.code).toBe('22023')
    })
  })

  describe('Kunde löschen', () => {
    const deletable = async (name: string) => {
      const id = await newTenant(name)
      await member(id, ownerUser, 'owner')
      const { data: property } = await service.from('properties').insert({ tenant_id: id, name: 'H', street: 'S', postal_code: '5340', city: 'C', municipality_code: '50330' }).select('id').single()
      const { data: ap } = await service.from('apartments').insert({ tenant_id: id, property_id: property!.id, name: 'T', max_guests: 4, price_cents: 1 }).select('id').single()
      const { data: g } = await service.from('guests').insert({ tenant_id: id, last_name: `G${randomUUID().slice(0, 6)}`, country: 'AT' }).select('id').single()
      return { id, apartment: ap!.id, guest: g!.id }
    }
    const remove = async (id: string, name: string) => {
      await service.from('tenants').update({ status: 'deactivated' }).eq('id', id)
      return admin.rpc('admin_delete_tenant', { p_tenant_id: id, p_confirm_name: name })
    }

    it('ausgestellte Rechnung in der Frist sperrt; nach Ablauf der Frist nicht', async () => {
      const name = `PROJ-42 Sperre ${randomUUID().slice(0, 8)}`
      const t = await deletable(name)
      const booking = await newBooking(t.id, t.apartment, t.guest)
      const current = await newDraft(booking, {}, t.id)
      expect((await issue(current, { number: `K-${runId}` })).error).toBeNull()
      expect((await remove(t.id, name)).error?.code).toBe('P0019')
      expect((await service.from('tenants').select('id').eq('id', t.id).single()).data).not.toBeNull()

      const oldName = `PROJ-42 Alt ${randomUUID().slice(0, 8)}`
      const o = await deletable(oldName)
      const oldBooking = await newBooking(o.id, o.apartment, o.guest)
      const old = await newDraft(oldBooking, {}, o.id)
      const cutoff = new Date().getFullYear() - 8
      expect((await issue(old, { number: `K-${runId}-alt`, invoice_date: `${cutoff}-12-31` })).error).toBeNull()
      expect((await remove(o.id, oldName)).error).toBeNull()
      expect((await service.from('invoices').select('id').eq('id', old).maybeSingle()).data).toBeNull()
      tenants.splice(tenants.indexOf(o.id), 1)
    })
  })

  describe('PROJ-8 Endreinigung (refine 2026-11-05): Umbenennung bestehender Positionen', () => {
    const addCharges = async (bookingId: string, labels: string[]) => {
      const rows = labels.map((label, i) => ({ tenant_id: tenant, booking_id: bookingId, position: i + 1, label, amount_cents: 6000 + i, vat_rate: 10 }))
      const { error } = await service.from('booking_charges').insert(rows as never)
      if (error) throw error
    }
    const charges = async (bookingId: string) =>
      (await service.from('booking_charges').select('position, label, amount_cents, vat_rate').eq('booking_id', bookingId).order('position')).data ?? []

    it('benennt um außer bei ausgestellter Rechnung oder Entwurf; nacherfasste hindern nicht; Betrag, Satz, Platz bleiben; Protokoll „PROJ-8 Endreinigung“', async () => {
      const plain = await newBooking()
      await addCharges(plain, ['Haustier', 'Reinigung', 'reinigung', 'REINIGUNG', 'Reinigung Bettwäsche', 'Zwischenreinigung'])
      const backfilled = await newBooking()
      await addCharges(backfilled, ['Reinigung'])
      await backfill(backfilled, `B-${runId}-endr`)
      const cancelled = await newBooking()
      await addCharges(cancelled, ['Reinigung'])
      expect((await owner.rpc('cancel_booking', { p_booking_id: cancelled, p_reason: 'Krankheit' })).error).toBeNull()
      const withDraft = await newBooking()
      await addCharges(withDraft, ['Reinigung'])
      const draftId = await newDraft(withDraft)
      const withIssued = await newBooking()
      await addCharges(withIssued, ['Reinigung'])
      const issuedId = await issued(withIssued)
      const issuedBefore = await row(issuedId)
      const draftBefore = await row(draftId)

      // Mitarbeiter und Inhaber dürfen die Regel nicht aufrufen
      expect((await owner.rpc('rename_cleaning_charges', { p_tenant_id: tenant })).error?.code).toBe('42501')
      expect((await staff.rpc('rename_cleaning_charges', { p_tenant_id: tenant })).error?.code).toBe('42501')

      const { data: count, error } = await service.rpc('rename_cleaning_charges', { p_tenant_id: tenant })
      expect(error).toBeNull()
      expect(count).toBeGreaterThanOrEqual(5)

      expect(await charges(plain)).toEqual([
        { position: 1, label: 'Haustier', amount_cents: 6000, vat_rate: 10 },
        { position: 2, label: 'Endreinigung', amount_cents: 6001, vat_rate: 10 },
        { position: 3, label: 'Endreinigung', amount_cents: 6002, vat_rate: 10 },
        { position: 4, label: 'Endreinigung', amount_cents: 6003, vat_rate: 10 },
        { position: 5, label: 'Reinigung Bettwäsche', amount_cents: 6004, vat_rate: 10 },
        { position: 6, label: 'Zwischenreinigung', amount_cents: 6005, vat_rate: 10 },
      ])
      expect((await charges(backfilled)).map((c) => c.label)).toEqual(['Endreinigung'])
      expect((await charges(cancelled)).map((c) => c.label)).toEqual(['Endreinigung'])
      expect((await charges(withDraft)).map((c) => c.label)).toEqual(['Reinigung'])
      expect((await charges(withIssued)).map((c) => c.label)).toEqual(['Reinigung'])
      // Rechnungen selbst unverändert
      expect(await row(issuedId)).toEqual(issuedBefore)
      expect(await row(draftId)).toEqual(draftBefore)
      const { data: backfilledLines } = await service.from('invoice_lines').select('label').eq('tenant_id', tenant).eq('label', 'Anzahlung')
      expect(backfilledLines?.length).toBeGreaterThan(0)

      // Protokoll: Urheber ist die Umstellung, keine Person
      const { data: ids } = await service.from('booking_charges').select('id').eq('booking_id', plain).eq('label', 'Endreinigung')
      const { data: log } = await service.from('audit_log').select('actor_id, actor_label, action').in('record_id', (ids ?? []).map((r) => r.id)).eq('action', 'update')
      expect(log).toHaveLength(3)
      expect(log!.every((l) => l.actor_id === null && l.actor_label === 'PROJ-8 Endreinigung' && l.action === 'update')).toBe(true)

      // zweiter Lauf ändert nichts mehr
      expect((await service.rpc('rename_cleaning_charges', { p_tenant_id: tenant })).data).toBe(0)
    })

    it('Mitarbeiter-Buchung erhält die Gebühr der Wohnung als „Endreinigung“ mit 10 %', async () => {
      const { data: apt, error: aptError } = await service.from('apartments').update({ cleaning_fee_cents: 6500 } as never).eq('id', apartment).select('id').single()
      expect(aptError).toBeNull()
      const start = new Date(Date.UTC(2029, 0, 1) + (day += 5) * 86_400_000)
      const iso = (d: Date) => d.toISOString().slice(0, 10)
      const { data, error } = await staff.rpc('save_booking', {
        p_input: {
          tenant_id: tenant,
          kind: 'booking',
          apartment_id: apt!.id,
          arrival: iso(start),
          planned_departure: iso(new Date(start.getTime() + 2 * 86_400_000)),
          departure: iso(new Date(start.getTime() + 2 * 86_400_000)),
          guest_id: guest,
          adults: 1,
          child_ages: [],
        } as Json,
        p_confirm: false,
      })
      expect(error).toBeNull()
      const id = (data as { id: string }).id
      expect(await charges(id)).toEqual([{ position: 1, label: 'Endreinigung', amount_cents: 6500, vat_rate: 10 }])
      await service.from('apartments').update({ cleaning_fee_cents: null } as never).eq('id', apartment)
    })
  })
})
