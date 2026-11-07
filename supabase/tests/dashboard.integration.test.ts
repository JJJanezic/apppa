// @vitest-environment node
//
// PROJ-14: Dashboard gegen „apppa-dev“ (übersprungen ohne .env.local). Prüft die vier Lesefunktionen:
// dashboard_billing_states (Abrechnungsstand), dashboard_unbilled (noch nicht abgerechnet), dashboard_open_invoices (offene
// Rechnungen mit Fälligkeit) und tourist_tax_monthly (Ortstaxe anteilig je Nacht), jeweils mit Rechten je Kunde:
// Person ist Inhaberin bei A und Mitarbeiterin bei B; Kunde C hat keine Mitglieder.
import { randomUUID } from 'node:crypto'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { anonClient, type Client, hasSupabaseEnv, serviceClient } from './helpers'
import { sharedClient } from './shared-sessions'

const TODAY = '2026-06-15'
const SHA = 'e'.repeat(64)

type Billing = { booking_id: string; billing: string }
type Unbilled = { booking_id: string; tenant_id: string; last_name: string | null; due_date: string; cancelled: boolean; billing: string; total_count: number }
type OpenInvoice = { invoice_id: string; tenant_id: string; open_cents: number; overdue: boolean; next_due: string | null; apartment_name: string | null }
type TaxRow = { tenant_id: string; municipality_id: string; municipality_name: string; month: string; amount_cents: number }

