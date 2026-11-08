import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'

import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'

import { createTenant, createUser, deleteUser, type E2EUser, hasSupabaseEnv, service, signInAs } from './support/supabase'

// PROJ-18: Statistische Auswertungen. Feste Testdaten im Oktober 2025 (Vorjahr Oktober 2024), damit die Zahlen nicht vom
// heutigen Datum abhängen. Olga ist Inhaberin von „Alpenhof“, Sam dort Mitarbeiter, Paula Inhaberin eines Kunden ohne
// Wohnungen. Erwartete Werte für Oktober 2025 (alle Wohnungen):
// * Top 1: 10 Nächte (05.–15.10.), Sperre 20.10. → 30 verfügbar; € 1.000 Übernachtung + € 60 Endreinigung (10 %), Ortstaxe
//   € 30 zählt nicht; 2 Erwachsene + 1 Kind, Gast aus Deutschland. Vorjahr: 05.–10.10.2024, € 500, Österreich.
// * Top 2: 28.10.–03.11. (4 Nächte im Oktober) € 600; erste Buchung im September → zählt ab 01.09.
// * Studio (Haus See): 18.–23.10., archiviert am 20.10. → 19 + 3 verfügbar; € 500; Niederlande.
// Summe: 19 von 83 Nächten (23 %), 1 gesperrt; Umsatz € 1.960,00 inkl. € 178,17 USt; Vorjahr 16 % (+7 Pp.), € 500 (+292 %).

test.use({ storageState: { cookies: [], origins: [] } })

