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
    expect(JSON.parse(decodeURIComponent(res.headers()[META]))).toMatchObject({ logoFailed: false, logoBlurry: true })
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

// ---- QA ---------------------------------------------------------------------------------------------------

const VALUES = { fontFamily: 'carlito', fontSize: '11', lineSpacing: 'normal', paragraphSpacing: 'normal', logoPosition: 'left', logoHeightMm: '25', showIssuer: true }

test.describe('QA: Einstellungen', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('AC: Ungespeicherte Änderungen: Klick auf einen anderen Reiter fragt nach, „Weiter bearbeiten“ bleibt', async ({ page, users }) => {
    const owner = await users()
    await createTenant('QA41 Rückfrage', [{ user: owner, role: 'owner' }])
    await signInAs(page, owner)
    await page.goto('/einstellungen/briefpapier')
    await ready(page)
    await page.getByLabel('Grundschriftgröße in pt').fill('12')
    await page.getByRole('navigation', { name: 'Einstellungsbereiche' }).getByRole('link', { name: 'Team' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('Änderungen verwerfen?')
    await dialog.getByRole('button', { name: 'Weiter bearbeiten' }).click()
    await expect(page).toHaveURL(/briefpapier$/)
    await expect(page.getByLabel('Grundschriftgröße in pt')).toHaveValue('12')
  })

  test('AC: Keine Fußzeile und Block aus: Hinweis nennt die leere Fußzeile, Link führt zu den Rechnungs-Einstellungen; Kein Logo: Link zu den Stammdaten', async ({ page, users }) => {
    const owner = await users()
    await createTenant('QA41 Hinweise', [{ user: owner, role: 'owner' }])
    await signInAs(page, owner)
    await page.goto('/einstellungen/briefpapier')
    await ready(page)
    await expect(page.getByLabel('Höhe in mm')).toBeDisabled()
    await expect(page.getByRole('link', { name: 'Zu den Stammdaten' })).toHaveAttribute('href', '/einstellungen/stammdaten')
    await page.getByRole('switch', { name: 'Aussteller-Block im Kopf anzeigen' }).click()
    await expect(page.getByText('Die Fußzeile ist derzeit leer.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Zur Fußzeile' })).toHaveAttribute('href', '/einstellungen/rechnungen')
  })

  test('AC: Musterrechnung: Kleinunternehmer ohne USt mit Hinweis, Standard-Baustein, Fußzeile, nächste Nummer ohne Verbrauch', async ({ page, users }) => {
    const owner = await users()
    const tenantId = await createTenant('QA41 Klein', [{ user: owner, role: 'owner' }])
    await service().from('vat_status_changes').insert({ tenant_id: tenantId, valid_from: '2020-01-01', small_business: true } as never)
    await service().from('invoice_settings').update({ footer: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bank QA Fußzeile' }] }] } } as never).eq('tenant_id', tenantId)
    await signInAs(page, owner)
    await page.goto('/einstellungen/briefpapier')
    await ready(page)
    const text = previewText(page)
    await expect(text).toContainText('Rechnungsbetrag', { timeout: 15_000 })
    await expect(text).toContainText('Umsatzsteuerfrei')
    await expect(text).not.toContainText('Darin enthaltene Umsatzsteuer')
    await expect(text).toContainText('Bank QA Fußzeile')
    await expect(text).toContainText('Muster')
    const year = new Date().getFullYear()
    await expect(text).toContainText(`Rechnungsnummer: ${year}-0001`)
    const { count } = await service().from('invoices').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)
    expect(count).toBe(0)
  })

  test('AC: Vorschau schlägt fehl: Meldung mit „Erneut versuchen“, Speichern bleibt möglich, danach wieder Vorschau', async ({ page, users }) => {
    const owner = await users()
    await createTenant('QA41 Fehler', [{ user: owner, role: 'owner' }])
    await signInAs(page, owner)
    let fail = true
    await page.route('**/api/briefpapier/vorschau', (r) => (fail ? r.fulfill({ status: 500 }) : r.continue()))
    await page.goto('/einstellungen/briefpapier')
    await ready(page)
    await expect(page.getByText('Die Vorschau konnte nicht erstellt werden.')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByRole('button', { name: 'Speichern', exact: true })).toBeEnabled()
    fail = false
    await page.getByRole('button', { name: 'Erneut versuchen' }).click()
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Die Vorschau konnte nicht erstellt werden.')).toHaveCount(0)
  })

  test('AC: Ältere Antwort ersetzt die neuere nicht; während der Erstellung bleibt die alte Fassung mit Hinweis', async ({ page, users }) => {
    const owner = await users()
    await createTenant('QA41 Reihenfolge', [{ user: owner, role: 'owner' }])
    await signInAs(page, owner)
    await page.route('**/api/briefpapier/vorschau', async (r) => {
      const values = r.request().postDataJSON().values
      // die Schrift Tinos antwortet langsam, Arimo sofort
      if (values.fontSize === '9') await new Promise((d) => setTimeout(d, 4000))
      await r.continue()
    })
    await page.goto('/einstellungen/briefpapier')
    await ready(page)
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15_000 })
    await page.getByLabel('Grundschriftgröße in pt').fill('9')
    await expect(page.getByText('Vorschau wird aktualisiert')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('canvas').first()).toBeVisible()
    await page.getByLabel('Grundschriftgröße in pt').fill('13')
    const newest = page.waitForResponse((r) => r.url().includes('/vorschau') && r.request().postDataJSON().values.fontSize === '13')
    await newest
    await page.waitForTimeout(5000)
    await expect(page.getByText('Vorschau wird aktualisiert')).toHaveCount(0)
    expect(await page.locator('canvas').count()).toBeGreaterThan(0)
  })

  test('Fenstergröße schnell geändert: Seite bleibt gezeichnet (nicht leer)', async ({ page, users }) => {
    const owner = await users()
    await createTenant('QA41 Größe', [{ user: owner, role: 'owner' }])
    await signInAs(page, owner)
    await page.goto('/einstellungen/briefpapier')
    await ready(page)
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15_000 })
    for (const width of [1400, 1200, 1100, 1050, 1300, 1250]) await page.setViewportSize({ width, height: 900 })
    await page.waitForTimeout(1500)
    const inked = await page.locator('canvas').first().evaluate((c: HTMLCanvasElement) => {
      const d = c.getContext('2d')!.getImageData(0, 0, c.width, c.height).data
      let dark = 0
      for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 0 && d[i] < 100) dark++
      return dark
    })
    expect(inked).toBeGreaterThan(100)
  })

  test('Barrierefreiheit und Bedienelemente mindestens 44 px', async ({ page, users }) => {
    const { default: AxeBuilder } = await import('@axe-core/playwright')
    const owner = await users()
    await createTenant('QA41 Axe', [{ user: owner, role: 'owner' }])
    await signInAs(page, owner)
    await page.goto('/einstellungen/briefpapier')
    await ready(page)
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15_000 })
    await page.getByRole('switch', { name: 'Aussteller-Block im Kopf anzeigen' }).click()
    await page.getByLabel('Grundschriftgröße in pt').fill('7')
    await expect(page.getByText('Bitte 8 bis 14 pt')).toBeVisible()
    const results = await new AxeBuilder({ page }).include('main').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    expect(results.violations.map((v) => `${v.id}: ${v.nodes[0].target}`)).toEqual([])
    const small = await page.locator('main form button, main form input, main form [role=switch], main form [role=combobox]').evaluateAll((els) =>
      els.filter((e) => (e as HTMLElement).offsetParent !== null && e.getBoundingClientRect().height < 44).map((e) => `${e.tagName} ${e.getAttribute('role')} ${e.getBoundingClientRect().height}`)
    )
    expect(small).toEqual([])
  })
})

