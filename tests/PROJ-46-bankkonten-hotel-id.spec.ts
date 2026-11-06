import { randomUUID } from 'node:crypto'

import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test as base } from '@playwright/test'

import { anon, createTenant, createUser, deleteUser, type E2EUser, hasSupabaseEnv, service, signInAs } from './support/supabase'

// PROJ-46: Bankkonten und booking.com Hotel-ID. Datenbank-Regeln direkt gegen Speicherfunktion und Wohnungstabelle,
// dazu die Abläufe in Stammdaten und Wohnungs-Fenster. Abläufe im Desktop-Projekt, Layout auch auf Tablet und Handy.

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

const desktopOnly = () => test.skip(['tablet', 'mobile'].includes(test.info().project.name), 'Abläufe nur im Desktop-Projekt')
const unique = (label: string) => `QA46 ${label} ${randomUUID().slice(0, 8)}`
const ready = (page: Page) =>
  page.waitForFunction(() => Object.keys(document.querySelector('main') ?? {}).some((k) => k.startsWith('__reactFiber')))

const AT = 'AT611904300234573201'
const DE = 'DE89370400440532013000'
const AT2 = 'AT483200000012345864'

type Account = {
  id: string
  label?: string | null
  account_holder?: string
  iban: string
  bic?: string | null
  bank_name?: string | null
  note?: string | null
  is_primary: boolean
  archived?: boolean
}

const acc = (iban: string, primary: boolean, over: Partial<Account> = {}): Account => ({
  id: randomUUID(),
  label: null,
  account_holder: 'Pichler Ferienwohnungen',
  iban,
  bic: null,
  bank_name: null,
  note: null,
  is_primary: primary,
  archived: false,
  ...over,
})

async function signedIn(user: E2EUser) {
  const client = anon()
  await client.auth.signInWithPassword({ email: user.email, password: user.password })
  return client
}

// Stammdaten wie gespeichert + gewünschte Konten (Speicherfunktion erwartet immer alle Felder)
async function payload(tenantId: string, accounts?: Account[]) {
  const { data: t } = await service().from('tenants').select('*').eq('id', tenantId).single()
  return {
    p_tenant_id: tenantId,
    p_expected_updated_at: t!.updated_at,
    p_data: {
      name: t!.name,
      name_line2: t!.name_line2,
      address_line1: t!.address_line1,
      address_line2: t!.address_line2,
      postal_code: t!.postal_code,
      city: t!.city,
      country: t!.country,
      vat_id: t!.vat_id,
      tax_number: t!.tax_number,
      register_number: t!.register_number,
      ...(accounts ? { bank_accounts: accounts } : {}),
    },
  }
}

async function accounts(tenantId: string) {
  const { data } = await service()
    .from('bank_accounts')
    .select('id, iban, is_primary, archived_at, position, label')
    .eq('tenant_id', tenantId)
    .order('position')
  return data ?? []
}

async function logFields(tenantId: string) {
  const { data } = await service().from('operator_log').select('changed_fields').eq('tenant_id', tenantId).order('created_at')
  return (data ?? []).map((r) => r.changed_fields)
}

async function apartment(tenantId: string, name = 'Top 1') {
  const { data: property, error } = await service()
    .from('properties')
    .insert({ tenant_id: tenantId, name: 'Haus See', street: 'Seeweg 12', postal_code: '5340', city: 'St. Gilgen', municipality_code: '50330' })
    .select('id')
    .single()
  if (error) throw error
  const { data, error: aptError } = await service()
    .from('apartments')
    .insert({ tenant_id: tenantId, property_id: property.id, name, max_guests: 4 })
    .select('id')
    .single()
  if (aptError) throw aptError
  return data.id
}

async function apartmentAccount(id: string) {
  const { data } = await service().from('apartments').select('bank_account_id').eq('id', id).single()
  return data!.bank_account_id
}

