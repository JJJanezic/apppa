import { randomUUID } from 'node:crypto'

import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test as base } from '@playwright/test'

import type { Json } from '../src/types/database'
import { anon, createTenant, createUser, deleteUser, type E2EUser, hasSupabaseEnv, service, signInAs } from './support/supabase'

// PROJ-45: Zahlungserfassung. Regeln: src/lib/payments.test.ts. Datenbank: supabase/tests/payments.integration.test.ts.
// Hier die Abläufe in der Oberfläche (Desktop), dazu Layout und Barrierefreiheit auf allen Breiten.

type Users = (opts?: Parameters<typeof createUser>[0]) => Promise<E2EUser>

const test = base.extend<{ users: Users }>({
  users: async ({}, use) => {
    const created: E2EUser[] = []
    await use(async (opts) => {
      const user = await createUser(opts)
      created.push(user)
      return user
    })
    for (const user of created) await deleteUser(user)
  },
})

test.use({ storageState: { cookies: [], origins: [] } })
test.skip(!hasSupabaseEnv, 'Supabase-Umgebung fehlt')

const desktopOnly = () => test.skip(['tablet', 'mobile'].includes(test.info().project.name), 'Abläufe nur im Desktop-Projekt')
const ready = (page: Page) =>
  page.waitForFunction(() => Object.keys(document.querySelector('main') ?? {}).some((k) => k.startsWith('__reactFiber')))
const panel = (page: Page) => page.getByRole('dialog')
const plain = (v: string | null) => (v ?? '').replace(/[  ]/g, ' ').replace(/\s+/g, ' ')
const todayIso = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Vienna' }).format(new Date())
const thisMonth = () => todayIso().slice(0, 7)
let seq = 4500

async function signedIn(user: E2EUser) {
  const client = anon()
  await client.auth.signInWithPassword({ email: user.email, password: user.password })
  return client
}

async function setup(users: Users, { staff = false } = {}) {
  const owner = await users({ displayName: 'Olga Owner' })
  const staffUser = staff ? await users({ displayName: 'Sam Staff' }) : undefined
  const members: { user: E2EUser; role: 'owner' | 'staff' }[] = [{ user: owner, role: 'owner' }]
  if (staffUser) members.push({ user: staffUser, role: 'staff' })
  const tenantId = await createTenant(`QA45 Testkunde ${randomUUID().slice(0, 8)}`, members)
  const db = service()
  const { data: property } = await db
    .from('properties')
    .insert({ tenant_id: tenantId, name: 'Haus See', street: 'Seeweg 12', postal_code: '5340', city: 'St. Gilgen', municipality_code: '50330' })
    .select('id')
    .single()
  const { data: apartment } = await db
    .from('apartments')
    .insert({ tenant_id: tenantId, property_id: property!.id, name: 'Top 3', max_guests: 4, price_cents: 10000 } as never)
    .select('id')
    .single()
  const { data: guest } = await db.from('guests').insert({ tenant_id: tenantId, country: 'AT', last_name: 'Huber', first_name: 'Maria' } as never).select('id').single()
  const { data: methods } = await db.from('payment_methods').select('id, name').eq('tenant_id', tenantId)
  const method = (name: string) => methods!.find((m) => m.name === name)!.id
  return { owner, staff: staffUser, tenantId, apartmentId: (apartment as { id: string }).id, guestId: (guest as { id: string }).id, method }
}

type Setup = Awaited<ReturnType<typeof setup>>

async function addBooking(s: Setup, source = 'none') {
  const db = service()
  const { data, error } = await db
    .from('bookings')
    .insert({
      tenant_id: s.tenantId,
      apartment_id: s.apartmentId,
      kind: 'booking',
      arrival: '2026-10-14',
      planned_departure: '2026-10-17',
      departure: '2026-10-17',
      guest_id: s.guestId,
      check_in: '15:00',
      check_out: '10:00',
      adults: 2,
      child_ages: [],
      source,
      number_year: 2026,
      number_seq: ++seq,
    } as never)
    .select('id')
    .single()
  if (error) throw error
  const id = (data as { id: string }).id
  await db.from('booking_amounts').insert({ id, tenant_id: s.tenantId, nights_cents: 50000, nights_vat_rate: 10, cancellation_fee_cents: null, cancellation_fee_vat_rate: 0 } as never)
  return id
}

