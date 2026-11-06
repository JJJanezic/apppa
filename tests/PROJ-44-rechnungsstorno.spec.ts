import { randomUUID } from 'node:crypto'

import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test as base } from '@playwright/test'

import type { Json } from '../src/types/database'
import { anon, createTenant, createUser, deleteUser, type E2EUser, hasSupabaseEnv, service, signInAs } from './support/supabase'

// PROJ-44: Gutschrift zu Rechnung. Regeln: src/lib/invoice-credit.test.ts. Die Abläufe mit ausgestellter Gutschrift laufen erst, wenn die
// Datenbank Gutschriften kennt (/backend PROJ-44); bis dahin prüfen die Tests Einstieg, Seite, Prüfungen und Vorschau.

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
const previewText = (page: Page) => page.getByTestId('pdf-text')
const submit = (page: Page) => page.getByRole('button', { name: 'Gutschrift ausstellen', exact: true })
const plain = (v: string | null) => (v ?? '').replace(/ /g, ' ')

// Kennt die Datenbank schon Gutschriften (Spalte aus /backend PROJ-44)?
async function creditReady() {
  const { error } = await service().from('invoices').select('credited_invoice_id' as 'id').limit(1)
  return !error
}

let seq = 7400

async function setup(users: Users, { staff = false } = {}) {
  const owner = await users()
  const staffUser = staff ? await users() : undefined
  const members: { user: E2EUser; role: 'owner' | 'staff' }[] = [{ user: owner, role: 'owner' }]
  if (staffUser) members.push({ user: staffUser, role: 'staff' })
  const tenantId = await createTenant(`QA44 Testkunde ${randomUUID().slice(0, 8)}`, members)
  const db = service()
  await db.from('tenants').update({ address_line1: 'Seeweg 12', postal_code: '5340', city: 'St. Gilgen', country: 'AT', vat_id: 'ATU12345678' } as never).eq('id', tenantId)
  const { data: property, error: pe } = await db
    .from('properties')
    .insert({ tenant_id: tenantId, name: 'Haus See', street: 'Seeweg 12', postal_code: '5340', city: 'St. Gilgen', municipality_code: '50330' })
    .select('id')
    .single()
  if (pe) throw pe
  const { data: apartment, error: ae } = await db
    .from('apartments')
    .insert({ tenant_id: tenantId, property_id: property.id, name: 'Top 3', max_guests: 4, price_cents: 10000 } as never)
    .select('id')
    .single()
  if (ae) throw ae
  const { data: guest, error: ge } = await db
    .from('guests')
    .insert({ tenant_id: tenantId, country: 'AT', last_name: 'Huber', first_name: 'Maria', gender: 'female', street: 'Gartenweg 3', postal_code: '5020', city: 'Salzburg', address_country: 'AT' } as never)
    .select('id')
    .single()
  if (ge) throw ge
  const { data: booking, error: be } = await db
    .from('bookings')
    .insert({
      tenant_id: tenantId,
      apartment_id: (apartment as { id: string }).id,
      kind: 'booking',
      arrival: '2026-10-14',
      planned_departure: '2026-10-17',
      departure: '2026-10-17',
      guest_id: (guest as { id: string }).id,
      check_in: '15:00',
      check_out: '10:00',
      adults: 2,
      child_ages: [],
      number_year: 2026,
      number_seq: ++seq,
    } as never)
    .select('id')
    .single()
  if (be) throw be
  const bookingId = (booking as { id: string }).id
  const { error: me } = await db
    .from('booking_amounts')
    .insert({ id: bookingId, tenant_id: tenantId, nights_cents: 90000, nights_vat_rate: 10, cancellation_fee_cents: null, cancellation_fee_vat_rate: 0 } as never)
  if (me) throw me
  return { owner, staff: staffUser, tenantId, bookingId }
}

