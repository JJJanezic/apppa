import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test as base } from '@playwright/test'

import { createTenant, createUser, deleteUser, type E2EUser, hasSupabaseEnv, service, signInAs } from './support/supabase'

// PROJ-33: Firmenanschrift des Gastes in Feldern (Adresszeile 1/2, PLZ, Ort, Staat).
// Abläufe nur im Projekt „desktop“; Anordnung von PLZ/Ort und Barrierefreiheit in allen Breiten.

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
const billing = (page: Page) => panel(page).getByRole('group', { name: 'Rechnungsadresse' })

const ADDRESS = {
  company_name: 'Muster GmbH',
  company_vat_id: 'ATU12345678',
  company_address_line1: 'Musterstraße 1',
  company_address_line2: 'Top 5',
  company_postal_code: '1010',
  company_city: 'Wien',
  company_country: 'AT',
}

async function setup(page: Page, users: Users) {
  const owner = await users({ displayName: 'Olga Owner' })
  const tenantId = await createTenant('QA33 Testkunde', [{ user: owner, role: 'owner' }])
  await signInAs(page, owner)
  return { tenantId }
}

async function addGuest(tenantId: string, fields: Record<string, unknown>) {
  const { data, error } = await service()
    .from('guests')
    .insert({ tenant_id: tenantId, country: 'AT', ...fields } as never)
    .select('id')
    .single()
  if (error) throw error
  return (data as { id: string }).id
}

async function openGuest(page: Page, id: string) {
  await page.goto(`/gaeste/${id}`)
  await ready(page)
}

async function openCompany(page: Page) {
  const trigger = panel(page).getByRole('button', { name: /Firma/ })
  if ((await trigger.getAttribute('aria-expanded')) !== 'true') await trigger.click()
}

// Abschnitt „Firma“ im Gast-Detail als Text (Zeilen getrennt durch Zeilenumbrüche)
const companySection = (page: Page) => page.locator('section').filter({ has: page.getByRole('heading', { name: 'Firma', exact: true }) })

test.beforeEach(() => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')
})

test.describe('Formular', () => {
  test('AC: Firmenname und UID wie bisher, darunter Rechnungsadresse mit Hinweis und fünf Feldern; Staat startet leer; Anlegen zeigt die Zeilen im Detail', async ({ page, users }) => {
    desktopOnly()
    await setup(page, users)
    await page.goto('/gaeste')
    await ready(page)
    await page.getByRole('button', { name: 'Gast anlegen' }).click()
    await panel(page).getByLabel('Nachname').fill('Huber')
    await panel(page).getByRole('combobox', { name: 'Herkunftsland' }).click()
    await page.getByPlaceholder('Land suchen').fill('Österreich')
    await page.getByRole('option', { name: 'Österreich', exact: true }).click()

    await openCompany(page)
    await expect(panel(page).getByLabel('Firmenname')).toBeVisible()
    await expect(panel(page).getByLabel('UID-Nummer')).toBeVisible()
    await expect(billing(page).getByText('Nur angeben, wenn sie von der Adresse oben abweicht.')).toBeVisible()
    await expect(billing(page).getByRole('combobox', { name: 'Staat' })).toHaveText('Land wählen')
    await expect(billing(page).getByLabel('Adresszeile 1')).toHaveAttribute('maxlength', '200')
    await expect(billing(page).getByLabel('Adresszeile 2')).toHaveAttribute('maxlength', '200')
    await expect(billing(page).getByLabel('PLZ')).toHaveAttribute('maxlength', '10')
    await expect(billing(page).getByLabel('Ort')).toHaveAttribute('maxlength', '100')
    // Kein altes Textfeld mehr
    await expect(panel(page).locator('textarea')).toHaveCount(1)

    await panel(page).getByLabel('Firmenname').fill('Muster GmbH')
    await panel(page).getByLabel('UID-Nummer').fill('ATU12345678')
    await billing(page).getByLabel('Adresszeile 1').fill('Musterstraße 1')
    await billing(page).getByLabel('Adresszeile 2').fill('Top 5')
    await billing(page).getByLabel('PLZ').fill('1010')
    await billing(page).getByLabel('Ort').fill('Wien')
    await billing(page).getByRole('combobox', { name: 'Staat' }).click()
    await page.getByPlaceholder('Land suchen').fill('Österreich')
    await page.getByRole('option', { name: 'Österreich', exact: true }).click()
    await panel(page).getByRole('button', { name: 'Gast anlegen' }).click()

    await expect(page.getByRole('heading', { name: 'Huber', exact: true })).toBeVisible()
    const section = companySection(page)
    await expect(section.getByText('Muster GmbH')).toBeVisible()
    await expect(section.getByText('ATU12345678')).toBeVisible()
    for (const line of ['Musterstraße 1', 'Top 5', '1010 Wien', 'Österreich']) await expect(section.getByText(line, { exact: true })).toBeVisible()
  })

  test('AC: Bearbeiten zeigt die gespeicherten Werte aufgeklappt; Staat auf „Keine Angabe“ setzen speichert keinen Staat', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const id = await addGuest(tenantId, { last_name: 'Huber', ...ADDRESS })
    await openGuest(page, id)
    await page.getByRole('button', { name: 'Bearbeiten' }).click()
    await expect(panel(page).getByRole('button', { name: /Firma/ })).toHaveAttribute('aria-expanded', 'true')
    await expect(billing(page).getByLabel('Adresszeile 1')).toHaveValue('Musterstraße 1')
    await expect(billing(page).getByLabel('Adresszeile 2')).toHaveValue('Top 5')
    await expect(billing(page).getByLabel('PLZ')).toHaveValue('1010')
    await expect(billing(page).getByLabel('Ort')).toHaveValue('Wien')
    await expect(billing(page).getByRole('combobox', { name: 'Staat' })).toHaveText('Österreich')

    await billing(page).getByRole('combobox', { name: 'Staat' }).click()
    await page.getByRole('option', { name: 'Keine Angabe' }).click()
    await billing(page).getByLabel('Ort').fill('  Linz  ')
    await panel(page).getByRole('button', { name: 'Speichern' }).click()
    await expect(panel(page)).toHaveCount(0)
    const { data } = await service().from('guests').select('company_city, company_country').eq('id', id).single()
    expect(data).toEqual({ company_city: 'Linz', company_country: null })
    await expect(companySection(page).getByText('1010 Linz', { exact: true })).toBeVisible()
  })

  test('AC: Nur Firmenanschrift ohne Firma und UID: Abschnitt im Detail und im Formular aufgeklappt; nur Ort zeigt nur „Wien“', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const id = await addGuest(tenantId, { last_name: 'Ort', company_city: 'Wien' })
    await openGuest(page, id)
    const section = companySection(page)
    await expect(section).toBeVisible()
    await expect(section.getByText('Wien', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Bearbeiten' }).click()
    await expect(panel(page).getByRole('button', { name: /Firma/ })).toHaveAttribute('aria-expanded', 'true')

    const none = await addGuest(tenantId, { last_name: 'Ohne' })
    await openGuest(page, none)
    await expect(page.getByRole('heading', { name: 'Firma', exact: true })).toHaveCount(0)
  })

  test('AC: Gast mit Firmenname, aber ohne Anschrift: Rechnungsadresse zeigt das Zeichen für fehlende Angaben', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const id = await addGuest(tenantId, { last_name: 'Leer', company_name: 'Leer GmbH' })
    await openGuest(page, id)
    const section = companySection(page)
    await expect(section.getByText('Leer GmbH')).toBeVisible()
    const row = section.locator('div').filter({ has: page.getByText('Rechnungsadresse', { exact: true }) })
    await expect(row.locator('dd')).toHaveText('–')
  })
})

