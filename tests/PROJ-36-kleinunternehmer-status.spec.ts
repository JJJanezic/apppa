import { randomUUID } from 'node:crypto'

import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test as base } from '@playwright/test'

import type { Json } from '../src/types/database'

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

// PROJ-36: Kleinunternehmer-Status. Datenbank-Regeln direkt gegen die Speicherfunktion, dazu die Abläufe im Formular.
// Abläufe nur im Projekt „desktop“, Layout auch am Handy.

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
const unique = (label: string) => `QA36 ${label} ${randomUUID().slice(0, 8)}`
const ready = (page: Page) =>
  page.waitForFunction(() => Object.keys(document.querySelector('main') ?? {}).some((k) => k.startsWith('__reactFiber')))

async function signedIn(user: E2EUser) {
  const client = anon()
  await client.auth.signInWithPassword({ email: user.email, password: user.password })
  return client
}

async function tenantRow(tenantId: string) {
  const { data } = await service().from('tenants').select('*').eq('id', tenantId).single()
  return data!
}

// Stammdaten wie gespeichert + gewünschter Verlauf (Speicherfunktion erwartet immer alle Felder)
async function payload(tenantId: string, vatStatus?: { valid_from: string; small_business: boolean }[]) {
  const t = await tenantRow(tenantId)
  return {
    p_tenant_id: tenantId,
    p_expected_updated_at: t.updated_at,
    p_data: {
      name: t.name,
      name_line2: t.name_line2,
      address_line1: t.address_line1,
      address_line2: t.address_line2,
      postal_code: t.postal_code,
      city: t.city,
      country: t.country,
      vat_id: t.vat_id,
      tax_number: t.tax_number,
      register_number: t.register_number,
      ...(vatStatus ? { vat_status: vatStatus } : {}),
    },
  }
}

async function history(tenantId: string) {
  const { data } = await service()
    .from('vat_status_changes')
    .select('valid_from, small_business')
    .eq('tenant_id', tenantId)
    .order('valid_from')
  return data ?? []
}

async function logFields(tenantId: string) {
  const { data } = await service().from('operator_log').select('changed_fields').eq('tenant_id', tenantId).order('created_at')
  return (data ?? []).map((r) => r.changed_fields)
}

const TWO = [
  { valid_from: '2026-08-15', small_business: false },
  { valid_from: '2026-01-01', small_business: true },
]

