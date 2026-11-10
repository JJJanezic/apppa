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
  login,
  newPassword,
  service,
  signInAs,
  signInAsAdmin,
  totp,
  typeCode,
} from './support/supabase'
import { noErrorFlash } from './support/error-flash'

// PROJ-3: Authentifizierung. Ablauf-Tests nur im Projekt „desktop“ (schont die Supabase-Grenzen pro IP) und auf Wunsch
// in Firefox (`PW_FIREFOX=1 … --project=firefox`, dort zeigte der Seitenwechsel kurz die Fehlerseite);
// Layout und Barrierefreiheit der Anmeldeseiten in allen drei Breiten.
// Jeder Ablauf-Test legt eigene Nutzer an und löscht sie wieder.

const test = base.extend<{ users: (opts?: Parameters<typeof createUser>[0]) => Promise<E2EUser>; noErrorFlash: void }>({
  noErrorFlash,
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

const loggedOut = { storageState: { cookies: [], origins: [] } }
const isDesktopProject = (name: string) => ['desktop', 'firefox', 'safari'].includes(name)
const alert = (page: Page) => page.getByRole('alert').filter({ hasNotText: /^$/ })

// TOTP-Codes gelten 30 s; denselben Code nicht zweimal verwenden
async function freshCode(secret: string, lastUsed?: string) {
  let code = totp(secret)
  while (code === lastUsed) {
    await new Promise((r) => setTimeout(r, 1000))
    code = totp(secret)
  }
  return code
}

async function readSecret(page: Page) {
  const secret = (await page.locator('code').first().textContent())?.trim()
  expect(secret).toMatch(/^[A-Z2-7]+=*$/)
  return secret!
}

test.describe('Abläufe', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')
  test.beforeEach(({}, testInfo) => test.skip(!isDesktopProject(testInfo.project.name), 'Abläufe nur im Desktop-Projekt'))

  test.describe('Anmelden', () => {
    test.use(loggedOut)

    test('AC: richtige Daten → angemeldet auf dem Dashboard', async ({ page, users }) => {
      const user = await users()
      await login(page, user)
      await expect(page).toHaveURL('http://localhost:3000/')
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(/, Erika\.$/)
    })

    test('AC: falsches Passwort und unbekanntes Konto → dieselbe Meldung, E-Mail bleibt stehen', async ({ page, users }) => {
      const user = await users()
      await login(page, { email: user.email, password: 'Falsch12345' })
      await expect(alert(page)).toHaveText('E-Mail-Adresse oder Passwort ist falsch.')
      await expect(page.getByLabel('E-Mail-Adresse')).toHaveValue(user.email)
      await expect(page.getByLabel('Passwort', { exact: true })).toHaveValue('')

      await login(page, { email: 'niemand-hier@example.com', password: 'Falsch12345' })
      await expect(alert(page)).toHaveText('E-Mail-Adresse oder Passwort ist falsch.')
    })

    test('AC: leere Felder und ungültige Adresse → Hinweis am Feld ohne Anfrage', async ({ page }) => {
      await page.goto('/anmelden')
      let actions = 0
      page.on('request', (r) => r.headers()['next-action'] && actions++)
      await page.getByRole('button', { name: 'Anmelden' }).click()
      await expect(page.getByText('Bitte gib deine E-Mail-Adresse ein.')).toBeVisible()
      await expect(page.getByText('Bitte gib dein Passwort ein.')).toBeVisible()
      await page.getByLabel('E-Mail-Adresse').fill('keine-adresse')
      await page.getByRole('button', { name: 'Anmelden' }).click()
      await expect(page.getByText('Bitte gib eine gültige E-Mail-Adresse ein.')).toBeVisible()
      await expect(page.getByLabel('E-Mail-Adresse')).toHaveAttribute('aria-invalid', 'true')
      expect(actions).toBe(0)
    })

    test('AC: 5 Fehlversuche in 15 Minuten sperren – auch das richtige Passwort', async ({ page, users }) => {
      const user = await users()
      for (let i = 0; i < 5; i++) {
        await login(page, { email: user.email, password: `Falsch1234${i}` })
        await expect(alert(page)).toHaveText('E-Mail-Adresse oder Passwort ist falsch.')
      }
      await login(page, user)
      await expect(alert(page)).toHaveText('Zu viele Fehlversuche. Bitte versuche es in 15 Minuten erneut.')
      await expect(page).toHaveURL(/\/anmelden/)
    })

    test('AC: App-Seite ohne Anmeldung → Anmeldeseite, danach zurück zur gewünschten Seite', async ({ page, users }) => {
      const user = await users()
      await page.goto('/konto')
      await expect(page).toHaveURL('/anmelden?next=%2Fkonto')
      await login(page, user, '/anmelden?next=%2Fkonto')
      await expect(page).toHaveURL('/konto')
      await expect(page.getByRole('heading', { name: 'Mein Konto' })).toBeVisible()
    })

    test('Regression: Rücksprung in einen gesperrten Bereich → Startseite statt „Seite nicht gefunden“', async ({ page, users }) => {
      // Person ohne Inhaber-Rolle, gemerktes Ziel /einstellungen (z. B. alter Tab)
      const user = await users()
      await login(page, user, '/anmelden?next=%2Feinstellungen')
      await expect(page).toHaveURL(/\/\?weiter=/)
      await expect(page.getByRole('heading', { name: 'Du bist noch keinem Kunden zugeordnet' })).toBeVisible()
      // Direkter Aufruf bleibt „Seite nicht gefunden“
      const response = await page.goto('/einstellungen')
      expect(response?.status()).toBe(404)
    })

    test('Rücksprung in einen erlaubten Bereich führt dorthin (Inhaber → Einstellungen)', async ({ page, users }) => {
      const user = await users()
      await createTenant('Testkunde Rücksprung', [{ user, role: 'owner' }])
      await login(page, user, '/anmelden?next=%2Feinstellungen%2Fteam')
      await expect(page).toHaveURL('/einstellungen/team')
    })

    test('AC: Doppelklick sendet nur einen Versuch, Knopf zeigt Ladezustand', async ({ page, users }) => {
      const user = await users()
      await page.goto('/anmelden')
      await page.getByLabel('E-Mail-Adresse').fill(user.email)
      await page.getByLabel('Passwort', { exact: true }).fill(user.password)
      // Anmelden läuft über den Route-Handler /api/anmeldung/anmelden (keine Server-Aktion, Firefox-Fehler beim Seitenwechsel)
      let attempts = 0
      page.on('request', (r) => r.url().endsWith('/api/anmeldung/anmelden') && attempts++)
      const button = page.getByRole('button', { name: 'Anmelden' })
      await button.dblclick()
      await expect(page).toHaveURL('http://localhost:3000/')
      expect(attempts).toBe(1)
    })

    test('Edge: E-Mail mit Großbuchstaben und Leerzeichen wird normalisiert', async ({ page, users }) => {
      const user = await users()
      await login(page, { email: `  ${user.email.toUpperCase()} `, password: user.password })
      await expect(page).toHaveURL('http://localhost:3000/')
    })

    test.describe('Edge: Rücksprung nur auf Seiten der App', () => {
      for (const next of ['//evil.example', 'https://evil.example', '/\\evil.example']) {
        test(`next=${next} → Dashboard`, async ({ page, users }) => {
          const user = await users()
          await login(page, user, `/anmelden?next=${encodeURIComponent(next)}`)
          await expect(page).toHaveURL('http://localhost:3000/')
        })
      }
    })
  })

  test.describe('Angemeldet', () => {
    test.use(loggedOut)

    test('AC: Anmeldeseite leitet angemeldete Personen zum Dashboard', async ({ page, users }) => {
      await signInAs(page, await users())
      await page.goto('/anmelden')
      await expect(page).toHaveURL('http://localhost:3000/')
    })

    test('AC: Abmelden → Anmeldeseite mit Hinweis; Zurück zeigt keine App-Daten', async ({ page, users }) => {
      await signInAs(page, await users())
      await page.goto('/konto')
      await page.getByRole('button', { name: /Benutzermenü/ }).click()
      await page.getByRole('menuitem', { name: 'Abmelden' }).click()
      await expect(page).toHaveURL('/anmelden?grund=abgemeldet')
      await expect(page.getByRole('status')).toHaveText('Du wurdest abgemeldet.')
      await page.goBack()
      await expect(page).toHaveURL(/\/anmelden/)
      await expect(page.getByText('Erika Testerin')).toHaveCount(0)
    })

    test('AC: 8 Stunden ohne Aktivität → neu anmelden, danach zurück zur Seite', async ({ page, users }) => {
      const user = await users()
      await signInAs(page, user, { start: Date.now() - 8 * 60 * 60_000 - 60_000 })
      await page.goto('/konto')
      await expect(page).toHaveURL('/anmelden?next=%2Fkonto&grund=sitzung-abgelaufen')
      await expect(page.getByRole('status')).toHaveText('Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.')
      await login(page, user, '/anmelden?next=%2Fkonto&grund=sitzung-abgelaufen')
      await expect(page).toHaveURL('/konto')
    })

    test('Sitzungs-Cookie fehlt oder ist manipuliert → abgemeldet', async ({ page, users }) => {
      await signInAs(page, await users())
      const cookies = await page.context().cookies()
      await page.context().clearCookies({ name: 'apppa-sitzung' })
      await page.goto('/')
      await expect(page).toHaveURL(/\/anmelden/)
      expect(cookies.some((c) => c.name === 'apppa-sitzung' && c.httpOnly)).toBe(true)
    })

    test('AC: Auf allen Geräten abmelden beendet alle Sitzungen', async ({ browser, page, users }) => {
      const user = await users()
      const other = await browser.newContext()
      const otherPage = await other.newPage()
      await signInAs(page, user)
      await signInAs(otherPage, user)
      await otherPage.goto('/konto')
      await expect(otherPage.getByRole('heading', { name: 'Mein Konto' })).toBeVisible()

      await page.goto('/konto')
      await page.getByRole('button', { name: 'Überall abmelden' }).click()
      await page.getByRole('alertdialog').getByRole('button', { name: 'Überall abmelden' }).click()
      await expect(page).toHaveURL('/anmelden?grund=abgemeldet')

      await otherPage.goto('/konto')
      await expect(otherPage).toHaveURL(/\/anmelden/)
      await other.close()
    })
  })

  test.describe('Einladung', () => {
    test.use(loggedOut)

    test('AC: Link zeigt nur Knopf; Linkscanner verbraucht ihn nicht; Name + Passwort → Dashboard', async ({ page, request }) => {
      const email = `test-e2e-invite-${Date.now()}@example.com`
      const { url, userId } = await emailLink('invite', email)
      try {
        // Linkscanner: ruft alte und neue Adresse per GET auf
        await request.get(url.replace('/bestaetigen', '/auth/confirm'))
        await request.get(url)

        await page.goto(url)
        await expect(page.getByRole('heading', { name: 'Einladung annehmen' })).toBeVisible()
        await page.getByRole('button', { name: 'Einladung annehmen' }).click()
        await expect(page).toHaveURL('/einladung/abschliessen')
        await page.waitForLoadState('networkidle')

        // Regeln sind vor der Eingabe sichtbar
        await expect(page.getByText('Das Passwort braucht:')).toBeVisible()
        await page.getByLabel('Anzeigename').fill('Johanna Pichler')
        const pw = newPassword()
        await page.getByLabel('Passwort', { exact: true }).fill(pw)
        await page.getByLabel('Passwort wiederholen').fill(pw)
        await page.getByRole('button', { name: 'Konto einrichten' }).click()
        await expect(page).toHaveURL('http://localhost:3000/')
        await expect(page.getByRole('heading', { level: 1 })).toHaveText(/, Johanna\.$/)
      } finally {
        await deleteUser({ id: userId, email })
      }
    })

    test('AC: Passwortregeln, Wiederholung und Anzeigename werden geprüft', async ({ page }) => {
      const email = `test-e2e-invite-${Date.now()}@example.com`
      const { url, userId } = await emailLink('invite', email)
      try {
        await page.goto(url)
        await page.getByRole('button', { name: 'Einladung annehmen' }).click()
        await expect(page).toHaveURL('/einladung/abschliessen')
        await page.waitForLoadState('networkidle')
        await page.getByLabel('Passwort', { exact: true }).fill('kurz')
        await page.getByLabel('Passwort wiederholen').fill('anders')
        await page.getByRole('button', { name: 'Konto einrichten' }).click()
        await expect(page.getByText('Bitte gib einen Namen ein.')).toBeVisible()
        await expect(page.getByText('Das Passwort erfüllt noch nicht alle Regeln.')).toBeVisible()

        // Mehr als 200 Zeichen lassen sich gar nicht eingeben (maxLength); der Server prüft zusätzlich
        await page.getByLabel('Anzeigename').fill('a'.repeat(201))
        await expect(page.getByLabel('Anzeigename')).toHaveValue('a'.repeat(200))
        await page.getByLabel('Passwort', { exact: true }).fill('Abcdefgh12')
        await page.getByLabel('Passwort wiederholen').fill('Abcdefgh13')
        await page.getByRole('button', { name: 'Konto einrichten' }).click()
        await expect(page.getByText('Die beiden Passwörter stimmen nicht überein.')).toBeVisible()
      } finally {
        await deleteUser({ id: userId, email })
      }
    })

    test('AC: benutzter Link → „nicht mehr gültig“ mit Hinweis auf neue Einladung', async ({ page }) => {
      const email = `test-e2e-invite-${Date.now()}@example.com`
      const { url, userId } = await emailLink('invite', email)
      try {
        await page.goto(url)
        await page.getByRole('button', { name: 'Einladung annehmen' }).click()
        await expect(page).toHaveURL('/einladung/abschliessen')
        await page.waitForLoadState('networkidle')
        await page.context().clearCookies()
        await page.goto(url)
        await page.getByRole('button', { name: 'Einladung annehmen' }).click()
        await expect(page.getByRole('heading', { name: 'Dieser Link ist nicht mehr gültig' })).toBeVisible()
        await expect(page.getByText(/neue Einladung schicken/)).toBeVisible()
      } finally {
        await deleteUser({ id: userId, email })
      }
    })

    test('Edge: andere Person im selben Browser angemeldet → wird abgemeldet, mit Hinweis', async ({ page, users }) => {
      const other = await users({ displayName: 'Bisherige Person' })
      await signInAs(page, other)
      const email = `test-e2e-invite-${Date.now()}@example.com`
      const { url, userId } = await emailLink('invite', email)
      try {
        await page.goto(url)
        await page.getByRole('button', { name: 'Einladung annehmen' }).click()
        await expect(page).toHaveURL(/\/einladung\/abschliessen/)
        await expect(page.getByText('Die bisherige Anmeldung in diesem Browser wurde beendet.')).toBeVisible()
      } finally {
        await deleteUser({ id: userId, email })
      }
    })
  })

  test.describe('Passwort vergessen', () => {
    test.use(loggedOut)

    test('AC: Anforderung antwortet immer neutral (auch mehrfach)', async ({ page }) => {
      for (let i = 0; i < 3; i++) {
        await page.goto('/passwort-vergessen')
        await page.getByLabel('E-Mail-Adresse').fill('niemand-hier@example.com')
        await page.getByRole('button', { name: 'Link senden' }).click()
        await expect(page.getByRole('status')).toContainText(
          'Falls ein Konto mit dieser Adresse existiert, haben wir dir eine E-Mail geschickt.'
        )
      }
    })

    test('AC: Link zeigt erst Knopf; neues Passwort → Dashboard, andere Sitzungen beendet', async ({ browser, page, users }) => {
      const user = await users()
      const other = await browser.newContext()
      const otherPage = await other.newPage()
      await signInAs(otherPage, user)

      const { url } = await emailLink('recovery', user.email)
      await page.goto(url)
      await expect(page.getByRole('heading', { name: 'Neues Passwort festlegen' })).toBeVisible()
      await expect(page).toHaveURL(/\/bestaetigen/)
      await page.getByRole('button', { name: 'Neues Passwort festlegen' }).click()
      await expect(page).toHaveURL('/passwort-neu')
      await page.waitForLoadState('networkidle')
      const pw = newPassword()
      await page.getByLabel('Neues Passwort').fill(pw)
      await page.getByLabel('Passwort wiederholen').fill(pw)
      await page.getByRole('button', { name: 'Passwort speichern' }).click()
      await expect(page).toHaveURL('http://localhost:3000/')

      await otherPage.goto('/konto')
      await expect(otherPage).toHaveURL(/\/anmelden/)
      await other.close()
    })

    test('AC: abgelaufener/benutzter Reset-Link → Meldung mit „Neuen Link anfordern“', async ({ page }) => {
      await page.goto('/bestaetigen?token_hash=ungueltig&type=recovery')
      await page.getByRole('button', { name: 'Neues Passwort festlegen' }).click()
      await expect(page.getByRole('heading', { name: 'Dieser Link ist nicht mehr gültig' })).toBeVisible()
      await page.getByRole('link', { name: 'Neuen Link anfordern' }).click()
      await expect(page).toHaveURL('/passwort-vergessen')
    })
  })

  test.describe('Mein Konto', () => {
    test.use(loggedOut)

    test('AC: zeigt E-Mail (nicht änderbar), Namen, Passwort und Abmelden; ohne 2FA für Nicht-Admins', async ({ page, users }) => {
      const user = await users()
      await signInAs(page, user)
      await page.goto('/konto')
      await expect(page.getByLabel('E-Mail-Adresse')).toHaveValue(user.email)
      await expect(page.getByLabel('E-Mail-Adresse')).toBeDisabled()
      await expect(page.getByLabel('Anzeigename')).toHaveValue('Erika Testerin')
      await expect(page.getByRole('heading', { name: 'Passwort ändern' })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Auf allen Geräten abmelden' })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Zwei-Faktor-Anmeldung' })).toHaveCount(0)
    })

    test('AC: geänderter Name erscheint sofort in der Seitenleiste, mit Bestätigung', async ({ page, users }) => {
      await signInAs(page, await users())
      await page.goto('/konto')
      await page.getByLabel('Anzeigename').fill('Maria Huber')
      await page.getByRole('button', { name: 'Namen speichern' }).click()
      await expect(page.getByText('Name gespeichert.')).toBeVisible()
      await expect(page.getByRole('button', { name: /Benutzermenü: Maria Huber/ })).toBeVisible()
    })

    test('AC: falsches aktuelles Passwort → abgelehnt', async ({ page, users }) => {
      await signInAs(page, await users())
      await page.goto('/konto')
      await page.getByLabel('Aktuelles Passwort').fill('Falsch12345')
      const pw = newPassword()
      await page.getByLabel('Neues Passwort').fill(pw)
      await page.getByLabel('Passwort wiederholen').fill(pw)
      await page.getByRole('button', { name: 'Passwort ändern' }).click()
      await expect(alert(page)).toHaveText('Das aktuelle Passwort ist falsch.')
    })

    test('AC: Passwort ändern → neues Passwort gilt, andere Sitzungen beendet', async ({ browser, page, users }) => {
      const user = await users()
      const other = await browser.newContext()
      const otherPage = await other.newPage()
      await signInAs(otherPage, user)
      await signInAs(page, user)

      await page.goto('/konto')
      await page.getByLabel('Aktuelles Passwort').fill(user.password)
      const pw = newPassword()
      await page.getByLabel('Neues Passwort').fill(pw)
      await page.getByLabel('Passwort wiederholen').fill(pw)
      await page.getByRole('button', { name: 'Passwort ändern' }).click()
      await expect(page.getByText('Passwort geändert. Andere Geräte wurden abgemeldet.')).toBeVisible()

      await page.reload()
      await expect(page.getByRole('heading', { name: 'Mein Konto' })).toBeVisible()
      await otherPage.goto('/konto')
      await expect(otherPage).toHaveURL(/\/anmelden/)
      await other.close()

      const check = await service().auth.signInWithPassword({ email: user.email, password: pw })
      expect(check.error).toBeNull()
    })
  })

  test.describe('2FA für den Betreiber-Admin', () => {
    test.use(loggedOut)

    test('AC: Admin ohne Gerät muss einrichten; danach Code-Abfrage bei jeder Anmeldung; zweites Gerät; letztes Gerät gesperrt', async ({
      page,
      users,
    }) => {
      test.setTimeout(120_000)
      const admin = await users({ displayName: 'Ada Admin', admin: true })

      // Pflicht-Einrichtung, andere Seiten gesperrt
      await login(page, admin)
      await expect(page).toHaveURL('/2fa/einrichten')
      await page.goto('/konto')
      await expect(page).toHaveURL('/2fa/einrichten')
      await expect(page.getByRole('img', { name: 'QR-Code für die Authenticator-App' })).toBeVisible()
      const secret1 = await readSecret(page)
      const code1 = await freshCode(secret1)
      await typeCode(page, code1)
      await page.getByRole('button', { name: 'Einrichten' }).click()
      // Admin ohne eigenen Kunden startet im Betreiber-Bereich (PROJ-5)
      await expect(page).toHaveURL('/betreiber')

      // Zweites Gerät unter Mein Konto
      await page.goto('/konto')
      await expect(page.getByRole('heading', { name: 'Zwei-Faktor-Anmeldung' })).toBeVisible()
      await expect(page.getByRole('button', { name: 'Entfernen' })).toBeDisabled()
      await expect(page.getByText('Das einzige Gerät kann nicht entfernt werden.')).toBeVisible()
      await page.getByRole('button', { name: 'Gerät hinzufügen' }).click()
      const panel = page.getByRole('dialog')
      await expect(panel.getByRole('img', { name: 'QR-Code für die Authenticator-App' })).toBeVisible()
      const secret2 = (await panel.locator('code').textContent())!.trim()
      await panel.locator('input[autocomplete="one-time-code"]').click()
      await page.keyboard.type(await freshCode(secret2))
      await panel.getByRole('button', { name: 'Einrichten' }).click()
      await expect(page.getByText('Gerät hinzugefügt.')).toBeVisible()
      await expect(page.getByRole('button', { name: 'Entfernen' })).toHaveCount(2)
      await expect(page.getByRole('button', { name: 'Entfernen' }).first()).toBeEnabled()

      // Neue Anmeldung: Code-Abfrage; falscher Code → Meldung; richtiger Code (zweites Gerät) → Dashboard, das den Admin
      // ohne eigenen Kunden in den Betreiber-Bereich weiterleitet
      await page.context().clearCookies()
      await login(page, admin)
      await expect(page).toHaveURL(/\/2fa\?next=/)
      await page.goto('/')
      await expect(page).toHaveURL('/2fa')
      await typeCode(page, '000000')
      await page.getByRole('button', { name: 'Bestätigen' }).click()
      await expect(alert(page)).toHaveText('Der Code ist falsch oder abgelaufen.')
      await typeCode(page, await freshCode(secret2))
      await page.getByRole('button', { name: 'Bestätigen' }).click()
      await expect(page).toHaveURL('/betreiber')
    })

    test('AC: 5 falsche Codes → Sperre wie beim Passwort', async ({ page, users }) => {
      const admin = await users({ admin: true })
      // Gerät direkt über Supabase anlegen und bestätigen
      const client = (await import('./support/supabase')).anon()
      await client.auth.signInWithPassword({ email: admin.email, password: admin.password })
      const { data: factor } = await client.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'e2e' })
      await client.auth.mfa.challengeAndVerify({ factorId: factor!.id, code: totp(factor!.totp.secret) })

      await signInAs(page, admin)
      await page.goto('/')
      await expect(page).toHaveURL('/2fa')
      for (let i = 0; i < 5; i++) {
        await typeCode(page, `00000${i}`)
        await page.getByRole('button', { name: 'Bestätigen' }).click()
        await expect(alert(page)).toHaveText('Der Code ist falsch oder abgelaufen.')
      }
      await typeCode(page, totp(factor!.totp.secret))
      await page.getByRole('button', { name: 'Bestätigen' }).click()
      await expect(alert(page)).toHaveText(/Zu viele Fehlversuche/)
    })

    test('AC: Admin hat ohne Code keine Admin-Rechte (Sitzungsstufe aal1)', async ({ users }) => {
      const admin = await users({ admin: true })
      const client = (await import('./support/supabase')).anon()
      await client.auth.signInWithPassword({ email: admin.email, password: admin.password })
      // Wirkung von private.is_admin(): ohne Code (aal1) bleiben fremde Mandanten unsichtbar
      const { data: tenants } = await client.from('tenants').select('id').limit(5)
      const { count } = await service().from('tenants').select('id', { count: 'exact', head: true })
      if ((count ?? 0) > 0) expect(tenants ?? []).toHaveLength(0)
    })
  })
})

