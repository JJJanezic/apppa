import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test as base } from '@playwright/test'

import { createTenant, createUser, deleteUser, type E2EUser, hasSupabaseEnv, service, signInAs } from './support/supabase'

// PROJ-50: Firmenliste. Abläufe nur im Projekt „desktop“; Darstellung und Barrierefreiheit in allen Breiten.
// Ersetzt die Formular-Tests aus PROJ-33 (Firmenanschrift) und PROJ-49 (Vorschläge).

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
const panel = (page: Page) => page.getByRole('dialog').last()
const billing = (page: Page) => panel(page).getByRole('group', { name: 'Rechnungsadresse' })
const picker = (page: Page) => panel(page).getByRole('combobox', { name: 'Firma suchen (Name oder UID)' })

type CompanySeed = { name: string } & Partial<Record<'vat_id' | 'address_line1' | 'address_line2' | 'postal_code' | 'city' | 'country' | 'email' | 'website' | 'contact', string>>

async function addCompany(tenantId: string, c: CompanySeed) {
  const { data, error } = await service().from('companies').insert({ tenant_id: tenantId, ...c }).select('id').single()
  if (error) throw error
  return data.id
}

async function addGuest(tenantId: string, lastName: string, companyId: string | null = null, extra: Record<string, unknown> = {}) {
  const { data, error } = await service()
    .from('guests')
    .insert({ tenant_id: tenantId, country: 'AT', last_name: lastName, company_id: companyId, ...extra } as never)
    .select('id')
    .single()
  if (error) throw error
  return (data as { id: string }).id
}

async function addApartment(tenantId: string) {
  const { data: property, error } = await service()
    .from('properties')
    .insert({ tenant_id: tenantId, name: 'Haus See', street: 'Seeweg 12', postal_code: '5340', city: 'St. Gilgen', municipality_code: '50330' })
    .select('id')
    .single()
  if (error) throw error
  const { data, error: e } = await service()
    .from('apartments')
    .insert({ tenant_id: tenantId, property_id: property.id, name: 'Top 1', max_guests: 4, price_cents: 10000 } as never)
    .select('id')
    .single()
  if (e) throw e
  return { propertyId: property.id, apartmentId: (data as { id: string }).id }
}

async function setup(page: Page, users: Users, opts: { staff?: boolean } = {}) {
  const owner = await users({ displayName: 'Olga Owner' })
  const staff = opts.staff ? await users({ displayName: 'Stefan Staff' }) : null
  const tenantId = await createTenant('QA50 Testkunde', [{ user: owner, role: 'owner' }, ...(staff ? [{ user: staff, role: 'staff' as const }] : [])])
  await signInAs(page, staff ?? owner)
  return { tenantId, owner, staff }
}

async function go(page: Page, path: string) {
  await page.goto(path)
  await ready(page)
}

// Firmenliste bzw. -detail über den Reiter öffnen (Navigation im Browser)
async function openCompanies(page: Page) {
  await go(page, '/gaeste')
  await page.getByRole('navigation', { name: 'Gäste und Firmen' }).getByRole('link', { name: 'Firmen' }).click()
  await expect(page).toHaveURL(/\/gaeste\/firmen/)
  await expect(page.getByRole('heading', { name: 'Gäste', level: 1 })).toBeVisible()
}
async function openCompany(page: Page, name: string) {
  await openCompanies(page)
  await page.getByRole('link', { name, exact: true }).first().click()
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible()
}

async function fillRequired(page: Page, lastName: string) {
  await panel(page).getByLabel('Nachname').fill(lastName)
  await panel(page).getByRole('combobox', { name: 'Herkunftsland' }).click()
  await page.getByPlaceholder('Land suchen').fill('Österreich')
  await page.getByRole('option', { name: 'Österreich', exact: true }).click()
}

async function openCompanySection(page: Page) {
  const trigger = panel(page).getByRole('button', { name: /^Firma/ })
  if ((await trigger.getAttribute('aria-expanded')) !== 'true') await trigger.click()
}