describe.skipIf(!hasSupabaseEnv)('PROJ-14 Dashboard', () => {
  let service: Client
  let ownerA: Client, staffA: Client, ownerB: Client
  let tenantA: string, tenantB: string, tenantC: string
  // Kunde D: eigene Daten für Tarifwechsel und Alt-Positionen (Nachbesserung BUG-7/BUG-8)
  let tenantD = ''
  const runId = randomUUID().slice(0, 8)
  const ids: Record<string, string> = {}
  const apartments: Record<string, string> = {}
  const methods: Record<string, string> = {}
  let seq = 0

  const property = async (tenant: string, code: string) => {
    const { data, error } = await service
      .from('properties')
      .insert({ tenant_id: tenant, name: `Haus ${code} ${runId}`, street: 'Seeweg 12', postal_code: '5340', city: 'Ort', municipality_code: code })
      .select('id')
      .single()
    if (error) throw error
    return data.id
  }
  const apartment = async (tenant: string, propertyId: string, name: string) => {
    const { data, error } = await service.from('apartments').insert({ tenant_id: tenant, property_id: propertyId, name, max_guests: 4, price_cents: 10000 }).select('id').single()
    if (error) throw error
    return data.id
  }
  const booking = async (
    tenant: string,
    apartmentId: string,
    arrival: string,
    departure: string,
    opts: { kind?: 'booking' | 'option'; cancelledAt?: string; fee?: number; guest?: string } = {}
  ) => {
    const kind = opts.kind ?? 'booking'
    const { data: g } = await service.from('guests').insert({ tenant_id: tenant, last_name: opts.guest ?? `Gast ${runId}`, first_name: 'Anna', country: 'AT' }).select('id').single()
    const { data, error } = await service
      .from('bookings')
      .insert({
        tenant_id: tenant,
        apartment_id: apartmentId,
        kind,
        arrival,
        departure,
        planned_departure: departure,
        guest_id: g!.id,
        check_in: '15:00',
        check_out: '10:00',
        adults: 2,
        child_ages: [],
        number_year: Number(arrival.slice(0, 4)),
        number_seq: 5000 + ++seq,
        option_until: kind === 'option' ? '2099-01-01' : null,
        cancelled_at: opts.cancelledAt ?? null,
      } as never)
      .select('id')
      .single()
    if (error) throw error
    const id = (data as { id: string }).id
    const { error: e2 } = await service.from('booking_amounts').insert({ id, tenant_id: tenant, nights_cents: 30000, cancellation_fee_cents: opts.fee ?? null } as never)
    if (e2) throw e2
    return id
  }
  const taxCharge = async (tenant: string, bookingId: string, cents: number) => {
    const { error } = await service
      .from('booking_charges')
      .insert({ tenant_id: tenant, booking_id: bookingId, position: 1, label: 'Nächtigungsabgabe', amount_cents: cents, vat_rate: 0, tourist_tax: true } as never)
    if (error) throw error
  }
  const backfilled = async (tenant: string, cents: number, bookingId: string | null = null) => {
    const { data, error } = await service
      .from('invoices')
      .insert({ tenant_id: tenant, number: `N-${randomUUID().slice(0, 8)}`, invoice_date: '2026-05-01', recipient: 'Huber Maria', total_cents: cents, booking_id: bookingId } as never)
      .select('id')
      .single()
    if (error) throw error
    return (data as { id: string }).id
  }
  const issued = async (tenant: string, bookingId: string, kind: 'invoice' | 'partial' | 'final', schedule: Record<string, unknown> | null = null) => {
    const { data, error } = await service
      .from('invoices')
      .insert({
        tenant_id: tenant,
        booking_id: bookingId,
        origin: 'issued',
        kind,
        number: `A-${randomUUID().slice(0, 8)}`,
        invoice_date: '2026-05-01',
        recipient: 'Huber Maria',
        total_cents: 30000,
        recipient_kind: 'guest',
        company_salutation: 'generic',
        guest_names: 'none',
        due_days: 0,
        due_basis: 'after_invoice',
        partial_mode: kind === 'partial' ? 'amount' : null,
        partial_amount_cents: kind === 'partial' ? 10000 : null,
        issued_at: new Date().toISOString(),
        issued_snapshot: schedule ? { kind, schedule } : { kind },
        pdf_path: `${tenant}/${randomUUID()}.pdf`,
        pdf_sha256: SHA,
      } as never)
      .select('id')
      .single()
    if (error) throw error
    return (data as { id: string }).id
  }
  const credit = async (tenant: string, invoiceId: string) => {
    const { data, error } = await service
      .from('invoices')
      .insert({
        tenant_id: tenant,
        origin: 'issued',
        kind: 'credit_note',
        credited_invoice_id: invoiceId,
        number: `G-${randomUUID().slice(0, 8)}`,
        invoice_date: '2026-05-02',
        recipient: 'Huber Maria',
        total_cents: -30000,
        recipient_kind: 'guest',
        company_salutation: 'generic',
        guest_names: 'none',
        issued_at: new Date().toISOString(),
        issued_snapshot: { kind: 'invoice' },
        pdf_path: `${tenant}/${randomUUID()}.pdf`,
        pdf_sha256: SHA,
      } as never)
      .select('id')
      .single()
    if (error) throw error
    return (data as { id: string }).id
  }
  const pay = async (tenant: string, invoiceId: string, cents: number) => {
    const { error } = await service
      .from('payments')
      .insert({ tenant_id: tenant, invoice_id: invoiceId, kind: 'payment', paid_on: '2026-05-10', amount_cents: cents, method_id: methods[tenant] } as never)
    if (error) throw error
  }

  const billing = async (client: Client, bookingIds: string[]) => {
    const { data, error } = await client.rpc('dashboard_billing_states', { p_booking_ids: bookingIds })
    expect(error).toBeNull()
    return new Map(((data ?? []) as Billing[]).map((r) => [r.booking_id, r.billing]))
  }
  const unbilled = async (client: Client, tenants: string[], limit = 50) => {
    const { data, error } = await client.rpc('dashboard_unbilled', { p_tenant_ids: tenants, p_today: TODAY, p_limit: limit })
    expect(error).toBeNull()
    return (data ?? []) as Unbilled[]
  }
  const openInvoices = async (client: Client, tenants: string[]) => {
    const { data, error } = await client.rpc('dashboard_open_invoices', { p_tenant_ids: tenants })
    expect(error).toBeNull()
    return (data ?? []) as OpenInvoice[]
  }
  const tax = async (client: Client, tenants: string[], from = '2025-01-01', to = '2026-12-31') => {
    const { data, error } = await client.rpc('tourist_tax_monthly', { p_tenant_ids: tenants, p_from: from, p_to: to })
    expect(error).toBeNull()
    return (data ?? []) as TaxRow[]
  }
  const taxOf = (rows: TaxRow[], tenant: string, code: string, month: string) =>
    Number(rows.find((r) => r.tenant_id === tenant && r.municipality_id === code && r.month === month)?.amount_cents ?? 0)

  beforeAll(async () => {
    service = serviceClient()
    const oa = await sharedClient('ownerA')
    const sa = await sharedClient('staffA')
    const ob = await sharedClient('ownerB')
    ownerA = oa.client
    staffA = sa.client
    ownerB = ob.client
    const made: string[] = []
    for (const name of ['A', 'B', 'C']) {
      const { data: t, error } = await service.from('tenants').insert({ name: `PROJ-14 Test ${name} ${runId}` }).select('id').single()
      if (error) throw error
      made.push(t.id)
    }
    ;[tenantA, tenantB, tenantC] = made
    // A: ownerA Inhaberin, staffA Mitarbeiter · B: ownerB Inhaber, ownerA Mitarbeiterin · C: ohne Mitglieder
    const { error: me } = await service.from('memberships').insert([
      { tenant_id: tenantA, user_id: oa.user.id, role: 'owner' },
      { tenant_id: tenantA, user_id: sa.user.id, role: 'staff' },
      { tenant_id: tenantB, user_id: ob.user.id, role: 'owner' },
      { tenant_id: tenantB, user_id: oa.user.id, role: 'staff' },
    ])
    if (me) throw me
    for (const t of made) {
      const { data } = await service.from('payment_methods').select('id, name').eq('tenant_id', t)
      methods[t] = data!.find((m) => m.name === 'Überweisung')!.id
    }

    // Gemeinden: St. Gilgen (50330), Salzburg (50101)
    const pA = await property(tenantA, '50330')
    const pA2 = await property(tenantA, '50101')
    const pB = await property(tenantB, '50330')
    const pC = await property(tenantC, '50330')
    apartments.a = await apartment(tenantA, pA, `Top 1 ${runId}`)
    apartments.a2 = await apartment(tenantA, pA2, `Top 9 ${runId}`)
    apartments.b = await apartment(tenantB, pB, `Top 1 ${runId}`)
    apartments.c = await apartment(tenantC, pC, `Top 1 ${runId}`)

    // Abrechnung (Kunde A, Stichtag 15.06.2026)
    ids.missing = await booking(tenantA, apartments.a, '2026-06-05', '2026-06-10')
    ids.billed = await booking(tenantA, apartments.a, '2026-06-10', '2026-06-12')
    ids.invoiceBilled = await issued(tenantA, ids.billed, 'invoice', { due: '2020-01-01', depositCents: null, depositDue: null, remainderCents: null })
    ids.partialOnly = await booking(tenantA, apartments.a, '2026-06-01', '2026-06-11')
    ids.partialInvoice = await issued(tenantA, ids.partialOnly, 'partial', { due: '2099-03-01', depositCents: 5000, depositDue: '2099-01-01', remainderCents: 25000 })
    ids.cancelledInvoice = await booking(tenantA, apartments.a, '2026-06-02', '2026-06-09')
    ids.creditedInvoice = await issued(tenantA, ids.cancelledInvoice, 'invoice')
    ids.creditNote = await credit(tenantA, ids.creditedInvoice)
    ids.backfilledBilled = await booking(tenantA, apartments.a, '2026-06-03', '2026-06-08')
    ids.backfilledInvoice = await backfilled(tenantA, 30000, ids.backfilledBilled)
    await pay(tenantA, ids.backfilledInvoice, 30000)
    ids.future = await booking(tenantA, apartments.a, '2026-06-14', '2026-06-20')
    ids.option = await booking(tenantA, apartments.a, '2026-06-01', '2026-06-04', { kind: 'option' })
    ids.stornoFee = await booking(tenantA, apartments.a, '2026-07-01', '2026-07-05', { cancelledAt: '2026-06-01T10:00:00Z', fee: 8000 })
    ids.stornoNoFee = await booking(tenantA, apartments.a, '2026-07-10', '2026-07-12', { cancelledAt: '2026-06-01T10:00:00Z' })
    ids.today = await booking(tenantA, apartments.a, '2026-06-13', TODAY)
    ids.draftOnly = await booking(tenantA, apartments.a2, '2026-06-01', '2026-06-07')
    ids.foreignB = await booking(tenantB, apartments.b, '2026-06-01', '2026-06-05')
    ids.foreignC = await booking(tenantC, apartments.c, '2026-06-01', '2026-06-05')

    // Offene Rechnungen: nacherfasst ohne Buchung, teilweise bezahlt; B und C je eine offene
    ids.partlyPaid = await backfilled(tenantA, 10000)
    await pay(tenantA, ids.partlyPaid, 4000)
    ids.openB = await backfilled(tenantB, 7000)
    ids.openC = await backfilled(tenantC, 9000)

    // Ortstaxe (nach dem Stichtag, damit sie nicht unter „noch nicht abgerechnet“ fallen)
    const t1 = await booking(tenantA, apartments.a, '2026-09-30', '2026-10-03')
    await taxCharge(tenantA, t1, 1500)
    const t2 = await booking(tenantA, apartments.a, '2026-11-28', '2026-12-01')
    await taxCharge(tenantA, t2, 1000)
    const t3 = await booking(tenantA, apartments.a2, '2025-12-30', '2026-01-02')
    await taxCharge(tenantA, t3, 999)
    // abgerechnet und bezahlt, damit sie weder unter „noch nicht abgerechnet“ noch unter „offen“ fällt
    await pay(tenantA, await backfilled(tenantA, 30000, t3), 30000)
    const opt = await booking(tenantA, apartments.a, '2026-10-10', '2026-10-12', { kind: 'option' })
    await taxCharge(tenantA, opt, 5000)
    const storno = await booking(tenantA, apartments.a, '2026-10-20', '2026-10-22', { cancelledAt: '2026-10-01T10:00:00Z' })
    await taxCharge(tenantA, storno, 5000)
    const tb = await booking(tenantB, apartments.b, '2026-10-05', '2026-10-07')
    await taxCharge(tenantB, tb, 400)
  }, 120_000)

  afterAll(async () => {
    if (!service) return
    for (const t of [tenantA, tenantB, tenantC, tenantD].filter(Boolean)) await service.from('tenants').delete().eq('id', t)
  })

  describe('Abrechnungsstand je Buchung', () => {
    it('unterscheidet abgerechnet, Rechnung fehlt und Schlussrechnung fehlt', async () => {
      const s = await billing(ownerA, [ids.missing, ids.billed, ids.partialOnly, ids.cancelledInvoice, ids.backfilledBilled, ids.draftOnly])
      expect(s.get(ids.missing)).toBe('missing')
      expect(s.get(ids.billed)).toBe('billed')
      expect(s.get(ids.partialOnly)).toBe('final_missing')
      // einzige Rechnung storniert → wieder offen
      expect(s.get(ids.cancelledInvoice)).toBe('missing')
      expect(s.get(ids.backfilledBilled)).toBe('billed')
    })

    it('liefert nur Buchungen von Kunden, bei denen die Person Mitglied ist', async () => {
      const s = await billing(ownerA, [ids.missing, ids.foreignB, ids.foreignC])
      expect([...s.keys()].sort()).toEqual([ids.missing, ids.foreignB].sort())
      const staff = await billing(staffA, [ids.missing, ids.foreignB, ids.foreignC])
      expect([...staff.keys()]).toEqual([ids.missing])
    })
  })

  describe('Noch nicht abgerechnet', () => {
    it('enthält abgereiste Buchungen ohne (Schluss-)Rechnung und stornierte mit Stornogebühr, älteste zuerst', async () => {
      const rows = await unbilled(ownerA, [tenantA])
      const byId = new Map(rows.map((r) => [r.booking_id, r]))
      expect(rows.map((r) => r.booking_id)).toEqual([ids.stornoFee, ids.draftOnly, ids.cancelledInvoice, ids.missing, ids.partialOnly, ids.today])
      expect(byId.get(ids.stornoFee)).toMatchObject({ cancelled: true, due_date: '2026-06-01', billing: 'missing' })
      expect(byId.get(ids.partialOnly)?.billing).toBe('final_missing')
      expect(Number(rows[0].total_count)).toBe(6)
      // nicht enthalten: abgerechnet, künftig, Option, Storno ohne Gebühr
      for (const key of ['billed', 'backfilledBilled', 'future', 'option', 'stornoNoFee']) expect(byId.has(ids[key])).toBe(false)
    })

    it('begrenzt die Zeilen, die Gesamtzahl bleibt', async () => {
      const rows = await unbilled(ownerA, [tenantA], 2)
      expect(rows).toHaveLength(2)
      expect(Number(rows[0].total_count)).toBe(6)
    })

    it('nur Kunden, bei denen die Person Inhaber ist', async () => {
      // ownerA ist bei B nur Mitarbeiterin, C fremd
      const rows = await unbilled(ownerA, [tenantA, tenantB, tenantC])
      expect(new Set(rows.map((r) => r.tenant_id))).toEqual(new Set([tenantA]))
      expect(await unbilled(staffA, [tenantA])).toEqual([])
      const b = await unbilled(ownerB, [tenantA, tenantB])
      expect(b.map((r) => r.booking_id)).toEqual([ids.foreignB])
    })
  })

  describe('Offene Rechnungen', () => {
    it('nur offen und teilweise, ohne stornierte, Gutschriften und bezahlte; Fälligkeit und überfällig', async () => {
      const rows = await openInvoices(ownerA, [tenantA])
      const byId = new Map(rows.map((r) => [r.invoice_id, r]))
      expect([...byId.keys()].sort()).toEqual([ids.invoiceBilled, ids.partialInvoice, ids.partlyPaid].sort())
      expect(byId.get(ids.invoiceBilled)).toMatchObject({ overdue: true, next_due: '2020-01-01', apartment_name: `Top 1 ${runId}` })
      // Anzahlung noch nicht beglichen → Anzahlungsfrist
      expect(byId.get(ids.partialInvoice)).toMatchObject({ overdue: false, next_due: '2099-01-01' })
      expect(byId.get(ids.partlyPaid)).toMatchObject({ next_due: null, apartment_name: null })
      expect(Number(byId.get(ids.partlyPaid)!.open_cents)).toBe(6000)
    })

    it('Mitarbeiter sehen die Rechnungen ihres Kunden; fremde Kunden bleiben leer', async () => {
      const own = await openInvoices(ownerA, [tenantA, tenantB, tenantC])
      expect(new Set(own.map((r) => r.tenant_id))).toEqual(new Set([tenantA, tenantB]))
      const staff = await openInvoices(staffA, [tenantA, tenantB, tenantC])
      expect(new Set(staff.map((r) => r.tenant_id))).toEqual(new Set([tenantA]))
    })
  })

  describe('Ortstaxe je Monat', () => {
    it('verteilt anteilig je Nacht über Monats- und Jahresgrenzen, centgenau', async () => {
      const rows = await tax(ownerA, [tenantA])
      expect(taxOf(rows, tenantA, '50330', '2026-09-01')).toBe(500)
      expect(taxOf(rows, tenantA, '50330', '2026-10-01')).toBe(1000)
      // 1000 auf 3 Nächte im November: Summe bleibt 1000
      expect(taxOf(rows, tenantA, '50330', '2026-11-01')).toBe(1000)
      // 999 über den Jahreswechsel: 2 Nächte 2025, 1 Nacht 2026
      expect(taxOf(rows, tenantA, '50101', '2025-12-01')).toBe(666)
      expect(taxOf(rows, tenantA, '50101', '2026-01-01')).toBe(333)
      expect(rows.find((r) => r.municipality_id === '50101')?.municipality_name).toBeTruthy()
    })

    it('ohne Optionen und stornierte Buchungen', async () => {
      const rows = await tax(ownerA, [tenantA])
      const total = rows.reduce((s, r) => s + Number(r.amount_cents), 0)
      expect(total).toBe(1500 + 1000 + 999)
    })

    it('nur Monate im Zeitraum', async () => {
      const rows = await tax(ownerA, [tenantA], '2026-10-01', '2026-10-31')
      expect(rows.map((r) => r.month)).toEqual(['2026-10-01'])
    })

    it('nur Kunden, bei denen die Person Inhaber ist', async () => {
      const a = await tax(ownerA, [tenantA, tenantB, tenantC])
      expect(new Set(a.map((r) => r.tenant_id))).toEqual(new Set([tenantA]))
      expect(await tax(staffA, [tenantA])).toEqual([])
      const b = await tax(ownerB, [tenantA, tenantB])
      expect(b.map((r) => [r.tenant_id, r.month, Number(r.amount_cents)])).toEqual([[tenantB, '2026-10-01', 400]])
    })
  })

  describe('Ortstaxe: Tarifwechsel und Alt-Positionen (Nachbesserung)', () => {
    const rate = async (apartmentId: string, validFrom: string, cents: number) => {
      const { data, error } = await service
        .from('apartment_tourist_tax_rates')
        .insert({ tenant_id: tenantD, apartment_id: apartmentId, valid_from: validFrom, label: 'Nächtigungsabgabe', method: 'per_person_night', amount_cents: cents } as never)
        .select('id')
        .single()
      if (error) throw error
      return (data as { id: string }).id
    }
    const charge = async (bookingId: string, cents: number, rateId: string | null, position = 1) => {
      const { error } = await service.from('booking_charges').insert({
        tenant_id: tenantD,
        booking_id: bookingId,
        position,
        label: 'Nächtigungsabgabe',
        amount_cents: cents,
        vat_rate: 0,
        tourist_tax: true,
        tourist_tax_rate_id: rateId,
      } as never)
      if (error) throw error
    }

    beforeAll(async () => {
      const { data: t, error } = await service.from('tenants').insert({ name: `PROJ-14 Test D ${runId}` }).select('id').single()
      if (error) throw error
      tenantD = t.id
      const oa = await sharedClient('ownerA')
      await service.from('memberships').insert({ tenant_id: tenantD, user_id: oa.user.id, role: 'owner' })
      const pD = await property(tenantD, '50330')
      const apD = await apartment(tenantD, pD, `Top D ${runId}`)
      const r25 = await rate(apD, '2026-01-01', 250)
      const r28 = await rate(apD, '2026-12-01', 280)
      // 29.11.–03.12.2026, 1 Person: je Tarif eine Position (2 Nächte zu 2,50, 2 Nächte zu 2,80)
      const change = await booking(tenantD, apD, '2026-11-29', '2026-12-03')
      await charge(change, 500, r25, 1)
      await charge(change, 560, r28, 2)
      // Alt-Position ohne Tarif (wie nach der Kennzeichnung): 30.10.–02.11.2026, 3 Nächte, 15,00
      const legacy = await booking(tenantD, apD, '2026-10-30', '2026-11-02')
      await charge(legacy, 1500, null)
      // Alt-Position für 5 vereinbarte Nächte (28.09.–03.10.), Gast reiste nach 4 Nächten ab (02.10.): 5 × 2,50
      const early = await booking(tenantD, apD, '2026-09-28', '2026-10-02')
      await service.from('bookings').update({ planned_departure: '2026-10-03' } as never).eq('id', early)
      await charge(early, 1250, null)
      // Betrag kein Vielfaches des Tarifs (10,01 über 3 Nächte, 30.07.–02.08.): anteilig in Cent
      const odd = await booking(tenantD, apD, '2026-07-30', '2026-08-02')
      await charge(odd, 1001, null)
    }, 60_000)

    it('verteilt jede Position nur über die Nächte ihres Tarifzeitraums', async () => {
      const rows = await tax(ownerA, [tenantD], '2026-11-01', '2026-12-31')
      // November: 2 Nächte zu 2,50 aus der Tarifwechsel-Buchung + 1 von 3 Nächten der Alt-Position (5,00)
      expect(taxOf(rows, tenantD, '50330', '2026-11-01')).toBe(500 + 500)
      // Dezember: nur die 2 Nächte zu 2,80
      expect(taxOf(rows, tenantD, '50330', '2026-12-01')).toBe(560)
    })

    it('Alt-Position: über die vereinnahmten Nächte bis zur späteren Abreise, in ganzen Personennächten', async () => {
      const rows = await tax(ownerA, [tenantD], '2026-09-01', '2026-09-30')
      // 3 von 5 vereinnahmten Nächten im September (28., 29., 30.) = 7,50 statt anteilig 9,38 über 4 Nächte
      expect(taxOf(rows, tenantD, '50330', '2026-09-01')).toBe(750)
    })

    it('Betrag kein Vielfaches des Tarifs: anteilig in Cent, Summe stimmt', async () => {
      const rows = await tax(ownerA, [tenantD], '2026-07-01', '2026-08-31')
      expect(taxOf(rows, tenantD, '50330', '2026-07-01')).toBe(667)
      expect(taxOf(rows, tenantD, '50330', '2026-08-01')).toBe(334)
    })

    it('Position ohne Tarif-Verweis wird über den ganzen Aufenthalt verteilt', async () => {
      const rows = await tax(ownerA, [tenantD], '2026-10-01', '2026-10-31')
      // 2 von 3 Nächten (30. und 31.10.) der Alt-Position + 2 Nächte (1. und 2.10.) der früh abgereisten Alt-Position
      expect(taxOf(rows, tenantD, '50330', '2026-10-01')).toBe(1000 + 500)
    })
  })

  it('ohne Anmeldung nicht aufrufbar', async () => {
    const anon = anonClient()
    const { error } = await anon.rpc('tourist_tax_monthly', { p_tenant_ids: [tenantA], p_from: '2026-01-01', p_to: '2026-12-31' })
    expect(error).not.toBeNull()
    const { error: e2 } = await anon.rpc('dashboard_open_invoices', { p_tenant_ids: [tenantA] })
    expect(e2).not.toBeNull()
  })
})