// Nacherfasste Rechnung über € 450,00 (bzw. eigene Positionen), optional mit Buchung
async function addInvoice(s: Setup, over: Record<string, unknown> = {}) {
  const client = await signedIn(s.owner)
  const { data, error } = await client.rpc('save_invoice', {
    p_input: {
      tenant_id: s.tenantId,
      number: `QA45-${randomUUID().slice(0, 6)}`,
      invoice_date: '2026-10-20',
      recipient: 'Huber Maria',
      lines: [{ label: 'Übernachtung', amount_cents: 45000, vat_rate: '10.00' }],
      ...over,
    } as unknown as Json,
  })
  if (error) throw error
  return (data as { id: string }).id
}

async function addPayment(s: Setup, invoiceId: string, over: Record<string, unknown> = {}) {
  const client = await signedIn(s.owner)
  const { data, error } = await client.rpc('record_payment', {
    p_input: {
      tenant_id: s.tenantId,
      kind: 'payment',
      invoice_id: invoiceId,
      paid_on: todayIso(),
      amount_cents: 10000,
      commission_cents: 0,
      fee_cents: 0,
      method_id: s.method('Überweisung'),
      note: null,
      receipt_path: null,
      confirmed: true,
      ...over,
    } as unknown as Json,
  })
  if (error) throw error
  return (data as { id: string }).id
}

async function openInvoice(page: Page, id: string) {
  await page.goto(`/rechnungen/${id}`)
  await ready(page)
}

const section = (page: Page) => page.getByRole('region', { name: 'Zahlungen' })

