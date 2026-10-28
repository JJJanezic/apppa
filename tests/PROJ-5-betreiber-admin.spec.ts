import { randomUUID } from 'node:crypto'

import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test as base } from '@playwright/test'

import {
  createInvitation,
  createTenant,
  createUser,
  deleteUser,
  type E2EUser,
  hasSupabaseEnv,
  membershipRole,
  service,
  signInAs,
  signInAsAdmin,
} from './support/supabase'

// PROJ-5: Betreiber-Admin. Abläufe nur im Projekt „desktop“, Layout und Barrierefreiheit in allen Breiten.
// Es werden keine Mails verschickt: Einladungen nur an bestehende Testkonten (Brevo im Test abgeschaltet,
// playwright.config.ts) bzw. direkt angelegt.

type Fixtures = {
  users: (opts?: Parameters<typeof createUser>[0]) => Promise<E2EUser>
  // Kundennamen, die im Test über die Oberfläche entstehen; werden danach entfernt
  tenantNames: string[]
}

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
  tenantNames: async ({}, use) => {
    const names: string[] = []
    await use(names)
    if (names.length) await service().from('tenants').delete().in('name', names)
  },
})

test.use({ storageState: { cookies: [], origins: [] } })

const desktopOnly = () => test.skip(test.info().project.name !== 'desktop', 'Abläufe nur im Desktop-Projekt')
const unique = (label: string) => `QA5 ${label} ${randomUUID().slice(0, 8)}`
const ready = (page: Page) =>
  page.waitForFunction(() => Object.keys(document.querySelector('main') ?? {}).some((k) => k.startsWith('__reactFiber')))

async function asAdmin(page: Page, users: Fixtures['users']) {
  const admin = await users({ displayName: 'Ada Admin', admin: true })
  await signInAsAdmin(page, admin)
  return admin
}

async function openTenant(page: Page, tenantId: string) {
  await page.goto(`/betreiber/kunden/${tenantId}`)
  await ready(page)
}

async function memberAction(page: Page, name: string, action: string) {
  await page.getByRole('button', { name: `Aktionen für ${name}` }).first().click()
  await page.getByRole('menuitem', { name: action }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: action }).click()
}

test.describe('Zugang zum Betreiber-Bereich', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('AC: Inhaber, Mitarbeiter und Personen ohne Kunde bekommen „Seite nicht gefunden“, ohne Menüpunkt', async ({ page, users }) => {
    desktopOnly()
    const owner = await users()
    await createTenant('QA5 Zugang', [{ user: owner, role: 'owner' }])
    await signInAs(page, owner)
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Betreiber' })).toHaveCount(0)
    for (const path of ['/betreiber', '/betreiber/kunden/00000000-0000-0000-0000-000000000000']) {
      const response = await page.goto(path)
      expect(response?.status()).toBe(404)
    }
  })

  test('AC: Admin ohne 2FA-bestätigte Sitzung wird zur Code-Abfrage geleitet', async ({ page, users }) => {
    desktopOnly()
    const admin = await users({ admin: true })
    // Gerät einrichten (eigene Sitzung), danach normale Anmeldung ohne Code (aal1)
    const other = await page.context().browser()!.newContext()
    await signInAsAdmin(await other.newPage(), admin)
    await other.close()
    await signInAs(page, admin)
    await page.goto('/betreiber')
    await expect(page).toHaveURL('/2fa')
  })

  test('AC: Admin ohne eigenen Kunden startet im Betreiber-Bereich; Menüpunkt und Rolle „Betreiber“', async ({ page, users }) => {
    desktopOnly()
    await asAdmin(page, users)
    await page.goto('/')
    await expect(page).toHaveURL('/betreiber')
    await expect(page.getByRole('heading', { name: 'Kunden', level: 1 })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Betreiber' })).toHaveAttribute('aria-current', 'page')
    await expect(page.getByRole('button', { name: /Benutzermenü: Ada Admin · Betreiber/ })).toBeVisible()
  })

  test('AC: Admin mit eigenem Kunden landet im Dashboard und erreicht den Betreiber-Bereich über das Menü', async ({ page, users }) => {
    desktopOnly()
    const admin = await users({ displayName: 'Ada Admin', admin: true })
    await createTenant('QA5 Eigener Testkunde', [{ user: admin, role: 'owner' }])
    await signInAsAdmin(page, admin)
    await page.goto('/')
    await expect(page).toHaveURL('/')
    await page.getByRole('link', { name: 'Betreiber' }).click()
    await expect(page).toHaveURL('/betreiber')
  })

  test('Sicherheit: Inhaber kann Admin-Aktionen nicht direkt auslösen (Datenbank weist ab)', async ({ users }) => {
    desktopOnly()
    const owner = await users()
    const tenant = await createTenant('QA5 Angriff', [{ user: owner, role: 'owner' }])
    const { anon } = await import('./support/supabase')
    const client = anon()
    await client.auth.signInWithPassword({ email: owner.email, password: owner.password })
    const status = await client.rpc('admin_set_tenant_status', { p_tenant_id: tenant, p_active: false })
    expect(status.error?.code).toBe('42501')
    const overview = await client.rpc('admin_tenant_overview', {})
    expect(overview.error?.code).toBe('42501')
    const log = await client.from('operator_log').select('id').limit(5)
    expect(log.data ?? []).toHaveLength(0)
    const { data } = await service().from('tenants').select('status').eq('id', tenant).single()
    expect(data?.status).toBe('active')
  })
})

