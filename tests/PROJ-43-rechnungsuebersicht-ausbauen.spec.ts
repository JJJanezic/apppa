import { randomUUID } from 'node:crypto'

import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test as base } from '@playwright/test'

import type { Json } from '../src/types/database'
import { anon, createTenant, createUser, deleteUser, type E2EUser, hasSupabaseEnv, service, signInAs } from './support/supabase'

// PROJ-43: Rechnungsübersicht ausbauen. Filter, Summen, Rückweg und „Rechnung erstellen“ in der Oberfläche. Die Regeln für
// Status „storniert“, Zahlungsstand und Summen prüft supabase/tests/invoice-list.integration.test.ts im Einzelnen.

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
const rows = (page: Page) => page.locator('table tbody tr')

async function signedIn(user: E2EUser) {
  const client = anon()
  await client.auth.signInWithPassword({ email: user.email, password: user.password })
  return client
}

async function setup(users: Users, { staff = false } = {}) {
  const owner = await users({ displayName: 'Olga Owner' })
  const members: { user: E2EUser; role: 'owner' | 'staff' }[] = [{ user: owner, role: 'owner' }]
  const staffUser = staff ? await users({ displayName: 'Sam Staff' }) : undefined
  if (staffUser) members.push({ user: staffUser, role: 'staff' })
  const tenantId = await createTenant(`QA43 Testkunde ${randomUUID().slice(0, 8)}`, members)
  return { owner, staff: staffUser, tenantId }
}

let seq = 4300
async function addApartment(tenantId: string) {
  const { data: property, error } = await service()
    .from('properties')
    .insert({ tenant_id: tenantId, name: 'Haus See', street: 'Seeweg 12', postal_code: '5340', city: 'St. Gilgen', municipality_code: '50330' })
    .select('id')
    .single()
  if (error) throw error
  const { data: apartment, error: apartmentError } = await service()
    .from('apartments')
    .insert({ tenant_id: tenantId, property_id: property.id, name: 'Top 3', max_guests: 4, price_cents: 10000 } as never)
    .select('id')
    .single()
  if (apartmentError) throw apartmentError
  return (apartment as { id: string }).id
}

async function addGuest(tenantId: string, last = 'Huber') {
  const { data, error } = await service()
    .from('guests')
    .insert({ tenant_id: tenantId, country: 'AT', last_name: last, first_name: 'Maria', street: 'Gartenweg 3', postal_code: '5020', city: 'Salzburg', address_country: 'AT' } as never)
    .select('id')
    .single()
  if (error) throw error
  return (data as { id: string }).id
}

async function addBooking(tenantId: string, apartmentId: string, guestId: string, arrival: string, departure: string, nights = 90000) {
  const { data, error } = await service()
    .from('bookings')
    .insert({
      tenant_id: tenantId,
      apartment_id: apartmentId,
      kind: 'booking',
      arrival,
      planned_departure: departure,
      departure,
      guest_id: guestId,
      check_in: '15:00',
      check_out: '10:00',
      adults: 2,
      child_ages: [],
      number_year: Number(arrival.slice(0, 4)),
      number_seq: ++seq,
    } as never)
    .select('id, number')
    .single()
  if (error) throw error
  const row = data as { id: string; number: string }
  const { error: amountError } = await service()
    .from('booking_amounts')
    .insert({ id: row.id, tenant_id: tenantId, nights_cents: nights, nights_vat_rate: 10, cancellation_fee_cents: null, cancellation_fee_vat_rate: 0 } as never)
  if (amountError) throw amountError
  return row
}

// Nacherfasste Rechnung (im Namen des Inhabers)
async function addBackfilled(owner: E2EUser, tenantId: string, o: { number: string; date: string; cents: number; bookingId?: string }) {
  const client = await signedIn(owner)
  const { data, error } = await client.rpc('save_invoice', {
    p_input: {
      tenant_id: tenantId,
      number: o.number,
      invoice_date: o.date,
      booking_id: o.bookingId ?? null,
      recipient: 'Huber Maria',
      lines: [{ label: 'Leistung', amount_cents: o.cents, vat_rate: '10.00' }],
    } as unknown as Json,
  })
  if (error) throw error
  return (data as { id: string }).id
}

