// @vitest-environment node
//
// PROJ-43: Rechnungsübersicht gegen „apppa-dev“ (übersprungen ohne .env.local). Prüft invoice_list_page (Filter Status,
// Zahlung, Jahr, Betrag, Suche; Reihenfolge; Blättern; Buchungsnummer) und invoice_list_totals (Anzahl, Rechnungsbetrag ohne
// Entwürfe, Bezahlt mit Rückzahlungen an Gutschriften, Offen nur positiv), die gleiche Zahlungsregel wie die Lesesicht
// invoice_payment_status (PROJ-45), Mitarbeiter, fremder Inhaber, fremder Kunde.
import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { Json } from '../../src/types/database'
import { type Client, hasSupabaseEnv, serviceClient, type TestUser } from './helpers'
import { sharedClient } from './shared-sessions'

const SHA = 'd'.repeat(64)
const LINES = [
  { label: 'Übernachtung', amount_cents: 40000, vat_rate: '10.00', source_kind: 'nights', source_charge_id: null },
  { label: 'Endreinigung', amount_cents: 5000, vat_rate: '10.00', source_kind: null, source_charge_id: null },
]
const NO_DUE = { due: '2099-01-01', depositCents: null, depositDue: null, remainderCents: null }
const OVERDUE = { due: '2020-01-01', depositCents: null, depositDue: null, remainderCents: null }

type Filters = { p_pattern: string | null; p_year: number | null; p_status: string | null; p_payment: string | null; p_min_cents: number | null; p_max_cents: number | null }
const ALL: Filters = { p_pattern: null, p_year: null, p_status: null, p_payment: null, p_min_cents: null, p_max_cents: null }
type PageRow = { id: string; number: string | null; invoice_date: string; booking_number: string | null }