test.describe('Speicherfunktion (Datenbank)', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('Verlauf speichern, ersetzen, entfernen; Protokoll „vat_status“; ohne Änderung kein Eintrag; ohne Schlüssel bleibt er', async ({
    users,
  }) => {
    desktopOnly()
    const owner = await users()
    const tenant = await createTenant(unique('Verlauf'), [{ user: owner, role: 'owner' }])
    const client = await signedIn(owner)

    expect(await history(tenant)).toEqual([])
    const first = await client.rpc('update_tenant_master_data', await payload(tenant, TWO))
    expect(first.error).toBeNull()
    expect(await history(tenant)).toEqual([
      { valid_from: '2026-01-01', small_business: true },
      { valid_from: '2026-08-15', small_business: false },
    ])
    expect(await logFields(tenant)).toEqual([['vat_status']])

    // Gleicher Verlauf in anderer Reihenfolge: keine Änderung, kein Eintrag
    const same = await client.rpc('update_tenant_master_data', await payload(tenant, [...TWO].reverse()))
    expect(same.error).toBeNull()
    expect(await logFields(tenant)).toHaveLength(1)

    // Ohne Schlüssel (älterer Stand des Formulars): Verlauf bleibt
    const without = await client.rpc('update_tenant_master_data', await payload(tenant))
    expect(without.error).toBeNull()
    expect(await history(tenant)).toHaveLength(2)

    // Einen Eintrag ändern, einen entfernen
    const changed = await client.rpc(
      'update_tenant_master_data',
      await payload(tenant, [{ valid_from: '2026-02-01', small_business: true }])
    )
    expect(changed.error).toBeNull()
    expect(await history(tenant)).toEqual([{ valid_from: '2026-02-01', small_business: true }])

    // Alles entfernen
    const cleared = await client.rpc('update_tenant_master_data', await payload(tenant, []))
    expect(cleared.error).toBeNull()
    expect(await history(tenant)).toEqual([])
    expect(await logFields(tenant)).toHaveLength(3)
  })

  test('Reine Verlaufsänderung setzt „zuletzt geändert am“: alter Stand → P0017', async ({ users }) => {
    desktopOnly()
    const owner = await users()
    const tenant = await createTenant(unique('Konflikt'), [{ user: owner, role: 'owner' }])
    const client = await signedIn(owner)
    const before = await payload(tenant, TWO)

    expect((await client.rpc('update_tenant_master_data', before)).error).toBeNull()
    expect((await tenantRow(tenant)).updated_at).not.toBe(before.p_expected_updated_at)

    const stale = await client.rpc('update_tenant_master_data', { ...before, p_data: { ...before.p_data, vat_status: [] } })
    expect(stale.error?.code).toBe('P0017')
    expect(await history(tenant)).toHaveLength(2)
  })

  test('Prüfregeln: doppeltes Datum 23505, ungültige Einträge 22023, Datum außerhalb 2000–2100 23514; nichts gespeichert', async ({
    users,
  }) => {
    desktopOnly()
    const owner = await users()
    const tenant = await createTenant(unique('Pruefung'), [{ user: owner, role: 'owner' }])
    const client = await signedIn(owner)
    const save = async (vat: Json) => {
      const p = await payload(tenant)
      return client.rpc('update_tenant_master_data', { ...p, p_data: { ...p.p_data, vat_status: vat } })
    }

    const dup = await save([
      { valid_from: '2026-07-01', small_business: true },
      { valid_from: '2026-07-01', small_business: false },
    ])
    expect(dup.error?.code).toBe('23505')

    for (const bad of [
      { not: 'an array' },
      [{ valid_from: '2026-07-01' }],
      [{ valid_from: '2026-07-01', small_business: 'yes' }],
      [{ valid_from: '01.07.2026', small_business: true }],
      Array.from({ length: 51 }, (_, i) => ({ valid_from: `2026-01-${String((i % 28) + 1).padStart(2, '0')}`, small_business: true })),
    ]) {
      expect((await save(bad)).error?.code).toBe('22023')
    }
    expect((await save([{ valid_from: '1999-12-31', small_business: true }])).error?.code).toBe('23514')
    expect(await history(tenant)).toEqual([])
    expect(await logFields(tenant)).toEqual([])
  })

  test('Sicherheit: Mitarbeiter und fremde Inhaber lesen und ändern nicht; niemand schreibt direkt', async ({ users }) => {
    desktopOnly()
    const owner = await users()
    const staff = await users()
    const stranger = await users()
    const tenant = await createTenant(unique('Rechte'), [{ user: owner, role: 'owner' }, { user: staff, role: 'staff' }])
    await createTenant(unique('Fremd'), [{ user: stranger, role: 'owner' }])
    const ownerClient = await signedIn(owner)
    expect((await ownerClient.rpc('update_tenant_master_data', await payload(tenant, TWO))).error).toBeNull()

    // Inhaber liest den Verlauf
    const own = await ownerClient.from('vat_status_changes').select('valid_from').eq('tenant_id', tenant)
    expect(own.data).toHaveLength(2)

    for (const user of [staff, stranger]) {
      const client = await signedIn(user)
      const read = await client.from('vat_status_changes').select('valid_from').eq('tenant_id', tenant)
      expect(read.data ?? []).toHaveLength(0)
      const write = await client.rpc('update_tenant_master_data', await payload(tenant, []))
      expect(write.error?.code).toBe('42501')
    }

    // Direktes Schreiben ist für alle gesperrt, auch für den Inhaber
    const insert = await ownerClient.from('vat_status_changes').insert({ tenant_id: tenant, valid_from: '2027-01-01', small_business: false })
    expect(insert.error?.code).toBe('42501')
    const del = await ownerClient.from('vat_status_changes').delete().eq('tenant_id', tenant).select('id')
    expect(del.error?.code).toBe('42501')
    expect(await history(tenant)).toHaveLength(2)
  })
})