async function addDraft(owner: E2EUser, tenantId: string, bookingId: string) {
  const client = anon()
  await client.auth.signInWithPassword({ email: owner.email, password: owner.password })
  const { data, error } = await client.rpc('save_invoice_draft', {
    p_input: {
      id: null,
      updated_at: null,
      tenant_id: tenantId,
      booking_id: bookingId,
      kind: 'invoice',
      invoice_date: '2026-10-20',
      recipient_kind: 'guest',
      recipient: { name: 'Maria Huber', line1: 'Gartenweg 3', line2: '', postal_code: '5020', city: 'Salzburg', country: 'AT', vat_id: '' },
      company_salutation: 'generic',
      guest_names: 'none',
      partial: null,
      lines: [{ label: 'Übernachtung', amount_cents: 90000, vat_rate: '10.00', source_kind: 'nights', source_charge_id: null }],
      deduction_ids: [],
      texts: { intro: { block_id: null, body: null }, payment: { block_id: null, body: null }, closing: { block_id: null, body: null } },
      payment: { deposit_percent: null, deposit_days: null, due_days: 0, due_basis: 'after_invoice' },
      booking_fingerprint: null,
    } as unknown as Json,
  })
  if (error) throw error
  return data as string
}

// Rechnung über die Schnittstelle aus PROJ-42 ausstellen (angemeldet als Inhaber)
async function issueInvoice(page: Page, id: string, number = '2026-0001') {
  const { data } = await service().from('invoices').select('updated_at').eq('id', id).single()
  const res = await page.request.post(`/api/rechnungen/${id}/ausstellen`, { data: { invoiceDate: '2026-10-20', number, updatedAt: data!.updated_at, acks: [] } })
  expect(await res.json()).toEqual({ ok: true, id })
}

async function addBackfilled(owner: E2EUser, tenantId: string) {
  const client = anon()
  await client.auth.signInWithPassword({ email: owner.email, password: owner.password })
  const { data, error } = await client.rpc('save_invoice', {
    p_input: { tenant_id: tenantId, number: 'ALT-1', invoice_date: '2026-09-01', recipient: 'Huber Maria', lines: [{ label: 'Alt', amount_cents: 1000, vat_rate: '10.00' }] } as unknown as Json,
  })
  if (error) throw error
  return (data as { id: string }).id
}

async function openCredit(page: Page, id: string) {
  await page.goto(`/rechnungen/${id}/gutschrift`)
  await ready(page)
  await expect(previewText(page)).toContainText('Gutschriftsbetrag', { timeout: 20_000 })
}