test.describe('Speicherfunktion (Datenbank)', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('Konten anlegen, unverändert speichern, ohne Schlüssel unverändert; Protokoll „bank_accounts“; Position nach Anlage', async ({
    users,
  }) => {
    desktopOnly()
    const owner = await users()
    const tenant = await createTenant(unique('Anlegen'), [{ user: owner, role: 'owner' }])
    const client = await signedIn(owner)
    const a = acc(' at61 1904 3002 3457 3201 ', true, { label: '  Geschäftskonto ', bic: 'rzba atww' })
    const b = acc(DE, false)

    expect((await client.rpc('update_tenant_master_data', await payload(tenant, [a, b]))).error).toBeNull()
    const saved = await accounts(tenant)
    expect(saved.map((r) => [r.iban, r.is_primary, r.position, r.label])).toEqual([
      [AT, true, 0, 'Geschäftskonto'],
      [DE, false, 1, null],
    ])
    expect(await logFields(tenant)).toEqual([['bank_accounts']])

    // gleiche Konten in anderer Reihenfolge: keine Änderung, kein Eintrag
    expect((await client.rpc('update_tenant_master_data', await payload(tenant, [b, { ...a, iban: AT }]))).error).toBeNull()
    expect(await logFields(tenant)).toHaveLength(1)
    // ohne Schlüssel bleiben die Konten
    expect((await client.rpc('update_tenant_master_data', await payload(tenant))).error).toBeNull()
    expect(await accounts(tenant)).toHaveLength(2)

    // neues Konto kommt hinten dazu, auch wenn es vorne in der Liste steht
    const c = acc(AT2, false)
    expect((await client.rpc('update_tenant_master_data', await payload(tenant, [c, b, { ...a, iban: AT }]))).error).toBeNull()
    expect((await accounts(tenant)).map((r) => [r.iban, r.position])).toEqual([
      [AT, 0],
      [DE, 1],
      [AT2, 2],
    ])
  })

  test('Primär wechseln und altes archivieren in einem Schritt; Wohnungen des archivierten Kontos auf „Primäres Konto“; Zeitpunkt bleibt', async ({
    users,
  }) => {
    desktopOnly()
    const owner = await users()
    const tenant = await createTenant(unique('Archiv'), [{ user: owner, role: 'owner' }])
    const client = await signedIn(owner)
    const a = acc(AT, true)
    const b = acc(DE, false)
    expect((await client.rpc('update_tenant_master_data', await payload(tenant, [a, b]))).error).toBeNull()
    const apt = await apartment(tenant)
    expect((await client.from('apartments').update({ bank_account_id: a.id }).eq('id', apt).select('id')).data).toHaveLength(1)
    expect(await apartmentAccount(apt)).toBe(a.id)

    const step = await client.rpc(
      'update_tenant_master_data',
      await payload(tenant, [{ ...a, is_primary: false, archived: true }, { ...b, is_primary: true }])
    )
    expect(step.error).toBeNull()
    const saved = await accounts(tenant)
    expect(saved.find((r) => r.id === a.id)).toMatchObject({ is_primary: false })
    expect(saved.find((r) => r.id === a.id)?.archived_at).not.toBeNull()
    expect(saved.find((r) => r.id === b.id)).toMatchObject({ is_primary: true, archived_at: null })
    expect(await apartmentAccount(apt)).toBeNull()

    // erneut speichern (andere Bezeichnung): Archivierungszeitpunkt bleibt
    const archivedAt = saved.find((r) => r.id === a.id)?.archived_at
    expect(
      (
        await client.rpc(
          'update_tenant_master_data',
          await payload(tenant, [{ ...a, is_primary: false, archived: true, label: 'Alt' }, { ...b, is_primary: true }])
        )
      ).error
    ).toBeNull()
    expect((await accounts(tenant)).find((r) => r.id === a.id)?.archived_at).toBe(archivedAt)

    // Wiederherstellen: wieder aktiv, Zuordnung kommt nicht zurück
    expect(
      (await client.rpc('update_tenant_master_data', await payload(tenant, [{ ...a, is_primary: false }, { ...b, is_primary: true }]))).error
    ).toBeNull()
    expect((await accounts(tenant)).find((r) => r.id === a.id)?.archived_at).toBeNull()
    expect(await apartmentAccount(apt)).toBeNull()
  })

  test('Löschen: ohne Zuordnung möglich, bei Zuordnung 23503 und nichts geändert', async ({ users }) => {
    desktopOnly()
    const owner = await users()
    const tenant = await createTenant(unique('Loeschen'), [{ user: owner, role: 'owner' }])
    const client = await signedIn(owner)
    const a = acc(AT, true)
    const b = acc(DE, false)
    const c = acc(AT2, false)
    expect((await client.rpc('update_tenant_master_data', await payload(tenant, [a, b, c]))).error).toBeNull()
    const apt = await apartment(tenant)
    expect((await client.from('apartments').update({ bank_account_id: b.id }).eq('id', apt).select('id')).error).toBeNull()

    const blocked = await client.rpc('update_tenant_master_data', await payload(tenant, [a, c]))
    expect(blocked.error?.code).toBe('23503')
    expect(await accounts(tenant)).toHaveLength(3)

    expect((await client.rpc('update_tenant_master_data', await payload(tenant, [a, b]))).error).toBeNull()
    expect((await accounts(tenant)).map((r) => r.iban)).toEqual([AT, DE])
  })

  test('Prüfregeln: doppelte IBAN 23505, falsche Prüfziffer 23514, Primär-Regeln P0019, ungültige Liste 22023', async ({ users }) => {
    desktopOnly()
    const owner = await users()
    const other = await users()
    const tenant = await createTenant(unique('Regeln'), [{ user: owner, role: 'owner' }])
    const foreign = await createTenant(unique('Fremd'), [{ user: other, role: 'owner' }])
    const client = await signedIn(owner)
    const rpc = async (list: Account[]) => (await client.rpc('update_tenant_master_data', await payload(tenant, list))).error

    const dup = await rpc([acc(AT, true), acc(AT, false, { archived: true })])
    expect(dup?.code).toBe('23505')
    expect(dup?.message).toContain('bank_accounts')
    expect((await rpc([acc('AT621904300234573201', true)]))?.code).toBe('23514')
    expect((await rpc([acc(AT, false)]))?.code).toBe('P0019')
    expect((await rpc([acc(AT, true), acc(DE, true)]))?.code).toBe('P0019')
    expect((await rpc([acc(AT, true, { archived: true })]))?.code).toBe('P0019')
    expect((await rpc([{ ...acc(AT, true), id: 'kein-uuid' }]))?.code).toBe('22023')
    const many = Array.from({ length: 21 }, (_, i) => acc(AT, i === 0))
    expect((await rpc(many))?.code).toBe('22023')

    // Kennung eines Kontos eines anderen Kunden
    const otherClient = await signedIn(other)
    const theirs = acc(DE, true)
    expect((await otherClient.rpc('update_tenant_master_data', await payload(foreign, [theirs]))).error).toBeNull()
    expect((await rpc([{ ...theirs, iban: AT }]))?.code).toBe('22023')
    expect(await accounts(tenant)).toEqual([])
    expect((await accounts(foreign)).map((r) => r.iban)).toEqual([DE])
  })

  test('Konfliktschutz: reine Kontenänderung setzt „zuletzt geändert am“, ein veralteter Stand wird abgelehnt (P0017)', async ({ users }) => {
    desktopOnly()
    const owner = await users()
    const tenant = await createTenant(unique('Konflikt'), [{ user: owner, role: 'owner' }])
    const client = await signedIn(owner)
    const stale = await payload(tenant)
    expect((await client.rpc('update_tenant_master_data', await payload(tenant, [acc(AT, true)]))).error).toBeNull()
    const second = await client.rpc('update_tenant_master_data', { ...stale, p_data: { ...stale.p_data, bank_accounts: [acc(DE, true)] } })
    expect(second.error?.code).toBe('P0017')
  })
})

