import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test as base } from '@playwright/test'

import { createTenant, createUser, deleteUser, type E2EUser, hasSupabaseEnv, service, signInAs } from './support/supabase'

// PROJ-6: Wohnungsverwaltung. Abläufe nur im Projekt „desktop“, Layout und Barrierefreiheit in allen Breiten.
// Testdaten werden über die Datenbank angelegt; die Kunden verschwinden mit dem Löschen ihrer Inhaber.

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

const ST_GILGEN = '50330'
const desktopOnly = () => test.skip(test.info().project.name !== 'desktop', 'Abläufe nur im Desktop-Projekt')
const ready = (page: Page) =>
  page.waitForFunction(() => Object.keys(document.querySelector('main') ?? {}).some((k) => k.startsWith('__reactFiber')))

async function addProperty(tenantId: string, name: string, municipality = ST_GILGEN) {
  const { data, error } = await service()
    .from('properties')
    .insert({ tenant_id: tenantId, name, street: 'Seeweg 12', postal_code: '5340', city: 'St. Gilgen', municipality_code: municipality })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

async function addApartment(tenantId: string, propertyId: string, name: string, extra: Record<string, unknown> = {}) {
  const { data, error } = await service()
    .from('apartments')
    .insert({ tenant_id: tenantId, property_id: propertyId, name, max_guests: 4, ...extra })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

async function ownerWithTenant(page: Page, users: (opts?: Parameters<typeof createUser>[0]) => Promise<E2EUser>) {
  const owner = await users({ displayName: 'Olga Owner' })
  const tenantId = await createTenant('QA6 Testkunde', [{ user: owner, role: 'owner' }])
  await signInAs(page, owner)
  return { owner, tenantId }
}

async function openApartments(page: Page) {
  await page.goto('/einstellungen/wohnungen')
  await ready(page)
}

const panel = (page: Page) => page.getByRole('dialog')

async function submitPanel(page: Page, label: string) {
  const button = panel(page).getByRole('button', { name: label, exact: true })
  await button.scrollIntoViewIfNeeded()
  await button.click()
}

async function chooseMunicipality(page: Page, option: string, search?: string) {
  await panel(page).getByRole('combobox', { name: /Gemeinde/ }).click()
  if (search) await page.getByPlaceholder('Gemeinde oder PLZ suchen').fill(search)
  await page.getByRole('option', { name: option }).click()
}

test.describe('Zugang', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('AC: Inhaber hat den Reiter „Wohnungen“; Mitarbeiter bekommt „Seite nicht gefunden“', async ({ page, users }) => {
    desktopOnly()
    const owner = await users()
    const staff = await users()
    await createTenant('QA6 Zugang', [{ user: owner, role: 'owner' }, { user: staff, role: 'staff' }])
    await signInAs(page, owner)
    await page.goto('/einstellungen/team')
    await page.getByRole('link', { name: 'Wohnungen' }).click()
    await expect(page).toHaveURL('/einstellungen/wohnungen')

    await page.context().clearCookies()
    await signInAs(page, staff)
    const response = await page.goto('/einstellungen/wohnungen')
    expect(response?.status()).toBe(404)
  })

  test('AC: Daten anderer Kunden sind nicht sichtbar', async ({ page, users }) => {
    desktopOnly()
    const other = await users()
    const otherTenant = await createTenant('QA6 Fremdkunde', [{ user: other, role: 'owner' }])
    await addApartment(otherTenant, await addProperty(otherTenant, 'Fremdes Haus'), 'Fremd 1')
    await ownerWithTenant(page, users)
    await openApartments(page)
    await expect(page.getByText('Fremdes Haus')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Noch keine Wohnung' })).toBeVisible()
  })
})

test.describe('Wohnung anlegen', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('AC: Erste Wohnung: „Neues Objekt“ vorausgewählt, Pflichtfelder, Gemeinde über PLZ, Standardwerte', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await ownerWithTenant(page, users)
    await openApartments(page)
    await expect(page.getByRole('heading', { name: 'Noch keine Wohnung' })).toBeVisible()

    await page.getByRole('button', { name: 'Wohnung anlegen' }).first().click()
    await expect(panel(page).getByRole('combobox', { name: 'Objekt' })).toHaveText(/Neues Objekt/)
    await submitPanel(page, 'Wohnung anlegen')
    for (const message of [
      'Bitte einen Namen für das Objekt eingeben.',
      'Bitte Straße und Hausnummer eingeben.',
      'Bitte eine vierstellige PLZ eingeben.',
      'Bitte den Ort eingeben.',
      'Bitte eine Gemeinde aus der Liste wählen.',
      'Bitte einen Namen für die Wohnung eingeben.',
      'Bitte eine Zahl von 1 bis 50 eingeben.',
    ]) {
      await expect(panel(page).getByText(message)).toBeVisible()
    }

    await panel(page).getByLabel('Name des Objekts').fill('Haus Seeblick')
    await panel(page).getByLabel('Straße und Hausnummer').fill('Seeweg 12')
    await panel(page).getByLabel('PLZ').fill('5340')
    await panel(page).getByLabel('Ort').fill('St. Gilgen')
    await chooseMunicipality(page, 'St. Gilgen · Salzburg')
    await panel(page).getByLabel('Name der Wohnung').fill('  Top 1  ')
    await panel(page).getByLabel('Personen (gesamt)').fill('4')
    await panel(page).getByLabel('Wohnungspreis pro Nacht (€)').fill('12,345')
    await submitPanel(page, 'Wohnung anlegen')
    await expect(panel(page).getByText('Bitte einen Betrag bis 10.000 € eingeben', { exact: false })).toBeVisible()
    await panel(page).getByLabel('Wohnungspreis pro Nacht (€)').fill('')
    await submitPanel(page, 'Wohnung anlegen')

    await expect(page.getByText('„Top 1“ angelegt.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Haus Seeblick', level: 2 })).toBeVisible()
    await expect(page.getByText('Gemeinde St. Gilgen · Salzburg')).toBeVisible()
    await expect(page.getByRole('row', { name: /Top 1.*Ferienwohnung.*4.*–.*15:00 \/ 10:00/ })).toBeVisible()
    const { data } = await service().from('apartments').select('name, kind, price_cents, check_in, check_out').eq('tenant_id', tenantId)
    expect(data).toEqual([{ name: 'Top 1', kind: 'holiday', price_cents: null, check_in: '15:00:00', check_out: '10:00:00' }])
  })

  test('AC: Weitere Wohnung im bestehenden Objekt; gleicher Name dort abgewiesen, in anderem Objekt erlaubt', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await ownerWithTenant(page, users)
    const seeblick = await addProperty(tenantId, 'Haus Seeblick')
    await addApartment(tenantId, seeblick, 'Top 1')
    await addProperty(tenantId, 'Haus Bergblick')
    await openApartments(page)

    await page.getByRole('button', { name: 'Wohnung in „Haus Seeblick“ hinzufügen' }).click()
    await expect(panel(page).getByRole('combobox', { name: 'Objekt' })).toHaveText(/Haus Seeblick/)
    await panel(page).getByLabel('Name der Wohnung').fill('top 1')
    await panel(page).getByLabel('Personen (gesamt)').fill('2')
    await submitPanel(page, 'Wohnung anlegen')
    await expect(panel(page).getByText('In diesem Objekt gibt es schon eine Wohnung mit diesem Namen.')).toBeVisible()
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Wohnung in „Haus Bergblick“ hinzufügen' }).click()
    await panel(page).getByLabel('Name der Wohnung').fill('Top 1')
    await panel(page).getByLabel('Personen (gesamt)').fill('2')
    await panel(page).getByRole('radio', { name: 'Dienstwohnung' }).click()
    await panel(page).getByLabel('Wohnungspreis pro Nacht (€)').fill('99,50')
    await submitPanel(page, 'Wohnung anlegen')
    await expect(page.getByText('„Top 1“ angelegt.')).toBeVisible()
    const bergblick = page.getByRole('region', { name: 'Haus Bergblick' })
    await expect(bergblick.getByRole('row', { name: /Top 1.*Dienstwohnung.*2.*€ 99,50/ })).toBeVisible()
  })
})