const guestCompany = async (lastName: string, tenantId: string) =>
  (await service().from('guests').select('company_id').eq('tenant_id', tenantId).eq('last_name', lastName).single()).data?.company_id ?? null

test.beforeEach(() => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')
})

test.describe('Reiter und Liste', () => {
  test('AC: Reiter „Gäste“/„Firmen“; Liste mit Name, UID, PLZ Ort, Staat, Gäste (auch 0), „Name fehlt“; Suche nach Umlaut und UID', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const mueller = await addCompany(tenantId, { name: 'Hotel Müller KG', vat_id: 'ATU12345678', postal_code: '1010', city: 'Wien', country: 'AT' })
    await addGuest(tenantId, 'Kunz', mueller)
    await addCompany(tenantId, { name: 'Alpen AG' })
    const missing = await addCompany(tenantId, { name: 'Firma ohne Namen', vat_id: 'DE999' })
    await service().from('companies').update({ name_missing: true }).eq('id', missing)

    await go(page, '/gaeste')
    await page.getByRole('navigation', { name: 'Gäste und Firmen' }).getByRole('link', { name: 'Firmen' }).click()
    await expect(page).toHaveURL(/\/gaeste\/firmen$/)
    await expect(page.getByRole('link', { name: 'Firmen' })).toHaveAttribute('aria-current', 'page')
    const table = page.getByRole('table')
    await expect(table.getByRole('columnheader')).toHaveText(['Firmenname', 'UID', 'PLZ Ort', 'Staat', 'Gäste'])
    await expect(table.getByRole('row').nth(1)).toContainText('Alpen AG')
    const row = table.getByRole('row').filter({ hasText: 'Hotel Müller KG' })
    await expect(row).toContainText('ATU12345678')
    await expect(row).toContainText('1010 Wien')
    await expect(row).toContainText('Österreich')
    await expect(row.getByRole('cell').last()).toHaveText('1')
    await expect(table.getByRole('row').filter({ hasText: 'Alpen AG' }).getByRole('cell').last()).toHaveText('0')
    await expect(table.getByRole('row').filter({ hasText: 'Firma ohne Namen' })).toContainText('Name fehlt')
    await expect(page.getByText('3 Firmen')).toBeVisible()

    await page.getByLabel('Firmen durchsuchen').fill('muller')
    await expect(page).toHaveURL(/q=muller/)
    await expect(table.getByRole('row')).toHaveCount(2)
    await page.getByLabel('Firmen durchsuchen').fill('ATU123')
    await expect(page).toHaveURL(/q=ATU123/)
    await expect(table.getByRole('row').filter({ hasText: 'Hotel Müller KG' })).toBeVisible()
    await page.getByLabel('Firmen durchsuchen').fill('gibtsnicht')
    await expect(page.getByText('Keine Firmen gefunden')).toBeVisible()
  })

  test('AC: Leerer Zustand für Inhaber mit „Firma anlegen“; Mitarbeiter ohne Knöpfe; fremde Firma „Seite nicht gefunden“', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users, { staff: true })
    await openCompanies(page)
    await expect(page.getByText('Noch keine Firmen')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Firma anlegen' })).toHaveCount(0)

    await addCompany(tenantId, { name: 'Sicht GmbH' })
    await openCompany(page, 'Sicht GmbH')
    for (const name of ['Bearbeiten', 'Mit anderer Firma zusammenführen', 'Firma löschen']) await expect(page.getByRole('button', { name })).toHaveCount(0)
    await expect(page.getByRole('link', { name: /mögliche doppelte/ })).toHaveCount(0)
  })
})

