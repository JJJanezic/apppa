import { randomUUID } from 'node:crypto'

import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test as base } from '@playwright/test'

import {
  anon,
  createTenant,
  createUser,
  deleteUser,
  type E2EUser,
  hasSupabaseEnv,
  service,
  signInAs,
  signInAsAdmin,
} from './support/supabase'

// PROJ-28: Kundenstammdaten. Datenbank-Regeln direkt gegen die Speicherfunktion, dazu der Ablauf des Inhabers.
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

const desktopOnly = () => test.skip(test.info().project.name !== 'desktop', 'Abläufe nur im Desktop-Projekt')
const unique = (label: string) => `QA28 ${label} ${randomUUID().slice(0, 8)}`
const ready = (page: Page) =>
  page.waitForFunction(() => Object.keys(document.querySelector('main') ?? {}).some((k) => k.startsWith('__reactFiber')))

const DATA = {
  name: 'QA28 Pichler',
  name_line2: '  z. H. Maria Pichler ',
  address_line1: 'Dorfstraße 1',
  address_line2: '',
  postal_code: '6020',
  city: 'Innsbruck',
  country: 'AT',
  vat_id: 'atu 1234 5678',
  tax_number: '12 345/6789',
  register_number: 'FN 123456a',
}

async function signedIn(user: E2EUser) {
  const client = anon()
  await client.auth.signInWithPassword({ email: user.email, password: user.password })
  return client
}

async function current(tenantId: string) {
  const { data } = await service().from('tenants').select('*').eq('id', tenantId).single()
  return data!
}

async function logEntries(tenantId: string) {
  const { data } = await service().from('operator_log').select('action, changed_fields').eq('tenant_id', tenantId)
  return data ?? []
}

test.describe('Speicherfunktion (Datenbank)', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('Inhaber speichert: bereinigt, Protokoll mit Feldern; ohne Änderung kein Eintrag; alter Stand → P0017', async ({ users }) => {
    desktopOnly()
    const owner = await users({ displayName: 'Olga Owner' })
    const tenant = await createTenant(unique('Inhaber'), [{ user: owner, role: 'owner' }])
    const client = await signedIn(owner)
    const before = await current(tenant)

    const saved = await client.rpc('update_tenant_master_data', { p_tenant_id: tenant, p_expected_updated_at: before.updated_at, p_data: DATA })
    expect(saved.error).toBeNull()
    const after = await current(tenant)
    expect(after).toMatchObject({
      name: 'QA28 Pichler',
      name_line2: 'z. H. Maria Pichler',
      address_line2: null,
      vat_id: 'ATU12345678',
      register_number: 'FN 123456a',
    })
    const log = await logEntries(tenant)
    expect(log).toHaveLength(1)
    expect(log[0].action).toBe('master_data')
    expect(log[0].changed_fields).toEqual(
      expect.arrayContaining(['name', 'name_line2', 'address_line1', 'postal_code', 'city', 'country', 'vat_id', 'tax_number', 'register_number'])
    )
    expect(log[0].changed_fields).not.toContain('address_line2')

    // Gleiche Werte noch einmal: kein Fehler, kein weiterer Eintrag
    const same = await client.rpc('update_tenant_master_data', { p_tenant_id: tenant, p_expected_updated_at: after.updated_at, p_data: DATA })
    expect(same.error).toBeNull()
    expect(await logEntries(tenant)).toHaveLength(1)

    // Mit dem Stand von vorher → inzwischen geändert
    const stale = await client.rpc('update_tenant_master_data', {
      p_tenant_id: tenant,
      p_expected_updated_at: before.updated_at,
      p_data: { ...DATA, city: 'Wien' },
    })
    expect(stale.error?.code).toBe('P0017')
    expect((await current(tenant)).city).toBe('Innsbruck')
  })

  test('Sicherheit: Mitarbeiter, fremder Inhaber und direktes Ändern werden abgewiesen; ungültige UID scheitert', async ({ users }) => {
    desktopOnly()
    const owner = await users()
    const staff = await users()
    const stranger = await users()
    const tenant = await createTenant(unique('Rechte'), [{ user: owner, role: 'owner' }, { user: staff, role: 'staff' }])
    await createTenant(unique('Fremd'), [{ user: stranger, role: 'owner' }])
    const { updated_at } = await current(tenant)

    for (const user of [staff, stranger]) {
      const client = await signedIn(user)
      const r = await client.rpc('update_tenant_master_data', { p_tenant_id: tenant, p_expected_updated_at: updated_at, p_data: DATA })
      expect(r.error?.code).toBe('42501')
    }
    // Fremder Inhaber sieht den Kunden nicht
    const strangerClient = await signedIn(stranger)
    const read = await strangerClient.from('tenants').select('id, vat_id').eq('id', tenant)
    expect(read.data ?? []).toHaveLength(0)

    // Direktes Ändern (bisheriger Weg für den Namen) ist geschlossen
    const ownerClient = await signedIn(owner)
    const direct = await ownerClient.from('tenants').update({ name: 'Gehackt' }).eq('id', tenant).select('id')
    expect(direct.error?.code).toBe('42501')

    const invalid = await ownerClient.rpc('update_tenant_master_data', {
      p_tenant_id: tenant,
      p_expected_updated_at: updated_at,
      p_data: { ...DATA, vat_id: 'ATU1234567' },
    })
    expect(invalid.error?.code).toBe('23514')
    expect((await current(tenant)).name).not.toBe('Gehackt')
    expect(await logEntries(tenant)).toHaveLength(0)
  })
})

