import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test as base } from '@playwright/test'

import {
  createInvitation,
  createTenant,
  createUser,
  deleteUser,
  type E2EUser,
  emailLink,
  hasSupabaseEnv,
  membershipRole,
  newPassword,
  service,
  signInAs,
} from './support/supabase'

// PROJ-4: Kundenkonten & Rollen. Abläufe nur im Projekt „desktop“, Layout auch in 375 px.
// Es werden keine Mails verschickt: Einladungen nur an bestehende Testkonten (Brevo im Test abgeschaltet,
// playwright.config.ts) bzw. direkt angelegt; Links für neue Personen über admin.generateLink.

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

const desktopOnly = () => test.skip(test.info().project.name !== 'desktop', 'Abläufe nur im Desktop-Projekt')
const ready = (page: Page) =>
  page.waitForFunction(() => Object.keys(document.querySelector('main') ?? {}).some((k) => k.startsWith('__reactFiber')))

async function openTeam(page: Page) {
  await page.goto('/einstellungen/team')
  await ready(page)
}

async function memberAction(page: Page, name: string, action: string) {
  await page.getByRole('button', { name: `Aktionen für ${name}` }).first().click()
  await page.getByRole('menuitem', { name: action }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: action }).click()
}

test.describe('Team-Seite', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('AC: Inhaber sieht Mitglieder (Name, E-Mail, Rolle) und offene/abgelaufene Einladungen', async ({ page, users }) => {
    desktopOnly()
    const owner = await users({ displayName: 'Olga Owner' })
    const staff = await users({ displayName: 'Stefan Staff' })
    const tenant = await createTenant('QA Team-Seite', [{ user: owner, role: 'owner' }, { user: staff, role: 'staff' }])
    await createInvitation({ tenantId: tenant, email: 'qa-offen@example.com', invitedBy: owner.id })
    await createInvitation({ tenantId: tenant, email: 'qa-abgelaufen@example.com', invitedBy: owner.id, minutes: -5 })

    await signInAs(page, owner)
    await openTeam(page)
    const table = page.getByRole('table')
    await expect(table.getByRole('row', { name: /Olga Owner \(du\).*Inhaber/ })).toBeVisible()
    await expect(table.getByRole('row', { name: new RegExp(`Stefan Staff.*${staff.email}.*Mitarbeiter`) })).toBeVisible()
    await expect(page.getByText('qa-offen@example.com')).toBeVisible()
    await expect(page.getByRole('listitem').filter({ hasText: 'qa-offen@example.com' }).getByText('offen', { exact: true })).toBeVisible()
    await expect(page.getByRole('listitem').filter({ hasText: 'qa-abgelaufen@example.com' }).getByText('abgelaufen', { exact: true })).toBeVisible()
  })

  test('AC: Mitarbeiter: „Einstellungen“ fehlt und die Team-Seite zeigt „Seite nicht gefunden“', async ({ page, users }) => {
    desktopOnly()
    const owner = await users()
    const staff = await users({ displayName: 'Stefan Staff' })
    await createTenant('QA Mitarbeiter', [{ user: owner, role: 'owner' }, { user: staff, role: 'staff' }])
    await signInAs(page, staff)
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Einstellungen' })).toHaveCount(0)
    for (const path of ['/einstellungen/team', '/einstellungen/kunde', '/einstellungen']) {
      const res = await page.goto(path)
      expect(res?.status()).toBe(404) // BUG-2: früher 200
      await expect(page.getByRole('heading', { name: 'Seite nicht gefunden' })).toBeVisible()
      await expect(page.getByText(owner.email)).toHaveCount(0)
    }
  })

  test('AC: nur Inhaber, keine Einladungen → Leerzustand mit „Person einladen“', async ({ page, users }) => {
    desktopOnly()
    const owner = await users()
    await createTenant('QA Leer', [{ user: owner, role: 'owner' }])
    await signInAs(page, owner)
    await openTeam(page)
    await expect(page.getByRole('heading', { name: 'Noch niemand eingeladen' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Person einladen' })).toBeVisible()
  })
})

test.describe('Einladen', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('AC: bestehendes Konto einladen → offen in der Liste; Person sieht Einladung, nimmt an, ist Mitglied', async ({ browser, page, users }) => {
    desktopOnly()
    const owner = await users({ displayName: 'Olga Owner' })
    const guest = await users({ displayName: 'Gerda Gast' })
    const tenant = await createTenant('QA Einladen', [{ user: owner, role: 'owner' }])
    await signInAs(page, owner)
    await openTeam(page)
    await page.getByRole('button', { name: 'Person einladen' }).first().click()
    await page.getByLabel('E-Mail-Adresse').fill(`  ${guest.email.toUpperCase()} `)
    await page.getByRole('radio', { name: /Inhaber/ }).check()
    await page.getByRole('button', { name: 'Einladen', exact: true }).click()
    await expect(page.getByText(`Einladung an ${guest.email} verschickt.`)).toBeVisible()
    await expect(page.getByText(guest.email)).toBeVisible()

    const ctx = await browser.newContext()
    const guestPage = await ctx.newPage()
    await signInAs(guestPage, guest)
    await guestPage.goto('/')
    await expect(guestPage.getByText('Olga Owner hat dich als Inhaber zu „QA Einladen“ eingeladen.')).toBeVisible()
    await guestPage.getByRole('button', { name: 'Annehmen' }).click()
    await expect(guestPage.getByRole('button', { name: /Kunden wechseln|Benutzermenü/ }).first()).toBeVisible()
    await expect.poll(() => membershipRole(tenant, guest.id)).toBe('owner')
    await ctx.close()
  })

  test('AC: neue Person: Einladungslink → Name + Passwort → Mitglied mit gewählter Rolle', async ({ page, users }) => {
    desktopOnly()
    const owner = await users()
    const tenant = await createTenant('QA Neue Person', [{ user: owner, role: 'owner' }])
    const email = `test-e2e-neu-${Date.now()}@example.com`
    await createInvitation({ tenantId: tenant, email, invitedBy: owner.id, kind: 'new_account', minutes: 24 * 60 })
    const { url, userId } = await emailLink('invite', email)
    try {
      await page.goto(url)
      await page.getByRole('button', { name: 'Einladung annehmen' }).click()
      await expect(page).toHaveURL('/einladung/abschliessen')
      await ready(page)
      await page.getByLabel('Anzeigename').fill('Nora Neu')
      const pw = newPassword()
      await page.getByLabel('Passwort', { exact: true }).fill(pw)
      await page.getByLabel('Passwort wiederholen').fill(pw)
      await page.getByRole('button', { name: 'Konto einrichten' }).click()
      await expect(page).toHaveURL('http://localhost:3000/')
      await expect(page.getByText('QA Neue Person').first()).toBeVisible()
      expect(await membershipRole(tenant, userId)).toBe('staff')
    } finally {
      await deleteUser({ id: userId, email })
    }
  })

  test('AC: Ablehnen schließt die Einladung; Inhaber kann erneut einladen', async ({ page, users }) => {
    desktopOnly()
    const owner = await users()
    const guest = await users()
    const tenant = await createTenant('QA Ablehnen', [{ user: owner, role: 'owner' }])
    await createInvitation({ tenantId: tenant, email: guest.email, invitedBy: owner.id })
    await signInAs(page, guest)
    await page.goto('/')
    await page.getByRole('button', { name: 'Ablehnen' }).click()
    await expect(page.getByText('Einladung abgelehnt.')).toBeVisible()
    expect(await membershipRole(tenant, guest.id)).toBeNull()
    const { data } = await service().from('invitations').select('status').eq('tenant_id', tenant).eq('email', guest.email)
    expect(data?.[0]?.status).toBe('declined')
  })

  test('AC: leere/ungültige Adresse → Meldung am Feld, nichts verschickt', async ({ page, users }) => {
    desktopOnly()
    const owner = await users()
    const tenant = await createTenant('QA Prüfung', [{ user: owner, role: 'owner' }])
    await signInAs(page, owner)
    await openTeam(page)
    await page.getByRole('button', { name: 'Person einladen' }).first().click()
    await page.getByRole('button', { name: 'Einladen', exact: true }).click()
    await expect(page.getByText('Bitte gib eine E-Mail-Adresse ein.')).toBeVisible()
    await page.getByLabel('E-Mail-Adresse').fill('keine-adresse')
    await page.getByRole('button', { name: 'Einladen', exact: true }).click()
    await expect(page.getByText('Bitte gib eine gültige E-Mail-Adresse ein.')).toBeVisible()
    const { count } = await service().from('invitations').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant)
    expect(count).toBe(0)
  })

  test('AC: schon Mitglied / schon eingeladen / eigene Adresse → Hinweis, keine doppelte Einladung', async ({ page, users }) => {
    desktopOnly()
    const owner = await users()
    const staff = await users()
    const guest = await users()
    const tenant = await createTenant('QA Doppelt', [{ user: owner, role: 'owner' }, { user: staff, role: 'staff' }])
    await createInvitation({ tenantId: tenant, email: guest.email, invitedBy: owner.id })
    await signInAs(page, owner)
    await openTeam(page)
    const invite = async (email: string) => {
      await page.getByRole('button', { name: 'Person einladen' }).first().click()
      await page.getByLabel('E-Mail-Adresse').fill(email)
      await page.getByRole('button', { name: 'Einladen', exact: true }).click()
    }
    await invite(staff.email)
    await expect(page.getByRole('dialog').getByRole('alert')).toHaveText('Diese Person gehört bereits zum Team.')
    await page.keyboard.press('Escape')
    await invite(guest.email)
    await expect(page.getByRole('dialog').getByRole('alert')).toHaveText(/schon eine offene Einladung/)
    await page.keyboard.press('Escape')
    await invite(owner.email)
    await expect(page.getByRole('dialog').getByRole('alert')).toHaveText('Du bist bereits Mitglied.')
    const { count } = await service().from('invitations').select('id', { count: 'exact', head: true }).eq('tenant_id', tenant)
    expect(count).toBe(1)
  })

  test('AC: Erneut senden aktualisiert Datum und Gültigkeit; Zurückziehen entfernt die Einladung', async ({ page, users }) => {
    desktopOnly()
    const owner = await users()
    const guest = await users()
    const tenant = await createTenant('QA Erneut', [{ user: owner, role: 'owner' }])
    const id = await createInvitation({ tenantId: tenant, email: guest.email, invitedBy: owner.id, minutes: -10, sentMinutesAgo: 20 * 24 * 60 })
    await signInAs(page, owner)
    await openTeam(page)
    const row = page.getByRole('listitem').filter({ hasText: guest.email })
    await expect(row.getByText('abgelaufen', { exact: true })).toBeVisible()
    await row.getByRole('button', { name: 'Erneut senden' }).click()
    await expect(page.getByText('Einladung erneut verschickt.')).toBeVisible()
    await expect(row.getByText('offen', { exact: true })).toBeVisible()

    await row.getByRole('button', { name: 'Zurückziehen' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Zurückziehen' }).click()
    await expect(page.getByText('Einladung zurückgezogen.')).toBeVisible()
    await expect(page.getByText(guest.email)).toHaveCount(0)
    const { data } = await service().from('invitations').select('status').eq('id', id).single()
    expect(data?.status).toBe('revoked')
  })

  test('AC: zurückgezogener Einladungslink (neue Person) → „nicht mehr gültig“', async ({ browser, page, users }) => {
    desktopOnly()
    const owner = await users()
    const tenant = await createTenant('QA Zurückgezogen', [{ user: owner, role: 'owner' }])
    const email = `test-e2e-zurueck-${Date.now()}@example.com`
    await createInvitation({ tenantId: tenant, email, invitedBy: owner.id, kind: 'new_account', minutes: 24 * 60 })
    const { url, userId } = await emailLink('invite', email)
    try {
      await signInAs(page, owner)
      await openTeam(page)
      const row = page.getByRole('listitem').filter({ hasText: email })
      await row.getByRole('button', { name: 'Zurückziehen' }).click()
      await page.getByRole('alertdialog').getByRole('button', { name: 'Zurückziehen' }).click()
      await expect(page.getByText('Einladung zurückgezogen.')).toBeVisible()

      const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } })
      const p2 = await ctx.newPage()
      await p2.goto(url)
      await p2.getByRole('button', { name: 'Einladung annehmen' }).click()
      await expect(p2.getByRole('heading', { name: 'Dieser Link ist nicht mehr gültig' })).toBeVisible()
      await ctx.close()
    } finally {
      await deleteUser({ id: userId, email })
    }
  })
})

