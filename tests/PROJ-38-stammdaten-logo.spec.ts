import { randomUUID } from 'node:crypto'
import path from 'node:path'

import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test as base } from '@playwright/test'

import {
  createTenant,
  createUser,
  deleteUser,
  type E2EUser,
  hasSupabaseEnv,
  service,
  signInAs,
  signInAsAdmin,
} from './support/supabase'

// PROJ-38: Einstellungen-Reiter „Stammdaten“ (vorher „Kunde“), neue Reihenfolge und Umleitungen.
// Speicherfunktion und Zugriffsregeln des Logos: supabase/tests/tenant-logo.integration.test.ts.
// Logo-Abläufe in der Oberfläche (QA): Testbilder in tests/fixtures (PNG mit Transparenz 800×500, kleines PNG 200×125,
// JPEG und HEIC 3000×2000, SVG, PDF). Logos der Testkunden werden am Ende aus dem Speicher entfernt.
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

// ---------------------------------------------------------------------------
// Logo in der Oberfläche (QA)
// ---------------------------------------------------------------------------
const fixture = (name: string) => path.join(__dirname, 'fixtures', name)
const BUCKET = 'tenant-logos'
const logoInput = (page: Page) => page.locator('main input[type=file]')
const preview = (page: Page) => page.getByRole('button', { name: 'Logo groß ansehen' })
const save = (page: Page) => page.getByRole('button', { name: 'Speichern' }).click()

async function savedLogo(tenantId: string) {
  const { data } = await service().from('tenants').select('logo_path').eq('id', tenantId).single()
  return data?.logo_path ?? null
}

async function folder(tenantId: string) {
  const { data } = await service().storage.from(BUCKET).list(tenantId)
  return (data ?? []).map((f) => `${tenantId}/${f.name}`)
}

// PNG-Kopf: Breite, Höhe und Farbtyp (6 = RGBA, also mit Transparenz)
async function pngInfo(storagePath: string) {
  const { data } = await service().storage.from(BUCKET).download(storagePath)
  const bytes = Buffer.from(await data!.arrayBuffer())
  return {
    png: bytes.subarray(1, 4).toString() === 'PNG',
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    colorType: bytes[25],
  }
}

async function upload(page: Page, file: string | { name: string; mimeType: string; buffer: Buffer }) {
  await logoInput(page).setInputFiles(typeof file === 'string' ? fixture(file) : file)
}

async function ownerWithTenant(users: (opts?: Parameters<typeof createUser>[0]) => Promise<E2EUser>, label: string) {
  const owner = await users()
  const tenantId = await createTenant(`QA38 ${label} ${randomUUID().slice(0, 8)}`, [{ user: owner, role: 'owner' }])
  folders.push(tenantId)
  return { owner, tenantId }
}

const folders: string[] = []
test.afterEach(async () => {
  for (const id of folders.splice(0)) {
    const files = await folder(id)
    if (files.length) await service().storage.from(BUCKET).remove(files)
  }
})