test.describe('Zahlung erfassen im Rechnungsdetail', () => {
  test('AC: Vorbelegung, Speichern, Liste, Status offen → teilweise → bezahlt; Spalte „Zahlung“ in der Rechnungsliste', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const id = await addInvoice(s)
    await signInAs(page, s.owner)
    await openInvoice(page, id)
    await expect(section(page).getByText('offen', { exact: true })).toBeVisible()
    await section(page).getByRole('button', { name: 'Zahlung erfassen' }).click()
    await expect(panel(page).getByLabel('Zahlungsdatum')).toHaveValue(todayIso())
    await expect(panel(page).getByLabel('Betrag')).toHaveValue('450,00')
    await expect(panel(page).getByRole('combobox', { name: 'Zahlungsart' })).toHaveText('Überweisung')
    await expect(panel(page).getByLabel('Provision')).toHaveCount(0)
    await panel(page).getByLabel('Betrag').fill('100')
    await panel(page).getByLabel('Notiz').fill('Anzahlung laut Kontoauszug')
    await panel(page).getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Zahlung erfasst.', { exact: true })).toBeVisible()
    await expect(section(page).getByText('teilweise', { exact: true })).toBeVisible()
    await expect(section(page).getByText('Anzahlung laut Kontoauszug')).toBeVisible()
    await expect(section(page).getByText('erfasst von Olga Owner')).toBeVisible()
    expect(plain(await section(page).getByText('Offen', { exact: true }).locator('..').textContent())).toContain('€ 350,00')
    // Zweite Zahlung: vorbelegt mit dem Offen-Betrag
    await section(page).getByRole('button', { name: 'Zahlung erfassen' }).click()
    await expect(panel(page).getByLabel('Betrag')).toHaveValue('350,00')
    await panel(page).getByRole('button', { name: 'Speichern' }).click()
    await expect(section(page).getByText('bezahlt', { exact: true })).toBeVisible()
    // Bezahlt: kein Vorschlag mehr
    await section(page).getByRole('button', { name: 'Zahlung erfassen' }).click()
    await expect(panel(page).getByLabel('Betrag')).toHaveValue('')
    await page.keyboard.press('Escape')
    await page.goto('/rechnungen')
    await ready(page)
    await expect(page.getByRole('columnheader', { name: 'Zahlung' })).toBeVisible()
    await expect(page.getByRole('row').filter({ hasText: 'Huber Maria' }).getByText('bezahlt', { exact: true })).toBeVisible()
  })

  test('AC: Pflichtfelder, Datum in der Zukunft, Betrag 0, Notiz zu lang', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const id = await addInvoice(s)
    await signInAs(page, s.owner)
    await openInvoice(page, id)
    await section(page).getByRole('button', { name: 'Zahlung erfassen' }).click()
    await panel(page).getByLabel('Betrag').fill('')
    await panel(page).getByLabel('Zahlungsdatum').fill('')
    await panel(page).getByRole('button', { name: 'Speichern' }).click()
    await expect(panel(page).getByText('Bitte einen Betrag eingeben.')).toBeVisible()
    await expect(panel(page).getByText('Bitte ein Datum eingeben.')).toBeVisible()
    await panel(page).getByLabel('Zahlungsdatum').fill('2099-01-01')
    await panel(page).getByLabel('Betrag').fill('0')
    await panel(page).getByLabel('Notiz').fill('x'.repeat(301))
    await panel(page).getByRole('button', { name: 'Speichern' }).click()
    await expect(panel(page).getByText('Das Zahlungsdatum darf nicht in der Zukunft liegen.')).toBeVisible()
    await expect(panel(page).getByText('Der Betrag muss größer als 0 sein.')).toBeVisible()
    await expect(panel(page).getByText('Höchstens 300 Zeichen.')).toBeVisible()
    expect((await service().from('payments').select('id').eq('invoice_id', id)).data).toEqual([])
  })

  test('AC: Überzahlung und gleiche Zahlung – Hinweis, nach Bestätigung gespeichert, Status „überzahlt“', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const id = await addInvoice(s)
    await addPayment(s, id, { amount_cents: 40000 })
    await signInAs(page, s.owner)
    await openInvoice(page, id)
    await section(page).getByRole('button', { name: 'Zahlung erfassen' }).click()
    await panel(page).getByLabel('Betrag').fill('100')
    await panel(page).getByRole('button', { name: 'Speichern' }).click()
    const alert = page.getByRole('alertdialog')
    await expect(alert).toContainText('Damit ist die Rechnung um € 50,00 überzahlt.')
    await alert.getByRole('button', { name: 'Trotzdem speichern' }).click()
    await expect(section(page).getByText('überzahlt', { exact: true })).toBeVisible()
    expect(plain(await section(page).getByText('Offen', { exact: true }).locator('..').textContent())).toContain('-€ 50,00')
  })

  test('AC: Inhaber bearbeitet und löscht (mit Bestätigung); Rechnung mit Zahlungen nicht löschbar', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const id = await addInvoice(s)
    await addPayment(s, id, { amount_cents: 10000 })
    await signInAs(page, s.owner)
    await openInvoice(page, id)
    // Rechnung löschen: gesperrt
    await page.getByRole('button', { name: 'Löschen', exact: true }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Endgültig löschen' }).click()
    await expect(page.getByText('Diese Rechnung hat Zahlungen. Bitte zuerst die Zahlungen einer anderen Rechnung zuordnen oder löschen.')).toBeVisible()
    await page.reload()
    await ready(page)
    await section(page).getByRole('button', { name: /^Zahlung vom .* bearbeiten$/ }).click()
    await panel(page).getByLabel('Betrag').fill('120')
    await panel(page).getByRole('combobox', { name: 'Zahlungsart' }).click()
    await page.getByRole('option', { name: 'Bar' }).click()
    await panel(page).getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Änderungen gespeichert.', { exact: true })).toBeVisible()
    await expect(section(page).getByText('· Bar')).toBeVisible()
    await section(page).getByRole('button', { name: /^Zahlung vom .* löschen$/ }).click()
    await expect(page.getByRole('alertdialog')).toContainText('über € 120,00 wird entfernt')
    await page.getByRole('alertdialog').getByRole('button', { name: 'Löschen' }).click()
    await expect(page.getByText('Zahlung gelöscht.', { exact: true })).toBeVisible()
    await expect(section(page).getByText('Noch keine Zahlung erfasst.')).toBeVisible()
  })
})