test.describe('Gemeinde wählen', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('AC: Suche findet „Sankt“ und Umlaute; PLZ mit mehreren Gemeinden setzt keine automatisch; Quellenangabe', async ({
    page,
    users,
  }) => {
    desktopOnly()
    await ownerWithTenant(page, users)
    await openApartments(page)
    await page.getByRole('button', { name: 'Wohnung anlegen' }).first().click()
    await panel(page).getByLabel('PLZ').fill('5360')
    await panel(page).getByRole('combobox', { name: /Gemeinde/ }).click()
    const byPostal = page.getByRole('group', { name: 'Gemeinden zur PLZ 5360' })
    await expect(byPostal.getByRole('option')).toHaveCount(3)
    await expect(byPostal.getByRole('option', { name: 'Strobl · Salzburg' })).toBeVisible()
    await expect(page.getByText('Datenquelle: Statistik Austria — data.statistik.gv.at')).toBeVisible()

    await page.getByPlaceholder('Gemeinde oder PLZ suchen').fill('sankt gilg')
    await expect(page.getByRole('group', { name: 'Suchergebnisse' }).getByRole('option', { name: 'St. Gilgen · Salzburg' })).toHaveCount(0)
    await expect(page.getByRole('option', { name: 'St. Gilgen · Salzburg' })).toBeVisible()
    await page.getByPlaceholder('Gemeinde oder PLZ suchen').fill('mönchhof')
    await expect(page.getByRole('option', { name: 'Mönchhof · Burgenland' })).toBeVisible()
    await page.getByPlaceholder('Gemeinde oder PLZ suchen').fill('xyzgibtsnicht')
    // BUG-1 (behoben): Hinweis auch dann, wenn PLZ-Vorschläge angezeigt werden
    await expect(page.getByText('Keine Gemeinde gefunden.')).toBeVisible()
    await expect(page.getByRole('group', { name: 'Gemeinden zur PLZ 5360' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(panel(page).getByRole('combobox', { name: /Gemeinde/ })).toHaveText(/Gemeinde wählen/)
  })
})

test.describe('Gemeinde und PLZ', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('BUG-2 (behoben): Hinweis, wenn PLZ und Gemeinde laut Gemeindeliste nicht zusammenpassen', async ({ page, users }) => {
    desktopOnly()
    await ownerWithTenant(page, users)
    await openApartments(page)
    await page.getByRole('button', { name: 'Wohnung anlegen' }).first().click()
    await panel(page).getByLabel('PLZ').fill('5340')
    await chooseMunicipality(page, 'Wien · Wien', 'wien')
    const hint = panel(page).getByText('Die PLZ 5340 gehört laut Gemeindeliste nicht zur Gemeinde Wien.', { exact: false })
    await expect(hint).toBeVisible()
    await chooseMunicipality(page, 'St. Gilgen · Salzburg')
    await expect(hint).toHaveCount(0)
  })
})

test.describe('Bearbeiten', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('AC: Wohnung ändern und verschieben; Verschieben auf gleichen Namen abgewiesen', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await ownerWithTenant(page, users)
    const seeblick = await addProperty(tenantId, 'Haus Seeblick')
    const bergblick = await addProperty(tenantId, 'Haus Bergblick')
    await addApartment(tenantId, seeblick, 'Top 1')
    await addApartment(tenantId, seeblick, 'Top 2')
    await addApartment(tenantId, bergblick, 'Top 2')
    await openApartments(page)

    await page.getByRole('region', { name: 'Haus Seeblick' }).getByRole('button', { name: 'Top 1 bearbeiten' }).click()
    await expect(panel(page).getByRole('heading', { name: 'Haus Seeblick · Top 1' })).toBeVisible()
    await panel(page).getByLabel('Personen (gesamt)').fill('6')
    await panel(page).getByLabel('Wohnungspreis pro Nacht (€)').fill('145,5')
    await panel(page).getByLabel('Notiz').fill('Schlüssel im Kasten')
    await submitPanel(page, 'Speichern')
    await expect(page.getByText('Änderungen gespeichert.')).toBeVisible()
    await expect(page.getByRole('row', { name: /Top 1.*Ferienwohnung.*6.*€ 145,50/ })).toBeVisible()

    await page.getByRole('region', { name: 'Haus Seeblick' }).getByRole('button', { name: 'Top 2 bearbeiten' }).click()
    await panel(page).getByRole('combobox', { name: 'Objekt' }).click()
    await page.getByRole('option', { name: 'Haus Bergblick' }).click()
    await submitPanel(page, 'Speichern')
    await expect(panel(page).getByText('In diesem Objekt gibt es schon eine Wohnung mit diesem Namen.')).toBeVisible()
    await panel(page).getByLabel('Name der Wohnung').fill('Top 3')
    await submitPanel(page, 'Speichern')
    await expect(page.getByText('Änderungen gespeichert.')).toBeVisible()
    await expect(page.getByRole('region', { name: 'Haus Bergblick' }).getByRole('button', { name: 'Top 3 bearbeiten' })).toBeVisible()
  })

  test('AC: Objekt ändern mit Hinweis auf betroffene Wohnungen; Löschen nur ohne Wohnungen; Protokoll', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await ownerWithTenant(page, users)
    const seeblick = await addProperty(tenantId, 'Haus Seeblick')
    await addApartment(tenantId, seeblick, 'Top 1')
    await addApartment(tenantId, seeblick, 'Top 2', { archived_at: new Date().toISOString() })
    const leer = await addProperty(tenantId, 'Haus Leer')
    await openApartments(page)

    await page.getByRole('button', { name: 'Objekt „Haus Seeblick“ bearbeiten' }).click()
    await expect(panel(page).getByText('Änderungen gelten für 2 Wohnungen.')).toBeVisible()
    await expect(panel(page).getByText('Ein Objekt lässt sich erst löschen', { exact: false })).toBeVisible()
    await expect(panel(page).getByRole('button', { name: 'Objekt löschen' })).toHaveCount(0)
    await panel(page).getByLabel('Straße und Hausnummer').fill('Uferweg 7')
    await chooseMunicipality(page, 'Strobl · Salzburg', 'strobl')
    await submitPanel(page, 'Speichern')
    await expect(page.getByText('Objekt gespeichert.')).toBeVisible()
    await expect(page.getByText('Uferweg 7, 5340 St. Gilgen')).toBeVisible()
    await expect(page.getByText('Gemeinde Strobl · Salzburg')).toBeVisible()
    const { data: log } = await service().from('audit_log').select('action').eq('table_name', 'properties').eq('record_id', seeblick)
    expect((log ?? []).map((l) => l.action)).toContain('update')

    await page.getByRole('button', { name: 'Objekt „Haus Leer“ bearbeiten' }).click()
    await panel(page).getByRole('button', { name: 'Objekt löschen' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Objekt löschen' }).click()
    await expect(page.getByText('Objekt „Haus Leer“ gelöscht.')).toBeVisible()
    expect((await service().from('properties').select('id').eq('id', leer)).data).toEqual([])
  })
})

