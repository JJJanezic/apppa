// @vitest-environment node
//
// PROJ-45: Zahlungserfassung gegen „apppa-dev“ (übersprungen ohne .env.local). Prüft die Datenbank: Zahlungsarten je Kunde mit
// Regeln, Erfassen (Inhaber und Mitarbeiter), Ändern/Löschen nur Inhaber, Zahlbarkeit, Provision nur bei Plattform-Buchungen,
// Hinweise vor dem Speichern, Zahlungsstand je Rechnung (auch überfällig, storniert, Gutschrift), Umhängen, Rückzahlung, Belege,
// „Bereits bezahlt“, Löschsperre, Zahlungsliste und Summen, Mandantentrennung, kein Betreiber-Zugriff.
import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { Json } from '../../src/types/database'
import { type Client, hasSupabaseEnv, serviceClient, type TestUser } from './helpers'
import { sharedClient } from './shared-sessions'

const SHA = 'c'.repeat(64)
const BUCKET = 'payment-receipts'
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n')
const LINES = [
  { label: 'Übernachtung', amount_cents: 40000, vat_rate: '10.00', source_kind: 'nights', source_charge_id: null },
  { label: 'Endreinigung', amount_cents: 5000, vat_rate: '10.00', source_kind: null, source_charge_id: null },
]
// Die generierten Typen kennen keine leeren Argumente; die Funktionen erlauben sie (alle Monate, alle Zahlungsarten, keine Suche)
const NONE = null as unknown as string
const today = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Vienna' })

type SaveResult = {
  saved: boolean
  id?: string
  warnings?: { code: string; cents: number; date?: string }[]
  previous_invoice_id?: string | null
  unused_receipt?: string | null
}
type State = { mode: string; status: string | null; open_cents: number; settled_cents: number; balance_cents: number; refunded_cents: number; overdue: boolean }