test.describe('Mitarbeiter und Belege', () => {
  test('AC: Mitarbeiter erfasst mit Beleg (PDF), sieht keine Knöpfe zum Ändern; Einstellungen → Zahlungen nicht erreichbar', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users, { staff: true })
    const id = await addInvoice(s)
    await signInAs(page, s.staff!)
    await openInvoice(page, id)
    await section(page).getByRole('button', { name: 'Zahlung erfassen' }).click()
    await panel(page).getByLabel('Betrag').fill('50')
    await panel(page).locator('#zahlung-beleg').setInputFiles('tests/fixtures/ausweis.pdf')
    await expect(panel(page).getByText('ausweis.pdf')).toBeVisible({ timeout: 15_000 })
    await panel(page).getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Zahlung erfasst.', { exact: true })).toBeVisible()
    await expect(section(page).getByRole('button', { name: 'Beleg öffnen' })).toBeVisible()
    await expect(section(page).getByRole('button', { name: /bearbeiten$/ })).toHaveCount(0)
    await expect(section(page).getByRole('button', { name: /löschen$/ })).toHaveCount(0)
    const { data } = await service().from('payments').select('receipt_path, created_by').eq('invoice_id', id).single()
    expect(data!.receipt_path).toMatch(new RegExp(`^${s.tenantId}/[0-9a-f-]{36}\\.pdf$`))
    expect(data!.created_by).toBe(s.staff!.id)
    await page.goto('/einstellungen/zahlungen')
    await expect(page.getByRole('heading', { name: 'Zahlungsarten' })).toHaveCount(0)
    // Menüpunkt „Zahlungen“ ist für Mitarbeiter da
    await page.goto('/zahlungen')
    await ready(page)
    await expect(page.getByRole('heading', { name: 'Zahlungen', level: 1 })).toBeVisible()
  })

  test('AC: Foto als Beleg wird als JPEG gespeichert; falsches Format abgelehnt', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const id = await addInvoice(s)
    await signInAs(page, s.owner)
    await openInvoice(page, id)
    await section(page).getByRole('button', { name: 'Zahlung erfassen' }).click()
    await panel(page).locator('#zahlung-beleg').setInputFiles({ name: 'brief.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from('x') })
    await expect(panel(page).getByText('Bitte ein PDF oder ein Bild (JPEG, PNG, HEIC, WebP) wählen.')).toBeVisible()
    await panel(page).locator('#zahlung-beleg').setInputFiles('tests/fixtures/ausweis.png')
    await expect(panel(page).getByText('ausweis.png')).toBeVisible({ timeout: 15_000 })
    await panel(page).getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Zahlung erfasst.', { exact: true })).toBeVisible()
    const { data, error } = await service().from('payments').select('receipt_path').eq('invoice_id', id)
    expect(error, JSON.stringify(error)).toBeNull()
    expect(data, JSON.stringify(data)).toHaveLength(1)
    expect(data![0].receipt_path).toMatch(/\.jpg$/)
  })
})