test.describe('Zusammenführen', () => {
  test('AC: Vorschau zeigt Firma samt Anschrift; Auswahl „Firma“ übernimmt alles gemeinsam', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const keep = await addGuest(tenantId, { last_name: 'Huber', first_name: 'Anna', company_name: 'Alt GmbH', company_city: 'Graz' })
    await addGuest(tenantId, { last_name: 'Huber', first_name: 'Anna', ...ADDRESS })
    await openGuest(page, keep)
    await page.getByRole('button', { name: 'Mit anderem Gast zusammenführen' }).click()
    await panel(page).getByRole('combobox').fill('huber')
    await page.getByRole('option', { name: /Huber, Anna/ }).first().click()
    const preview = 'Muster GmbH, ATU12345678, Musterstraße 1, Top 5, 1010 Wien, Österreich'
    await expect(panel(page).getByText('Alt GmbH, Graz')).toBeVisible()
    await panel(page).getByLabel(preview).check()
    await panel(page).getByRole('button', { name: 'Zusammenführen' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Zusammenführen' }).click()
    await expect(page.getByText('Gäste zusammengeführt')).toBeVisible()
    const section = companySection(page)
    for (const line of ['Muster GmbH', 'Musterstraße 1', 'Top 5', '1010 Wien', 'Österreich']) await expect(section.getByText(line, { exact: true })).toBeVisible()
    await expect(section.getByText('Graz')).toHaveCount(0)
  })
})

test.describe('Layout und Barrierefreiheit', () => {
  test('PLZ und Ort ab Tablet nebeneinander, am Handy untereinander; keine WCAG-2.1-AA-Verstöße, kein seitliches Scrollen', async ({ page, users }) => {
    const { tenantId } = await setup(page, users)
    const id = await addGuest(tenantId, { last_name: 'Huber', ...ADDRESS })
    await openGuest(page, id)
    const scan = async (label: string) => {
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      expect(results.violations, label).toEqual([])
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
      expect(overflow, `${label}: seitliches Scrollen`).toBe(false)
    }
    await scan('Detail')
    await page.getByRole('button', { name: 'Bearbeiten' }).click()
    await expect(billing(page).getByLabel('PLZ')).toBeVisible()
    const postal = (await billing(page).getByLabel('PLZ').boundingBox())!
    const city = (await billing(page).getByLabel('Ort').boundingBox())!
    if (test.info().project.name === 'mobile') expect(city.y).toBeGreaterThan(postal.y + postal.height)
    else {
      expect(Math.abs(city.y - postal.y)).toBeLessThan(2)
      expect(city.x).toBeGreaterThan(postal.x + postal.width)
    }
    await scan('Formular')
  })
})