// Entwurf wie die Server-Aktion ihn speichert
async function addDraft(owner: E2EUser, tenantId: string, bookingId: string, date: string, cents: number) {
  const client = await signedIn(owner)
  const { data, error } = await client.rpc('save_invoice_draft', {
    p_input: {
      id: null,
      updated_at: null,
      tenant_id: tenantId,
      booking_id: bookingId,
      kind: 'invoice',
      invoice_date: date,
      recipient_kind: 'guest',
      recipient: { name: 'Maria Huber', line1: 'Gartenweg 3', line2: '', postal_code: '5020', city: 'Salzburg', country: 'AT', vat_id: '' },
      company_salutation: 'generic',
      guest_names: 'none',
      partial: null,
      lines: [{ label: 'Übernachtung', amount_cents: cents, vat_rate: '10.00', source_kind: 'nights', source_charge_id: null }],
      deduction_ids: [],
      texts: { intro: { block_id: null, body: null }, payment: { block_id: null, body: null }, closing: { block_id: null, body: null } },
      payment: { deposit_percent: null, deposit_days: null, due_days: 0, due_basis: 'after_invoice' },
      booking_fingerprint: null,
    } as unknown as Json,
  })
  if (error) throw error
  return data as string
}

async function openList(page: Page, search = '') {
  await page.goto(`/rechnungen${search}`)
  await ready(page)
}