test.describe('QA: Logo und frühe Eingabe', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('BUG-3: Eingabe vor dem Aktivwerden des Formulars geht nicht verloren', async ({ page, users }) => {
    const owner = await users()
    await createTenant('QA41 Früh', [{ user: owner, role: 'owner' }])
    await signInAs(page, owner)
    let release = () => {}
    const held = new Promise<void>((r) => (release = r))
    await page.route('**/*.js', async (route) => {
      await held
      await route.continue()
    })
    await page.goto('/einstellungen/briefpapier', { waitUntil: 'commit' })
    const field = page.getByLabel('Grundschriftgröße in pt')
    await field.waitFor()
    await field.fill('13')
    release()
    await ready(page)
    await page.waitForTimeout(500)
    await expect(field).toHaveValue('13')
    await expect(page.getByRole('button', { name: 'Speichern', exact: true })).toBeVisible()
    const res = page.waitForResponse((r) => r.url().includes('/vorschau') && r.request().postDataJSON().values.fontSize === '13', { timeout: 8000 })
    await res
  })

  test('AC: Keine Verbindung beim Speichern: Meldung, Eingaben bleiben', async ({ page, users }) => {
    const owner = await users()
    await createTenant('QA41 Offline', [{ user: owner, role: 'owner' }])
    await signInAs(page, owner)
    await page.goto('/einstellungen/briefpapier')
    await ready(page)
    await page.getByLabel('Grundschriftgröße in pt').fill('12')
    await page.route('**/einstellungen/briefpapier', (r) => (r.request().method() === 'POST' ? r.abort() : r.continue()))
    await page.getByRole('button', { name: 'Speichern', exact: true }).click()
    await expect(page.getByText('Keine Verbindung.')).toBeVisible()
    await expect(page.getByLabel('Grundschriftgröße in pt')).toHaveValue('12')
  })

  test('Logo eingetragen, Datei fehlt: Hinweis, Vorschau ohne Logo; im Entwurf kein Hinweis (BUG-4)', async ({ page, users }) => {
    const owner = await users()
    const tenantId = await createTenant('QA41 Fehlend', [{ user: owner, role: 'owner' }])
    await service().from('tenants').update({ logo_path: `${tenantId}/${randomUUID()}.png` }).eq('id', tenantId)
    const draftId = await addDraft(owner, tenantId)
    await signInAs(page, owner)
    await page.goto('/einstellungen/briefpapier')
    await ready(page)
    await expect(page.getByText('Das Logo konnte nicht geladen werden.')).toBeVisible({ timeout: 15_000 })
    await expect(previewText(page)).toContainText('Rechnungsbetrag')
    await page.goto(`/rechnungen/${draftId}/vorschau`)
    await expect(page.getByRole('article', { name: 'Rechnungsvorschau' })).toContainText('Rechnungsbetrag', { timeout: 15_000 })
    await expect(page.getByText('Das Logo konnte nicht geladen werden.')).toBeVisible()
  })

  test('Lange Fußzeile: Hinweis, Rechnung bleibt erzeugbar', async ({ page, users }) => {
    const owner = await users()
    const tenantId = await createTenant('QA41 Fuß', [{ user: owner, role: 'owner' }])
    await service().from('invoice_settings').update({ footer: { type: 'doc', attrs: { fontSize: 14 }, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Bankverbindung IBAN AT12 3456 '.repeat(60) }] }] } } as never).eq('tenant_id', tenantId)
    await signInAs(page, owner)
    await page.goto('/einstellungen/briefpapier')
    await ready(page)
    await expect(page.getByText('mehr als ein Drittel der Seite')).toBeVisible({ timeout: 15_000 })
    await expect(page.locator('canvas').first()).toBeVisible()
  })

  test('Sehr breites Logo und mittiges Logo: Hinweis „erscheint kleiner“, Höhe 35 mittig', async ({ page, users }) => {
    const owner = await users()
    const tenantId = await createTenant('QA41 Breit', [{ user: owner, role: 'owner' }])
    const path = await addLogo(tenantId)
    await signInAs(page, owner)
    await page.goto('/einstellungen/briefpapier')
    await ready(page)
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15_000 })
    await page.getByLabel('Höhe in mm').fill('35')
    await page.getByRole('combobox', { name: 'Position' }).click()
    await page.getByRole('option', { name: 'Mittig' }).click()
    await expect(page.getByText('erscheint deshalb kleiner')).toBeVisible({ timeout: 8000 })
    await page.getByRole('switch', { name: 'Aussteller-Block im Kopf anzeigen' }).click()
    await expect(page.getByText('erscheint deshalb kleiner')).toHaveCount(0, { timeout: 8000 })
    await service().storage.from(BUCKET).remove([path])
  })
})