const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Vienna' }).format(new Date())
const YEAR = Number(TODAY.slice(0, 4))
const MONTH = Number(TODAY.slice(5, 7))
const MONTHS = ['Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
const OCT = '/auswertungen?jahr=2025&von=10&bis=10'
const run = randomUUID().slice(0, 6)
const desktopOnly = () => test.skip(['mobile', 'tablet'].includes(test.info().project.name), 'Abläufe nur am Desktop')

const users: Record<string, E2EUser> = {}
const tenants: Record<string, string> = {}
const ids: Record<string, string> = {}
let seq = 0

async function addProperty(tenant: string, name: string) {
  const { data, error } = await service()
    .from('properties')
    .insert({ tenant_id: tenant, name: `${name} ${run}`, street: 'Seeweg 12', postal_code: '5753', city: 'Ort', municipality_code: '50618' })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

async function addApartment(tenant: string, property: string, name: string, archivedAt: string | null = null) {
  const { data, error } = await service()
    .from('apartments')
    .insert({ tenant_id: tenant, property_id: property, name, max_guests: 4, price_cents: 12000, archived_at: archivedAt } as never)
    .select('id')
    .single()
  if (error) throw error
  return (data as { id: string }).id
}

async function addBooking(
  tenant: string,
  apartment: string,
  arrival: string,
  departure: string,
  opts: { kind?: 'booking' | 'block'; adults?: number; childAges?: number[]; country?: string; nightsCents?: number; cancelledAt?: string; feeCents?: number } = {}
) {
  const s = service()
  const kind = opts.kind ?? 'booking'
  let guest: string | null = null
  if (kind === 'booking') {
    const { data: g, error: gErr } = await s
      .from('guests')
      .insert({ tenant_id: tenant, country: opts.country ?? 'AT', last_name: `Gast ${++seq}`, first_name: 'Anna' } as never)
      .select('id')
      .single()
    if (gErr) throw gErr
    guest = (g as { id: string }).id
  }
  const { data, error } = await s
    .from('bookings')
    .insert({
      tenant_id: tenant,
      apartment_id: apartment,
      kind,
      arrival,
      departure,
      planned_departure: departure,
      guest_id: guest,
      check_in: '15:00',
      check_out: '10:00',
      adults: kind === 'block' ? null : (opts.adults ?? 2),
      child_ages: opts.childAges ?? [],
      number_year: kind === 'block' ? null : Number(arrival.slice(0, 4)),
      number_seq: kind === 'block' ? null : 8000 + ++seq,
      block_reason: kind === 'block' ? 'owner_use' : null,
      cancelled_at: opts.cancelledAt ?? null,
    } as never)
    .select('id')
    .single()
  if (error) throw error
  const id = (data as { id: string }).id
  if (kind === 'booking') {
    const cents = opts.nightsCents ?? 10000
    const { error: aErr } = await s.from('booking_amounts').insert({
      id,
      tenant_id: tenant,
      nights_cents: cents,
      billed_nights_cents: cents,
      nights_vat_rate: 10,
      cancellation_fee_cents: opts.feeCents ?? null,
      cancellation_fee_vat_rate: 20,
    } as never)
    if (aErr) throw aErr
  }
  return id
}

async function addCharge(tenant: string, booking: string, position: number, cents: number, touristTax = false) {
  const { error } = await service()
    .from('booking_charges')
    .insert({ tenant_id: tenant, booking_id: booking, position, label: touristTax ? 'Nächtigungsabgabe' : 'Endreinigung', amount_cents: cents, vat_rate: touristTax ? 0 : 10, tourist_tax: touristTax } as never)
  if (error) throw error
}

const ready = (page: Page) => page.waitForFunction(() => Object.keys(document.querySelector('main') ?? {}).some((k) => k.startsWith('__reactFiber')))
const kpis = (page: Page) => page.getByLabel('Kennzahlen', { exact: true })
const kpi = (page: Page, label: string) => kpis(page).locator('div').filter({ has: page.getByText(label, { exact: true }) })

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
  tenants.p = await createTenant(`Ohne Wohnungen ${run}`, [{ user: users.paula, role: 'owner' }])

  const alpen = await addProperty(tenants.a, 'Haus Alpen')
  const see = await addProperty(tenants.a, 'Haus See')
  ids.alpen = alpen
  ids.top1 = await addApartment(tenants.a, alpen, 'Top 1')
  ids.top2 = await addApartment(tenants.a, alpen, 'Top 2')
  ids.studio = await addApartment(tenants.a, see, 'Studio', '2025-10-20T10:00:00+02:00')

  const main = await addBooking(tenants.a, ids.top1, '2025-10-05', '2025-10-15', { childAges: [6], country: 'DE', nightsCents: 100000 })
  await addCharge(tenants.a, main, 1, 6000)
  await addCharge(tenants.a, main, 2, 3000, true)
  await addBooking(tenants.a, ids.top1, '2025-10-20', '2025-10-21', { kind: 'block' })
  await addBooking(tenants.a, ids.top1, '2024-10-05', '2024-10-10', { nightsCents: 50000 })
  await addBooking(tenants.a, ids.top2, '2025-10-28', '2025-11-03', { nightsCents: 60000 })
  await addBooking(tenants.a, ids.studio, '2025-10-18', '2025-10-23', { adults: 1, country: 'NL', nightsCents: 50000 })
  // Gäste aus elf weiteren Ländern im September 2025 (je eine Nacht in Top 2): „Übrige Länder“ im Jahr 2025
  for (const [i, country] of ['IT', 'CH', 'FR', 'BE', 'GB', 'US', 'CZ', 'PL', 'HU', 'SK', 'SI'].entries()) {
    const day = String(i + 1).padStart(2, '0')
    const next = String(i + 2).padStart(2, '0')
    await addBooking(tenants.a, ids.top2, `2025-09-${day}`, `2025-09-${next}`, { adults: 1, country, nightsCents: 9000 })
  }
})

test.afterAll(async () => {
  for (const u of Object.values(users)) await deleteUser(u)
  for (const t of Object.values(tenants)) await service().from('tenants').delete().eq('id', t)
})

