import { randomUUID } from 'node:crypto'

import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'

import { createTenant, createUser, deleteUser, type E2EUser, hasSupabaseEnv, service, signInAs } from './support/supabase'

// PROJ-14: Dashboard über alle Kunden der Person. Testdaten einmal über die Datenbank, relativ zu heute (Wien):
// Olga ist Inhaberin bei „Alpenhof“ (A) und Mitarbeiterin bei „Seeblick“ (B), Otto ist Inhaber bei B, Sam nur Mitarbeiter
// bei A, Paula hat nur den Kunden „Pension Einzel“ (P). Kunde „Fremd“ (C) hat keine dieser Personen als Mitglied.
// Abläufe nur im Projekt „desktop“, Anordnung zusätzlich am Handy.

test.use({ storageState: { cookies: [], origins: [] } })

const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Vienna' }).format(new Date())
function day(offset: number, from = TODAY) {
  const d = new Date(`${from}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}
// Ein Tag im Vormonat (der 10.), für die Ortstaxe „abgelaufener Monat“
const PREV_MONTH_10 = (() => {
  const d = new Date(`${TODAY.slice(0, 7)}-10T12:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() - 1)
  return d.toISOString().slice(0, 10)
})()
const SHA = 'f'.repeat(64)
const run = randomUUID().slice(0, 6)
// Abläufe in allen Desktop-Projekten (Chrome; Firefox/Safari auf Wunsch), nicht am Handy und Tablet
const desktopOnly = () => test.skip(['mobile', 'tablet'].includes(test.info().project.name), 'Abläufe nur am Desktop')

const users: Record<string, E2EUser> = {}
const tenants: Record<string, string> = {}
const ids: Record<string, string> = {}
let seq = 0

async function addApartment(tenant: string, name: string, archived = false) {
  const s = service()
  const { data: p, error } = await s
    .from('properties')
    .insert({ tenant_id: tenant, name: `Haus ${name}`, street: 'Seeweg 12', postal_code: '5340', city: 'St. Gilgen', municipality_code: '50330' })
    .select('id')
    .single()
  if (error) throw error
  const { data, error: e2 } = await s
    .from('apartments')
    .insert({ tenant_id: tenant, property_id: p.id, name, max_guests: 4, price_cents: 12000, archived_at: archived ? new Date().toISOString() : null } as never)
    .select('id')
    .single()
  if (e2) throw e2
  return (data as { id: string }).id
}

async function addBooking(tenant: string, apartment: string, last: string, arrival: string, departure: string, opts: { childAges?: number[] } = {}) {
  const s = service()
  const { data: g } = await s.from('guests').insert({ tenant_id: tenant, country: 'AT', last_name: last, first_name: 'Anna' } as never).select('id').single()
  const { data, error } = await s
    .from('bookings')
    .insert({
      tenant_id: tenant,
      apartment_id: apartment,
      kind: 'booking',
      arrival,
      departure,
      planned_departure: departure,
      guest_id: (g as { id: string }).id,
      check_in: '15:00',
      check_out: '10:00',
      adults: 2,
      child_ages: opts.childAges ?? [],
      number_year: Number(arrival.slice(0, 4)),
      number_seq: 7000 + ++seq,
    } as never)
    .select('id')
    .single()
  if (error) throw error
  const id = (data as { id: string }).id
  await s.from('booking_amounts').insert({ id, tenant_id: tenant, nights_cents: 30000 } as never)
  return id
}

async function issue(tenant: string, booking: string, kind: 'invoice' | 'partial', due: string) {
  const { error } = await service()
    .from('invoices')
    .insert({
      tenant_id: tenant,
      booking_id: booking,
      origin: 'issued',
      kind,
      number: `E2E-${randomUUID().slice(0, 8)}`,
      invoice_date: day(-1),
      recipient: 'Fischer Anna',
      total_cents: 30000,
      recipient_kind: 'guest',
      company_salutation: 'generic',
      guest_names: 'none',
      due_days: 0,
      due_basis: 'after_invoice',
      partial_mode: kind === 'partial' ? 'amount' : null,
      partial_amount_cents: kind === 'partial' ? 10000 : null,
      issued_at: new Date().toISOString(),
      issued_snapshot: { kind, schedule: { due, depositCents: null, depositDue: null, remainderCents: null } },
      pdf_path: `${tenant}/${randomUUID()}.pdf`,
      pdf_sha256: SHA,
    } as never)
  if (error) throw error
}

const section = (page: Page, title: string) => page.getByRole('region', { name: title, exact: true })
const ready = (page: Page) =>
  page.waitForFunction(() => Object.keys(document.querySelector('main') ?? {}).some((k) => k.startsWith('__reactFiber')))

