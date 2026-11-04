import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'

import { expect, type Page, test as base } from '@playwright/test'

import type { Json } from '../src/types/database'
import { anon, createTenant, createUser, deleteUser, type E2EUser, hasSupabaseEnv, service, signInAs, signInAsAdmin } from './support/supabase'

// PROJ-41: Briefpapier. Reiter, Formular, Vorschau, Speichern und Logo im PDF. Speicherfunktion und Rechte:
// supabase/tests/letterhead.integration.test.ts. Weitere Abläufe ergänzt /qa.

type Fixtures = { users: (opts?: Parameters<typeof createUser>[0]) => Promise<E2EUser> }

const test = base.extend<Fixtures>({
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

const ready = (page: Page) =>
  page.waitForFunction(() => Object.keys(document.querySelector('main') ?? {}).some((k) => k.startsWith('__reactFiber')))

const previewText = (page: Page) => page.getByTestId('pdf-text')

test.describe('Reiter und Vorschau', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('AC: Reihenfolge der Reiter, Standardwerte, Musterrechnung mit Kundendaten, ohne Speichern änderbar', async ({ page, users }) => {
    const owner = await users()
    await createTenant('QA41 Muster', [{ user: owner, role: 'owner' }])
    await signInAs(page, owner)
    await page.goto('/einstellungen/briefpapier')
    await ready(page)
    await expect(page.getByRole('navigation', { name: 'Einstellungsbereiche' }).getByRole('link')).toHaveText(['Stammdaten', 'Team', 'Wohnungen', 'Briefpapier', 'Rechnungen'])
    await expect(page.getByLabel('Grundschriftgröße in pt')).toHaveValue('11')
    await expect(page.getByLabel('Höhe in mm')).toHaveValue('25')
    await expect(previewText(page)).toContainText('Muster', { timeout: 15_000 })
    await expect(previewText(page)).toContainText('QA41 Muster')
    await expect(previewText(page)).toContainText('Rechnungsbetrag')
    await expect(page.locator('canvas').first()).toBeVisible()

    // Aussteller-Block aus: Hinweis, Name des Kunden fehlt im Kopf
    await page.getByRole('switch', { name: 'Aussteller-Block im Kopf anzeigen' }).click()
    await expect(page.getByText('Name, Anschrift und ab € 400 die UID')).toBeVisible()
    await expect(previewText(page)).not.toContainText('QA41 Muster', { timeout: 15_000 })

    // Ungültiger Wert: Fehler am Feld, letzte Vorschau bleibt
    await page.getByLabel('Grundschriftgröße in pt').fill('7')
    await expect(page.getByText('Bitte 8 bis 14 pt in Schritten von 0,5 pt angeben.')).toBeVisible()
    await expect(page.locator('canvas').first()).toBeVisible()

    // Zurücksetzen: Standardwerte
    await page.getByRole('button', { name: 'Auf Standard zurücksetzen' }).click()
    await expect(page.getByLabel('Grundschriftgröße in pt')).toHaveValue('11')
    await expect(previewText(page)).toContainText('QA41 Muster', { timeout: 15_000 })
  })

  test('AC: Mitarbeiter erhält „Seite nicht gefunden“; Vorschau-Schnittstelle lehnt fremde Kunden ab', async ({ page, users, request }) => {
    const owner = await users()
    const staff = await users()
    const tenant = await createTenant('QA41 Rechte', [
      { user: owner, role: 'owner' },
      { user: staff, role: 'staff' },
    ])
    await signInAs(page, staff)
    const res = await page.goto('/einstellungen/briefpapier')
    expect(res?.status()).toBe(404)
    const api = await page.request.post('/api/briefpapier/vorschau', {
      data: { tenantId: tenant, values: { fontFamily: 'carlito', fontSize: '11', lineSpacing: 'normal', paragraphSpacing: 'normal', logoPosition: 'left', logoHeightMm: '25', showIssuer: true } },
    })
    expect(api.status()).toBe(403)
    expect((await request.post('/api/briefpapier/vorschau', { data: {} })).status()).toBeGreaterThanOrEqual(300)
  })

  test('AC: Handy 375 px – Vorschau unter den Einstellungen, kein seitliches Scrollen', async ({ page, users }) => {
    const owner = await users()
    await createTenant('QA41 Handy', [{ user: owner, role: 'owner' }])
    await signInAs(page, owner)
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/einstellungen/briefpapier')
    await ready(page)
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15_000 })
    const form = await page.getByLabel('Höhe in mm').boundingBox()
    const canvas = await page.locator('canvas').first().boundingBox()
    expect(canvas!.y).toBeGreaterThan(form!.y)
    expect(canvas!.width).toBeLessThanOrEqual(375)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  })

  test('Betreiber: Abschnitt „Briefpapier“ auf der Kunden-Detailseite mit Vorschau', async ({ page, users }) => {
    const owner = await users()
    const admin = await users({ admin: true })
    const tenant = await createTenant('QA41 Betreiber', [{ user: owner, role: 'owner' }])
    await signInAsAdmin(page, admin)
    await page.goto(`/betreiber/kunden/${tenant}`)
    await ready(page)
    await expect(page.getByRole('heading', { level: 2, name: 'Briefpapier' })).toBeVisible()
    await expect(previewText(page)).toContainText('QA41 Betreiber', { timeout: 15_000 })
  })
})