test.describe('Direkter Aufruf', () => {
  test('BUG-1: Liste, Detail und Dubletten lassen sich direkt aufrufen und neu laden; fremde Firma „Seite nicht gefunden“', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const c = await addCompany(tenantId, { name: 'Direkt GmbH' })
    await go(page, '/gaeste/firmen')
    await expect(page.getByRole('link', { name: 'Direkt GmbH' })).toBeVisible()
    await go(page, `/gaeste/firmen/${c}`)
    await expect(page.getByRole('heading', { name: 'Direkt GmbH', level: 1 })).toBeVisible()
    await go(page, '/gaeste/firmen/dubletten')
    await expect(page.getByRole('heading', { name: 'Mögliche doppelte Firmen' })).toBeVisible()

    const otherOwner = await users()
    const other = await createTenant('QA50 Fremd', [{ user: otherOwner, role: 'owner' }])
    const foreign = await addCompany(other, { name: 'Fremd GmbH' })
    await go(page, `/gaeste/firmen/${foreign}`)
    await expect(page.getByText('Seite nicht gefunden')).toBeVisible()
  })
})

test.describe('Firma anlegen, bearbeiten, Detail', () => {
  test('AC: Anlegen mit Pflichtname, E-Mail- und Webadress-Prüfung, PLZ-Automatik; Detail mit Links', async ({ page, users }) => {
    desktopOnly()
    await setup(page, users)
    await openCompanies(page)
    await page.getByRole('button', { name: 'Firma anlegen' }).first().click()
    await panel(page).getByLabel('E-Mail').fill('info@firma')
    await panel(page).getByLabel('Webadresse').fill('firma')
    await panel(page).getByRole('button', { name: 'Firma anlegen' }).click()
    await expect(panel(page).getByText('Bitte den Firmennamen eingeben.')).toBeVisible()
    await expect(panel(page).getByText('Bitte eine gültige E-Mail-Adresse eingeben.')).toBeVisible()
    await expect(panel(page).getByText('Bitte eine gültige Webadresse eingeben, z. B. www.firma.at.')).toBeVisible()

    await panel(page).getByLabel('Firmenname').fill('Neubau GmbH')
    await panel(page).getByLabel('E-Mail').fill('Office@Neubau.at')
    await panel(page).getByLabel('Webadresse').fill('www.neubau.at')
    await panel(page).getByLabel('Ansprechpartner').fill('Frau Maier, Einkauf')
    await billing(page).getByLabel('PLZ').fill('1010')
    await expect(billing(page).getByLabel('Ort', { exact: true })).toHaveValue('Wien')
    await expect(billing(page).getByRole('combobox', { name: 'Staat' })).toHaveText('Österreich')
    await panel(page).getByRole('button', { name: 'Firma anlegen' }).click()

    await expect(page.getByRole('heading', { name: 'Neubau GmbH' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'office@neubau.at' })).toHaveAttribute('href', 'mailto:office@neubau.at')
    await expect(page.getByRole('link', { name: 'www.neubau.at' })).toHaveAttribute('href', 'https://www.neubau.at')
    await expect(page.getByText('Frau Maier, Einkauf')).toBeVisible()
    await expect(page.getByText('1010 Wien', { exact: true })).toBeVisible()
    await expect(page.getByText('Mit dieser Firma ist kein Gast verknüpft.')).toBeVisible()
    await expect(page.getByText('Keine Buchungen.')).toBeVisible()
    await expect(page.getByText('Keine Rechnungen an diese Firma.')).toBeVisible()
  })

  test('AC: Änderung gilt für alle verknüpften Gäste; veralteter Stand zeigt Hinweis statt zu überschreiben', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const c = await addCompany(tenantId, { name: 'Umzug GmbH', city: 'Graz' })
    const g1 = await addGuest(tenantId, 'Eins', c)
    await addGuest(tenantId, 'Zwei', c)
    await openCompany(page, 'Umzug GmbH')
    await expect(page.getByRole('heading', { name: 'Gäste (2)' })).toBeVisible()
    await page.getByRole('button', { name: 'Bearbeiten' }).click()
    await expect(panel(page).getByText('Die Änderung gilt für alle 2 verknüpften Gäste.', { exact: false })).toBeVisible()
    // Inzwischen ändert jemand anderer die Firma
    await service().from('companies').update({ contact: 'Jemand' }).eq('id', c)
    await billing(page).getByLabel('Ort', { exact: true }).fill('Linz')
    await panel(page).getByRole('button', { name: 'Speichern', exact: true }).click()
    await expect(panel(page).getByText('Diese Firma wurde inzwischen geändert.', { exact: false })).toBeVisible()
    expect((await service().from('companies').select('city').eq('id', c).single()).data?.city).toBe('Graz')

    await panel(page).getByRole('button', { name: 'Aktuelle Fassung laden' }).click()
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Bearbeiten' }).click()
    await billing(page).getByLabel('Ort', { exact: true }).fill('Linz')
    await panel(page).getByRole('button', { name: 'Speichern', exact: true }).click()
    await expect(page.getByText('Firma gespeichert.')).toBeVisible()
    await go(page, `/gaeste/${g1}`)
    const section = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Firma', exact: true }) })
    await expect(section.getByText('Linz', { exact: true })).toBeVisible()
    await section.getByRole('link', { name: 'Umzug GmbH' }).click()
    await expect(page).toHaveURL(new RegExp(`/gaeste/firmen/${c}$`))
  })

  test('AC: Detail zeigt Buchungen der Gäste und nur Rechnungen mit Empfänger „Firma“', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const c = await addCompany(tenantId, { name: 'Dienst AG' })
    const g = await addGuest(tenantId, 'Monteur', c)
    const { apartmentId } = await addApartment(tenantId)
    const { data: booking, error } = await service()
      .from('bookings')
      .insert({
        tenant_id: tenantId, apartment_id: apartmentId, guest_id: g, kind: 'booking', arrival: '2026-09-01', planned_departure: '2026-09-05',
        departure: '2026-09-05', check_in: '15:00', check_out: '10:00', adults: 1, child_ages: [], number_year: 2026, number_seq: 950,
      } as never)
      .select('id, number')
      .single()
    if (error) throw error
    const bookingNumber = (booking as { number: string }).number
    const invoice = (recipient: string, kind: 'company' | 'guest', number: string) => ({
      tenant_id: tenantId, booking_id: (booking as { id: string }).id, guest_id: g, origin: 'backfilled', number, invoice_date: '2026-09-05',
      recipient, recipient_kind: kind, total_cents: 40000, small_business: false,
    })
    const ins = await service().from('invoices').insert([invoice('Dienst AG', 'company', 'QA50-1'), invoice('Monteur', 'guest', 'QA50-2')] as never)
    if (ins.error) throw ins.error

    await openCompany(page, 'Dienst AG')
    const bookings = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Buchungen' }) })
    await expect(bookings.getByText(bookingNumber).first()).toBeVisible()
    const invoices = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Rechnungen' }) })
    await expect(invoices.getByRole('link', { name: 'QA50-1' })).toBeVisible()
    await expect(invoices.getByText('QA50-2')).toHaveCount(0)
  })
})

