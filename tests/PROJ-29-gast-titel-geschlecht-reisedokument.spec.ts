import path from 'node:path'

import AxeBuilder from '@axe-core/playwright'
import { expect, type Locator, type Page, test as base } from '@playwright/test'

import { createTenant, createUser, deleteUser, type E2EUser, hasSupabaseEnv, service, signInAs } from './support/supabase'

// PROJ-29: Titel, Geschlecht, Reisedokument mit Ausweisbildern. Abläufe nur im Projekt „desktop“,
// Barrierefreiheit in allen Breiten. Testbilder: tests/fixtures (JPEG 3000×2000, PNG mit Transparenz,
// HEIC aus macOS, PDF). Ausweisbilder der Testkunden werden am Ende aus dem Speicher entfernt.

const BUCKET = 'guest-documents'
const fixture = (name: string) => path.join(__dirname, 'fixtures', name)

const test = base.extend<{ users: (opts?: Parameters<typeof createUser>[0]) => Promise<E2EUser>; tenants: string[] }>({
  tenants: async ({}, use) => {
    const ids: string[] = []
    await use(ids)
    for (const id of ids) {
      const { data } = await service().storage.from(BUCKET).list(id, { limit: 1000 })
      if (data?.length) await service().storage.from(BUCKET).remove(data.map((f) => `${id}/${f.name}`))
    }
  },
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

async function setup(page: Page, users: Users, tenants: string[], role: 'owner' | 'staff' = 'owner') {
  const owner = await users({ displayName: 'Olga Owner' })
  const members: { user: E2EUser; role: 'owner' | 'staff' }[] = [{ user: owner, role: 'owner' }]
  let staff: E2EUser | undefined
  if (role === 'staff') {
    staff = await users({ displayName: 'Sam Staff' })
    members.push({ user: staff, role: 'staff' })
  }
  const tenantId = await createTenant('QA29 Testkunde', members)
  tenants.push(tenantId)
  await signInAs(page, role === 'staff' ? staff! : owner)
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

// Bild direkt in den Speicher legen (Systemrechte), z. B. für Gäste, die der Test vorbereitet
async function storeImage(tenantId: string) {
  const name = `${tenantId}/${crypto.randomUUID()}.jpg`
  const { readFileSync } = await import('node:fs')
  const { error } = await service().storage.from(BUCKET).upload(name, readFileSync(fixture('ausweis.jpg')), { contentType: 'image/jpeg' })
  if (error) throw error
  return name
}

async function fileExists(name: string) {
  const [folder, file] = name.split('/')
  const { data } = await service().storage.from(BUCKET).list(folder, { search: file })
  return (data ?? []).some((f) => f.name === file)
}

async function openGuest(page: Page, id: string) {
  await page.goto(`/gaeste/${id}`)
  await ready(page)
}

async function openDocument(page: Page) {
  const trigger = panel(page).getByRole('button', { name: /Reisedokument/ })
  if ((await trigger.getAttribute('aria-expanded')) !== 'true') await trigger.click()
}

async function choose(page: Page, scope: Locator, label: string, option: string) {
  await scope.getByRole('combobox', { name: label }).click()
  await page.getByRole('option', { name: option, exact: true }).click()
}

async function chooseCountry(page: Page, label: string, country: string) {
  await panel(page).getByRole('combobox', { name: label }).click()
  await page.getByPlaceholder('Land suchen').fill(country)
  await page.getByRole('option', { name: country, exact: true }).click()
}

// Bildplatz 0 = Vorderseite, 1 = Rückseite
async function uploadImage(page: Page, side: 0 | 1, file: string) {
  await panel(page).locator('input[type=file]').nth(side).setInputFiles(fixture(file))
}

const naturalWidth = (img: Locator) => img.evaluate((el) => (el as HTMLImageElement).naturalWidth)

test.beforeEach(() => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')
})

test.describe('Titel und Geschlecht', () => {
  test('AC: Felder im Formular, Geschlecht vorbelegt, sechs Werte; voller Name mit Titeln in Detail und Liste', async ({ page, users, tenants }) => {
    desktopOnly()
    await setup(page, users, tenants)
    await page.goto('/gaeste')
    await ready(page)
    await page.getByRole('button', { name: 'Gast anlegen' }).click()
    await expect(panel(page).getByLabel('Titel vorangestellt')).toBeVisible()
    await expect(panel(page).getByLabel('Titel nachgestellt')).toBeVisible()
    const gender = panel(page).getByRole('combobox', { name: 'Geschlecht' })
    await expect(gender).toHaveText('keine Angabe')
    await gender.click()
    await expect(page.getByRole('option')).toHaveText(['männlich', 'weiblich', 'divers', 'inter', 'offen', 'keine Angabe'])
    await page.getByRole('option', { name: 'weiblich' }).click()

    await panel(page).getByLabel('Titel vorangestellt').fill('x'.repeat(50))
    await panel(page).getByLabel('Nachname').fill('Huber')
    await panel(page).getByLabel('Vorname').fill('Anna')
    await chooseCountry(page, 'Herkunftsland', 'Österreich')
    // Eingabe ist auf 50 Zeichen begrenzt
    await expect(panel(page).getByLabel('Titel vorangestellt')).toHaveAttribute('maxlength', '50')
    await panel(page).getByLabel('Titel vorangestellt').fill('Dr.')
    await panel(page).getByLabel('Titel nachgestellt').fill('LL.M.')
    await panel(page).getByRole('button', { name: 'Gast anlegen' }).click()

    await expect(page.getByRole('heading', { name: 'Dr. Anna Huber, LL.M.' })).toBeVisible()
    await expect(page.getByText('weiblich')).toBeVisible()
    await page.goto('/gaeste')
    await ready(page)
    await expect(page.getByRole('table').getByRole('link')).toHaveText(['Dr. Anna Huber, LL.M.'])
  })

  test('AC: bestehender Gast hat „keine Angabe“; nur nachgestellter Titel ohne Vorname; Sortierung nach Nachname', async ({ page, users, tenants }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users, tenants)
    const id = await addGuest(tenantId, { last_name: 'Huber', title_suffix: 'MSc' })
    await addGuest(tenantId, { last_name: 'Adler', first_name: 'Zoe', title_prefix: 'Univ.-Prof. DI Dr.' })
    await openGuest(page, id)
    await expect(page.getByRole('heading', { name: 'Huber, MSc' })).toBeVisible()
    await expect(page.getByText('keine Angabe')).toBeVisible()
    await page.goto('/gaeste')
    await ready(page)
    await expect(page.getByRole('table').getByRole('link')).toHaveText(['Univ.-Prof. DI Dr. Zoe Adler', 'Huber, MSc'])
  })
})

test.describe('Reisedokument', () => {
  test('AC: Art und Nummer Pflicht, sobald etwas erfasst ist; drei Arten; Ausstellungsdatum nicht in der Zukunft; Anzeige im Detail', async ({ page, users, tenants }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users, tenants)
    const id = await addGuest(tenantId, { last_name: 'Berger', first_name: 'Eva' })
    await openGuest(page, id)
    await expect(page.getByRole('heading', { name: 'Reisedokument' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Bearbeiten' }).click()
    await openDocument(page)
    await panel(page).getByLabel('Behörde').fill('BH Graz-Umgebung')
    await panel(page).getByRole('button', { name: 'Speichern' }).click()
    await expect(panel(page).getByText('Bitte die Art des Dokuments wählen.')).toBeVisible()
    await expect(panel(page).getByText('Bitte die Nummer des Dokuments eingeben.')).toBeVisible()

    await panel(page).getByRole('combobox', { name: 'Art des Dokuments' }).click()
    await expect(page.getByRole('option')).toHaveText(['Kein Dokument', 'Reisepass', 'Personalausweis', 'Führerschein'])
    await page.getByRole('option', { name: 'Personalausweis' }).click()
    await panel(page).getByLabel('Nummer des Dokuments').fill('A1234567')
    await panel(page).getByLabel('Ausstellungsdatum').fill('2999-01-01')
    await panel(page).getByRole('button', { name: 'Speichern' }).click()
    await expect(panel(page).getByText('Das Ausstellungsdatum darf nicht in der Zukunft liegen.')).toBeVisible()
    await panel(page).getByLabel('Ausstellungsdatum').fill('2021-03-15')
    await chooseCountry(page, 'Staat', 'Deutschland')
    await panel(page).getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Änderungen gespeichert')).toBeVisible()

    const section = page.locator('section', { has: page.getByRole('heading', { name: 'Reisedokument' }) })
    await expect(section.getByText('Personalausweis')).toBeVisible()
    await expect(section.getByText('A1234567')).toBeVisible()
    await expect(section.getByText('15. März 2021')).toBeVisible()
    await expect(section.getByText('BH Graz-Umgebung')).toBeVisible()
    await expect(section.getByText('Deutschland')).toBeVisible()

    // Alles leeren → kein Reisedokument mehr
    await page.getByRole('button', { name: 'Bearbeiten' }).click()
    await openDocument(page)
    await choose(page, panel(page), 'Art des Dokuments', 'Kein Dokument')
    await panel(page).getByLabel('Nummer des Dokuments').fill('')
    await panel(page).getByLabel('Ausstellungsdatum').fill('')
    await panel(page).getByLabel('Behörde').fill('')
    await panel(page).getByRole('combobox', { name: 'Staat' }).click()
    await page.getByRole('option', { name: 'Keine Angabe' }).click()
    await panel(page).getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Änderungen gespeichert')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Reisedokument' })).toHaveCount(0)
  })
})

