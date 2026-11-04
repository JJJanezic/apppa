import { randomUUID } from 'node:crypto'

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

// PROJ-39: Einstellungen → Rechnungen. Grundumfang aus dem Frontend (Reiter, Zugang, Schalter verschoben).
// Speicherfunktionen, Rechte und Vorbelegung: Integrationstests aus /backend; Abläufe in der Oberfläche ergänzt /qa.
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

test.describe('Reiter und Zugang', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('AC: Reiter „Rechnungen“ mit eigener Adresse, Titel und vier Abschnitten', async ({ page, users }) => {
    desktopOnly()
    const owner = await users()
    await createTenant('QA39 Reiter', [{ user: owner, role: 'owner' }])
    await signInAs(page, owner)
    await page.goto('/einstellungen/stammdaten')
    await ready(page)
    const tabs = page.getByRole('navigation', { name: 'Einstellungsbereiche' }).getByRole('link')
    await expect(tabs).toHaveText(['Stammdaten', 'Team', 'Wohnungen', 'Briefpapier', 'Rechnungen'])
    await tabs.last().click()
    await expect(page).toHaveURL(/\/einstellungen\/rechnungen$/)
    await expect(tabs.last()).toHaveAttribute('aria-current', 'page')
    await expect(page).toHaveTitle(/Rechnungen/)
    for (const name of ['Nummernkreis', 'Textbausteine', 'Feste Texte', 'Nacherfassen']) {
      await expect(page.getByRole('heading', { level: 2, name })).toBeVisible()
    }
  })

  test('AC: Mitarbeiter erhält „Seite nicht gefunden“', async ({ page, users }) => {
    desktopOnly()
    const owner = await users()
    const staff = await users()
    await createTenant('QA39 Mitarbeiter', [
      { user: owner, role: 'owner' },
      { user: staff, role: 'staff' },
    ])
    await signInAs(page, staff)
    const response = await page.goto('/einstellungen/rechnungen')
    expect(response?.status()).toBe(404)
    await expect(page.getByRole('heading', { name: 'Seite nicht gefunden' })).toBeVisible()
  })

  test('AC: Stammdaten ohne Schalter „Rechnungen nacherfassen“; Schalter unter Rechnungen', async ({ page, users }) => {
    desktopOnly()
    const owner = await users()
    await createTenant('QA39 Schalter', [{ user: owner, role: 'owner' }])
    await signInAs(page, owner)
    await page.goto('/einstellungen/stammdaten')
    await ready(page)
    await expect(page.getByLabel('Kundenname')).toBeVisible()
    await expect(page.getByRole('switch', { name: 'Rechnungen nacherfassen' })).toHaveCount(0)
    await page.goto('/einstellungen/rechnungen')
    await ready(page)
    await expect(page.getByRole('switch', { name: 'Rechnungen nacherfassen' })).toBeChecked()
  })
})

// ---- Abläufe in der Oberfläche (/qa) ------------------------------------------------------------------------------

const panel = (page: Page) => page.getByRole('dialog')
const year = () => new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Vienna' }).slice(0, 4)
const nextNumber = (page: Page) => page.getByTestId('next-invoice-number')
const blockList = (page: Page, kind: 'intro' | 'payment' | 'closing') => page.getByTestId(`text-blocks-${kind}`)

async function ownerWithTenant(users: Fixtures['users'], name: string) {
  const owner = await users({ displayName: 'Olga Owner' })
  const tenantId = await createTenant(`QA39 ${name} ${randomUUID().slice(0, 8)}`, [{ user: owner, role: 'owner' }])
  return { owner, tenantId }
}

async function openSettings(page: Page) {
  await page.goto('/einstellungen/rechnungen')
  await ready(page)
  // genau ein Formular: Die Seite wird nicht im Browser ein zweites Mal aufgebaut (BUG-2)
  await expect(page.locator('input[name=prefix]')).toHaveCount(1)
}

async function settingsRow(tenantId: string) {
  return (await service().from('invoice_settings').select('*').eq('tenant_id', tenantId).single()).data!
}

async function blockRows(tenantId: string) {
  return (await service().from('invoice_text_blocks').select('*').eq('tenant_id', tenantId)).data ?? []
}

async function addNumbers(tenantId: string, numbers: string[]) {
  const rows = numbers.map((number) => ({ tenant_id: tenantId, number, invoice_date: '2026-01-15', recipient: 'Alt KG', total_cents: 100 }))
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await service().from('invoices').insert(rows.slice(i, i + 500) as never)
    if (error) throw error
  }
}

// Schreibfläche des Editors (Tiptap) unter der Bezeichnung
const editor = (scope: Page | ReturnType<Page['getByRole']>, label: string) => scope.getByRole('textbox', { name: label, exact: true })

async function typeInto(page: Page, box: ReturnType<Page['getByRole']>, text: string, { clear = false } = {}) {
  await box.click()
  if (clear) {
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.press('Backspace')
  }
  await page.keyboard.type(text)
}

async function openNewBlock(page: Page, kind: 'intro' | 'payment' | 'closing') {
  await blockList(page, kind).getByRole('button', { name: 'Baustein hinzufügen' }).click()
  await expect(panel(page).getByRole('heading', { name: 'Neuer Baustein' })).toBeVisible()
  await expect(editor(panel(page), 'Text')).toBeVisible()
}

async function blockMenu(page: Page, name: string, item: string) {
  await page.getByRole('button', { name: `Aktionen für ${name}` }).click()
  await page.getByRole('menuitem', { name: item }).click()
}

test.describe('Nummernkreis', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('AC: Voreinstellung, Vorschau vor dem Speichern, Speichern mit und ohne Präfix', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await ownerWithTenant(users, 'Nummer')
    await signInAs(page, owner)
    await openSettings(page)
    await expect(page.getByLabel('Präfix')).toHaveValue('')
    await expect(page.getByRole('switch', { name: 'Mit Jahreszahl' })).toBeChecked()
    await expect(page.getByRole('combobox', { name: 'Trennzeichen' })).toHaveText('„-“')
    await expect(page.getByRole('combobox', { name: 'Stellen' })).toContainText('4')
    await expect(page.getByRole('switch', { name: 'Jährlich neu beginnen' })).toBeChecked()
    await expect(page.getByLabel('Startnummer')).toHaveValue('1')
    await expect(nextNumber(page)).toHaveText(`${year()}-0001`)

    // Vorschau rechnet sofort, noch vor dem Speichern
    await page.getByLabel('Präfix').fill('R-')
    await page.getByRole('combobox', { name: 'Trennzeichen' }).click()
    await page.getByRole('option', { name: '„/“' }).click()
    await expect(nextNumber(page)).toHaveText(`R-${year()}/0001`)
    expect((await settingsRow(tenantId)).number_prefix).toBe('')

    await page.getByRole('button', { name: 'Nummernkreis speichern' }).click()
    await expect(page.getByText('Nummernkreis gespeichert.')).toBeVisible()
    await expect.poll(async () => (await settingsRow(tenantId)).number_prefix).toBe('R-')
    expect((await settingsRow(tenantId)).number_separator).toBe('/')

    // Präfix wieder leer: Nummer beginnt mit der Jahreszahl
    await page.reload()
    await ready(page)
    await expect(page.getByLabel('Präfix')).toHaveValue('R-')
    await page.getByLabel('Präfix').fill('')
    await page.getByRole('button', { name: 'Nummernkreis speichern' }).click()
    await expect.poll(async () => (await settingsRow(tenantId)).number_prefix).toBe('')
    await expect(nextNumber(page)).toHaveText(`${year()}/0001`)
  })

  test('AC: ungültiges Präfix, Startnummer 0/negativ/Komma und „jährlich neu“ ohne Jahreszahl', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await ownerWithTenant(users, 'Nummer falsch')
    await signInAs(page, owner)
    await openSettings(page)
    const before = await settingsRow(tenantId)
    const save = page.getByRole('button', { name: 'Nummernkreis speichern' })

    for (const prefix of ['R #', 'ABCDEFGHIJK']) {
      await page.getByLabel('Präfix').fill(prefix)
      await save.click()
      await expect(page.getByText(prefix.length > 10 ? 'Das Präfix darf höchstens 10 Zeichen haben.' : /Im Präfix sind nur Buchstaben/)).toBeVisible()
    }
    await page.getByLabel('Präfix').fill('')
    for (const start of ['0', '-3', '1,5']) {
      await page.getByLabel('Startnummer').fill(start)
      await save.click()
      await expect(page.getByText('Bitte gib als Startnummer eine ganze Zahl ab 1 ein.')).toBeVisible()
    }
    expect((await settingsRow(tenantId)).numbering_updated_at).toBe(before.numbering_updated_at)

    // ohne Jahreszahl: „jährlich neu“ gesperrt mit Hinweis
    await page.getByLabel('Startnummer').fill('1')
    await page.getByRole('switch', { name: 'Mit Jahreszahl' }).click()
    const yearly = page.getByRole('switch', { name: 'Jährlich neu beginnen' })
    await expect(yearly).toBeDisabled()
    await expect(yearly).not.toBeChecked()
    await expect(page.getByText('Jährlich neu beginnen geht nur mit Jahreszahl.')).toBeVisible()
    await expect(nextNumber(page)).toHaveText('0001')
  })

  test('AC: Vorschau setzt nacherfasste Nummern fort (2026-0043, ALT-17, Vorjahr, R-00124, 999 → 1000)', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await ownerWithTenant(users, 'Folge')
    const y = year()
    await addNumbers(tenantId, ['ALT-17', `${Number(y) - 1}-0118`])
    await signInAs(page, owner)
    await openSettings(page)
    // nur Altnummer und Vorjahr: neues Jahr beginnt bei der Startnummer
    await expect(nextNumber(page)).toHaveText(`${y}-0001`)

    await addNumbers(tenantId, [`${y}-0041`, `${y}-0042`])
    await page.reload()
    await ready(page)
    await expect(nextNumber(page)).toHaveText(`${y}-0043`)
    // unabhängig von der Startnummer, mit Hinweis
    await page.getByLabel('Startnummer').fill('5')
    await expect(nextNumber(page)).toHaveText(`${y}-0043`)
    await expect(page.getByText('Es gibt bereits passende Rechnungen. Die Startnummer gilt nur, solange es keine gibt.')).toBeVisible()

    // ohne Jahreszahl, Präfix R-, 5 Stellen
    await addNumbers(tenantId, ['R-00123', `${y}-999`])
    await page.reload()
    await ready(page)
    await page.getByLabel('Präfix').fill('R-')
    await page.getByRole('switch', { name: 'Mit Jahreszahl' }).click()
    await page.getByRole('combobox', { name: 'Stellen' }).click()
    await page.getByRole('option', { name: /^5/ }).click()
    await expect(nextNumber(page)).toHaveText('R-00124')

    // 3 Stellen: 999 → 1000 (Stellen wachsen weiter); 2026-0041/42 sind ebenfalls „2026-“ + Ziffern → höchste ist 999
    await page.getByLabel('Präfix').fill('')
    await page.getByRole('switch', { name: 'Mit Jahreszahl' }).click()
    await page.getByRole('combobox', { name: 'Stellen' }).click()
    await page.getByRole('option', { name: /^3/ }).click()
    await expect(nextNumber(page)).toHaveText(`${y}-1000`)
  })

  test('Grenzfall: Vorschau bei mehr als 1.000 Rechnungen des Kunden', async ({ page, users }) => {
    desktopOnly()
    test.setTimeout(90_000)
    const { owner, tenantId } = await ownerWithTenant(users, 'Viele')
    const y = year()
    await addNumbers(tenantId, Array.from({ length: 1100 }, (_, i) => `${y}-${String(i + 1).padStart(4, '0')}`))
    await signInAs(page, owner)
    await openSettings(page)
    await expect(nextNumber(page)).toHaveText(`${y}-1101`)
  })

  test('AC: Konflikt – zwischenzeitlich geänderter Nummernkreis wird nicht überschrieben', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await ownerWithTenant(users, 'Konflikt')
    await signInAs(page, owner)
    await openSettings(page)
    // jemand anderes speichert inzwischen
    await service().from('invoice_settings').update({ number_prefix: 'X-', numbering_updated_at: new Date().toISOString() }).eq('tenant_id', tenantId)
    await page.getByLabel('Präfix').fill('R-')
    await page.getByRole('button', { name: 'Nummernkreis speichern' }).click()
    await expect(page.getByText('Die Einstellungen wurden inzwischen geändert. Deine Eingaben sind noch nicht gespeichert.')).toBeVisible()
    expect((await settingsRow(tenantId)).number_prefix).toBe('X-')
    await page.getByRole('button', { name: 'Aktuelle Fassung laden' }).click()
    await expect(page.getByLabel('Präfix')).toHaveValue('X-')
  })
})

