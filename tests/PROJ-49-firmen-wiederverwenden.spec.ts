import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test as base } from '@playwright/test'

import { createTenant, createUser, deleteUser, type E2EUser, hasSupabaseEnv, service, signInAs } from './support/supabase'

// PROJ-49: Firmen anderer Gäste im Gastformular übernehmen. Abläufe nur auf breiten Bildschirmen, Darstellung in allen Projekten.

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
const desktopOnly = () => test.skip(['mobile', 'tablet'].includes(test.info().project.name), 'Abläufe nur auf breiten Bildschirmen')
const ready = (page: Page) =>
  page.waitForFunction(() => Object.keys(document.querySelector('main') ?? {}).some((k) => k.startsWith('__reactFiber')))
const panel = (page: Page) => page.getByRole('dialog')
const billing = (page: Page) => panel(page).getByRole('group', { name: 'Rechnungsadresse' })
const companyName = (page: Page) => panel(page).getByRole('combobox', { name: 'Firmenname' })
const list = (page: Page) => panel(page).getByRole('listbox', { name: 'Firmen anderer Gäste' })

type Company = Partial<Record<'company_vat_id' | 'company_address_line1' | 'company_address_line2' | 'company_postal_code' | 'company_city' | 'company_country', string>>

async function seedGuest(tenantId: string, lastName: string, name: string, company: Company = {}) {
  const { data, error } = await service()
    .from('guests')
    .insert({ tenant_id: tenantId, country: 'AT', last_name: lastName, company_name: name, ...company } as never)
    .select('id')
    .single()
  if (error) throw error
  return (data as { id: string }).id
}

async function setup(page: Page, users: Users) {
  const owner = await users({ displayName: 'Olga Owner' })
  const tenantId = await createTenant('QA49 Testkunde', [{ user: owner, role: 'owner' }])
  await signInAs(page, owner)
  return { tenantId, owner }
}

async function openCreate(page: Page) {
  await page.goto('/gaeste')
  await ready(page)
  await page.getByRole('button', { name: 'Gast anlegen' }).click()
  await panel(page).getByRole('button', { name: /Firma/ }).click()
}

async function fillRequired(page: Page, lastName: string) {
  await panel(page).getByLabel('Nachname').fill(lastName)
  await panel(page).getByRole('combobox', { name: 'Herkunftsland' }).click()
  await page.getByPlaceholder('Land suchen').fill('Österreich')
  await page.getByRole('option', { name: 'Österreich', exact: true }).click()
}

test.beforeEach(() => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')
})

