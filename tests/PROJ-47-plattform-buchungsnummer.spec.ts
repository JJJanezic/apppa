import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test as base } from '@playwright/test'

import { createTenant, createUser, deleteUser, type E2EUser, hasSupabaseEnv, service, signInAs } from './support/supabase'

// PROJ-47: Plattform-Buchungsnummer (booking.com-Buchungsnummer, Airbnb-Bestätigungscode).
// Abläufe im Projekt „desktop“, Layout auch auf dem Handy. Testdaten über die Datenbank;
// die Kunden verschwinden mit dem Löschen ihrer Inhaber.

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

type Users = (opts?: Parameters<typeof createUser>[0]) => Promise<E2EUser>
const desktopOnly = () => test.skip(test.info().project.name !== 'desktop', 'Abläufe nur im Desktop-Projekt')
const ready = (page: Page) =>
  page.waitForFunction(() => Object.keys(document.querySelector('main') ?? {}).some((k) => k.startsWith('__reactFiber')))
const panel = (page: Page) => page.getByRole('dialog')

const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Vienna' }).format(new Date())
function day(offset: number, from = TODAY) {
  const d = new Date(`${from}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}
const month = (iso: string) => iso.slice(0, 7)
const FUTURE = (() => {
  const d = new Date(`${TODAY.slice(0, 7)}-01T12:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + 2)
  return d.toISOString().slice(0, 10)
})()

async function setup(page: Page, users: Users, role: 'owner' | 'staff' = 'owner') {
  const owner = await users({ displayName: 'Olga Owner' })
  const members: { user: E2EUser; role: 'owner' | 'staff' }[] = [{ user: owner, role: 'owner' }]
  let staff: E2EUser | undefined
  if (role === 'staff') {
    staff = await users({ displayName: 'Sam Staff' })
    members.push({ user: staff, role: 'staff' })
  }
  const tenantId = await createTenant('QA47 Testkunde', members)
  await signInAs(page, role === 'staff' ? staff! : owner)
  return { tenantId }
}

async function addApartment(tenantId: string, name = 'Top 1') {
  let { data: property } = await service().from('properties').select('id').eq('tenant_id', tenantId).limit(1).maybeSingle()
  if (!property) {
    const { data, error } = await service()
      .from('properties')
      .insert({ tenant_id: tenantId, name: 'Haus See', street: 'Seeweg 12', postal_code: '5340', city: 'St. Gilgen', municipality_code: '50330' })
      .select('id')
      .single()
    if (error) throw error
    property = data
  }
  const { data, error } = await service()
    .from('apartments')
    .insert({ tenant_id: tenantId, property_id: property!.id, name, max_guests: 4, price_cents: 10000 })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

async function addGuest(tenantId: string, last: string, first: string) {
  const { data, error } = await service().from('guests').insert({ tenant_id: tenantId, country: 'AT', last_name: last, first_name: first }).select('id').single()
  if (error) throw error
  return data.id
}

let seq = 4700
type Entry = { kind?: 'booking' | 'option'; guestId: string; arrival: string; departure: string; source?: string; platform?: string | null }
// Buchung bzw. Option direkt in der Datenbank (Systemrechte), mit Nummer und Beträgen
async function addBooking(tenantId: string, apartmentId: string, b: Entry) {
  const kind = b.kind ?? 'booking'
  const { data, error } = await service()
    .from('bookings')
    .insert({
      tenant_id: tenantId,
      apartment_id: apartmentId,
      kind,
      arrival: b.arrival,
      planned_departure: b.departure,
      departure: b.departure,
      guest_id: b.guestId,
      check_in: '15:00',
      check_out: '10:00',
      adults: 2,
      number_year: Number(b.arrival.slice(0, 4)),
      number_seq: ++seq,
      option_until: kind === 'option' ? day(5) : null,
      source: b.source ?? 'none',
      platform_number: b.platform ?? null,
    })
    .select('id, number')
    .single()
  if (error) throw error
  const { error: amountError } = await service().from('booking_amounts').insert({ id: data.id, tenant_id: tenantId, nights_cents: 30000 })
  if (amountError) throw amountError
  return data as { id: string; number: string }
}

const stored = async (id: string) => (await service().from('bookings').select('source, platform_number').eq('id', id).single()).data!

async function openList(page: Page, query = '') {
  await page.goto(`/buchungen${query}`)
  await ready(page)
}

async function openBooking(page: Page, id: string) {
  await page.goto(`/buchungen/${id}`)
  await ready(page)
}

async function edit(page: Page) {
  await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click()
  await expect(panel(page)).toBeVisible()
}

async function newBooking(page: Page) {
  await page.getByRole('button', { name: 'Neue Buchung' }).first().click()
  await expect(panel(page)).toBeVisible()
}

async function submit(page: Page, label: string) {
  const button = panel(page).getByRole('button', { name: label, exact: true })
  await button.scrollIntoViewIfNeeded()
  await button.click()
}

async function pickGuest(page: Page, search: string, name: RegExp) {
  await panel(page).getByLabel('Gast suchen').fill(search)
  await page.getByRole('option', { name }).click()
}

async function chooseSource(page: Page, name: string) {
  await panel(page).getByRole('combobox', { name: 'Buchungsquelle' }).click()
  await page.getByRole('option', { name, exact: true }).click()
}

const bookingField = (page: Page) => panel(page).getByLabel('booking.com-Buchungsnummer (optional)')
const airbnbField = (page: Page) => panel(page).getByLabel('Airbnb-Bestätigungscode (optional)')
const savedId = (page: Page) => page.url().split('/').pop()!

test.beforeEach(() => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')
})