test.describe('Textbausteine', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('AC: Vorbelegung mit Standard oben, Anlegen, Pflichtfelder, doppelter Name je Block', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await ownerWithTenant(users, 'Bausteine')
    await signInAs(page, owner)
    await openSettings(page)
    await expect(blockList(page, 'intro').getByRole('listitem')).toHaveCount(1)
    await expect(blockList(page, 'payment').getByRole('listitem')).toHaveCount(2)
    await expect(blockList(page, 'closing').getByRole('listitem')).toHaveCount(1)
    const payment = blockList(page, 'payment').getByRole('listitem')
    await expect(payment.first()).toContainText('Überweisung 14 Tage')
    await expect(payment.first()).toContainText('Standard')
    await expect(payment.last()).toContainText('Anzahlung 20 %, Rest vor Anreise')
    await expect(payment.last()).not.toContainText('Standard')

    // Pflichtfelder
    await openNewBlock(page, 'closing')
    await panel(page).getByRole('button', { name: 'Baustein speichern' }).click()
    await expect(panel(page).getByText('Bitte gib einen Namen ein.')).toBeVisible()
    await expect(panel(page).getByText('Bitte gib einen Text ein.')).toBeVisible()

    // doppelter Name (Groß-/Kleinschreibung egal) im selben Block
    await panel(page).getByLabel('Name').fill('nächster besuch')
    await typeInto(page, editor(panel(page), 'Text'), 'Auf Wiedersehen!')
    await panel(page).getByRole('button', { name: 'Baustein speichern' }).click()
    await expect(panel(page).getByText('Dieser Name ist in diesem Block bereits vergeben.')).toBeVisible()
    expect((await blockRows(tenantId)).length).toBe(4)

    // zu lang
    await panel(page).getByLabel('Name').fill('N'.repeat(61))
    await panel(page).getByRole('button', { name: 'Baustein speichern' }).click()
    await expect(panel(page).getByText('Der Name darf höchstens 60 Zeichen haben.')).toBeVisible()

    await panel(page).getByLabel('Name').fill('Auf Wiedersehen')
    await panel(page).getByRole('button', { name: 'Baustein speichern' }).click()
    await expect(page.getByText('Baustein angelegt.')).toBeVisible()
    await expect(blockList(page, 'closing').getByRole('listitem')).toHaveCount(2)
    // Standard zuerst, dann nach Name
    await expect(blockList(page, 'closing').getByRole('listitem').first()).toContainText('Nächster Besuch')
    await expect(blockList(page, 'closing').getByRole('listitem').last()).toContainText('Auf Wiedersehen')

    // gleicher Name in einem anderen Block erlaubt
    await openNewBlock(page, 'intro')
    await panel(page).getByLabel('Name').fill('Nächster Besuch')
    await typeInto(page, editor(panel(page), 'Text'), 'Willkommen zurück, {Gast}!')
    await panel(page).getByRole('button', { name: 'Baustein speichern' }).click()
    await expect(blockList(page, 'intro').getByRole('listitem')).toHaveCount(2)
    expect((await blockRows(tenantId)).length).toBe(6)
  })

  test('AC: Text über 2.000 Zeichen wird mit Grenze abgelehnt', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await ownerWithTenant(users, 'Lang')
    await signInAs(page, owner)
    await openSettings(page)
    await openNewBlock(page, 'intro')
    await panel(page).getByLabel('Name').fill('Lang')
    await editor(panel(page), 'Text').click()
    await page.keyboard.insertText('x'.repeat(2001))
    await expect(panel(page).getByText('2.001 / 2.000 Zeichen')).toBeVisible()
    await panel(page).getByRole('button', { name: 'Baustein speichern' }).click()
    await expect(panel(page).getByText('Der Text ist zu lang: 2.001 von höchstens 2.000 Zeichen.')).toBeVisible()
    expect((await blockRows(tenantId)).length).toBe(4)
  })

  test('AC: Standard wechseln, aufheben, Standard löschen; anderer Kunde unberührt', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await ownerWithTenant(users, 'Standard')
    const other = await ownerWithTenant(users, 'Anderer')
    await signInAs(page, owner)
    await openSettings(page)

    await blockMenu(page, 'Anzahlung 20 %, Rest vor Anreise', 'Als Standard setzen')
    await expect(page.getByText('Standard gesetzt.')).toBeVisible()
    const payment = blockList(page, 'payment')
    await expect(payment.getByRole('listitem').first()).toContainText('Anzahlung 20 %, Rest vor Anreise')
    await expect(payment.getByText('Standard', { exact: true })).toHaveCount(1)

    await blockMenu(page, 'Anzahlung 20 %, Rest vor Anreise', 'Standard aufheben')
    await expect(page.getByText('Standard aufgehoben.')).toBeVisible()
    await expect(payment.getByText('Kein Standard – der Block beginnt im Entwurf leer.')).toBeVisible()
    await expect(payment.getByText('Standard', { exact: true })).toHaveCount(0)

    // Standard löschen → Block ohne Standard
    await blockMenu(page, 'Dank für den Aufenthalt', 'Löschen')
    await expect(page.getByRole('alertdialog')).toContainText('Der Baustein ist der Standard dieses Blocks.')
    await page.getByRole('alertdialog').getByRole('button', { name: 'Löschen' }).click()
    await expect(page.getByText('Baustein gelöscht.')).toBeVisible()
    await expect(blockList(page, 'intro').getByText('Noch keine Bausteine.')).toBeVisible()
    await expect(blockList(page, 'intro').getByText('Kein Standard – der Block beginnt im Entwurf leer.')).toBeVisible()

    const rows = await blockRows(tenantId)
    expect(rows.filter((r) => r.is_default).map((r) => r.block).sort()).toEqual(['closing'])
    // eigener Kunde geändert, anderer nicht
    const others = await blockRows(other.tenantId)
    expect(others).toHaveLength(4)
    expect(others.filter((r) => r.is_default)).toHaveLength(3)
  })

  test('AC: Konflikt bei Standard und gelöschter Baustein beim Bearbeiten', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await ownerWithTenant(users, 'Konflikt Baustein')
    await signInAs(page, owner)
    await openSettings(page)
    const rows = await blockRows(tenantId)
    const deposit = rows.find((r) => r.name.startsWith('Anzahlung'))!
    const transfer = rows.find((r) => r.name.startsWith('Überweisung'))!

    // jemand anders hebt den Standard inzwischen auf
    await service().from('invoice_text_blocks').update({ is_default: false }).eq('id', transfer.id)
    await blockMenu(page, 'Anzahlung 20 %, Rest vor Anreise', 'Als Standard setzen')
    await expect(page.getByText('Die Einstellungen wurden inzwischen geändert. Deine Eingaben sind noch nicht gespeichert.')).toBeVisible()
    expect((await blockRows(tenantId)).find((r) => r.id === deposit.id)!.is_default).toBe(false)

    // Baustein inzwischen gelöscht
    await page.reload()
    await ready(page)
    await page.getByRole('button', { name: /^Nächster Besuch/ }).click()
    await expect(panel(page).getByRole('heading', { name: 'Baustein bearbeiten' })).toBeVisible()
    await service().from('invoice_text_blocks').delete().eq('tenant_id', tenantId).eq('block', 'closing')
    await panel(page).getByLabel('Name').fill('Nächster Besuch neu')
    await panel(page).getByRole('button', { name: 'Baustein speichern' }).click()
    await expect(panel(page).getByText('Dieser Baustein existiert nicht mehr. Er wurde inzwischen gelöscht.')).toBeVisible()
  })

  test('AC: 20 Bausteine je Block sperren „Baustein hinzufügen“', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await ownerWithTenant(users, 'Voll')
    const body = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Danke' }] }] }
    const { error } = await service()
      .from('invoice_text_blocks')
      .insert(Array.from({ length: 19 }, (_, i) => ({ tenant_id: tenantId, block: 'closing', name: `Gruß ${i + 1}`, body })) as never)
    expect(error).toBeNull()
    await signInAs(page, owner)
    await openSettings(page)
    await expect(blockList(page, 'closing').getByRole('button', { name: 'Baustein hinzufügen' })).toBeDisabled()
    await expect(blockList(page, 'closing').getByText('Höchstens 20 Bausteine je Block. Lösche einen, um einen neuen anzulegen.')).toBeVisible()
    await expect(blockList(page, 'intro').getByRole('button', { name: 'Baustein hinzufügen' })).toBeEnabled()
  })
})