test.describe('Kundenliste', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('AC: Liste zeigt Name, Status, Inhaber, Mitglieder, Anlegedatum und letzte Anmeldung; Suche nach Name und E-Mail', async ({
    page,
    users,    tenantNames,
  }) => {
    desktopOnly()
    const owner = await users({ displayName: 'Olga Owner' })
    const staff = await users({ displayName: 'Stefan Staff' })
    const invitee = await users()
    const name = unique('Liste')
    tenantNames.push(`${name} Offen`)
    const active = await createTenant(name, [{ user: owner, role: 'owner' }, { user: staff, role: 'staff' }])
    const invited = await createTenant(`${name} Offen`, [])
    await createInvitation({ tenantId: invited, email: invitee.email, invitedBy: owner.id, role: 'owner' })
    // Anmeldung des Inhabers erzeugt eine letzte Anmeldung
    await signInAs(page, owner)
    await page.context().clearCookies()

    await asAdmin(page, users)
    await page.goto(`/betreiber?q=${encodeURIComponent(name)}`)
    const table = page.getByRole('table')
    const row = table.getByRole('row').filter({ hasText: `${name}` }).filter({ hasNotText: 'Offen' })
    await expect(row).toContainText('aktiv')
    await expect(row).toContainText(`Olga Owner · ${owner.email}`)
    await expect(row.getByRole('cell').nth(3)).toHaveText('2')
    await expect(row).toContainText(/(Mo|Di|Mi|Do|Fr|Sa|So), \d{2}\.\d{2}\.20\d\d/)
    await expect(row.getByRole('cell').nth(5)).not.toHaveText('noch nie')
    const openRow = table.getByRole('row').filter({ hasText: `${name} Offen` })
    await expect(openRow).toContainText('Einladung offen')
    await expect(openRow).toContainText(`${invitee.email} (eingeladen)`)
    await expect(openRow.getByRole('cell').nth(5)).toHaveText('noch nie')

    // Suche nach E-Mail (Groß-/Kleinschreibung egal), ohne Treffer, leeren
    await page.goto('/betreiber')
    await ready(page)
    await page.getByRole('searchbox', { name: 'Kunden suchen' }).fill(staff.email.toUpperCase())
    await expect(page).toHaveURL(/q=/)
    await expect(page.getByRole('row').filter({ hasText: name })).toHaveCount(1)
    await page.getByRole('searchbox', { name: 'Kunden suchen' }).fill(`kein-kunde-${randomUUID()}`)
    await expect(page.getByRole('heading', { name: 'Kein Kunde gefunden' })).toBeVisible()
    await page.getByRole('link', { name: 'Suche leeren' }).click()
    await expect(page).toHaveURL('/betreiber')
    await expect(page.getByRole('searchbox', { name: 'Kunden suchen' })).toHaveValue('')

    // Klick öffnet die Detailseite
    await page.goto(`/betreiber?q=${encodeURIComponent(name)}`)
    await page.getByRole('link', { name, exact: true }).click()
    await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible()
    await expect(page.getByText('Mitarbeiter verwalten die Inhaber des Kunden selbst.')).toBeVisible()
    expect(active).toBeTruthy()
  })
})