test.describe('Gästeseite', () => {
  test('AC: Fassungen getrennt, neueste oben, mit UID/Ort/Adresse; Tastaturwahl übernimmt alle Felder und speichert', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    await seedGuest(tenantId, 'Alt', 'Muster GmbH', { company_address_line1: 'Ringstraße 5', company_postal_code: '1010', company_city: 'Wien' })
    await seedGuest(tenantId, 'Neu', 'Muster GmbH', {
      company_vat_id: 'ATU12345678',
      company_address_line1: 'Hauptstraße 1',
      company_postal_code: '1010',
      company_city: 'Wien',
      company_country: 'AT',
    })
    await openCreate(page)
    await fillRequired(page, 'Kollege')

    await companyName(page).fill('m')
    await page.waitForTimeout(500)
    await expect(list(page)).toBeHidden()

    await companyName(page).fill('MÜS')
    const options = list(page).getByRole('option')
    await expect(options).toHaveCount(2)
    await expect(options.nth(0)).toHaveText('Muster GmbHATU12345678 · 1010 Wien · Hauptstraße 1')
    await expect(options.nth(1)).toHaveText('Muster GmbH1010 Wien · Ringstraße 5')
    await expect(panel(page).locator('[aria-live="polite"]').filter({ hasText: 'Firmen gefunden' })).toHaveText(
      '2 Firmen gefunden, mit Pfeiltasten wählen.'
    )

    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await expect(list(page)).toBeHidden()
    await expect(companyName(page)).toHaveValue('Muster GmbH')
    await expect(panel(page).getByLabel('UID-Nummer')).toHaveValue('ATU12345678')
    await expect(billing(page).getByLabel('Adresszeile 1')).toHaveValue('Hauptstraße 1')
    await expect(billing(page).getByLabel('PLZ')).toHaveValue('1010')
    await expect(billing(page).getByLabel('Ort', { exact: true })).toHaveValue('Wien')
    await expect(billing(page).getByRole('combobox', { name: 'Staat' })).toHaveText('Österreich')
    // Enter hat das Formular nicht abgeschickt
    await expect(panel(page)).toBeVisible()

    await panel(page).getByRole('button', { name: 'Gast anlegen' }).click()
    await expect(page.getByRole('heading', { name: 'Kollege', exact: true })).toBeVisible()
    await expect(page.getByText('Hauptstraße 1', { exact: true })).toBeVisible()
  })

  test('AC: Übernahme ersetzt vorhandene Firmenfelder, leere Werte leeren; Maus wählt; Esc und Tab übernehmen nichts', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    await seedGuest(tenantId, 'Quelle', 'Beispiel KG', { company_vat_id: 'ATU87654321', company_city: 'Graz' })
    await openCreate(page)

    // Esc schließt nur die Liste, das Panel bleibt offen, der Text bleibt stehen
    await companyName(page).fill('beisp')
    await expect(list(page).getByRole('option')).toHaveCount(1)
    await page.keyboard.press('Escape')
    await expect(list(page)).toBeHidden()
    await expect(panel(page)).toBeVisible()
    await expect(companyName(page)).toHaveValue('beisp')

    // Tab schließt die Liste ohne Übernahme
    await companyName(page).fill('beispi')
    await expect(list(page).getByRole('option')).toHaveCount(1)
    await page.keyboard.press('Tab')
    await expect(list(page)).toBeHidden()
    await expect(companyName(page)).toHaveValue('beispi')
    await expect(panel(page).getByLabel('UID-Nummer')).toHaveValue('')

    // Vorhandene Werte werden ersetzt bzw. geleert
    await panel(page).getByLabel('UID-Nummer').fill('ATU99999999')
    await billing(page).getByLabel('Adresszeile 2').fill('Top 5')
    await companyName(page).fill('Beispiel')
    await list(page).getByRole('option', { name: /Beispiel KG/ }).click()
    await expect(companyName(page)).toHaveValue('Beispiel KG')
    await expect(panel(page).getByLabel('UID-Nummer')).toHaveValue('ATU87654321')
    await expect(billing(page).getByLabel('Adresszeile 2')).toHaveValue('')
    await expect(billing(page).getByLabel('Ort', { exact: true })).toHaveValue('Graz')
    await expect(panel(page).getByLabel('Nachname')).toHaveValue('')
  })

  test('AC: Übernommener Ort bleibt, wenn danach die PLZ der Firma geändert wird (PROJ-48)', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    await seedGuest(tenantId, 'Quelle', 'Plz Test GmbH', { company_postal_code: '1010', company_city: 'Wien', company_country: 'AT' })
    await openCreate(page)
    // erst automatisch befüllt …
    await billing(page).getByLabel('PLZ').fill('6020')
    await expect(billing(page).getByLabel('Ort', { exact: true })).toHaveValue('Innsbruck')
    // … dann Vorschlag übernommen
    await companyName(page).fill('plz test')
    await list(page).getByRole('option').first().click()
    await expect(billing(page).getByLabel('Ort', { exact: true })).toHaveValue('Wien')
    // der übernommene Ort gilt als von Hand eingegeben
    await billing(page).getByLabel('PLZ').fill('5020')
    await expect(billing(page).getByLabel('Ort', { exact: true })).toHaveValue('Wien')
  })

  test('AC: Bearbeiteter Gast liefert keinen eigenen Vorschlag; Firmen anderer Kunden erscheinen nie', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const own = await seedGuest(tenantId, 'Eigen', 'Einzig OG', { company_city: 'Linz' })
    const other = await users({ displayName: 'Fremd' })
    const otherTenant = await createTenant('QA49 Fremdkunde', [{ user: other, role: 'owner' }])
    await seedGuest(otherTenant, 'Fremd', 'Einzig Fremdfirma AG')

    await page.goto(`/gaeste/${own}`)
    await ready(page)
    await page.getByRole('button', { name: 'Bearbeiten' }).click()
    await companyName(page).fill('Einzig')
    await page.waitForTimeout(800)
    await expect(list(page)).toBeHidden()
    await expect(list(page).getByRole('option')).toHaveCount(0)
  })

  test('Kopie statt Verknüpfung: Änderung beim Quell-Gast ändert den übernehmenden Gast nicht', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const source = await seedGuest(tenantId, 'Quelle', 'Kopie GmbH', { company_city: 'Salzburg' })
    await openCreate(page)
    await fillRequired(page, 'Ziel')
    await companyName(page).fill('kopie')
    await list(page).getByRole('option').first().click()
    await panel(page).getByRole('button', { name: 'Gast anlegen' }).click()
    await expect(page.getByRole('heading', { name: 'Ziel', exact: true })).toBeVisible()

    const { error } = await service().from('guests').update({ company_city: 'Hallein' } as never).eq('id', source)
    if (error) throw error
    const { data } = await service().from('guests').select('company_city').eq('tenant_id', tenantId).eq('last_name', 'Ziel').single()
    expect((data as { company_city: string }).company_city).toBe('Salzburg')
  })
})