test.describe('QA: Betreiber', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('AC: Betreiber speichert, Inhaber sieht es; Protokoll zeigt „Briefpapier“ ohne Werte; deaktiviert nur ansehen', async ({ browser, page, users }) => {
    const owner = await users()
    const admin = await users({ admin: true })
    const tenantId = await createTenant('QA41 Op', [{ user: owner, role: 'owner' }])
    await signInAsAdmin(page, admin)
    await page.goto(`/betreiber/kunden/${tenantId}`)
    await ready(page)
    await page.getByLabel('Grundschriftgröße in pt').fill('13')
    await page.getByRole('button', { name: 'Speichern', exact: true }).first().scrollIntoViewIfNeeded()
    await page.locator('section').filter({ has: page.getByRole('heading', { level: 2, name: 'Briefpapier' }) }).getByRole('button', { name: 'Speichern', exact: true }).click()
    await expect(page.getByText('Briefpapier gespeichert.')).toBeVisible()
    await page.reload()
    await ready(page)
    await expect(page.getByLabel('Grundschriftgröße in pt')).toHaveValue('13')
    const logSection = page.locator('section').filter({ has: page.getByRole('heading', { level: 2, name: 'Protokoll' }) })
    await expect(page.locator('main')).toContainText('Briefpapier')
    expect(await logSection.count()).toBeGreaterThanOrEqual(0)
    const { data: log } = await service().from('operator_log').select('changed_fields').eq('tenant_id', tenantId).eq('action', 'invoice_settings')
    expect(JSON.stringify(log)).toContain('letterhead')
    expect(JSON.stringify(log)).not.toContain('13')

    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const ownerPage = await ctx.newPage()
    await signInAs(ownerPage, owner)
    await ownerPage.goto('/einstellungen/briefpapier')
    await expect(ownerPage.getByLabel('Grundschriftgröße in pt')).toHaveValue('13')
    await ctx.close()

    await service().from('tenants').update({ status: 'deactivated' }).eq('id', tenantId)
    await page.reload()
    await ready(page)
    await expect(page.getByLabel('Grundschriftgröße in pt')).toBeDisabled()
    await expect(page.getByText('Die Einstellungen lassen sich nur ansehen.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Auf Standard zurücksetzen' })).toHaveCount(0)
    await expect(previewText(page)).toContainText('QA41 Op', { timeout: 15_000 })
  })
})