test.beforeAll(async () => {
  test.skip(!hasSupabaseEnv, 'ohne Supabase-Zugang')
  test.setTimeout(120_000)
  users.olga = await createUser({ displayName: 'Olga Owner' })
  users.otto = await createUser({ displayName: 'Otto Other' })
  users.sam = await createUser({ displayName: 'Sam Staff' })
  users.paula = await createUser({ displayName: 'Paula Single' })
  tenants.a = await createTenant(`Alpenhof ${run}`, [
    { user: users.olga, role: 'owner' },
    { user: users.sam, role: 'staff' },
  ])
  tenants.b = await createTenant(`Seeblick ${run}`, [
    { user: users.otto, role: 'owner' },
    { user: users.olga, role: 'staff' },
  ])
  tenants.p = await createTenant(`Pension Einzel ${run}`, [{ user: users.paula, role: 'owner' }])
  tenants.c = await createTenant(`Fremd ${run}`, [{ user: users.otto, role: 'staff' }])

  const a1 = await addApartment(tenants.a, 'Top 1')
  const a2 = await addApartment(tenants.a, 'Top 2')
  const a3 = await addApartment(tenants.a, 'Top 3')
  const a4 = await addApartment(tenants.a, 'Top 4 alt', true)
  const b1 = await addApartment(tenants.b, 'Top 1')
  const p1 = await addApartment(tenants.p, 'Zimmer 1')

  ids.hubera = await addBooking(tenants.a, a1, 'Huber', TODAY, day(5), { childAges: [6] })
  ids.gruber = await addBooking(tenants.a, a2, 'Gruber', day(-4), TODAY)
  ids.berger = await addBooking(tenants.a, a3, 'Berger', day(-6), TODAY)
  await issue(tenants.a, ids.berger, 'partial', '2099-01-01')
  ids.fischer = await addBooking(tenants.a, a1, 'Fischer', day(-3), TODAY)
  await issue(tenants.a, ids.fischer, 'invoice', '2020-01-01')
  ids.maier = await addBooking(tenants.a, a2, 'Maier', day(-9), day(-5))
  // archivierte Wohnung mit laufender Buchung
  ids.alt = await addBooking(tenants.a, a4, 'Altbestand', day(-2), day(2))
  // Ortstaxe im Vormonat: € 15,00 über 3 Nächte
  ids.taxed = await addBooking(tenants.a, a3, 'Steuer', PREV_MONTH_10, day(3, PREV_MONTH_10))
  await service().from('booking_charges').insert({ tenant_id: tenants.a, booking_id: ids.taxed, position: 1, label: 'Nächtigungsabgabe', amount_cents: 1500, vat_rate: 0, tourist_tax: true } as never)
  // Kunde B: Anreise heute, offene nacherfasste Rechnung
  ids.huberb = await addBooking(tenants.b, b1, 'Seemann', TODAY, day(5), { childAges: [6] })
  await service().from('invoices').insert({ tenant_id: tenants.b, number: `B-${run}`, invoice_date: day(-1), recipient: 'Seemann Anna', total_cents: 7000 } as never)
  // Kunde P (nur Paula)
  await addBooking(tenants.p, p1, 'Einzel', TODAY, day(2))
})

test.afterAll(async () => {
  for (const u of Object.values(users)) await deleteUser(u)
  for (const t of Object.values(tenants)) await service().from('tenants').delete().eq('id', t)
})