test.describe('Provisionsabzug und Buchungsdetail', () => {
  test('AC: Airbnb-Buchung – Provision und Gebühr, „Ausbezahlt“ läuft mit, Rechnung bezahlt; Buchungsdetail mit Bezahlt/Offen', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const bookingId = await addBooking(s, 'airbnb')
    await addInvoice(s, { booking_id: bookingId, lines: [{ label: 'Übernachtung', amount_cents: 50000, vat_rate: '10.00' }] })
    await signInAs(page, s.owner)
    await page.goto(`/buchungen/${bookingId}`)
    await ready(page)
    const invoices = page.getByRole('heading', { name: 'Rechnungen' }).locator('..')
    await expect(invoices.getByText('offen', { exact: true })).toBeVisible()
    await invoices.getByRole('button', { name: 'Zahlung erfassen' }).click()
    await expect(panel(page).getByLabel('Ausbezahlt')).toHaveValue('500,00')
    await panel(page).getByLabel('Provision').fill('70')
    await panel(page).getByLabel('Zahlungsgebühr').fill('5')
    await expect(panel(page).getByLabel('Ausbezahlt')).toHaveValue('425,00')
    await panel(page).getByRole('combobox', { name: 'Zahlungsart' }).click()
    await page.getByRole('option', { name: 'über Airbnb' }).click()
    await panel(page).getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Zahlung erfasst.', { exact: true })).toBeVisible()
    await expect(invoices.getByText('bezahlt', { exact: true })).toBeVisible()
    expect(plain(await invoices.getByText('Bezahlt', { exact: true }).locator('..').textContent())).toContain('€ 500,00')
    const { data } = await service().from('payments').select('amount_cents, commission_cents, fee_cents').eq('tenant_id', s.tenantId).single()
    expect(data).toEqual({ amount_cents: 42500, commission_cents: 7000, fee_cents: 500 })
  })

  test('AC: Buchungsquelle „Airbnb“ im Buchungsfilter; andere Buchungsquelle ohne Provisionsfelder', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const bookingId = await addBooking(s, 'website')
    const id = await addInvoice(s, { booking_id: bookingId })
    await signInAs(page, s.owner)
    await openInvoice(page, id)
    await section(page).getByRole('button', { name: 'Zahlung erfassen' }).click()
    await expect(panel(page).getByLabel('Betrag')).toBeVisible()
    await expect(panel(page).getByLabel('Provision')).toHaveCount(0)
    await page.goto('/buchungen?monat=2026-10&quelle=airbnb')
    await ready(page)
    await expect(page.getByRole('combobox', { name: 'Quelle' })).toHaveText('Airbnb')
  })
})