test.describe('Formular', () => {
  test('AC: Feld je Quelle (booking.com/Airbnb), nicht bei anderen Quellen; Zurückwechseln stellt die Eingabe wieder her; Leerzeichen entfernt', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    await addApartment(tenantId)
    await addGuest(tenantId, 'Huber', 'Anna')

    await openList(page, `?monat=${month(FUTURE)}`)
    await newBooking(page)
    await panel(page).getByLabel('Anreise', { exact: true }).fill(FUTURE)
    await panel(page).getByLabel('Abreise geplant').fill(day(2, FUTURE))
    await pickGuest(page, 'Huber', /Huber, Anna/)
    // Keine Angabe: kein Feld
    await expect(bookingField(page)).toHaveCount(0)
    await expect(airbnbField(page)).toHaveCount(0)

    await chooseSource(page, 'booking.com')
    await bookingField(page).fill(' 4123 456 789 ')
    // Wechsel zu Airbnb: eigenes, leeres Feld
    await chooseSource(page, 'Airbnb')
    await expect(bookingField(page)).toHaveCount(0)
    await expect(airbnbField(page)).toHaveValue('')
    // Website: kein Feld; zurück auf booking.com: letzte Eingabe wieder da
    await chooseSource(page, 'Website')
    await expect(bookingField(page)).toHaveCount(0)
    await expect(airbnbField(page)).toHaveCount(0)
    await chooseSource(page, 'booking.com')
    await expect(bookingField(page)).toHaveValue(/4123 ?456 ?789/)

    await submit(page, 'Buchung speichern')
    await expect(page).toHaveURL(/\/buchungen\/[0-9a-f-]{36}$/)
    expect(await stored(savedId(page))).toEqual({ source: 'booking_com', platform_number: '4123456789' })
  })

  test('AC: Option hat das Feld, Sperre nicht; leeres Feld speichert ohne Nummer; Nachtragen bei bestehender Buchung', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId, 'Huber', 'Anna')
    const existing = await addBooking(tenantId, apt, { guestId: guest, arrival: FUTURE, departure: day(2, FUTURE), source: 'booking_com' })

    await openList(page, `?monat=${month(FUTURE)}`)
    await newBooking(page)
    await panel(page).getByRole('radio', { name: 'Option' }).click()
    await chooseSource(page, 'booking.com')
    await expect(bookingField(page)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(panel(page)).toHaveCount(0)

    await page.getByRole('button', { name: 'Neue Sperre' }).first().click()
    await expect(panel(page)).toBeVisible()
    await expect(panel(page).getByRole('combobox', { name: 'Buchungsquelle' })).toHaveCount(0)
    await expect(panel(page).getByText(/Buchungsnummer|Bestätigungscode/)).toHaveCount(0)
    await page.keyboard.press('Escape')

    // Bestehende booking.com-Buchung ohne Nummer: leer speichern, dann nachtragen
    await openBooking(page, existing.id)
    await edit(page)
    await expect(bookingField(page)).toHaveValue('')
    await submit(page, 'Änderungen speichern')
    await expect(panel(page)).toHaveCount(0)
    expect((await stored(existing.id)).platform_number).toBeNull()
    // Detailseite lädt nach dem Speichern neu; erst danach erneut bearbeiten (sonst baut sich das Panel neu auf)
    await page.waitForLoadState('networkidle')
    await openBooking(page, existing.id)
    await edit(page)
    await bookingField(page).fill('5550001112')
    await submit(page, 'Änderungen speichern')
    await expect(panel(page)).toHaveCount(0)
    expect((await stored(existing.id)).platform_number).toBe('5550001112')
  })

  test('AC: unerlaubte Zeichen und mehr als 30 Zeichen zeigen einen Fehler, nichts wird gespeichert, Eingaben bleiben; Schreibweise und Bindestrich bleiben', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId, 'Huber', 'Anna')
    const b = await addBooking(tenantId, apt, { guestId: guest, arrival: FUTURE, departure: day(2, FUTURE), source: 'airbnb' })

    await openBooking(page, b.id)
    await edit(page)
    await airbnbField(page).fill('#4123')
    await submit(page, 'Änderungen speichern')
    await expect(panel(page).getByText('Nur Buchstaben, Ziffern und Bindestrich.')).toBeVisible()
    await expect(airbnbField(page)).toHaveValue('#4123')
    await airbnbField(page).fill('1'.repeat(31))
    await submit(page, 'Änderungen speichern')
    await expect(panel(page).getByText('Höchstens 30 Zeichen (ohne Leerzeichen).')).toBeVisible()
    expect((await stored(b.id)).platform_number).toBeNull()

    await airbnbField(page).fill('HMabcd-1234')
    await submit(page, 'Änderungen speichern')
    await expect(panel(page)).toHaveCount(0)
    expect((await stored(b.id)).platform_number).toBe('HMabcd-1234')
  })
})