// ---- Speichern und Logo --------------------------------------------------------------------------------

const BUCKET = 'tenant-logos'
const LOGO = readFileSync('tests/fixtures/logo-klein.png')
const META = 'x-pdf-meta'

async function addLogo(tenantId: string) {
  const path = `${tenantId}/${randomUUID()}.png`
  const { error } = await service().storage.from(BUCKET).upload(path, LOGO, { contentType: 'image/png' })
  if (error) throw error
  const { error: e } = await service().from('tenants').update({ logo_path: path }).eq('id', tenantId)
  if (e) throw e
  return path
}

async function signedIn(user: E2EUser) {
  const client = anon()
  const { error } = await client.auth.signInWithPassword({ email: user.email, password: user.password })
  if (error) throw error
  return client
}

let seq = 41000
async function addDraft(owner: E2EUser, tenantId: string) {
  const db = service()
  const { data: property, error: e1 } = await db
    .from('properties')
    .insert({ tenant_id: tenantId, name: 'Haus See', street: 'Seeweg 12', postal_code: '5340', city: 'St. Gilgen', municipality_code: '50330' })
    .select('id')
    .single()
  if (e1) throw e1
  const { data: apartment, error: e2 } = await db
    .from('apartments')
    .insert({ tenant_id: tenantId, property_id: property.id, name: 'Top 3', max_guests: 4, price_cents: 10000 } as never)
    .select('id')
    .single()
  if (e2) throw e2
  const { data: guest, error: e3 } = await db
    .from('guests')
    .insert({ tenant_id: tenantId, country: 'AT', last_name: 'Huber', first_name: 'Maria', gender: 'female', street: 'Gartenweg 3', postal_code: '5020', city: 'Salzburg', address_country: 'AT' } as never)
    .select('id')
    .single()
  if (e3) throw e3
  const { data: booking, error: e4 } = await db
    .from('bookings')
    .insert({ tenant_id: tenantId, apartment_id: (apartment as { id: string }).id, kind: 'booking', arrival: '2026-10-14', planned_departure: '2026-10-17', departure: '2026-10-17', guest_id: (guest as { id: string }).id, check_in: '15:00', check_out: '10:00', adults: 2, child_ages: [], number_year: 2026, number_seq: ++seq } as never)
    .select('id')
    .single()
  if (e4) throw e4
  const bookingId = (booking as { id: string }).id
  const { error: e5 } = await db.from('booking_amounts').insert({ id: bookingId, tenant_id: tenantId, nights_cents: 90000, nights_vat_rate: 10, cancellation_fee_cents: null, cancellation_fee_vat_rate: 0 } as never)
  if (e5) throw e5
  const client = await signedIn(owner)
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

test.describe('Speichern und Logo', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('AC: Speichern bleibt nach dem Neuladen, Logo-Felder aktiv, Musterrechnung enthält das Logo', async ({ page, users }) => {
    const owner = await users()
    const tenantId = await createTenant('QA41 Speichern', [{ user: owner, role: 'owner' }])
    const path = await addLogo(tenantId)
    await signInAs(page, owner)
    await page.goto('/einstellungen/briefpapier')
    await ready(page)
    await expect(page.getByLabel('Höhe in mm')).toBeEnabled()
    await expect(previewText(page)).toContainText('QA41 Speichern', { timeout: 15_000 })

    const response = page.waitForResponse('**/api/briefpapier/vorschau')
    await page.getByLabel('Grundschriftgröße in pt').fill('12,5')
    await page.getByLabel('Höhe in mm').fill('30')
    const res = await response
    expect(res.status()).toBe(200)
    expect((await res.body()).toString('latin1')).toContain('/Subtype /Image')
    expect(JSON.parse(res.headers()[META])).toMatchObject({ logoFailed: false, logoBlurry: true })
    await expect(page.getByText('könnte in dieser Größe unscharf wirken')).toBeVisible()

    await page.getByRole('button', { name: 'Speichern', exact: true }).click()
    await expect(page.getByText('Briefpapier gespeichert.')).toBeVisible()
    await page.reload()
    await ready(page)
    await expect(page.getByLabel('Grundschriftgröße in pt')).toHaveValue('12,5')
    await expect(page.getByLabel('Höhe in mm')).toHaveValue('30')
    await service().storage.from(BUCKET).remove([path])
  })

  test('AC: Konflikt – anderer Stand wird nicht überschrieben, Hinweis mit „Aktuelle Fassung laden“', async ({ page, users }) => {
    const owner = await users()
    const tenantId = await createTenant('QA41 Konflikt', [{ user: owner, role: 'owner' }])
    await signInAs(page, owner)
    await page.goto('/einstellungen/briefpapier')
    await ready(page)
    await service().from('invoice_settings').update({ letterhead_font_size: 13, letterhead_updated_at: new Date().toISOString() } as never).eq('tenant_id', tenantId)
    await page.getByLabel('Grundschriftgröße in pt').fill('9')
    await page.getByRole('button', { name: 'Speichern', exact: true }).click()
    await expect(page.getByText('Die Einstellungen wurden inzwischen geändert')).toBeVisible()
    const { data } = await service().from('invoice_settings').select('letterhead_font_size').eq('tenant_id', tenantId).single()
    expect(data?.letterhead_font_size).toBe(13)
    await page.getByRole('button', { name: 'Aktuelle Fassung laden' }).click()
    await expect(page.getByLabel('Grundschriftgröße in pt')).toHaveValue('13')
  })

  test('AC: Mitarbeiter sieht Entwurf samt Logo und Aufdruck, ohne direkten Zugriff auf die Logodatei', async ({ page, users }) => {
    const owner = await users()
    const staff = await users()
    const tenantId = await createTenant('QA41 Mitarbeiter', [
      { user: owner, role: 'owner' },
      { user: staff, role: 'staff' },
    ])
    const path = await addLogo(tenantId)
    await service().from('invoice_settings').update({ letterhead_font: 'tinos' } as never).eq('tenant_id', tenantId)
    const draftId = await addDraft(owner, tenantId)
    await signInAs(page, staff)
    const response = page.waitForResponse('**/api/rechnungen/vorschau')
    await page.goto(`/rechnungen/${draftId}/vorschau`)
    const res = await response
    expect(res.status()).toBe(200)
    expect(res.headers()['cache-control']).toContain('no-store')
    const raw = (await res.body()).toString('latin1')
    expect(raw).toContain('/Subtype /Image')
    expect(raw).toContain('Tinos')
    await expect(page.getByRole('article', { name: 'Rechnungsvorschau' })).toContainText('Entwurf')
    await expect(page.getByRole('article', { name: 'Rechnungsvorschau' })).toContainText('Rechnungsbetrag')

    const staffClient = await signedIn(staff)
    const { data: link } = await staffClient.storage.from(BUCKET).createSignedUrl(path, 60)
    expect(link).toBeNull()
    // Ungespeicherter Stand: nur Inhaber
    expect((await page.request.post('/api/rechnungen/vorschau', { data: { bookingId: randomUUID() } })).status()).toBe(403)
    await service().storage.from(BUCKET).remove([path])
  })
})
