import { expect, type Page, test as base } from '@playwright/test'

import { createTenant, createUser, deleteUser, type E2EUser, hasSupabaseEnv, service, signInAs } from './support/supabase'

// PROJ-48: Ort und Land aus der PLZ im Gastformular (Gast- und Firmenanschrift). Abläufe nur im Projekt „desktop“.

const test = base.extend<{ users: (opts?: Parameters<typeof createUser>[0]) => Promise<E2EUser> }>({
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

type Users = (opts?: Parameters<typeof createUser>[0]) => Promise<E2EUser>
const desktopOnly = () => test.skip(test.info().project.name !== 'desktop', 'Abläufe nur im Desktop-Projekt')
const ready = (page: Page) =>
  page.waitForFunction(() => Object.keys(document.querySelector('main') ?? {}).some((k) => k.startsWith('__reactFiber')))
const panel = (page: Page) => page.getByRole('dialog')
const address = (page: Page) => panel(page).getByRole('group', { name: 'Adresse', exact: true })
const billing = (page: Page) => panel(page).getByRole('group', { name: 'Rechnungsadresse' })
const SOURCE = 'Ort aus der PLZ · Daten: RTR, GeoNames'

async function setup(page: Page, users: Users) {
  const owner = await users({ displayName: 'Olga Owner' })
  const tenantId = await createTenant('QA48 Testkunde', [{ user: owner, role: 'owner' }])
  await signInAs(page, owner)
  return { tenantId }
}

async function openCreate(page: Page) {
  await page.goto('/gaeste')
  await ready(page)
  await page.getByRole('button', { name: 'Gast anlegen' }).click()
}

async function chooseCountry(page: Page, scope: ReturnType<typeof address>, label: string, name: string) {
  await scope.getByRole('combobox', { name: label }).click()
  await page.getByPlaceholder('Land suchen').fill(name)
  await page.getByRole('option', { name, exact: true }).click()
}

test.beforeEach(() => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')
})

test.describe('Gastanschrift', () => {
  test('AC: 6020 füllt Innsbruck und Österreich, Korrektur auf 80331 ersetzt beides; Speichern übernimmt die Werte', async ({ page, users }) => {
    desktopOnly()
    await setup(page, users)
    await openCreate(page)
    await panel(page).getByLabel('Nachname').fill('Huber')
    await chooseCountry(page, panel(page), 'Herkunftsland', 'Österreich')

    await address(page).getByLabel('PLZ').fill('6020')
    await expect(address(page).getByLabel('Ort', { exact: true })).toHaveValue('Innsbruck')
    await expect(address(page).getByRole('combobox', { name: 'Land' })).toHaveText('Österreich')
    await expect(address(page).getByText(SOURCE)).toBeVisible()

    await address(page).getByLabel('PLZ').fill('D-80331')
    await expect(address(page).getByLabel('Ort', { exact: true })).toHaveValue('München')
    await expect(address(page).getByRole('combobox', { name: 'Land' })).toHaveText('Deutschland')
    await expect(address(page).getByLabel('PLZ')).toHaveValue('D-80331')

    await panel(page).getByRole('button', { name: 'Gast anlegen' }).click()
    await expect(page.getByRole('heading', { name: 'Huber', exact: true })).toBeVisible()
    await expect(page.getByText('D-80331 München', { exact: true })).toBeVisible()
  })

  test('AC: Von Hand eingetragener Ort und anderes Land bleiben; Herkunftsland wird nie befüllt', async ({ page, users }) => {
    desktopOnly()
    await setup(page, users)
    await openCreate(page)
    await address(page).getByLabel('Ort', { exact: true }).fill('Hötting')
    await address(page).getByLabel('PLZ').fill('6020')
    await expect(address(page).getByRole('combobox', { name: 'Land' })).toHaveText('Österreich')
    await expect(address(page).getByLabel('Ort', { exact: true })).toHaveValue('Hötting')
    await expect(address(page).getByText(SOURCE)).toHaveCount(0)
    await expect(panel(page).getByRole('combobox', { name: 'Herkunftsland' })).toHaveText('Land wählen')

    await address(page).getByLabel('Ort', { exact: true }).fill('')
    await chooseCountry(page, address(page), 'Land', 'Schweiz')
    await address(page).getByLabel('PLZ').fill('8010')
    await expect(address(page).getByLabel('Ort', { exact: true })).toHaveValue('')
    await expect(address(page).getByRole('combobox', { name: 'Land' })).toHaveText('Schweiz')
  })

  test('AC: Mehrere Orte – Auswahl per Tastatur übernimmt den Ort; unbekannte PLZ ändert nichts', async ({ page, users }) => {
    desktopOnly()
    await setup(page, users)
    await openCreate(page)
    await address(page).getByLabel('PLZ').fill('24376')
    const choices = address(page).getByRole('group', { name: /Mehrere Orte/ })
    await expect(choices.getByRole('button', { name: 'Kappeln' })).toBeVisible()
    await expect(address(page).getByLabel('Ort', { exact: true })).toHaveValue('')
    await expect(address(page).getByRole('combobox', { name: 'Land' })).toHaveText('Deutschland')

    await choices.getByRole('button', { name: 'Kappeln' }).focus()
    await page.keyboard.press('Enter')
    await expect(address(page).getByLabel('Ort', { exact: true })).toHaveValue('Kappeln')
    await expect(choices).toHaveCount(0)

    await address(page).getByLabel('PLZ').fill('99999')
    await expect(address(page).getByLabel('Ort', { exact: true })).toHaveValue('Kappeln')
  })
})

test.describe('Firmenanschrift', () => {
  test('AC: PLZ der Firma füllt Ort und Staat der Firma, die Gastanschrift bleibt leer', async ({ page, users }) => {
    desktopOnly()
    await setup(page, users)
    await openCreate(page)
    await panel(page).getByRole('button', { name: /Firma/ }).click()
    await billing(page).getByLabel('PLZ').fill('A-1010')
    await expect(billing(page).getByLabel('Ort', { exact: true })).toHaveValue('Wien')
    await expect(billing(page).getByRole('combobox', { name: 'Staat' })).toHaveText('Österreich')
    await expect(address(page).getByLabel('Ort', { exact: true })).toHaveValue('')
    await expect(address(page).getByRole('combobox', { name: 'Land' })).toHaveText('Land wählen')
  })

  test('AC: Bestehender Gast – gespeicherter Ort bleibt bei geänderter PLZ', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const { data, error } = await service()
      .from('guests')
      .insert({ tenant_id: tenantId, country: 'AT', last_name: 'Berger', postal_code: '6020', city: 'Innsbruck-Hötting', address_country: 'AT' } as never)
      .select('id')
      .single()
    if (error) throw error
    await page.goto(`/gaeste/${(data as { id: string }).id}`)
    await ready(page)
    await page.getByRole('button', { name: 'Bearbeiten' }).click()
    await address(page).getByLabel('PLZ').fill('5020')
    await expect(address(page).getByLabel('Ort', { exact: true })).toHaveValue('Innsbruck-Hötting')
    await expect(address(page).getByText(SOURCE)).toHaveCount(0)
  })
})