describe.skipIf(!hasSupabaseEnv)('PROJ-45 Zahlungserfassung', () => {
  let service: Client
  let owner: Client, staff: Client, admin: Client, ownerB: Client
  let ownerUser: TestUser
  const tenants: string[] = []
  let tenant: string, tenantB: string, apartment: string, guest: string
  let transfer: string, cash: string
  const runId = randomUUID().slice(0, 8)
  let day = 0

  const number = () => `Z-${randomUUID().slice(0, 8)}`
  const newBooking = async (source = 'none') => {
    const start = new Date(Date.UTC(2029, 8, 1) + day * 86_400_000)
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
        source,
        amounts: { nights_cents: 40000, nights_vat_rate: '10.00', charges: [{ label: 'Endreinigung', amount_cents: 5000, vat_rate: '10.00' }] },
      } as Json,
      p_confirm: true,
    })
    if (error) throw error
    return (data as { id: string }).id
  }
  // Nacherfasste Rechnung über € 450,00 (optional mit Buchung, eigenen Positionen oder „Bereits bezahlt“)
  const backfilled = async (over: Record<string, unknown> = {}) => {
    const { data, error } = await owner.rpc('save_invoice', {
      p_input: {
        tenant_id: tenant,
        number: number(),
        invoice_date: '2026-01-10',
        recipient: 'Huber Maria',
        lines: [{ label: 'Übernachtung', amount_cents: 45000, vat_rate: '10.00' }],
        ...over,
      } as Json,
    })
    if (error) throw error
    return (data as { id: string }).id
  }
  const draft = async (bookingId: string) => {
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
      } as unknown as Json,
    })
    if (error) throw error
    return data as string
  }
  const uploadPdf = async (bucket: string, tenantId: string) => {
    const path = `${tenantId}/${randomUUID()}.pdf`
    const { error } = await service.storage.from(bucket).upload(path, new Blob(['%PDF-1.4'], { type: 'application/pdf' }), { contentType: 'application/pdf' })
    if (error) throw error
    return path
  }
  const row = async (id: string) => (await service.from('invoices').select('*').eq('id', id).single()).data!
  // Ausgestellte Rechnung (Zahlungsplan in der Fassung)
  const issued = async (schedule: Record<string, unknown> = { due: '2099-01-01', depositCents: null, depositDue: null, remainderCents: null }) => {
    const id = await draft(await newBooking())
    const r = await row(id)
    const { data: b } = await service.from('bookings').select('updated_at').eq('id', r.booking_id!).single()
    const { error } = await service.rpc('issue_invoice', {
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
        snapshot: { kind: 'invoice', schedule },
        pdf_path: await uploadPdf('invoices', tenant),
      } as unknown as Json,
    })
    expect(error).toBeNull()
    return id
  }
  const credit = async (invoiceId: string) => {
    const { data, error } = await service.rpc('issue_credit_note', {
      p_input: {
        invoice_id: invoiceId,
        tenant_id: tenant,
        actor_id: ownerUser.id,
        number: number(),
        invoice_date: '2026-01-20',
        reason: null,
        total_cents: -(await row(invoiceId)).total_cents,
        pdf_sha256: SHA,
        without_logo: false,
        snapshot: { kind: 'invoice', credit: { invoiceId } },
        pdf_path: await uploadPdf('invoices', tenant),
      } as unknown as Json,
    })
    expect(error).toBeNull()
    return data as string
  }
  const paymentInput = (invoiceId: string, over: Record<string, unknown> = {}) => ({
    tenant_id: tenant,
    kind: 'payment',
    invoice_id: invoiceId,
    paid_on: '2026-01-15',
    amount_cents: 10000,
    commission_cents: 0,
    fee_cents: 0,
    method_id: transfer,
    note: null,
    receipt_path: null,
    confirmed: true,
    ...over,
  })
  const record = (client: Client, invoiceId: string, over: Record<string, unknown> = {}) =>
    client.rpc('record_payment', { p_input: paymentInput(invoiceId, over) as unknown as Json })
  const recorded = async (client: Client, invoiceId: string, over: Record<string, unknown> = {}) => {
    const { data, error } = await record(client, invoiceId, over)
    expect(error).toBeNull()
    const result = data as unknown as SaveResult
    expect(result.saved).toBe(true)
    return result.id!
  }
  const payment = async (id: string) => (await service.from('payments').select('*').eq('id', id).single()).data!
  const update = async (client: Client, id: string, over: Record<string, unknown>) => {
    const p = await payment(id)
    return client.rpc('update_payment', {
      p_input: {
        ...paymentInput(p.invoice_id, {
          kind: p.kind,
          paid_on: p.paid_on,
          amount_cents: p.amount_cents,
          commission_cents: p.commission_cents,
          fee_cents: p.fee_cents,
          method_id: p.method_id,
          note: p.note,
          receipt_path: p.receipt_path,
        }),
        id,
        updated_at: p.updated_at,
        ...over,
      } as unknown as Json,
    })
  }
  const state = async (client: Client, invoiceId: string) => {
    const { data, error } = await client.from('invoice_payment_status').select('*').eq('invoice_id', invoiceId).maybeSingle()
    expect(error).toBeNull()
    return data as unknown as State | null
  }

  beforeAll(async () => {
    service = serviceClient()
    const o = await sharedClient('ownerA')
    const s = await sharedClient('staffA')
    owner = o.client
    ownerUser = o.user
    staff = s.client
    admin = (await sharedClient('adminAal2')).client
    const ob = await sharedClient('ownerB')
    ownerB = ob.client
    for (const name of ['A', 'B']) {
      const { data: t, error } = await service.from('tenants').insert({ name: `PROJ-45 Test ${name} ${runId}` }).select('id').single()
      if (error) throw error
      tenants.push(t.id)
    }
    ;[tenant, tenantB] = tenants
    await service.from('memberships').insert([
      { tenant_id: tenant, user_id: ownerUser.id, role: 'owner' },
      { tenant_id: tenant, user_id: s.user.id, role: 'staff' },
      { tenant_id: tenantB, user_id: ob.user.id, role: 'owner' },
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
    const { data: methods } = await service.from('payment_methods').select('id, name').eq('tenant_id', tenant)
    transfer = methods!.find((m) => m.name === 'Überweisung')!.id
    cash = methods!.find((m) => m.name === 'Bar')!.id
  }, 60_000)

  afterAll(async () => {
    if (!service) return
    // Die Kaskade beim Löschen des Kunden nimmt Zahlungen, Zahlungsarten und Rechnungen mit
    for (const id of tenants) {
      for (const bucket of [BUCKET, 'invoices']) {
        const { data } = await service.storage.from(bucket).list(id, { limit: 1000 })
        if (data?.length) await service.storage.from(bucket).remove(data.map((f) => `${id}/${f.name}`))
      }
      const { error } = await service.from('tenants').delete().eq('id', id)
      expect(error).toBeNull()
    }
  }, 60_000)

  describe('Zahlungsarten', () => {
    it('neue Kunden bekommen die sechs Standardarten, Überweisung ist Standard', async () => {
      const { data } = await owner.from('payment_methods').select('name, position, active, is_default').eq('tenant_id', tenant).order('position')
      expect(data).toEqual([
        { name: 'Überweisung', position: 1, active: true, is_default: true },
        { name: 'Bar', position: 2, active: true, is_default: false },
        { name: 'Karte', position: 3, active: true, is_default: false },
        { name: 'PayPal', position: 4, active: true, is_default: false },
        { name: 'über booking.com', position: 5, active: true, is_default: false },
        { name: 'über Airbnb', position: 6, active: true, is_default: false },
      ])
    })

    it('Inhaber legt an (ans Ende), Name je Kunde eindeutig ohne Groß-/Kleinschreibung; Mitarbeiter nicht', async () => {
      const { data, error } = await owner.from('payment_methods').insert({ tenant_id: tenant, name: `Gutschein ${runId}` }).select('position').single()
      expect(error).toBeNull()
      expect(data!.position).toBe(7)
      expect((await owner.from('payment_methods').insert({ tenant_id: tenant, name: 'bar' })).error?.code).toBe('23505')
      expect((await staff.from('payment_methods').insert({ tenant_id: tenant, name: `Staff ${runId}` })).error).not.toBeNull()
    })

    it('Standard und letzte aktive Art bleiben; benutzte Arten lassen sich nicht löschen', async () => {
      expect((await owner.from('payment_methods').update({ active: false }).eq('id', transfer)).error?.code).toBe('P0963')
      expect((await owner.from('payment_methods').delete().eq('id', transfer)).error?.code).toBe('P0963')
      const inv = await backfilled()
      await recorded(owner, inv, { method_id: cash, amount_cents: 100 })
      expect((await owner.from('payment_methods').delete().eq('id', cash)).error?.code).toBe('23503')
      // Deaktivieren geht; dann ist die Art beim Erfassen gesperrt
      expect((await owner.from('payment_methods').update({ active: false }).eq('id', cash)).error).toBeNull()
      expect((await record(owner, inv, { method_id: cash })).error?.code).toBe('P0958')
      expect((await owner.from('payment_methods').update({ active: true }).eq('id', cash)).error).toBeNull()
    })

    it('Reihenfolge und Standard über Funktionen, nur Inhaber; veraltete Liste abgelehnt', async () => {
      const { data } = await owner.from('payment_methods').select('id').eq('tenant_id', tenant).order('position')
      const ids = data!.map((m) => m.id)
      const reversed = [...ids].reverse()
      expect((await owner.rpc('reorder_payment_methods', { p_tenant_id: tenant, p_ids: reversed })).error).toBeNull()
      const { data: after } = await owner.from('payment_methods').select('id').eq('tenant_id', tenant).order('position')
      expect(after!.map((m) => m.id)).toEqual(reversed)
      expect((await owner.rpc('reorder_payment_methods', { p_tenant_id: tenant, p_ids: reversed.slice(1) })).error?.code).toBe('P0964')
      expect((await staff.rpc('reorder_payment_methods', { p_tenant_id: tenant, p_ids: ids })).error?.code).toBe('P0950')
      expect((await owner.rpc('set_default_payment_method', { p_tenant_id: tenant, p_method_id: cash })).error).toBeNull()
      const { data: defaults } = await owner.from('payment_methods').select('id').eq('tenant_id', tenant).eq('is_default', true)
      expect(defaults!.map((m) => m.id)).toEqual([cash])
      expect((await owner.rpc('set_default_payment_method', { p_tenant_id: tenant, p_method_id: transfer })).error).toBeNull()
      expect((await owner.rpc('reorder_payment_methods', { p_tenant_id: tenant, p_ids: ids })).error).toBeNull()
    })
  })

  describe('Erfassen und Zahlungsstand', () => {
    it('Mitarbeiter und Inhaber erfassen; Status offen → teilweise → bezahlt; Hinweis bei Überzahlung und gleicher Zahlung', async () => {
      const inv = await backfilled()
      expect(await state(owner, inv)).toMatchObject({ mode: 'payable', status: 'open', open_cents: 45000 })
      await recorded(staff, inv, { amount_cents: 10000 })
      expect(await state(staff, inv)).toMatchObject({ status: 'partial', open_cents: 35000 })
      // Ohne Bestätigung: Hinweis auf Überzahlung und gleiche Zahlung, nichts gespeichert
      const { data } = await record(owner, inv, { amount_cents: 10000, confirmed: false })
      expect((data as unknown as SaveResult).saved).toBe(false)
      expect((data as unknown as SaveResult).warnings).toEqual([{ code: 'duplicate', cents: 10000, date: '2026-01-15' }])
      const over = (await record(owner, inv, { amount_cents: 40000, paid_on: '2026-01-16', confirmed: false })).data as unknown as SaveResult
      expect(over.warnings).toEqual([{ code: 'overpaid', cents: 5000 }])
      await recorded(owner, inv, { amount_cents: 35000, paid_on: '2026-01-16' })
      expect(await state(owner, inv)).toMatchObject({ status: 'paid', open_cents: 0 })
      await recorded(owner, inv, { amount_cents: 500, paid_on: '2026-01-17' })
      expect(await state(owner, inv)).toMatchObject({ status: 'overpaid', open_cents: -500 })
      // erfasst von: die handelnde Person
      const { data: rows } = await service.from('payments').select('created_by').eq('invoice_id', inv)
      expect(rows!.every((r) => r.created_by)).toBe(true)
    })

    it('lehnt Entwürfe, Altrechnungen ≤ 0, Datum in der Zukunft und ungültige Beträge ab', async () => {
      const d = await draft(await newBooking())
      expect((await record(owner, d)).error?.code).toBe('P0952')
      const negative = await backfilled({ lines: [{ label: 'Gutschrift alt', amount_cents: -5000, vat_rate: '10.00' }] })
      expect((await record(owner, negative)).error?.code).toBe('P0952')
      expect(await state(owner, negative)).toMatchObject({ mode: 'none', status: null })
      const inv = await backfilled()
      expect((await record(owner, inv, { paid_on: '2099-01-01' })).error?.code).toBe('P0955')
      expect((await record(owner, inv, { amount_cents: 0 })).error?.code).toBe('P0956')
      expect((await record(owner, inv, { commission_cents: -1 })).error?.code).toBe('P0956')
    })

    it('Provision und Zahlungsgebühr nur bei Plattform-Buchungen; sie begleichen, der Rechnungsbetrag bleibt', async () => {
      const plain = await backfilled({ booking_id: await newBooking('website') })
      expect((await record(owner, plain, { amount_cents: 42500, commission_cents: 7000, fee_cents: 500 })).error?.code).toBe('P0957')
      const viaAirbnb = await backfilled({ booking_id: await newBooking('airbnb') })
      await recorded(owner, viaAirbnb, { amount_cents: 37500, commission_cents: 7000, fee_cents: 500 })
      expect(await state(owner, viaAirbnb)).toMatchObject({ status: 'paid', open_cents: 0, settled_cents: 45000 })
      expect((await row(viaAirbnb)).total_cents).toBe(45000)
      const viaBooking = await backfilled({ booking_id: await newBooking('booking_com') })
      expect((await record(owner, viaBooking, { amount_cents: 40000, commission_cents: 5000 })).error).toBeNull()
    })

    it('ausgestellte Rechnung: überfällig nach dem Fälligkeitstag, nicht am Tag selbst', async () => {
      const late = await issued({ due: '2026-01-11', depositCents: null, depositDue: null, remainderCents: null })
      expect(await state(owner, late)).toMatchObject({ status: 'open', overdue: true })
      const due = await issued({ due: today(), depositCents: null, depositDue: null, remainderCents: null })
      expect((await state(owner, due))!.overdue).toBe(false)
      const deposit = await issued({ due: '2099-01-01', depositCents: 9000, depositDue: '2026-01-12', remainderCents: 36000 })
      expect((await state(owner, deposit))!.overdue).toBe(true)
      await recorded(owner, deposit, { amount_cents: 9000 })
      expect(await state(owner, deposit)).toMatchObject({ status: 'partial', overdue: false })
    })
  })

  describe('Ändern, Löschen, Rechte', () => {
    it('nur Inhaber ändern und löschen; veralteter Stand abgelehnt', async () => {
      const inv = await backfilled()
      const id = await recorded(staff, inv)
      expect((await update(staff, id, { amount_cents: 20000 })).error?.code).toBe('P0950')
      expect((await staff.rpc('delete_payment', { p_payment_id: id })).error?.code).toBe('P0950')
      expect((await update(owner, id, { amount_cents: 20000, updated_at: '2020-01-01T00:00:00Z' })).error?.code).toBe('P0960')
      expect((await update(owner, id, { amount_cents: 20000, note: 'Verwendungszweck 4711' })).error).toBeNull()
      expect(await payment(id)).toMatchObject({ amount_cents: 20000, note: 'Verwendungszweck 4711' })
      const { data } = await owner.rpc('delete_payment', { p_payment_id: id })
      expect(data).toMatchObject({ invoice_id: inv })
      expect((await service.from('payments').select('id').eq('id', id)).data).toEqual([])
    })

    it('kein direktes Schreiben in die Tabelle, auch nicht für Inhaber', async () => {
      const inv = await backfilled()
      const { error } = await owner.from('payments').insert({ tenant_id: tenant, invoice_id: inv, kind: 'payment', paid_on: '2026-01-15', amount_cents: 100, method_id: transfer })
      expect(error).not.toBeNull()
    })

    it('fremder Kunde und Betreiber sehen keine Zahlungen und können nicht erfassen', async () => {
      const inv = await backfilled()
      await recorded(owner, inv)
      expect((await ownerB.from('payments').select('id').eq('invoice_id', inv)).data).toEqual([])
      expect((await admin.from('payments').select('id').eq('invoice_id', inv)).data).toEqual([])
      expect((await admin.from('payment_methods').select('id').eq('tenant_id', tenant)).data).toEqual([])
      expect((await admin.from('invoice_payment_status').select('invoice_id').eq('invoice_id', inv)).data).toEqual([])
      expect((await record(ownerB, inv)).error?.code).toBe('P0951')
      expect((await ownerB.rpc('record_payment', { p_input: { ...paymentInput(inv), tenant_id: tenantB } as unknown as Json })).error?.code).toBe('P0951')
    })

    it('Rechnung mit Zahlungen lässt sich nicht löschen, ohne Zahlungen schon', async () => {
      const inv = await backfilled()
      const id = await recorded(owner, inv)
      expect((await owner.rpc('delete_invoice', { p_invoice_id: inv })).error?.code).toBe('P0961')
      await owner.rpc('delete_payment', { p_payment_id: id })
      expect((await owner.rpc('delete_invoice', { p_invoice_id: inv })).error).toBeNull()
    })
  })

  describe('Storno, Umhängen, Rückzahlung', () => {
    it('stornierte Rechnung: keine neuen Zahlungen, Guthaben ohne Provision; Rückzahlung an der Gutschrift; Umhängen', async () => {
      const inv = await issued()
      const first = await recorded(owner, inv, { amount_cents: 30000 })
      const second = await recorded(owner, inv, { amount_cents: 15000, paid_on: '2026-01-16' })
      const cn = await credit(inv)
      expect((await record(owner, inv)).error?.code).toBe('P0953')
      expect(await state(owner, inv)).toMatchObject({ mode: 'cancelled', balance_cents: 45000 })
      expect(await state(owner, cn)).toMatchObject({ mode: 'credit', balance_cents: 45000, refunded_cents: 0 })
      // Rückzahlung nur an der Gutschrift, ohne Provision; Hinweis über dem Guthaben
      expect((await record(owner, inv, { kind: 'refund' })).error?.code).toBe('P0954')
      expect((await record(owner, cn, { kind: 'refund', commission_cents: 100 })).error?.code).toBe('P0956')
      const tooMuch = (await record(owner, cn, { kind: 'refund', amount_cents: 50000, confirmed: false })).data as unknown as SaveResult
      expect(tooMuch.warnings).toEqual([{ code: 'refundOver', cents: 5000 }])
      await recorded(owner, cn, { kind: 'refund', amount_cents: 15000 })
      expect(await state(owner, cn)).toMatchObject({ balance_cents: 30000, refunded_cents: 15000 })
      // Umhängen auf die neue, korrigierte Rechnung; die Zahlung an der stornierten Rechnung bleibt änderbar
      const corrected = await backfilled()
      const moved = (await update(owner, first, { invoice_id: corrected })).data as unknown as SaveResult
      expect(moved).toMatchObject({ saved: true, previous_invoice_id: inv })
      expect(await state(owner, corrected)).toMatchObject({ status: 'partial', open_cents: 15000 })
      expect(await state(owner, inv)).toMatchObject({ balance_cents: 0 })
      expect((await update(owner, second, { note: 'korrigiert' })).error).toBeNull()
      // Zurück auf die stornierte Rechnung geht nicht
      expect((await update(owner, first, { invoice_id: inv })).error?.code).toBe('P0953')
      // Nach dem Umhängen ist das Guthaben aufgebraucht: die Gutschrift gilt als erstattet
      expect(await state(owner, cn)).toMatchObject({ balance_cents: 0, refunded_cents: 15000 })
    })

    it('Umhängen mit Provision auf eine Rechnung ohne Plattform-Buchung wird abgelehnt', async () => {
      const viaAirbnb = await backfilled({ booking_id: await newBooking('airbnb') })
      const id = await recorded(owner, viaAirbnb, { amount_cents: 40000, commission_cents: 5000 })
      const plain = await backfilled()
      expect((await update(owner, id, { invoice_id: plain })).error?.code).toBe('P0957')
      expect((await update(owner, id, { invoice_id: plain, commission_cents: 0 })).error).toBeNull()
    })

    it('Umhängen: Suche nach zahlbaren Rechnungen, gleiche Buchung zuerst, ohne stornierte und Gutschriften (nur Inhaber)', async () => {
      const booking = await newBooking('airbnb')
      const same = await backfilled({ booking_id: booking, number: `${runId}-SUCH-1` })
      await backfilled({ number: `${runId}-SUCH-2` })
      const { data, error } = await owner.rpc('search_payable_invoices', { p_tenant_id: tenant, p_query: `${runId}-SUCH`, p_booking_id: booking, p_limit: 20 })
      expect(error).toBeNull()
      expect(data![0]).toMatchObject({ id: same, platform: true, open_cents: 45000 })
      expect(data!).toHaveLength(2)
      expect((await staff.rpc('search_payable_invoices', { p_tenant_id: tenant, p_query: '', p_booking_id: NONE, p_limit: 20 })).error?.code).toBe('P0950')
    })
  })

  describe('Belege, „Bereits bezahlt“, Zahlungsliste', () => {
    it('Mitarbeiter laden einen Beleg in den eigenen Ordner; fremde Kunden lesen ihn nicht; fehlende Belege abgelehnt', async () => {
      const path = `${tenant}/${randomUUID()}.pdf`
      expect((await staff.storage.from(BUCKET).upload(path, PDF, { contentType: 'application/pdf' })).error).toBeNull()
      expect((await ownerB.storage.from(BUCKET).upload(`${tenant}/${randomUUID()}.pdf`, PDF, { contentType: 'application/pdf' })).error).not.toBeNull()
      const inv = await backfilled()
      expect((await record(staff, inv, { receipt_path: `${tenant}/${randomUUID()}.pdf` })).error?.code).toBe('P0959')
      const id = await recorded(staff, inv, { receipt_path: path })
      expect((await staff.storage.from(BUCKET).createSignedUrl(path, 60)).error).toBeNull()
      expect((await ownerB.storage.from(BUCKET).createSignedUrl(path, 60)).error).not.toBeNull()
      // Beleg an zwei Zahlungen geht nicht; Ersetzen meldet den alten Beleg zum Löschen
      expect((await record(owner, inv, { receipt_path: path, paid_on: '2026-01-02' })).error?.code).toBe('P0959')
      const replaced = (await update(owner, id, { receipt_path: null })).data as unknown as SaveResult
      expect(replaced.unused_receipt).toBe(path)
    })

    it('„Bereits bezahlt“: Rechnung und Zahlung über den vollen Betrag in einem Schritt, mit Provision bei Plattform-Buchung', async () => {
      const inv = await backfilled({ already_paid: { paid_on: '2026-01-10', method_id: transfer, commission_cents: 0, fee_cents: 0 } })
      expect(await state(owner, inv)).toMatchObject({ status: 'paid' })
      const viaBooking = await backfilled({
        booking_id: await newBooking('booking_com'),
        already_paid: { paid_on: '2026-01-10', method_id: transfer, commission_cents: 6000, fee_cents: 0 },
      })
      const { data } = await service.from('payments').select('amount_cents, commission_cents').eq('invoice_id', viaBooking)
      expect(data).toEqual([{ amount_cents: 39000, commission_cents: 6000 }])
      // Ungültige Zahlungsart: weder Rechnung noch Zahlung
      const n = number()
      const { error } = await owner.rpc('save_invoice', {
        p_input: {
          tenant_id: tenant,
          number: n,
          invoice_date: '2026-01-10',
          recipient: 'Huber Maria',
          lines: [{ label: 'Übernachtung', amount_cents: 45000, vat_rate: '10.00' }],
          already_paid: { paid_on: '2026-01-10', method_id: randomUUID(), commission_cents: 0, fee_cents: 0 },
        } as Json,
      })
      expect(error?.code).toBe('P0958')
      expect((await service.from('invoices').select('id').eq('tenant_id', tenant).eq('number', n)).data).toEqual([])
    })

    it('Zahlungsliste und Summen über den Filter, Rückzahlungen abgezogen', async () => {
      const inv = await backfilled({ booking_id: await newBooking('airbnb'), number: `${runId}-LISTE` })
      await recorded(owner, inv, { amount_cents: 20000, commission_cents: 3000, fee_cents: 200, paid_on: '2025-07-03', note: `Liste ${runId}` })
      await recorded(owner, inv, { amount_cents: 1000, paid_on: '2025-07-20', method_id: cash })
      const { data, count } = await owner
        .from('payment_list')
        .select('invoice_number, method_name, amount_cents', { count: 'exact' })
        .eq('tenant_id', tenant)
        .gte('paid_on', '2025-07-01')
        .lt('paid_on', '2025-08-01')
        .order('paid_on', { ascending: false })
      expect(count).toBe(2)
      expect(data![0]).toMatchObject({ invoice_number: `${runId}-LISTE`, method_name: 'Bar', amount_cents: 1000 })
      const { data: totals } = await owner.rpc('payment_list_totals', { p_tenant_id: tenant, p_from: '2025-07-01', p_to: '2025-08-01', p_method_id: NONE, p_query: NONE })
      expect(totals).toEqual([{ received_cents: 21000, commission_cents: 3000, fee_cents: 200 }])
      const { data: byNote } = await owner.rpc('payment_list_totals', { p_tenant_id: tenant, p_from: NONE, p_to: NONE, p_method_id: transfer, p_query: `Liste ${runId}` })
      expect(byNote).toEqual([{ received_cents: 20000, commission_cents: 3000, fee_cents: 200 }])
      expect((await ownerB.rpc('payment_list_totals', { p_tenant_id: tenant, p_from: NONE, p_to: NONE, p_method_id: NONE, p_query: NONE })).data).toEqual([
        { received_cents: 0, commission_cents: 0, fee_cents: 0 },
      ])
    })
  })
})