test.describe('Ausweisbilder', () => {
  test('AC: JPEG und HEIC hochladen, umgewandelt auf 2.000 px; groß ansehen und herunterladen', async ({ page, users, tenants }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users, tenants)
    const id = await addGuest(tenantId, { last_name: 'Bild', first_name: 'Ben' })
    await openGuest(page, id)
    await page.getByRole('button', { name: 'Bearbeiten' }).click()
    await openDocument(page)
    await choose(page, panel(page), 'Art des Dokuments', 'Reisepass')
    await panel(page).getByLabel('Nummer des Dokuments').fill('P7654321')
    await uploadImage(page, 0, 'ausweis.jpg')
    await expect(panel(page).getByRole('button', { name: 'Vorderseite groß ansehen' })).toBeVisible({ timeout: 20_000 })
    await uploadImage(page, 1, 'ausweis.heic')
    await expect(panel(page).getByRole('button', { name: 'Rückseite groß ansehen' })).toBeVisible({ timeout: 30_000 })
    await panel(page).getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Änderungen gespeichert')).toBeVisible()

    const { data } = await service().from('guests').select('document_front_path, document_back_path').eq('id', id).single()
    const stored = data as { document_front_path: string; document_back_path: string }
    expect(stored.document_front_path).toMatch(new RegExp(`^${tenantId}/[0-9a-f-]{36}\\.jpg$`))
    expect(stored.document_back_path).toMatch(new RegExp(`^${tenantId}/[0-9a-f-]{36}\\.jpg$`))

    for (const side of ['Vorderseite', 'Rückseite']) {
      await page.getByRole('button', { name: `${side} groß ansehen` }).click()
      const dialog = page.getByRole('dialog')
      const img = dialog.getByRole('img', { name: side })
      await expect(img).toBeVisible()
      // 3000 × 2000 → längste Seite 2.000 px (auch das HEIC-Bild, in Chrome über den nachgeladenen Dekoder)
      await expect.poll(() => naturalWidth(img)).toBe(2000)
      const download = page.waitForEvent('download')
      await dialog.getByRole('link', { name: 'Herunterladen' }).click()
      expect((await download).suggestedFilename()).toBe(`Reisepass-Bild-${side === 'Vorderseite' ? 'Vorderseite' : 'Ruckseite'}.jpg`)
      await dialog.getByRole('button', { name: 'Schließen' }).first().click()
    }
  })

  test('AC: PNG wird angenommen; PDF abgelehnt, bisheriges Bild bleibt; Ersetzen und Entfernen löschen die alten Dateien', async ({ page, users, tenants }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users, tenants)
    const front = await storeImage(tenantId)
    const back = await storeImage(tenantId)
    const id = await addGuest(tenantId, {
      last_name: 'Tausch',
      document_type: 'id_card',
      document_number: 'X1',
      document_front_path: front,
      document_back_path: back,
    })
    await openGuest(page, id)
    await page.getByRole('button', { name: 'Bearbeiten' }).click()
    await openDocument(page)
    await expect(panel(page).getByRole('button', { name: 'Vorderseite groß ansehen' })).toBeVisible()

    await uploadImage(page, 0, 'ausweis.pdf')
    await expect(panel(page).getByText(/Diese Datei ist kein lesbares Bild/)).toBeVisible()
    await expect(panel(page).getByRole('button', { name: 'Vorderseite groß ansehen' })).toBeVisible()

    await uploadImage(page, 0, 'ausweis.png')
    await expect(panel(page).getByText(/Diese Datei ist kein lesbares Bild/)).toHaveCount(0, { timeout: 20_000 })
    await panel(page).getByRole('button', { name: 'Entfernen' }).nth(1).click()
    await expect(panel(page).getByRole('button', { name: 'Bild hinzufügen' })).toHaveCount(1)
    await panel(page).getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Änderungen gespeichert')).toBeVisible()

    const { data } = await service().from('guests').select('document_front_path, document_back_path').eq('id', id).single()
    const after = data as { document_front_path: string; document_back_path: string | null }
    expect(after.document_front_path).not.toBe(front)
    expect(after.document_back_path).toBeNull()
    await expect.poll(() => fileExists(front)).toBe(false)
    await expect.poll(() => fileExists(back)).toBe(false)
    await expect(page.getByRole('button', { name: 'Vorderseite groß ansehen' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Rückseite groß ansehen' })).toHaveCount(0)
  })

  test('Edge Case: Hinweis, wenn sich die Art ändert und die alten Bilder bleiben; Speichern wartet auf den Upload', async ({ page, users, tenants }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users, tenants)
    const front = await storeImage(tenantId)
    const id = await addGuest(tenantId, { last_name: 'Wechsel', document_type: 'id_card', document_number: 'X2', document_front_path: front })
    await openGuest(page, id)
    await page.getByRole('button', { name: 'Bearbeiten' }).click()
    await openDocument(page)
    await choose(page, panel(page), 'Art des Dokuments', 'Reisepass')
    await expect(panel(page).getByText(/Die vorhandenen Bilder gehören möglicherweise noch zum bisherigen Dokument/)).toBeVisible()
  })
})