describe.skipIf(!hasSupabaseEnv)('PROJ-43 Rechnungsübersicht', () => {
  let service: Client
  let owner: Client, staff: Client, ownerB: Client
  let ownerUser: TestUser
  const tenants: string[] = []
  let tenant: string, tenantB: string, apartment: string, guest: string, transfer: string
  const runId = randomUUID().slice(0, 8)
  let day = 0
  const ids: Record<string, string> = {}

  const number = (prefix = 'L') => `${prefix}-${randomUUID().slice(0, 8)}`
  const newBooking = async () => {
    const start = new Date(Date.UTC(2029, 9, 1) + day * 86_400_000)
    day += 5
    const iso = (d: Date) => d.toISOString().slice(0, 10)
    const end = iso(new Date(start.getTime() + 3 * 86_400_000))
    const { data, error } = await owner.rpc('save_booking', {
      p_input: {
        tenant_id: tenant,
        kind: 'booking',
        apartment_id: apartment,
        arrival: iso(start),
        planned_departure: end,
        departure: end,
        guest_id: guest,
        adults: 1,
        child_ages: [],
        source: 'none',
        amounts: { nights_cents: 40000, nights_vat_rate: '10.00', charges: [{ label: 'Endreinigung', amount_cents: 5000, vat_rate: '10.00' }] },
      } as Json,
      p_confirm: true,
    })
    if (error) throw error
    return (data as { id: string }).id
  }
  const backfilled = async (cents: number, over: Record<string, unknown> = {}) => {
    const { data, error } = await owner.rpc('save_invoice', {
      p_input: {
        tenant_id: tenant,
        number: number('N'),
        invoice_date: '2026-02-10',
        recipient: 'Huber Maria',
        lines: [{ label: 'Übernachtung', amount_cents: cents, vat_rate: '10.00' }],
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
  const uploadPdf = async () => {
    const path = `${tenant}/${randomUUID()}.pdf`
    const { error } = await service.storage.from('invoices').upload(path, new Blob(['%PDF-1.4'], { type: 'application/pdf' }), { contentType: 'application/pdf' })
    if (error) throw error
    return path
  }
  const row = async (id: string) => (await service.from('invoices').select('*').eq('id', id).single()).data!
  const issued = async (schedule: Record<string, unknown>) => {
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
        number: number('A'),
        invoice_date: '2026-01-10',
        small_business: false,
        total_cents: r.total_cents,
        pdf_sha256: SHA,
        without_logo: false,
        snapshot: { kind: 'invoice', schedule },
        pdf_path: await uploadPdf(),
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
        number: number('G'),
        invoice_date: '2026-01-20',
        reason: null,
        total_cents: -(await row(invoiceId)).total_cents,
        pdf_sha256: SHA,
        without_logo: false,
        snapshot: { kind: 'invoice', credit: { invoiceId } },
        pdf_path: await uploadPdf(),
      } as unknown as Json,
    })
    expect(error).toBeNull()
    return data as string
  }
  const pay = async (invoiceId: string, cents: number, kind: 'payment' | 'refund' = 'payment') => {
    const { data, error } = await owner.rpc('record_payment', {
      p_input: {
        tenant_id: tenant,
        kind,
        invoice_id: invoiceId,
        paid_on: '2026-02-15',
        amount_cents: cents,
        commission_cents: 0,
        fee_cents: 0,
        method_id: transfer,
        note: null,
        receipt_path: null,
        confirmed: true,
      } as unknown as Json,
    })
    expect(error).toBeNull()
    expect((data as { saved: boolean }).saved).toBe(true)
  }
  const totals = async (client: Client, filters: Partial<Filters> = {}, tenantId = tenant) => {
    const { data, error } = await client.rpc('invoice_list_totals', { p_tenant_id: tenantId, ...ALL, ...filters } as never)
    expect(error).toBeNull()
    const t = (Array.isArray(data) ? data[0] : data) as { invoice_count: number; total_cents: number; paid_cents: number; open_cents: number }
    return { count: Number(t.invoice_count), total: Number(t.total_cents), paid: Number(t.paid_cents), open: Number(t.open_cents) }
  }
  const sums = async (client: Client, filters: Partial<Filters> = {}) => {
    const { total, paid, open } = await totals(client, filters)
    return { total, paid, open }
  }
  const page = async (client: Client, filters: Partial<Filters> = {}, offset = 0, limit = 50, tenantId = tenant) => {
    const { data, error } = await client.rpc('invoice_list_page', { p_tenant_id: tenantId, ...ALL, ...filters, p_offset: offset, p_limit: limit } as never)
    expect(error).toBeNull()
    return (data ?? []) as unknown as PageRow[]
  }
  const idsOf = (rows: PageRow[]) => rows.map((r) => r.id).sort()
  const names = (...keys: string[]) => keys.map((k) => ids[k]).sort()

  beforeAll(async () => {
    service = serviceClient()
    const o = await sharedClient('ownerA')
    const s = await sharedClient('staffA')
    owner = o.client
    ownerUser = o.user
    staff = s.client
    const ob = await sharedClient('ownerB')
    ownerB = ob.client
    for (const name of ['A', 'B']) {
      const { data: t, error } = await service.from('tenants').insert({ name: `PROJ-43 Test ${name} ${runId}` }).select('id').single()
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

    // Bestand (Beträge in Cent):
    // draft   Entwurf 45.000
    // paid    ausgestellt 45.000, voll bezahlt, dann storniert (credit) mit Rückzahlung 10.000 an der Gutschrift
    // open    ausgestellt 45.000, überfällig, ohne Zahlung
    // over    nacherfasst 45.000, 50.000 bezahlt (überzahlt)
    // part    nacherfasst 45.000, 10.000 bezahlt (teilweise); Nummer mit „_“ und „%“
    // minus   nacherfasst -10.000 aus 2025 (kein Zahlungsstand)
    ids.draft = await draft(await newBooking())
    ids.paid = await issued(NO_DUE)
    await pay(ids.paid, 45000)
    ids.credit = await credit(ids.paid)
    await pay(ids.credit, 10000, 'refund')
    ids.open = await issued(OVERDUE)
    ids.over = await backfilled(45000)
    await pay(ids.over, 50000)
    ids.part = await backfilled(45000, { number: `X_1%-${runId}` })
    await pay(ids.part, 10000)
    ids.minus = await backfilled(-10000, { invoice_date: '2025-06-01' })
    // Gegenprobe zum Suchmuster: „XA1%“ darf „X\_1“ nicht treffen
    ids.decoy = await backfilled(45000, { number: `XA1Y-${runId}`, invoice_date: '2024-03-01' })
    await pay(ids.decoy, 45000)
  }, 120_000)

  afterAll(async () => {
    if (!service) return
    for (const id of tenants) {
      for (const bucket of ['payment-receipts', 'invoices']) {
        const { data } = await service.storage.from(bucket).list(id, { limit: 1000 })
        if (data?.length) await service.storage.from(bucket).remove(data.map((f) => `${id}/${f.name}`))
      }
      const { error } = await service.from('tenants').delete().eq('id', id)
      expect(error).toBeNull()
    }
  }, 60_000)

  it('Seite: alle Rechnungen inkl. Entwurf, Datum absteigend, Buchungsnummer, Blättern; Anzahl über alle Seiten', async () => {
    const rows = await page(owner)
    expect(rows).toHaveLength(8)
    const dates = rows.map((r) => r.invoice_date)
    expect(dates).toEqual([...dates].sort().reverse())
    expect(rows.find((r) => r.id === ids.open)!.booking_number).toMatch(/\S/)
    expect(rows.find((r) => r.id === ids.over)!.booking_number).toBeNull()
    // Blättern: 3 je Seite, dritte Seite mit dem Rest; hinter dem Ende leer, Anzahl bleibt
    const pages = [...(await page(owner, {}, 0, 3)), ...(await page(owner, {}, 3, 3)), ...(await page(owner, {}, 6, 3))]
    expect(pages.map((r) => r.id)).toEqual(rows.map((r) => r.id))
    expect(await page(owner, {}, 50, 50)).toEqual([])
    expect((await totals(owner)).count).toBe(8)
  })

  it('Statusfilter: je Wert genau die passenden Rechnungen', async () => {
    const by = async (p_status: string) => idsOf(await page(owner, { p_status }))
    expect(await by('draft')).toEqual(names('draft'))
    expect(await by('issued')).toEqual(names('open'))
    expect(await by('backfilled')).toEqual(names('over', 'part', 'minus', 'decoy'))
    expect(await by('cancelled')).toEqual(names('paid'))
    expect(await by('credit_note')).toEqual(names('credit'))
  })

  it('Zahlungsfilter: noch nicht bezahlt, je Status, überfällig; Entwurf, storniert, Gutschrift und Betrag ≤ 0 ohne Status', async () => {
    const by = async (p_payment: string) => idsOf(await page(owner, { p_payment }))
    expect(await by('unpaid')).toEqual(names('open', 'part'))
    expect(await by('open')).toEqual(names('open'))
    expect(await by('partial')).toEqual(names('part'))
    expect(await by('paid')).toEqual(names('decoy'))
    expect(await by('overpaid')).toEqual(names('over'))
    expect(await by('overdue')).toEqual(names('open'))
    expect(await page(owner, { p_status: 'cancelled', p_payment: 'open' })).toEqual([])
  })

  it('gleiche Zahlungsregel wie die Lesesicht invoice_payment_status (PROJ-45)', async () => {
    const { data, error } = await owner.from('invoice_payment_status').select('invoice_id, status, overdue').eq('tenant_id', tenant)
    expect(error).toBeNull()
    const statuses = ['open', 'partial', 'paid', 'overpaid']
    const byStatus = new Map<string, string[]>()
    for (const p of statuses) byStatus.set(p, idsOf(await page(owner, { p_payment: p })))
    const overdue = idsOf(await page(owner, { p_payment: 'overdue' }))
    for (const s of data ?? []) {
      for (const p of statuses) expect(byStatus.get(p)!.includes(s.invoice_id!), `${s.invoice_id} ${p}`).toBe(s.status === p)
      expect(overdue.includes(s.invoice_id!)).toBe(Boolean(s.overdue))
    }
    expect(data).toHaveLength(7)
  })

  it('Summen ohne Filter: Entwurf zählt nicht, Storno und Gutschrift heben sich auf, Rückzahlung abgezogen, Überzahlung mindert Offen nicht', async () => {
    // Rechnungsbetrag: 45.000 − 45.000 + 45.000 + 45.000 + 45.000 − 10.000 + 45.000
    // Bezahlt: 45.000 (storniert) − 10.000 (Rückzahlung) + 50.000 + 10.000 + 45.000
    // Offen: 45.000 (überfällig) + 35.000 (teilweise)
    expect(await totals(owner)).toEqual({ count: 8, total: 170000, paid: 140000, open: 80000 })
  })

  it('Summen mit Zahlungsfilter: noch nicht bezahlt, überfällig, überzahlt, bezahlt', async () => {
    expect(await totals(owner, { p_payment: 'unpaid' })).toEqual({ count: 2, total: 90000, paid: 10000, open: 80000 })
    expect(await sums(owner, { p_payment: 'overdue' })).toEqual({ total: 45000, paid: 0, open: 45000 })
    expect(await sums(owner, { p_payment: 'overpaid' })).toEqual({ total: 45000, paid: 50000, open: 0 })
    expect(await sums(owner, { p_payment: 'paid' })).toEqual({ total: 45000, paid: 45000, open: 0 })
    expect(await totals(owner, { p_status: 'cancelled', p_payment: 'open' })).toEqual({ count: 0, total: 0, paid: 0, open: 0 })
  })

  it('Jahr, Betrag (Grenzen inklusive) und Status in Seite und Summen', async () => {
    expect(idsOf(await page(owner, { p_year: 2025 }))).toEqual(names('minus'))
    expect(await sums(owner, { p_year: 2025 })).toEqual({ total: -10000, paid: 0, open: 0 })
    expect(await totals(owner, { p_year: 2030 })).toEqual({ count: 0, total: 0, paid: 0, open: 0 })
    // Genau € 450,00: Entwurf (zählt nicht zum Betrag), storniert, überfällig, überzahlt, teilweise, Gegenprobe
    expect(idsOf(await page(owner, { p_min_cents: 45000, p_max_cents: 45000 }))).toEqual(names('draft', 'paid', 'open', 'over', 'part', 'decoy'))
    expect(await sums(owner, { p_min_cents: 45000, p_max_cents: 45000 })).toEqual({ total: 225000, paid: 150000, open: 80000 })
    expect(idsOf(await page(owner, { p_max_cents: -1 }))).toEqual(names('credit', 'minus'))
    expect(await sums(owner, { p_max_cents: -1 })).toEqual({ total: -55000, paid: -10000, open: 0 })
    expect(await sums(owner, { p_status: 'credit_note' })).toEqual({ total: -45000, paid: -10000, open: 0 })
  })

  it('Suchmuster: „_“ und „%“ als Zeichen, Gegenprobe ohne Treffer; Empfänger', async () => {
    // So, wie die App das Muster an die Funktionen gibt (ein Backslash vor „_“ und „%“)
    expect(idsOf(await page(owner, { p_pattern: '%X\\_1\\%%' }))).toEqual(names('part'))
    expect(await sums(owner, { p_pattern: '%X\\_1\\%%' })).toEqual({ total: 45000, paid: 10000, open: 35000 })
    expect((await page(owner, { p_pattern: '%HUBER%' })).length).toBeGreaterThanOrEqual(7)
  })

  it('Mitarbeiter sieht Liste und Summen; fremder Inhaber und fremder Kunde sehen nichts', async () => {
    expect(await page(staff)).toHaveLength(8)
    expect(await totals(staff)).toEqual({ count: 8, total: 170000, paid: 140000, open: 80000 })
    expect(await page(ownerB)).toEqual([])
    expect(await totals(ownerB)).toEqual({ count: 0, total: 0, paid: 0, open: 0 })
    expect(await page(owner, {}, 0, 50, tenantB)).toEqual([])
    expect(await totals(owner, {}, tenantB)).toEqual({ count: 0, total: 0, paid: 0, open: 0 })
  })

  it('Kern und Funktionen nicht direkt aufrufbar ohne Anmeldung', async () => {
    const { anonClient } = await import('./helpers')
    const { data, error } = await anonClient().rpc('invoice_list_totals', { p_tenant_id: tenant, ...ALL } as never)
    expect(error ?? (data as unknown[])?.length === 0).toBeTruthy()
  })
})
