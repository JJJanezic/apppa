import { readFileSync } from 'node:fs'

import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test as base } from '@playwright/test'

import { noErrorFlash } from './support/error-flash'
import { createTenant, createUser, deleteUser, type E2EUser, hasSupabaseEnv, service, signInAs } from './support/supabase'

// PROJ-52: Marketing: Segmente und CSV-Export. Abläufe nur im Projekt „desktop“ (und auf Wunsch Firefox), Layout und
// Barrierefreiheit in allen Breiten. Testdaten über die Datenbank; Kunden verschwinden mit dem Löschen ihrer Inhaber.

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

test.use({ storageState: { cookies: [], origins: [] } })

type Users = (opts?: Parameters<typeof createUser>[0]) => Promise<E2EUser>
const desktopOnly = () => test.skip(!['desktop', 'firefox'].includes(test.info().project.name), 'Abläufe nur im Desktop-Projekt (und auf Wunsch Firefox)')
const ready = (page: Page) =>
  page.waitForFunction(() => Object.keys(document.querySelector('main') ?? {}).some((k) => k.startsWith('__reactFiber')))
const names = (page: Page) => page.getByRole('table').locator('a[href^="/gaeste/"]')
let seq = 0

async function setup(users: Users, name = 'Pichler Ferienwohnungen') {
  const owner = await users({ displayName: 'Olga Owner' })
  const staff = await users({ displayName: 'Sam Staff' })
  const tenantId = await createTenant(name, [
    { user: owner, role: 'owner' },
    { user: staff, role: 'staff' },
  ])
  const { data: p } = await service()
    .from('properties')
    .insert({ tenant_id: tenantId, name: 'Haus See', street: 'Seeweg 12', postal_code: '5340', city: 'St. Gilgen', municipality_code: '50330' })
    .select('id')
    .single()
  const { data: apts } = await service()
    .from('apartments')
    .insert([
      { tenant_id: tenantId, property_id: p!.id, name: 'Top A', max_guests: 4, price_cents: 10000 },
      { tenant_id: tenantId, property_id: p!.id, name: 'Top B', max_guests: 4, price_cents: 10000 },
    ])
    .select('id, name')
  const apt = (n: string) => apts!.find((a) => a.name === n)!.id
  return { tenantId, owner, staff, propertyId: p!.id, aptA: apt('Top A'), aptB: apt('Top B') }
}

async function addGuest(tenantId: string, lastName: string, over: Record<string, unknown> = {}, consent: 'grant' | 'revoke' | null = 'grant') {
  const { data, error } = await service()
    .from('guests')
    .insert({ tenant_id: tenantId, last_name: lastName, first_name: 'Anna', email: `${lastName.toLowerCase()}@example.at`, ...over } as never)
    .select('id')
    .single()
  if (error) throw error
  const id = (data as { id: string }).id
  if (consent) {
    await service().from('marketing_consent_events').insert({ tenant_id: tenantId, guest_id: id, kind: 'grant', origin: 'manual', channel: 'email', occurred_on: '2026-08-12' } as never)
    if (consent === 'revoke')
      await service().from('marketing_consent_events').insert({ tenant_id: tenantId, guest_id: id, kind: 'revoke', origin: 'manual', channel: 'oral', occurred_on: '2026-09-01' } as never)
  }
  return id
}

async function addStay(tenantId: string, guestId: string, apartmentId: string, arrival: string, over: Record<string, unknown> = {}) {
  seq++
  const departure = new Date(Date.parse(`${arrival}T12:00:00Z`) + 3 * 86_400_000).toISOString().slice(0, 10)
  const { error } = await service()
    .from('bookings')
    .insert({
      tenant_id: tenantId, apartment_id: apartmentId, kind: 'booking', arrival, planned_departure: departure, departure, guest_id: guestId,
      check_in: '15:00', check_out: '10:00', adults: 1, number_year: 2026, number_seq: 700 + seq, source: 'none', ...over,
    } as never)
  if (error) throw error
}

async function open(page: Page, query = '') {
  await page.goto(`/marketing${query}`)
  await ready(page)
}

test.beforeEach(() => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')
})