async function chooseOption(page: Page, label: string, option: string) {
  await page.getByLabel(label, { exact: true }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

// Rechnungen über zwei Jahre, Beträge an den Grenzen, ein Entwurf
async function seedList(owner: E2EUser, tenantId: string) {
  const apt = await addApartment(tenantId)
  const guest = await addGuest(tenantId)
  const booking = await addBooking(tenantId, apt, guest, '2026-10-14', '2026-10-17')
  await addBackfilled(owner, tenantId, { number: 'AR-2025-12', date: '2025-12-31', cents: 9999 })
  await addBackfilled(owner, tenantId, { number: 'AR-2026-01', date: '2026-01-01', cents: 10000 })
  await addBackfilled(owner, tenantId, { number: 'AR-2026-02', date: '2026-02-01', cents: 50000 })
  await addBackfilled(owner, tenantId, { number: 'AR-2026-03', date: '2026-03-01', cents: 50001 })
  await addDraft(owner, tenantId, booking.id, '2026-10-20', 30000)
  return { apt, guest, booking }
}

test.describe('Filter', () => {
  test('AC: Jahr, Status, Betrag (Grenzen inklusive), Adresse, Zurücksetzen; Mitarbeiter sieht die Filter', async ({ page, users }) => {
    desktopOnly()
    const { owner, staff, tenantId } = await setup(users, { staff: true })
    await seedList(owner, tenantId)
    await signInAs(page, owner)
    await openList(page)

    // Standard: alle Jahre, alle Rechnungen; kein „Filter zurücksetzen“
    await expect(page.getByLabel('Jahr', { exact: true })).toHaveText('Alle Jahre')
    await expect(rows(page)).toHaveCount(5)
    await expect(page.getByRole('link', { name: 'Filter zurücksetzen' })).toHaveCount(0)

    // Jahr 2026: die Rechnung vom 31.12.2025 fällt weg, der Entwurf bleibt
    await chooseOption(page, 'Jahr', '2026')
    await expect(page).toHaveURL(/jahr=2026/)
    await expect(rows(page)).toHaveCount(4)
    await expect(page.getByRole('link', { name: 'AR-2025-12' })).toHaveCount(0)

    // Status Entwurf
    await chooseOption(page, 'Status', 'Entwurf')
    await expect(page).toHaveURL(/status=draft/)
    await expect(rows(page)).toHaveCount(1)
    await chooseOption(page, 'Status', 'nacherfasst')
    await expect(rows(page)).toHaveCount(3)

    // Betrag 100 bis 500 (inklusive)
    await page.getByLabel('Betrag von').fill('100')
    await page.getByLabel('Betrag bis').fill('500')
    await page.getByRole('button', { name: 'Anwenden' }).click()
    await expect(page).toHaveURL(/von=100&bis=500/)
    await expect(rows(page)).toHaveCount(2)
    await expect(page.getByRole('link', { name: 'AR-2026-03' })).toHaveCount(0)

    // Neuer Tab mit derselben Adresse: dieselbe Liste
    const url = page.url()
    await page.goto(url)
    await ready(page)
    await expect(rows(page)).toHaveCount(2)
    await expect(page.getByLabel('Betrag von')).toHaveValue('100,00')

    // Ungültige Eingaben: Hinweis, Filter bleibt
    await page.getByLabel('Betrag von').fill('500')
    await page.getByLabel('Betrag bis').fill('100')
    await page.getByRole('button', { name: 'Anwenden' }).click()
    await expect(page.getByRole('main').getByRole('alert')).toContainText('„Von“ darf nicht größer als „Bis“ sein.')
    expect(page.url()).toBe(url)
    await page.getByLabel('Betrag von').fill('abc')
    await page.getByRole('button', { name: 'Anwenden' }).click()
    await expect(page.getByRole('main').getByRole('alert')).toContainText('kein gültiger Betrag')

    // Zurücksetzen
    await page.getByRole('link', { name: 'Filter zurücksetzen' }).click()
    await expect(page).toHaveURL(/\/rechnungen$/)
    await expect(rows(page)).toHaveCount(5)

    // Mitarbeiter: Filter ja, „Rechnung erstellen“ nein
    await page.context().clearCookies()
    await signInAs(page, staff!)
    await openList(page, '?jahr=2025')
    await expect(rows(page)).toHaveCount(1)
    await expect(page.getByRole('button', { name: 'Rechnung erstellen' })).toHaveCount(0)
  })

  test('AC: anderes Jahr frei eingeben; ungültige Eingabe und Werte in der Adresse', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    await addBackfilled(owner, tenantId, { number: 'AR-2012-1', date: '2012-05-01', cents: 10000 })
    await addBackfilled(owner, tenantId, { number: 'AR-2026-1', date: '2026-05-01', cents: 10000 })
    await signInAs(page, owner)
    await openList(page)

    await chooseOption(page, 'Jahr', 'Anderes Jahr …')
    await page.getByLabel('Jahr eingeben').fill('20x6')
    await page.getByRole('button', { name: 'Anzeigen' }).click()
    await expect(page.getByRole('main').getByRole('alert')).toContainText('vierstelliges Jahr')
    await page.getByLabel('Jahr eingeben').fill('2012')
    await page.getByRole('button', { name: 'Anzeigen' }).click()
    await expect(page).toHaveURL(/jahr=2012/)
    await expect(rows(page)).toHaveCount(1)
    await expect(page.getByLabel('Jahr', { exact: true })).toHaveText('2012')

    // Ungültige Werte in der Adresse werden ignoriert
    await openList(page, '?jahr=abc&zahlung=xyz&status=foo&von=1,5')
    await expect(rows(page)).toHaveCount(2)
    await expect(page.getByRole('link', { name: 'Filter zurücksetzen' })).toHaveCount(0)

    // Jahr ohne Rechnungen: Hinweis mit „Filter zurücksetzen“
    await openList(page, '?jahr=2030')
    await expect(page.getByText('Keine Rechnungen gefunden')).toBeVisible()
    await expect(page.getByRole('main').getByRole('link', { name: 'Filter zurücksetzen' }).first()).toBeVisible()
  })

  test('AC: Handy – Filter zusammengeklappt mit Anzahl, Suche sichtbar; ohne Barrierefehler', async ({ page, users }) => {
    test.skip(test.info().project.name !== 'mobile', 'nur Handy')
    const { owner, tenantId } = await setup(users)
    await addBackfilled(owner, tenantId, { number: 'AR-2026-1', date: '2026-05-01', cents: 10000 })
    await signInAs(page, owner)
    await openList(page, '?jahr=2026&status=backfilled')
    await expect(page.getByRole('searchbox', { name: 'Rechnungen suchen' })).toBeVisible()
    const toggle = page.getByRole('button', { name: /^Filter \(2\)/ })
    await expect(toggle).toBeVisible()
    await expect(page.getByLabel('Status', { exact: true })).toBeHidden()
    await toggle.click()
    await expect(page.getByLabel('Status', { exact: true })).toBeVisible()
    const results = await new AxeBuilder({ page }).include('main').analyze()
    expect(results.violations).toEqual([])
  })
})

test.describe('Zahlung und Summen', () => {
  test('AC: „noch nicht bezahlt“ zeigt offene und teilweise bezahlte; Summen über die gefilterte Liste', async ({ page, users }) => {
    desktopOnly()
    const { owner, staff, tenantId } = await setup(users, { staff: true })
    const partial = await addBackfilled(owner, tenantId, { number: 'Z-TEIL', date: '2026-03-01', cents: 45000 })
    await addBackfilled(owner, tenantId, { number: 'Z-OFFEN', date: '2026-03-02', cents: 20000 })
    const paid = await addBackfilled(owner, tenantId, { number: 'Z-BEZAHLT', date: '2026-03-03', cents: 30000 })
    const client = await signedIn(owner)
    const { data: methods } = await service().from('payment_methods').select('id').eq('tenant_id', tenantId).eq('is_default', true)
    for (const [invoiceId, cents] of [
      [partial, 10000],
      [paid, 30000],
    ] as const) {
      const { error } = await client.rpc('record_payment', {
        p_input: {
          tenant_id: tenantId,
          kind: 'payment',
          invoice_id: invoiceId,
          paid_on: '2026-03-10',
          amount_cents: cents,
          commission_cents: 0,
          fee_cents: 0,
          method_id: methods![0].id,
          note: null,
          receipt_path: null,
          confirmed: true,
        } as unknown as Json,
      })
      if (error) throw error
    }
    await signInAs(page, owner)
    await openList(page)
    await expect(page.getByLabel('Summen der gefilterten Rechnungen')).toContainText('€ 950,00')
    await expect(page.getByLabel('Summen der gefilterten Rechnungen')).toContainText('€ 400,00')
    await expect(page.getByLabel('Summen der gefilterten Rechnungen')).toContainText('€ 550,00')

    await chooseOption(page, 'Zahlung', 'noch nicht bezahlt')
    await expect(page).toHaveURL(/zahlung=unpaid/)
    await expect(rows(page)).toHaveCount(2)
    await expect(page.getByRole('link', { name: 'Z-BEZAHLT' })).toHaveCount(0)
    const sums = page.getByLabel('Summen der gefilterten Rechnungen')
    await expect(sums.getByRole('definition').nth(0)).toHaveText('€ 650,00')
    await expect(sums.getByRole('definition').nth(1)).toHaveText('€ 100,00')
    await expect(sums.getByRole('definition').nth(2)).toHaveText('€ 550,00')
    await expect(page.getByText('wirken erst nach dem nächsten Update')).toHaveCount(0)

    // Kombination ohne Treffer: keine Summen
    await chooseOption(page, 'Status', 'storniert')
    await expect(page.getByText('Keine Rechnungen gefunden')).toBeVisible()
    await expect(page.getByLabel('Summen der gefilterten Rechnungen')).toHaveCount(0)

    // Mitarbeiter sieht dieselben Summen
    await page.context().clearCookies()
    await signInAs(page, staff!)
    await openList(page, '?zahlung=unpaid')
    await expect(page.getByLabel('Summen der gefilterten Rechnungen').getByRole('definition').nth(2)).toHaveText('€ 550,00')
  })
})

test.describe('Rückweg', () => {
  test('AC: „Zurück zur Liste“ mit Filtern, Suche und Seite; Menüpunkt ohne Filter', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    await addBackfilled(owner, tenantId, { number: 'AR-2025-1', date: '2025-05-01', cents: 10000 })
    await addBackfilled(owner, tenantId, { number: 'AR-2026-1', date: '2026-05-01', cents: 10000 })
    await signInAs(page, owner)
    await openList(page, '?q=AR&jahr=2026')
    await page.getByRole('link', { name: 'AR-2026-1' }).click()
    await ready(page)
    await page.getByRole('link', { name: 'Zurück zur Liste' }).click()
    await expect(page).toHaveURL(/\/rechnungen\?q=AR&jahr=2026$/)
    await expect(rows(page)).toHaveCount(1)

    await page.getByRole('navigation').getByRole('link', { name: 'Rechnungen', exact: true }).first().click()
    await expect(page).toHaveURL(/\/rechnungen$/)
    await expect(rows(page)).toHaveCount(2)
  })
})