test.describe('Einstellungen → Stammdaten', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('AC: Inhaber füllt Stammdaten aus, UID wird bereinigt, Staat ist mit Österreich vorbelegt', async ({ page, users }) => {
    desktopOnly()
    const owner = await users()
    const name = unique('Formular')
    await createTenant(name, [{ user: owner, role: 'owner' }])
    await signInAs(page, owner)
    await page.goto('/einstellungen/stammdaten')
    await ready(page)

    await expect(page.getByLabel('Kundenname')).toHaveValue(name)
    await expect(page.getByLabel('Staat')).toContainText('Österreich')
    await page.getByLabel('Adresszeile 1').fill('Dorfstraße 1')
    await page.getByLabel('Postleitzahl').fill('6020')
    await page.getByLabel('Ort').fill('Innsbruck')
    await page.getByLabel('UID').fill('ATU1234567')
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Bitte prüfe die UID.')).toBeVisible()

    await page.getByLabel('UID').fill('atu 1234 5678')
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Kundendaten gespeichert.')).toBeVisible()
    await page.reload()
    await ready(page)
    await expect(page.getByLabel('UID')).toHaveValue('ATU12345678')
    await expect(page.getByLabel('Ort')).toHaveValue('Innsbruck')
  })
})

const field = (page: Page, label: string) => page.getByLabel(label, { exact: true })

async function seed(tenantId: string, values: Record<string, string | null>) {
  const { error } = await service().from('tenants').update(values).eq('id', tenantId)
  expect(error).toBeNull()
}

async function asAdmin(page: Page, users: Fixtures['users']) {
  const admin = await users({ displayName: 'Ada Admin', admin: true })
  await signInAsAdmin(page, admin)
  return admin
}