test.describe('QA: Entwurf', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('AC: Gespeicherte Änderung am Briefpapier gilt im offenen Entwurf; Aussteller-Block aus; ungespeicherter Stand aus dem Formular', async ({ page, users }) => {
    const owner = await users()
    const tenantId = await createTenant('QA41 Draft', [{ user: owner, role: 'owner' }])
    await service().from('tenants').update({ address_line1: 'Seeweg 12', postal_code: '5340', city: 'St. Gilgen', country: 'AT', vat_id: 'ATU12345678' } as never).eq('id', tenantId)
    const draftId = await addDraft(owner, tenantId)
    await signInAs(page, owner)
    await page.goto(`/rechnungen/${draftId}/vorschau`)
    const preview = page.getByRole('article', { name: 'Rechnungsvorschau' })
    await expect(preview).toContainText('QA41 Draft', { timeout: 15_000 })
    await service().from('invoice_settings').update({ letterhead_show_issuer: false } as never).eq('tenant_id', tenantId)
    await page.reload()
    await expect(preview).toContainText('Rechnungsbetrag', { timeout: 15_000 })
    await expect(preview).not.toContainText('QA41 Draft')

    await page.goto(`/rechnungen/${draftId}/bearbeiten`)
    await ready(page)
    await page.getByLabel('Name', { exact: false }).first().fill('Geänderter Empfänger')
    await page.getByRole('button', { name: 'Vorschau' }).click()
    await expect(preview).toContainText('Geänderter Empfänger', { timeout: 15_000 })
    await page.getByRole('button', { name: 'Zurück zum Entwurf' }).first().click()
    await expect(page.getByLabel('Name', { exact: false }).first()).toHaveValue('Geänderter Empfänger')
  })

  test('Ungespeicherter Stand mit leeren Feldern und langen Eingaben ergibt trotzdem eine Vorschau', async ({ page, users }) => {
    const owner = await users()
    const tenantId = await createTenant('QA41 Leer', [{ user: owner, role: 'owner' }])
    const draftId = await addDraft(owner, tenantId)
    await signInAs(page, owner)
    await page.goto(`/rechnungen/${draftId}/bearbeiten`)
    await ready(page)
    await page.getByLabel('Name', { exact: false }).first().fill('')
    await page.getByLabel('Rechnungsdatum').fill('')
    const res = page.waitForResponse('**/api/rechnungen/vorschau')
    await page.getByRole('button', { name: 'Vorschau' }).click()
    expect((await res).status()).toBe(200)
  })

  test('Mehrseitiger Entwurf: zwei gezeichnete Seiten, Seitenzahl, Nummer ab Seite 2, Aufdruck auf jeder Seite', async ({ page, users }) => {
    const owner = await users()
    const tenantId = await createTenant('QA41 Lang', [{ user: owner, role: 'owner' }])
    const draftId = await addDraft(owner, tenantId)
    // Bis 50 Positionen erlaubt: direkt in die Tabelle, ohne Bezug zur Buchung
    const rows = Array.from({ length: 49 }, (_, i) => ({ invoice_id: draftId, tenant_id: tenantId, position: i + 2, label: `Leistung ${i}`, amount_cents: 1000, vat_rate: 10 }))
    const { error } = await service().from('invoice_lines').insert(rows as never)
    if (error) throw error
    await signInAs(page, owner)
    await page.goto(`/rechnungen/${draftId}/vorschau`)
    await expect(page.locator('canvas').nth(1)).toBeVisible({ timeout: 15_000 })
    const pages = page.getByTestId('pdf-text').locator('p')
    const count = await pages.count()
    expect(count).toBeGreaterThan(1)
    for (let i = 0; i < count; i++) {
      const t = await pages.nth(i).textContent()
      expect(t).toContain(`Seite ${i + 1} von ${count}`)
      expect(t).toContain('Entwurf')
    }
    expect(await pages.nth(1).textContent()).toContain('Rechnungsnummer: Entwurf')
  })
})

