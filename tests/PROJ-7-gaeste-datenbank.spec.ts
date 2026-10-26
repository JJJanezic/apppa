import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test as base } from '@playwright/test'

import { createTenant, createUser, deleteUser, type E2EUser, hasSupabaseEnv, service, signInAs } from './support/supabase'

// PROJ-7: Gäste-Datenbank. Abläufe nur im Projekt „desktop“, Layout und Barrierefreiheit in allen Breiten.
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

type Users = (opts?: Parameters<typeof createUser>[0]) => Promise<E2EUser>
const desktopOnly = () => test.skip(test.info().project.name !== 'desktop', 'Abläufe nur im Desktop-Projekt')
const ready = (page: Page) =>
  page.waitForFunction(() => Object.keys(document.querySelector('main') ?? {}).some((k) => k.startsWith('__reactFiber')))
const panel = (page: Page) => page.getByRole('dialog')

async function addGuest(tenantId: string, fields: Record<string, unknown>) {
  const { data, error } = await service()
    .from('guests')
    .insert({ tenant_id: tenantId, country: 'AT', ...fields } as never)
    .select('id')
    .single()
  if (error) throw error
  return (data as { id: string }).id
}

async function setup(page: Page, users: Users, role: 'owner' | 'staff' = 'owner') {
  const owner = await users({ displayName: 'Olga Owner' })
  const members: { user: E2EUser; role: 'owner' | 'staff' }[] = [{ user: owner, role: 'owner' }]
  let staff: E2EUser | undefined
  if (role === 'staff') {
    staff = await users({ displayName: 'Sam Staff' })
    members.push({ user: staff, role: 'staff' })
  }
  const tenantId = await createTenant('QA7 Testkunde', members)
  await signInAs(page, role === 'staff' ? staff! : owner)
  return { tenantId }
}

async function openList(page: Page, query = '') {
  await page.goto(`/gaeste${query}`)
  await ready(page)
}

async function chooseCountry(page: Page, label: string, country: string) {
  await panel(page).getByRole('combobox', { name: label }).click()
  await page.getByPlaceholder('Land suchen').fill(country)
  await page.getByRole('option', { name: country, exact: true }).click()
}

test.beforeEach(() => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')
})