test.describe('Storno und Rückzahlung', () => {
  test('AC: stornierte Rechnung zeigt Guthaben ohne „Zahlung erfassen“; Gutschrift „Rückzahlung offen“, nach Rückzahlung „erstattet“', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const bookingId = await addBooking(s)
    const client = await signedIn(s.owner)
    const { data: draftId, error } = await client.rpc('save_invoice_draft', {
      p_input: {
        id: null,
        updated_at: null,
        tenant_id: s.tenantId,
        booking_id: bookingId,
        kind: 'invoice',
        invoice_date: '2026-10-20',
        recipient_kind: 'guest',
        recipient: { name: 'Maria Huber', line1: 'Gartenweg 3', line2: '', postal_code: '5020', city: 'Salzburg', country: 'AT', vat_id: '' },
        company_salutation: 'generic',
        guest_names: 'none',
        partial: null,
        lines: [{ label: 'Übernachtung', amount_cents: 50000, vat_rate: '10.00', source_kind: 'nights', source_charge_id: null }],
        deduction_ids: [],
        texts: { intro: { block_id: null, body: null }, payment: { block_id: null, body: null }, closing: { block_id: null, body: null } },
        payment: { deposit_percent: null, deposit_days: null, due_days: 0, due_basis: 'after_invoice' },
        booking_fingerprint: null,
      } as unknown as Json,
    })
    if (error) throw error
    const id = draftId as string
    await service().from('tenants').update({ address_line1: 'Seeweg 12', postal_code: '5340', city: 'St. Gilgen', country: 'AT', vat_id: 'ATU12345678' } as never).eq('id', s.tenantId)
    await signInAs(page, s.owner)
    const { data: r } = await service().from('invoices').select('updated_at').eq('id', id).single()
    const issue = await page.request.post(`/api/rechnungen/${id}/ausstellen`, { data: { invoiceDate: '2026-10-20', number: '2026-0001', updatedAt: r!.updated_at, acks: [] } })
    expect(await issue.json()).toEqual({ ok: true, id })
    // Fällig am Rechnungsdatum, nichts bezahlt: überfällig
    await openInvoice(page, id)
    await expect(section(page).getByText('überfällig', { exact: true }).first()).toBeVisible()
    await addPayment(s, id, { amount_cents: 30000 })
    const res = await page.request.post(`/api/rechnungen/${id}/gutschrift`, { data: { invoiceDate: '2026-10-20', number: '2026-0002', reason: '', acks: [] } })
    const credit = (await res.json()) as { ok: boolean; id: string }
    expect(credit.ok).toBe(true)
    await openInvoice(page, id)
    await expect(section(page).getByText('Guthaben € 300,00')).toBeVisible()
    await expect(section(page).getByRole('button', { name: 'Zahlung erfassen' })).toHaveCount(0)
    await section(page).getByRole('link', { name: 'Zur Gutschrift 2026-0002' }).click()
    await ready(page)
    const refunds = page.getByRole('region', { name: 'Rückzahlungen' })
    await expect(refunds.getByText('Rückzahlung offen € 300,00')).toBeVisible()
    await refunds.getByRole('button', { name: 'Rückzahlung erfassen' }).click()
    await expect(panel(page).getByLabel('Betrag')).toHaveValue('300,00')
    await expect(panel(page).getByLabel('Provision')).toHaveCount(0)
    await panel(page).getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Rückzahlung erfasst.', { exact: true })).toBeVisible()
    await expect(refunds.getByText('erstattet', { exact: true })).toBeVisible()
    expect(plain(await refunds.locator('ul').textContent())).toContain('-€ 300,00')
  })
})

test.describe('QA-Regression', () => {
  test('BUG-3: Gutschrift zu einer nie bezahlten Rechnung zeigt keinen Abschnitt „Rückzahlungen“', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const bookingId = await addBooking(s)
    const client = await signedIn(s.owner)
    const { data: draftId, error } = await client.rpc('save_invoice_draft', {
      p_input: {
        id: null,
        updated_at: null,
        tenant_id: s.tenantId,
        booking_id: bookingId,
        kind: 'invoice',
        invoice_date: '2026-10-20',
        recipient_kind: 'guest',
        recipient: { name: 'Maria Huber', line1: 'Gartenweg 3', line2: '', postal_code: '5020', city: 'Salzburg', country: 'AT', vat_id: '' },
        company_salutation: 'generic',
        guest_names: 'none',
        partial: null,
        lines: [{ label: 'Übernachtung', amount_cents: 50000, vat_rate: '10.00', source_kind: 'nights', source_charge_id: null }],
        deduction_ids: [],
        texts: { intro: { block_id: null, body: null }, payment: { block_id: null, body: null }, closing: { block_id: null, body: null } },
        payment: { deposit_percent: null, deposit_days: null, due_days: 14, due_basis: 'after_invoice' },
        booking_fingerprint: null,
      } as unknown as Json,
    })
    if (error) throw error
    const id = draftId as string
    await service().from('tenants').update({ address_line1: 'Seeweg 12', postal_code: '5340', city: 'St. Gilgen', country: 'AT', vat_id: 'ATU12345678' } as never).eq('id', s.tenantId)
    await signInAs(page, s.owner)
    const { data: r } = await service().from('invoices').select('updated_at').eq('id', id).single()
    const issue = await page.request.post(`/api/rechnungen/${id}/ausstellen`, { data: { invoiceDate: '2026-10-20', number: '2026-0001', updatedAt: r!.updated_at, acks: [] } })
    expect(await issue.json()).toEqual({ ok: true, id })
    const res = await page.request.post(`/api/rechnungen/${id}/gutschrift`, { data: { invoiceDate: '2026-10-20', number: '2026-0002', reason: '', acks: [] } })
    const credit = (await res.json()) as { ok: boolean; id: string }
    expect(credit.ok).toBe(true)
    await openInvoice(page, credit.id)
    await expect(page.getByRole('heading', { name: '2026-0002' })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Rückzahlungen' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Rückzahlung erfassen' })).toHaveCount(0)
  })
})