test.describe('Zahlungsregeln, Editor und Vorschau', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('AC: Zahlungsregeln, Grenzen und Vorschau mit berechneten Werten', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await ownerWithTenant(users, 'Zahlung')
    await signInAs(page, owner)
    await openSettings(page)
    await openNewBlock(page, 'payment')
    const p = panel(page)
    await expect(p.getByRole('switch', { name: 'Anzahlung' })).not.toBeChecked()
    await expect(p.getByLabel('Fälligkeit', { exact: true })).toBeVisible()
    await expect(p.getByRole('radio', { name: 'Tage nach Rechnungsdatum' })).toBeVisible()
    await expect(p.getByRole('radio', { name: 'Tage vor Anreise' })).toBeVisible()

    // ohne Anzahlung: Anzahlungs-Platzhalter nicht erlaubt
    await p.getByLabel('Name').fill('Anzahlung 30')
    await p.getByLabel('Fälligkeit', { exact: true }).fill('14')
    await typeInto(page, editor(p, 'Text'), 'Bitte {Anzahlung} bis {Anzahlung fällig}, Rest {Restbetrag} bis {Fälligkeitsdatum}.')
    await p.getByRole('button', { name: 'Baustein speichern' }).click()
    await expect(p.getByText(/Dieser Platzhalter ist nur bei Bausteinen mit Anzahlung möglich: \{Anzahlung\}/)).toBeVisible()

    // mit Anzahlung: Prozent und Frist Pflicht, Grenzen
    await p.getByRole('switch', { name: 'Anzahlung' }).click()
    await expect(p.getByText(/nur bei Bausteinen mit Anzahlung/)).toHaveCount(0)
    await p.getByRole('button', { name: 'Baustein speichern' }).click()
    await expect(p.getByText('Bitte gib die Anzahlung in Prozent ein.')).toBeVisible()
    await expect(p.getByText('Bitte gib die Anzahl der Tage ein.')).toBeVisible()
    for (const bad of ['0', '100,5', '12,345']) {
      await p.getByLabel('Anzahlung in Prozent').fill(bad)
      await p.getByRole('button', { name: 'Baustein speichern' }).click()
      await expect(p.getByText('Bitte gib 1 bis 100 Prozent mit höchstens 2 Nachkommastellen ein.')).toBeVisible()
    }
    for (const bad of ['366', '-1', '2,5']) {
      await p.getByLabel('Anzahlung fällig nach').fill(bad)
      await p.getByRole('button', { name: 'Baustein speichern' }).click()
      await expect(p.getByText('Bitte gib eine ganze Zahl von 0 bis 365 Tagen ein.')).toBeVisible()
    }
    expect((await blockRows(tenantId)).length).toBe(4)

    // 20 % binnen 3 Tagen, Rest 1 Tag vor Anreise: Beispiel 01.10.2026, Anreise 14.10.2026, € 450,00
    await p.getByLabel('Anzahlung in Prozent').fill('20')
    await p.getByLabel('Anzahlung fällig nach').fill('3')
    await p.getByLabel('Fälligkeit des Rests').fill('1')
    await p.getByRole('radio', { name: 'Tage vor Anreise' }).click()
    await expect(p.getByText(/Bitte €\s90,00 bis 04\.10\.2026, Rest €\s360,00 bis 13\.10\.2026\./)).toBeVisible()
    await p.getByRole('button', { name: 'Baustein speichern' }).click()
    await expect(page.getByText('Baustein angelegt.')).toBeVisible()
    const saved = (await blockRows(tenantId)).find((r) => r.name === 'Anzahlung 30')!
    expect([Number(saved.deposit_percent), saved.deposit_days, saved.due_days, saved.due_basis]).toEqual([20, 3, 1, 'before_arrival'])

    // Anzahlung „nein“ nach dem Ausfüllen: Prozent und Frist werden nicht gespeichert
    await page.getByRole('button', { name: /^Anzahlung 30/ }).click()
    await expect(panel(page).getByLabel('Anzahlung in Prozent')).toHaveValue('20')
    await panel(page).getByRole('switch', { name: 'Anzahlung' }).click()
    await typeInto(page, editor(panel(page), 'Text'), 'Bitte überweisen Sie {Betrag} bis {Fälligkeitsdatum}.', { clear: true })
    await panel(page).getByRole('button', { name: 'Baustein speichern' }).click()
    await expect(page.getByText('Baustein gespeichert.')).toBeVisible()
    await expect
      .poll(async () => {
        const r = (await blockRows(tenantId)).find((x) => x.name === 'Anzahlung 30')!
        return [r.deposit_percent, r.deposit_days, r.due_days]
      })
      .toEqual([null, null, 1])
  })

  test('AC: Platzhalter-Auswahl je Block, getippte Platzhalter, unbekannte und unzulässige', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await ownerWithTenant(users, 'Platzhalter')
    await signInAs(page, owner)
    await openSettings(page)
    const base = ['{Anrede}', '{Gast}', '{Wohnung}', '{Anreise}', '{Abreise}', '{Nächte}', '{Rechnungsnummer}', '{Rechnungsdatum}', '{Betrag}']

    await openNewBlock(page, 'intro')
    await panel(page).getByRole('button', { name: 'Platzhalter einfügen' }).click()
    await expect(page.getByRole('menuitem')).toHaveText(base)
    await page.getByRole('menuitem', { name: '{Anrede}' }).click()
    // Fokus kehrt in die Schreibfläche zurück (BUG-1); erst danach tippen, sofortiges Tippen siehe BUG-7
    await expect(page.getByRole('menu')).toHaveCount(0)
    await expect(editor(panel(page), 'Text')).toBeFocused()
    // getippt wie eingefügt; Vorschau mit Beispieldaten, Datum ohne Wochentag
    await page.keyboard.type(', willkommen in {Wohnung} am {Anreise}.')
    await expect(panel(page).getByText('Sehr geehrte Frau Mag. Muster, willkommen in Top 1 am 14.10.2026.')).toBeVisible()

    // unbekannt und in diesem Block nicht erlaubt
    await page.keyboard.type(' {Gastname} {Fälligkeitsdatum}')
    await panel(page).getByLabel('Name').fill('Platzhalter')
    await panel(page).getByRole('button', { name: 'Baustein speichern' }).click()
    await expect(panel(page).getByText(/Unbekannter Platzhalter: \{Gastname\}/)).toBeVisible()
    await expect(panel(page).getByText(/Der Platzhalter \{Fälligkeitsdatum\} ist in diesem Block nicht erlaubt\./)).toBeVisible()
    expect((await blockRows(tenantId)).length).toBe(4)
    await panel(page).getByRole('button', { name: 'Abbrechen' }).click()

    // Block 6: mit Fälligkeitsdatum, Anzahlungs-Platzhalter nur mit Anzahlung
    await openNewBlock(page, 'payment')
    await panel(page).getByRole('button', { name: 'Platzhalter einfügen' }).click()
    await expect(page.getByRole('menuitem')).toHaveText([...base, '{Fälligkeitsdatum}'])
    await page.keyboard.press('Escape')
    await panel(page).getByRole('switch', { name: 'Anzahlung' }).click()
    await panel(page).getByRole('button', { name: 'Platzhalter einfügen' }).click()
    await expect(page.getByRole('menuitem')).toHaveText([...base, '{Fälligkeitsdatum}', '{Anzahlung}', '{Anzahlung fällig}', '{Restbetrag}'])
  })

  test('BUG-1: Nach „Platzhalter einfügen“ bleibt der Fokus in der Schreibfläche', async ({ page, users }) => {
    desktopOnly()
    const { owner } = await ownerWithTenant(users, 'Fokus')
    await signInAs(page, owner)
    await openSettings(page)
    await openNewBlock(page, 'intro')
    await typeInto(page, editor(panel(page), 'Text'), 'Hallo ')
    await panel(page).getByRole('button', { name: 'Platzhalter einfügen' }).click()
    await page.getByRole('menuitem', { name: '{Gast}' }).click()
    // Menü ist zu (samt Animation); Weitertippen landet im Text
    await expect(page.getByRole('menu')).toHaveCount(0)
    await page.waitForTimeout(500)
    await expect(editor(panel(page), 'Text')).toBeFocused()
    await page.keyboard.type(' und willkommen')
    await expect(editor(panel(page), 'Text')).toHaveText('Hallo {Gast} und willkommen')
  })

  test('BUG-7: Sofort nach „Platzhalter einfügen“ weitertippen – nichts geht verloren, kein doppelter Platzhalter', async ({ page, users }) => {
    desktopOnly()
    const { owner } = await ownerWithTenant(users, 'Sofort')
    await signInAs(page, owner)
    await openSettings(page)
    await openNewBlock(page, 'intro')
    const box = editor(panel(page), 'Text')
    await typeInto(page, box, 'Hallo')
    // wie schnelles Tippen: ohne Pause nach der Auswahl (während das Menü noch ausblendet)
    for (let i = 0; i < 3; i++) {
      await panel(page).getByRole('button', { name: 'Platzhalter einfügen' }).click()
      await page.getByRole('menuitem', { name: '{Gast}' }).click()
      await page.keyboard.type(` und${i}`)
      await expect(page.getByRole('menu')).toHaveCount(0)
    }
    await expect(box).toHaveText('Hallo{Gast} und0{Gast} und1{Gast} und2')
  })

  test('AC: Fett, Kursiv, Listen; Einfügen aus Word/Webseite behält nur erlaubte Formatierungen', async ({ page, users }) => {
    desktopOnly()
    // Firefox reicht den Inhalt eines selbst gebauten DataTransfer beim künstlichen Einfügen nicht weiter (Testgrenze, kein App-Fehler)
    test.skip(test.info().project.name === 'firefox', 'künstliches Einfügen in Firefox nicht möglich')
    const { owner, tenantId } = await ownerWithTenant(users, 'Einfügen')
    await signInAs(page, owner)
    await openSettings(page)
    await openNewBlock(page, 'closing')
    const p = panel(page)
    const toolbar = p.getByRole('toolbar', { name: 'Formatierung' })
    await expect(toolbar.getByRole('button', { name: 'Fett' })).toBeVisible()
    await expect(toolbar.getByRole('button', { name: 'Kursiv' })).toBeVisible()
    await expect(toolbar.getByRole('button', { name: 'Aufzählung' })).toBeVisible()
    await expect(toolbar.getByRole('button', { name: 'Nummerierte Liste' })).toBeVisible()
    await expect(toolbar.getByRole('button')).toHaveCount(10) // dazu 4 × Ausrichtung, Code, „Platzhalter einfügen“

    await p.getByLabel('Name').fill('Eingefügt')
    await editor(p, 'Text').click()
    await page.evaluate(() => {
      const html =
        '<h1 style="color:red;font-family:Comic Sans MS">Titel</h1>' +
        '<p><b>Fett</b> und <i>kursiv</i> mit <a href="https://evil.example">Link</a> <span style="color:#f00;font-size:30px">rot</span>' +
        '<img src="https://evil.example/x.png" onerror="alert(1)"></p>' +
        '<table><tr><td>Zelle A</td><td>Zelle B</td></tr></table>' +
        '<ul><li>Punkt 1</li><li>Punkt 2</li></ul><script>window.__pwned = 1</script>'
      const dt = new DataTransfer()
      dt.setData('text/html', html)
      dt.setData('text/plain', 'Titel')
      document.activeElement!.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }))
    })
    const box = editor(p, 'Text')
    // Tabellenzellen als eigene Absätze statt zusammengeklebt (BUG-4)
    await expect(box.locator('p').filter({ hasText: /^Zelle A$/ })).toHaveCount(1)
    await expect(box.locator('p').filter({ hasText: /^Zelle B$/ })).toHaveCount(1)
    await expect(box.locator('a, img, table, h1, script, [style]')).toHaveCount(0)
    await expect(box.locator('strong')).toHaveText('Fett')
    await expect(box.locator('em')).toHaveText('kursiv')
    await expect(box.locator('ul li')).toHaveCount(2)

    await p.getByRole('button', { name: 'Baustein speichern' }).click()
    await expect(page.getByText('Baustein angelegt.')).toBeVisible()
    const saved = (await blockRows(tenantId)).find((r) => r.name === 'Eingefügt')!
    const json = JSON.stringify(saved.body)
    expect(json).not.toMatch(/"(href|link|style|textStyle|color|image|table|tableCell|heading|attrs)"|evil/)
    expect(json).toContain('"bold"')
    expect(json).toContain('"bulletList"')
    expect(await page.evaluate(() => (window as unknown as { __pwned?: number }).__pwned)).toBeUndefined()
  })
})