test.describe('Gutschrift: Einstieg und Seite', () => {
  test('AC: Knopf auf der ausgestellten Rechnung; Seite zeigt Verweis, Empfänger, Zeitraum und negative Positionen; Datum heute, Nummer Vorschlag', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const id = await addDraft(s.owner, s.tenantId, s.bookingId)
    await signInAs(page, s.owner)
    await issueInvoice(page, id)
    await page.goto(`/rechnungen/${id}`)
    await ready(page)
    await page.getByRole('link', { name: 'Gutschrift erstellen' }).click()
    await expect(page).toHaveURL(new RegExp(`/rechnungen/${id}/gutschrift$`))
    await ready(page)
    await expect(page.getByRole('heading', { name: 'Gutschrift ausstellen', level: 1 })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Rechnung 2026-0001 vom Di, 20.10.2026' })).toBeVisible()
    await expect(page.getByText('Maria Huber').first()).toBeVisible()
    await expect(page.getByText(/Top 3/).first()).toBeVisible()
    expect(plain(await page.getByText('Übernachtung · 10 %').locator('..').textContent())).toContain('-€ 900,00')
    // Nichts davon ist änderbar: Eingaben nur für Datum, Grund und Nummer
    await expect(page.getByRole('textbox')).toHaveCount(3)
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Vienna' }).format(new Date())
    await expect(page.getByLabel('Gutschriftsdatum')).toHaveValue(today)
    await expect(page.getByLabel('Gutschriftsnummer')).toHaveValue(`${today.slice(0, 4)}-${today.startsWith('2026') ? '0002' : '0001'}`)
    // Vorschau: Überschrift, Verweis, negative Beträge, Aufdruck, keine Bausteine
    await expect(previewText(page)).toContainText('Gutschrift', { timeout: 20_000 })
    const text = plain(await previewText(page).textContent())
    expect(text).toContain('zu Rechnung 2026-0001 vom 20.10.2026')
    expect(text).toContain('-€ 900,00')
    expect(text).toContain('Entwurf')
    expect(text).not.toContain('Grund:')
    await expect(page.getByText('Alle Prüfungen sind in Ordnung.')).toBeVisible()
  })

  test('AC: Grund erscheint auf der Vorschau; über 300 Zeichen und Datum vor der Rechnung oder in der Zukunft sperren', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const id = await addDraft(s.owner, s.tenantId, s.bookingId)
    await signInAs(page, s.owner)
    await issueInvoice(page, id)
    await openCredit(page, id)
    await page.getByLabel('Grund (optional)').fill('Falscher Empfänger')
    await expect(previewText(page)).toContainText('Grund: Falscher Empfänger', { timeout: 20_000 })

    await page.getByLabel('Grund (optional)').fill('x'.repeat(301))
    await expect(page.getByText('Der Grund darf höchstens 300 Zeichen haben (jetzt 301).')).toBeVisible()
    await expect(submit(page)).toBeDisabled()
    await page.getByLabel('Grund (optional)').fill('')

    await page.getByLabel('Gutschriftsdatum').fill('2026-10-19')
    await expect(page.getByText('Das Gutschriftsdatum darf nicht vor dem Rechnungsdatum (20.10.2026) liegen.')).toBeVisible()
    await expect(submit(page)).toBeDisabled()
    await page.getByLabel('Gutschriftsdatum').fill('2099-01-01')
    await expect(page.getByText('Das Gutschriftsdatum liegt in der Zukunft.', { exact: false })).toBeVisible()
    await expect(submit(page)).toBeDisabled()
    await page.getByRole('button', { name: 'Datum auf heute setzen' }).click()
    await expect(submit(page)).toBeEnabled({ timeout: 20_000 })
  })

  test('AC: Nummer vergeben sperrt, Nummer über dem Vorschlag braucht das Häkchen', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const id = await addDraft(s.owner, s.tenantId, s.bookingId)
    await signInAs(page, s.owner)
    await issueInvoice(page, id, `${new Date().getFullYear()}-0001`)
    await openCredit(page, id)
    const year = (await page.getByLabel('Gutschriftsdatum').inputValue()).slice(0, 4)
    await page.getByLabel('Gutschriftsnummer').fill(`${year}-0001`)
    await expect(page.getByText(`Die Nummer ${year}-0001 ist schon vergeben.`)).toBeVisible({ timeout: 20_000 })
    await expect(submit(page)).toBeDisabled()
    await page.getByLabel('Gutschriftsnummer').fill(`${year}-0005`)
    await expect(page.getByText(`Die nächste Nummer wäre danach ${year}-0006.`)).toBeVisible({ timeout: 20_000 })
    await expect(submit(page)).toBeDisabled()
    await page.getByRole('checkbox', { name: 'Diese Nummer trotzdem verwenden' }).click()
    await expect(submit(page)).toBeEnabled()
  })

  test('AC: Mitarbeiter: kein Knopf, Seite nicht erreichbar, Schnittstellen abgelehnt', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users, { staff: true })
    const id = await addDraft(s.owner, s.tenantId, s.bookingId)
    await signInAs(page, s.owner)
    await issueInvoice(page, id)
    await page.context().clearCookies()
    await signInAs(page, s.staff!)
    await page.goto(`/rechnungen/${id}`)
    await ready(page)
    await expect(page.getByRole('link', { name: 'PDF öffnen' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Gutschrift erstellen' })).toHaveCount(0)
    await page.goto(`/rechnungen/${id}/gutschrift`)
    await expect(page).toHaveURL(new RegExp(`/rechnungen/${id}$`))
    const post = await page.request.post(`/api/rechnungen/${id}/gutschrift`, { data: { invoiceDate: '2026-11-06', number: 'X', reason: '', acks: [] } })
    expect(post.status()).toBe(403)
    const preview = await page.request.post('/api/rechnungen/vorschau', { data: { creditFor: id, credit: { invoiceDate: '2026-11-06', number: 'X', reason: '' } } })
    expect(preview.status()).toBe(403)
  })

  test('AC: Nacherfasste Rechnung und Entwurf: kein Knopf, Hinweis auf den bisherigen Weg, Seite führt zurück', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const backfilled = await addBackfilled(s.owner, s.tenantId)
    const draft = await addDraft(s.owner, s.tenantId, s.bookingId)
    await signInAs(page, s.owner)
    await page.goto(`/rechnungen/${backfilled}`)
    await ready(page)
    await expect(page.getByText('Eine nacherfasste Rechnung lässt sich nicht per Gutschrift aus der App stornieren.', { exact: false })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Gutschrift erstellen' })).toHaveCount(0)
    await page.goto(`/rechnungen/${backfilled}/gutschrift`)
    await expect(page).toHaveURL(new RegExp(`/rechnungen/${backfilled}$`))
    await page.goto(`/rechnungen/${draft}/gutschrift`)
    await expect(page).toHaveURL(new RegExp(`/rechnungen/${draft}$`))
    // Am Formular vorbei: keine Gutschrift zu nacherfassten Rechnungen
    const post = await page.request.post(`/api/rechnungen/${backfilled}/gutschrift`, { data: { invoiceDate: '2026-11-06', number: 'G-1', reason: '', acks: [] } })
    expect(post.status()).toBe(409)
  })
})