test.describe('Seitenwechsel ohne Fehlerseite und neue Endpunkte (Bugfix 2026-11-10)', () => {
  test.use(loggedOut)
  test.skip(!hasSupabaseEnv, 'keine .env.local')
  test.beforeEach(({}, testInfo) => test.skip(!isDesktopProject(testInfo.project.name), 'Abläufe nur im Desktop-Projekt'))
  const ORIGIN = 'http://localhost:3000'
  const post = (origin = ORIGIN) => ({ headers: { origin, 'content-type': 'application/json' }, maxRedirects: 0 })

  test('Sitzung läuft während einer Aktion ab → Anmeldeseite mit Hinweis', async ({ browser, page, users }) => {
    const user = await users()
    await signInAs(page, user)
    await page.goto('/konto')
    await expect(page.getByLabel('Anzeigename')).toBeVisible()
    // Zweite Sitzung meldet überall ab; die erste merkt es erst bei der nächsten Aktion
    const other = await browser.newContext()
    const otherPage = await other.newPage()
    await signInAs(otherPage, user)
    await otherPage.goto('/konto')
    await otherPage.getByRole('button', { name: 'Überall abmelden' }).click()
    await otherPage.getByRole('alertdialog').getByRole('button', { name: 'Überall abmelden' }).click()
    await expect(otherPage).toHaveURL('/anmelden?grund=abgemeldet')
    await other.close()

    await page.getByLabel('Anzeigename').fill('Maria Huber')
    await page.getByRole('button', { name: 'Namen speichern' }).click()
    await expect(page).toHaveURL(/\/anmelden\?grund=sitzung-abgelaufen/)
  })

  test('Einstellungen ohne Unterseite: vollständiger Aufruf leitet zu den Stammdaten', async ({ page, users }) => {
    const user = await users()
    await createTenant('QA Einstellungen', [{ user, role: 'owner' }])
    await signInAs(page, user)
    await page.goto('/einstellungen')
    await expect(page).toHaveURL('/einstellungen/stammdaten')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('Admin ohne Kunde lehnt die letzte Einladung ab → Betreiber-Bereich', async ({ page, users }) => {
    const admin = await users({ displayName: 'Ada Admin', admin: true })
    const owner = await users({ displayName: 'Olga Owner' })
    const tenantId = await createTenant('QA Admin-Einladung', [{ user: owner, role: 'owner' }])
    await createInvitation({ tenantId, email: admin.email, invitedBy: owner.id })
    await signInAsAdmin(page, admin)
    await page.goto('/')
    await expect(page).toHaveURL('/')
    await page.getByRole('button', { name: 'Ablehnen' }).click()
    await expect(page).toHaveURL('/betreiber')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('Admin verlässt seinen letzten Kunden → Betreiber-Bereich', async ({ page, users }) => {
    const admin = await users({ displayName: 'Ada Admin', admin: true })
    const owner = await users({ displayName: 'Olga Owner' })
    await createTenant('QA Admin verlässt', [{ user: owner, role: 'owner' }, { user: admin, role: 'staff' }])
    await signInAsAdmin(page, admin)
    await page.goto('/konto')
    await page.getByRole('button', { name: '„QA Admin verlässt“ verlassen' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Team verlassen' }).click()
    await expect(page).toHaveURL('/betreiber')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  })

  test('Dashboard leitet beim Seitenaufruf echt weiter; fremde Ziele und ein mitgeschickter Header wirken nicht', async ({ page, users }) => {
    const user = await users()
    await createTenant('QA Weiter', [{ user, role: 'owner' }])
    await signInAs(page, user)
    const api = page.request
    const internal = await api.get('/?weiter=%2Fkonto', { maxRedirects: 0 })
    expect(internal.status()).toBe(307)
    expect(internal.headers().location).toBe('/konto')
    for (const target of ['//evil.example', 'https://evil.example', '/\\evil.example', '/.//evil.example']) {
      const res = await api.get(`/?weiter=${encodeURIComponent(target)}`, { maxRedirects: 0 })
      expect(res.status(), target).toBe(200)
    }
    const spoofed = await api.get('/', { maxRedirects: 0, headers: { 'x-search': '?weiter=/konto' } })
    expect(spoofed.status()).toBe(200)
  })

  test('Fremde Herkunft, unbekannte Schritte und falsche Methoden werden abgelehnt', async ({ request }) => {
    for (const url of ['/api/anmeldung/anmelden', '/api/abmelden']) {
      for (const origin of ['https://evil.example', 'null', 'http://localhost:3001']) {
        expect((await request.post(url, { ...post(origin), data: {} })).status(), `${url} ${origin}`).toBe(403)
      }
      expect((await request.get(url, { maxRedirects: 0 })).status(), url).toBe(405)
    }
    for (const step of ['requestPasswordReset', 'startMfaEnrollment', 'constructor', '__proto__']) {
      expect((await request.post(`/api/anmeldung/${step}`, { ...post(), data: {} })).status(), step).toBe(404)
    }
  })

  test('Ohne Sitzung: Schritte melden keinen Erfolg, Abmelden bleibt harmlos', async ({ request }) => {
    const call = async (url: string, data: object) => (await request.post(url, { ...post(), data })).json()
    expect(await call('/api/anmeldung/code', { code: '123456' })).toEqual({ ok: false, error: 'sessionExpired' })
    expect(await call('/api/anmeldung/einrichten', { code: '123456', factorId: 'x' })).toEqual({ ok: false, error: 'sessionExpired' })
    expect(await call('/api/anmeldung/neues-passwort', { password: 'Abcdefgh1234', passwordRepeat: 'Abcdefgh1234' })).toEqual({ ok: false, error: 'linkInvalid' })
    expect(await call('/api/anmeldung/link', { tokenHash: 'x', type: 'signup' })).toEqual({ ok: false, error: 'linkInvalid' })
    expect(await call('/api/abmelden', {})).toEqual({ ok: true })
    expect(await call('/api/abmelden', { alle: true })).toEqual({ ok: false, error: 'sessionExpired' })
  })

  test('Anmelden: Antwort ohne Schlüssel und nicht zwischenspeicherbar; fremdes Rücksprung-Ziel bleibt in der App', async ({ playwright, users }) => {
    const user = await users()
    const api = await playwright.request.newContext({ baseURL: ORIGIN })
    const res = await api.post('/api/anmeldung/anmelden', { ...post(), data: { email: user.email, password: user.password, next: '//evil.example' } })
    expect(await res.json()).toEqual({ ok: true, redirectTo: '/' })
    expect(res.headers()['cache-control']).toBe('no-store')
    await api.dispose()
  })
})

test.describe('Anmeldeseiten: Design und Barrierefreiheit', () => {
  test.use(loggedOut)
  const pages = ['/anmelden', '/passwort-vergessen', '/bestaetigen?token_hash=x&type=invite', '/bestaetigen']

  for (const path of pages) {
    test(`AC: ${path} – Wortmarke, schmales Formular, keine Navigation, kein waagrechtes Scrollen, keine axe-Verstöße`, async ({
      page,
    }) => {
      await page.goto(path)
      await expect(page.getByRole('main', { name: 'Anmeldung' })).toBeVisible()
      await expect(page.getByRole('main').getByText('apppa', { exact: false }).first()).toBeVisible()
      await expect(page.getByRole('navigation')).toHaveCount(0)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow).toBeLessThanOrEqual(0)
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      expect(results.violations.map((v) => v.id)).toEqual([])
    })
  }

  test('AC: Felder sind beschriftet und für Passwortmanager ausgezeichnet; Passwort anzeigen/verbergen', async ({ page }) => {
    await page.goto('/anmelden')
    await expect(page.getByLabel('E-Mail-Adresse')).toHaveAttribute('autocomplete', 'username')
    const pw = page.getByLabel('Passwort', { exact: true })
    await expect(pw).toHaveAttribute('autocomplete', 'current-password')
    await pw.fill('Geheim12345')
    await expect(pw).toHaveAttribute('type', 'password')
    await page.getByRole('button', { name: 'Passwort anzeigen' }).click()
    await expect(pw).toHaveAttribute('type', 'text')
    await page.getByRole('button', { name: 'Passwort verbergen' }).click()
    await expect(pw).toHaveAttribute('type', 'password')
  })

  test('Fehlermeldungen sind dem Feld zugeordnet', async ({ page }) => {
    await page.goto('/anmelden')
    await page.getByRole('button', { name: 'Anmelden' }).click()
    const email = page.getByLabel('E-Mail-Adresse')
    await expect(email).toHaveAttribute('aria-invalid', 'true')
    const describedBy = await email.getAttribute('aria-describedby')
    expect(describedBy).toBeTruthy()
    // shadcn verweist auch auf eine (hier nicht vorhandene) Beschreibung; maßgeblich ist die Meldung
    const messages = page.locator(describedBy!.split(' ').map((id) => `[id="${id}"]`).join(', '))
    await expect(messages).toContainText('Bitte gib deine E-Mail-Adresse ein.')
  })
})