test.describe('Rollen und Mitglieder', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('AC: Mitarbeiter zum Inhaber machen und Mitarbeiter entfernen', async ({ page, users }) => {
    desktopOnly()
    const owner = await users({ displayName: 'Olga Owner' })
    const a = await users({ displayName: 'Anna Aufsteigerin' })
    const b = await users({ displayName: 'Bernd Bald-Weg' })
    const tenant = await createTenant('QA Rollen', [
      { user: owner, role: 'owner' },
      { user: a, role: 'staff' },
      { user: b, role: 'staff' },
    ])
    await signInAs(page, owner)
    await openTeam(page)
    await memberAction(page, 'Anna Aufsteigerin', 'Zum Inhaber machen')
    await expect(page.getByText('Anna Aufsteigerin ist jetzt Inhaber.')).toBeVisible()
    await expect.poll(() => membershipRole(tenant, a.id)).toBe('owner')

    await memberAction(page, 'Bernd Bald-Weg', 'Entfernen')
    await expect(page.getByText('Bernd Bald-Weg wurde entfernt.')).toBeVisible()
    await expect.poll(() => membershipRole(tenant, b.id)).toBeNull()
  })

  test('AC: andere Inhaber sind geschützt (keine Aktionen, Hinweis)', async ({ page, users }) => {
    desktopOnly()
    const owner = await users()
    const other = await users({ displayName: 'Otto Mitinhaber' })
    await createTenant('QA Geschützt', [{ user: owner, role: 'owner' }, { user: other, role: 'owner' }])
    await signInAs(page, owner)
    await openTeam(page)
    await expect(page.getByRole('button', { name: 'Aktionen für Otto Mitinhaber' })).toHaveCount(0)
    await expect(page.getByRole('row', { name: /Otto Mitinhaber/ }).getByText('Andere Inhaber kann nur der Betreiber herabstufen oder entfernen.')).toBeVisible()
  })

  test('AC: Inhaber stuft sich selbst herab (es gibt weitere Inhaber) → Mitarbeiter, Einstellungen weg', async ({ page, users }) => {
    desktopOnly()
    const owner = await users({ displayName: 'Selma Selbst' })
    const other = await users()
    const tenant = await createTenant('QA Herabstufen', [{ user: owner, role: 'owner' }, { user: other, role: 'owner' }])
    await signInAs(page, owner)
    await openTeam(page)
    await memberAction(page, 'Selma Selbst', 'Zum Mitarbeiter herabstufen')
    await expect(page).toHaveURL('http://localhost:3000/')
    await expect(page.getByRole('link', { name: 'Einstellungen' })).toHaveCount(0)
    expect(await membershipRole(tenant, owner.id)).toBe('staff')
  })

  test('AC: Inhaber verlässt das Team (weitere Inhaber vorhanden) → kein Zugriff mehr', async ({ page, users }) => {
    desktopOnly()
    const owner = await users({ displayName: 'Lea Leaving' })
    const other = await users()
    const tenant = await createTenant('QA Austreten', [{ user: owner, role: 'owner' }, { user: other, role: 'owner' }])
    await signInAs(page, owner)
    await openTeam(page)
    await memberAction(page, 'Lea Leaving', 'Team verlassen')
    await expect(page).toHaveURL('http://localhost:3000/')
    await expect(page.getByRole('heading', { name: 'Du bist noch keinem Kunden zugeordnet' })).toBeVisible()
    expect(await membershipRole(tenant, owner.id)).toBeNull()
  })

  test('AC: letzter Inhaber kann weder austreten noch sich herabstufen (Hinweis)', async ({ page, users }) => {
    desktopOnly()
    const owner = await users({ displayName: 'Ulla Einzig' })
    await createTenant('QA Letzter', [{ user: owner, role: 'owner' }, { user: await users(), role: 'staff' }])
    await signInAs(page, owner)
    await openTeam(page)
    await expect(page.getByRole('button', { name: 'Aktionen für Ulla Einzig' })).toHaveCount(0)
    await expect(page.getByText(/Du bist der einzige Inhaber/).first()).toBeVisible()
  })

  test('AC: Mitarbeiter verlässt den Kunden selbst über „Mein Konto“ (BUG-1)', async ({ page, users }) => {
    desktopOnly()
    const owner = await users()
    const staff = await users({ displayName: 'Mia Mitarbeiterin' })
    const tenant = await createTenant('QA MA verlässt', [{ user: owner, role: 'owner' }, { user: staff, role: 'staff' }])
    await signInAs(page, staff)
    await page.goto('/konto')
    await ready(page)
    await expect(page.getByText('Du bist bei „QA MA verlässt“ als Mitarbeiter eingetragen.', { exact: false })).toBeVisible()
    await page.getByRole('button', { name: '„QA MA verlässt“ verlassen' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Team verlassen' }).click()
    await expect(page).toHaveURL('http://localhost:3000/')
    await expect(page.getByRole('heading', { name: 'Du bist noch keinem Kunden zugeordnet' })).toBeVisible()
    expect(await membershipRole(tenant, staff.id)).toBeNull()
  })

  test('Letzter Inhaber: „Mein Konto“ zeigt statt „verlassen“ den Hinweis', async ({ page, users }) => {
    desktopOnly()
    const owner = await users()
    await createTenant('QA Allein', [{ user: owner, role: 'owner' }])
    await signInAs(page, owner)
    await page.goto('/konto')
    await expect(page.getByRole('button', { name: '„QA Allein“ verlassen' })).toHaveCount(0)
    await expect(page.getByText(/Du bist der einzige Inhaber/)).toBeVisible()
  })

  test('Entferntes Mitglied verliert den Zugriff beim nächsten Seitenaufruf', async ({ page, users }) => {
    desktopOnly()
    const owner = await users()
    const staff = await users()
    const tenant = await createTenant('QA Entfernt', [{ user: owner, role: 'owner' }, { user: staff, role: 'staff' }])
    await signInAs(page, staff)
    await page.goto('/')
    await expect(page.getByText('QA Entfernt').first()).toBeVisible()
    await service().from('memberships').delete().eq('tenant_id', tenant).eq('user_id', staff.id)
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Du bist noch keinem Kunden zugeordnet' })).toBeVisible()
  })
})

test.describe('Kunde und Kundenwechsel', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('AC: Kundenname ändern → sofort in der Seitenleiste; leer/zu lang → Meldung', async ({ page, users }) => {
    desktopOnly()
    const owner = await users()
    await createTenant('QA Alter Name', [{ user: owner, role: 'owner' }])
    await signInAs(page, owner)
    await page.goto('/einstellungen/kunde')
    await ready(page)
    const field = page.getByLabel('Kundenname')
    await field.fill('   ')
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Bitte gib einen Namen ein.')).toBeVisible()
    await field.fill('a'.repeat(201))
    await expect(field).toHaveValue('a'.repeat(200))
    await field.fill('QA Neuer Name')
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Kundenname gespeichert.')).toBeVisible()
    await expect(page.getByText('QA Neuer Name').first()).toBeVisible()
  })

  test('AC: Kundenwechsel mit Rolle je Kunde; gemerkt nach neuer Anmeldung; Rechte je Kunde', async ({ page, users }) => {
    desktopOnly()
    const person = await users()
    const other = await users()
    await createTenant('QA Alpha', [{ user: person, role: 'owner' }])
    await createTenant('QA Beta', [{ user: person, role: 'staff' }, { user: other, role: 'owner' }])
    await signInAs(page, person)
    await page.goto('/')
    // Ohne gemerkten Kunden: alphabetisch erster
    await expect(page.getByRole('button', { name: /Kunden wechseln: QA Alpha/ })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Einstellungen' })).toBeVisible()

    await page.getByRole('button', { name: /Kunden wechseln: QA Alpha/ }).click()
    await expect(page.getByRole('button', { name: /QA Alpha.*Inhaber/ })).toBeVisible()
    await page.getByRole('button', { name: /QA Beta.*Mitarbeiter/ }).click()
    await expect(page.getByRole('button', { name: /Kunden wechseln: QA Beta/ })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Einstellungen' })).toHaveCount(0)

    // Neue Anmeldung auf demselben Gerät: Kunde-Cookie bleibt, Sitzung neu
    const keep = (await page.context().cookies()).filter((c) => c.name === 'apppa-kunde')
    await page.context().clearCookies()
    await page.context().addCookies(keep)
    await signInAs(page, person)
    await page.goto('/')
    await expect(page.getByRole('button', { name: /Kunden wechseln: QA Beta/ })).toBeVisible()
  })

  test('Sicherheit: gefälschtes Kunden-Cookie eines fremden Kunden wird ignoriert', async ({ page, users }) => {
    desktopOnly()
    const person = await users()
    const stranger = await users()
    await createTenant('QA Eigener', [{ user: person, role: 'owner' }])
    const foreign = await createTenant('QA Fremder', [{ user: stranger, role: 'owner' }])
    await signInAs(page, person)
    await page.context().addCookies([{ name: 'apppa-kunde', value: foreign, domain: 'localhost', path: '/' }])
    await page.goto('/')
    await expect(page.getByText('QA Eigener').first()).toBeVisible()
    await expect(page.getByText('QA Fremder')).toHaveCount(0)
  })

  test('Sicherheit: /kunde-wechseln wählt keinen fremden Kunden und lehnt fremde Herkunft ab', async ({ page, users }) => {
    desktopOnly()
    const person = await users()
    const stranger = await users()
    await createTenant('QA Eigener', [{ user: person, role: 'owner' }])
    const second = await createTenant('QA Zweiter', [{ user: person, role: 'owner' }])
    const foreign = await createTenant('QA Fremder', [{ user: stranger, role: 'owner' }])
    await signInAs(page, person)
    const cookie = async () => (await page.context().cookies()).find((c) => c.name === 'apppa-kunde')?.value

    const own = await page.request.post('/kunde-wechseln', { form: { tenantId: second }, maxRedirects: 0 })
    expect(own.status()).toBe(303)
    expect(await cookie()).toBe(second)

    const strangers = await page.request.post('/kunde-wechseln', { form: { tenantId: foreign }, maxRedirects: 0 })
    expect(strangers.status()).toBe(303)
    expect(await cookie()).toBe(second)

    const forged = await page.request.post('/kunde-wechseln', {
      form: { tenantId: foreign },
      headers: { origin: 'https://boese.example' },
      maxRedirects: 0,
    })
    expect(forged.status()).toBe(403)
    expect(await cookie()).toBe(second)
  })

  test('Sicherheit: HTML im Kundennamen wird nicht ausgeführt', async ({ page, users }) => {
    desktopOnly()
    const owner = await users()
    await createTenant('<img src=x onerror="window.__xss=1">', [{ user: owner, role: 'owner' }])
    await signInAs(page, owner)
    await page.goto('/einstellungen/team')
    await ready(page)
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
  })

  test('AC: eine Mitgliedschaft → kein Kundenwechsel; keine Mitgliedschaft → Hinweis', async ({ page, users }) => {
    desktopOnly()
    const single = await users()
    await createTenant('QA Einzeln', [{ user: single, role: 'owner' }])
    await signInAs(page, single)
    await page.goto('/')
    await expect(page.getByText('QA Einzeln').first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Kunden wechseln/ })).toHaveCount(0)

    await page.context().clearCookies()
    await signInAs(page, await users())
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Du bist noch keinem Kunden zugeordnet' })).toBeVisible()
  })

  test('AC: Rahmen zeigt echten Kundennamen und Rolle', async ({ page, users }) => {
    desktopOnly()
    const staff = await users({ displayName: 'Rita Rahmen' })
    await createTenant('QA Rahmen', [{ user: await users(), role: 'owner' }, { user: staff, role: 'staff' }])
    await signInAs(page, staff)
    await page.goto('/')
    await expect(page.getByText('QA Rahmen').first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Benutzermenü: Rita Rahmen · Mitarbeiter/ }).first()).toBeVisible()
  })
})