test.describe('Gastformular', () => {
  test('AC: Neuer Gast startet mit „Keine Firma“; „Bestehende Firma“ sucht nach Name/UID, Karte nur lesen; Speichern verknüpft', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const c = await addCompany(tenantId, { name: 'Muster GmbH', vat_id: 'ATU12345678', postal_code: '1010', city: 'Wien', address_line1: 'Hauptstraße 1' })
    await go(page, '/gaeste')
    await page.getByRole('button', { name: 'Gast anlegen' }).click()
    await fillRequired(page, 'Kollege')
    await openCompanySection(page)
    await expect(panel(page).getByRole('radio', { name: 'Keine Firma' })).toBeChecked()

    await panel(page).getByRole('radio', { name: 'Bestehende Firma' }).click()
    // ohne Auswahl nicht speicherbar
    await panel(page).getByRole('button', { name: 'Gast anlegen' }).click()
    await expect(panel(page).getByText('Bitte eine Firma suchen und wählen', { exact: false })).toBeVisible()

    await picker(page).fill('atu123')
    const option = panel(page).getByRole('option', { name: /Muster GmbH/ })
    await expect(option).toContainText('ATU12345678 · 1010 Wien · Hauptstraße 1')
    await option.click()
    await expect(panel(page).getByText('Änderungen an der Firma im Reiter „Firmen“')).toBeVisible()
    await expect(panel(page).getByLabel('Firmenname')).toHaveCount(0)
    await panel(page).getByRole('button', { name: 'Gast anlegen' }).click()
    await expect(page.getByRole('heading', { name: 'Kollege', exact: true })).toBeVisible()
    expect(await guestCompany('Kollege', tenantId)).toBe(c)
  })

  test('AC: Gast mit Firma öffnet mit Karte; „Ändern“ ohne Auswahl behält die Firma; andere Firma wählen; „Keine Firma“ löst', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const a = await addCompany(tenantId, { name: 'Erste GmbH' })
    const b = await addCompany(tenantId, { name: 'Zweite GmbH' })
    const id = await addGuest(tenantId, 'Wechsel', a)
    await go(page, `/gaeste/${id}`)
    await page.getByRole('button', { name: 'Bearbeiten' }).click()
    await expect(panel(page).getByRole('radio', { name: 'Bestehende Firma' })).toBeChecked()
    await expect(panel(page).getByText('Erste GmbH').first()).toBeVisible()

    await panel(page).getByRole('button', { name: 'Ändern' }).click()
    await expect(picker(page)).toBeVisible()
    await panel(page).getByRole('button', { name: 'Speichern', exact: true }).click()
    await expect(panel(page)).toHaveCount(0)
    expect(await guestCompany('Wechsel', tenantId)).toBe(a)

    await page.getByRole('button', { name: 'Bearbeiten' }).click()
    await panel(page).getByRole('button', { name: 'Ändern' }).click()
    await picker(page).fill('zweite')
    await panel(page).getByRole('option', { name: /Zweite GmbH/ }).click()
    await panel(page).getByRole('button', { name: 'Speichern', exact: true }).click()
    await expect(panel(page)).toHaveCount(0)
    expect(await guestCompany('Wechsel', tenantId)).toBe(b)

    await page.getByRole('button', { name: 'Bearbeiten' }).click()
    await panel(page).getByRole('radio', { name: 'Keine Firma' }).click()
    await panel(page).getByRole('button', { name: 'Speichern', exact: true }).click()
    await expect(panel(page)).toHaveCount(0)
    expect(await guestCompany('Wechsel', tenantId)).toBeNull()
    expect((await service().from('companies').select('id').eq('id', b)).data).toHaveLength(1)
  })

  test('AC: „Neue Firma“ mit leeren Feldern; gleicher Name zeigt Hinweis; „Bestehende Firma verwenden“ wechselt zur Karte', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const existing = await addCompany(tenantId, { name: 'Muster GmbH', city: 'Wien' })
    await go(page, '/gaeste')
    await page.getByRole('button', { name: 'Gast anlegen' }).click()
    await fillRequired(page, 'Doppelt')
    await openCompanySection(page)
    await panel(page).getByRole('radio', { name: 'Neue Firma' }).click()
    // „E-Mail“ gibt es auch beim Gast: die Firmenfelder stehen danach
    for (const label of ['Firmenname', 'UID-Nummer', 'E-Mail', 'Webadresse', 'Ansprechpartner']) await expect(panel(page).getByLabel(label, { exact: true }).last()).toHaveValue('')
    await expect(billing(page).getByLabel('Adresszeile 1')).toHaveValue('')

    await panel(page).getByRole('button', { name: 'Gast anlegen' }).click()
    await expect(panel(page).getByText('Bitte den Firmennamen eingeben.')).toBeVisible()

    await panel(page).getByLabel('Firmenname').fill(' muster gmbh ')
    await expect(panel(page).getByText('Diese Firma gibt es bereits.')).toBeVisible()
    await panel(page).getByRole('button', { name: 'Bestehende Firma verwenden' }).click()
    await expect(panel(page).getByRole('radio', { name: 'Bestehende Firma' })).toBeChecked()
    await expect(panel(page).getByText('Wien').first()).toBeVisible()
    await panel(page).getByRole('button', { name: 'Gast anlegen' }).click()
    await expect(page.getByRole('heading', { name: 'Doppelt', exact: true })).toBeVisible()
    expect(await guestCompany('Doppelt', tenantId)).toBe(existing)
  })

  test('AC: „Neue Firma“ trotz gleichem Namen speichert zweite Firma; Paar erscheint unter „mögliche doppelte Firmen“', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    await addCompany(tenantId, { name: 'Muster GmbH', city: 'Wien' })
    await go(page, '/gaeste')
    await page.getByRole('button', { name: 'Gast anlegen' }).click()
    await fillRequired(page, 'Zweitfirma')
    await openCompanySection(page)
    await panel(page).getByRole('radio', { name: 'Neue Firma' }).click()
    await panel(page).getByLabel('Firmenname').fill('muster gmbh')
    await expect(panel(page).getByText('Diese Firma gibt es bereits.')).toBeVisible()
    await panel(page).getByRole('button', { name: 'Gast anlegen' }).click()
    await expect(page.getByRole('heading', { name: 'Zweitfirma', exact: true })).toBeVisible()
    expect((await service().from('companies').select('id').eq('tenant_id', tenantId)).data).toHaveLength(2)

    await openCompanies(page)
    await page.getByRole('link', { name: '1 mögliche doppelte Firma' }).click()
    await expect(page.getByText('Gleich: Firmenname')).toBeVisible()
    await page.getByRole('button', { name: 'Keine doppelte Firma' }).click()
    await expect(page.getByText('Keine möglichen doppelten Firmen')).toBeVisible()
  })

  test('AC: Mitarbeiter legt im Buchungsformular neuen Gast mit neuer Firma an', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users, { staff: true })
    await addApartment(tenantId)
    await addCompany(tenantId, { name: 'Bestand AG' })
    await go(page, '/buchungen')
    await page.getByRole('button', { name: 'Neue Buchung' }).first().click()
    await panel(page).getByRole('radio', { name: 'Neuer Gast' }).click()
    await openCompanySection(page)
    await panel(page).getByRole('radio', { name: 'Bestehende Firma' }).click()
    await picker(page).fill('bestand')
    await expect(panel(page).getByRole('option', { name: /Bestand AG/ })).toBeVisible()
    await panel(page).getByRole('radio', { name: 'Neue Firma' }).click()
    await panel(page).getByLabel('Firmenname').fill('Montage KG')
    await expect(panel(page).getByLabel('Firmenname')).toHaveValue('Montage KG')
  })

  test('AC: Neuer Gast beim Nacherfassen einer Rechnung hat dieselbe Auswahl; Firma wird Empfänger-Vorschlag', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    await addCompany(tenantId, { name: 'Nacherfasst GmbH' })
    await go(page, '/rechnungen')
    await page.getByRole('button', { name: 'Rechnung nacherfassen' }).first().click()
    await panel(page).getByText('Neuer Gast', { exact: true }).click()
    await fillRequired(page, 'Rechnungsgast')
    await openCompanySection(page)
    await panel(page).getByRole('radio', { name: 'Bestehende Firma' }).click()
    await picker(page).fill('nacherf')
    await panel(page).getByRole('option', { name: /Nacherfasst GmbH/ }).click()
    await expect(panel(page).getByLabel('Empfänger')).toHaveValue('Nacherfasst GmbH')
  })
})