test.describe('Doppelte Nummer und Quellenwechsel', () => {
  test('AC: Hinweis bei gleicher Nummer (andere Schreibweise, storniert) mit Wohnung, Zeitraum und Link; Mitarbeiter speichert ohne Bestätigung; andere Quelle ohne Hinweis', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users, 'staff')
    const apt = await addApartment(tenantId, 'Top 1')
    const apt2 = await addApartment(tenantId, 'Top 2')
    const guest = await addGuest(tenantId, 'Huber', 'Anna')
    const first = await addBooking(tenantId, apt, { guestId: guest, arrival: day(-20), departure: day(-18), source: 'airbnb', platform: 'hmabcd1234' })
    await service().from('bookings').update({ cancelled_at: new Date().toISOString() }).eq('id', first.id)
    // Gleiche Zeichenfolge bei booking.com zählt nicht für Airbnb
    await addBooking(tenantId, apt2, { guestId: guest, arrival: day(-10), departure: day(-8), source: 'booking_com', platform: 'ZZ999' })

    await openList(page, `?monat=${month(FUTURE)}`)
    await newBooking(page)
    // Der Hinweis läuft in der Live-Prüfung mit und braucht Wohnung und Zeitraum
    await panel(page).getByRole('combobox', { name: 'Wohnung' }).click()
    await page.getByRole('option', { name: 'Haus See · Top 2' }).click()
    await panel(page).getByLabel('Anreise', { exact: true }).fill(FUTURE)
    await panel(page).getByLabel('Abreise geplant').fill(day(2, FUTURE))
    await pickGuest(page, 'Huber', /Huber, Anna/)
    await chooseSource(page, 'Airbnb')
    await airbnbField(page).fill('HMABCD1234')

    const hint = panel(page).getByRole('status').filter({ hasText: 'Airbnb-Bestätigungscode schon vorhanden' })
    await expect(hint).toBeVisible()
    await expect(hint).toContainText(`Buchung ${first.number}`)
    await expect(hint).toContainText('Haus See · Top 1')
    await expect(hint).toContainText('storniert')
    const link = hint.getByRole('link', { name: `Buchung ${first.number} in neuem Tab öffnen` })
    await expect(link).toHaveAttribute('href', `/buchungen/${first.id}`)
    await expect(link).toHaveAttribute('target', '_blank')
    await expect(panel(page).getByRole('button', { name: 'Buchung speichern' })).toBeEnabled()

    // Gleiche Zeichenfolge, andere Quelle: kein Hinweis
    await chooseSource(page, 'booking.com')
    await bookingField(page).fill('ZZ999')
    await expect(panel(page).getByText('booking.com-Buchungsnummer schon vorhanden')).toBeVisible()
    await bookingField(page).fill('HMABCD1234')
    await page.waitForTimeout(800) // Warnungs-Vorschau
    await expect(panel(page).getByText(/schon vorhanden/)).toHaveCount(0)

    await chooseSource(page, 'Airbnb')
    await expect(hint).toBeVisible()
    await submit(page, 'Buchung speichern')
    await expect(page).toHaveURL(/\/buchungen\/[0-9a-f-]{36}$/)
    expect(await stored(savedId(page))).toEqual({ source: 'airbnb', platform_number: 'HMABCD1234' })

    // Unverändert erneut bearbeiten: Hinweis nennt nur die andere (stornierte) Buchung, nicht sich selbst
    await edit(page)
    await expect(panel(page).getByRole('status').filter({ hasText: `Buchung ${first.number}` })).toBeVisible()
  })

  test('AC: Quellenwechsel auf „Website“ löscht die Nummer beim Speichern; Änderungsprotokoll vermerkt sie', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId, 'Huber', 'Anna')
    const b = await addBooking(tenantId, apt, { guestId: guest, arrival: FUTURE, departure: day(2, FUTURE), source: 'booking_com', platform: '4123456789' })

    await openBooking(page, b.id)
    await edit(page)
    await expect(bookingField(page)).toHaveValue('4123456789')
    await chooseSource(page, 'Airbnb')
    await expect(airbnbField(page)).toHaveValue('')
    await chooseSource(page, 'Website')
    await submit(page, 'Änderungen speichern')
    await expect(panel(page)).toHaveCount(0)
    expect(await stored(b.id)).toEqual({ source: 'website', platform_number: null })

    const { data: log } = await service().from('audit_log').select('old_data, new_data, actor_id').eq('table_name', 'bookings').eq('record_id', b.id).eq('action', 'update')
    expect(
      log!.some(
        (l) =>
          (l.old_data as { platform_number: string | null }).platform_number === '4123456789' &&
          (l.new_data as { platform_number: string | null }).platform_number === null &&
          l.actor_id !== null
      )
    ).toBe(true)
  })
})