test.describe('Rechnung erstellen aus der Übersicht', () => {
  test('AC: Suche zeigt wählbare und voll verrechnete Buchungen; Wahl öffnet den Entwurf; Abbrechen führt zur Liste', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const apt = await addApartment(tenantId)
    const open = await addBooking(tenantId, apt, await addGuest(tenantId, 'Offenbach'), '2026-10-14', '2026-10-17')
    const billed = await addBooking(tenantId, apt, await addGuest(tenantId, 'Fertigmann'), '2026-10-20', '2026-10-23')
    await addBackfilled(owner, tenantId, { number: 'AR-VOLL', date: '2026-10-23', cents: 90000, bookingId: billed.id })
    await signInAs(page, owner)
    await openList(page, '?jahr=2026')

    await page.getByRole('button', { name: 'Rechnung erstellen' }).click()
    const dialog = page.getByRole('dialog', { name: 'Rechnung erstellen' })
    await dialog.getByRole('combobox', { name: 'Buchung suchen' }).fill('Fertig')
    const blocked = dialog.getByRole('option', { name: /Fertigmann/ })
    await expect(blocked).toContainText('Bereits vollständig verrechnet oder in Entwürfen.')
    await expect(blocked).toHaveAttribute('aria-disabled', 'true')

    await dialog.getByRole('combobox', { name: 'Buchung suchen' }).fill(open.number)
    await dialog.getByRole('option', { name: /Offenbach/ }).click()
    await expect(page).toHaveURL(new RegExp(`/rechnungen/neu\\?buchung=${open.id}&von=liste`))
    await ready(page)
    await expect(page.getByRole('heading', { name: 'Rechnung erstellen' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Zurück zur Liste' })).toBeVisible()
    await page.getByRole('button', { name: 'Abbrechen' }).click()
    await expect(page).toHaveURL(/\/rechnungen\?jahr=2026$/)
  })
})

// ---- QA (2026-11-07) --------------------------------------------------------------------------------------------------

const SHA = 'e'.repeat(64)
async function uploadPdf(tenantId: string) {
  const path = `${tenantId}/${randomUUID()}.pdf`
  const { error } = await service().storage.from('invoices').upload(path, Buffer.from('%PDF-1.4\n%%EOF\n'), { contentType: 'application/pdf' })
  if (error) throw error
  return path
}
// Entwurf ausstellen bzw. Gutschrift dazu wie die Server-Schnittstelle (im Namen des Inhabers, PDF-Pfad als Platzhalter)
async function issueDraft(owner: E2EUser, tenantId: string, draftId: string, number: string) {
  const { data: r } = await service().from('invoices').select('updated_at, total_cents, booking_id').eq('id', draftId).single()
  const { data: b } = await service().from('bookings').select('updated_at').eq('id', r!.booking_id!).single()
  const { error } = await service().rpc('issue_invoice', {
    p_input: {
      id: draftId,
      tenant_id: tenantId,
      actor_id: owner.id,
      updated_at: r!.updated_at,
      booking_updated_at: b!.updated_at,
      number,
      invoice_date: '2026-10-20',
      small_business: false,
      total_cents: r!.total_cents,
      pdf_sha256: SHA,
      without_logo: false,
      snapshot: { kind: 'invoice', schedule: { due: '2099-01-01', depositCents: null, depositDue: null, remainderCents: null } },
      pdf_path: await uploadPdf(tenantId),
    } as unknown as Json,
  })
  if (error) throw error
}
async function creditFor(owner: E2EUser, tenantId: string, invoiceId: string, number: string) {
  const { data: r } = await service().from('invoices').select('total_cents').eq('id', invoiceId).single()
  const { error } = await service().rpc('issue_credit_note', {
    p_input: {
      invoice_id: invoiceId,
      tenant_id: tenantId,
      actor_id: owner.id,
      number,
      invoice_date: '2026-10-25',
      reason: null,
      total_cents: -r!.total_cents,
      pdf_sha256: SHA,
      without_logo: false,
      snapshot: { kind: 'invoice', credit: { invoiceId } },
      pdf_path: await uploadPdf(tenantId),
    } as unknown as Json,
  })
  if (error) throw error
}

test.describe('QA: Status in der Oberfläche', () => {
  test('AC: ausgestellt ohne stornierte, storniert ohne Gutschrift, Gutschrift allein; Summen heben sich auf', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId)
    const b1 = await addBooking(tenantId, apt, guest, '2026-10-01', '2026-10-04')
    const b2 = await addBooking(tenantId, apt, guest, '2026-10-05', '2026-10-08')
    const d1 = await addDraft(owner, tenantId, b1.id, '2026-10-20', 90000)
    const d2 = await addDraft(owner, tenantId, b2.id, '2026-10-20', 90000)
    await issueDraft(owner, tenantId, d1, 'QA-A1')
    await issueDraft(owner, tenantId, d2, 'QA-A2')
    await creditFor(owner, tenantId, d2, 'QA-G1')
    await signInAs(page, owner)
    await openList(page)
    await expect(rows(page)).toHaveCount(3)
    const sums = page.getByLabel('Summen der gefilterten Rechnungen').getByRole('definition')
    // 900 + 900 − 900; offen nur die nicht stornierte
    await expect(sums.nth(0)).toHaveText('€ 900,00')
    await expect(sums.nth(2)).toHaveText('€ 900,00')
    await chooseOption(page, 'Status', 'ausgestellt')
    await expect(rows(page)).toHaveCount(1)
    await expect(page.getByRole('link', { name: 'QA-A1' })).toBeVisible()
    await chooseOption(page, 'Status', 'storniert')
    await expect(rows(page)).toHaveCount(1)
    await expect(page.getByRole('link', { name: 'QA-A2' })).toBeVisible()
    await chooseOption(page, 'Status', 'Gutschrift')
    await expect(rows(page)).toHaveCount(1)
    await expect(page.getByRole('link', { name: 'QA-G1' })).toBeVisible()
    await expect(sums.nth(0)).toHaveText('-€ 900,00')
    await chooseOption(page, 'Zahlung', 'offen')
    await expect(page.getByText('Keine Rechnungen gefunden')).toBeVisible()
  })
})