test.describe('Rollen', () => {
  test('AC: Mitarbeiter sieht Dokument und Bilder, kann sie öffnen und herunterladen, aber nicht bearbeiten', async ({ page, users, tenants }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users, tenants, 'staff')
    const front = await storeImage(tenantId)
    const id = await addGuest(tenantId, { last_name: 'Sicht', document_type: 'passport', document_number: 'S1', document_front_path: front })
    await openGuest(page, id)
    await expect(page.getByText('S1')).toBeVisible()
    await page.getByRole('button', { name: 'Vorderseite groß ansehen' }).click()
    await expect(page.getByRole('dialog').getByRole('link', { name: 'Herunterladen' })).toBeVisible()
    await expect.poll(() => naturalWidth(page.getByRole('dialog').getByRole('img', { name: 'Vorderseite' }))).toBeGreaterThan(0)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: 'Bearbeiten' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Bild hinzufügen' })).toHaveCount(0)
  })

  test('AC: Mitarbeiter legt Buchung mit neuem Gast samt Titel, Geschlecht, Dokument und Bild an', async ({ page, users, tenants }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users, tenants, 'staff')
    const { data: property } = await service()
      .from('properties')
      .insert({ tenant_id: tenantId, name: 'Haus See', street: 'Seeweg 12', postal_code: '5340', city: 'St. Gilgen', municipality_code: '50330' })
      .select('id')
      .single()
    await service()
      .from('apartments')
      .insert({ tenant_id: tenantId, property_id: property!.id, name: 'Top 1', max_guests: 4, price_cents: 12000 } as never)
    await page.goto('/buchungen')
    await ready(page)
    await page.getByRole('button', { name: 'Neue Buchung' }).first().click()
    const arrival = new Date(Date.now() + 40 * 86_400_000).toISOString().slice(0, 10)
    const departure = new Date(Date.now() + 43 * 86_400_000).toISOString().slice(0, 10)
    await panel(page).getByLabel('Anreise', { exact: true }).fill(arrival)
    await panel(page).getByLabel('Abreise', { exact: true }).fill(departure)
    await panel(page).getByRole('radio', { name: 'Neuer Gast' }).click()
    await panel(page).getByLabel('Titel vorangestellt').fill('Mag.')
    await panel(page).getByLabel('Nachname').fill('Neumann')
    await panel(page).getByLabel('Vorname').fill('Nora')
    await choose(page, panel(page), 'Geschlecht', 'divers')
    await chooseCountry(page, 'Herkunftsland', 'Deutschland')
    await openDocument(page)
    await choose(page, panel(page), 'Art des Dokuments', 'Führerschein')
    await panel(page).getByLabel('Nummer des Dokuments').fill('F99')
    await uploadImage(page, 0, 'ausweis.jpg')
    await expect(panel(page).getByRole('button', { name: 'Vorderseite groß ansehen' })).toBeVisible({ timeout: 20_000 })
    const save = panel(page).getByRole('button', { name: 'Buchung speichern', exact: true })
    await save.scrollIntoViewIfNeeded()
    await save.click()

    await expect(page).toHaveURL(/\/buchungen\/[0-9a-f-]{36}$/)
    await expect(page.getByRole('heading', { name: 'Mag. Nora Neumann' })).toBeVisible()
    const { data } = await service().from('guests').select('gender, document_type, document_front_path').eq('tenant_id', tenantId).eq('last_name', 'Neumann').single()
    const g = data as { gender: string; document_type: string; document_front_path: string | null }
    expect(g.gender).toBe('diverse')
    expect(g.document_type).toBe('driving_licence')
    expect(g.document_front_path).toMatch(new RegExp(`^${tenantId}/`))
  })
})