test.describe('Zugang', () => {
  test('AC: Inhaber hat den Menüpunkt nach „Ortstaxe“; Mitarbeiter haben keinen Menüpunkt, die Seite ist 404, der Export 403', async ({ page, users, browser }) => {
    desktopOnly()
    const s = await setup(users)
    await signInAs(page, s.owner)
    await open(page)
    const nav = (await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link').allInnerTexts()).map((l) => l.trim())
    expect(nav.indexOf('Marketing')).toBe(nav.indexOf('Ortstaxe') + 1)
    await expect(page.getByRole('heading', { name: 'Marketing', level: 1 })).toBeVisible()

    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const sp = await ctx.newPage()
    await signInAs(sp, s.staff)
    await sp.goto('/')
    await expect(sp.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link', { name: 'Marketing' })).toHaveCount(0)
    expect((await sp.goto('/marketing'))?.status()).toBe(404)
    expect((await sp.request.get('/api/marketing/csv')).status()).toBe(403)
    await ctx.close()
  })
})

test.describe('Wer erscheint', () => {
  test('AC: nur Einwilligung „Erteilt“ mit eigener Kontaktmöglichkeit; Hinweis zu Gästen ohne eigene Kontaktdaten; Plattform-E-Mail nicht als E-Mail', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const granted = await addGuest(s.tenantId, 'Erteilt')
    await addGuest(s.tenantId, 'Widerrufen', {}, 'revoke')
    await addGuest(s.tenantId, 'Keine', {}, null)
    await addGuest(s.tenantId, 'Plattform', { email: 'p1@guest.booking.com', email_source: 'platform' })
    const mixed = await addGuest(s.tenantId, 'Gemischt', { email: 'p2@guest.booking.com', email_source: 'platform', street: 'Weg 1', postal_code: '8010', city: 'Graz' })
    await signInAs(page, s.owner)
    await open(page)
    await expect(page.getByText('2 Gäste', { exact: true })).toBeVisible()
    await expect(page.getByText('1 Gast mit Einwilligung hat keine eigene E-Mail-Adresse und keine Anschrift.')).toBeVisible()
    await expect(names(page)).toHaveCount(2)
    const hrefs = await names(page).evaluateAll((els) => els.map((e) => e.getAttribute('href')))
    expect(hrefs.sort()).toEqual([`/gaeste/${granted}`, `/gaeste/${mixed}`].sort())
    await expect(page.getByRole('row', { name: /Gemischt/ }).getByRole('cell', { name: 'Post', exact: true })).toBeVisible()
  })

  test('AC: Gast mit Widerruf nach dem Speichern eines Segments fällt beim Öffnen heraus', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const guest = await addGuest(s.tenantId, 'Bald')
    const { data: seg } = await service().from('marketing_segments').insert({ tenant_id: s.tenantId, name: 'Alle', filters: {} } as never).select('id').single()
    await signInAs(page, s.owner)
    await open(page, `?segment=${(seg as { id: string }).id}`)
    await expect(names(page)).toHaveCount(1)
    await service().from('marketing_consent_events').insert({ tenant_id: s.tenantId, guest_id: guest, kind: 'revoke', origin: 'manual', channel: 'oral', occurred_on: '2026-10-01' } as never)
    await page.reload()
    await ready(page)
    await expect(page.getByRole('heading', { name: 'Noch keine Gäste mit Marketing-Einwilligung' })).toBeVisible()
  })
})