test.describe('QA: Blättern, Suche und Filter zusammen', () => {
  test('AC: Blättern behält Filter, Filterwechsel springt auf Seite 1, Tippen in der Suche behält Filter; Rückweg auf Seite 2', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const many = Array.from({ length: 55 }, (_, i) => ({
      tenant_id: tenantId,
      number: `B-${String(i).padStart(3, '0')}`,
      invoice_date: '2026-04-01',
      recipient: 'Huber Maria',
      total_cents: 10000 + i,
    }))
    expect((await service().from('invoices').insert(many as never)).error).toBeNull()
    await addBackfilled(owner, tenantId, { number: 'ALT-2025', date: '2025-04-01', cents: 10000 })
    await signInAs(page, owner)
    await openList(page, '?jahr=2026')
    await expect(page.getByText('55 Treffer')).toBeVisible()
    await page.getByRole('link', { name: /Weiter/ }).first().click()
    await expect(page).toHaveURL(/jahr=2026.*seite=2/)
    await expect(rows(page)).toHaveCount(5)
    // Rückweg von Seite 2
    await rows(page).first().getByRole('link').first().click()
    await ready(page)
    await page.getByRole('link', { name: 'Zurück zur Liste' }).click()
    await expect(page).toHaveURL(/jahr=2026&seite=2$/)
    // Filterwechsel → Seite 1
    await ready(page)
    await chooseOption(page, 'Status', 'nacherfasst')
    await expect(page).not.toHaveURL(/seite=/)
    await expect(rows(page)).toHaveCount(50)
    // Suche behält die Filter
    await page.getByRole('searchbox', { name: 'Rechnungen suchen' }).fill('B-05')
    await expect(page).toHaveURL(/q=B-05/)
    await expect(page).toHaveURL(/jahr=2026/)
    await expect(page).toHaveURL(/status=backfilled/)
    await expect(rows(page)).toHaveCount(5)
  })
})