test.describe('Einsatzorte des Gastformulars', () => {
  test('AC: Mitarbeiter bekommt beim neuen Gast im Buchungsformular Vorschläge', async ({ page, users }) => {
    desktopOnly()
    const owner = await users({ displayName: 'Olga Owner' })
    const staff = await users({ displayName: 'Stefan Staff' })
    const tenantId = await createTenant('QA49 Testkunde', [
      { user: owner, role: 'owner' },
      { user: staff, role: 'staff' },
    ])
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
    await seedGuest(tenantId, 'Früher', 'Dienstwohnung AG', { company_vat_id: 'ATU55555555' })

    await signInAs(page, staff)
    await page.goto('/buchungen')
    await ready(page)
    await page.getByRole('button', { name: 'Neue Buchung' }).first().click()
    await panel(page).getByRole('radio', { name: 'Neuer Gast' }).click()
    await panel(page).getByRole('button', { name: /Firma/ }).click()
    await companyName(page).fill('dienst')
    await list(page).getByRole('option').first().click()
    await expect(panel(page).getByLabel('UID-Nummer')).toHaveValue('ATU55555555')
  })

  test('AC: Neuer Gast beim Nacherfassen einer Rechnung bekommt Vorschläge', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    await seedGuest(tenantId, 'Früher', 'Nacherfasst GmbH', { company_city: 'Bregenz' })
    await page.goto('/rechnungen')
    await ready(page)
    await page.getByRole('button', { name: 'Rechnung nacherfassen' }).first().click()
    await panel(page).getByText('Neuer Gast', { exact: true }).click()
    await panel(page).getByRole('button', { name: /Firma/ }).click()
    await companyName(page).fill('nacherf')
    await list(page).getByRole('option').first().click()
    await expect(billing(page).getByLabel('Ort', { exact: true })).toHaveValue('Bregenz')
  })
})

test.describe('Darstellung', () => {
  test('Vorschlagsliste: Einträge mindestens 44 px, kein seitliches Scrollen, keine axe-Verstöße', async ({ page, users }) => {
    const { tenantId } = await setup(page, users)
    await seedGuest(tenantId, 'Quelle', 'Darstellung GmbH', { company_vat_id: 'ATU12345678', company_postal_code: '1010', company_city: 'Wien', company_address_line1: 'Sehr lange Straßenbezeichnung 123' })
    await openCreate(page)
    await companyName(page).fill('darst')
    const option = list(page).getByRole('option')
    await expect(option).toHaveCount(1)
    const box = await option.first().boundingBox()
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44)
    // Dialog-Animation abwarten, sonst meldet axe Zwischenfarben
    await page.waitForTimeout(400)
    const results = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    expect(results.violations).toEqual([])
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
    expect(overflow).toBe(false)
  })
})