test.describe('Gutschrift ausstellen und Wirkung', () => {
  test.beforeEach(async () => {
    test.skip(!(await creditReady()), 'Datenbank kennt Gutschriften noch nicht (/backend PROJ-44)')
  })

  test('AC: Ausstellen bis zur Gutschrift; Rechnung storniert mit gegenseitigen Links; Buchung wieder offen; kein zweites Mal', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const id = await addDraft(s.owner, s.tenantId, s.bookingId)
    await signInAs(page, s.owner)
    await issueInvoice(page, id)
    await openCredit(page, id)
    await page.getByLabel('Grund (optional)').fill('Falscher Empfänger')
    const number = await page.getByLabel('Gutschriftsnummer').inputValue()
    await expect(submit(page)).toBeEnabled({ timeout: 20_000 })
    await submit(page).click()
    await expect(page).toHaveURL(/ausgestellt=1/, { timeout: 30_000 })
    await ready(page)
    await expect(page.getByRole('heading', { name: number })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Die Gutschrift wurde ausgestellt.', { exact: false })).toBeVisible()
    await expect(page.getByText('Falscher Empfänger')).toBeVisible()
    await page.getByRole('link', { name: 'Rechnung 2026-0001 vom 20.10.2026' }).click()
    await ready(page)
    await expect(page.getByText('Diese Rechnung ist storniert.')).toBeVisible()
    await expect(page.getByRole('link', { name: `Zur Gutschrift ${number}` })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Gutschrift erstellen' })).toHaveCount(0)

    // Kein zweites Mal, auch nicht am Formular vorbei
    const again = await page.request.post(`/api/rechnungen/${id}/gutschrift`, { data: { invoiceDate: '2026-11-06', number: 'G-2', reason: '', acks: [] } })
    expect((await again.json()).error).toBe('alreadyCredited')

    // Buchung: wieder nicht verrechnet
    await page.goto(`/buchungen/${s.bookingId}`)
    await ready(page)
    await expect(page.getByRole('link', { name: 'Rechnung', exact: true })).toBeVisible()
  })
})

test.describe('Gutschrift: Layout', () => {
  test('Layout: Seite „Gutschrift ausstellen“ ohne seitliches Scrollen, keine WCAG-2.1-AA-Verstöße', async ({ page, users }) => {
    const s = await setup(users)
    const id = await addDraft(s.owner, s.tenantId, s.bookingId)
    await signInAs(page, s.owner)
    await issueInvoice(page, id)
    await openCredit(page, id)
    await page.getByLabel('Grund (optional)').fill('Falscher Empfänger')
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
    const a11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    expect(a11y.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([])
    await page.screenshot({ path: `test-results/proj44-${test.info().project.name}.png`, fullPage: true })
    await page.goto(`/rechnungen/${id}`)
    await ready(page)
    await expect(page.getByRole('link', { name: 'Gutschrift erstellen' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
    await page.screenshot({ path: `test-results/proj44-detail-${test.info().project.name}.png`, fullPage: true })
  })
})