test.describe('Sicherheit und Wohnung (Datenbank)', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('Mitarbeiter und fremde Inhaber lesen und ändern keine Konten; direktes Schreiben gesperrt', async ({ users }) => {
    desktopOnly()
    const owner = await users()
    const staff = await users()
    const stranger = await users()
    const tenant = await createTenant(unique('Rechte'), [
      { user: owner, role: 'owner' },
      { user: staff, role: 'staff' },
    ])
    await createTenant(unique('Andere'), [{ user: stranger, role: 'owner' }])
    const ownerClient = await signedIn(owner)
    expect((await ownerClient.rpc('update_tenant_master_data', await payload(tenant, [acc(AT, true)]))).error).toBeNull()

    for (const user of [staff, stranger]) {
      const client = await signedIn(user)
      expect((await client.from('bank_accounts').select('id').eq('tenant_id', tenant)).data).toEqual([])
      expect((await client.rpc('update_tenant_master_data', await payload(tenant, [acc(DE, true)]))).error?.code).toBe('42501')
    }
    const direct = await ownerClient
      .from('bank_accounts')
      .insert({ tenant_id: tenant, account_holder: 'X', iban: DE, position: 5 })
    expect(direct.error?.code).toBe('42501')
    expect((await accounts(tenant)).map((r) => r.iban)).toEqual([AT])
  })

  test('Wohnung: eigenes aktives Konto ja; archiviertes oder fremdes Konto P0020; Hotel-ID-Regel; Mitarbeiter ändert nichts', async ({
    users,
  }) => {
    desktopOnly()
    const owner = await users()
    const staff = await users()
    const other = await users()
    const tenant = await createTenant(unique('Wohnung'), [
      { user: owner, role: 'owner' },
      { user: staff, role: 'staff' },
    ])
    const foreign = await createTenant(unique('Fremdkunde'), [{ user: other, role: 'owner' }])
    const client = await signedIn(owner)
    const a = acc(AT, true)
    const b = acc(DE, false, { archived: true })
    expect((await client.rpc('update_tenant_master_data', await payload(tenant, [a, b]))).error).toBeNull()
    const theirs = acc(AT2, true)
    expect((await (await signedIn(other)).rpc('update_tenant_master_data', await payload(foreign, [theirs]))).error).toBeNull()
    const apt = await apartment(tenant)

    const ok = await client.from('apartments').update({ bank_account_id: a.id, booking_hotel_id: 'AB-12345x' }).eq('id', apt).select('id')
    expect(ok.error).toBeNull()
    expect((await client.from('apartments').update({ bank_account_id: b.id }).eq('id', apt)).error?.code).toBe('P0020')
    expect((await client.from('apartments').update({ bank_account_id: theirs.id }).eq('id', apt)).error?.code).toBe('P0020')
    expect((await client.from('apartments').update({ booking_hotel_id: '123/45' }).eq('id', apt)).error?.code).toBe('23514')
    expect((await client.from('apartments').update({ booking_hotel_id: 'a'.repeat(31) }).eq('id', apt)).error?.code).toBe('23514')

    // gleiche Hotel-ID bei zweiter Wohnung erlaubt
    const { data: second } = await service().from('apartments').select('property_id').eq('id', apt).single()
    const insert = await client
      .from('apartments')
      .insert({ tenant_id: tenant, property_id: second!.property_id, name: 'Top 2', max_guests: 2, booking_hotel_id: 'AB-12345x' })
    expect(insert.error).toBeNull()

    // Mitarbeiter: Update trifft keine Zeile (nur Inhaber ändern Wohnungen)
    const staffClient = await signedIn(staff)
    const staffUpdate = await staffClient.from('apartments').update({ bank_account_id: null, booking_hotel_id: '999' }).eq('id', apt).select('id')
    expect(staffUpdate.data ?? []).toEqual([])
    const { data: row } = await service().from('apartments').select('bank_account_id, booking_hotel_id').eq('id', apt).single()
    expect(row).toEqual({ bank_account_id: a.id, booking_hotel_id: 'AB-12345x' })
  })
})