test.describe('Logo (Inhaber)', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('AC: PNG mit Transparenz: Vorschau sofort, erst „Speichern“ übernimmt; Neuladen ohne Speichern behält den alten Stand', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await ownerWithTenant(users, 'PNG')
    await signInAs(page, owner)
    await page.goto('/einstellungen/stammdaten')
    await ready(page)
    await expect(page.getByRole('heading', { name: 'Logo' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Logo hochladen' })).toBeVisible()

    await upload(page, 'ausweis.png')
    await expect(preview(page)).toBeVisible()
    await expect(page.getByText('Noch nicht gespeichert.', { exact: false })).toBeVisible()
    await expect(page.getByText('Das Logo ist klein', { exact: false })).toHaveCount(0)
    // Hochgeladen, aber nicht eingetragen
    expect(await folder(tenantId)).toHaveLength(1)
    expect(await savedLogo(tenantId)).toBeNull()
    await page.reload()
    await ready(page)
    await expect(page.getByRole('button', { name: 'Logo hochladen' })).toBeVisible()

    await upload(page, 'ausweis.png')
    await expect(preview(page)).toBeVisible()
    await save(page)
    await expect(page.getByText('Kundendaten gespeichert.')).toBeVisible()
    await page.reload()
    await ready(page)
    await expect(preview(page)).toBeVisible()
    await expect(page.getByText('Noch nicht gespeichert.', { exact: false })).toHaveCount(0)
    const stored = await savedLogo(tenantId)
    expect(stored).toMatch(new RegExp(`^${tenantId}/[0-9a-f-]{36}\\.png$`))
    expect(await pngInfo(stored!)).toEqual({ png: true, width: 800, height: 500, colorType: 6 })

    // Groß ansehen
    await preview(page).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('img', { name: 'Logo' })).toBeVisible()
    await dialog.getByRole('button', { name: 'Schließen' }).first().click()
    await expect(dialog).toHaveCount(0)
  })

  test('AC: JPEG und HEIC werden richtig gedreht auf 1.000 px verkleinert und als PNG gespeichert', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await ownerWithTenant(users, 'JPEG')
    await signInAs(page, owner)
    await page.goto('/einstellungen/stammdaten')
    await ready(page)
    await upload(page, 'ausweis.jpg')
    await expect(preview(page)).toBeVisible()
    await save(page)
    await expect(page.getByText('Kundendaten gespeichert.')).toBeVisible()
    await expect.poll(() => savedLogo(tenantId)).not.toBeNull()
    expect(await pngInfo((await savedLogo(tenantId))!)).toMatchObject({ png: true, width: 1000, height: 667 })

    await page.reload()
    await ready(page)
    await upload(page, 'ausweis.heic')
    await expect(page.getByText('Noch nicht gespeichert.', { exact: false })).toBeVisible({ timeout: 20_000 })
    await save(page)
    await expect(page.getByText('Kundendaten gespeichert.')).toBeVisible()
    await expect.poll(async () => (await folder(tenantId)).length).toBe(1)
    expect(await pngInfo((await savedLogo(tenantId))!)).toMatchObject({ png: true, width: 1000, height: 667 })
  })

  test('AC: kleines Logo (< 300 px) mit Hinweis, Speichern trotzdem möglich; Hinweis auch nach dem Neuladen (BUG-2)', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await ownerWithTenant(users, 'Klein')
    await signInAs(page, owner)
    await page.goto('/einstellungen/stammdaten')
    await ready(page)
    await upload(page, 'logo-klein.png')
    const hint = page.getByText('Das Logo ist klein und kann im Druck unscharf wirken.')
    await expect(hint).toBeVisible()
    await save(page)
    await expect(page.getByText('Kundendaten gespeichert.')).toBeVisible()
    expect(await pngInfo((await savedLogo(tenantId))!)).toMatchObject({ width: 200, height: 125 })
    await page.reload()
    await ready(page)
    await expect(hint).toBeVisible()
  })

  test('AC: SVG, PDF, zu große und beschädigte Dateien werden abgelehnt, das bisherige Logo bleibt', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await ownerWithTenant(users, 'Fehler')
    await signInAs(page, owner)
    await page.goto('/einstellungen/stammdaten')
    await ready(page)
    await upload(page, 'ausweis.png')
    await expect(preview(page)).toBeVisible()
    await save(page)
    await expect(page.getByText('Kundendaten gespeichert.')).toBeVisible()
    const stored = await savedLogo(tenantId)
    await page.reload()
    await ready(page)

    const unsupported = page.getByText('Diese Datei kann nicht als Logo verwendet werden.', { exact: false })
    await upload(page, 'logo.svg')
    await expect(unsupported).toBeVisible()
    await expect(preview(page)).toBeVisible()
    await upload(page, 'ausweis.pdf')
    await expect(unsupported).toBeVisible()
    await upload(page, { name: 'riesig.png', mimeType: 'image/png', buffer: Buffer.alloc(10 * 1024 * 1024 + 1) })
    await expect(page.getByText('Die Datei ist zu groß. Erlaubt sind Bilder bis 10 MB.')).toBeVisible()
    await upload(page, { name: 'kaputt.png', mimeType: 'image/png', buffer: Buffer.from('kein Bild') })
    await expect(unsupported).toBeVisible()

    await expect(page.getByText('Noch nicht gespeichert.', { exact: false })).toHaveCount(0)
    await save(page)
    await expect(page.getByText('Kundendaten gespeichert.')).toBeVisible()
    expect(await savedLogo(tenantId)).toBe(stored)
    expect(await folder(tenantId)).toEqual([stored])
  })

  test('AC: Ersetzen löscht das alte Logo, Entfernen mit Hinweis; Protokoll „Stammdaten geändert: Logo“', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await ownerWithTenant(users, 'Ersetzen')
    await signInAs(page, owner)
    await page.goto('/einstellungen/stammdaten')
    await ready(page)
    await upload(page, 'ausweis.png')
    await expect(preview(page)).toBeVisible()
    await save(page)
    await expect(page.getByText('Kundendaten gespeichert.')).toBeVisible()
    const first = await savedLogo(tenantId)
    await page.reload()
    await ready(page)

    await upload(page, 'logo-klein.png')
    await expect(page.getByText('Noch nicht gespeichert.', { exact: false })).toBeVisible()
    await save(page)
    await expect(page.getByText('Kundendaten gespeichert.')).toBeVisible()
    await expect.poll(() => folder(tenantId)).toEqual([await savedLogo(tenantId)])
    expect(await savedLogo(tenantId)).not.toBe(first)

    await page.reload()
    await ready(page)
    await page.getByRole('button', { name: 'Logo entfernen' }).click()
    await expect(page.getByText('Das Logo wird beim Speichern entfernt.')).toBeVisible()
    // Neuladen ohne Speichern: Logo ist noch da
    await page.reload()
    await ready(page)
    await expect(preview(page)).toBeVisible()
    await page.getByRole('button', { name: 'Logo entfernen' }).click()
    await save(page)
    await expect(page.getByText('Kundendaten gespeichert.')).toBeVisible()
    await expect.poll(() => savedLogo(tenantId)).toBeNull()
    await expect.poll(() => folder(tenantId)).toEqual([])
    await expect(page.getByRole('button', { name: 'Logo hochladen' })).toBeVisible()

    const { data: log } = await service().from('operator_log').select('changed_fields').eq('tenant_id', tenantId).eq('action', 'master_data')
    // Beim ersten Speichern kommt der vorbelegte Staat dazu (PROJ-28)
    expect(log).toHaveLength(3)
    for (const entry of log!) expect(entry.changed_fields).toContain('logo_path')
  })

  test('AC: gleichzeitige Änderung → Hinweis, Logo wird nicht gespeichert', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await ownerWithTenant(users, 'Konflikt')
    await signInAs(page, owner)
    await page.goto('/einstellungen/stammdaten')
    await ready(page)
    await upload(page, 'ausweis.png')
    await expect(preview(page)).toBeVisible()
    // Jemand anders speichert inzwischen
    await service().from('tenants').update({ city: 'Graz' }).eq('id', tenantId)
    await save(page)
    await expect(page.getByText('Die Kundendaten wurden inzwischen geändert.', { exact: false })).toBeVisible()
    expect(await savedLogo(tenantId)).toBeNull()
    await expect(preview(page)).toBeVisible()
  })

  test('AC: Speichern während des Hochladens ist gesperrt', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await ownerWithTenant(users, 'Warten')
    await signInAs(page, owner)
    await page.goto('/einstellungen/stammdaten')
    await ready(page)
    // Hochladen künstlich verzögern
    await page.route('**/storage/v1/object/upload/sign/**', async (route) => {
      await new Promise((r) => setTimeout(r, 1500))
      await route.continue()
    })
    await upload(page, 'ausweis.png')
    await expect(page.getByText('Logo wird vorbereitet und hochgeladen …')).toBeVisible()
    await save(page)
    await expect(page.getByText('Bitte warte, bis das Logo hochgeladen ist.')).toBeVisible()
    await expect(preview(page)).toBeVisible()
    expect(await savedLogo(tenantId)).toBeNull()
  })

  test('AC: Handy 375 px: Logo-Feld ohne seitliches Scrollen, Knöpfe ≥ 44 px, keine axe-Verstöße im Logo-Bereich', async ({ page, users }) => {
    desktopOnly()
    const { owner } = await ownerWithTenant(users, 'Handy')
    await page.setViewportSize({ width: 375, height: 800 })
    await signInAs(page, owner)
    await page.goto('/einstellungen/stammdaten')
    await ready(page)
    await upload(page, 'ausweis.jpg')
    await expect(preview(page)).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
    for (const name of ['Ersetzen', 'Logo entfernen']) {
      const box = await page.getByRole('button', { name }).boundingBox()
      expect(box!.height).toBeGreaterThanOrEqual(43.5)
    }
    const results = await new AxeBuilder({ page })
      .include('main')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
  })
})