test.describe('Inhaber: weitere Abläufe', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('AC: Gespeicherte Werte sichtbar; nur Name speichern; leerer Name → Meldung; optionales Feld leeren', async ({ page, users }) => {
    desktopOnly()
    const owner = await users()
    const name = unique('Werte')
    const tenant = await createTenant(name, [{ user: owner, role: 'owner' }])
    await seed(tenant, {
      name_line2: 'z. H. Maria',
      address_line1: 'Dorfstraße 1',
      address_line2: 'Top 3',
      postal_code: '6020',
      city: 'Innsbruck',
      country: 'DE',
      vat_id: 'DE123456789',
      tax_number: '12/345',
      register_number: 'FN 123456a',
    })
    await signInAs(page, owner)
    await page.goto('/einstellungen/stammdaten')
    await ready(page)

    for (const [label, value] of [
      ['Kundenname', name],
      ['Namenszeile 2', 'z. H. Maria'],
      ['Adresszeile 1', 'Dorfstraße 1'],
      ['Adresszeile 2', 'Top 3'],
      ['Postleitzahl', '6020'],
      ['Ort', 'Innsbruck'],
      ['UID', 'DE123456789'],
      ['Steuernummer', '12/345'],
      ['Registernummer', 'FN 123456a'],
    ]) {
      await expect(field(page, label), label).toHaveValue(value)
    }
    await expect(field(page, 'Staat')).toContainText('Deutschland')

    // Leerer Name: Meldung, nichts gespeichert
    await field(page, 'Kundenname').fill('   ')
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Bitte gib einen Kundennamen ein.')).toBeVisible()
    expect((await current(tenant)).name).toBe(name)

    // Optionales Feld leeren (auch nur Leerzeichen = leer), sonst unverändert speichern
    await field(page, 'Kundenname').fill(name)
    await field(page, 'Adresszeile 2').fill('   ')
    await field(page, 'Namenszeile 2').fill('')
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Kundendaten gespeichert.')).toBeVisible()
    const after = await current(tenant)
    expect(after).toMatchObject({ address_line2: null, name_line2: null, city: 'Innsbruck', register_number: 'FN 123456a' })

    // Höchstlängen: Eingabe wird begrenzt
    await field(page, 'Steuernummer').fill('1'.repeat(40))
    await expect(field(page, 'Steuernummer')).toHaveValue('1'.repeat(30))
  })

  test('AC: Nur Name bei neuem Kunden speichern; Felder der neuen Kunden sind leer', async ({ page, users }) => {
    desktopOnly()
    const owner = await users()
    const name = unique('NurName')
    const tenant = await createTenant(name, [{ user: owner, role: 'owner' }])
    expect(await current(tenant)).toMatchObject({ city: null, country: null, vat_id: null, name_line2: null })
    await signInAs(page, owner)
    await page.goto('/einstellungen/stammdaten')
    await ready(page)
    await field(page, 'Kundenname').fill(`${name} neu`)
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Kundendaten gespeichert.')).toBeVisible()
    // Vorbelegtes Österreich wird mitgespeichert, sonst bleibt alles leer
    expect(await current(tenant)).toMatchObject({ name: `${name} neu`, country: 'AT', city: null, vat_id: null })
    await expect(page.getByText(`${name} neu`).first()).toBeVisible()
  })

  test('AC: Mitarbeiter bekommt „Seite nicht gefunden“', async ({ page, users }) => {
    desktopOnly()
    const owner = await users()
    const staff = await users()
    await createTenant(unique('Mitarbeiter'), [{ user: owner, role: 'owner' }, { user: staff, role: 'staff' }])
    await signInAs(page, staff)
    await page.goto('/einstellungen/stammdaten')
    await expect(page.getByRole('heading', { name: 'Seite nicht gefunden' })).toBeVisible()
    await expect(page.getByLabel('UID')).toHaveCount(0)
  })

  test('AC: Keine Verbindung beim Speichern → Meldung, Eingaben bleiben', async ({ page, users }) => {
    desktopOnly()
    const owner = await users()
    const tenant = await createTenant(unique('Offline'), [{ user: owner, role: 'owner' }])
    await signInAs(page, owner)
    await page.goto('/einstellungen/stammdaten')
    await ready(page)
    await field(page, 'Ort').fill('Salzburg')
    await page.context().setOffline(true)
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Keine Verbindung. Bitte prüfe deine Internetverbindung und versuche es erneut.')).toBeVisible()
    await page.context().setOffline(false)
    await expect(field(page, 'Ort')).toHaveValue('Salzburg')
    expect((await current(tenant)).city).toBeNull()
  })

  test('Layout: kein seitliches Scrollen, keine automatisch erkennbaren WCAG-2.1-AA-Verstöße', async ({ page, users }) => {
    const owner = await users()
    await createTenant(unique('Layout'), [{ user: owner, role: 'owner' }])
    await signInAs(page, owner)
    await page.goto('/einstellungen/stammdaten')
    await ready(page)
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    expect(results.violations).toEqual([])
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
})

test.describe('Betreiber', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('AC: Stammdaten oben auf der Detailseite; Änderung inkl. Name gespeichert, im Protokoll und für den Inhaber sichtbar', async ({
    page,
    users,
  }) => {
    desktopOnly()
    const owner = await users()
    const name = unique('Betreiber')
    const tenant = await createTenant(name, [{ user: owner, role: 'owner' }])
    await asAdmin(page, users)
    await page.goto(`/betreiber/kunden/${tenant}`)
    await ready(page)

    await expect(page.getByRole('heading', { level: 2 }).first()).toHaveText('Stammdaten')
    await expect(field(page, 'Kundenname')).toHaveValue(name)
    await field(page, 'Kundenname').fill(`${name} GmbH`)
    await field(page, 'Ort').fill('Innsbruck')
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Kundendaten gespeichert.')).toBeVisible()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(`${name} GmbH`)
    const entry = page.getByRole('listitem').filter({ hasText: 'Stammdaten geändert: Kundenname, Ort' })
    await expect(entry).toBeVisible()
    await expect(entry).toContainText('· Ada Admin')

    // Inhaber sieht den neuen Stand
    const ownerClient = await signedIn(owner)
    const { data } = await ownerClient.from('tenants').select('name, city').eq('id', tenant).single()
    expect(data).toEqual({ name: `${name} GmbH`, city: 'Innsbruck' })
  })

  test('AC: Änderung durch den Inhaber erscheint im Betreiber-Protokoll', async ({ page, users }) => {
    desktopOnly()
    const owner = await users({ displayName: 'Olga Owner' })
    const tenant = await createTenant(unique('ProtokollInhaber'), [{ user: owner, role: 'owner' }])
    const client = await signedIn(owner)
    const { updated_at } = await current(tenant)
    const r = await client.rpc('update_tenant_master_data', {
      p_tenant_id: tenant,
      p_expected_updated_at: updated_at,
      p_data: { name: (await current(tenant)).name, vat_id: 'ATU12345678' },
    })
    expect(r.error).toBeNull()
    await asAdmin(page, users)
    await page.goto(`/betreiber/kunden/${tenant}`)
    const entry = page.getByRole('listitem').filter({ hasText: 'Stammdaten geändert: UID' })
    await expect(entry).toBeVisible()
    await expect(entry).toContainText('· Olga Owner')
  })

  test('AC: Deaktivierter Kunde: Stammdaten nur lesbar, kein Speichern; Änderung wird abgewiesen', async ({ page, users }) => {
    desktopOnly()
    const owner = await users()
    const tenant = await createTenant(unique('Deaktiviert'), [{ user: owner, role: 'owner' }])
    await seed(tenant, { city: 'Innsbruck' })
    const { updated_at } = await current(tenant)
    await service().from('tenants').update({ status: 'deactivated' }).eq('id', tenant)

    await asAdmin(page, users)
    await page.goto(`/betreiber/kunden/${tenant}`)
    await ready(page)
    await expect(page.getByText('Der Kunde ist deaktiviert. Die Stammdaten sind nur lesbar.')).toBeVisible()
    await expect(field(page, 'Ort')).toHaveValue('Innsbruck')
    await expect(field(page, 'Ort')).toBeDisabled()
    await expect(field(page, 'Kundenname')).toBeDisabled()
    await expect(field(page, 'Staat')).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Speichern' })).toHaveCount(0)

    // Inhaber des deaktivierten Kunden: Datenbank weist ab
    const client = await signedIn(owner)
    const r = await client.rpc('update_tenant_master_data', {
      p_tenant_id: tenant,
      p_expected_updated_at: updated_at,
      p_data: { name: 'Trotzdem', city: 'Wien' },
    })
    expect(r.error).not.toBeNull()
    expect((await current(tenant)).city).toBe('Innsbruck')
  })

  test('AC: Übersicht zeigt den Ort unter dem Namen, ohne Ort nichts; Suche nach Ort findet nichts; Anlegen fragt nur Name und E-Mail', async ({
    page,
    users,
  }) => {
    desktopOnly()
    const owner = await users()
    const name = unique('Uebersicht')
    const withCity = await createTenant(`${name} A`, [{ user: owner, role: 'owner' }])
    await createTenant(`${name} B`, [{ user: owner, role: 'owner' }])
    const city = `Ort${randomUUID().slice(0, 6)}`
    await seed(withCity, { city })

    await asAdmin(page, users)
    await page.goto(`/betreiber?q=${encodeURIComponent(name)}`)
    await ready(page)
    const rowA = page.getByRole('row').filter({ hasText: `${name} A` })
    const rowB = page.getByRole('row').filter({ hasText: `${name} B` })
    await expect(rowA.getByRole('cell').first()).toHaveText(`${name} A${city}`)
    await expect(rowB.getByRole('cell').first()).toHaveText(`${name} B`)

    await page.goto(`/betreiber?q=${encodeURIComponent(city)}`)
    await expect(page.getByRole('heading', { name: 'Kein Kunde gefunden' })).toBeVisible()

    await page.goto('/betreiber')
    await ready(page)
    await page.getByRole('button', { name: 'Kunde anlegen' }).first().click()
    const panel = page.getByRole('dialog')
    await expect(panel.getByRole('textbox')).toHaveCount(2)
    await expect(panel.getByLabel('Kundenname')).toBeVisible()
    await expect(panel.getByLabel('E-Mail-Adresse des ersten Inhabers')).toBeVisible()
  })

  test('AC: Gleichzeitig bearbeitet → Hinweis, eigene Eingaben bleiben; „Aktuelle Fassung laden“ zeigt den neuen Stand', async ({
    page,
    users,
  }) => {
    desktopOnly()
    const owner = await users()
    const tenant = await createTenant(unique('Konflikt'), [{ user: owner, role: 'owner' }])
    await asAdmin(page, users)
    await page.goto(`/betreiber/kunden/${tenant}`)
    await ready(page)

    // Inhaber speichert, während der Betreiber das Formular offen hat
    const client = await signedIn(owner)
    const before = await current(tenant)
    const r = await client.rpc('update_tenant_master_data', {
      p_tenant_id: tenant,
      p_expected_updated_at: before.updated_at,
      p_data: { name: before.name, city: 'Graz' },
    })
    expect(r.error).toBeNull()

    await field(page, 'Ort').fill('Linz')
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Die Kundendaten wurden inzwischen geändert.')).toBeVisible()
    await expect(field(page, 'Ort')).toHaveValue('Linz')
    expect((await current(tenant)).city).toBe('Graz')

    await page.getByRole('button', { name: 'Aktuelle Fassung laden' }).click()
    await expect(field(page, 'Ort')).toHaveValue('Graz')
    await expect(page.getByText('Die Kundendaten wurden inzwischen geändert.')).toHaveCount(0)
  })
})

