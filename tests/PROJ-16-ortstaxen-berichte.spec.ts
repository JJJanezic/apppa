import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'

import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'

import { createTenant, createUser, deleteUser, type E2EUser, hasSupabaseEnv, service, signInAs } from './support/supabase'

// PROJ-16: Ortstaxen-Berichte. Testdaten über die Datenbank im letzten abgelaufenen Monat (Standard des Berichts):
// Olga ist Inhaberin von „Alpenhof“ mit Wohnungen in Saalbach-Hinterglemm (Tarif € 2,50) und Zell am See; Sam ist dort
// Mitarbeiter. Paula hat einen Kunden ohne Tarife. Abläufe am Desktop, Anordnung zusätzlich am Handy.

test.use({ storageState: { cookies: [], origins: [] } })

const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Vienna' }).format(new Date())
const YEAR = Number(TODAY.slice(0, 4))
const MONTH = Number(TODAY.slice(5, 7))
const LAST = MONTH === 1 ? { year: YEAR - 1, month: 12 } : { year: YEAR, month: MONTH - 1 }
const pad = (n: number) => String(n).padStart(2, '0')
const inLast = (dayOfMonth: number) => `${LAST.year}-${pad(LAST.month)}-${pad(dayOfMonth)}`
// Letzter Tag des Vor-Vormonats (für einen Aufenthalt über die Monatsgrenze)
const BEFORE_LAST_END = new Date(Date.UTC(LAST.year, LAST.month - 1, 0)).toISOString().slice(0, 10)
const MONTHS = ['Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
const LAST_LABEL = `${MONTHS[LAST.month - 1]} ${LAST.year}`
const run = randomUUID().slice(0, 6)
const desktopOnly = () => test.skip(['mobile', 'tablet'].includes(test.info().project.name), 'Abläufe nur am Desktop')

const users: Record<string, E2EUser> = {}
const tenants: Record<string, string> = {}
const ids: Record<string, string> = {}
let seq = 0

async function addApartment(tenant: string, name: string, code: string) {
  const s = service()
  const { data: p, error } = await s
    .from('properties')
    .insert({ tenant_id: tenant, name: `Haus ${name}`, street: 'Seeweg 12', postal_code: '5753', city: 'Ort', municipality_code: code })
    .select('id')
    .single()
  if (error) throw error
  const { data, error: e2 } = await s.from('apartments').insert({ tenant_id: tenant, property_id: p.id, name, max_guests: 4, price_cents: 12000 } as never).select('id').single()
  if (e2) throw e2
  return (data as { id: string }).id
}

async function addRate(tenant: string, apartment: string) {
  const { data, error } = await service()
    .from('apartment_tourist_tax_rates')
    .insert({ tenant_id: tenant, apartment_id: apartment, valid_from: '2020-01-01', label: 'Nächtigungsabgabe', method: 'per_person_night', amount_cents: 250 } as never)
    .select('id')
    .single()
  if (error) throw error
  return (data as { id: string }).id
}

async function addBooking(tenant: string, apartment: string, last: string, arrival: string, departure: string, opts: { childAges?: number[]; kind?: 'booking' | 'option' } = {}) {
  const s = service()
  const { data: g } = await s.from('guests').insert({ tenant_id: tenant, country: 'AT', last_name: last, first_name: 'Anna' } as never).select('id').single()
  const kind = opts.kind ?? 'booking'
  const { data, error } = await s
    .from('bookings')
    .insert({
      tenant_id: tenant,
      apartment_id: apartment,
      kind,
      arrival,
      departure,
      planned_departure: departure,
      guest_id: (g as { id: string }).id,
      check_in: '15:00',
      check_out: '10:00',
      adults: 2,
      child_ages: opts.childAges ?? [],
      number_year: Number(arrival.slice(0, 4)),
      number_seq: 8000 + ++seq,
      option_until: kind === 'option' ? '2099-01-01' : null,
    } as never)
    .select('id, number')
    .single()
  if (error) throw error
  const row = data as { id: string; number: string }
  await s.from('booking_amounts').insert({ id: row.id, tenant_id: tenant, nights_cents: 30000 } as never)
  return row
}

async function addTax(tenant: string, booking: string, cents: number, rate: string | null) {
  const { error } = await service()
    .from('booking_charges')
    .insert({ tenant_id: tenant, booking_id: booking, position: 1, label: 'Nächtigungsabgabe', amount_cents: cents, vat_rate: 0, tourist_tax: true, tourist_tax_rate_id: rate } as never)
  if (error) throw error
}

const ready = (page: Page) => page.waitForFunction(() => Object.keys(document.querySelector('main') ?? {}).some((k) => k.startsWith('__reactFiber')))
const summary = (page: Page) => page.getByRole('region', { name: 'Übersicht je Gemeinde' })
const bookings = (page: Page) => page.getByRole('region', { name: 'Eingerechnete Buchungen je Gemeinde' })

test.beforeAll(async () => {
  test.skip(!hasSupabaseEnv, 'ohne Supabase-Zugang')
  test.setTimeout(120_000)
  users.olga = await createUser({ displayName: 'Olga Owner' })
  users.sam = await createUser({ displayName: 'Sam Staff' })
  users.paula = await createUser({ displayName: 'Paula Plain' })
  tenants.a = await createTenant(`Alpenhof ${run}`, [
    { user: users.olga, role: 'owner' },
    { user: users.sam, role: 'staff' },
  ])
  tenants.p = await createTenant(`Ohne Tarif ${run}`, [{ user: users.paula, role: 'owner' }])
  const saalbach = await addApartment(tenants.a, 'Top 1', '50618')
  const zell = await addApartment(tenants.a, 'Studio', '50628')
  const rS = await addRate(tenants.a, saalbach)
  await addRate(tenants.a, zell)
  // 2 Erwachsene + 1 Kind (befreit), 3 Nächte: 6 abgabepflichtige, 3 befreite Personennächte, € 15,00
  const family = await addBooking(tenants.a, saalbach, 'Huber', inLast(10), inLast(13), { childAges: [5] })
  ids.family = family.id
  ids.familyNumber = family.number
  await addTax(tenants.a, family.id, 1500, rS)
  // über die Monatsgrenze: 1 Nacht im Vor-Vormonat, 2 im Berichtsmonat (2 Personen) → € 10,00 im Bericht, „anteilig“
  const edge = await addBooking(tenants.a, saalbach, 'Grenzgang', BEFORE_LAST_END, inLast(3))
  await addTax(tenants.a, edge.id, 1500, rS)
  // Alt-Position ohne Vielfaches: unbekannte Personennächte
  const legacy = await addBooking(tenants.a, saalbach, 'Altbestand', inLast(20), inLast(23))
  await addTax(tenants.a, legacy.id, 1001, null)
  // Zell am See, Gastname mit Formelzeichen (CSV-Schutz)
  const zellB = await addBooking(tenants.a, zell, '=Formel', inLast(5), inLast(7))
  await addTax(tenants.a, zellB.id, 1000, null)
  // Option zählt nicht
  const option = await addBooking(tenants.a, zell, 'Option', inLast(15), inLast(17), { kind: 'option' })
  await addTax(tenants.a, option.id, 9900, null)
})

test.afterAll(async () => {
  for (const u of Object.values(users)) await deleteUser(u)
  for (const t of Object.values(tenants)) await service().from('tenants').delete().eq('id', t)
})

test.describe('PROJ-16 Ortstaxen-Berichte', () => {
  test('Inhaberin: Menüpunkt „Ortstaxe“, Standard letzter abgelaufener Monat, Übersicht je Gemeinde mit Gesamt', async ({ page }) => {
    desktopOnly()
    await signInAs(page, users.olga)
    await page.goto('/')
    await page.getByRole('link', { name: 'Ortstaxe', exact: true }).first().click()
    await expect(page).toHaveURL(/\/ortstaxe/)
    await expect(page.getByRole('heading', { name: 'Ortstaxe', level: 1 })).toBeVisible()
    await expect(page.getByText(LAST_LABEL, { exact: true })).toBeVisible()
    const s = summary(page)
    const rowS = s.getByRole('row', { name: /Saalbach-Hinterglemm/ })
    // 6 + 4 bekannte Personennächte (Alt-Position unbekannt), befreit 3 + 0, Betrag 15,00 + 10,00 + 10,01
    await expect(rowS).toContainText('10')
    await expect(rowS).toContainText('3')
    await expect(rowS).toContainText('€ 35,01')
    await expect(rowS).toContainText('inkl. 1 Position ohne Personennächte')
    await expect(s.getByRole('row', { name: /Zell am See/ })).toContainText('€ 10,00')
    await expect(s.getByRole('row', { name: /Gesamt/ })).toContainText('€ 45,01')
    await expect(page.getByText('Zeitraum noch nicht abgeschlossen')).toHaveCount(0)
  })

  test('Buchungsliste: je Gemeinde nach Anreise, Hinweise, Nummer führt zur Buchung, Option fehlt', async ({ page }) => {
    desktopOnly()
    await signInAs(page, users.olga)
    await page.goto('/ortstaxe')
    const list = bookings(page)
    await expect(list.getByRole('columnheader', { name: 'Saalbach-Hinterglemm' })).toBeVisible()
    await expect(list.getByRole('columnheader', { name: 'Zell am See' })).toBeVisible()
    const names = await list.getByRole('row').allInnerTexts()
    const order = ['Grenzgang', 'Huber', 'Altbestand'].map((n) => names.findIndex((t) => t.includes(n)))
    expect(order).toEqual([...order].sort((a, b) => a - b))
    await expect(list.getByRole('row', { name: /Grenzgang/ })).toContainText('anteilig')
    await expect(list.getByRole('row', { name: /Altbestand/ })).toContainText('Alt-Position')
    await expect(list.getByRole('row', { name: /Huber/ })).toContainText('€ 15,00')
    await expect(list.getByText('Option Anna')).toHaveCount(0)
    await list.getByRole('link', { name: ids.familyNumber }).click()
    await expect(page).toHaveURL(new RegExp(`/buchungen/${ids.family}`))
  })

  test('Schnellwahl und Gemeindefilter stehen in der Adresse und bleiben beim Neuladen', async ({ page }) => {
    desktopOnly()
    await signInAs(page, users.olga)
    await page.goto('/ortstaxe')
    await ready(page)
    await page.getByRole('link', { name: 'Letztes Jahr' }).click()
    await expect(page).toHaveURL(new RegExp(`jahr=${YEAR - 1}&von=1&bis=12`))
    await expect(page.getByText(String(YEAR - 1), { exact: true }).first()).toBeVisible()
    await page.getByRole('link', { name: 'Letzter Monat' }).click()
    await expect(page).toHaveURL(new RegExp(`jahr=${LAST.year}&von=${LAST.month}&bis=${LAST.month}`))
    await ready(page)
    await page.getByRole('combobox', { name: 'Gemeinde' }).click()
    await page.getByRole('option', { name: 'Zell am See' }).click()
    await expect(page).toHaveURL(/gemeinde=50628/)
    await expect(summary(page).getByRole('row', { name: /Saalbach/ })).toHaveCount(0)
    await expect(summary(page).getByRole('row', { name: /Gesamt/ })).toHaveCount(0)
    await page.reload()
    await expect(page.getByRole('combobox', { name: 'Gemeinde' })).toHaveText('Zell am See')
    await expect(bookings(page).getByRole('row', { name: /Huber/ })).toHaveCount(0)
  })

  test('laufender Monat zeigt den Hinweis; ungültige Adresse führt auf den Standard', async ({ page }) => {
    desktopOnly()
    await signInAs(page, users.olga)
    await page.goto(`/ortstaxe?jahr=${YEAR}&von=${MONTH}&bis=${MONTH}`)
    await expect(page.getByText('Zeitraum noch nicht abgeschlossen – Werte können sich noch ändern.')).toBeVisible()
    await page.goto('/ortstaxe?jahr=2026&von=13&bis=2')
    await expect(page.getByText(LAST_LABEL, { exact: true })).toBeVisible()
  })

  test('Zeitraum ohne Ortstaxe: Hinweis, Exporte gesperrt; Kunde ohne Tarife mit Link zu den Wohnungen', async ({ page }) => {
    desktopOnly()
    await signInAs(page, users.olga)
    await page.goto(`/ortstaxe?jahr=${YEAR - 4}&von=1&bis=1`)
    await expect(page.getByRole('heading', { name: 'Im gewählten Zeitraum keine Ortstaxe erfasst.' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Bericht als PDF herunterladen' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Bericht als CSV-Datei für Excel herunterladen' })).toBeDisabled()
    await expect(page.getByRole('link', { name: 'Zu den Wohnungen' })).toHaveCount(0)
    await page.context().clearCookies()
    await signInAs(page, users.paula)
    await page.goto('/ortstaxe')
    await expect(page.getByRole('link', { name: 'Zu den Wohnungen' })).toHaveAttribute('href', '/einstellungen/wohnungen')
  })

  test('CSV-Download: Dateiname, BOM, Strichpunkt, Formelschutz, keine Summen', async ({ page }) => {
    desktopOnly()
    await signInAs(page, users.olga)
    await page.goto('/ortstaxe')
    await ready(page)
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Bericht als CSV-Datei für Excel herunterladen' }).click()])
    expect(download.suggestedFilename()).toBe(`Ortstaxe_${LAST.year}-${pad(LAST.month)}_Alle_Stand-${TODAY}.csv`)
    const bytes = readFileSync(await download.path())
    expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    const lines = bytes.toString('utf8').replace(/^﻿/, '').trimEnd().split('\r\n')
    expect(lines[0]).toBe('Gemeinde;Nr.;Hauptgast;Wohnung;Anreise;Abreise;Personen;Abgabepflichtige Personennächte;Befreite Personennächte;Betrag;Hinweis')
    expect(lines).toHaveLength(5)
    expect(lines.some((l) => l.includes("'=Formel Anna"))).toBe(true)
    expect(lines.some((l) => l.includes('Gesamt'))).toBe(false)
  })

  test('PDF-Download für eine Gemeinde: Dateiname und PDF-Inhalt', async ({ page }) => {
    desktopOnly()
    await signInAs(page, users.olga)
    await page.goto(`/ortstaxe?jahr=${LAST.year}&von=${LAST.month}&bis=${LAST.month}&gemeinde=50618`)
    await ready(page)
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Bericht als PDF herunterladen' }).click()])
    expect(download.suggestedFilename()).toBe(`Ortstaxe_${LAST.year}-${pad(LAST.month)}_Saalbach-Hinterglemm.pdf`)
    const bytes = readFileSync(await download.path())
    expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-')
    await expect(page.getByText('Export konnte nicht erstellt werden')).toHaveCount(0)
  })

  test('Export scheitert: Meldung erscheint, Bericht bleibt sichtbar', async ({ page }) => {
    desktopOnly()
    await signInAs(page, users.olga)
    await page.route('**/api/ortstaxe/csv*', (route) => route.fulfill({ status: 500 }))
    await page.goto('/ortstaxe')
    await ready(page)
    await page.getByRole('button', { name: 'Bericht als CSV-Datei für Excel herunterladen' }).click()
    await expect(page.getByRole('alert').filter({ hasText: 'Export konnte nicht erstellt werden. Bitte erneut versuchen.' })).toBeVisible()
    await expect(summary(page)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Bericht als CSV-Datei für Excel herunterladen' })).toBeEnabled()
  })

  test('Mitarbeiter: kein Menüpunkt, Seite nicht gefunden, Downloads verweigert', async ({ page }) => {
    desktopOnly()
    await signInAs(page, users.sam)
    await page.goto('/')
    await expect(page.getByRole('link', { name: 'Ortstaxe', exact: true })).toHaveCount(0)
    await page.goto('/ortstaxe')
    await expect(page.getByRole('heading', { name: 'Seite nicht gefunden' })).toBeVisible()
    await expect(page.getByText('Huber Anna')).toHaveCount(0)
    // Statuscode ist noch 200 statt 404 (BUG-1 der QA)
    for (const kind of ['csv', 'pdf']) {
      const r = await page.request.get(`/api/ortstaxe/${kind}?jahr=${LAST.year}&von=${LAST.month}&bis=${LAST.month}`)
      expect(r.status()).toBe(403)
    }
  })

  test('ohne Anmeldung keine Downloads', async ({ page }) => {
    desktopOnly()
    const r = await page.request.get('/api/ortstaxe/csv')
    expect(r.status()).toBe(401)
  })

  test('Handy und Tablet: kein seitliches Scrollen der Seite, Liste scrollt im eigenen Bereich', async ({ page }) => {
    test.skip(!['mobile', 'tablet'].includes(test.info().project.name), 'nur Handy und Tablet')
    await signInAs(page, users.olga)
    await page.goto('/ortstaxe')
    await expect(summary(page)).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    const list = bookings(page)
    expect(await list.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true)
  })

  test('keine automatisch erkennbaren WCAG-2.1-AA-Verstöße', async ({ page }) => {
    await signInAs(page, users.olga)
    await page.goto('/ortstaxe')
    await expect(summary(page)).toBeVisible()
    await page.locator('nextjs-portal').evaluateAll((els) => els.forEach((e) => e.remove()))
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
  })
})
