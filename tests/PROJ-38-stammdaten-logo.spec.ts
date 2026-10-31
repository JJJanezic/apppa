import { expect, type Page, test as base } from '@playwright/test'

import { createTenant, createUser, deleteUser, type E2EUser, hasSupabaseEnv, signInAs } from './support/supabase'

// PROJ-38: Einstellungen-Reiter „Stammdaten“ (vorher „Kunde“), neue Reihenfolge und Umleitungen.
// Speicherfunktion und Zugriffsregeln des Logos: supabase/tests/tenant-logo.integration.test.ts.
// Logo-Abläufe in der Oberfläche ergänzt /qa. Abläufe nur im Projekt „desktop“.

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

const desktopOnly = () => test.skip(test.info().project.name !== 'desktop', 'Abläufe nur im Desktop-Projekt')
const ready = (page: Page) =>
  page.waitForFunction(() => Object.keys(document.querySelector('main') ?? {}).some((k) => k.startsWith('__reactFiber')))

test.describe('Einstellungen → Stammdaten', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('AC: Reiter in der Reihenfolge Stammdaten, Team, Wohnungen; /einstellungen öffnet Stammdaten', async ({ page, users }) => {
    desktopOnly()
    const owner = await users()
    await createTenant('QA38 Reiter', [{ user: owner, role: 'owner' }])
    await signInAs(page, owner)
    await page.goto('/einstellungen')
    await ready(page)
    await expect(page).toHaveURL(/\/einstellungen\/stammdaten$/)
    const tabs = page.getByRole('navigation', { name: 'Einstellungsbereiche' }).getByRole('link')
    await expect(tabs).toHaveText(['Stammdaten', 'Team', 'Wohnungen'])
    await expect(tabs.first()).toHaveAttribute('aria-current', 'page')
    await expect(page).toHaveTitle(/Stammdaten/)
    await expect(page.getByRole('link', { name: 'Kunde', exact: true })).toHaveCount(0)
  })

  test('AC: alte Adresse /einstellungen/kunde leitet weiter, auch mit Zusätzen', async ({ page, users }) => {
    desktopOnly()
    const owner = await users()
    await createTenant('QA38 Umleitung', [{ user: owner, role: 'owner' }])
    await signInAs(page, owner)
    await page.goto('/einstellungen/kunde')
    await expect(page).toHaveURL(/\/einstellungen\/stammdaten$/)
    await page.goto('/einstellungen/kunde?x=1')
    await expect(page).toHaveURL(/\/einstellungen\/stammdaten\?x=1$/)
    await expect(page.getByLabel('Kundenname')).toHaveValue('QA38 Umleitung')
  })
})