test.describe('Design und Barrierefreiheit', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('AC: Team- und Kundenseite ohne waagrechtes Scrollen, Bedienelemente ≥ 44 px, keine axe-Verstöße', async ({ page, users }) => {
    test.skip(test.info().project.name === 'tablet', 'Desktop und Handy genügen')
    const owner = await users({ displayName: 'Olga Owner' })
    const staff = await users({ displayName: 'Stefan Staff mit einem sehr langen Namen' })
    const tenant = await createTenant('QA Layout', [{ user: owner, role: 'owner' }, { user: staff, role: 'staff' }])
    await createInvitation({ tenantId: tenant, email: 'eine-sehr-lange-adresse-fuer-den-test@example.com', invitedBy: owner.id })
    await signInAs(page, owner)
    for (const path of ['/einstellungen/team', '/einstellungen/kunde']) {
      await page.goto(path)
      await ready(page)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0)
      const small = await page.evaluate(() =>
        [...document.querySelectorAll('main button, main a')]
          .filter((el) => (el as HTMLElement).offsetParent !== null)
          .map((el) => el.getBoundingClientRect())
          .filter((r) => r.height < 43.5)
          .map((r) => `${Math.round(r.width)}x${Math.round(r.height)}`)
      )
      expect(small).toEqual([])
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([])
    }
  })

  test('AC: Bestätigungsdialog per Tastatur bedienbar', async ({ page, users }) => {
    desktopOnly()
    const owner = await users()
    const staff = await users({ displayName: 'Kai Keyboard' })
    const tenant = await createTenant('QA Tastatur', [{ user: owner, role: 'owner' }, { user: staff, role: 'staff' }])
    await signInAs(page, owner)
    await openTeam(page)
    await page.getByRole('button', { name: 'Aktionen für Kai Keyboard' }).first().focus()
    await page.keyboard.press('Enter')
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
    expect(await membershipRole(tenant, staff.id)).toBe('staff')
  })
})