test.describe('QA: Rechnung erstellen – Sonderfälle', () => {
  test('AC: Option mit Hinweis; stornierte ohne Gebühr nicht wählbar; Sperre nicht gefunden; Mitarbeiter ohne Zugriff; 20 Treffer', async ({ page, users }) => {
    desktopOnly()
    const { owner, staff, tenantId } = await setup(users, { staff: true })
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId, 'Vielbucher')
    const option = await addBooking(tenantId, apt, await addGuest(tenantId, 'Optionsgast'), '2026-12-01', '2026-12-04')
    await service().from('bookings').update({ kind: 'option', option_until: '2026-12-31' } as never).eq('id', option.id)
    const cancelled = await addBooking(tenantId, apt, await addGuest(tenantId, 'Stornogast'), '2026-12-10', '2026-12-12')
    await service().from('bookings').update({ cancelled_at: new Date().toISOString() } as never).eq('id', cancelled.id)
    await service()
      .from('bookings')
      .insert({ tenant_id: tenantId, apartment_id: apt, kind: 'block', arrival: '2026-12-20', planned_departure: '2026-12-22', departure: '2026-12-22', block_reason: 'owner_use', child_ages: [] } as never)
    for (let i = 0; i < 20; i++) {
      const day = String(1 + i).padStart(2, '0')
      await addBooking(tenantId, apt, guest, `2027-01-${day}`, `2027-01-${day}`.replace(/-(\d\d)$/, (_, d) => `-${String(Number(d) + 1).padStart(2, '0')}`))
    }
    await signInAs(page, owner)
    await openList(page)
    await page.getByRole('button', { name: 'Rechnung erstellen' }).click()
    const dialog = page.getByRole('dialog', { name: 'Rechnung erstellen' })
    const search = dialog.getByRole('combobox', { name: 'Buchung suchen' })

    // 20 Treffer mit Prüfung je Buchung (Antwortzeit: BUG-1 unten)
    await search.fill('Vielbucher')
    await expect(dialog.getByRole('option')).toHaveCount(20, { timeout: 15_000 })

    await search.fill('Stornogast')
    await expect(dialog.getByRole('option', { name: /Stornogast/ })).toHaveAttribute('aria-disabled', 'true')
    await expect(dialog.getByRole('option', { name: /Stornogast/ })).toContainText('Storniert ohne Stornogebühr')
    await search.fill('12.2026')
    await expect(dialog.getByRole('option')).toHaveCount(2)
    await search.fill('Optionsgast')
    await dialog.getByRole('option', { name: /Optionsgast/ }).click()
    await expect(page).toHaveURL(/von=liste/)
    await ready(page)
    await expect(page.getByText('Buchung ist noch eine Option')).toBeVisible()

    // Mitarbeiter: Direktaufruf des Entwurfs aus der Liste → nicht gefunden
    await page.context().clearCookies()
    await signInAs(page, staff!)
    await page.goto(`/rechnungen/neu?buchung=${option.id}&von=liste`)
    await expect(page.getByRole('heading', { name: /nicht gefunden/i })).toBeVisible()
  })
})