test.describe('PROJ-18 Statistische Auswertungen', () => {
  test('Inhaberin: Menüpunkt „Auswertungen“, Standard laufendes Jahr mit Hinweis auf offenen Zeitraum', async ({ page }) => {
    desktopOnly()
    await signInAs(page, users.olga)
    await page.goto('/')
    await page.getByRole('link', { name: 'Auswertungen', exact: true }).first().click()
    await expect(page).toHaveURL(/\/auswertungen/)
    await expect(page.getByRole('heading', { name: 'Auswertungen', level: 1 })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Jahr' })).toContainText(String(YEAR))
    await expect(page.getByRole('combobox', { name: 'Von Monat' })).toContainText('Jänner')
    await expect(page.getByRole('combobox', { name: 'Bis Monat' })).toContainText('Dezember')
    await expect(page.getByText('Zeitraum noch nicht abgeschlossen – enthält auch künftige Buchungen.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Dieses Jahr' })).toHaveAttribute('aria-current', 'true')
  })

  test('Kacheln für Oktober 2025: Auslastung, Umsatz mit USt, Ø-Preis, Buchungen, Gästenächte, je mit Vorjahr', async ({ page }) => {
    desktopOnly()
    await signInAs(page, users.olga)
    await page.goto(OCT)
    await expect(kpis(page)).toBeVisible()
    await expect(page.getByText('Zeitraum noch nicht abgeschlossen')).toHaveCount(0)
    await expect(kpi(page, 'Auslastung')).toContainText(/23\s%/)
    await expect(kpi(page, 'Auslastung')).toContainText('19 von 83 Nächten, 1 gesperrt')
    await expect(kpi(page, 'Auslastung')).toContainText(/Vorjahr 16\s%/)
    await expect(kpi(page, 'Auslastung')).toContainText('+7 Pp.')
    await expect(kpi(page, 'Umsatz')).toContainText('€ 1.960,00')
    await expect(kpi(page, 'Umsatz')).toContainText('inkl. € 178,17 USt')
    await expect(kpi(page, 'Umsatz')).toContainText('Vorjahr € 500,00')
    await expect(kpi(page, 'Umsatz')).toContainText('+292 %')
    await expect(kpi(page, 'Durchschnittspreis je Nacht')).toContainText('€ 103,16')
    await expect(kpi(page, 'Buchungen')).toContainText('Ø 7,0 Nächte')
    await expect(kpi(page, 'Gästenächte')).toContainText('43')
    await expect(kpi(page, 'Gästenächte')).toContainText('6 Ankünfte')
  })

  test('Schnellwahl, ungültige Adresse und Objektfilter mit passender Wohnungsauswahl', async ({ page }) => {
    desktopOnly()
    await signInAs(page, users.olga)
    await page.goto('/auswertungen?jahr=2025&von=13&bis=2')
    await expect(page.getByRole('combobox', { name: 'Jahr' })).toContainText(String(YEAR))
    await ready(page)
    await page.getByRole('link', { name: 'Letztes Jahr' }).click()
    await expect(page).toHaveURL(new RegExp(`jahr=${YEAR - 1}&von=1&bis=12`))
    await page.goto(OCT)
    await ready(page)
    await page.getByRole('combobox', { name: 'Objekt' }).click()
    await page.getByRole('option', { name: `Haus Alpen ${run}` }).click()
    await expect(page).toHaveURL(new RegExp(`objekt=${ids.alpen}`))
    await page.getByRole('combobox', { name: 'Wohnung' }).click()
    await expect(page.getByRole('option', { name: 'Top 1' })).toBeVisible()
    await expect(page.getByRole('option', { name: /Studio/ })).toHaveCount(0)
    await page.keyboard.press('Escape')
    // Haus Alpen: Top 1 (30 verfügbar, 10 belegt) und Top 2 (31, 4)
    await expect(kpi(page, 'Auslastung')).toContainText('14 von 61 Nächten, 1 gesperrt')
  })

  test('Wohnung eines anderen Objekts in der Adresse führt auf „Alle Wohnungen“; einzelne Wohnung ohne „Je Wohnung“', async ({ page }) => {
    desktopOnly()
    await signInAs(page, users.olga)
    await page.goto(`${OCT}&objekt=${ids.alpen}&wohnung=${ids.studio}`)
    await expect(page.getByRole('combobox', { name: 'Wohnung' })).toContainText('Alle Wohnungen')
    await expect(page.getByRole('heading', { name: 'Je Wohnung' })).toBeVisible()
    await page.goto(`${OCT}&wohnung=${ids.top1}`)
    await expect(kpi(page, 'Auslastung')).toContainText('10 von 30 Nächten, 1 gesperrt')
    await expect(page.getByRole('heading', { name: 'Je Wohnung' })).toHaveCount(0)
  })

  test('archivierte Wohnung: wählbar und gekennzeichnet, zählt bis zur Archivierung', async ({ page }) => {
    desktopOnly()
    await signInAs(page, users.olga)
    await page.goto(`${OCT}&wohnung=${ids.studio}`)
    await expect(page.getByRole('combobox', { name: 'Wohnung' })).toContainText('(archiviert)')
    await expect(kpi(page, 'Auslastung')).toContainText('5 von 22 Nächten')
  })

  test('Je Monat: Diagramm umschaltbar, Tabelle mit Gesamt; Je Wohnung sortierbar', async ({ page }) => {
    desktopOnly()
    await signInAs(page, users.olga)
    await page.goto('/auswertungen?jahr=2025&von=9&bis=10')
    await ready(page)
    await expect(page.getByRole('img', { name: /Auslastung je Monat/ })).toBeVisible()
    await page.getByRole('group', { name: 'Diagramm zeigt' }).getByRole('button', { name: 'Umsatz' }).click()
    await expect(page.getByRole('group', { name: 'Diagramm zeigt' }).getByRole('button', { name: 'Umsatz' })).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByRole('img', { name: /Umsatz je Monat/ })).toBeVisible()
    const months = page.getByRole('region', { name: 'Werte je Monat' })
    await expect(months.getByRole('rowheader', { name: 'September 2025' })).toBeVisible()
    await expect(months.getByRole('rowheader', { name: 'Gesamt' })).toBeVisible()
    const apartments = page.getByRole('region', { name: 'Werte je Wohnung' })
    await apartments.getByRole('button', { name: /^Umsatz/ }).click()
    await expect(apartments.getByRole('columnheader', { name: /Umsatz/ })).toHaveAttribute('aria-sort', 'descending')
    // September + Oktober: Top 2 € 1.390 vor Top 1 € 1.060; sortiert mit Objektname in der Zeile
    await expect(apartments.getByRole('rowheader').first()).toContainText('Top 2')
    await expect(apartments.getByRole('rowheader').first()).toContainText('Haus Alpen')
  })

  test('Gästeherkunft: zehn Länder einzeln, „Übrige Länder“ aufklappbar', async ({ page }) => {
    desktopOnly()
    await signInAs(page, users.olga)
    await page.goto('/auswertungen?jahr=2025&von=1&bis=12')
    await ready(page)
    const origin = page.getByRole('region', { name: 'Gästeherkunft je Land' })
    await expect(origin.getByRole('rowheader', { name: 'Deutschland' })).toBeVisible()
    const toggle = origin.getByRole('button', { name: /Übrige Länder \(\d+\)/ })
    await expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    expect(await origin.locator('tbody').first().getByRole('row').count()).toBe(11)
  })

  test('leerer Zustand: Kunde ohne Wohnungen mit Link, Exporte gesperrt', async ({ page }) => {
    desktopOnly()
    await signInAs(page, users.paula)
    await page.goto('/auswertungen')
    await expect(page.getByRole('heading', { name: 'Für den gewählten Zeitraum liegen keine Daten vor.' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Zu den Wohnungen' })).toHaveAttribute('href', '/einstellungen/wohnungen')
    await expect(page.getByRole('button', { name: 'Auswertung als PDF herunterladen' })).toBeDisabled()
    await expect(page.getByRole('button', { name: 'Auswertung als CSV-Datei für Excel herunterladen' })).toBeDisabled()
  })

  test('CSV-Download: Dateiname, eine Zeile je Wohnung und Monat', async ({ page }) => {
    desktopOnly()
    await signInAs(page, users.olga)
    await page.goto(OCT)
    await ready(page)
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Auswertung als CSV-Datei für Excel herunterladen' }).click()])
    expect(download.suggestedFilename()).toBe(`Auswertung_2025-10_Alle_Stand-${TODAY}.csv`)
    const text = readFileSync(await download.path(), 'utf8').replace(/^﻿/, '')
    const lines = text.trimEnd().split('\r\n')
    // seit refine 2026-11-08 mit erster Spalte „Kunde“
    expect(lines[0]).toBe('Kunde;Monat;Objekt;Wohnung;Verfügbare Nächte;Belegte Nächte;Gesperrte Nächte;Auslastung (%);Umsatz brutto;USt;Gästenächte;Ankünfte')
    expect(lines).toHaveLength(4)
    expect(lines).toContain(`Alpenhof ${run};2025-10;Haus Alpen ${run};Top 1;30;10;1;33,3;1060,00;96,36;30;3`)
  })

  test('PDF-Download: Dateiname und PDF-Inhalt', async ({ page }) => {
    desktopOnly()
    await signInAs(page, users.olga)
    await page.goto(OCT)
    await ready(page)
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Auswertung als PDF herunterladen' }).click()])
    expect(download.suggestedFilename()).toBe(`Auswertung_2025-10_Alle_Stand-${TODAY}.pdf`)
    expect(readFileSync(await download.path()).subarray(0, 5).toString('latin1')).toBe('%PDF-')
    await expect(page.getByText('Export konnte nicht erstellt werden')).toHaveCount(0)
  })

  test('Mitarbeiter: kein Menüpunkt, Seite nicht gefunden, Downloads verweigert, alte Dashboard-Kacheln', async ({ page }) => {
    desktopOnly()
    await signInAs(page, users.sam)
    await page.goto('/')
    await expect(page.getByLabel('Tageslage')).toContainText('Belegt heute')
    await expect(page.getByLabel('Tageslage')).not.toContainText('Umsatz')
    await expect(page.getByRole('link', { name: 'Auswertungen', exact: true })).toHaveCount(0)
    const res = await page.goto('/auswertungen')
    expect(res?.status()).toBe(404)
    for (const kind of ['csv', 'pdf']) {
      const r = await page.request.get(`/api/auswertungen/${kind}?jahr=2025&von=10&bis=10`)
      expect(r.status()).toBe(403)
    }
  })

  test('ohne Anmeldung keine Downloads', async ({ page }) => {
    desktopOnly()
    expect((await page.request.get('/api/auswertungen/csv')).status()).toBe(401)
    expect((await page.request.get('/api/auswertungen/pdf')).status()).toBe(401)
  })

  test('Dashboard: Inhaber-Kacheln wie im Entwurf, zentriert; Auslastung öffnet die Auswertung des laufenden Monats', async ({ page }) => {
    desktopOnly()
    await signInAs(page, users.olga)
    await page.goto('/')
    const tiles = page.getByLabel('Tageslage')
    await expect(tiles).toContainText(`Auslastung ${MONTHS[MONTH - 1]}`)
    await expect(tiles).toContainText(`Umsatz ${MONTHS[MONTH - 1]}`)
    await expect(tiles).toContainText('Offene Rechnungen')
    await expect(tiles).toContainText('Anreisen / Abreisen')
    await expect(tiles).not.toContainText('Belegt heute')
    expect(await tiles.locator('> div').first().evaluate((el) => getComputedStyle(el).textAlign)).toBe('center')
    await ready(page)
    await tiles.getByRole('link', { name: `Auslastung ${MONTHS[MONTH - 1]}` }).click()
    await expect(page).toHaveURL(new RegExp(`/auswertungen\\?jahr=${YEAR}&von=${MONTH}&bis=${MONTH}$`))
  })

  test('Handy und Tablet: kein seitliches Scrollen der Seite, am Handy scrollen Tabellen im eigenen Bereich', async ({ page }) => {
    test.skip(!['mobile', 'tablet'].includes(test.info().project.name), 'nur Handy und Tablet')
    await signInAs(page, users.olga)
    await page.goto(OCT)
    await expect(kpis(page)).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    // am Handy scrollt die Monatstabelle im eigenen Bereich, am Tablet passt sie
    const months = page.getByRole('region', { name: 'Werte je Monat' })
    if (test.info().project.name === 'mobile') expect(await months.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true)
  })

  test('keine automatisch erkennbaren WCAG-2.1-AA-Verstöße', async ({ page }) => {
    await signInAs(page, users.olga)
    await page.goto(OCT)
    await expect(kpis(page)).toBeVisible()
    await page.locator('nextjs-portal').evaluateAll((els) => els.forEach((e) => e.remove()))
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([])
  })
})

// Erweiterung Kundenauswahl (refine 2026-11-08). Mia ist Inhaberin bei „Alpenhof“ und „Bergblick“ und Mitarbeiterin bei
// „Aaa Mitarbeit“ (alphabetisch erster Kunde, daher der gewählte Kunde der übrigen Seiten). Oktober 2025:
// Alpenhof Top 1 10 Nächte € 1.000, Bergblick Top 1 5 Nächte € 500 → zusammen 15 von 62 Nächten.
test.describe('PROJ-18 Erweiterung: Auswertung über mehrere Kunden', () => {
  const multi: Record<string, string> = {}
  let mia: E2EUser

  test.beforeAll(async () => {
    test.skip(!hasSupabaseEnv, 'ohne Supabase-Zugang')
    test.setTimeout(120_000)
    mia = await createUser({ displayName: 'Mia Mehrfach' })
    multi.staff = await createTenant(`Aaa Mitarbeit ${run}`, [{ user: mia, role: 'staff' }])
    multi.alpen = await createTenant(`Alpenhof ${run}`, [{ user: mia, role: 'owner' }])
    multi.berg = await createTenant(`Bergblick ${run}`, [{ user: mia, role: 'owner' }])
    const pA = await addProperty(multi.alpen, 'Haus Alpenhof')
    const pB = await addProperty(multi.berg, 'Haus Berg')
    const pC = await addProperty(multi.staff, 'Haus Fremd')
    const aA = await addApartment(multi.alpen, pA, 'Top 1')
    const aB = await addApartment(multi.berg, pB, 'Top 1')
    const aC = await addApartment(multi.staff, pC, 'Top 1')
    await addBooking(multi.alpen, aA, '2025-10-05', '2025-10-15', { nightsCents: 100000, country: 'DE' })
    await addBooking(multi.berg, aB, '2025-10-05', '2025-10-10', { nightsCents: 50000, country: 'NL' })
    await addBooking(multi.staff, aC, '2025-10-05', '2025-10-25', { nightsCents: 900000 })
  })

  test.afterAll(async () => {
    if (mia) await deleteUser(mia)
    for (const t of Object.values(multi)) await service().from('tenants').delete().eq('id', t)
  })

  test('Menüpunkt trotz Mitarbeiter-Kunde als gewähltem Kunden; Standard „Alle Kunden“ nur mit Inhaber-Kunden', async ({ page }) => {
    desktopOnly()
    await signInAs(page, mia)
    await page.goto('/')
    await page.getByRole('link', { name: 'Auswertungen', exact: true }).first().click()
    await expect(page).toHaveURL(/\/auswertungen/)
    // erst fertig laden lassen, sonst bricht Firefox den laufenden Seitenwechsel beim nächsten Aufruf ab
    await expect(page.getByRole('heading', { name: 'Auswertungen', level: 1 })).toBeVisible()
    await page.goto(OCT)
    await expect(page.getByRole('combobox', { name: 'Kunde' })).toContainText('Alle Kunden')
    await expect(kpi(page, 'Auslastung')).toContainText('15 von 62 Nächten')
    await page.getByRole('combobox', { name: 'Kunde' }).click()
    await expect(page.getByRole('option', { name: `Alpenhof ${run}` })).toBeVisible()
    await expect(page.getByRole('option', { name: `Bergblick ${run}` })).toBeVisible()
    await expect(page.getByRole('option', { name: `Aaa Mitarbeit ${run}` })).toHaveCount(0)
    await page.keyboard.press('Escape')
  })

  test('„Je Kunde“ mit beiden Kunden und Gesamt; Je Wohnung nach Kunde gegliedert; Objekte mit Kunde in Klammern', async ({ page }) => {
    desktopOnly()
    await signInAs(page, mia)
    await page.goto(OCT)
    await ready(page)
    const tenantsTable = page.getByRole('region', { name: 'Werte je Kunde' })
    await expect(tenantsTable.getByRole('rowheader', { name: `Alpenhof ${run}` })).toBeVisible()
    await expect(tenantsTable.getByRole('rowheader', { name: `Bergblick ${run}` })).toBeVisible()
    await expect(tenantsTable.getByRole('rowheader', { name: 'Gesamt' })).toBeVisible()
    const apartments = page.getByRole('region', { name: 'Werte je Wohnung' })
    await expect(apartments).toContainText(`Alpenhof ${run}`)
    await expect(apartments).toContainText(`Bergblick ${run}`)
    await page.getByRole('combobox', { name: 'Objekt' }).click()
    await expect(page.getByRole('option', { name: `Haus Alpenhof ${run} (Alpenhof ${run})` })).toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('einzelner Kunde: nur dessen Zahlen, kein „Je Kunde“; gewählter Kunde und Dashboard-Filter bleiben', async ({ page }) => {
    desktopOnly()
    await signInAs(page, mia)
    await page.goto(OCT)
    await ready(page)
    await page.getByRole('combobox', { name: 'Kunde' }).click()
    await page.getByRole('option', { name: `Bergblick ${run}` }).click()
    await expect(page).toHaveURL(new RegExp(`kunde=${multi.berg}`))
    await expect(kpi(page, 'Auslastung')).toContainText('5 von 31 Nächten')
    await expect(page.getByRole('region', { name: 'Werte je Kunde' })).toHaveCount(0)
    // gewählter Kunde der übrigen Seiten unverändert (Seitenleiste), kein Dashboard-Cookie gesetzt
    await expect(page.getByText(`Aaa Mitarbeit ${run}`).first()).toBeVisible()
    expect((await page.context().cookies()).some((c) => c.name === 'apppa-dashboard-kunde')).toBe(false)
  })

  test('Kunde, bei dem die Person nur Mitarbeiterin ist, in der Adresse → „Alle Kunden“ ohne dessen Daten', async ({ page }) => {
    desktopOnly()
    await signInAs(page, mia)
    await page.goto(`${OCT}&kunde=${multi.staff}`)
    await expect(page.getByRole('combobox', { name: 'Kunde' })).toContainText('Alle Kunden')
    await expect(kpi(page, 'Auslastung')).toContainText('15 von 62 Nächten')
    for (const kind of ['csv', 'pdf']) {
      const r = await page.request.get(`/api/auswertungen/${kind}?jahr=2025&von=10&bis=10&kunde=${multi.staff}`)
      expect(r.status()).toBe(200)
      if (kind === 'csv') expect(await r.text()).not.toContain('Aaa Mitarbeit')
    }
  })

  test('Exporte bei „Alle Kunden“: Dateinamen „Alle-Kunden“, CSV mit Spalte Kunde', async ({ page }) => {
    desktopOnly()
    await signInAs(page, mia)
    await page.goto(OCT)
    await ready(page)
    const [csv] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Auswertung als CSV-Datei für Excel herunterladen' }).click()])
    expect(csv.suggestedFilename()).toBe(`Auswertung_2025-10_Alle-Kunden_Stand-${TODAY}.csv`)
    const lines = readFileSync(await csv.path(), 'utf8').replace(/^﻿/, '').trimEnd().split('\r\n')
    expect(lines[0].startsWith('Kunde;Monat;Objekt;Wohnung')).toBe(true)
    expect(lines.slice(1).map((l) => l.split(';')[0])).toEqual([`Alpenhof ${run}`, `Bergblick ${run}`])
    const [pdf] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Auswertung als PDF herunterladen' }).click()])
    expect(pdf.suggestedFilename()).toBe(`Auswertung_2025-10_Alle-Kunden_Stand-${TODAY}.pdf`)
    expect(readFileSync(await pdf.path()).subarray(0, 5).toString('latin1')).toBe('%PDF-')
  })

  test('Dashboard: Auslastung öffnet die Auswertung mit dem Dashboard-Kundenfilter', async ({ page }) => {
    desktopOnly()
    await signInAs(page, mia)
    await page.goto('/?kunde=alle')
    await ready(page)
    await page.getByLabel('Tageslage').getByRole('link', { name: `Auslastung ${MONTHS[MONTH - 1]}` }).click()
    await expect(page).toHaveURL(new RegExp(`/auswertungen\\?jahr=${YEAR}&von=${MONTH}&bis=${MONTH}$`))
    await expect(page.getByRole('heading', { name: 'Auswertungen', level: 1 })).toBeVisible()
    await page.goto(`/?kunde=${multi.berg}`)
    await ready(page)
    await page.getByLabel('Tageslage').getByRole('link', { name: `Umsatz ${MONTHS[MONTH - 1]}` }).click()
    await expect(page).toHaveURL(new RegExp(`kunde=${multi.berg}`))
    await expect(page.getByRole('combobox', { name: 'Kunde' })).toContainText(`Bergblick ${run}`)
  })

  test('Kacheln der Auswertung zentriert; ein Inhaber-Kunde ohne Kundenauswahl', async ({ page }) => {
    desktopOnly()
    await signInAs(page, mia)
    await page.goto(OCT)
    expect(await kpis(page).locator('> div').first().evaluate((el) => getComputedStyle(el).textAlign)).toBe('center')
    await signInAs(page, users.olga)
    await page.goto(OCT)
    await expect(kpis(page)).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Kunde' })).toHaveCount(0)
    await expect(page.getByRole('region', { name: 'Werte je Kunde' })).toHaveCount(0)
  })
})