test.describe('Edge Cases', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('Edge: mehr als 20 Einladungen pro Stunde → neutrale Meldung', async ({ page, users }) => {
    desktopOnly()
    const owner = await users()
    const guest = await users()
    const tenant = await createTenant('QA Grenze', [{ user: owner, role: 'owner' }])
    for (let i = 0; i < 20; i++) await createInvitation({ tenantId: tenant, email: `qa-grenze-${i}@example.com`, invitedBy: owner.id })
    await signInAs(page, owner)
    await openTeam(page)
    await page.getByRole('button', { name: 'Person einladen' }).first().click()
    await page.getByLabel('E-Mail-Adresse').fill(guest.email)
    await page.getByRole('button', { name: 'Einladen', exact: true }).click()
    await expect(page.getByRole('dialog').getByRole('alert')).toHaveText('Zu viele Einladungen in kurzer Zeit. Bitte versuche es später erneut.')
  })

  test('Edge: deaktivierter Kunde verschwindet für Mitglieder; seine Einladungen lassen sich nicht annehmen', async ({ page, users }) => {
    desktopOnly()
    const owner = await users()
    const guest = await users()
    const tenant = await createTenant('QA Deaktiviert', [{ user: owner, role: 'owner' }])
    await createInvitation({ tenantId: tenant, email: guest.email, invitedBy: owner.id })
    await service().from('tenants').update({ status: 'deactivated' }).eq('id', tenant)

    await signInAs(page, owner)
    await page.goto('/')
    // Seit PROJ-5 eigener Hinweis statt „keinem Kunden zugeordnet“
    await expect(page.getByRole('heading', { name: 'Dieses Kundenkonto ist deaktiviert' })).toBeVisible()

    await page.context().clearCookies()
    await signInAs(page, guest)
    await page.goto('/')
    await expect(page.getByText(/QA Deaktiviert/)).toHaveCount(0)
  })
})

test.describe('Handy', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('AC: Kundenwechsel im „Mehr“-Blatt (375 px)', async ({ page, users }) => {
    test.skip(test.info().project.name !== 'mobile', 'nur Handy')
    const person = await users()
    await createTenant('QA Mobil A', [{ user: person, role: 'owner' }])
    await createTenant('QA Mobil B', [{ user: person, role: 'owner' }])
    await signInAs(page, person)
    await page.goto('/')
    await ready(page)
    await page.getByRole('button', { name: 'Mehr' }).click()
    const sheet = page.getByRole('dialog')
    await sheet.getByRole('button', { name: /Kunden wechseln: QA Mobil A/ }).click()
    // Wechsel lädt die Seite vollständig neu (gleiche Adresse „/“) – auf das Neuladen warten
    await Promise.all([page.waitForEvent('load'), page.getByRole('button', { name: /QA Mobil B/ }).click()])
    await ready(page)
    await page.getByRole('button', { name: 'Mehr' }).click()
    await expect(page.getByRole('dialog').getByRole('button', { name: /Kunden wechseln: QA Mobil B/ })).toBeVisible()
  })
})