test.describe('Feste Texte und Schalter', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('AC: Vorbelegung, Pflicht-Hinweis, Fußzeile bleibt nach Neuladen, keine Platzhalter', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await ownerWithTenant(users, 'Feste Texte')
    await signInAs(page, owner)
    await openSettings(page)
    const note = editor(page, 'Kleinunternehmer-Hinweis')
    const footer = editor(page, 'Fußzeile')
    await expect(note).toHaveText('Umsatzsteuerfrei aufgrund der Kleinunternehmerregelung gemäß § 6 Abs. 1 Z 27 UStG')
    await expect(footer).toHaveText('')
    await expect(page.getByText(/Erscheint nach den Leistungen nur, wenn für die Rechnung der Kleinunternehmer-Status gilt/)).toBeVisible()
    const fixed = page.locator('form').filter({ has: page.getByRole('button', { name: 'Feste Texte speichern' }) })
    await expect(fixed.getByRole('button', { name: 'Platzhalter einfügen' })).toHaveCount(0)
    const save = page.getByRole('button', { name: 'Feste Texte speichern' })

    // leer → Pflicht
    await typeInto(page, note, '', { clear: true })
    await save.click()
    await expect(page.getByText('Der Kleinunternehmer-Hinweis darf nicht leer sein.')).toBeVisible()
    // zu lang
    await note.click()
    await page.keyboard.insertText('k'.repeat(501))
    await save.click()
    await expect(page.getByText('Der Text ist zu lang: 501 von höchstens 500 Zeichen.')).toBeVisible()
    // Fehlerzustand für Screenreader, auch nach weiteren Eingaben (useEditor setzt die Attribute je Rendern neu)
    await expect(note).toHaveAttribute('aria-invalid', 'true')
    await expect(note).toHaveAccessibleDescription(/Der Text ist zu lang: 501 von höchstens 500 Zeichen\./)
    await expect(footer).toHaveAttribute('aria-invalid', 'false')
    // getippter Platzhalter in fester Text = unbekannt
    await typeInto(page, note, 'Steuerfrei als Kleinunternehmer.', { clear: true })
    await typeInto(page, footer, 'IBAN AT61 1904 3002 3457 3201 · {Gast}')
    await save.click()
    await expect(page.getByText('Unbekannter Platzhalter: {Gast}')).toBeVisible()
    expect((await settingsRow(tenantId)).footer).toBeNull()

    await footer.click()
    for (let i = 0; i < ' · {Gast}'.length; i++) await page.keyboard.press('Backspace')
    await save.click()
    await expect(page.getByText('Feste Texte gespeichert.')).toBeVisible()
    await page.reload()
    await ready(page)
    await expect(editor(page, 'Kleinunternehmer-Hinweis')).toHaveText('Steuerfrei als Kleinunternehmer.')
    await expect(editor(page, 'Fußzeile')).toHaveText('IBAN AT61 1904 3002 3457 3201')
  })

  test('AC: Fehler beim Speichern lässt Eingaben stehen, gespeichert bleibt der alte Stand', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await ownerWithTenant(users, 'Offline')
    await signInAs(page, owner)
    await openSettings(page)
    await typeInto(page, editor(page, 'Fußzeile'), 'Bank Muster')
    await page.route('**/einstellungen/rechnungen', (route) => (route.request().method() === 'POST' ? route.abort() : route.continue()))
    await page.getByRole('button', { name: 'Feste Texte speichern' }).click()
    await expect(page.getByText('Keine Verbindung. Bitte prüfe deine Internetverbindung und versuche es erneut.')).toBeVisible()
    await expect(editor(page, 'Fußzeile')).toHaveText('Bank Muster')
    expect((await settingsRow(tenantId)).footer).toBeNull()
  })

  test('AC: Schalter aus → Rechnungsliste ohne „Rechnung nacherfassen“; Hinweis verweist hierher', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await ownerWithTenant(users, 'Schalter aus')
    await signInAs(page, owner)
    await openSettings(page)
    await page.getByRole('switch', { name: 'Rechnungen nacherfassen' }).click()
    await page.getByRole('button', { name: 'Schalter speichern' }).click()
    await expect(page.getByText('Einstellung gespeichert.')).toBeVisible()
    await expect.poll(async () => (await settingsRow(tenantId)).backfill_enabled).toBe(false)
    await page.goto('/rechnungen')
    await ready(page)
    await expect(page.getByRole('heading', { level: 1, name: 'Rechnungen' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Rechnung nacherfassen' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Rechnung nacherfassen' })).toHaveCount(0)
  })
})

