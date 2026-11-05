import { createHash, randomUUID } from 'node:crypto'

import { expect, type Page, test as base } from '@playwright/test'

import type { Json } from '../src/types/database'
import { anon, createTenant, createUser, deleteUser, type E2EUser, hasSupabaseEnv, service, signInAs, signInAsAdmin } from './support/supabase'

// PROJ-42: Seite „Rechnung ausstellen“ bis zur ausgestellten Rechnung. Regeln: src/lib/invoice-issue.test.ts. Datenbank:
// supabase/tests/invoice-issue.integration.test.ts.

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
const submit = (page: Page) => page.getByRole('button', { name: 'Rechnung ausstellen', exact: true })

let seq = 7000

async function setup(users: Users, { kind = 'booking' as 'booking' | 'option', staff = false } = {}) {
  const owner = await users()
  const staffUser = staff ? await users() : undefined
  const members: { user: E2EUser; role: 'owner' | 'staff' }[] = [{ user: owner, role: 'owner' }]
  if (staffUser) members.push({ user: staffUser, role: 'staff' })
  const tenantId = await createTenant(`QA42 Testkunde ${randomUUID().slice(0, 8)}`, members)
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
      kind,
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
      option_until: kind === 'option' ? '2026-12-31' : null,
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

async function addBackfilled(owner: E2EUser, tenantId: string, number: string, date: string) {
  const client = anon()
  await client.auth.signInWithPassword({ email: owner.email, password: owner.password })
  const { error } = await client.rpc('save_invoice', {
    p_input: { tenant_id: tenantId, number, invoice_date: date, recipient: 'Huber Maria', lines: [{ label: 'Alt', amount_cents: 1000, vat_rate: '10.00' }] } as unknown as Json,
  })
  if (error) throw error
}

async function open(page: Page, id: string) {
  await page.goto(`/rechnungen/${id}/ausstellen`)
  await ready(page)
  await expect(previewText(page)).toContainText('Rechnungsbetrag', { timeout: 20_000 })
}

test.describe('Seite „Rechnung ausstellen“', () => {
  test('AC: Knopf auf dem Entwurf; Seite zeigt Datum, Vorschlag und Vorschau mit Aufdruck; Mitarbeiter hat keinen Zugang', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users, { staff: true })
    await addBackfilled(s.owner, s.tenantId, '2026-0041', '2026-09-01')
    const id = await addDraft(s.owner, s.tenantId, s.bookingId)
    await signInAs(page, s.owner)
    await page.goto(`/rechnungen/${id}`)
    await page.getByRole('link', { name: 'Ausstellen', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/rechnungen/${id}/ausstellen$`))
    await ready(page)
    await expect(page.getByLabel('Rechnungsdatum')).toHaveValue('2026-10-20')
    await expect(page.getByLabel('Rechnungsnummer')).toHaveValue('2026-0042')
    await expect(previewText(page)).toContainText('2026-0042', { timeout: 20_000 })
    await expect(previewText(page)).toContainText('Entwurf')
    await expect(submit(page)).toBeEnabled()
    await page.getByRole('link', { name: 'Zurück zum Entwurf' }).first().click()
    await expect(page).toHaveURL(new RegExp(`/rechnungen/${id}$`))

    await page.context().clearCookies()
    await signInAs(page, s.staff!)
    await page.goto(`/rechnungen/${id}`)
    await ready(page)
    await expect(page.getByRole('link', { name: 'Ausstellen', exact: true })).toHaveCount(0)
    await page.goto(`/rechnungen/${id}/ausstellen`)
    await expect(page.getByLabel('Rechnungsnummer')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Seite nicht gefunden' })).toBeVisible()
    const post = await page.request.post(`/api/rechnungen/${id}/ausstellen`, { data: { invoiceDate: '2026-10-20', number: '2026-0042', updatedAt: 'x', acks: [] } })
    expect(post.status()).toBe(403)
  })

  test('AC: Nummer: Lücke, höher mit Häkchen und Folge, vergeben, Vorschlag übernehmen; Datum: Zukunft sperrt', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    await addBackfilled(s.owner, s.tenantId, '2026-0041', '2026-09-01')
    await addBackfilled(s.owner, s.tenantId, '2026-0039', '2026-08-01')
    const id = await addDraft(s.owner, s.tenantId, s.bookingId)
    await signInAs(page, s.owner)
    await open(page, id)
    const number = page.getByLabel('Rechnungsnummer')

    await number.fill('2026-0040')
    await expect(page.getByText('Füllt eine Lücke')).toBeVisible()
    await expect(submit(page)).toBeEnabled()

    await number.fill('2026-9000')
    await expect(page.getByText('Die nächste Nummer wäre danach 2026-9001.')).toBeVisible()
    await expect(submit(page)).toBeDisabled()
    const ack = page.getByRole('checkbox', { name: 'Diese Nummer trotzdem verwenden' })
    await ack.click()
    await expect(submit(page)).toBeEnabled()
    // Anderer Fall: Häkchen wieder leer
    await number.fill('2026-9001')
    await expect(page.getByText('Die nächste Nummer wäre danach 2026-9002.')).toBeVisible()
    await expect(page.getByRole('checkbox', { name: 'Diese Nummer trotzdem verwenden' })).not.toBeChecked()

    await number.fill('2026-0041')
    await expect(page.getByText('Die Nummer 2026-0041 ist schon vergeben.')).toBeVisible()
    await expect(submit(page)).toBeDisabled()

    await page.getByRole('button', { name: /Vorschlag übernehmen/ }).click()
    await expect(number).toHaveValue('2026-0042')

    await page.getByLabel('Rechnungsdatum').fill('2099-01-01')
    await expect(page.getByText('Das Rechnungsdatum liegt in der Zukunft.')).toBeVisible()
    await expect(submit(page)).toBeDisabled()
    // Der Entwurf bleibt unverändert
    const { data } = await service().from('invoices').select('invoice_date, number, origin').eq('id', id).single()
    expect(data).toMatchObject({ invoice_date: '2026-10-20', number: null, origin: 'draft' })
  })

  test('AC: Datum passt nicht zur Folge: Hinweis, „auf heute“ ändert Datum; Option braucht Häkchen; Fremdformat nur mit Häkchen', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users, { kind: 'option' })
    await addBackfilled(s.owner, s.tenantId, '2026-0050', '2026-10-25')
    const id = await addDraft(s.owner, s.tenantId, s.bookingId)
    await signInAs(page, s.owner)
    await open(page, id)
    await expect(page.getByText(/Die Rechnung 2026-0050 trägt ein späteres Datum \(25\.10\.2026\)/)).toBeVisible()
    const option = page.getByRole('checkbox', { name: 'Buchung ist noch eine Option, trotzdem ausstellen' })
    await expect(submit(page)).toBeDisabled()
    await option.click()
    await expect(submit(page)).toBeEnabled()

    await page.getByLabel('Rechnungsnummer').fill('RE/77')
    await expect(page.getByText('zählt nicht zur Folge')).toBeVisible()
    await expect(submit(page)).toBeDisabled()
  })

  test('AC: Abzug eines Teilrechnungs-Entwurfs und unbekannte Zeichen sperren, mit Link zur Abhilfe', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const part = await addDraft(s.owner, s.tenantId, s.bookingId, {
      kind: 'partial',
      partial: { mode: 'amount', percent: null, amount_cents: 20000 },
      lines: [{ label: 'Anteil', amount_cents: 20000, vat_rate: '10.00' }],
    })
    const final = await addDraft(s.owner, s.tenantId, s.bookingId, {
      kind: 'final',
      deduction_ids: [part],
      recipient: { name: 'Maria ✓ Huber', line1: 'Gartenweg 3', line2: '', postal_code: '5020', city: 'Salzburg', country: 'AT', vat_id: '' },
    })
    await signInAs(page, s.owner)
    await open(page, final)
    await expect(page.getByText('Die abgezogene Teilrechnung ist noch ein Entwurf.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Zur Teilrechnung' })).toHaveAttribute('href', `/rechnungen/${part}`)
    await expect(page.getByText(/Diese Zeichen kann die Schrift nicht darstellen: ✓/)).toBeVisible()
    await expect(submit(page)).toBeDisabled()
  })

  test('AC: Ausstellen bis zur Detailseite: PDF ohne Aufdruck, Liste, Buchung, Sperren; Mitarbeiter öffnet das PDF; Doppelversuch', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users, { staff: true })
    const id = await addDraft(s.owner, s.tenantId, s.bookingId)
    await signInAs(page, s.owner)
    await open(page, id)
    const number = await page.getByLabel('Rechnungsnummer').inputValue()
    await expect(submit(page)).toBeEnabled()
    const { data: before } = await service().from('invoices').select('updated_at').eq('id', id).single()
    await submit(page).click()
    await expect(page).toHaveURL(new RegExp(`/rechnungen/${id}\\?ausgestellt=1$`), { timeout: 30_000 })
    await ready(page)

    await expect(page.getByRole('heading', { name: number })).toBeVisible()
    await expect(page.getByText('Die Rechnung wurde ausgestellt.')).toBeVisible()
    await expect(page.getByText('Rechnung falsch?')).toBeVisible()
    await expect(page.getByText('ausgestellt', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Bearbeiten' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Löschen' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Ausstellen', exact: true })).toHaveCount(0)
    await expect(page.getByText('Maria Huber').first()).toBeVisible()

    // Datenbank und Datei
    const { data: row } = await service().from('invoices').select('origin, number, pdf_path, pdf_sha256, issued_by, issued_snapshot').eq('id', id).single()
    expect(row).toMatchObject({ origin: 'issued', number, issued_by: s.owner.id })
    const { data: file } = await service().storage.from('invoices').download(row!.pdf_path as string)
    const bytes = Buffer.from(await file!.arrayBuffer())
    expect(bytes.subarray(0, 4).toString()).toBe('%PDF')
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(row!.pdf_sha256)
    // Die Fassung enthält keine zusätzlichen Gästedaten der Buchung
    expect(JSON.stringify(row!.issued_snapshot)).not.toContain('companions')

    // Erneuter Aufruf der Schnittstelle: dieselbe Rechnung, kein zweites PDF
    const again = await page.request.post(`/api/rechnungen/${id}/ausstellen`, { data: { invoiceDate: '2026-10-20', number: 'ANDERE', updatedAt: before!.updated_at, acks: [] } })
    expect(await again.json()).toEqual({ ok: true, id })
    const { data: same } = await service().from('invoices').select('number').eq('id', id).single()
    expect(same!.number).toBe(number)

    // Die Seite führt zur Rechnung
    await page.goto(`/rechnungen/${id}/ausstellen`)
    await expect(page).toHaveURL(new RegExp(`/rechnungen/${id}$`))

    // Liste
    await page.goto('/rechnungen')
    await expect(page.getByRole('link', { name: number }).first()).toBeVisible()

    // Mitarbeiter sieht Rechnung und PDF, kann nichts ändern
    await page.context().clearCookies()
    await signInAs(page, s.staff!)
    await page.goto(`/rechnungen/${id}`)
    await ready(page)
    await expect(page.getByRole('link', { name: 'PDF öffnen' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Herunterladen' })).toBeVisible()
    await expect(page.getByText('Die Rechnung wurde ausgestellt.')).toHaveCount(0)
    const staffPost = await page.request.post(`/api/rechnungen/${id}/ausstellen`, { data: { invoiceDate: '2026-10-20', number: 'X', updatedAt: 'x', acks: [] } })
    expect(staffPost.status()).toBe(403)
  })

  test('AC: Nummer inzwischen vergeben: Meldung und neuer Vorschlag; Entwurf in anderem Fenster geändert: nicht ausgestellt', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const id = await addDraft(s.owner, s.tenantId, s.bookingId, { kind: 'partial', partial: { mode: 'amount', percent: null, amount_cents: 20000 }, lines: [{ label: 'Anteil', amount_cents: 20000, vat_rate: '10.00' }] })
    await signInAs(page, s.owner)
    await open(page, id)
    const number = page.getByLabel('Rechnungsnummer')
    await expect(number).toHaveValue('2026-0001')
    await expect(submit(page)).toBeEnabled()
    await addBackfilled(s.owner, s.tenantId, '2026-0001', '2026-01-02')
    await submit(page).click()
    await expect(page.getByRole('alert').filter({ hasText: 'inzwischen vergeben' })).toBeVisible()
    await expect(number).toHaveValue('2026-0002')
    await expect(submit(page)).toBeEnabled({ timeout: 20_000 })
    expect((await service().from('invoices').select('origin').eq('id', id).single()).data).toMatchObject({ origin: 'draft' })

    await service().from('invoices').update({ updated_at: '2026-01-01T00:00:00Z' } as never).eq('id', id)
    await submit(page).click()
    await expect(page.getByRole('alert').filter({ hasText: 'inzwischen geändert' })).toBeVisible()
    expect((await service().from('invoices').select('origin').eq('id', id).single()).data).toMatchObject({ origin: 'draft' })
  })

  test('AC: Betreiber: Kunde mit ausgestellter Rechnung nicht löschbar', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const id = await addDraft(s.owner, s.tenantId, s.bookingId)
    await signInAs(page, s.owner)
    await open(page, id)
    await expect(submit(page)).toBeEnabled()
    await submit(page).click()
    await expect(page).toHaveURL(/ausgestellt=1/, { timeout: 30_000 })
    await service().from('tenants').update({ status: 'deactivated' } as never).eq('id', s.tenantId)
    await page.context().clearCookies()
    await signInAsAdmin(page, await users({ admin: true }))
    await page.goto(`/betreiber/kunden/${s.tenantId}`)
    await ready(page)
    await expect(page.getByText(/1 ausgestellte Rechnung fällt noch unter die Aufbewahrungspflicht/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Endgültig löschen' })).toHaveCount(0)
  })

  test('Layout: ohne seitliches Scrollen', async ({ page, users }) => {
    const s = await setup(users)
    const id = await addDraft(s.owner, s.tenantId, s.bookingId)
    await signInAs(page, s.owner)
    await open(page, id)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    await expect(submit(page)).toBeVisible()
    await page.screenshot({ path: `test-results/proj42-${test.info().project.name}.png`, fullPage: true })
  })
})