test.describe('Kunde anlegen', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('AC: Kunde mit bestehendem Konto als Inhaber anlegen → Detailseite „Einladung offen“, Protokoll, Annehmen macht ihn aktiv', async ({
    page,
    users,
    tenantNames,
  }) => {
    desktopOnly()
    const future = await users({ displayName: 'Ilse Inhaberin' })
    const name = unique('Anlegen')
    tenantNames.push(name)
    await asAdmin(page, users)
    await page.goto('/betreiber')
    await ready(page)

    await page.getByRole('button', { name: 'Kunde anlegen' }).first().click()
    const panel = page.getByRole('dialog')
    // Pflichtfelder
    await panel.getByRole('button', { name: 'Kunde anlegen' }).click()
    await expect(panel.getByText('Bitte gib einen Kundennamen ein.')).toBeVisible()
    await expect(panel.getByText('Bitte gib eine E-Mail-Adresse ein.')).toBeVisible()
    await panel.getByLabel('Kundenname').fill(name)
    await panel.getByLabel('E-Mail-Adresse des ersten Inhabers').fill('keine-adresse')
    await panel.getByRole('button', { name: 'Kunde anlegen' }).click()
    await expect(panel.getByText('Bitte gib eine gültige E-Mail-Adresse ein.')).toBeVisible()
    await panel.getByLabel('E-Mail-Adresse des ersten Inhabers').fill(`  ${future.email.toUpperCase()} `)
    await panel.getByRole('button', { name: 'Kunde anlegen' }).click()

    await expect(page).toHaveURL(/\/betreiber\/kunden\//)
    await expect(page.getByText(`Kunde „${name}“ angelegt.`)).toBeVisible()
    await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible()
    await expect(page.getByText('Einladung offen', { exact: true })).toBeVisible()
    // (Die Erfolgsmeldung ist ebenfalls ein Listeneintrag – daher nach dem Knopf der Einladung filtern)
    await expect(
      page.getByRole('listitem').filter({ hasText: future.email }).filter({ has: page.getByRole('button', { name: 'Erneut senden' }) })
    ).toContainText('Inhaber')
    await expect(page.getByRole('listitem').filter({ hasText: 'Kunde angelegt' })).toContainText('Ada Admin')

    // Inhaberin nimmt an → Kunde aktiv
    const tenantId = page.url().split('/').at(-1)!
    const { data: inv } = await service().from('invitations').select('kind').eq('tenant_id', tenantId).single()
    expect(inv?.kind).toBe('existing_account')
    const invitee = await page.context().browser()!.newContext()
    const p2 = await invitee.newPage()
    await signInAs(p2, future)
    await p2.goto('/')
    await p2.getByRole('button', { name: 'Annehmen' }).click()
    await expect.poll(() => membershipRole(tenantId, future.id)).toBe('owner')
    await invitee.close()
    await page.reload()
    await expect(page.getByText('aktiv', { exact: true })).toBeVisible()
  })

  test('AC: Gleicher Kundenname → Hinweis, „Trotzdem anlegen“ legt an', async ({ page, users, tenantNames }) => {
    desktopOnly()
    const owner = await users()
    const future = await users()
    const name = unique('Dublette')
    tenantNames.push(name)
    await createTenant(name, [{ user: owner, role: 'owner' }])
    await asAdmin(page, users)
    await page.goto('/betreiber')
    await ready(page)
    await page.getByRole('button', { name: 'Kunde anlegen' }).first().click()
    const panel = page.getByRole('dialog')
    await panel.getByLabel('Kundenname').fill(name.toLowerCase())
    await panel.getByLabel('E-Mail-Adresse des ersten Inhabers').fill(future.email)
    await panel.getByRole('button', { name: 'Kunde anlegen' }).click()
    await expect(panel.getByText('Es gibt bereits einen Kunden mit diesem Namen. Trotzdem anlegen?')).toBeVisible()
    tenantNames.push(name.toLowerCase())
    await panel.getByRole('button', { name: 'Trotzdem anlegen' }).click()
    await expect(page).toHaveURL(/\/betreiber\/kunden\//)
    const { count } = await service().from('tenants').select('id', { count: 'exact', head: true }).ilike('name', name)
    expect(count).toBe(2)
  })
})

test.describe('Inhaber verwalten', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('AC: Inhaber einladen, erneut senden, zurückziehen – mit Protokoll', async ({ page, users }) => {
    desktopOnly()
    const owner = await users({ displayName: 'Olga Owner' })
    const second = await users()
    const tenant = await createTenant(unique('Einladen'), [{ user: owner, role: 'owner' }])
    await asAdmin(page, users)
    await openTenant(page, tenant)

    await page.getByRole('button', { name: 'Inhaber einladen' }).click()
    const panel = page.getByRole('dialog')
    await panel.getByLabel('E-Mail-Adresse').fill(owner.email)
    await panel.getByRole('button', { name: 'Einladen' }).click()
    await expect(panel.getByRole('alert')).toHaveText('Diese Person gehört bereits zu diesem Kunden.')
    await panel.getByLabel('E-Mail-Adresse').fill(second.email)
    await panel.getByRole('button', { name: 'Einladen' }).click()
    await expect(page.getByText(`Einladung an ${second.email} verschickt.`)).toBeVisible()
    const item = page
      .getByRole('listitem')
      .filter({ hasText: second.email })
      .filter({ has: page.getByRole('button', { name: 'Erneut senden' }) })
    await expect(item).toContainText('Inhaber')

    await item.getByRole('button', { name: 'Erneut senden' }).click()
    await expect(page.getByText('Einladung erneut verschickt.')).toBeVisible()
    await item.getByRole('button', { name: 'Zurückziehen' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Zurückziehen' }).click()
    await expect(page.getByText('Einladung zurückgezogen.')).toBeVisible()
    await expect(page.getByText('Keine offenen Einladungen.')).toBeVisible()
    const log = page.getByRole('list').filter({ hasText: 'Einladung zurückgezogen:' })
    await expect(log).toContainText(`Inhaber eingeladen: ${second.email}`)
    await expect(log).toContainText(`Einladung erneut gesendet: ${second.email}`)
  })

  test('AC: Mitarbeiter befördern, Inhaber herabstufen und entfernen; letzter Inhaber geschützt; Mitarbeiter ohne „Entfernen“', async ({
    page,
    users,
  }) => {
    desktopOnly()
    const owner = await users({ displayName: 'Olga Owner' })
    const staff = await users({ displayName: 'Stefan Staff' })
    const tenant = await createTenant(unique('Rollen'), [{ user: owner, role: 'owner' }, { user: staff, role: 'staff' }])
    await asAdmin(page, users)
    await openTenant(page, tenant)

    // Einziger Inhaber: keine Aktionen, Hinweis
    await expect(page.getByRole('button', { name: 'Aktionen für Olga Owner' })).toHaveCount(0)
    await expect(page.getByText('Einziger Inhaber.').first()).toBeVisible()
    // Mitarbeiter: nur „Zum Inhaber machen“
    await page.getByRole('button', { name: 'Aktionen für Stefan Staff' }).first().click()
    await expect(page.getByRole('menuitem')).toHaveText(['Zum Inhaber machen'])
    await page.keyboard.press('Escape')

    await memberAction(page, 'Stefan Staff', 'Zum Inhaber machen')
    await expect(page.getByText('Stefan Staff ist jetzt Inhaber.')).toBeVisible()
    expect(await membershipRole(tenant, staff.id)).toBe('owner')

    await memberAction(page, 'Olga Owner', 'Zum Mitarbeiter herabstufen')
    await expect(page.getByText('Olga Owner ist jetzt Mitarbeiter.')).toBeVisible()
    expect(await membershipRole(tenant, owner.id)).toBe('staff')

    // Olga wieder befördern, dann Stefan entfernen
    await memberAction(page, 'Olga Owner', 'Zum Inhaber machen')
    await expect(page.getByText('Olga Owner ist jetzt Inhaber.')).toBeVisible()
    await memberAction(page, 'Stefan Staff', 'Entfernen')
    await expect(page.getByText('Stefan Staff wurde entfernt.')).toBeVisible()
    expect(await membershipRole(tenant, staff.id)).toBeNull()
    await expect(page.getByRole('list').filter({ hasText: 'Entfernt:' })).toContainText(`Entfernt: ${staff.email}`)
  })
})

test.describe('Deaktivieren, Reaktivieren, Löschen', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('AC: Deaktivieren sperrt Mitglieder mit Hinweis; Mitglied mit weiterem Kunden landet dort; Reaktivieren gibt Zugriff zurück', async ({
    page,
    users,
  }) => {
    desktopOnly()
    const owner = await users({ displayName: 'Olga Owner' })
    const shared = await users({ displayName: 'Sepp Shared' })
    const name = unique('Sperre')
    const tenant = await createTenant(name, [{ user: owner, role: 'owner' }, { user: shared, role: 'staff' }])
    await createTenant(`${name} Zweitkunde`, [{ user: shared, role: 'owner' }])

    await asAdmin(page, users)
    await openTenant(page, tenant)
    await expect(page.getByText('Endgültig löschen ist erst möglich, wenn der Kunde deaktiviert ist.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Endgültig löschen' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Kunde deaktivieren' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Kunde deaktivieren' }).click()
    await expect(page.getByText('Kunde deaktiviert.')).toBeVisible()
    await expect(page.getByText('deaktiviert', { exact: true })).toBeVisible()
    // Nur ansehen: keine Mitglieder-Aktionen, kein „Inhaber einladen“
    await expect(page.getByRole('button', { name: /Aktionen für/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Inhaber einladen' })).toHaveCount(0)

    const member = await page.context().browser()!.newContext()
    const m = await member.newPage()
    await signInAs(m, owner)
    await m.goto('/')
    await expect(m.getByRole('heading', { name: 'Dieses Kundenkonto ist deaktiviert' })).toBeVisible()
    await expect(m.getByText(name)).toHaveCount(0)
    const other = await page.context().browser()!.newContext()
    const o = await other.newPage()
    await signInAs(o, shared)
    await o.goto('/')
    await expect(o.getByText(`${name} Zweitkunde`).first()).toBeVisible()
    await expect(o.getByRole('heading', { name: 'Dieses Kundenkonto ist deaktiviert' })).toHaveCount(0)
    await other.close()

    await page.getByRole('button', { name: 'Kunde reaktivieren' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Kunde reaktivieren' }).click()
    await expect(page.getByText('Kunde reaktiviert.')).toBeVisible()
    await m.reload()
    await expect(m.getByRole('heading', { name: 'Dieses Kundenkonto ist deaktiviert' })).toHaveCount(0)
    await expect(m.getByText(name).first()).toBeVisible()
    await member.close()
    expect(await membershipRole(tenant, owner.id)).toBe('owner')
  })

  test('AC: Endgültig löschen nur mit exaktem Namen; verwaiste Konten weg, Konto mit weiterem Kunden bleibt; Löschnachweis', async ({
    page,
    users,
  }) => {
    desktopOnly()
    const owner = await users()
    const shared = await users()
    const name = unique('Löschen')
    const tenant = await createTenant(name, [{ user: owner, role: 'owner' }, { user: shared, role: 'staff' }])
    await createTenant(`${name} Bleibt`, [{ user: shared, role: 'owner' }])
    // Offene Einladung an eine neue Person: Supabase hat beim Versand ein unbestätigtes Konto angelegt (BUG-3)
    const newcomerEmail = `test-e2e-${randomUUID()}@example.com`
    const { data: newcomer } = await service().auth.admin.createUser({ email: newcomerEmail, email_confirm: false })
    await createInvitation({ tenantId: tenant, email: newcomerEmail, invitedBy: owner.id, role: 'owner', kind: 'new_account' })
    await service().from('tenants').update({ status: 'deactivated' }).eq('id', tenant)

    await asAdmin(page, users)
    await openTenant(page, tenant)
    await page.getByRole('button', { name: 'Endgültig löschen' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('Login-Konten, die zu keinem anderen Kunden gehören, werden ebenfalls gelöscht.')
    const confirm = dialog.getByRole('button', { name: 'Endgültig löschen' })
    await expect(confirm).toBeDisabled()
    await dialog.getByRole('textbox').fill(name.toLowerCase())
    await expect(confirm).toBeDisabled()
    await dialog.getByRole('textbox').fill(name)
    await expect(confirm).toBeEnabled()
    await confirm.click()

    await expect(page).toHaveURL('/betreiber')
    await expect(page.getByText(`Kunde „${name}“ endgültig gelöscht.`)).toBeVisible()
    expect((await service().from('tenants').select('id').eq('id', tenant)).data).toEqual([])
    expect((await service().auth.admin.getUserById(owner.id)).data.user).toBeNull()
    expect((await service().auth.admin.getUserById(shared.id)).data.user).not.toBeNull()
    // Unbenutztes Konto der offenen Einladung ist entfernt (BUG-3)
    expect((await service().auth.admin.getUserById(newcomer.user!.id)).data.user).toBeNull()
    // Gelöschter Kunde: 404 (BUG-2)
    const response = await page.goto(`/betreiber/kunden/${tenant}`)
    expect(response?.status()).toBe(404)
    await expect(page.getByRole('heading', { name: 'Seite nicht gefunden' })).toBeVisible()
    await expect(page.locator('main')).toHaveCount(1)
  })
})

test.describe('Edge Cases', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('Edge: Aktion auf einen inzwischen gelöschten Kunden → Meldung und zurück zur Liste (BUG-4)', async ({ page, users }) => {
    desktopOnly()
    const owner = await users()
    const name = unique('Weg')
    const tenant = await createTenant(name, [{ user: owner, role: 'owner' }])
    await asAdmin(page, users)
    await openTenant(page, tenant)
    // In einem anderen Fenster gelöscht
    await service().from('tenants').delete().eq('id', tenant)
    await page.getByRole('button', { name: 'Kunde deaktivieren' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Kunde deaktivieren' }).click()
    await expect(page.getByText('Diesen Kunden gibt es nicht mehr.')).toBeVisible()
    await expect(page).toHaveURL('/betreiber')
    await expect(page.getByRole('heading', { name: 'Kunden', level: 1 })).toBeVisible()
  })
})

test.describe('Layout und Barrierefreiheit', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('Liste und Detailseite: keine automatisch erkennbaren WCAG-2.1-AA-Verstöße, kein seitliches Scrollen', async ({ page, users }) => {
    const owner = await users({ displayName: 'Olga Owner' })
    const staff = await users({ displayName: 'Stefan Staff' })
    const name = unique('Layout')
    const tenant = await createTenant(name, [{ user: owner, role: 'owner' }, { user: staff, role: 'staff' }])
    await createInvitation({ tenantId: tenant, email: 'qa5-offen@example.com', invitedBy: owner.id, role: 'owner' })
    await asAdmin(page, users)

    for (const path of [`/betreiber?q=${encodeURIComponent(name)}`, `/betreiber/kunden/${tenant}`]) {
      await page.goto(path)
      await ready(page)
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      expect(results.violations, path).toEqual([])
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, path).toBeLessThanOrEqual(0)
    }
    // Handy: Karten statt Tabelle
    if (test.info().project.name === 'mobile') {
      await page.goto(`/betreiber?q=${encodeURIComponent(name)}`)
      await expect(page.getByRole('table')).toBeHidden()
      await expect(page.getByRole('link', { name: new RegExp(name) })).toBeVisible()
    }
  })
})
