import { expect, type Page, test as base } from '@playwright/test'

import { createTenant, createUser, deleteUser, type E2EUser, hasSupabaseEnv, signInAs } from './support/supabase'

// PROJ-39: Einstellungen → Rechnungen. Grundumfang aus dem Frontend (Reiter, Zugang, Schalter verschoben).
// Speicherfunktionen, Rechte und Vorbelegung: Integrationstests aus /backend; Abläufe in der Oberfläche ergänzt /qa.
// Abläufe nur im Projekt „desktop“.

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

const desktopOnly = () => test.skip(['tablet', 'mobile'].includes(test.info().project.name), 'Abläufe nur im Desktop-Projekt (und Firefox/Safari)')
const ready = (page: Page) =>
  page.waitForFunction(() => Object.keys(document.querySelector('main') ?? {}).some((k) => k.startsWith('__reactFiber')))

test.describe('Reiter und Zugang', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('AC: vierter Reiter „Rechnungen“ mit eigener Adresse, Titel und vier Abschnitten', async ({ page, users }) => {
    desktopOnly()
    const owner = await users()
    await createTenant('QA39 Reiter', [{ user: owner, role: 'owner' }])
    await signInAs(page, owner)
    await page.goto('/einstellungen/stammdaten')
    await ready(page)
    const tabs = page.getByRole('navigation', { name: 'Einstellungsbereiche' }).getByRole('link')
    await expect(tabs).toHaveText(['Stammdaten', 'Team', 'Wohnungen', 'Rechnungen'])
    await tabs.last().click()
    await expect(page).toHaveURL(/\/einstellungen\/rechnungen$/)
    await expect(tabs.last()).toHaveAttribute('aria-current', 'page')
    await expect(page).toHaveTitle(/Rechnungen/)
    for (const name of ['Nummernkreis', 'Textbausteine', 'Feste Texte', 'Nacherfassen']) {
      await expect(page.getByRole('heading', { level: 2, name })).toBeVisible()
    }
  })

  test('AC: Mitarbeiter erhält „Seite nicht gefunden“', async ({ page, users }) => {
    desktopOnly()
    const owner = await users()
    const staff = await users()
    await createTenant('QA39 Mitarbeiter', [
      { user: owner, role: 'owner' },
      { user: staff, role: 'staff' },
    ])
    await signInAs(page, staff)
    const response = await page.goto('/einstellungen/rechnungen')
    expect(response?.status()).toBe(404)
    await expect(page.getByRole('heading', { name: 'Seite nicht gefunden' })).toBeVisible()
  })

  test('AC: Stammdaten ohne Schalter „Rechnungen nacherfassen“; Schalter unter Rechnungen', async ({ page, users }) => {
    desktopOnly()
    const owner = await users()
    await createTenant('QA39 Schalter', [{ user: owner, role: 'owner' }])
    await signInAs(page, owner)
    await page.goto('/einstellungen/stammdaten')
    await ready(page)
    await expect(page.getByLabel('Kundenname')).toBeVisible()
    await expect(page.getByRole('switch', { name: 'Rechnungen nacherfassen' })).toHaveCount(0)
    await page.goto('/einstellungen/rechnungen')
    await ready(page)
    await expect(page.getByRole('switch', { name: 'Rechnungen nacherfassen' })).toBeChecked()
  })
})