test.describe('Logo (Betreiber)', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('AC: Betreiber lädt bei aktivem Kunden hoch, Inhaber sieht es; deaktiviert nur Vorschau; Löschen entfernt den Ordner', async ({ page, browser, users }) => {
    desktopOnly()
    const admin = await users({ admin: true })
    const { owner, tenantId } = await ownerWithTenant(users, 'Betreiber')
    await signInAsAdmin(page, admin)
    await page.goto(`/betreiber/kunden/${tenantId}`)
    await ready(page)
    await upload(page, 'ausweis.png')
    await expect(preview(page)).toBeVisible()
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Kundendaten gespeichert.')).toBeVisible()
    await expect(page.getByText('Stammdaten geändert: Staat, Logo')).toBeVisible()

    const ownerContext = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const ownerPage = await ownerContext.newPage()
    await signInAs(ownerPage, owner)
    await ownerPage.goto('/einstellungen/stammdaten')
    await ready(ownerPage)
    await expect(preview(ownerPage)).toBeVisible()
    await ownerContext.close()

    await service().from('tenants').update({ status: 'deactivated' }).eq('id', tenantId)
    await page.reload()
    await ready(page)
    await expect(preview(page)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Ersetzen' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Logo entfernen' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Logo hochladen' })).toHaveCount(0)

    // Endgültig löschen entfernt auch den Logo-Ordner
    const name = (await service().from('tenants').select('name').eq('id', tenantId).single()).data!.name
    await page.getByRole('button', { name: 'Endgültig löschen' }).click()
    const dialog = page.getByRole('alertdialog')
    await dialog.getByRole('textbox').fill(name)
    await dialog.getByRole('button', { name: 'Endgültig löschen' }).click()
    await expect(page).toHaveURL('/betreiber')
    await expect.poll(() => folder(tenantId)).toEqual([])
  })

  test('AC: Betreiber bei deaktiviertem Kunden ohne Logo sieht „Kein Logo hinterlegt.“', async ({ page, users }) => {
    desktopOnly()
    const admin = await users({ admin: true })
    const { tenantId } = await ownerWithTenant(users, 'Ohne')
    await service().from('tenants').update({ status: 'deactivated' }).eq('id', tenantId)
    await signInAsAdmin(page, admin)
    await page.goto(`/betreiber/kunden/${tenantId}`)
    await ready(page)
    await expect(page.getByText('Kein Logo hinterlegt.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Logo hochladen' })).toHaveCount(0)
  })
})