test.describe('Zugang und Leerzustände', () => {
  test('AC: Inhaber sieht Leerzustand mit „Gast anlegen“', async ({ page, users }) => {
    desktopOnly()
    await setup(page, users)
    await openList(page)
    await expect(page.getByRole('heading', { name: 'Noch keine Gäste' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Gast anlegen' })).toHaveCount(1)
  })

  test('AC: Mitarbeiter sieht Hinweis statt „Gast anlegen“, keine Aktionen im Detail, keine Dubletten-Seite', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users, 'staff')
    await openList(page)
    await expect(page.getByText(/Gäste entstehen beim Anlegen von Buchungen/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Gast anlegen' })).toHaveCount(0)

    const id = await addGuest(tenantId, { last_name: 'Huber', first_name: 'Anna', email: 'anna@example.at' })
    await page.goto(`/gaeste/${id}`)
    await expect(page.getByRole('heading', { name: 'Anna Huber' })).toBeVisible()
    for (const name of ['Bearbeiten', 'Mit anderem Gast zusammenführen', 'Gast löschen']) {
      await expect(page.getByRole('button', { name })).toHaveCount(0)
    }
    const res = await page.goto('/gaeste/dubletten')
    expect(res?.status()).toBe(404)
  })

  test('AC: Gäste eines anderen Kunden sind auch per Adresse nicht erreichbar', async ({ page, users }) => {
    desktopOnly()
    await setup(page, users)
    const other = await users({ displayName: 'Fremd' })
    const otherTenant = await createTenant('QA7 Fremdkunde', [{ user: other, role: 'owner' }])
    const foreign = await addGuest(otherTenant, { last_name: 'Geheim' })
    const res = await page.goto(`/gaeste/${foreign}`)
    expect(res?.status()).toBe(404)
  })
})

test.describe('Liste, Suche und Filter', () => {
  test('AC: Liste alphabetisch; Suche ohne Akzente; Filter wirken zusammen; „Keine Gäste gefunden“ mit Zurücksetzen', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    await addGuest(tenantId, { last_name: 'Müller', first_name: 'René', marketing_source: 'instagram', company_name: 'Bau GmbH' })
    await addGuest(tenantId, { last_name: 'Bauer', first_name: 'Eva', country: 'DE', marketing_source: 'instagram' })
    await addGuest(tenantId, { last_name: 'Zeller', country: 'DE', marketing_custom: 'Messe Graz 2026' })

    await openList(page)
    await expect(page.getByRole('table').getByRole('link')).toHaveText(['Eva Bauer', 'René Müller', 'Zeller'])
    await expect(page.getByRole('table').getByText('Bau GmbH')).toBeVisible()

    await page.getByRole('searchbox', { name: 'Gäste durchsuchen' }).fill('rene muller')
    await expect(page).toHaveURL(/q=rene\+muller|q=rene%20muller/)
    await expect(page.getByRole('table').getByRole('link')).toHaveText(['René Müller'])

    await openList(page, '?land=DE&quelle=instagram')
    await expect(page.getByRole('table').getByRole('link')).toHaveText(['Eva Bauer'])
    await openList(page, '?quelle=custom')
    await expect(page.getByRole('table').getByRole('link')).toHaveText(['Zeller'])

    await openList(page, '?q=niemand')
    await expect(page.getByRole('heading', { name: 'Keine Gäste gefunden' })).toBeVisible()
    await page.getByRole('link', { name: 'Suche und Filter zurücksetzen' }).click()
    await expect(page.getByText('3 Gäste')).toBeVisible()
  })

  test('AC: mehr als 50 Gäste werden seitenweise zu je 50 angezeigt', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const rows = Array.from({ length: 51 }, (_, i) => ({ tenant_id: tenantId, country: 'AT', last_name: `Gast ${String(i).padStart(2, '0')}` }))
    const { error } = await service().from('guests').insert(rows as never)
    expect(error).toBeNull()
    await openList(page)
    await expect(page.getByText('51 Gäste')).toBeVisible()
    await expect(page.getByRole('table').getByRole('link')).toHaveCount(50)
    await expect(page.getByText('Seite 1 von 2')).toBeVisible()
    await page.getByRole('link', { name: 'Weiter' }).click()
    await expect(page.getByRole('table').getByRole('link')).toHaveCount(1)
  })
})

test.describe('Anlegen und Bearbeiten', () => {
  test('AC: Pflichtfelder und Prüfregeln; Anlegen nur mit Nachname und Land; eigene Quelle und Firma', async ({ page, users }) => {
    desktopOnly()
    await setup(page, users)
    await openList(page)
    await page.getByRole('button', { name: 'Gast anlegen' }).click()
    await panel(page).getByRole('button', { name: 'Gast anlegen' }).click()
    await expect(panel(page).getByText('Bitte den Nachnamen eingeben.')).toBeVisible()
    await expect(panel(page).getByText('Bitte das Herkunftsland wählen.')).toBeVisible()

    await panel(page).getByLabel('Nachname').fill('Schmidt')
    await panel(page).getByLabel('Vorname').fill('Jonas')
    await chooseCountry(page, 'Herkunftsland', 'Deutschland')
    await panel(page).getByLabel('E-Mail').fill('keine-adresse')
    await panel(page).getByLabel('Geburtsdatum').fill('2999-01-01')
    await panel(page).getByRole('button', { name: 'Gast anlegen' }).click()
    await expect(panel(page).getByText('Bitte eine gültige E-Mail-Adresse eingeben.')).toBeVisible()
    await expect(panel(page).getByText('Das Geburtsdatum darf nicht in der Zukunft liegen.')).toBeVisible()

    await panel(page).getByLabel('E-Mail').fill('jonas@example.de')
    await panel(page).getByLabel('Geburtsdatum').fill('')
    await panel(page).getByRole('combobox', { name: 'Marketing-Quelle' }).click()
    await page.getByRole('option', { name: 'Eigene Angabe' }).click()
    await panel(page).getByLabel('Eigene Angabe').fill('Messe Graz 2026')
    await panel(page).getByRole('button', { name: /Firma/ }).click()
    await panel(page).getByLabel('Firmenname').fill('Montagebau Schmidt GmbH')
    await panel(page).getByLabel('UID-Nummer').fill('DE123456789')
    await panel(page).getByRole('button', { name: 'Gast anlegen' }).click()

    await expect(page.getByRole('heading', { name: 'Jonas Schmidt' })).toBeVisible()
    await expect(page.getByText('Messe Graz 2026')).toBeVisible()
    await expect(page.getByText('DE123456789')).toBeVisible()
    await openList(page)
    await expect(page.getByRole('table').getByText('Montagebau Schmidt GmbH')).toBeVisible()
  })

  test('AC: Warnung vor Doppeleintrag mit „Bestehenden Gast öffnen“ und „Trotzdem anlegen“', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const existing = await addGuest(tenantId, { last_name: 'Huber', first_name: 'Anna', email: 'anna@example.at' })
    await openList(page)
    await page.getByRole('button', { name: 'Gast anlegen' }).click()
    await panel(page).getByLabel('Nachname').fill('Neu')
    await chooseCountry(page, 'Herkunftsland', 'Österreich')
    await panel(page).getByLabel('E-Mail').fill('ANNA@example.at')
    await panel(page).getByRole('button', { name: 'Gast anlegen' }).click()
    await expect(panel(page).getByText('Möglicher Doppeleintrag')).toBeVisible()
    await expect(panel(page).getByText(/gleiche E-Mail/)).toBeVisible()
    await expect(panel(page).getByRole('link', { name: 'Bestehenden Gast öffnen' })).toHaveAttribute('href', `/gaeste/${existing}`)
    await panel(page).getByRole('button', { name: 'Trotzdem anlegen' }).click()
    await expect(page.getByRole('heading', { name: 'Neu', exact: true })).toBeVisible()
  })

  test('AC: Bearbeiten speichert; bei fremder Änderung Hinweis mit „Aktuelle Fassung laden“, Eingaben bleiben', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const id = await addGuest(tenantId, { last_name: 'Berger', first_name: 'Eva' })
    await page.goto(`/gaeste/${id}`)
    await ready(page)
    await page.getByRole('button', { name: 'Bearbeiten' }).click()
    await panel(page).getByLabel('Telefon').fill('+43 664 1234567')
    await panel(page).getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Änderungen gespeichert')).toBeVisible()
    await expect(page.getByRole('link', { name: '+43 664 1234567' })).toBeVisible()

    await page.getByRole('button', { name: 'Bearbeiten' }).click()
    await panel(page).getByLabel('Notiz').fill('meine Eingabe')
    // Inzwischen ändert jemand anderer den Gast
    await service().from('guests').update({ note: 'fremde Änderung' } as never).eq('id', id)
    await panel(page).getByRole('button', { name: 'Speichern' }).click()
    await expect(panel(page).getByText(/inzwischen von jemand anderem geändert/)).toBeVisible()
    await expect(panel(page).getByLabel('Notiz')).toHaveValue('meine Eingabe')
    await panel(page).getByRole('button', { name: 'Aktuelle Fassung laden' }).click()
    await expect(panel(page).getByLabel('Notiz')).toHaveValue('fremde Änderung')
  })
})