test.describe('Betreiber', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('AC: Abschnitt „Rechnungen“ bei aktivem Kunden bedienbar, Inhaber sieht die Änderung, Protokoll ohne Text', async ({ browser, page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await ownerWithTenant(users, 'Betreiber')
    const admin = await users({ admin: true, displayName: 'Bea Betreiber' })
    await signInAsAdmin(page, admin)
    await page.goto(`/betreiber/kunden/${tenantId}`)
    await ready(page)
    for (const name of ['Nummernkreis', 'Textbausteine', 'Feste Texte', 'Nacherfassen']) {
      await expect(page.getByRole('heading', { level: 3, name })).toBeVisible()
    }
    await page.getByLabel('Präfix').fill('RE')
    await page.getByRole('button', { name: 'Nummernkreis speichern' }).click()
    await expect(page.getByText('Nummernkreis gespeichert.')).toBeVisible()
    await openNewBlock(page, 'closing')
    await panel(page).getByLabel('Name').fill('Geheimgruß')
    await typeInto(page, editor(panel(page), 'Text'), 'Kontonummer 4711 geheim')
    await panel(page).getByRole('button', { name: 'Baustein speichern' }).click()
    await expect(page.getByText('Baustein angelegt.')).toBeVisible()
    await page.reload()
    await ready(page)
    await expect(page.getByText('Rechnungseinstellungen geändert: Nummernkreis')).toBeVisible()
    await expect(page.getByText('Textbaustein angelegt: Abschlusstext – Geheimgruß')).toBeVisible()
    await expect(page.getByText(/Bea Betreiber/).first()).toBeVisible()
    const { data: log } = await service().from('operator_log').select('*').eq('tenant_id', tenantId)
    expect(JSON.stringify(log)).not.toContain('4711')

    const ownerContext = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const ownerPage = await ownerContext.newPage()
    await signInAs(ownerPage, owner)
    await openSettings(ownerPage)
    await expect(ownerPage.getByLabel('Präfix')).toHaveValue('RE')
    await expect(nextNumber(ownerPage)).toHaveText(`RE${year()}-0001`)
    await ownerContext.close()
  })

  test('AC: deaktivierter Kunde – alles sichtbar, nichts änderbar', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await ownerWithTenant(users, 'Deaktiviert')
    const admin = await users({ admin: true })
    await service().from('tenants').update({ status: 'deactivated' }).eq('id', tenantId)
    await signInAsAdmin(page, admin)
    await page.goto(`/betreiber/kunden/${tenantId}`)
    await ready(page)
    await expect(page.getByText('Der Kunde ist deaktiviert. Die Rechnungseinstellungen sind nur lesbar.')).toBeVisible()
    await expect(nextNumber(page)).toHaveText(`${year()}-0001`)
    await expect(page.getByLabel('Präfix')).toBeDisabled()
    for (const name of ['Nummernkreis speichern', 'Feste Texte speichern', 'Schalter speichern', 'Baustein hinzufügen']) {
      await expect(page.getByRole('button', { name })).toHaveCount(0)
    }
    await expect(page.getByRole('button', { name: /^Aktionen für/ })).toHaveCount(0)
    await expect(editor(page, 'Fußzeile')).toHaveAttribute('contenteditable', 'false')
    await expect(page.getByRole('switch', { name: 'Rechnungen nacherfassen' })).toBeDisabled()
    // Baustein nur ansehen
    await page.getByRole('button', { name: /^Dank für den Aufenthalt/ }).click()
    await expect(panel(page).getByRole('heading', { name: 'Dank für den Aufenthalt' })).toBeVisible()
    await expect(panel(page).getByRole('button', { name: 'Baustein speichern' })).toHaveCount(0)
    await expect(editor(panel(page), 'Text')).toHaveAttribute('contenteditable', 'false')
    // Editor-Erweiterung: keine Werkzeugleiste, also weder Code noch Formatauswahl
    await expect(page.getByRole('toolbar', { name: 'Formatierung' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'HTML-Code bearbeiten' })).toHaveCount(0)
    await expect(page.getByRole('combobox', { name: 'Schriftart' })).toHaveCount(0)
  })
})

test.describe('Handy', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('AC: 375 px – Nummernkreis und Baustein-Panel ohne seitliches Scrollen, Bedienelemente ≥ 44 px', async ({ page, users }) => {
    desktopOnly()
    const { owner } = await ownerWithTenant(users, 'Handy')
    await page.setViewportSize({ width: 375, height: 800 })
    await signInAs(page, owner)
    await openSettings(page)
    const noHorizontalScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
    expect(await noHorizontalScroll()).toBe(true)
    await page.getByLabel('Präfix').fill('R-')
    await expect(nextNumber(page)).toHaveText(`R-${year()}-0001`)
    expect(await noHorizontalScroll()).toBe(true)

    const small = async (scope: ReturnType<Page['getByRole']> | Page) => {
      // ohne versteckte Formularfelder (aria-hidden); der Schließen-Knopf des Seitenpanels zählt mit (BUG-5)
      const controls = scope.locator('button:visible, input:visible:not([aria-hidden=true]), [role="switch"]:visible, [role="combobox"]:visible')
      const out: string[] = []
      for (const el of await controls.all()) {
        const box = await el.boundingBox()
        if (!box) continue
        // Schalter: Trefferfläche über das Pseudoelement; Radios: die ganze Zeile mit Beschriftung (min-h-11)
        const hit = await el.evaluate((n) => {
          const r = (n.getAttribute('role') === 'radio' ? n.closest('.min-h-11') : n)?.getBoundingClientRect() ?? n.getBoundingClientRect()
          const s = getComputedStyle(n, '::after')
          const after = s.content !== 'none' ? { w: parseFloat(s.width) || 0, h: parseFloat(s.height) || 0 } : { w: 0, h: 0 }
          return { w: Math.max(r.width, after.w), h: Math.max(r.height, after.h, n.closest('.min-h-11')?.getBoundingClientRect().height ?? 0) }
        })
        if (hit.h < 43.5 || hit.w < 43.5) out.push(`${await el.evaluate((n) => n.outerHTML.slice(0, 80))} ${hit.w}x${hit.h}`)
      }
      return out
    }
    expect(await small(page.locator('main form').first())).toEqual([])

    await page.getByRole('button', { name: /^Anzahlung 20 %/ }).click()
    await expect(panel(page).getByRole('heading', { name: 'Baustein bearbeiten' })).toBeVisible()
    await expect(editor(panel(page), 'Text')).toBeVisible()
    // Einblenden abwarten
    await expect.poll(() => panel(page).evaluate((d) => d.getBoundingClientRect().right)).toBeLessThanOrEqual(375.5)
    // nichts ragt sichtbar über den Rand (sr-only-Elemente ausgenommen), das Panel scrollt nicht seitlich
    const overflow = await panel(page).evaluate((d) =>
      [d, ...d.querySelectorAll('*')]
        .filter((n) => {
          const r = n.getBoundingClientRect()
          return r.width > 1 && r.height > 1 && (r.right > window.innerWidth + 0.5 || (n as HTMLElement).scrollWidth > (n as HTMLElement).clientWidth + 1 && getComputedStyle(n).overflowX !== 'visible' && getComputedStyle(n).overflowX !== 'hidden')
        })
        .map((n) => `${n.tagName} ${(n.getAttribute('class') ?? '').slice(0, 60)} ${Math.round(n.getBoundingClientRect().right)} ${(n as HTMLElement).scrollWidth}/${(n as HTMLElement).clientWidth}`)
    )
    expect(overflow).toEqual([])
    expect(await small(panel(page))).toEqual([])
  })
})