test.describe('Filter', () => {
  test('AC: Zeitraum, Mindestanzahl, Wohnung/Objekt, Quelle, Land, Sprache, Erreichbar per; Filter stehen in der Adresse', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const july = await addGuest(s.tenantId, 'Juli', { address_country: 'DE', language: 'de' })
    await addStay(s.tenantId, july, s.aptA, '2026-07-10', { source: 'website' })
    const jan = await addGuest(s.tenantId, 'Jaenner', { address_country: 'AT', language: 'en' })
    await addStay(s.tenantId, jan, s.aptB, '2026-01-10', { source: 'booking_com' })
    await addStay(s.tenantId, jan, s.aptB, '2025-01-10', { source: 'booking_com' })
    await addStay(s.tenantId, jan, s.aptA, '2024-08-01', { source: 'website' })
    const future = await addGuest(s.tenantId, 'Zukunft', { language: null, email: null, street: 'Weg 3', city: 'Linz' })
    await addStay(s.tenantId, future, s.aptA, '2099-01-01')
    await addStay(s.tenantId, future, s.aptA, '2025-03-01', { cancelled_at: new Date().toISOString(), cancel_reason: 'QA' })
    await signInAs(page, s.owner)
    const expectOnly = async (query: string, expected: string[]) => {
      await open(page, query)
      await expect(names(page), query).toHaveCount(expected.length)
      const hrefs = await names(page).evaluateAll((els) => els.map((e) => e.getAttribute('href')))
      expect(hrefs.sort(), query).toEqual(expected.map((id) => `/gaeste/${id}`).sort())
    }
    await expectOnly('', [july, jan, future])
    await expectOnly('?von=2026-06&bis=2026-08', [july])
    await expectOnly('?aufenthalte=2', [jan])
    await expectOnly('?aufenthalte=1', [july, jan])
    await expectOnly(`?wohnung=${s.aptB}`, [jan])
    await expectOnly(`?objekt=${s.propertyId}`, [july, jan])
    await expectOnly('?quelle=website', [july, jan])
    await expectOnly('?quelle=website&von=2026-01&bis=2026-12', [july])
    await expectOnly('?land=DE', [july])
    await expectOnly('?sprache=en,none', [jan, future])
    await expectOnly('?erreichbar=email', [july, jan])
    await expectOnly('?erreichbar=post', [future])
    await expectOnly('?land=AT&aufenthalte=2&quelle=booking_com', [jan])
  })

  test('AC: Auswahl über die Oberfläche schreibt die Filter in die Adresse; „Filter zurücksetzen“', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    await addGuest(s.tenantId, 'Deutsch', { address_country: 'DE' })
    await addGuest(s.tenantId, 'Oesterreich', { address_country: 'AT' })
    await signInAs(page, s.owner)
    await open(page)
    await page.getByRole('combobox', { name: 'Herkunftsland' }).click()
    await page.getByPlaceholder('Suchen …').fill('deutsch')
    await page.getByRole('option', { name: 'Deutschland' }).click()
    await page.keyboard.press('Escape')
    await expect(page).toHaveURL(/land=DE/)
    await expect(names(page)).toHaveCount(1)
    await page.getByRole('combobox', { name: 'Mindestens Aufenthalte' }).click()
    await page.getByRole('option', { name: 'ab 1 Aufenthalt' }).click()
    await expect(page).toHaveURL(/aufenthalte=1/)
    await expect(page.getByRole('heading', { name: 'Keine Gäste für diese Filter' })).toBeVisible()
    await page.getByRole('link', { name: 'Filter zurücksetzen' }).first().click()
    await expect(page).toHaveURL(/\/marketing$/)
    await expect(names(page)).toHaveCount(2)
  })
})

test.describe('Trefferliste', () => {
  test('AC: mehr als 50 Treffer seitenweise nach Nachname; Name führt zur Gastseite', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const rows = Array.from({ length: 53 }, (_, i) => ({ tenant_id: s.tenantId, last_name: `Gast ${String(i).padStart(2, '0')}`, email: `g${i}@example.at` }))
    const { data } = await service().from('guests').insert(rows as never).select('id')
    await service()
      .from('marketing_consent_events')
      .insert((data as { id: string }[]).map((g) => ({ tenant_id: s.tenantId, guest_id: g.id, kind: 'grant', origin: 'manual', channel: 'email', occurred_on: '2026-08-12' })) as never)
    await signInAs(page, s.owner)
    await open(page)
    await expect(page.getByText('53 Gäste', { exact: true })).toBeVisible()
    await expect(names(page)).toHaveCount(50)
    await expect(names(page).first()).toHaveText('Gast 00')
    await page.getByRole('link', { name: 'Weiter' }).click()
    await expect(page).toHaveURL(/seite=2/)
    await expect(names(page)).toHaveCount(3)
    await names(page).first().click()
    await expect(page).toHaveURL(/\/gaeste\/[0-9a-f-]{36}$/)
  })

  test('AC: ohne Einwilligungen leerer Zustand, Export ausgegraut', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    await signInAs(page, s.owner)
    await open(page)
    await expect(page.getByRole('heading', { name: 'Noch keine Gäste mit Marketing-Einwilligung' })).toBeVisible()
    await expect(page.getByRole('button', { name: /CSV/ })).toBeDisabled()
  })
})