test.describe('QA: Sicherheit', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('Fremde Kunden, fremde Entwürfe und Buchungen, Betreiber auf Entwürfen, ungültige Eingaben, abgemeldet', async ({ browser, page, users }) => {
    const owner = await users()
    const other = await users()
    const admin = await users({ admin: true })
    const tenantId = await createTenant('QA41 Sec A', [{ user: owner, role: 'owner' }])
    const otherTenant = await createTenant('QA41 Sec B', [{ user: other, role: 'owner' }])
    const draftId = await addDraft(owner, tenantId)
    const { data: row } = await service().from('invoices').select('booking_id').eq('id', draftId).single()
    await signInAs(page, other)
    const post = (url: string, data: unknown) => page.request.post(url, { data: data as never, failOnStatusCode: false })
    const unsaved = { bookingId: row!.booking_id, draftId: null, kind: 'invoice', invoiceDate: '2026-10-20', recipientKind: 'guest', recipient: { name: 'X', line1: '', line2: '', postalCode: '', city: '', country: '', vatId: '' }, companySalutation: 'generic', guestNames: 'none', lines: [], deductionIds: [], texts: { intro: null, payment: null, closing: null }, payment: { depositPercent: null, depositDays: null, dueDays: 0, dueBasis: 'after_invoice' } }
    expect((await post('/api/briefpapier/vorschau', { tenantId, values: VALUES })).status()).toBe(403)
    expect((await post('/api/rechnungen/vorschau', { draftId })).status()).toBe(404)
    expect((await post('/api/rechnungen/vorschau', unsaved)).status()).toBe(404)
    // Ungültiges
    expect((await post('/api/briefpapier/vorschau', { tenantId: otherTenant, values: { ...VALUES, fontSize: '99' } })).status()).toBe(400)
    expect((await post('/api/briefpapier/vorschau', { tenantId: otherTenant, values: { ...VALUES, fontFamily: '../../etc/passwd' } })).status()).toBe(400)
    expect((await post('/api/rechnungen/vorschau', { bookingId: 'x' })).status()).toBe(400)
    expect((await post('/api/rechnungen/vorschau', { draftId: "' or 1=1" })).status()).toBe(404)
    expect((await page.request.post('/api/briefpapier/vorschau', { data: 'kein json', headers: { 'content-type': 'application/json' }, failOnStatusCode: false })).status()).toBe(403)
    expect((await page.request.get('/api/briefpapier/vorschau', { failOnStatusCode: false })).status()).toBe(405)

    const adminCtx = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const adminPage = await adminCtx.newPage()
    await signInAsAdmin(adminPage, admin)
    expect((await adminPage.request.post('/api/rechnungen/vorschau', { data: { draftId }, failOnStatusCode: false })).status()).toBe(403)
    expect((await adminPage.request.post('/api/briefpapier/vorschau', { data: { tenantId, values: VALUES }, failOnStatusCode: false })).status()).toBe(200)
    await adminCtx.close()

    const anonCtx = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const a = await anonCtx.request.post('http://localhost:3000/api/briefpapier/vorschau', { data: { tenantId, values: VALUES }, maxRedirects: 0, failOnStatusCode: false })
    expect(a.status()).not.toBe(200)
    expect(a.headers()['content-type'] ?? '').not.toContain('application/pdf')
    await anonCtx.close()
  })

  test('Vorschau eines Entwurfs mit riesigem Text und viele Anfragen gleichzeitig: Server bleibt erreichbar', async ({ page, users }) => {
    const owner = await users()
    const tenantId = await createTenant('QA41 Last', [{ user: owner, role: 'owner' }])
    const draftId = await addDraft(owner, tenantId)
    const { data: row } = await service().from('invoices').select('booking_id').eq('id', draftId).single()
    await signInAs(page, owner)
    const body = (text: string) => ({ bookingId: row!.booking_id, draftId, kind: 'invoice', invoiceDate: '2026-10-20', recipientKind: 'guest', recipient: { name: 'X', line1: '', line2: '', postalCode: '', city: '', country: '', vatId: '' }, companySalutation: 'generic', guestNames: 'none', lines: [], deductionIds: [], texts: { intro: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }, payment: null, closing: null }, payment: { depositPercent: null, depositDays: null, dueDays: 0, dueBasis: 'after_invoice' } })
    const t0 = Date.now()
    const big = await page.request.post('/api/rechnungen/vorschau', { data: body('Wort '.repeat(600_000)), failOnStatusCode: false, timeout: 60_000 })
    const bigStatus = big.status()
    const bigMs = Date.now() - t0
    const t1 = Date.now()
    const many = await Promise.all(Array.from({ length: 30 }, () => page.request.post('/api/rechnungen/vorschau', { data: { draftId }, failOnStatusCode: false, timeout: 60_000 })))
    const statuses = many.map((r) => r.status())
    console.log('QA-LAST', JSON.stringify({ bigStatus, bigMs, bigBytes: (await big.body()).length, manyMs: Date.now() - t1, statuses: [...new Set(statuses)] }))
    expect((await page.request.get('/api/briefpapier/vorschau', { failOnStatusCode: false })).status()).toBe(405)
  })
})
