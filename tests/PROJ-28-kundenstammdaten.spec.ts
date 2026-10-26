import { randomUUID } from 'node:crypto'

import { expect, type Page, test as base } from '@playwright/test'

import { anon, createTenant, createUser, deleteUser, type E2EUser, hasSupabaseEnv, service, signInAs } from './support/supabase'

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

test.describe('Einstellungen → Kunde', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('AC: Inhaber füllt Stammdaten aus, UID wird bereinigt, Staat ist mit Österreich vorbelegt', async ({ page, users }) => {
    desktopOnly()
    const owner = await users()
    const name = unique('Formular')
    await createTenant(name, [{ user: owner, role: 'owner' }])
    await signInAs(page, owner)
    await page.goto('/einstellungen/kunde')
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