test.describe('Export', () => {
  test('AC: Datei gaeste_[Kunde]_[Datum_Uhrzeit].csv mit allen Treffern, Spalten, Anrede, ohne Plattform-Daten; Protokoll', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    await addGuest(s.tenantId, 'Huber', { gender: 'female', title_prefix: 'Dr.', phone: '+43 1 234', street: 'Seeweg 1', postal_code: '5340', city: 'St. Gilgen', address_country: 'AT', language: 'de' })
    await addGuest(s.tenantId, 'Plattformtel', { phone: '+1 555 0100', phone_source: 'platform' })
    await signInAs(page, s.owner)
    await open(page)
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: /CSV/ }).click()
    const file = await download
    expect(file.suggestedFilename()).toMatch(/^gaeste_Pichler-Ferienwohnungen_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}\.csv$/)
    const bytes = readFileSync((await file.path())!)
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    const lines = bytes.toString('utf8').slice(1).trim().split('\r\n')
    expect(lines[0]).toBe('Anrede;Titel vor;Vorname;Nachname;Titel nach;Firma;E-Mail;Telefon;Straße;PLZ;Ort;Land;Sprache;Anzahl Aufenthalte;Letzter Aufenthalt;Eingewilligt seit')
    expect(lines).toHaveLength(3)
    // Telefon mit „+“ wird wie jede Zelle mit „=+-@“ gegen Excel-Formeln entschärft (Spec, Edge Cases); siehe QA BUG-2
    expect(lines).toContain("Frau;Dr.;Anna;Huber;;;huber@example.at;'+43 1 234;Seeweg 1;5340;St. Gilgen;Österreich;Deutsch;0;;12.08.2026")
    expect(lines.find((l) => l.includes('Plattformtel'))).toContain(';plattformtel@example.at;;')
    const { data: log } = await service().from('audit_log').select('actor_id, new_data').eq('tenant_id', s.tenantId).eq('table_name', 'marketing_exports')
    expect(log).toEqual([{ actor_id: s.owner.id, new_data: { filters: expect.any(Object), segment_id: null, segment_name: null, count: 2 } }])
  })
})