test.describe('Zahlungsliste', () => {
  test('AC: Monat mit Summen, Filter Zahlungsart, Suche, „Alle Monate“, Rückzahlung negativ', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const bookingId = await addBooking(s, 'booking_com')
    const a = await addInvoice(s, { booking_id: bookingId, number: 'QA45-LISTE-A' })
    const b = await addInvoice(s, { number: 'QA45-LISTE-B', recipient: 'Zander Paul' })
    await addPayment(s, a, { amount_cents: 40000, commission_cents: 5000, method_id: s.method('über booking.com') })
    await addPayment(s, b, { amount_cents: 12000, method_id: s.method('Bar'), note: 'Schlüsselübergabe' })
    await addPayment(s, b, { amount_cents: 3000, paid_on: '2025-03-01' })
    await signInAs(page, s.owner)
    await page.goto('/zahlungen')
    await ready(page)
    await expect(page.getByText('2 Zahlungen')).toBeVisible()
    const totals = page.getByLabel('Summen')
    expect(plain(await totals.textContent())).toContain('€ 520,00')
    expect(plain(await totals.textContent())).toContain('€ 50,00')
    await page.getByLabel('Zahlungsart').click()
    await page.getByRole('option', { name: 'Bar' }).click()
    await expect(page.getByText('1 Zahlung')).toBeVisible()
    await expect(page).toHaveURL(/art=/)
    await page.getByRole('searchbox', { name: 'Zahlungen durchsuchen' }).fill('Schlüssel')
    await expect(page.getByRole('row').filter({ hasText: 'Zander Paul' })).toBeVisible()
    await page.goto('/zahlungen?monat=alle')
    await ready(page)
    await expect(page.getByText('3 Zahlungen')).toBeVisible()
    await page.goto(`/zahlungen?monat=2024-01`)
    await ready(page)
    await expect(page.getByText('Keine Zahlungen in diesem Zeitraum.', { exact: false })).toBeVisible()
    expect(thisMonth()).toMatch(/^\d{4}-\d{2}$/)
  })

  test('AC: leere Liste ohne Zahlungen; Menüpunkt zwischen „Rechnungen“ und „Einstellungen“', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    await signInAs(page, s.owner)
    await page.goto('/zahlungen')
    await ready(page)
    await expect(page.getByText('Noch keine Zahlungen')).toBeVisible()
    const names = (await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link').allInnerTexts()).map((l) => l.trim())
    expect(names.indexOf('Zahlungen')).toBe(names.indexOf('Rechnungen') + 1)
    expect(names.indexOf('Einstellungen')).toBe(names.indexOf('Zahlungen') + 1)
  })
})