test.describe('Löschen und Zusammenführen', () => {
  test('AC: Löschen nennt die Zahl der Gäste; danach haben sie keine Firma mehr', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const c = await addCompany(tenantId, { name: 'Weg GmbH' })
    const ids = [await addGuest(tenantId, 'A1', c), await addGuest(tenantId, 'A2', c), await addGuest(tenantId, 'A3', c)]
    await openCompany(page, 'Weg GmbH')
    await page.getByRole('button', { name: 'Firma löschen' }).click()
    await expect(page.getByRole('alertdialog')).toContainText('3 Gäste sind mit dieser Firma verknüpft')
    await page.getByRole('alertdialog').getByRole('button', { name: 'Firma löschen' }).click()
    await expect(page).toHaveURL(/\/gaeste\/firmen$/)
    await expect(page.getByText('Firma gelöscht.')).toBeVisible()
    const { data } = await service().from('guests').select('company_id').in('id', ids)
    expect(data?.every((g) => g.company_id === null)).toBe(true)
  })

  test('AC: Zusammenführen mit Feldwahl, Rechnungsadresse als Ganzes; Gäste hängen danach an der verbleibenden Firma', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const keep = await addCompany(tenantId, { name: 'Muster GmbH', vat_id: 'ATU12345678', city: 'Graz', address_line1: 'Alt 1' })
    const remove = await addCompany(tenantId, { name: 'muster gmbh', city: 'Wien', postal_code: '1010', address_line1: 'Neu 2' })
    const g = await addGuest(tenantId, 'Zugang', remove)
    await openCompany(page, 'Muster GmbH')
    await page.getByRole('button', { name: 'Mit anderer Firma zusammenführen' }).click()
    await picker(page).or(panel(page).getByRole('combobox')).first().fill('muster')
    await panel(page).getByRole('option', { name: /muster gmbh/ }).click()
    await expect(panel(page).getByText('Die Rechnungsadresse wird als Ganzes übernommen.')).toBeVisible()
    await panel(page).getByLabel(/Neu 2, 1010 Wien/).check()
    await panel(page).getByRole('button', { name: 'Zusammenführen' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Zusammenführen' }).click()
    await expect(page.getByText('Firmen zusammengeführt.')).toBeVisible()
    const kept = (await service().from('companies').select('name, vat_id, city, address_line1').eq('id', keep).single()).data
    expect(kept).toEqual({ name: 'Muster GmbH', vat_id: 'ATU12345678', city: 'Wien', address_line1: 'Neu 2' })
    expect((await service().from('guests').select('company_id').eq('id', g).single()).data?.company_id).toBe(keep)
    expect((await service().from('companies').select('id').eq('id', remove)).data).toHaveLength(0)
  })
})