test.describe('Segmente', () => {
  test('AC: speichern, gleicher Name abgelehnt, leer/zu lang abgelehnt, aktualisieren, umbenennen, löschen; zweiter Inhaber sieht dieselben', async ({ page, users, browser }) => {
    desktopOnly()
    const s = await setup(users)
    await addGuest(s.tenantId, 'Deutsch', { address_country: 'DE' })
    await signInAs(page, s.owner)
    await open(page, '?land=DE')
    const dialog = page.getByRole('dialog')

    await page.getByRole('button', { name: 'Als Segment speichern' }).click()
    await dialog.getByRole('button', { name: 'Speichern' }).click()
    await expect(dialog.getByText('Bitte einen Namen angeben.')).toBeVisible()
    await dialog.getByLabel('Name').fill('x'.repeat(61))
    await dialog.getByRole('button', { name: 'Speichern' }).click()
    await expect(dialog.getByText('Der Name ist zu lang (höchstens 60 Zeichen).')).toBeVisible()
    await dialog.getByLabel('Name').fill('Stammgäste DE')
    await dialog.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Segment gespeichert.')).toBeVisible()
    await expect(page).toHaveURL(/segment=.*land=DE/)

    await page.getByRole('button', { name: 'Als Segment speichern' }).click()
    await dialog.getByLabel('Name').fill('stammgäste de')
    await dialog.getByRole('button', { name: 'Speichern' }).click()
    await expect(dialog.getByText('Diesen Namen gibt es schon.')).toBeVisible()
    await dialog.getByRole('button', { name: 'Abbrechen' }).click()

    await page.getByRole('combobox', { name: 'Erreichbar per' }).click()
    await page.getByRole('option', { name: 'E-Mail' }).click()
    await expect(page.getByText('Filter geändert')).toBeVisible()
    await page.getByRole('button', { name: 'Segment aktualisieren' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Aktualisieren' }).click()
    await expect(page.getByText('Segment aktualisiert.')).toBeVisible()
    const { data: stored } = await service().from('marketing_segments').select('filters').eq('tenant_id', s.tenantId).single()
    expect(stored!.filters).toMatchObject({ countries: ['DE'], reach: 'email' })

    await page.getByRole('button', { name: 'Umbenennen' }).click()
    await dialog.getByLabel('Name').fill('DE per E-Mail')
    await dialog.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Segment umbenannt.')).toBeVisible()

    // zweiter Inhaber sieht dasselbe Segment
    const second = await users({ displayName: 'Otto Owner' })
    await service().from('memberships').insert({ tenant_id: s.tenantId, user_id: second.id, role: 'owner' })
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const op = await ctx.newPage()
    await signInAs(op, second)
    await open(op)
    await op.getByRole('combobox', { name: 'Segment öffnen' }).click()
    await op.getByRole('option', { name: 'DE per E-Mail' }).click()
    await expect(op).toHaveURL(/land=DE.*erreichbar=email|erreichbar=email.*land=DE/)
    await ctx.close()

    await page.getByRole('button', { name: 'Löschen' }).click()
    await expect(page.getByRole('alertdialog').getByText('Gäste und Einwilligungen bleiben unverändert.', { exact: false })).toBeVisible()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Löschen' }).click()
    await expect(page.getByText('Segment gelöscht.')).toBeVisible()
    await expect(page).not.toHaveURL(/segment=/)
    await expect(names(page)).toHaveCount(1)
    expect((await service().from('marketing_segments').select('id').eq('tenant_id', s.tenantId)).data).toEqual([])
  })

  test('AC: Segment mit gelöschter Wohnung – Filterteil übergangen, Hinweis', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const guest = await addGuest(s.tenantId, 'Wohnung')
    await addStay(s.tenantId, guest, s.aptA, '2026-05-01')
    const gone = '99999999-9999-4999-8999-999999999999'
    const { data: seg } = await service()
      .from('marketing_segments')
      .insert({ tenant_id: s.tenantId, name: 'Alte Wohnung', filters: { apartments: [gone, s.aptA] } } as never)
      .select('id')
      .single()
    await signInAs(page, s.owner)
    await open(page)
    await page.getByRole('combobox', { name: 'Segment öffnen' }).click()
    await page.getByRole('option', { name: 'Alte Wohnung' }).click()
    await expect(page).toHaveURL(new RegExp(`segment=${(seg as { id: string }).id}`))
    await expect(page.getByText('Eine gespeicherte Wohnung bzw. ein Objekt gibt es nicht mehr; der Filter wurde angepasst.')).toBeVisible()
    await expect(names(page)).toHaveCount(1)
  })
})

test.describe('Mandantentrennung', () => {
  test('AC: Inhaber eines anderen Kunden sieht Segmente und Gäste des fremden Kunden nicht', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    await addGuest(s.tenantId, 'Fremdgast')
    await service().from('marketing_segments').insert({ tenant_id: s.tenantId, name: 'Geheimes Segment', filters: {} } as never)
    const stranger = await users({ displayName: 'Fremd' })
    await createTenant('QA52 Fremd', [{ user: stranger, role: 'owner' }])
    await signInAs(page, stranger)
    await open(page)
    await expect(page.getByText('Fremdgast')).toHaveCount(0)
    await page.getByRole('combobox', { name: 'Segment öffnen' }).click()
    await expect(page.getByRole('option', { name: 'Geheimes Segment' })).toHaveCount(0)
  })
})

test.describe('Layout und Barrierefreiheit', () => {
  test('Seite, Mehrfachauswahl und Dialog ohne waagrechtes Scrollen und ohne axe-Verstöße', async ({ page, users }) => {
    const s = await setup(users)
    await addGuest(s.tenantId, 'Langername-mit-Bindestrich-und-noch-mehr', { street: 'Hauptstraße 1', city: 'Sankt Wolfgang im Salzkammergut', address_country: 'AT', language: 'de' })
    await signInAs(page, s.owner)
    const check = async (label: string) => {
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      expect(results.violations, label).toEqual([])
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, label).toBeLessThanOrEqual(0)
    }
    await open(page, '?land=AT')
    await check('Seite')
    const toggle = page.getByRole('button', { name: /^Filter/ })
    if (await toggle.isVisible()) await toggle.click()
    await page.getByRole('combobox', { name: 'Objekt / Wohnung' }).click()
    await expect(page.getByRole('option', { name: 'Top A' })).toBeVisible()
    await page.waitForTimeout(300)
    await check('Mehrfachauswahl')
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Als Segment speichern' }).click()
    await expect(page.getByRole('dialog').getByLabel('Name')).toBeVisible()
    await page.waitForTimeout(300)
    await check('Dialog')
  })
})