test.describe('PROJ-14 Dashboard', () => {
  test('Inhaberin bei A und Mitarbeiterin bei B sieht beide Kunden zusammen (Kacheln, Unterzeile, Heute)', async ({ page }) => {
    desktopOnly()
    await signInAs(page, users.olga)
    await page.goto('/')
    await expect(page.getByText(/^Heute reisen 6 Gäste an und 3 ab\./)).toBeVisible()
    await expect(page.getByLabel('Tageslage')).toContainText('Anreisen heute')
    await expect(page.getByLabel('Tageslage')).toContainText('davon 2 ohne Rechnung')
    const today = section(page, 'Heute')
    await expect(today.getByText(`Haus Top 1 · Top 1 · Alpenhof ${run}`).first()).toBeVisible()
    await expect(today.getByText(`Haus Top 1 · Top 1 · Seeblick ${run}`)).toBeVisible()
    await expect(today.getByText('3 Pers. · 5 N.').first()).toBeVisible()
  })

  test('Archivierte Wohnung zählt bei „Belegt heute“ nicht mit, auch wenn sie noch belegt ist', async ({ page }) => {
    desktopOnly()
    await signInAs(page, users.olga)
    await page.goto('/')
    await expect(page.getByText('Heute reisen 6 Gäste an und 3 ab. 2 von 4 Wohnungen sind belegt.')).toBeVisible()
    await expect(page.getByLabel('Tageslage')).toContainText('2 / 4')
  })

  test('Abreisen ohne Rechnung bzw. Schlussrechnung sind hervorgehoben, mit Rechnung „Endreinigung“', async ({ page }) => {
    desktopOnly()
    await signInAs(page, users.olga)
    await page.goto('/')
    const today = section(page, 'Heute')
    await expect(today.getByRole('listitem').filter({ hasText: 'Anna Gruber' })).toContainText('Rechnung fehlt')
    await expect(today.getByRole('listitem').filter({ hasText: 'Anna Berger' })).toContainText('Schlussrechnung fehlt')
    await expect(today.getByRole('listitem').filter({ hasText: 'Anna Fischer' })).toContainText('Endreinigung')
  })

  test('„Noch nicht abgerechnet“ und „Ortstaxe“ nur für den Kunden, bei dem sie Inhaberin ist', async ({ page }) => {
    desktopOnly()
    await signInAs(page, users.olga)
    await page.goto('/')
    const unbilled = section(page, 'Noch nicht abgerechnet')
    await expect(unbilled.getByRole('listitem')).toHaveCount(4)
    await expect(unbilled).toContainText('Anna Steuer')
    await expect(unbilled.getByRole('listitem').filter({ hasText: 'Anna Berger' })).toContainText('Schlussrechnung fehlt')
    await expect(unbilled).not.toContainText('Seemann')
    const tax = section(page, 'Ortstaxe')
    await expect(tax.getByRole('table')).toContainText('St. Gilgen')
    await expect(tax.getByRole('table')).toContainText('€ 15,00')
    await expect(tax.getByRole('columnheader', { name: 'Laufend' })).toBeVisible()
    await expect(tax.getByRole('columnheader', { name: 'Abgelaufen' })).toBeVisible()
    await expect(tax).not.toContainText('Meldung vorbereiten')
  })

  test('„Offene Rechnungen“ über beide Kunden, überfällige zuerst, mit Summe', async ({ page }) => {
    desktopOnly()
    await signInAs(page, users.olga)
    await page.goto('/')
    const open = section(page, 'Offene Rechnungen')
    await expect(open.getByRole('listitem')).toHaveCount(3)
    await expect(open.getByRole('listitem').first()).toContainText('überfällig')
    await expect(open).toContainText('€ 670,00')
    await expect(open).toContainText(`Seeblick ${run}`)
    await expect(page.getByLabel('Tageslage')).toContainText('3 Rechnungen, davon 1 überfällig')
  })

  test('Kundenfilter: nur Kunde B, ohne Kundennamen, gemerkt nach Neuladen; Inhaber-Abschnitte entfallen', async ({ page }) => {
    desktopOnly()
    await signInAs(page, users.olga)
    await page.goto('/')
    await ready(page)
    await page.getByLabel('Kunden', { exact: true }).click()
    await page.getByRole('option', { name: `Seeblick ${run}` }).click()
    await expect(page).toHaveURL(/kunde=/)
    const today = section(page, 'Heute')
    await expect(today.getByText('Anna Seemann')).toBeVisible()
    await expect(today).not.toContainText('Gruber')
    await expect(today).not.toContainText(`Seeblick ${run}`)
    await expect(section(page, 'Noch nicht abgerechnet')).toHaveCount(0)
    await expect(section(page, 'Ortstaxe')).toHaveCount(0)
    await page.goto('/')
    await expect(page.getByLabel('Kunden', { exact: true })).toContainText(`Seeblick ${run}`)
    await expect(section(page, 'Heute')).not.toContainText('Gruber')
    // gewählter Kunde der übrigen Seiten bleibt Alpenhof
    await page.goto('/buchungen')
    await expect(page.getByRole('button', { name: `Kunden wechseln: Alpenhof ${run}` })).toBeVisible()
  })

  test('Klick auf eine Zeile eines anderen Kunden wechselt den Kunden und öffnet die Buchung', async ({ page }) => {
    desktopOnly()
    await signInAs(page, users.olga)
    await page.goto('/?kunde=alle')
    await section(page, 'Heute').getByRole('button', { name: /Anna Seemann/ }).click()
    await expect(page).toHaveURL(new RegExp(`/buchungen/${ids.huberb}`))
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Seemann')
    await expect(page.getByRole('button', { name: `Kunden wechseln: Seeblick ${run}` })).toBeVisible()
  })

  test('Belegung: Kunden als Gruppen, Klick auf Eintrag eines anderen Kunden wechselt und öffnet das Panel', async ({ page }) => {
    desktopOnly()
    await signInAs(page, users.olga)
    await page.goto('/?kunde=alle')
    const calendar = page.locator('section[aria-labelledby="belegung-titel"]')
    await expect(calendar.getByText(`Alpenhof ${run}`, { exact: true })).toBeVisible()
    await expect(calendar.getByText(`Seeblick ${run}`, { exact: true })).toBeVisible()
    await ready(page)
    await calendar.getByRole('button', { name: /Seemann/ }).click()
    await expect(page).toHaveURL(new RegExp(`eintrag=${ids.huberb}`))
    await expect(page.getByRole('dialog')).toContainText('Seemann')
    // Das Panel ist modal; nach dem Schließen ist die Seitenleiste wieder erreichbar
    await page.keyboard.press('Escape')
    await expect(page.getByRole('button', { name: `Kunden wechseln: Seeblick ${run}` })).toBeVisible()
  })

  test('Belegung: „Neue Buchung“ nur, wenn ausschließlich der gewählte Kunde angezeigt wird', async ({ page }) => {
    desktopOnly()
    await signInAs(page, users.olga)
    await page.goto('/?kunde=alle')
    const calendar = page.locator('section[aria-labelledby="belegung-titel"]')
    await expect(calendar.getByRole('heading', { name: 'Belegung' })).toBeVisible()
    await expect(calendar.getByRole('button', { name: 'Neue Buchung' })).toHaveCount(0)
    await page.goto(`/?kunde=${tenants.b}`)
    await expect(calendar.getByRole('button', { name: 'Neue Buchung' })).toHaveCount(0)
    await page.goto(`/?kunde=${tenants.a}`)
    await expect(calendar.getByRole('button', { name: 'Neue Buchung' })).toBeVisible()
  })

  test('Person mit nur einem Kunden: kein Filter, keine Kundennamen', async ({ page }) => {
    desktopOnly()
    await signInAs(page, users.paula)
    await page.goto('/')
    await expect(page.getByLabel('Kunden', { exact: true })).toHaveCount(0)
    await expect(section(page, 'Heute').getByText('Haus Zimmer 1 · Zimmer 1', { exact: true })).toBeVisible()
    await expect(page.getByText('Heute reist 1 Gast an')).toHaveCount(0)
    await expect(page.getByText('Heute reisen 2 Gäste an und niemand ab. 1 von 1 Wohnungen sind belegt.')).toBeVisible()
  })

  test('Mitarbeiter sieht keine Inhaber-Abschnitte, aber den Hinweis „Rechnung fehlt“', async ({ page }) => {
    desktopOnly()
    await signInAs(page, users.sam)
    await page.goto('/')
    await expect(section(page, 'Noch nicht abgerechnet')).toHaveCount(0)
    await expect(section(page, 'Ortstaxe')).toHaveCount(0)
    await expect(section(page, 'Offene Rechnungen')).toBeVisible()
    await expect(section(page, 'Heute').getByRole('listitem').filter({ hasText: 'Anna Gruber' })).toContainText('Rechnung fehlt')
    await expect(page.getByLabel('Tageslage')).not.toContainText('ohne Rechnung')
  })

  test('Kundenwechsel: fremder Kunde → Hinweis, fremde Ziele werden nicht angesprungen', async ({ page }) => {
    desktopOnly()
    await signInAs(page, users.olga)
    const foreign = await page.request.post('/kunde-wechseln', { form: { tenantId: tenants.c, weiter: `/buchungen/${ids.hubera}` }, maxRedirects: 0 })
    expect(foreign.status()).toBe(303)
    expect(foreign.headers().location).toMatch(/\/\?hinweis=kein-zugriff$/)
    for (const target of ['https://example.com/x', '//example.com', '/\\example.com']) {
      const res = await page.request.post('/kunde-wechseln', { form: { tenantId: tenants.a, weiter: target }, maxRedirects: 0 })
      expect(new URL(res.headers().location, 'http://localhost:3000').origin).toBe('http://localhost:3000')
    }
    const crossSite = await page.request.post('/kunde-wechseln', { form: { tenantId: tenants.b }, headers: { origin: 'https://example.com' }, maxRedirects: 0 })
    expect(crossSite.status()).toBe(403)
    await page.goto('/?hinweis=kein-zugriff')
    await expect(page.getByText('Kein Zugriff mehr auf diesen Kunden.')).toBeVisible()
    await expect(page).toHaveURL(/\/$/)
  })

  test('Handy: „Heute“ steht vor „Belegung“, Kacheln zweispaltig, ohne seitliches Scrollen', async ({ page }) => {
    test.skip(!['mobile', 'tablet'].includes(test.info().project.name), 'Anordnung nur am Handy und Tablet')
    await signInAs(page, users.olga)
    await page.goto('/')
    const todayBox = await section(page, 'Heute').boundingBox()
    const calendarBox = await page.locator('section[aria-labelledby="belegung-titel"]').boundingBox()
    expect(todayBox!.y).toBeLessThan(calendarBox!.y)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })

  test('Barrierefreiheit (axe) ohne Verstöße', async ({ page }) => {
    await signInAs(page, users.olga)
    await page.goto('/')
    await expect(section(page, 'Ortstaxe').getByRole('table')).toBeVisible()
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
  })
})