test.describe('Barrierefreiheit', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  test('Reiter und Baustein-Panel ohne axe-Verstöße (WCAG 2.1 AA)', async ({ page, users }) => {
    desktopOnly()
    const { owner } = await ownerWithTenant(users, 'Axe')
    await signInAs(page, owner)
    await openSettings(page)
    await expect(editor(page, 'Fußzeile')).toBeVisible()
    const axe = () => new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    const summary = (r: Awaited<ReturnType<typeof axe>>) => r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)
    expect(summary(await axe())).toEqual([])
    await page.getByRole('button', { name: /^Anzahlung 20 %/ }).click()
    await expect(editor(panel(page), 'Text')).toBeVisible()
    await expect.poll(() => panel(page).evaluate((d) => d.getBoundingClientRect().right - window.innerWidth)).toBeLessThanOrEqual(0.5)
    expect(summary(await axe())).toEqual([])
  })
})

// ---- Nachtest QA Runde 2 (BUG-2, BUG-6) ---------------------------------------------------------------------------

test.describe('Nachtest QA Runde 2', () => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')

  // Verweist jede Schreibfläche auf eine vorhandene Bezeichnung? (Tiptap setzt die Attribute außerhalb von React)
  const editorLabels = (page: Page) =>
    page.$$eval('[role=textbox][contenteditable]', (els) =>
      els.map((e) => document.getElementById(e.getAttribute('aria-labelledby') ?? '')?.textContent ?? 'FEHLT')
    )

  test('BUG-2: 375 px – Seite wird einmal aufgebaut, Schreibflächen behalten ihren Namen', async ({ page, users }) => {
    desktopOnly()
    const { owner } = await ownerWithTenant(users, 'Einmal')
    await page.setViewportSize({ width: 375, height: 800 })
    await signInAs(page, owner)
    for (let run = 0; run < 3; run++) {
      await page.goto('/einstellungen/rechnungen')
      // während des Ladens nie zwei Formulare (vorher kurz doppelt: Server- und Browser-Fassung)
      let most = 0
      for (let i = 0; i < 30; i++) {
        most = Math.max(most, await page.locator('input[name=prefix]').count())
        await page.waitForTimeout(50)
      }
      expect(most, `Lauf ${run}`).toBe(1)
      await expect(editor(page, 'Fußzeile')).toBeVisible()
      expect(await editorLabels(page)).toEqual(['Kleinunternehmer-Hinweis', 'Fußzeile'])
    }
  })

  test('BUG-2: Betreiber-Seite – Schreibflächen behalten nach jedem Laden ihren Namen', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await ownerWithTenant(users, 'Betreiber Namen')
    const admin = await users({ admin: true })
    await signInAsAdmin(page, admin)
    for (let run = 0; run < 4; run++) {
      await page.goto(`/betreiber/kunden/${tenantId}`)
      await ready(page)
      await expect(editor(page, 'Fußzeile')).toBeVisible()
      expect(await editorLabels(page), `Lauf ${run}`).toEqual(['Kleinunternehmer-Hinweis', 'Fußzeile'])
    }
  })

  test('BUG-6: Standard wechselt, während das Panel offen ist – Speichern ohne Konflikt', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await ownerWithTenant(users, 'Standard offen')
    await signInAs(page, owner)
    await openSettings(page)
    await page.getByRole('button', { name: /^Anzahlung 20 %/ }).click()
    await expect(panel(page).getByLabel('Name')).toHaveValue('Anzahlung 20 %, Rest vor Anreise')

    // inzwischen wird dieser Baustein Standard (z. B. vom Betreiber)
    const rows = (await blockRows(tenantId)).filter((r) => r.block === 'payment')
    const target = rows.find((r) => r.name.startsWith('Anzahlung 20'))!
    const before = target.updated_at
    await service().from('invoice_text_blocks').update({ is_default: false } as never).eq('id', rows.find((r) => r.is_default)!.id)
    await service().from('invoice_text_blocks').update({ is_default: true } as never).eq('id', target.id)
    expect((await blockRows(tenantId)).find((r) => r.id === target.id)!.updated_at).not.toBe(before)

    await panel(page).getByLabel('Name').fill('Anzahlung 25 %')
    await panel(page).getByRole('button', { name: 'Baustein speichern' }).click()
    await expect(page.getByText('Baustein gespeichert.')).toBeVisible()
    await expect(page.getByText('Der Baustein wurde inzwischen geändert.')).toHaveCount(0)
    await expect.poll(async () => (await blockRows(tenantId)).find((r) => r.id === target.id)).toMatchObject({ name: 'Anzahlung 25 %', is_default: true })
  })
})