test.describe('Anzeige und Suche', () => {
  test('AC: Detail zeigt „booking.com · Nummer“ mit Kopieren; ohne Nummer kein Kopier-Knopf', async ({ page, users, context }) => {
    desktopOnly()
    await context.grantPermissions(['clipboard-read', 'clipboard-write'])
    const { tenantId } = await setup(page, users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId, 'Huber', 'Anna')
    const withNumber = await addBooking(tenantId, apt, { guestId: guest, arrival: FUTURE, departure: day(2, FUTURE), source: 'booking_com', platform: '4123456789' })
    const without = await addBooking(tenantId, apt, { guestId: guest, arrival: day(3, FUTURE), departure: day(5, FUTURE), source: 'booking_com' })

    await openBooking(page, withNumber.id)
    await expect(page.getByText('booking.com · 4123456789')).toBeVisible()
    await page.getByRole('button', { name: 'booking.com-Buchungsnummer kopieren' }).click()
    await expect(page.getByText('Nummer kopiert')).toBeVisible()
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('4123456789')

    await openBooking(page, without.id)
    await expect(page.getByText('booking.com', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /kopieren/ })).toHaveCount(0)
  })

  test('AC: Suche findet Teile der Nummer und zeigt sie neben der Buchungsnummer; ohne Suche keine Anzeige', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId, 'Huber', 'Anna')
    const other = await addGuest(tenantId, 'Berger', 'Paul')
    const b = await addBooking(tenantId, apt, { guestId: guest, arrival: FUTURE, departure: day(2, FUTURE), source: 'booking_com', platform: '4123456789' })
    await addBooking(tenantId, apt, { guestId: other, arrival: day(3, FUTURE), departure: day(5, FUTURE), source: 'airbnb', platform: 'HMXYZ' })

    await openList(page, `?monat=${month(FUTURE)}`)
    // je Zeile Buchungsnummer und Name als Link (refine PROJ-8 2026-11-07)
    await expect(page.getByRole('table').getByRole('link')).toHaveCount(4)
    await expect(page.getByText('4123456789')).toHaveCount(0)
    await expect(page.getByRole('columnheader')).not.toContainText(['Plattform'])

    await page.getByLabel('Buchungen durchsuchen').fill('3456')
    await expect(page).toHaveURL(/q=3456/)
    await expect(page.getByRole('table').getByRole('link')).toHaveText([b.number, 'Huber, Anna'])
    await expect(page.getByText('booking.com 4123456789').filter({ visible: true })).toBeVisible()

    await page.getByLabel('Buchungen durchsuchen').fill('hmxyz')
    await expect(page.getByRole('table').getByRole('link')).toHaveText([/^\d{4}-\d{4}$/, 'Berger, Paul'])
    await expect(page.getByText(/Airbnb HMXYZ/).filter({ visible: true })).toBeVisible()
  })
})

test.describe('Layout', () => {
  test('Formular und Detail mit 30-stelliger Nummer: keine WCAG-2.1-AA-Verstöße, kein seitliches Scrollen (auch 375 px)', async ({ page, users }) => {
    test.skip(test.info().project.name === 'tablet', 'Desktop und Handy genügen')
    const { tenantId } = await setup(page, users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId, 'Huber-Oberleitner', 'Anna-Katharina')
    const number = 'ABCDEFGHIJ-1234567890-KLMNOPQR'
    await addBooking(tenantId, apt, { guestId: guest, arrival: day(-10), departure: day(-8), source: 'booking_com', platform: number })
    const b = await addBooking(tenantId, apt, { guestId: guest, arrival: FUTURE, departure: day(2, FUTURE), source: 'booking_com', platform: number })
    const scan = async (label: string) => {
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      expect(results.violations, label).toEqual([])
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, label).toBeLessThanOrEqual(0)
    }
    await openBooking(page, b.id)
    await expect(page.getByText(number)).toBeVisible()
    await scan('Detail')
    await edit(page)
    await expect(panel(page).getByText('booking.com-Buchungsnummer schon vorhanden')).toBeVisible()
    await scan('Formular mit Hinweis')
  })
})