test.describe('Darstellung und Barrierefreiheit', () => {
  test('Liste, Detail und Formular: keine WCAG-2.1-AA-Verstöße, kein seitliches Scrollen; Handy zeigt Karten', async ({ page, users }) => {
    const { tenantId } = await setup(page, users)
    const c = await addCompany(tenantId, { name: 'Darstellung GmbH mit sehr langem Namen für schmale Bildschirme', vat_id: 'ATU12345678', postal_code: '1010', city: 'Wien', country: 'AT', website: 'www.darstellung.at' })
    await addGuest(tenantId, 'Sicht', c)
    const scan = async (label: string, include?: string) => {
      const builder = new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      const results = await (include ? builder.include(include) : builder).analyze()
      expect(results.violations, label).toEqual([])
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
      expect(overflow, `${label}: seitliches Scrollen`).toBe(false)
    }
    await openCompanies(page)
    if (test.info().project.name === 'mobile') await expect(page.getByRole('table')).toBeHidden()
    await scan('Liste')
    await page.getByRole('link', { name: 'Darstellung GmbH mit sehr langem Namen für schmale Bildschirme' }).first().click()
    await expect(page.getByRole('heading', { level: 1, name: /Darstellung GmbH/ })).toBeVisible()
    await scan('Detail')
    await page.getByRole('button', { name: 'Bearbeiten' }).click()
    await expect(panel(page).getByLabel('Firmenname')).toBeVisible()
    // Dialog-Animation abwarten, sonst meldet axe Zwischenfarben
    await page.waitForTimeout(400)
    await scan('Formular', '[role="dialog"]')
  })
})