test.describe('Edge Cases', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('Edge: Kunde wird während der Bearbeitung deaktiviert → Betreiber erhält verständliche Meldung', async ({ page, users }) => {
    desktopOnly()
    const owner = await users()
    const tenant = await createTenant(unique('DeaktivBetreiber'), [{ user: owner, role: 'owner' }])
    await asAdmin(page, users)
    await page.goto(`/betreiber/kunden/${tenant}`)
    await ready(page)
    await service().from('tenants').update({ status: 'deactivated' }).eq('id', tenant)
    await field(page, 'Ort').fill('Wien')
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Der Kunde ist deaktiviert. Die Stammdaten lassen sich nicht ändern.')).toBeVisible()
    expect((await current(tenant)).city).toBeNull()
  })

  test('Edge: Kunde wird während der Bearbeitung deaktiviert → Inhaber erhält verständliche Meldung', async ({ page, users }) => {
    desktopOnly()
    const owner = await users()
    const tenant = await createTenant(unique('DeaktivInhaber'), [{ user: owner, role: 'owner' }])
    await signInAs(page, owner)
    await page.goto('/einstellungen/stammdaten')
    await ready(page)
    await service().from('tenants').update({ status: 'deactivated' }).eq('id', tenant)
    await field(page, 'Ort').fill('Wien')
    await page.getByRole('button', { name: 'Speichern' }).click()
    await page.waitForTimeout(1500)
    expect((await current(tenant)).city).toBeNull()
    // Erwartung laut Spec: verständliche Meldung, keine Weiterleitung zur Anmeldung
    await expect(page).toHaveURL(/\/einstellungen\/kunde/)
    await expect(page.getByText('Der Kunde ist deaktiviert. Die Stammdaten lassen sich nicht ändern.')).toBeVisible()
  })

  test('Edge: Inhaber mit zwei Kunden – geöffneter Kunde wird deaktiviert → Meldung, der andere Kunde bleibt unverändert', async ({
    page,
    users,
  }) => {
    desktopOnly()
    const owner = await users()
    const name = unique('Zwei')
    // Kundenauswahl sortiert nach Name: A ist vorausgewählt
    const first = await createTenant(`${name} A`, [{ user: owner, role: 'owner' }])
    const second = await createTenant(`${name} B`, [{ user: owner, role: 'owner' }])
    await signInAs(page, owner)
    await page.goto('/einstellungen/stammdaten')
    await ready(page)
    await expect(field(page, 'Kundenname')).toHaveValue(`${name} A`)
    await service().from('tenants').update({ status: 'deactivated' }).eq('id', first)
    await field(page, 'Ort').fill('Wien')
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Der Kunde ist deaktiviert. Die Stammdaten lassen sich nicht ändern.')).toBeVisible()
    expect((await current(first)).city).toBeNull()
    expect(await current(second)).toMatchObject({ name: `${name} B`, city: null })
  })

  test('Sicherheit: zusätzliche Felder in der Anfrage werden ignoriert; HTML bleibt Text', async ({ page, users }) => {
    desktopOnly()
    const owner = await users()
    const tenant = await createTenant(unique('Angriff'), [{ user: owner, role: 'owner' }])
    const client = await signedIn(owner)
    const before = await current(tenant)
    const r = await client.rpc('update_tenant_master_data', {
      p_tenant_id: tenant,
      p_expected_updated_at: before.updated_at,
      p_data: { name: before.name, city: '<img src=x onerror=alert(1)>', status: 'deactivated', id: randomUUID(), created_by: owner.id },
    })
    expect(r.error).toBeNull()
    const after = await current(tenant)
    expect(after).toMatchObject({ id: tenant, status: 'active', created_by: before.created_by })

    await signInAs(page, owner)
    let dialog = false
    page.on('dialog', () => (dialog = true))
    await page.goto('/einstellungen/stammdaten')
    await ready(page)
    await expect(field(page, 'Ort')).toHaveValue('<img src=x onerror=alert(1)>')
    expect(dialog).toBe(false)
  })
})