test.describe('Dubletten', () => {
  test('AC: Vorschläge mit Grund; „Kein Doppeleintrag“ blendet aus', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    await addGuest(tenantId, { last_name: 'Gleich', first_name: 'Max' })
    await addGuest(tenantId, { last_name: 'Gleich', first_name: 'Max', country: 'DE' })
    await openList(page)
    await page.getByRole('link', { name: '1 mögliche Dublette' }).click()
    await expect(page.getByText('Grund: gleicher Name')).toBeVisible()
    await page.getByRole('button', { name: 'Kein Doppeleintrag' }).click()
    await expect(page.getByRole('heading', { name: 'Keine möglichen Dubletten' })).toBeVisible()
  })

  test('AC: Zusammenführen mit Feldwahl und Bestätigung; der zweite Gast ist danach weg', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const keep = await addGuest(tenantId, { last_name: 'Huber', first_name: 'Anna', email: 'a.relay@guest.booking.com', email_source: 'platform' })
    const remove = await addGuest(tenantId, { last_name: 'Huber', first_name: 'Anna', email: 'anna@example.at', note: 'Stammgast' })
    await page.goto(`/gaeste/${keep}`)
    await ready(page)
    await page.getByRole('button', { name: 'Mit anderem Gast zusammenführen' }).click()
    await panel(page).getByRole('combobox').fill('huber')
    await page.getByRole('option', { name: /Anna Huber/ }).click()
    await expect(panel(page).getByText('(von Plattform übernommen)')).toBeVisible()
    await panel(page).getByLabel(/anna@example\.at/).check()
    await panel(page).getByLabel(/Stammgast/).check()
    await expect(panel(page).getByText(/lässt sich nicht rückgängig machen/)).toBeVisible()
    await panel(page).getByRole('button', { name: 'Zusammenführen' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Zusammenführen' }).click()
    await expect(page.getByText('Gäste zusammengeführt')).toBeVisible()
    await expect(page.getByRole('link', { name: 'anna@example.at' })).toBeVisible()
    await expect(page.getByText('Stammgast')).toBeVisible()
    const res = await page.goto(`/gaeste/${remove}`)
    expect(res?.status()).toBe(404)
  })
})

