import { randomUUID } from 'node:crypto'
import { renameSync } from 'node:fs'

import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test as base } from '@playwright/test'

import type { Json } from '../src/types/database'
import { anon, createTenant, createUser, deleteUser, type E2EUser, hasSupabaseEnv, service, signInAs, signInAsAdmin } from './support/supabase'

// PROJ-44: Gutschrift zu Rechnung. Regeln: src/lib/invoice-credit.test.ts. Datenbank: supabase/tests/invoice-credit.integration.test.ts.

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

async function addDraft(owner: E2EUser, tenantId: string, bookingId: string, over: Record<string, unknown> = {}) {
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
      ...over,
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

async function pdfText(pdf: Uint8Array) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const doc = await getDocument({ data: pdf }).promise
  const out: string[] = []
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent()
    out.push(content.items.map((i) => ('str' in i ? i.str : '')).join(''))
  }
  return plain(out.join(' '))
}

async function storedPdf(id: string) {
  const { data: r } = await service().from('invoices').select('pdf_path').eq('id', id).single()
  const { data: file } = await service().storage.from('invoices').download(r!.pdf_path as string)
  return pdfText(new Uint8Array(await file!.arrayBuffer()))
}

// Gutschrift über die Schnittstelle (angemeldet als Inhaber); liefert die Kennung
async function issueCredit(page: Page, id: string, number: string, reason = '') {
  const res = await page.request.post(`/api/rechnungen/${id}/gutschrift`, { data: { invoiceDate: '2026-10-20', number, reason, acks: [] } })
  const body = await res.json()
  expect(body.ok, JSON.stringify(body)).toBe(true)
  return body.id as string
}

const PARTIAL = { kind: 'partial', partial: { mode: 'amount', percent: null, amount_cents: 20000 }, lines: [{ label: 'Anteil', amount_cents: 20000, vat_rate: '10.00', source_kind: null, source_charge_id: null }] }

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

    // Buchungsübersicht: „ohne Rechnung“ zeigt die Buchung (es zählt die Summe), Spalte mit beiden Belegen, Rechnung storniert
    const { data: booking } = await service().from('bookings').select('number_year, number_seq').eq('id', s.bookingId).single()
    const bookingNumber = `${booking!.number_year}-${String(booking!.number_seq).padStart(4, '0')}`
    await page.goto('/buchungen?rechnung=ohne')
    await ready(page)
    const line = page.getByRole('row').filter({ hasText: bookingNumber })
    await expect(line).toBeVisible()
    await expect(line.getByRole('link', { name: '2026-0001' })).toBeVisible()
    await expect(line.getByRole('link', { name: number })).toBeVisible()
    await expect(line.getByText('(storniert)')).toBeVisible()
    await page.goto('/buchungen?rechnung=mit')
    await ready(page)
    await expect(page.getByRole('row').filter({ hasText: bookingNumber })).toHaveCount(0)
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