test.describe('Zusammenführen und Löschen', () => {
  test('AC: Reisedokument als Ganzes wählen; Bilder des nicht gewählten Dokuments werden gelöscht', async ({ page, users, tenants }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users, tenants)
    const imageA = await storeImage(tenantId)
    const imageB = await storeImage(tenantId)
    const keep = await addGuest(tenantId, { last_name: 'Doppel', first_name: 'Dora', document_type: 'passport', document_number: 'AAA', document_front_path: imageA })
    await addGuest(tenantId, { last_name: 'Doppel', first_name: 'Dora', gender: 'female', title_prefix: 'Dr.', document_type: 'id_card', document_number: 'BBB', document_front_path: imageB })
    await openGuest(page, keep)
    await page.getByRole('button', { name: 'Mit anderem Gast zusammenführen' }).click()
    await panel(page).getByRole('combobox').fill('doppel')
    await page.getByRole('option', { name: /Dr\. Dora Doppel/ }).click()
    await expect(panel(page).getByText(/Die Bilder des anderen Dokuments werden gelöscht/)).toBeVisible()
    await panel(page).getByLabel(/Personalausweis, BBB/).check()
    await panel(page).getByRole('button', { name: 'Zusammenführen' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Zusammenführen' }).click()
    await expect(page.getByText('Gäste zusammengeführt')).toBeVisible()
    // Titel und Geschlecht: bei A leer → vorbelegt mit B
    await expect(page.getByRole('heading', { name: 'Dr. Dora Doppel' })).toBeVisible()
    await expect(page.getByText('BBB')).toBeVisible()
    await expect.poll(() => fileExists(imageA)).toBe(false)
    expect(await fileExists(imageB)).toBe(true)
  })

  test('AC: Anonymisieren entfernt Titel, Dokument und Bilder, Geschlecht „keine Angabe“', async ({ page, users, tenants }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users, tenants)
    const image = await storeImage(tenantId)
    const id = await addGuest(tenantId, {
      last_name: 'Weg',
      title_prefix: 'Dr.',
      gender: 'male',
      document_type: 'passport',
      document_number: 'W1',
      document_front_path: image,
    })
    // Buchung → Löschen wird zum Anonymisieren
    const { data: property } = await service()
      .from('properties')
      .insert({ tenant_id: tenantId, name: 'Haus', street: 'Weg 1', postal_code: '5340', city: 'St. Gilgen', municipality_code: '50330' })
      .select('id')
      .single()
    const { data: apt } = await service()
      .from('apartments')
      .insert({ tenant_id: tenantId, property_id: property!.id, name: 'Top 1', max_guests: 4 } as never)
      .select('id')
      .single()
    await service()
      .from('bookings')
      .insert({
        tenant_id: tenantId,
        apartment_id: (apt as { id: string }).id,
        kind: 'booking',
        arrival: '2026-01-10',
        departure: '2026-01-12',
        guest_id: id,
        adults: 1,
        child_ages: [],
        number_year: 2026,
        number_seq: 1,
      } as never)
    await openGuest(page, id)
    await page.getByRole('button', { name: 'Gast löschen' }).click()
    await page.getByRole('alertdialog').getByRole('button').last().click()
    await expect(page.getByRole('heading', { name: 'Gelöschter Gast' })).toBeVisible()
    await expect(page.getByText('W1')).toHaveCount(0)
    await expect.poll(() => fileExists(image)).toBe(false)
    const { data } = await service().from('guests').select('gender, title_prefix, document_type').eq('id', id).single()
    expect(data).toEqual({ gender: 'unspecified', title_prefix: null, document_type: null })
  })

  test('AC: Gast ohne Buchungen löschen entfernt auch seine Ausweisbilder', async ({ page, users, tenants }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users, tenants)
    const image = await storeImage(tenantId)
    const id = await addGuest(tenantId, { last_name: 'Ganzweg', document_type: 'passport', document_number: 'G1', document_back_path: image })
    await openGuest(page, id)
    await page.getByRole('button', { name: 'Gast löschen' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Endgültig löschen' }).click()
    await expect(page.getByText('Gast gelöscht')).toBeVisible()
    await expect.poll(() => fileExists(image)).toBe(false)
  })
})

test.describe('Gästeliste', () => {
  test('AC: jeder Name öffnet genau diesen Gast (Link nur auf dem Namen, Tastatur)', async ({ page, users, tenants }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users, tenants)
    const first = await addGuest(tenantId, { last_name: 'Aal', first_name: 'Anton' })
    await addGuest(tenantId, { last_name: 'Zander', first_name: 'Zora' })
    await page.goto('/gaeste')
    await ready(page)
    await page.getByRole('table').getByRole('link', { name: 'Anton Aal' }).click()
    await expect(page).toHaveURL(`/gaeste/${first}`)
    await page.goBack()
    await ready(page)
    await page.getByRole('table').getByRole('link', { name: 'Anton Aal' }).focus()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(`/gaeste/${first}`)
  })
})