test.describe('Löschen und Anonymisieren', () => {
  test('AC: Gast ohne Aufenthalte wird nach Bestätigung endgültig gelöscht', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const id = await addGuest(tenantId, { last_name: 'Weg', first_name: 'Willi' })
    await page.goto(`/gaeste/${id}`)
    await ready(page)
    await page.getByRole('button', { name: 'Gast löschen' }).click()
    await expect(page.getByRole('alertdialog').getByText(/keine Aufenthalte und wird endgültig gelöscht/)).toBeVisible()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Endgültig löschen' }).click()
    await expect(page.getByRole('heading', { name: 'Noch keine Gäste' })).toBeVisible()
    // BUG-1: Bestätigung sichtbar, Zusatz danach aus der Adresse entfernt
    await expect(page.getByText('Gast gelöscht')).toBeVisible()
    await expect(page).toHaveURL('/gaeste')
  })

  test('AC: anonymisierter Gast zeigt Hinweis, Herkunftsland und keine Aktionen', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const id = await addGuest(tenantId, { last_name: 'Anonym', first_name: 'Anja', country: 'NL', email: 'anja@example.nl' })
    const { error } = await service().rpc('anonymize_guest' as never, { p_guest_id: id } as never)
    expect(error).toBeNull()
    await page.goto(`/gaeste/${id}`)
    await ready(page)
    await expect(page.getByRole('heading', { name: 'Gelöschter Gast' })).toBeVisible()
    await expect(page.getByText(/wurde am .* anonymisiert/)).toBeVisible()
    await expect(page.getByText('anja@example.nl')).toHaveCount(0)
    await expect(page.getByText('Niederlande').first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Bearbeiten' })).toHaveCount(0)
    await openList(page)
    await expect(page.getByRole('table').getByText('anonymisiert')).toBeVisible()
  })
})

test.describe('Layout und Barrierefreiheit', () => {
  test('Liste, Detail und Panel: keine automatisch erkennbaren WCAG-2.1-AA-Verstöße, kein seitliches Scrollen', async ({ page, users }) => {
    const { tenantId } = await setup(page, users)
    const id = await addGuest(tenantId, { last_name: 'Huber', first_name: 'Anna', email: 'anna@example.at', company_name: 'Bau GmbH', note: 'Notiz' })
    const scan = async (label: string) => {
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      expect(results.violations, label).toEqual([])
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, label).toBeLessThanOrEqual(0)
    }
    await openList(page)
    await scan('Liste')
    if (test.info().project.name === 'mobile') await expect(page.getByRole('table')).toBeHidden()
    await page.goto(`/gaeste/${id}`)
    await ready(page)
    await scan('Detail')
    await page.getByRole('button', { name: 'Bearbeiten' }).click()
    await expect(panel(page)).toBeVisible()
    await scan('Panel')
  })
})