test.describe('Archivieren, Wiederherstellen, Löschen', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('AC: Archivieren blendet aus, „Archivierte anzeigen“ zeigt gekennzeichnet, Wiederherstellen, Löschen', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await ownerWithTenant(page, users)
    const seeblick = await addProperty(tenantId, 'Haus Seeblick')
    await addApartment(tenantId, seeblick, 'Top 1')
    const top2 = await addApartment(tenantId, seeblick, 'Top 2')
    await openApartments(page)
    await expect(page.getByRole('switch', { name: 'Archivierte anzeigen' })).toHaveCount(0)

    await page.getByRole('button', { name: 'Top 1 bearbeiten' }).click()
    await panel(page).getByRole('button', { name: 'Archivieren' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Archivieren' }).click()
    await expect(page.getByText('„Top 1“ archiviert.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Top 1 bearbeiten' })).toHaveCount(0)

    await page.getByRole('switch', { name: 'Archivierte anzeigen' }).click()
    await expect(page.getByRole('row', { name: /Top 1.*archiviert/ })).toBeVisible()
    await page.getByRole('button', { name: 'Top 1 bearbeiten' }).click()
    await expect(panel(page).getByText('Diese Wohnung ist archiviert.', { exact: false })).toBeVisible()
    await panel(page).getByRole('button', { name: 'Wiederherstellen' }).click()
    await expect(page.getByText('„Top 1“ wiederhergestellt.')).toBeVisible()

    await page.getByRole('button', { name: 'Top 2 bearbeiten' }).click()
    await panel(page).getByRole('button', { name: 'Endgültig löschen' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Endgültig löschen' }).click()
    await expect(page.getByText('„Top 2“ gelöscht.')).toBeVisible()
    expect((await service().from('apartments').select('id').eq('id', top2)).data).toEqual([])
  })

  test('Edge: Letzte aktive Wohnung archiviert → Leerzustand mit Hinweis auf Archivierte', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await ownerWithTenant(page, users)
    await addApartment(tenantId, await addProperty(tenantId, 'Haus Seeblick'), 'Top 1', { archived_at: new Date().toISOString() })
    await openApartments(page)
    await expect(page.getByRole('heading', { name: 'Noch keine Wohnung' })).toBeVisible()
    await expect(page.getByText('Alle Wohnungen sind archiviert.', { exact: false })).toBeVisible()
  })
})

