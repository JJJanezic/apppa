import { expect, type Page, test as base } from '@playwright/test'

import { createTenant, createUser, deleteUser, type E2EUser, hasSupabaseEnv, signInAs, signInAsAdmin } from './support/supabase'

// PROJ-41: Briefpapier. Grundumfang aus dem Frontend (Reiter, Formular, Vorschau). Speichern und Rechte: /backend, /qa.

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
