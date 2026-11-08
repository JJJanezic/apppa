import AxeBuilder from '@axe-core/playwright'
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
// Abläufe auf breiten Bildschirmen: Desktop sowie die optionalen Projekte Firefox und Safari
const desktopOnly = () => test.skip(['mobile', 'tablet'].includes(test.info().project.name), 'Abläufe nur auf breiten Bildschirmen')
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
    await chooseCountry(page, panel(page), 'Staatsangehörigkeit', 'Österreich')

    await address(page).getByLabel('PLZ').fill('6020')
    await expect(address(page).getByLabel('Ort', { exact: true })).toHaveValue('Innsbruck')
    await expect(address(page).getByRole('combobox', { name: 'Herkunftsland' })).toHaveText('Österreich')
    await expect(address(page).getByText(SOURCE)).toBeVisible()
    // Ansage für Screenreader
    await expect(address(page).locator('[aria-live="polite"]')).toHaveText('Ort aus der PLZ übernommen: Innsbruck, Österreich')

    await address(page).getByLabel('PLZ').fill('D-80331')
    await expect(address(page).getByLabel('Ort', { exact: true })).toHaveValue('München')
    await expect(address(page).getByRole('combobox', { name: 'Herkunftsland' })).toHaveText('Deutschland')
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
    await expect(address(page).getByRole('combobox', { name: 'Herkunftsland' })).toHaveText('Österreich')
    await expect(address(page).getByLabel('Ort', { exact: true })).toHaveValue('Hötting')
    await expect(address(page).getByText(SOURCE)).toHaveCount(0)
    await expect(panel(page).getByRole('combobox', { name: 'Staatsangehörigkeit' })).toHaveText('Land wählen')

    await address(page).getByLabel('Ort', { exact: true }).fill('')
    await chooseCountry(page, address(page), 'Herkunftsland', 'Schweiz')
    await address(page).getByLabel('PLZ').fill('8010')
    await expect(address(page).getByLabel('Ort', { exact: true })).toHaveValue('')
    await expect(address(page).getByRole('combobox', { name: 'Herkunftsland' })).toHaveText('Schweiz')
  })

  test('AC: Mehrere Orte – Auswahl per Tastatur übernimmt den Ort; unbekannte PLZ ändert nichts', async ({ page, users }) => {
    desktopOnly()
    await setup(page, users)
    await openCreate(page)
    await address(page).getByLabel('PLZ').fill('24376')
    const choices = address(page).getByRole('group', { name: /Mehrere Orte/ })
    await expect(choices.getByRole('button', { name: 'Kappeln' })).toBeVisible()
    await expect(address(page).getByLabel('Ort', { exact: true })).toHaveValue('')
    await expect(address(page).getByRole('combobox', { name: 'Herkunftsland' })).toHaveText('Deutschland')
    await expect(address(page).locator('[aria-live="polite"]')).toHaveText(/^\d+ Orte zu dieser PLZ gefunden/)

    // Per Tabulator vom Feld „Ort“ in die Auswahl (BUG-1: Safari braucht tabIndex), Eingabetaste wählt
    await address(page).getByLabel('Ort', { exact: true }).focus()
    await page.keyboard.press('Tab')
    await expect(choices.getByRole('button', { name: 'Arnis' })).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(address(page).getByLabel('Ort', { exact: true })).toHaveValue('Arnis')
    await expect(choices).toHaveCount(0)

    await address(page).getByLabel('PLZ').fill('99999')
    await expect(address(page).getByLabel('Ort', { exact: true })).toHaveValue('Arnis')
  })
})

test.describe('Firmenanschrift', () => {
  test('AC: PLZ der Firma füllt Ort und Staat der Firma, die Gastanschrift bleibt leer', async ({ page, users }) => {
    desktopOnly()
    await setup(page, users)
    await openCreate(page)
    await panel(page).getByRole('button', { name: /Firma/ }).click()
    // PROJ-50: Firmenfelder erst nach „Neue Firma“
    await panel(page).getByRole('radio', { name: 'Neue Firma' }).click()
    await billing(page).getByLabel('PLZ').fill('A-1010')
    await expect(billing(page).getByLabel('Ort', { exact: true })).toHaveValue('Wien')
    await expect(billing(page).getByRole('combobox', { name: 'Staat' })).toHaveText('Österreich')
    await expect(address(page).getByLabel('Ort', { exact: true })).toHaveValue('')
    await expect(address(page).getByRole('combobox', { name: 'Herkunftsland' })).toHaveText('Land wählen')
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

test.describe('Einsatzorte des Gastformulars', () => {
  test('AC: Neuer Gast im Buchungsformular – PLZ füllt Ort und Land wie auf der Gästeseite', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const { data: property, error } = await service()
      .from('properties')
      .insert({ tenant_id: tenantId, name: 'Haus See', street: 'Seeweg 12', postal_code: '5340', city: 'St. Gilgen', municipality_code: '50330' })
      .select('id')
      .single()
    if (error) throw error
    const { error: apartmentError } = await service()
      .from('apartments')
      .insert({ tenant_id: tenantId, property_id: property.id, name: 'Top 1', max_guests: 4, price_cents: 10000 } as never)
    if (apartmentError) throw apartmentError
    await page.goto('/buchungen')
    await ready(page)
    await page.getByRole('button', { name: 'Neue Buchung' }).first().click()
    await panel(page).getByRole('radio', { name: 'Neuer Gast' }).click()
    await address(page).getByLabel('PLZ').fill('5020')
    await expect(address(page).getByLabel('Ort', { exact: true })).toHaveValue('Salzburg')
    await expect(address(page).getByRole('combobox', { name: 'Herkunftsland' })).toHaveText('Österreich')
    await expect(address(page).getByText(SOURCE)).toBeVisible()
  })

  test('AC: Neuer Gast beim Nacherfassen einer Rechnung – PLZ füllt Ort und Land', async ({ page, users }) => {
    desktopOnly()
    await setup(page, users)
    await page.goto('/rechnungen')
    await ready(page)
    await page.getByRole('button', { name: 'Rechnung nacherfassen' }).first().click()
    await panel(page).getByText('Neuer Gast', { exact: true }).click()
    await address(page).getByLabel('PLZ').fill('10115')
    await expect(address(page).getByLabel('Ort', { exact: true })).toHaveValue('Berlin')
    await expect(address(page).getByRole('combobox', { name: 'Herkunftsland' })).toHaveText('Deutschland')
  })
})

test.describe('Darstellung', () => {
  test('Auswahl mehrerer Orte: Knöpfe mindestens 44 px, kein seitliches Scrollen, keine axe-Verstöße; Quellenzeile 11 px', async ({ page, users }) => {
    await setup(page, users)
    await openCreate(page)
    await address(page).getByLabel('PLZ').fill('56761')
    const choices = address(page).getByRole('group', { name: /Mehrere Orte/ })
    await expect(choices.getByRole('button')).toHaveCount(11)
    for (const box of await choices.getByRole('button').evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height)))
      expect(box).toBeGreaterThanOrEqual(44)
    await expect(address(page).getByText(SOURCE)).toHaveCSS('font-size', '11px')
    // Dialog-Animation abwarten, sonst meldet axe Zwischenfarben
    await page.waitForTimeout(400)
    const results = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    expect(results.violations).toEqual([])
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(overflow).toBe(false)
  })
})