test.describe('QA: Sicherheit', () => {
  test('Suchbegriff und Filterwerte mit HTML werden als Text gezeigt; fremde Rechnungen erscheinen nicht', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const other = await setup(users)
    await addBackfilled(other.owner, other.tenantId, { number: 'FREMD-1', date: '2026-05-01', cents: 10000 })
    await addBackfilled(owner, tenantId, { number: 'EIGEN-1', date: '2026-05-01', cents: 10000 })
    let dialogs = 0
    page.on('dialog', async (d) => {
      dialogs++
      await d.dismiss()
    })
    await signInAs(page, owner)
    await openList(page, `?q=${encodeURIComponent('<img src=x onerror=alert(1)>')}&status=${encodeURIComponent('"><script>alert(1)</script>')}&von=1e9&bis=-0`)
    await expect(page.getByRole('searchbox', { name: 'Rechnungen suchen' })).toHaveValue('<img src=x onerror=alert(1)>')
    await expect(page.locator('main img[src="x"]')).toHaveCount(0)
    expect(dialogs).toBe(0)
    await openList(page, '?q=FREMD')
    await expect(page.getByRole('link', { name: 'FREMD-1' })).toHaveCount(0)
    await openList(page)
    await expect(rows(page)).toHaveCount(1)
  })
})