test.describe('Oberfläche', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('AC: Inhaber erfasst Konten, Prüfziffer-Meldung, erstes Konto primär; Wohnung folgt dem primären Konto', async ({ page, users }) => {
    desktopOnly()
    const owner = await users()
    const tenant = await createTenant(unique('Formular'), [{ user: owner, role: 'owner' }])
    await apartment(tenant)
    await signInAs(page, owner)

    // Wohnung ohne Konten: Auswahl gesperrt, Link zu den Stammdaten
    await page.goto('/einstellungen/wohnungen')
    await ready(page)
    await page.getByRole('button', { name: /Top 1/ }).first().click()
    await expect(page.getByRole('combobox', { name: 'Bankkonto' })).toBeDisabled()
    await expect(page.getByRole('link', { name: 'Einstellungen → Stammdaten' })).toBeVisible()

    await page.goto('/einstellungen/stammdaten')
    await ready(page)
    await expect(page.getByText('Noch kein Bankkonto erfasst.', { exact: false })).toBeVisible()
    await page.getByRole('button', { name: 'Bankkonto hinzufügen' }).click()
    const list = page.getByRole('list', { name: 'Bankkonten des Kunden' })
    await expect(list.getByLabel('Kontoinhaber')).toHaveValue(/QA46 Formular/)
    await list.getByLabel('IBAN').fill('AT62 1904 3002 3457 3201')
    await page.getByRole('button', { name: 'Speichern', exact: true }).click()
    await expect(list.getByText('Die Prüfziffer stimmt nicht', { exact: false })).toBeVisible()

    await list.getByLabel('IBAN').fill('at61 1904 3002 3457 3201')
    await list.getByLabel('Bezeichnung').fill('Geschäftskonto')
    await page.getByRole('button', { name: 'Speichern', exact: true }).click()
    await expect(page.getByText('Kundendaten gespeichert.')).toBeVisible()
    await page.reload()
    await ready(page)
    const card = page.getByRole('list', { name: 'Bankkonten des Kunden' }).getByRole('listitem').first()
    await expect(card).toContainText('Geschäftskonto')
    await expect(card).toContainText('Primär')
    await expect(card).toContainText('AT61 1904 3002 3457 3201')

    // Wohnung zeigt „Primäres Konto (…)“
    await page.goto('/einstellungen/wohnungen')
    await ready(page)
    await page.getByRole('button', { name: /Top 1/ }).first().click()
    await expect(page.getByRole('combobox', { name: 'Bankkonto' })).toContainText('Primäres Konto (AT61 1904 … 3201)')
  })

  test('Layout: kein seitliches Scrollen, keine automatisch erkennbaren WCAG-2.1-AA-Verstöße', async ({ page, users }) => {
    const owner = await users()
    const tenant = await createTenant(unique('Layout'), [{ user: owner, role: 'owner' }])
    const client = await signedIn(owner)
    expect(
      (
        await client.rpc(
          'update_tenant_master_data',
          await payload(tenant, [acc(AT, true, { label: 'Geschäftskonto Raiffeisen Salzkammergut' }), acc(DE, false, { archived: true })])
        )
      ).error
    ).toBeNull()
    await signInAs(page, owner)
    await page.goto('/einstellungen/stammdaten')
    await ready(page)
    await expect(page.getByRole('heading', { name: 'Bankkonten' })).toBeVisible()

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    expect(results.violations).toEqual([])
  })
})