test.describe('Gutschrift: QA', () => {
  test('QA: Abgelegtes PDF: ohne Aufdruck, Überschrift, Nummer, Verweis, Grund, negative Beträge; Aussteller aktuell, Empfänger aus der Rechnung', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const id = await addDraft(s.owner, s.tenantId, s.bookingId)
    await signInAs(page, s.owner)
    await issueInvoice(page, id)
    // Stammdaten und Gast ändern sich nach der Rechnung
    await service().from('tenants').update({ address_line1: 'Neuer Weg 99' } as never).eq('id', s.tenantId)
    const { data: b } = await service().from('bookings').select('guest_id').eq('id', s.bookingId).single()
    await service().from('guests').update({ last_name: 'Umbenannt' } as never).eq('id', b!.guest_id as string)
    const credit = await issueCredit(page, id, '2026-0002', 'Falscher Empfänger')
    const text = await storedPdf(credit)
    expect(text).toContain('Gutschrift')
    expect(text).toContain('Gutschriftsnummer: 2026-0002')
    expect(text).toContain('zu Rechnung 2026-0001 vom 20.10.2026')
    expect(text).toContain('Grund: Falscher Empfänger')
    expect(text).toContain('Übernachtung · (inkl. 10 % USt.) -€ 900,00')
    expect(text).toContain('Gutschriftsbetrag (inkl. USt.) -€ 900,00')
    expect(text).toContain('10 % aus -€ 818,18 -€ 81,82')
    expect(text).toContain('Neuer Weg 99')
    expect(text).toContain('Maria Huber')
    expect(text).not.toContain('Umbenannt')
    expect(text).not.toContain('Entwurf')
    // Prüfsumme und Datenbank
    const { data: row } = await service().from('invoices').select('kind, origin, total_cents, credited_invoice_id, credit_reason, issued_by').eq('id', credit).single()
    expect(row).toEqual({ kind: 'credit_note', origin: 'issued', total_cents: -90000, credited_invoice_id: id, credit_reason: 'Falscher Empfänger', issued_by: s.owner.id })
    // Detailseite der Gutschrift
    await page.goto(`/rechnungen/${credit}`)
    await ready(page)
    await expect(page.getByText('Gutschrift', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Falscher Empfänger')).toBeVisible()
    await expect(page.getByText('Gutschriftsbetrag')).toBeVisible()
    await expect(page.getByText('Fällig am')).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Gutschrift erstellen' })).toHaveCount(0)
    await expect(page).toHaveTitle(/Gutschrift 2026-0002/)
  })

  test('AC: Teilrechnung in gültiger Schlussrechnung: gesperrt mit Link; nach Storno der Schlussrechnung frei; offener Entwurf verliert den Abzug mit Hinweis', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    await signInAs(page, s.owner)
    const partial = await addDraft(s.owner, s.tenantId, s.bookingId, PARTIAL)
    await issueInvoice(page, partial, '2026-0001')
    const final = await addDraft(s.owner, s.tenantId, s.bookingId, { kind: 'final', deduction_ids: [partial] })
    await issueInvoice(page, final, '2026-0002')

    await page.goto(`/rechnungen/${partial}`)
    await ready(page)
    await expect(page.getByRole('button', { name: 'Gutschrift erstellen' })).toBeDisabled()
    await expect(page.getByText('Zuerst die Schlussrechnung 2026-0002 stornieren.')).toBeVisible()
    await page.getByRole('link', { name: 'Zur Schlussrechnung' }).click()
    await expect(page).toHaveURL(new RegExp(`/rechnungen/${final}$`))
    // Seite und Schnittstelle am Knopf vorbei: gesperrt
    await page.goto(`/rechnungen/${partial}/gutschrift`)
    await expect(page).toHaveURL(new RegExp(`/rechnungen/${partial}$`))
    const blocked = await page.request.post(`/api/rechnungen/${partial}/gutschrift`, { data: { invoiceDate: '2026-10-20', number: 'G-9', reason: '', acks: [] } })
    expect((await blocked.json()).error).toBe('blocked')

    // Schlussrechnung über die Seite stornieren: Abzugszeile gespiegelt
    await openCredit(page, final)
    await expect(previewText(page)).toContainText(/abzüglich Teilrechnung 2026-0001 vom 20\.10\.2026\s*darin USt 10\s%\s€\s18,18\s*€\s200,00/, { timeout: 20_000 })
    await expect(previewText(page)).toContainText(/Gutschriftsbetrag \(inkl\. USt\.\)\s*-€\s700,00/)
    await submit(page).click()
    await expect(page).toHaveURL(/ausgestellt=1/, { timeout: 30_000 })

    // Neuer Entwurf zieht die Teilrechnung wieder ab; dann Teilrechnung stornieren → Entwurf verliert den Abzug
    await page.goto(`/rechnungen/${partial}`)
    await ready(page)
    await expect(page.getByRole('link', { name: 'Gutschrift erstellen' })).toBeVisible()
    const draft = await addDraft(s.owner, s.tenantId, s.bookingId, { kind: 'final', deduction_ids: [partial] })
    await issueCredit(page, partial, '2026-0004')
    const { data: d } = await service().from('invoices').select('deduction_removed, total_cents').eq('id', draft).single()
    expect(d).toEqual({ deduction_removed: true, total_cents: 90000 })
    await page.goto(`/rechnungen/${draft}`)
    await ready(page)
    await expect(page.getByText(/Abgezogene Rechnung existiert nicht mehr/).first()).toBeVisible()
  })

  test('AC: Zweiter Inhaber schickt nach dem ersten ab: „Rechnung wurde inzwischen storniert“ mit Link, keine zweite Gutschrift', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const id = await addDraft(s.owner, s.tenantId, s.bookingId)
    await signInAs(page, s.owner)
    await issueInvoice(page, id)
    await openCredit(page, id)
    await expect(submit(page)).toBeEnabled()
    const first = await issueCredit(page, id, await page.getByLabel('Gutschriftsnummer').inputValue())
    await submit(page).click()
    const alert = page.getByRole('alert').filter({ hasText: 'Rechnung wurde inzwischen storniert.' })
    await expect(alert).toBeVisible({ timeout: 30_000 })
    await alert.getByRole('link', { name: 'Zur Gutschrift' }).click()
    await expect(page).toHaveURL(new RegExp(`/rechnungen/${first}$`))
    const { count } = await service().from('invoices').select('id', { count: 'exact', head: true }).eq('credited_invoice_id', id)
    expect(count).toBe(1)
  })

  test('AC: PDF-Erzeugung scheitert: keine Gutschrift, keine Nummer verbraucht, Eingaben erhalten; neuer Versuch gelingt', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const id = await addDraft(s.owner, s.tenantId, s.bookingId)
    await signInAs(page, s.owner)
    await issueInvoice(page, id)
    await openCredit(page, id)
    await page.getByLabel('Grund (optional)').fill('Doppelt verrechnet')
    await expect(previewText(page)).toContainText('Grund: Doppelt verrechnet', { timeout: 20_000 })
    const number = await page.getByLabel('Gutschriftsnummer').inputValue()
    const worker = 'pdf-worker-build/render-worker.mjs'
    renameSync(worker, `${worker}.weg`)
    try {
      await submit(page).click()
      await expect(page.getByRole('alert').filter({ hasText: 'Das PDF konnte nicht erzeugt werden' })).toBeVisible({ timeout: 30_000 })
    } finally {
      renameSync(`${worker}.weg`, worker)
    }
    const { count } = await service().from('invoices').select('id', { count: 'exact', head: true }).eq('tenant_id', s.tenantId).eq('kind', 'credit_note')
    expect(count).toBe(0)
    const { data: files } = await service().storage.from('invoices').list(s.tenantId)
    expect(files ?? []).toHaveLength(1)
    await expect(page.getByLabel('Grund (optional)')).toHaveValue('Doppelt verrechnet')
    await expect(page.getByLabel('Gutschriftsnummer')).toHaveValue(number)
    await submit(page).click()
    await expect(page).toHaveURL(/ausgestellt=1/, { timeout: 30_000 })
    await expect(page.getByRole('heading', { name: number })).toBeVisible({ timeout: 20_000 })
  })

  test('AC: Mitarbeiter sieht Gutschrift in Liste, Buchung und Detail samt PDF; Rechnung als storniert', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users, { staff: true })
    const id = await addDraft(s.owner, s.tenantId, s.bookingId)
    await signInAs(page, s.owner)
    await issueInvoice(page, id)
    const credit = await issueCredit(page, id, '2026-0002')
    await page.context().clearCookies()
    await signInAs(page, s.staff!)
    await page.goto('/rechnungen')
    await ready(page)
    const row = page.getByRole('row').filter({ hasText: '2026-0002' })
    await expect(row.getByText('Gutschrift')).toBeVisible()
    await expect(page.getByRole('row').filter({ hasText: '2026-0001' }).getByText('storniert')).toBeVisible()
    await page.goto(`/buchungen/${s.bookingId}`)
    await ready(page)
    await expect(page.getByRole('link', { name: '2026-0002' })).toBeVisible()
    await page.goto(`/rechnungen/${credit}`)
    await ready(page)
    await expect(page.getByRole('link', { name: 'PDF öffnen' })).toBeVisible()
    await page.goto(`/rechnungen/${id}`)
    await ready(page)
    await expect(page.getByText('Diese Rechnung ist storniert.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Zur Gutschrift 2026-0002' })).toBeVisible()
  })

  test('QA: Schnittstellen: ohne Anmeldung, fremder Inhaber, Betreiber, deaktivierter Kunde, ungültige Eingaben, XSS im Grund', async ({ page, users, request }) => {
    desktopOnly()
    const s = await setup(users)
    const id = await addDraft(s.owner, s.tenantId, s.bookingId)
    await signInAs(page, s.owner)
    await issueInvoice(page, id)
    await page.context().clearCookies()
    const body = { invoiceDate: '2026-10-20', number: 'G-1', reason: '', acks: [] }
    const preview = { creditFor: id, credit: { invoiceDate: '2026-10-20', number: 'G-1', reason: '' } }

    expect((await request.post(`/api/rechnungen/${id}/gutschrift`, { data: body, headers: { cookie: '' } })).status()).toBe(401)
    expect((await request.post('/api/rechnungen/vorschau', { data: preview, headers: { cookie: '' } })).status()).toBe(403)

    const stranger = await users()
    await createTenant(`QA44 Fremd ${randomUUID().slice(0, 8)}`, [{ user: stranger, role: 'owner' }])
    await signInAs(page, stranger)
    expect((await page.request.post(`/api/rechnungen/${id}/gutschrift`, { data: body })).status()).toBe(404)
    expect((await page.request.post('/api/rechnungen/vorschau', { data: preview })).status()).toBe(404)
    await page.goto(`/rechnungen/${id}/gutschrift`)
    await expect(page.getByRole('heading', { name: /nicht gefunden/i })).toBeVisible()
    await page.context().clearCookies()

    await signInAsAdmin(page, await users({ admin: true }))
    expect((await page.request.post(`/api/rechnungen/${id}/gutschrift`, { data: body })).status()).toBe(403)
    expect((await page.request.post('/api/rechnungen/vorschau', { data: preview })).status()).toBe(403)
    await page.context().clearCookies()

    await signInAs(page, s.owner)
    for (const data of [{ ...body, invoiceDate: 'heute' }, { ...body, invoiceDate: '1980-01-01' }, { ...body, number: 'x'.repeat(201) }, { ...body, reason: 'x'.repeat(2001) }, { ...body, acks: 'alle' }, {}]) {
      expect((await page.request.post(`/api/rechnungen/${id}/gutschrift`, { data })).status(), JSON.stringify(data)).toBe(400)
    }
    expect((await page.request.post('/api/rechnungen/not-a-uuid/gutschrift', { data: body })).status()).toBe(400)
    // Grund über 300 Zeichen am Formular vorbei: gesperrt
    expect((await (await page.request.post(`/api/rechnungen/${id}/gutschrift`, { data: { ...body, reason: 'x'.repeat(301) } })).json()).error).toBe('blocked')
    // Datum vor der Rechnung bzw. in der Zukunft am Formular vorbei: gesperrt
    expect((await (await page.request.post(`/api/rechnungen/${id}/gutschrift`, { data: { ...body, invoiceDate: '2026-10-19' } })).json()).error).toBe('blocked')
    expect((await (await page.request.post(`/api/rechnungen/${id}/gutschrift`, { data: { ...body, invoiceDate: '2099-01-01' } })).json()).error).toBe('blocked')

    // Deaktivierter Kunde: abgelehnt
    await service().from('tenants').update({ status: 'deactivated' } as never).eq('id', s.tenantId)
    const deactivated = await page.request.post(`/api/rechnungen/${id}/gutschrift`, { data: body })
    await service().from('tenants').update({ status: 'active' } as never).eq('id', s.tenantId)
    expect(deactivated.ok()).toBe(false)
    const { count } = await service().from('invoices').select('id', { count: 'exact', head: true }).eq('credited_invoice_id', id)
    expect(count).toBe(0)

    // XSS im Grund: nur Text
    const xss = '<img src=x onerror="window.__xss=1">'
    const credit = await issueCredit(page, id, '2026-0002', xss)
    await page.goto(`/rechnungen/${credit}`)
    await ready(page)
    await expect(page.getByText(xss)).toBeVisible()
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
  })

  // BUG-1 (QA 2026-11-06): Link „Zu Rechnung“ in der Detailansicht der Gutschrift ohne Unterstreichung im Text (link-in-text-block)
  test('Layout: Detailseiten Gutschrift und stornierte Rechnung ohne seitliches Scrollen, keine WCAG-2.1-AA-Verstöße', async ({ page, users }) => {
    test.fail(test.info().project.name !== 'mobile', 'BUG-1: link-in-text-block in der Detailansicht der Gutschrift (Desktop, Tablet)')
    const s = await setup(users)
    const id = await addDraft(s.owner, s.tenantId, s.bookingId)
    await signInAs(page, s.owner)
    await issueInvoice(page, id)
    const credit = await issueCredit(page, id, '2026-0002', 'Falscher Empfänger')
    for (const target of [credit, id]) {
      await page.goto(`/rechnungen/${target}`)
      await ready(page)
      await expect(page.getByRole('link', { name: 'PDF öffnen' })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
      const a11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      expect(a11y.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`)).toEqual([])
      await page.screenshot({ path: `test-results/proj44-qa-${target === id ? 'storniert' : 'gutschrift'}-${test.info().project.name}.png`, fullPage: true })
    }
  })
})
