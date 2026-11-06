// PROJ-44: Gutschrift zu Rechnung. Prüft die Datenbank: nur der Server stellt aus, höchstens eine Gutschrift je Rechnung (auch
// gleichzeitig), Positionen gespiegelt, unveränderlich, „abgezogen“ nur durch gültige Schlussrechnungen, Entwürfe verlieren den Abzug,
// verrechnete Summe je Buchung für den Filter.
import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { Json } from '../../src/types/database'
import { type Client, hasSupabaseEnv, serviceClient, type TestUser } from './helpers'
import { sharedClient } from './shared-sessions'

const SHA = 'b'.repeat(64)
const LINES = [
  { label: 'Übernachtung', amount_cents: 90000, vat_rate: '10.00', source_kind: 'nights', source_charge_id: null },
  { label: 'Endreinigung', amount_cents: 6000, vat_rate: '10.00', source_kind: null, source_charge_id: null },
]

describe.skipIf(!hasSupabaseEnv)('PROJ-44 Gutschrift zu Rechnung', () => {
  let service: Client
  let owner: Client, staff: Client, admin: Client, ownerB: Client
  let ownerUser: TestUser, staffUser: TestUser
  const tenants: string[] = []
  let tenant: string, apartment: string, guest: string
  const runId = randomUUID().slice(0, 8)
  let day = 0

  const number = () => `G-${randomUUID().slice(0, 8)}`
  const newBooking = async () => {
    const start = new Date(Date.UTC(2029, 6, 1) + day * 86_400_000)
    day += 5
    const iso = (d: Date) => d.toISOString().slice(0, 10)
    const { data, error } = await owner.rpc('save_booking', {
      p_input: {
        tenant_id: tenant,
        kind: 'booking',
        apartment_id: apartment,
        arrival: iso(start),
        planned_departure: iso(new Date(start.getTime() + 3 * 86_400_000)),
        departure: iso(new Date(start.getTime() + 3 * 86_400_000)),
        guest_id: guest,
        adults: 1,
        child_ages: [],
        amounts: { nights_cents: 90000, nights_vat_rate: '10.00', charges: [{ label: 'Endreinigung', amount_cents: 6000, vat_rate: '10.00' }] },
      } as Json,
      p_confirm: true,
    })
    if (error) throw error
    return (data as { id: string }).id
  }
  const newDraft = async (bookingId: string, over: Record<string, unknown> = {}) => {
    const { data, error } = await owner.rpc('save_invoice_draft', {
      p_input: {
        id: null,
        updated_at: null,
        tenant_id: tenant,
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
  const partialDraft = (bookingId: string) =>
    newDraft(bookingId, { kind: 'partial', partial: { mode: 'amount', percent: null, amount_cents: 20000 }, lines: [{ label: 'Anteil', amount_cents: 20000, vat_rate: '10.00' }] })
  const row = async (id: string) => {
    const { data } = await service.from('invoices').select('*').eq('id', id).single()
    return data!
  }
  const upload = async () => {
    const path = `${tenant}/${randomUUID()}.pdf`
    const { error } = await service.storage.from('invoices').upload(path, new Blob(['%PDF-1.4'], { type: 'application/pdf' }), { contentType: 'application/pdf' })
    if (error) throw error
    return path
  }
  const issue = async (id: string) => {
    const r = await row(id)
    const { data: b } = await service.from('bookings').select('updated_at').eq('id', r.booking_id!).single()
    return service.rpc('issue_invoice', {
      p_input: {
        id,
        tenant_id: tenant,
        actor_id: ownerUser.id,
        updated_at: r.updated_at,
        booking_updated_at: b!.updated_at,
        number: number(),
        invoice_date: '2026-01-10',
        small_business: false,
        total_cents: r.total_cents,
        pdf_sha256: SHA,
        without_logo: false,
        snapshot: { kind: r.kind },
        pdf_path: await upload(),
      } as unknown as Json,
    })
  }
  const issued = async (bookingId?: string, over: Record<string, unknown> = {}) => {
    const id = await newDraft(bookingId ?? (await newBooking()), over)
    const { error } = await issue(id)
    expect(error).toBeNull()
    return id
  }
  const creditInput = async (invoiceId: string, over: Record<string, unknown> = {}) => ({
    invoice_id: invoiceId,
    tenant_id: tenant,
    actor_id: ownerUser.id,
    number: number(),
    invoice_date: '2026-01-20',
    reason: 'Falscher Empfänger',
    total_cents: -(await row(invoiceId)).total_cents,
    pdf_sha256: SHA,
    without_logo: false,
    snapshot: { kind: 'invoice', credit: { invoiceId } },
    pdf_path: await upload(),
    ...over,
  })
  const credit = async (invoiceId: string, over: Record<string, unknown> = {}) =>
    service.rpc('issue_credit_note', { p_input: (await creditInput(invoiceId, over)) as unknown as Json })
  const credited = async (invoiceId: string) => {
    const { data, error } = await credit(invoiceId)
    expect(error).toBeNull()
    return data as string
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
    const { data: t, error } = await service.from('tenants').insert({ name: `PROJ-44 Test ${runId}` }).select('id').single()
    if (error) throw error
    tenant = t.id
    tenants.push(tenant)
    await service.from('memberships').insert([
      { tenant_id: tenant, user_id: ownerUser.id, role: 'owner' },
      { tenant_id: tenant, user_id: staffUser.id, role: 'staff' },
    ])
    const { data: property } = await service
      .from('properties')
      .insert({ tenant_id: tenant, name: `Haus ${runId}`, street: 'Seeweg 12', postal_code: '5340', city: 'St. Gilgen', municipality_code: '50330' })
      .select('id')
      .single()
    const { data: ap } = await service.from('apartments').insert({ tenant_id: tenant, property_id: property!.id, name: `Top ${runId}`, max_guests: 4, price_cents: 10000 }).select('id').single()
    apartment = ap!.id
    const { data: g } = await service.from('guests').insert({ tenant_id: tenant, last_name: `Huber ${runId}`, first_name: 'Maria', country: 'AT' }).select('id').single()
    guest = g!.id
  })

  afterAll(async () => {
    // Die Kaskade beim Löschen des Kunden nimmt Rechnungen und Gutschriften mit
    for (const id of tenants) {
      const { error } = await service.from('tenants').delete().eq('id', id)
      expect(error).toBeNull()
    }
  })

  describe('Ausstellen', () => {
    it('legt die Gutschrift an: gespiegelte Positionen, Verweis, Grund, Empfänger und Buchung aus der Rechnung, Protokoll mit Person', async () => {
      const invoice = await issued()
      const input = await creditInput(invoice, { reason: '  Falscher\n Empfänger ' })
      const { data, error } = await service.rpc('issue_credit_note', { p_input: input as unknown as Json })
      expect(error).toBeNull()
      const c = await row(data as string)
      const r = await row(invoice)
      expect(c).toMatchObject({
        origin: 'issued',
        kind: 'credit_note',
        number: input.number,
        invoice_date: '2026-01-20',
        credited_invoice_id: invoice,
        credit_reason: 'Falscher Empfänger',
        total_cents: -96000,
        booking_id: r.booking_id,
        guest_id: r.guest_id,
        recipient_name: 'Maria Huber',
        small_business: r.small_business,
        issued_by: ownerUser.id,
        pdf_path: input.pdf_path,
      })
      const { data: lines } = await service.from('invoice_lines').select('position, label, amount_cents, vat_rate, source_kind, source_charge_id').eq('invoice_id', c.id).order('position')
      expect(lines).toEqual([
        { position: 1, label: 'Übernachtung', amount_cents: -90000, vat_rate: 10, source_kind: null, source_charge_id: null },
        { position: 2, label: 'Endreinigung', amount_cents: -6000, vat_rate: 10, source_kind: null, source_charge_id: null },
      ])
      // Die Rechnung selbst bleibt unverändert
      expect(await row(invoice)).toEqual(r)
      const { data: log } = await service.from('audit_log').select('actor_id').eq('record_id', c.id).eq('action', 'insert').limit(1)
      expect(log?.[0]?.actor_id).toBe(ownerUser.id)
    })

    it('ohne Grund: kein Grund gespeichert', async () => {
      const id = await (async () => {
        const { data, error } = await credit(await issued(), { reason: '   ' })
        expect(error).toBeNull()
        return data as string
      })()
      expect((await row(id)).credit_reason).toBeNull()
    })

    it('nur der Server: Inhaber, Mitarbeiter, Betreiber und fremder Inhaber dürfen die Funktion nicht aufrufen', async () => {
      const invoice = await issued()
      const input = (await creditInput(invoice)) as unknown as Json
      for (const client of [owner, staff, admin, ownerB]) {
        const { error } = await client.rpc('issue_credit_note', { p_input: input })
        expect(error?.code).toBe('42501')
      }
      const { count } = await service.from('invoices').select('id', { count: 'exact', head: true }).eq('credited_invoice_id', invoice)
      expect(count).toBe(0)
    })

    it('Mitarbeiter als handelnde Person und deaktivierter Kunde: abgelehnt', async () => {
      const invoice = await issued()
      expect((await credit(invoice, { actor_id: staffUser.id })).error?.code).toBe('P0901')
      await service.from('tenants').update({ status: 'deactivated' }).eq('id', tenant)
      const { error } = await credit(invoice)
      await service.from('tenants').update({ status: 'active' }).eq('id', tenant)
      expect(error?.code).toBe('P0016')
    })

    it('keine Gutschrift zu Entwurf, nacherfasster Rechnung oder Gutschrift', async () => {
      const draft = await newDraft(await newBooking())
      expect((await credit(draft, { total_cents: 0 })).error?.code).toBe('P0902')
      const { data: b } = await owner.rpc('save_invoice', {
        p_input: { tenant_id: tenant, number: number(), invoice_date: '2026-01-05', recipient: 'Huber Maria', lines: [{ label: 'Alt', amount_cents: 1000, vat_rate: '10.00' }] } as Json,
      })
      expect((await credit((b as { id: string }).id, { total_cents: -1000 })).error?.code).toBe('P0902')
      const note = await credited(await issued())
      expect((await credit(note, { total_cents: 96000 })).error?.code).toBe('P0902')
    })

    it('kein zweites Mal: Meldung nennt die vorhandene Gutschrift', async () => {
      const invoice = await issued()
      const first = await credited(invoice)
      const { error } = await credit(invoice)
      expect(error?.code).toBe('P0934')
      expect(error?.details).toBe(first)
    })

    it('gleichzeitig: genau eine Gutschrift', async () => {
      const invoice = await issued()
      const [a, b] = await Promise.all([creditInput(invoice), creditInput(invoice)])
      const results = await Promise.all([a, b].map((p) => service.rpc('issue_credit_note', { p_input: p as unknown as Json })))
      expect(results.filter((r) => r.error === null)).toHaveLength(1)
      expect(results.find((r) => r.error)?.error?.code).toBe('P0934')
      const { count } = await service.from('invoices').select('id', { count: 'exact', head: true }).eq('credited_invoice_id', invoice)
      expect(count).toBe(1)
    })

    it('Datum vor der Rechnung oder in der Zukunft, falscher Betrag, vergebene Nummer, zu langer Grund: abgelehnt', async () => {
      const invoice = await issued()
      expect((await credit(invoice, { invoice_date: '2026-01-09' })).error?.code).toBe('P0906')
      expect((await credit(invoice, { invoice_date: '2099-01-01' })).error?.code).toBe('P0906')
      expect((await credit(invoice, { total_cents: -1 })).error?.code).toBe('P0903')
      expect((await credit(invoice, { number: (await row(invoice)).number })).error?.code).toBe('P0904')
      expect((await credit(invoice, { reason: 'x'.repeat(301) })).error?.code).toBe('22023')
      expect((await credit(invoice, { number: 'G​1' })).error?.code).toBe('22023')
      expect((await credit(invoice, { invoice_date: '2026-01-10', reason: 'x'.repeat(300) })).error).toBeNull()
    })

    it('PDF fehlt oder ist schon verwendet: abgelehnt', async () => {
      const invoice = await issued()
      expect((await credit(invoice, { pdf_path: `${tenant}/${randomUUID()}.pdf` })).error?.code).toBe('P0907')
      expect((await credit(invoice, { pdf_path: (await row(invoice)).pdf_path })).error?.code).toBe('P0907')
    })
  })

  describe('Unveränderlich', () => {
    it('Gutschrift, ihre Positionen und die stornierte Rechnung: Ändern und Löschen abgelehnt, auch mit Systemrechten', async () => {
      const invoice = await issued()
      const note = await credited(invoice)
      expect((await service.from('invoices').update({ credit_reason: 'anders' }).eq('id', note)).error?.code).toBe('P0932')
      expect((await service.from('invoices').update({ credited_invoice_id: null }).eq('id', note)).error?.code).toBe('P0932')
      expect((await service.from('invoices').delete().eq('id', note)).error?.code).toBe('P0932')
      expect((await service.from('invoice_lines').update({ amount_cents: 1 }).eq('invoice_id', note)).error?.code).toBe('P0932')
      expect((await service.from('invoice_lines').insert({ tenant_id: tenant, invoice_id: note, position: 9, label: 'Neu', amount_cents: 1, vat_rate: 10 })).error?.code).toBe('P0932')
      expect((await service.from('invoices').update({ total_cents: 0 }).eq('id', invoice)).error?.code).toBe('P0932')
      // Direkt angelegte Gutschrift ohne die Funktion: nur über den Server
      expect((await owner.from('invoices').insert({ tenant_id: tenant, number: number(), invoice_date: '2026-01-20', recipient: 'X', kind: 'credit_note', origin: 'issued' } as never)).error).not.toBeNull()
    })
  })

  describe('Teil- und Schlussrechnungen', () => {
    it('abgezogene Teilrechnung erst nach Storno der Schlussrechnung; danach wieder abziehbar und selbst stornierbar', async () => {
      const booking = await newBooking()
      const partial = await partialDraft(booking)
      expect((await issue(partial)).error).toBeNull()
      const final = await newDraft(booking, { kind: 'final', deduction_ids: [partial] })
      expect((await issue(final)).error).toBeNull()

      const blocked = await credit(partial)
      expect(blocked.error?.code).toBe('P0935')
      expect(blocked.error?.details).toBe((await row(final)).number)

      // Schlussrechnung stornieren: Gutschriftsbetrag = −Rechnungsbetrag; Abzug bleibt als Geschichte
      expect((await row(final)).total_cents).toBe(76000)
      await credited(final)
      const { count } = await service.from('invoice_deductions').select('invoice_id', { count: 'exact', head: true }).eq('invoice_id', final)
      expect(count).toBe(1)

      // Neue Schlussrechnung zieht dieselbe Teilrechnung wieder ab
      const final2 = await newDraft(booking, { kind: 'final', deduction_ids: [partial] })
      expect((await issue(final2)).error).toBeNull()
      expect((await credit(partial)).error?.code).toBe('P0935')
      await credited(final2)
      // Jetzt lässt sich die Teilrechnung selbst stornieren
      await credited(partial)
    })

    it('nacherfasste Rechnung einer stornierten Schlussrechnung: wieder änderbar und löschbar', async () => {
      const booking = await newBooking()
      const { data: b } = await owner.rpc('save_invoice', {
        p_input: { tenant_id: tenant, number: number(), invoice_date: '2026-01-05', booking_id: booking, recipient: 'Huber Maria', lines: [{ label: 'Anzahlung', amount_cents: 20000, vat_rate: '10.00' }] } as Json,
      })
      const old = (b as { id: string }).id
      const final = await newDraft(booking, { kind: 'final', deduction_ids: [old] })
      expect((await issue(final)).error).toBeNull()
      expect((await owner.rpc('delete_invoice', { p_invoice_id: old })).error?.code).toBe('P0933')
      await credited(final)
      expect((await owner.rpc('delete_invoice', { p_invoice_id: old })).error).toBeNull()
    })

    it('Schlussrechnung darf keine stornierte und keine schon gültig abgezogene Teilrechnung abziehen (am Formular vorbei)', async () => {
      const booking = await newBooking()
      const partial = await partialDraft(booking)
      expect((await issue(partial)).error).toBeNull()
      // Summenregel beim Anlegen (PROJ-40): die erste Schlussrechnung klein halten, damit die zweite angelegt werden kann
      const small = [{ label: 'Übernachtung', amount_cents: 30000, vat_rate: '10.00', source_kind: null, source_charge_id: null }]
      const finalA = await newDraft(booking, { kind: 'final', deduction_ids: [partial], lines: small })
      const finalB = await newDraft(booking, { kind: 'final', deduction_ids: [partial], lines: small })
      expect((await issue(finalA)).error).toBeNull()
      expect((await issue(finalB)).error?.code).toBe('P0930')

      const booking2 = await newBooking()
      const partial2 = await partialDraft(booking2)
      expect((await issue(partial2)).error).toBeNull()
      await credited(partial2)
      // Speichern mit Abzug einer stornierten Teilrechnung geht nur am Formular vorbei; Ausstellen lehnt ab
      const final2 = await newDraft(booking2, { kind: 'final', deduction_ids: [partial2] })
      expect((await issue(final2)).error?.code).toBe('P0930')
    })

    it('offener Entwurf zieht die stornierte Teilrechnung ab: Abzug fällt weg, Hinweis, Betrag neu', async () => {
      const booking = await newBooking()
      const partial = await partialDraft(booking)
      expect((await issue(partial)).error).toBeNull()
      const draft = await newDraft(booking, { kind: 'final', deduction_ids: [partial] })
      expect((await row(draft)).total_cents).toBe(76000)
      await credited(partial)
      expect(await row(draft)).toMatchObject({ deduction_removed: true, total_cents: 96000 })
      const { count } = await service.from('invoice_deductions').select('invoice_id', { count: 'exact', head: true }).eq('invoice_id', draft)
      expect(count).toBe(0)
    })
  })

  describe('Verrechnet je Buchung (Filter „ohne/mit Rechnung“)', () => {
    it('Rechnung + Gutschrift = 0; Entwürfe zählen nicht; Filter liefert die Buchung wieder als „ohne Rechnung“', async () => {
      const booking = await newBooking()
      const filter = async (op: 'eq' | 'neq') => {
        const { data, error } = await owner.from('bookings').select('id, billed_cents').eq('tenant_id', tenant).eq('id', booking)[op]('billed_cents', 0)
        expect(error).toBeNull()
        return data!.map((r) => r.id)
      }
      expect(await filter('eq')).toEqual([booking])
      // Entwurf zuerst (Summenregel beim Anlegen), er zählt nicht als verrechnet
      await newDraft(booking, { lines: [{ label: 'Rest', amount_cents: 1000, vat_rate: '10.00', source_kind: null, source_charge_id: null }] })
      const invoice = await issued(booking)
      expect(await filter('neq')).toEqual([booking])
      const { data } = await owner.from('bookings').select('billed_cents').eq('id', booking).single()
      expect(data!.billed_cents).toBe(96000)
      await credited(invoice)
      expect(await filter('eq')).toEqual([booking])
      expect(await filter('neq')).toEqual([])
      // Fremder Inhaber sieht die Buchung nicht
      const { data: foreign } = await ownerB.from('bookings').select('billed_cents').eq('id', booking)
      expect(foreign).toEqual([])
    })
  })
})