test.describe('Safari-Zeilenklick', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('Tabelle: nur der Name ist der Knopf (keine Klickfläche über die Zeile); jeder Name öffnet seine eigene Wohnung', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await ownerWithTenant(page, users)
    const seeblick = await addProperty(tenantId, 'Haus Seeblick')
    await addApartment(tenantId, seeblick, 'Top 1')
    await addApartment(tenantId, seeblick, 'Top 2')
    await openApartments(page)
    const first = page.getByRole('table').getByRole('button', { name: 'Top 1 bearbeiten' })
    // Safari verankert after:absolute nicht an <tr>: die Fläche darf es in der Tabelle nicht mehr geben
    expect(await first.evaluate((el) => getComputedStyle(el, '::after').position)).not.toBe('absolute')
    await first.click()
    await expect(panel(page).getByRole('heading', { name: 'Haus Seeblick · Top 1' })).toBeVisible()
  })
})

test.describe('Layout und Barrierefreiheit', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('Liste und Panel: keine automatisch erkennbaren WCAG-2.1-AA-Verstöße, kein seitliches Scrollen', async ({ page, users }) => {
    const { tenantId } = await ownerWithTenant(page, users)
    const seeblick = await addProperty(tenantId, 'Dienstwohnungen am Hafen mit langem Namen')
    await addApartment(tenantId, seeblick, 'Top 1', { price_cents: 12500 })
    await addApartment(tenantId, seeblick, 'Top 2', { kind: 'service' })
    await openApartments(page)

    const scan = async (label: string) => {
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      expect(results.violations, label).toEqual([])
    }
    await scan('Liste')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    if (test.info().project.name === 'mobile') await expect(page.getByRole('table')).toBeHidden()

    await page.getByRole('button', { name: 'Wohnung anlegen' }).first().click()
    await expect(panel(page).getByRole('heading', { name: 'Wohnung anlegen' })).toBeVisible()
    await scan('Panel')
  })
})