test.describe('Layout und Barrierefreiheit', () => {
  test('Formular mit Reisedokument und Detail mit Bildern: keine WCAG-2.1-AA-Verstöße, kein seitliches Scrollen', async ({ page, users, tenants }) => {
    const { tenantId } = await setup(page, users, tenants)
    const image = await storeImage(tenantId)
    const id = await addGuest(tenantId, {
      last_name: 'Huber',
      first_name: 'Anna',
      title_prefix: 'Dr.',
      title_suffix: 'LL.M.',
      document_type: 'passport',
      document_number: 'P1',
      document_front_path: image,
    })
    const scan = async (label: string) => {
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      expect(results.violations, label).toEqual([])
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)
      expect(overflow, `${label}: seitliches Scrollen`).toBe(false)
    }
    await openGuest(page, id)
    await expect(page.getByRole('button', { name: 'Vorderseite groß ansehen' })).toBeVisible()
    await scan('Detail')
    await page.getByRole('button', { name: 'Vorderseite groß ansehen' }).click()
    await expect(page.getByRole('dialog').getByRole('img')).toBeVisible()
    await page.waitForTimeout(500) // Einblenden des Dialogs abwarten (sonst misst axe Zwischenfarben)
    await scan('Bildansicht')
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Bearbeiten' }).click()
    await openDocument(page)
    await expect(panel(page).getByLabel('Nummer des Dokuments')).toBeVisible()
    await scan('Formular')
  })
})