test.describe('Editor-Erweiterung: Schrift, Größe, Ausrichtung, Code', () => {
  const code = (scope: ReturnType<Page['getByRole']>) => scope.locator('textarea')

  test('AC: Auswahl gilt für den ganzen Text, in Schreibfläche und Vorschau', async ({ page, users }) => {
    desktopOnly()
    const { owner } = await ownerWithTenant(users, 'Schrift')
    await signInAs(page, owner)
    await openSettings(page)
    await openNewBlock(page, 'closing')
    const p = panel(page)
    const box = editor(p, 'Text')
    await typeInto(page, box, 'Ein Text', { clear: true })

    await p.getByRole('combobox', { name: 'Schriftart' }).click()
    for (const name of ['Standard', 'Arimo (wie Arial)', 'Tinos (wie Times)', 'Carlito (wie Calibri)', 'Source Sans 3', 'Source Serif 4', 'Open Sans']) {
      await expect(page.getByRole('option', { name, exact: true })).toBeVisible()
    }
    await page.getByRole('option', { name: 'Arimo (wie Arial)' }).click()
    await expect(box).toHaveCSS('font-family', /Arimo/)

    const size = p.getByRole('textbox', { name: 'Schriftgröße in pt' })
    await size.fill('12')
    await size.blur()
    await expect(box).toHaveCSS('font-size', '16px')
    await p.getByRole('button', { name: 'Blocksatz' }).click()
    await expect(box).toHaveCSS('text-align', 'justify')
    await expect(p.getByRole('button', { name: 'Blocksatz' })).toHaveAttribute('aria-pressed', 'true')
    await expect(p.getByRole('button', { name: 'Linksbündig' })).toHaveAttribute('aria-pressed', 'false')
    await expect(p.locator('div.flex-col.gap-2.break-words').filter({ hasText: 'Ein Text' })).toHaveCSS('font-family', /Arimo/)

    // Liste bleibt linksbündig
    await p.getByRole('button', { name: 'Aufzählung' }).click()
    await expect(box.locator('ul')).toHaveCSS('text-align', 'left')
  })

  test('AC: ungültige Schriftgröße zeigt den Hinweis und sperrt das Speichern; Enter speichert nicht', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await ownerWithTenant(users, 'Größe')
    await signInAs(page, owner)
    await openSettings(page)
    const before = (await blockRows(tenantId)).length
    await openNewBlock(page, 'closing')
    const p = panel(page)
    await p.getByLabel('Name').fill('Zu groß')
    await typeInto(page, editor(p, 'Text'), 'Text', { clear: true })
    const size = p.getByRole('textbox', { name: 'Schriftgröße in pt' })
    for (const bad of ['5', '25', '10,3']) {
      await size.fill(bad)
      await size.press('Enter')
      await expect(p.getByText('Schriftgröße: 6 bis 24 pt')).toBeVisible()
    }
    await p.getByRole('button', { name: 'Speichern' }).click()
    await expect(p.getByText('Schriftgröße: 6 bis 24 pt')).toBeVisible()
    await expect(p).toBeVisible()
    expect((await blockRows(tenantId)).length).toBe(before)
    await size.fill('10,5')
    await size.blur()
    await expect(p.getByText('Schriftgröße: 6 bis 24 pt')).toHaveCount(0)
    await expect(editor(p, 'Text')).toHaveCSS('font-size', '14px')
  })

  test('AC: Code zeigt HTML, Änderungen kommen zurück, Unerlaubtes wird entfernt und genannt', async ({ page, users }) => {
    desktopOnly()
    const { owner } = await ownerWithTenant(users, 'Code')
    await signInAs(page, owner)
    await openSettings(page)
    await openNewBlock(page, 'closing')
    const p = panel(page)
    const box = editor(p, 'Text')
    await typeInto(page, box, 'Hallo', { clear: true })
    const toggle = p.getByRole('button', { name: 'HTML-Code bearbeiten' })

    await toggle.click()
    await expect(code(p)).toHaveValue('<p>Hallo</p>')
    await expect(p.getByRole('button', { name: 'Fett' })).toBeDisabled()
    await expect(p.getByRole('button', { name: 'Platzhalter einfügen' })).toBeDisabled()
    await expect(p.locator('.ProseMirror')).toBeHidden()
    // ohne Änderung zurück: nichts passiert
    await toggle.click()
    await expect(box).toHaveText('Hallo')
    await expect(p.getByText('Entfernt:')).toHaveCount(0)

    await toggle.click()
    await code(p).fill('<div style="font-size: 9pt; text-align: right"><ul><li>Punkt</li></ul></div>')
    // Vorschau folgt schon im Code-Modus
    await expect(p.locator('li').filter({ hasText: 'Punkt' }).first()).toBeVisible()
    await toggle.click()
    await expect(box.locator('li')).toHaveText('Punkt')
    await expect(box).toHaveCSS('text-align', 'right')
    await expect(box).toHaveCSS('font-size', '12px')
    await expect(p.getByRole('textbox', { name: 'Schriftgröße in pt' })).toHaveValue('9')
    await expect(p.getByText('Entfernt:')).toHaveCount(0)

    let dialogs = 0
    page.on('dialog', (d) => {
      dialogs++
      void d.dismiss()
    })
    await toggle.click()
    await code(p).fill('<p>Text <a href="https://evil.example">Link</a><script>alert(1)</script><img src=x onerror="alert(2)"></p>')
    await toggle.click()
    await expect(box).toHaveText('Text Link')
    await expect(box.locator('a, img, script')).toHaveCount(0)
    await expect(p.getByText('Entfernt: <a>, <script>, <img>')).toBeVisible()
    expect(dialogs).toBe(0)
  })

  test('AC: Speichern im Code-Modus mit Unerlaubtem bricht ab und zeigt den bereinigten Text', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await ownerWithTenant(users, 'CodeSpeichern')
    await signInAs(page, owner)
    await openSettings(page)
    const before = (await blockRows(tenantId)).length
    await openNewBlock(page, 'closing')
    const p = panel(page)
    await p.getByLabel('Name').fill('Aus Code')
    await p.getByRole('button', { name: 'HTML-Code bearbeiten' }).click()
    await code(p).fill('<p><span>Sauber</span></p>')
    await p.getByRole('button', { name: 'Speichern' }).click()
    await expect(p.getByText('Entfernt: <span>')).toBeVisible()
    await expect(editor(p, 'Text')).toHaveText('Sauber')
    expect((await blockRows(tenantId)).length).toBe(before)

    // Jetzt ohne Unerlaubtes im Code-Modus: wird gespeichert
    await p.getByRole('button', { name: 'HTML-Code bearbeiten' }).click()
    await code(p).fill('<p>Sauber im Code</p>')
    await p.getByRole('button', { name: 'Speichern' }).click()
    await expect(p).toBeHidden()
    await expect.poll(async () => (await blockRows(tenantId)).find((r) => r.name === 'Aus Code')?.name).toBe('Aus Code')
  })

  test('AC: Einstellungen werden gespeichert und beim erneuten Öffnen gezeigt; alte Texte bleiben Standard', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await ownerWithTenant(users, 'Speichern')
    await signInAs(page, owner)
    await openSettings(page)
    await openNewBlock(page, 'closing')
    let p = panel(page)
    await p.getByLabel('Name').fill('Formatiert')
    await typeInto(page, editor(p, 'Text'), 'Mit Format', { clear: true })
    await p.getByRole('combobox', { name: 'Schriftart' }).click()
    await page.getByRole('option', { name: 'Carlito (wie Calibri)' }).click()
    const size = p.getByRole('textbox', { name: 'Schriftgröße in pt' })
    await size.fill('10,5')
    await size.blur()
    await p.getByRole('button', { name: 'Zentriert' }).click()
    await p.getByRole('button', { name: 'Speichern' }).click()
    await expect(p).toBeHidden()
    await expect
      .poll(async () => (await blockRows(tenantId)).find((r) => r.name === 'Formatiert')?.body)
      .toMatchObject({ attrs: { fontFamily: 'carlito', fontSize: 10.5, textAlign: 'center' } })

    await page.reload()
    await ready(page)
    await blockMenu(page, 'Formatiert', 'Bearbeiten')
    p = panel(page)
    await expect(p.getByRole('combobox', { name: 'Schriftart' })).toHaveText('Carlito (wie Calibri)')
    await expect(p.getByRole('textbox', { name: 'Schriftgröße in pt' })).toHaveValue('10,5')
    await expect(p.getByRole('button', { name: 'Zentriert' })).toHaveAttribute('aria-pressed', 'true')
    await expect(editor(p, 'Text')).toHaveCSS('font-family', /Carlito/)
    await expect(editor(p, 'Text')).toHaveCSS('text-align', 'center')
    await p.getByRole('button', { name: 'HTML-Code bearbeiten' }).click()
    await expect(p.locator('textarea')).toHaveValue('<div style="font-family: Carlito; font-size: 10.5pt; text-align: center">\n<p>Mit Format</p>\n</div>')
    await p.getByRole('button', { name: 'Abbrechen' }).click()

    // Vorbelegter Baustein von vor der Erweiterung
    await blockMenu(page, 'Nächster Besuch', 'Bearbeiten')
    p = panel(page)
    await expect(p.getByRole('combobox', { name: 'Schriftart' })).toHaveText('Standard')
    await expect(p.getByRole('textbox', { name: 'Schriftgröße in pt' })).toHaveValue('')
    await expect(p.getByRole('button', { name: 'Linksbündig' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('Handy: Werkzeugleiste und Code-Feld ohne seitliches Scrollen', async ({ page, users }) => {
    test.skip(!['mobile', 'tablet'].includes(test.info().project.name), 'Nur Handy und Tablet')
    const { owner } = await ownerWithTenant(users, 'CodeHandy')
    await signInAs(page, owner)
    await openSettings(page)
    await openNewBlock(page, 'closing')
    const p = panel(page)
    // Touch: Schrift wählen, Größe, Ausrichtung
    await p.getByRole('combobox', { name: 'Schriftart' }).tap()
    await page.getByRole('option', { name: 'Open Sans' }).tap()
    await p.getByRole('button', { name: 'Blocksatz' }).tap()
    await p.getByRole('textbox', { name: 'Schriftgröße in pt' }).fill('24')
    await p.getByRole('textbox', { name: 'Schriftgröße in pt' }).blur()
    await typeInto(page, editor(p, 'Text'), 'Einsehrlangeswortohneleerzeichendasumbrechenmussweilessonstseitlichscrollenwuerde und mehr', { clear: true })
    await expect(editor(p, 'Text')).toHaveCSS('font-family', /Open Sans/)
    expect(await p.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0)
    if (process.env.QA_SHOTS) await p.screenshot({ path: `${process.env.QA_SHOTS}/${test.info().project.name}-editor.png` })
    await p.getByRole('button', { name: 'HTML-Code bearbeiten' }).click()
    await code(p).fill(`<p>${'x'.repeat(300)}</p>`)
    const overflow = await p.evaluate((el) => el.scrollWidth - el.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    for (const b of await p.getByRole('toolbar', { name: 'Formatierung' }).locator('button, input').all()) {
      const size = await b.boundingBox()
      if (size && (await b.isVisible())) expect(size.height).toBeGreaterThanOrEqual(44)
    }
  })
})

test.describe('QA Editor-Erweiterung', () => {
  const code = (scope: ReturnType<Page['getByRole']>) => scope.locator('textarea')
  const sizeField = (scope: ReturnType<Page['getByRole']>) => scope.getByRole('textbox', { name: 'Schriftgröße in pt' })
  const codeToggle = (scope: ReturnType<Page['getByRole']>) => scope.getByRole('button', { name: 'HTML-Code bearbeiten' })

  test('BUG-2: Code wird nie abgeschnitten: lang bleibt vollständig, zu lang wird mit Hinweis abgewiesen', async ({ page, users }) => {
    desktopOnly()
    const { owner } = await ownerWithTenant(users, 'Lang')
    await signInAs(page, owner)
    await openSettings(page)
    await openNewBlock(page, 'closing')
    const p = panel(page)
    await codeToggle(p).click()
    const area = code(p)
    const insert = (text: string) => area.evaluate((el: HTMLTextAreaElement, t) => {
      el.focus()
      el.select()
      document.execCommand('insertText', false, t)
    }, text)

    // HTML wie aus Word: viel Beiwerk, wenig Text, weit über der früheren Grenze
    const span = '<span style="mso-fareast-font-family:Calibri;color:red" class="MsoNormal">x</span>'
    const longHtml = `<p>${span.repeat(500)}ENDE</p>`
    expect(longHtml.length).toBeGreaterThan(20_000)
    await insert(longHtml)
    expect(await area.inputValue()).toContain('ENDE')
    await expect(p.getByRole('alert').filter({ hasText: 'nicht übernommen' })).toHaveCount(0)

    await insert(`<p>${'y'.repeat(200_001)}</p>`)
    await expect(p.getByRole('alert').filter({ hasText: 'nicht übernommen' })).toContainText('200.000')
    // Der bisherige Stand bleibt vollständig erhalten
    await expect(p.getByText(/^[0-9.]+ \/ 2\.000 Zeichen$/)).toContainText('504 /')
  })

  test('BUG-3: aktiver Knopf ist deutlich erkennbar (mindestens 3:1 zum Hintergrund)', async ({ page, users }) => {
    desktopOnly()
    const { owner } = await ownerWithTenant(users, 'Knopf')
    await signInAs(page, owner)
    await openSettings(page)
    await openNewBlock(page, 'closing')
    const p = panel(page)
    const left = p.getByRole('button', { name: 'Linksbündig' })
    await expect(left).toHaveAttribute('aria-pressed', 'true')
    await p.getByLabel('Name').hover() // Maus nicht über dem Knopf
    const ratio = await left.evaluate((el) => {
      const rgb = (c: string) => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number)
      const lum = ([r, g, b]: number[]) => {
        const f = (v: number) => (v / 255 <= 0.03928 ? v / 255 / 12.92 : ((v / 255 + 0.055) / 1.055) ** 2.4)
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
      }
      const a = lum(rgb(getComputedStyle(el).backgroundColor))
      const b = lum(rgb(getComputedStyle(el.closest('[role="toolbar"]')!.parentElement!).backgroundColor))
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
    })
    expect(ratio).toBeGreaterThanOrEqual(3)
    await p.getByRole('button', { name: 'Zentriert' }).click()
    await expect(left).toHaveAttribute('aria-pressed', 'false')
    await expect(left).not.toHaveCSS('background-color', await p.getByRole('button', { name: 'Zentriert' }).evaluate((el) => getComputedStyle(el).backgroundColor))
  })

  test('AC: Einstellungen bleiben beim Weiterschreiben; Markierung ändert nichts daran; Einfügen übernimmt keine Schrift', async ({ page, users }) => {
    desktopOnly()
    test.skip(test.info().project.name === 'firefox', 'Künstliches Einfügen in Firefox nicht möglich')
    const { owner, tenantId } = await ownerWithTenant(users, 'Weiter')
    await signInAs(page, owner)
    await openSettings(page)
    await openNewBlock(page, 'closing')
    const p = panel(page)
    await p.getByLabel('Name').fill('Weiter')
    const box = editor(p, 'Text')
    await typeInto(page, box, 'Erster Teil', { clear: true })
    await page.keyboard.press('Shift+Home') // nur ein Teil des Texts markiert
    await p.getByRole('button', { name: 'Rechtsbündig' }).click()
    await sizeField(p).fill('11')
    await sizeField(p).blur()
    await box.click()
    await page.keyboard.press('End')
    await page.keyboard.type(' und mehr')
    await page.evaluate(() => {
      const data = new DataTransfer()
      data.setData('text/html', '<p style="font-family:Impact;font-size:40px;text-align:center">Eingefügt</p>')
      document.querySelector('[role="dialog"] .ProseMirror')!.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }))
    })
    await expect(box).toContainText('Eingefügt')
    await expect(box).toHaveCSS('text-align', 'right')
    expect(parseFloat(await box.evaluate((e) => getComputedStyle(e).fontSize))).toBeCloseTo((11 * 4) / 3, 1)
    expect(await box.locator('[style]').count()).toBe(0)
    await p.getByRole('button', { name: 'Speichern' }).click()
    await expect(p).toBeHidden()
    await expect.poll(async () => (await blockRows(tenantId)).find((r) => r.name === 'Weiter')?.body).toMatchObject({ attrs: { fontSize: 11, textAlign: 'right' } })
  })

  test('AC: Code: unbekannter Platzhalter, Sonderzeichen, Zähler; Hinweis endet mit der nächsten Eingabe', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await ownerWithTenant(users, 'CodePlatz')
    await signInAs(page, owner)
    await openSettings(page)
    const before = (await blockRows(tenantId)).length
    await openNewBlock(page, 'closing')
    const p = panel(page)
    await p.getByLabel('Name').fill('Platz')
    await codeToggle(p).click()
    await code(p).fill('<p>Hallo {Gastname}</p>')
    await p.getByRole('button', { name: 'Speichern' }).click()
    await expect(p.getByText('Unbekannter Platzhalter: {Gastname}')).toBeVisible()
    expect((await blockRows(tenantId)).length).toBe(before)

    await code(p).fill('<p>a &lt; b &amp; c &gt; d {Gast}</p>')
    await expect(p.getByText('/ 2.000 Zeichen')).toContainText('20 / 2.000')
    await codeToggle(p).click()
    const box = editor(p, 'Text')
    await expect(box).toHaveText('a < b & c > d {Gast}')
    await codeToggle(p).click()
    await expect(code(p)).toHaveValue('<p>a &lt; b &amp; c &gt; d {Gast}</p>')

    await code(p).fill('<p><u>x</u></p>')
    await codeToggle(p).click()
    await expect(p.getByText('Entfernt: <u>')).toBeVisible()
    await box.click()
    await page.keyboard.type('y')
    await expect(p.getByText('Entfernt: <u>')).toHaveCount(0)
  })

  test('AC: Schriften: nichts von Google, nur die verwendete Schrift wird geladen, andere Seiten laden keine', async ({ page, users }) => {
    desktopOnly()
    const { owner } = await ownerWithTenant(users, 'Laden')
    const external: string[] = []
    const fonts: string[] = []
    page.on('request', (r) => {
      if (/fonts\.(googleapis|gstatic)\.com/.test(r.url())) external.push(r.url())
      if (r.resourceType() === 'font') fonts.push(r.url())
    })
    await signInAs(page, owner)
    await page.goto('/buchungen')
    await ready(page)
    await page.waitForLoadState('networkidle')
    const elsewhere = fonts.length
    await openSettings(page)
    await openNewBlock(page, 'closing')
    const p = panel(page)
    await page.waitForLoadState('networkidle')
    // Vor der Auswahl ist keine der sechs Rechnungsschriften geladen; nur die App-Schrift
    const loadedFamilies = () => page.evaluate(() => Array.from(document.fonts).filter((f) => f.status === 'loaded' && !f.family.includes('Fallback') && !f.family.includes('__nextjs')).map((f) => f.family.replace(/['"]/g, '')))
    expect(await loadedFamilies()).not.toEqual(expect.arrayContaining(['Arimo']))
    expect(new Set(await loadedFamilies())).toEqual(new Set(['Source Serif 4']))
    const atEditor = fonts.length
    await p.getByRole('combobox', { name: 'Schriftart' }).click()
    await page.getByRole('option', { name: 'Tinos (wie Times)' }).click()
    await typeInto(page, editor(p, 'Text'), 'Ein Text', { clear: true })
    await expect.poll(() => fonts.length).toBeGreaterThan(atEditor)
    expect(external).toEqual([])
    test.info().annotations.push({ type: 'Schriftdateien', description: `andere Seite ${elsewhere}, Editor ${atEditor}, nach Auswahl ${fonts.length}` })
    console.log(`Schriftdateien: andere Seite ${elsewhere}, Editor ${atEditor}, nach Auswahl ${fonts.length}`)
    // Die gewählte Schrift kommt an; die geöffnete Liste kann je nach Browser auch die übrigen laden
    await expect.poll(loadedFamilies).toContain('Tinos')
  })

  test('Barrierefreiheit: Editor mit Auswahl, Fehler, Code-Feld und Hinweis ohne axe-Verstöße', async ({ page, users }) => {
    desktopOnly()
    const { owner } = await ownerWithTenant(users, 'Axe')
    await signInAs(page, owner)
    await openSettings(page)
    await openNewBlock(page, 'closing')
    const p = panel(page)
    await sizeField(p).fill('99')
    await sizeField(p).blur()
    await expect(sizeField(p)).toHaveAttribute('aria-invalid', 'true')
    let result = await new AxeBuilder({ page }).include('[role="dialog"]').analyze()
    expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([])
    await codeToggle(p).click()
    await code(p).fill('<p><u>x</u></p>')
    // Farb-Überblendung des Knopfs abwarten: axe misst sonst den Zwischenstand
    await expect(codeToggle(p)).toHaveCSS('color', 'rgb(255, 255, 255)')
    result = await new AxeBuilder({ page }).include('[role="dialog"]').analyze()
    expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([])
    await codeToggle(p).click()
    await expect(p.getByText('Entfernt: <u>')).toBeVisible()
    // Auch beim Zurückschalten läuft eine Farb-Überblendung; ein bleibender Verstoß schlägt trotzdem fehl
    await expect(async () => {
      result = await new AxeBuilder({ page }).include('[role="dialog"]').analyze()
      expect(result.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`)).toEqual([])
    }).toPass({ timeout: 5000 })
  })

  test('AC: feste Texte: Einstellungen und Code je Feld, kein Platzhalter-Knopf, zwei Felder getrennt', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await ownerWithTenant(users, 'Fest')
    await signInAs(page, owner)
    await openSettings(page)
    const toolbars = page.getByRole('toolbar', { name: 'Formatierung' })
    await expect(toolbars).toHaveCount(2)
    const footerBar = toolbars.nth(1)
    await expect(footerBar.getByRole('button', { name: 'Platzhalter einfügen' })).toHaveCount(0)
    await footerBar.getByRole('textbox', { name: 'Schriftgröße in pt' }).fill('8')
    await footerBar.getByRole('textbox', { name: 'Schriftgröße in pt' }).blur()
    await footerBar.getByRole('button', { name: 'Zentriert' }).click()
    await typeInto(page, editor(page, 'Fußzeile'), 'IBAN AT12', { clear: true })
    const noteBox = editor(page, 'Kleinunternehmer-Hinweis')
    await expect(noteBox).not.toHaveCSS('text-align', 'center')
    await page.getByRole('button', { name: 'Feste Texte speichern' }).click()
    await expect.poll(async () => ((await settingsRow(tenantId)) as { footer: unknown } | null)?.footer).toMatchObject({ attrs: { fontSize: 8, textAlign: 'center' } })
    await page.reload()
    await ready(page)
    await expect(editor(page, 'Fußzeile')).toHaveCSS('text-align', 'center')
  })
})