test.describe('Einstellungen → Zahlungen', () => {
  test('AC: Standardarten, anlegen, doppelter Name, deaktivieren (fehlt dann in der Auswahl), Standard nicht deaktivierbar', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const id = await addInvoice(s)
    await signInAs(page, s.owner)
    await page.goto('/einstellungen/zahlungen')
    await ready(page)
    const list = page.getByRole('region', { name: 'Zahlungsarten' })
    for (const name of ['Überweisung', 'Bar', 'Karte', 'PayPal', 'über booking.com', 'über Airbnb']) await expect(list.getByText(name, { exact: true })).toBeVisible()
    await expect(list.getByText('Standard', { exact: true })).toBeVisible()
    await page.getByLabel('Neue Zahlungsart').fill('bar')
    await page.getByRole('button', { name: 'Hinzufügen' }).click()
    await expect(page.getByText('Diese Zahlungsart gibt es bereits.')).toBeVisible()
    await page.getByLabel('Neue Zahlungsart').fill('Gutschein')
    await page.getByRole('button', { name: 'Hinzufügen' }).click()
    await expect(page.getByText('Zahlungsart angelegt.', { exact: true })).toBeVisible()
    await expect(list.getByText('Gutschein', { exact: true })).toBeVisible()
    await list.getByRole('button', { name: 'Aktionen für Überweisung' }).click()
    await page.getByRole('menuitem', { name: 'Deaktivieren' }).click()
    await expect(page.getByText('Bitte zuerst eine andere Zahlungsart als Standard wählen.')).toBeVisible()
    await list.getByRole('button', { name: 'Aktionen für PayPal' }).click()
    await page.getByRole('menuitem', { name: 'Deaktivieren' }).click()
    await expect(page.getByText('„PayPal“ deaktiviert.')).toBeVisible()
    await expect(list.getByText('deaktiviert', { exact: true })).toBeVisible()
    await openInvoice(page, id)
    await section(page).getByRole('button', { name: 'Zahlung erfassen' }).click()
    await panel(page).getByRole('combobox', { name: 'Zahlungsart' }).click()
    await expect(page.getByRole('option', { name: 'Gutschein' })).toBeVisible()
    await expect(page.getByRole('option', { name: 'PayPal' })).toHaveCount(0)
  })
})

test.describe('Nacherfassen mit „Bereits bezahlt“', () => {
  test('AC: Schalter legt eine Zahlung über den vollen Betrag an; Rechnung „bezahlt“', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    await signInAs(page, s.owner)
    await page.goto('/rechnungen')
    await ready(page)
    await page.getByRole('button', { name: 'Rechnung nacherfassen' }).first().click()
    const p = panel(page)
    await p.getByLabel('Rechnungsnummer').fill('ALT-45')
    await p.getByLabel('Rechnungsdatum').fill('2026-09-01')
    await p.getByLabel('Empfänger').fill('Altkunde')
    if ((await p.getByLabel('Bezeichnung der Position 1').count()) === 0) await p.getByRole('button', { name: 'Position hinzufügen' }).click()
    await p.getByLabel('Bezeichnung der Position 1').fill('Übernachtung')
    await p.getByLabel('Betrag der Position 1').fill('300')
    await p.getByLabel('Bereits bezahlt').click()
    await expect(p.getByRole('combobox', { name: 'Zahlungsart' })).toHaveText('Überweisung')
    await expect(p.getByLabel('Zahlungsdatum')).toHaveValue('2026-09-01')
    const button = p.getByRole('button', { name: 'Rechnung speichern', exact: true })
    await button.scrollIntoViewIfNeeded()
    await button.click()
    await expect(page).toHaveURL(/\/rechnungen\/[0-9a-f-]{36}$/)
    await ready(page)
    await expect(section(page).getByText('bezahlt', { exact: true })).toBeVisible()
    expect(plain(await section(page).locator('ul').textContent())).toContain('€ 300,00')
  })
})

test.describe('Layout und Barrierefreiheit', () => {
  test('AC: Rechnungsdetail mit Zahlungen und Zahlungsliste ohne waagrechtes Scrollen und ohne axe-Fehler', async ({ page, users }) => {
    const s = await setup(users)
    const bookingId = await addBooking(s, 'airbnb')
    const id = await addInvoice(s, { booking_id: bookingId })
    await addPayment(s, id, { amount_cents: 40000, commission_cents: 5000, note: 'Auszahlung Airbnb' })
    await signInAs(page, s.owner)
    for (const path of [`/rechnungen/${id}`, '/zahlungen', '/einstellungen/zahlungen']) {
      await page.goto(path)
      await ready(page)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, path).toBeLessThanOrEqual(0)
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
      expect(results.violations, `${path}: ${results.violations.map((v) => v.id).join(', ')}`).toEqual([])
    }
  })
})