test.describe('Formular', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('AC: Inhaber ohne Einträge, fügt Wechsel hinzu, doppeltes Datum wird gemeldet, gespeichert und sortiert', async ({ page, users }) => {
    desktopOnly()
    const owner = await users()
    const tenant = await createTenant(unique('Formular'), [{ user: owner, role: 'owner' }])
    await signInAs(page, owner)
    await page.goto('/einstellungen/kunde')
    await ready(page)

    await expect(page.getByRole('heading', { name: 'Umsatzsteuer' })).toBeVisible()
    await expect(page.getByText('Aktuell: mit Umsatzsteuer', { exact: true })).toBeVisible()
    await expect(page.getByText('Noch kein Wechsel erfasst')).toBeVisible()

    // Erster Wechsel: Vorbelegung Kleinunternehmer
    await page.getByRole('button', { name: 'Wechsel hinzufügen' }).click()
    const list = page.getByRole('list', { name: 'Wechsel des Umsatzsteuer-Status' })
    await expect(list.getByRole('combobox', { name: 'Status' })).toContainText('Kleinunternehmer – keine Umsatzsteuer')
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Bitte gib das Datum ein, ab dem der Status gilt.')).toBeVisible()
    await list.getByLabel('ab', { exact: true }).fill('2026-01-01')

    // Zweiter Wechsel mit gleichem Datum → Meldung
    await page.getByRole('button', { name: 'Wechsel hinzufügen' }).click()
    await list.getByLabel('ab', { exact: true }).first().fill('2026-01-01')
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Für dieses Datum gibt es bereits einen Eintrag.')).toBeVisible()

    // Künftiges Datum → „geplant“; Status „mit Umsatzsteuer“
    await list.getByLabel('ab', { exact: true }).first().fill('2099-01-01')
    await expect(list.getByText('geplant')).toBeVisible()
    await list.getByRole('combobox', { name: 'Status' }).first().click()
    await page.getByRole('option', { name: 'mit Umsatzsteuer' }).click()
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Kundendaten gespeichert.')).toBeVisible()
    expect(await history(tenant)).toEqual([
      { valid_from: '2026-01-01', small_business: true },
      { valid_from: '2099-01-01', small_business: false },
    ])

    await page.reload()
    await ready(page)
    await expect(page.getByText('Aktuell: Kleinunternehmer – keine Umsatzsteuer, seit Do, 01.01.2026')).toBeVisible()
    const dates = list.getByLabel('ab', { exact: true })
    await expect(dates).toHaveCount(2)
    await expect(dates.nth(0)).toHaveValue('2099-01-01')
    await expect(dates.nth(1)).toHaveValue('2026-01-01')

    // Entfernen und speichern
    await list.getByRole('button', { name: 'Wechsel ab Do, 01.01.2099 entfernen' }).click()
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Kundendaten gespeichert.')).toBeVisible()
    await page.reload()
    await ready(page)
    await expect(list.getByLabel('ab', { exact: true })).toHaveCount(1)
  })

  test('AC: Betreiber bearbeitet den Verlauf; Protokoll „Umsatzsteuer-Status“; deaktivierter Kunde nur lesbar', async ({ page, users }) => {
    desktopOnly()
    const owner = await users()
    const tenant = await createTenant(unique('Betreiber'), [{ user: owner, role: 'owner' }])
    const admin = await users({ displayName: 'Ada Admin', admin: true })
    await signInAsAdmin(page, admin)
    await page.goto(`/betreiber/kunden/${tenant}`)
    await ready(page)

    await page.getByRole('button', { name: 'Wechsel hinzufügen' }).click()
    const list = page.getByRole('list', { name: 'Wechsel des Umsatzsteuer-Status' })
    await list.getByLabel('ab', { exact: true }).fill('2026-03-01')
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Kundendaten gespeichert.')).toBeVisible()
    // Staat war leer und ist im Formular mit Österreich vorbelegt → wird mitgespeichert
    await expect(page.getByRole('listitem').filter({ hasText: 'Stammdaten geändert: Staat, Umsatzsteuer-Status' })).toBeVisible()
    expect(await history(tenant)).toEqual([{ valid_from: '2026-03-01', small_business: true }])

    const { error } = await service().from('tenants').update({ status: 'deactivated' }).eq('id', tenant)
    expect(error).toBeNull()
    await page.reload()
    await ready(page)
    await expect(list.getByLabel('ab', { exact: true })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Wechsel hinzufügen' })).toHaveCount(0)
    await expect(list.getByRole('button', { name: /entfernen/ })).toHaveCount(0)
  })

  test('Layout: kein seitliches Scrollen, keine automatisch erkennbaren WCAG-2.1-AA-Verstöße', async ({ page, users }) => {
    const owner = await users()
    const tenant = await createTenant(unique('Layout'), [{ user: owner, role: 'owner' }])
    const client = await signedIn(owner)
    expect((await client.rpc('update_tenant_master_data', await payload(tenant, TWO))).error).toBeNull()
    await signInAs(page, owner)
    await page.goto('/einstellungen/kunde')
    await ready(page)
    await expect(page.getByRole('heading', { name: 'Umsatzsteuer' })).toBeVisible()

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    expect(results.violations).toEqual([])
  })
})