test.describe('QA: Antwortzeit der Buchungssuche', () => {
  // BUG-1 (QA 2026-11-07, behoben): Die Suche „Rechnung erstellen“ las je Treffer Buchung, Positionen und Rechnungen
  // einzeln (Server-Antwort für 20 Treffer ca. 1,4 s, Nacherfassen ca. 0,35 s); jetzt zwei gebündelte Abfragen.
  test('BUG-1: Server-Antwort für 20 Treffer unter 1 s', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId, 'Vielbucher')
    for (let i = 0; i < 20; i++) {
      const day = String(1 + i).padStart(2, '0')
      await addBooking(tenantId, apt, guest, `2027-02-${day}`, `2027-02-${String(2 + i).padStart(2, '0')}`)
    }
    await signInAs(page, owner)
    await openList(page)
    const measure = async (open: () => Promise<void>) => {
      await open()
      const search = page.getByRole('dialog').getByRole('combobox', { name: 'Buchung suchen' }).or(page.getByRole('dialog').getByLabel('Buchung suchen'))
      // Aufwärmen, dann die Antwort des Servers messen (Anfrage → Antwort der Server-Aktion)
      await search.fill('Vielb')
      await expect(page.getByRole('dialog').getByRole('option')).toHaveCount(20, { timeout: 15_000 })
      const isAction = (r: { request: () => { method: () => string; headers: () => Record<string, string> } }) =>
        r.request().method() === 'POST' && 'next-action' in r.request().headers()
      const request = page.waitForRequest((r) => r.method() === 'POST' && 'next-action' in r.headers(), { timeout: 15_000 })
      const response = page.waitForResponse(isAction, { timeout: 15_000 })
      await search.fill('Vielbucher')
      await request
      const start = Date.now()
      await (await response).finished()
      const ms = Date.now() - start
      await page.keyboard.press('Escape')
      return ms
    }
    const backfill = await measure(() => page.getByRole('button', { name: 'Rechnung nacherfassen' }).first().click())
    const draft = await measure(() => page.getByRole('button', { name: 'Rechnung erstellen' }).click())
    test.info().annotations.push({ type: 'Antwortzeit', description: `Nacherfassen ${backfill} ms, Rechnung erstellen ${draft} ms` })
    console.log(`Antwortzeit: Nacherfassen ${backfill} ms, Rechnung erstellen ${draft} ms`)
    expect(draft).toBeLessThan(1000)
  })
})

test.describe('QA: Layout', () => {
  test('Liste mit Filtern und Summen ohne waagrechtes Scrollen und ohne axe-Fehler (Tablet, Desktop)', async ({ page, users }) => {
    test.skip(test.info().project.name === 'mobile', 'Handy eigener Test')
    const { owner, tenantId } = await setup(users)
    await addBackfilled(owner, tenantId, { number: 'L-2026-1', date: '2026-05-01', cents: 123456 })
    await signInAs(page, owner)
    await openList(page, '?jahr=2026&status=backfilled&von=-100&bis=5000')
    await expect(page.getByLabel('Status', { exact: true })).toBeVisible()
    await expect(page.getByLabel('Summen der gefilterten Rechnungen')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([])
    await page.getByRole('button', { name: 'Rechnung erstellen' }).click()
    await expect(page.getByRole('dialog', { name: 'Rechnung erstellen' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })

  // BUG-2 (QA 2026-11-07) war ein Messfehler: axe prüfte den Dialog während der Einblend-Animation (halbtransparent)
  test('BUG-2: Dialog „Rechnung erstellen“ ohne axe-Fehler', async ({ page, users }) => {
    desktopOnly()
    const { owner } = await setup(users)
    await signInAs(page, owner)
    await openList(page)
    await page.getByRole('button', { name: 'Rechnung erstellen' }).click()
    await expect(page.getByRole('dialog', { name: 'Rechnung erstellen' })).toBeVisible()
    // Einblend-Animation abwarten (axe misst sonst halbtransparente Farben)
    await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'))
    expect((await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations).toEqual([])
  })
})

test.describe('QA: Löschen aus der gefilterten Liste', () => {
  // BUG-3 (QA 2026-11-07, behoben): Nach dem Löschen kam die ungefilterte Liste
  test('BUG-3: Nach dem Löschen einer Rechnung erscheint wieder die gefilterte Liste mit Bestätigung', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    await addBackfilled(owner, tenantId, { number: 'DEL-2026-1', date: '2026-05-01', cents: 10000 })
    await addBackfilled(owner, tenantId, { number: 'DEL-2026-2', date: '2026-05-02', cents: 10000 })
    await addBackfilled(owner, tenantId, { number: 'DEL-2025-1', date: '2025-05-01', cents: 10000 })
    await signInAs(page, owner)
    await openList(page, '?jahr=2026')
    await page.getByRole('link', { name: 'DEL-2026-1' }).click()
    await ready(page)
    await page.getByRole('button', { name: 'Löschen' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Endgültig löschen' }).click()
    await expect(page).toHaveURL(/\/rechnungen\?jahr=2026$/)
    await expect(page.getByText('Rechnung gelöscht', { exact: false }).first()).toBeVisible()
    await expect(rows(page)).toHaveCount(1)
    await expect(page.getByRole('link', { name: 'DEL-2026-2' })).toBeVisible()
  })
})
