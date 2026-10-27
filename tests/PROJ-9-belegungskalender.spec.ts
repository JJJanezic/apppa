import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test as base } from '@playwright/test'

import { createTenant, createUser, deleteUser, type E2EUser, hasSupabaseEnv, service, signInAs } from './support/supabase'

// PROJ-9: Belegungskalender. Abläufe nur im Projekt „desktop“, Layout und Barrierefreiheit in allen Breiten.
// Testdaten werden über die Datenbank angelegt, relativ zu heute (Wien); die Kunden verschwinden mit ihren Inhabern.

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

const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Vienna' }).format(new Date())
function day(offset: number, from = TODAY) {
  const d = new Date(`${from}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}
// Erster Tag des nächsten Monats: Monatsansicht mit festen Zahlen
const NEXT_MONTH = (() => {
  const d = new Date(`${TODAY.slice(0, 7)}-01T12:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + 1)
  return d.toISOString().slice(0, 7)
})()
const inMonth = (n: number) => `${NEXT_MONTH}-${String(n).padStart(2, '0')}`

async function setup(page: Page, users: Users, role: 'owner' | 'staff' = 'owner') {
  const owner = await users({ displayName: 'Olga Owner' })
  const members: { user: E2EUser; role: 'owner' | 'staff' }[] = [{ user: owner, role: 'owner' }]
  let staff: E2EUser | undefined
  if (role === 'staff') {
    staff = await users({ displayName: 'Sam Staff' })
    members.push({ user: staff, role: 'staff' })
  }
  const tenantId = await createTenant('QA9 Testkunde', members)
  return { tenantId, owner, staff, signIn: () => signInAs(page, role === 'staff' ? staff! : owner) }
}

async function addProperty(tenantId: string, name: string) {
  const { data, error } = await service()
    .from('properties')
    .insert({ tenant_id: tenantId, name, street: 'Seeweg 12', postal_code: '5340', city: 'St. Gilgen', municipality_code: '50330' })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

async function addApartment(tenantId: string, propertyId: string, name: string, extra: Record<string, unknown> = {}) {
  const { data, error } = await service()
    .from('apartments')
    .insert({ tenant_id: tenantId, property_id: propertyId, name, max_guests: 4, price_cents: 12000, ...extra } as never)
    .select('id')
    .single()
  if (error) throw error
  return (data as { id: string }).id
}

async function addGuest(tenantId: string, lastName: string, firstName: string) {
  const { data, error } = await service()
    .from('guests')
    .insert({ tenant_id: tenantId, country: 'AT', last_name: lastName, first_name: firstName } as never)
    .select('id')
    .single()
  if (error) throw error
  return (data as { id: string }).id
}

let seq = 900
async function addEntry(
  tenantId: string,
  apartmentId: string,
  b: { kind?: 'booking' | 'option' | 'block'; guestId?: string; arrival: string; departure: string; optionUntil?: string; cancelled?: boolean }
) {
  const kind = b.kind ?? 'booking'
  const block = kind === 'block'
  const { data, error } = await service()
    .from('bookings')
    .insert({
      tenant_id: tenantId,
      apartment_id: apartmentId,
      kind,
      arrival: b.arrival,
      departure: b.departure,
      guest_id: block ? null : b.guestId,
      check_in: block ? null : '15:00',
      check_out: block ? null : '10:00',
      adults: block ? null : 2,
      child_ages: [],
      number_year: block ? null : Number(b.arrival.slice(0, 4)),
      number_seq: block ? null : ++seq,
      option_until: kind === 'option' ? (b.optionUntil ?? day(5)) : null,
      block_reason: block ? 'owner_use' : null,
      cancelled_at: b.cancelled ? new Date().toISOString() : null,
    } as never)
    .select('id, number')
    .single()
  if (error) throw error
  const row = data as { id: string; number: string | null }
  if (!block) {
    const { error: amountError } = await service().from('booking_amounts').insert({ id: row.id, tenant_id: tenantId, nights_cents: 30000 } as never)
    if (amountError) throw amountError
  }
  return row
}

// Kunde mit zwei Objekten: „Haus See“ (Top 1, Top 2) und „Stadthaus“ (Loft, Alt archiviert)
async function withCalendar(tenantId: string) {
  const see = await addProperty(tenantId, 'Haus See')
  const stadt = await addProperty(tenantId, 'Stadthaus')
  const top1 = await addApartment(tenantId, see, 'Top 1')
  const top2 = await addApartment(tenantId, see, 'Top 2')
  const loft = await addApartment(tenantId, stadt, 'Loft')
  const alt = await addApartment(tenantId, stadt, 'Alt', { archived_at: new Date().toISOString() })
  const g = async (last: string, first: string) => addGuest(tenantId, last, first)
  const entries = {
    // Wechseltag am Tag +3: keine Überschneidung
    huber: await addEntry(tenantId, top1, { guestId: await g('Huber', 'Anna'), arrival: day(-1), departure: day(3) }),
    brenner: await addEntry(tenantId, top1, { guestId: await g('Brenner', 'Lukas'), arrival: day(3), departure: day(6) }),
    rossi: await addEntry(tenantId, top2, { kind: 'option', guestId: await g('Rossi', 'Sofia'), arrival: day(1), departure: day(4) }),
    sperre: await addEntry(tenantId, top2, { kind: 'block', arrival: day(6), departure: day(8) }),
    // Langer Aufenthalt und eine Überschneidung in „Loft“
    wallner: await addEntry(tenantId, loft, { guestId: await g('Wallner', 'Petra'), arrival: day(-10), departure: day(40) }),
    doppelt: await addEntry(tenantId, loft, { guestId: await g('Doppelt', 'Dora'), arrival: day(1), departure: day(2) }),
    // Nicht sichtbar: storniert und verfallen
    storniert: await addEntry(tenantId, top2, { guestId: await g('Storniert', 'Stefan'), arrival: day(9), departure: day(11), cancelled: true }),
    verfallen: await addEntry(tenantId, top2, { kind: 'option', guestId: await g('Verfallen', 'Vera'), arrival: day(9), departure: day(11), optionUntil: day(-1) }),
    // Archivierte Wohnung mit Eintrag im Bereich
    altgast: await addEntry(tenantId, alt, { guestId: await g('Altgast', 'Alois'), arrival: day(0), departure: day(2) }),
  }
  return { see, stadt, top1, top2, loft, alt, entries }
}

const bar = (page: Page, kind: 'Buchung' | 'Option' | 'Sperre', name: string) =>
  page.getByRole('button', { name: new RegExp(`^${kind}: ${name},`) })
const timeline = (page: Page) => page.getByRole('region', { name: /Belegung je Wohnung/ })
const dialog = (page: Page) => page.getByRole('dialog')

async function open(page: Page, path = '/') {
  await page.goto(path)
  await ready(page)
  await expect(page.getByRole('heading', { name: 'Belegung', exact: true })).toBeVisible()
}

// Mitte des Tages `date` in der Zeile der Wohnung `apartment` (Zeitleiste, 14 Tage ab heute − 2)
async function cellPoint(page: Page, apartment: string, offsetFromToday: number) {
  const name = (await timeline(page).getByText(apartment, { exact: true }).boundingBox())!
  const area = (await timeline(page).locator('div.relative').first().boundingBox())!
  const index = offsetFromToday + 2
  return { x: area.x + ((index + 0.5) / 14) * area.width, y: name.y + name.height / 2 }
}

test.beforeEach(() => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')
})

test.describe('Orte und Navigation', () => {
  test('Dashboard zeigt die Zeitleiste über 14 Tage ab heute − 2, Navigation und Vollbild über 28 Tage', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, signIn } = await setup(page, users)
    await withCalendar(tenantId)
    await signIn()
    await open(page)
    await expect(page.getByRole('heading', { level: 2, name: 'Belegung' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Zeitleiste' })).toHaveAttribute('aria-selected', 'true')
    // 14 Spalten: Wochentag + Tageszahl je Tag im Kopf
    const header = timeline(page).locator('div.grid').first().locator('> div').nth(1).locator('> div')
    await expect(header).toHaveCount(14)
    await expect(header.first()).toContainText(String(Number(day(-2).slice(8))))
    await expect(page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link', { name: 'Belegung' })).toBeVisible()

    await page.getByRole('link', { name: 'Vollbild' }).click()
    await expect(page).toHaveURL(/\/belegung$/)
    await expect(page.getByRole('heading', { level: 1, name: 'Belegung' })).toBeVisible()
    await expect(timeline(page).locator('div.grid').first().locator('> div').nth(1).locator('> div')).toHaveCount(28)
    await expect(page).toHaveTitle('Belegung · apppa')
  })
})

test.describe('Zeitleiste', () => {
  test('Buchung gefüllt mit „Nachname · Personen“, Option umrandet, Sperre mit Grund; storniert und verfallen fehlen', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, signIn } = await setup(page, users)
    await withCalendar(tenantId)
    await signIn()
    await open(page)
    await expect(bar(page, 'Buchung', 'Anna Huber')).toHaveText('Huber · 2')
    await expect(bar(page, 'Buchung', 'Anna Huber')).toHaveClass(/bg-ds-neutral-800/)
    await expect(bar(page, 'Option', 'Sofia Rossi')).toHaveText('Option · Rossi · 2')
    await expect(bar(page, 'Option', 'Sofia Rossi')).toHaveClass(/border-2/)
    await expect(bar(page, 'Sperre', 'Eigennutzung')).toHaveText('Eigennutzung')
    await expect(bar(page, 'Sperre', 'Eigennutzung')).toHaveClass(/repeating-linear-gradient/)
    await expect(page.getByRole('button', { name: /Storniert/ })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /Verfallen/ })).toHaveCount(0)
    // Legende
    for (const label of ['Direkt', 'Option', 'Gesperrt']) await expect(page.getByRole('list', { name: 'Legende' }).getByText(label)).toBeVisible()
  })

  test('Wechseltag: beide Balken nebeneinander, kein Warnsymbol; Überschneidung: untereinander mit Warnsymbol', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, signIn } = await setup(page, users)
    await withCalendar(tenantId)
    await signIn()
    await open(page)
    const huber = (await bar(page, 'Buchung', 'Anna Huber').boundingBox())!
    const brenner = (await bar(page, 'Buchung', 'Lukas Brenner').boundingBox())!
    expect(Math.abs(huber.y - brenner.y)).toBeLessThan(1)
    expect(huber.x + huber.width).toBeLessThanOrEqual(brenner.x + 1)
    const wallner = (await bar(page, 'Buchung', 'Petra Wallner').boundingBox())!
    const doppelt = (await bar(page, 'Buchung', 'Dora Doppelt').boundingBox())!
    expect(doppelt.y).toBeGreaterThan(wallner.y + wallner.height - 1)
    // Genau eine Wohnung mit Warnsymbol (Loft)
    await expect(timeline(page).getByText('Überschneidung', { exact: true })).toHaveCount(1)
  })

  test('Blättern um 7 Tage, „Heute“ und Datumswähler', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, signIn } = await setup(page, users)
    await withCalendar(tenantId)
    await signIn()
    await open(page)
    await page.getByRole('button', { name: 'Weiter' }).click()
    await expect(page).toHaveURL(new RegExp(`ab=${day(5)}`))
    await expect(bar(page, 'Buchung', 'Anna Huber')).toHaveCount(0)
    await page.getByRole('button', { name: 'Zurück' }).click()
    await expect(page).toHaveURL(new RegExp(`ab=${day(-2)}`))
    await page.getByRole('button', { name: 'Zurück' }).click()
    await expect(page).toHaveURL(new RegExp(`ab=${day(-9)}`))
    await page.getByRole('button', { name: 'Heute' }).click()
    await expect(page).toHaveURL(new RegExp(`ab=${day(-2)}`))
    await page.getByRole('button', { name: /Datum wählen/ }).click()
    await page.getByLabel('Springen zu').fill(day(30))
    await page.getByRole('button', { name: 'Anzeigen' }).click()
    await expect(page).toHaveURL(new RegExp(`ab=${day(30)}`))
    await expect(bar(page, 'Buchung', 'Petra Wallner')).toBeVisible()
    await expect(bar(page, 'Buchung', 'Lukas Brenner')).toHaveCount(0)
  })

  test('QA BUG-2: schneller Doppelklick auf „Zurück“ blättert zwei Wochen', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, signIn } = await setup(page, users)
    await withCalendar(tenantId)
    await signIn()
    await open(page)
    await page.getByRole('button', { name: 'Zurück' }).dblclick()
    await expect(page).toHaveURL(new RegExp(`ab=${day(-16)}`))
  })

  test('Eintrag vor bzw. nach dem Bereich wird am Rand abgeschnitten und bleibt anklickbar', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, signIn } = await setup(page, users)
    await withCalendar(tenantId)
    await signIn()
    await open(page)
    const wallner = bar(page, 'Buchung', 'Petra Wallner')
    await expect(wallner).toHaveClass(/rounded-l-none/)
    await expect(wallner).toHaveClass(/rounded-r-none/)
    await wallner.click()
    await expect(dialog(page).getByRole('heading', { name: 'Petra Wallner' })).toBeVisible()
  })
})

test.describe('Monatsansicht', () => {
  async function monthData(tenantId: string) {
    const p = await addProperty(tenantId, 'Haus Monat')
    const a = await addApartment(tenantId, p, 'A')
    const b = await addApartment(tenantId, p, 'B')
    const c = await addApartment(tenantId, p, 'C')
    const d = await addApartment(tenantId, p, 'D', { archived_at: new Date().toISOString() })
    await addEntry(tenantId, a, { guestId: await addGuest(tenantId, 'Anders', 'Ann'), arrival: inMonth(3), departure: inMonth(6) })
    await addEntry(tenantId, b, { kind: 'block', arrival: inMonth(3), departure: inMonth(5) })
    await addEntry(tenantId, c, { kind: 'option', guestId: await addGuest(tenantId, 'Chen', 'Cai'), arrival: inMonth(5), departure: inMonth(7), optionUntil: inMonth(1) })
    await addEntry(tenantId, d, { guestId: await addGuest(tenantId, 'Dorn', 'Didi'), arrival: inMonth(3), departure: inMonth(4) })
  }
  const cell = (page: Page, n: number, x: number, y: number, an: number, ab: number) =>
    page.getByRole('button', { name: new RegExp(`^[^,]+, ${n}\\. [^:]+: ${x} von ${y} belegt, ${an} Anreisen, ${ab} Abreisen$`) })

  test('Kacheln zählen Buchungen, Optionen und Sperren (ohne archivierte Wohnungen); An/Ab ohne Sperren; Tagesliste', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, signIn } = await setup(page, users)
    await monthData(tenantId)
    await signIn()
    await open(page, `/?ansicht=monat&monat=${NEXT_MONTH}`)
    await expect(page.getByRole('tab', { name: 'Monat' })).toHaveAttribute('aria-selected', 'true')
    await expect(cell(page, 1, 0, 3, 0, 0)).toHaveAttribute('aria-pressed', 'true')
    await expect(cell(page, 3, 2, 3, 2, 0)).toContainText('2/3')
    await expect(cell(page, 4, 2, 3, 0, 1)).toBeVisible()
    await expect(cell(page, 5, 2, 3, 1, 0)).toBeVisible()
    await expect(cell(page, 6, 1, 3, 0, 1)).toBeVisible()
    await expect(page.getByText('Keine Belegung an diesem Tag.')).toBeVisible()

    await cell(page, 5, 2, 3, 1, 0).click()
    await expect(cell(page, 5, 2, 3, 1, 0)).toHaveAttribute('aria-pressed', 'true')
    await expect(page).toHaveURL(new RegExp(`tag=${inMonth(5)}`))
    const list = page.locator('section[aria-live="polite"]')
    await expect(list.getByRole('button')).toHaveCount(3)
    await expect(list.getByRole('button', { name: /Ann Anders.*bis/ })).toBeVisible()
    await expect(list.getByRole('button', { name: /Eigennutzung.*Abreise/ })).toBeVisible()
    await expect(list.getByRole('button', { name: /Option · Cai Chen.*Anreise/ })).toBeVisible()
    await list.getByRole('button', { name: /Ann Anders/ }).click()
    await expect(dialog(page).getByRole('heading', { name: 'Ann Anders' })).toBeVisible()
  })

  test('Blättern monatsweise; Klick auf einen Tag lädt nicht neu', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, signIn } = await setup(page, users)
    await monthData(tenantId)
    await signIn()
    await open(page, '/?ansicht=monat')
    await page.getByRole('button', { name: 'Weiter' }).click()
    await expect(page).toHaveURL(new RegExp(`monat=${NEXT_MONTH}`))
    await page.evaluate(() => ((window as unknown as { __marker: boolean }).__marker = true))
    await cell(page, 3, 2, 3, 2, 0).click()
    expect(await page.evaluate(() => (window as unknown as { __marker?: boolean }).__marker)).toBe(true)
  })
})

test.describe('Detailpanel', () => {
  test('Klick auf einen Balken öffnet das volle Detail; Bearbeiten verschiebt den Balken, Ansicht und Zeitraum bleiben', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, signIn } = await setup(page, users)
    await withCalendar(tenantId)
    await signIn()
    await open(page)
    const before = (await bar(page, 'Buchung', 'Lukas Brenner').boundingBox())!
    await bar(page, 'Buchung', 'Lukas Brenner').click()
    await expect(page).toHaveURL(/eintrag=/)
    await expect(dialog(page).getByRole('heading', { name: 'Lukas Brenner' })).toBeVisible()
    await expect(dialog(page).getByRole('heading', { name: 'Preis' })).toBeVisible()
    await expect(dialog(page).getByRole('button', { name: 'Stornieren' })).toBeVisible()

    await dialog(page).getByRole('button', { name: 'Bearbeiten', exact: true }).click()
    const edit = page.getByRole('dialog', { name: 'Buchung bearbeiten' })
    await expect(edit).toBeVisible()
    await edit.getByLabel('Abreise geplant').fill(day(8))
    const save = edit.getByRole('button', { name: 'Änderungen speichern', exact: true })
    await save.scrollIntoViewIfNeeded()
    await save.click()
    await expect(page.getByText('Änderungen gespeichert.')).toBeVisible()
    await expect(edit).toBeHidden()
    await expect(page).toHaveURL(new RegExp(`ab=${day(-2)}`))
    // Panel zeigt den neuen Stand (3 → 5 Nächte), Kalender dahinter ebenso
    await expect(dialog(page).locator('dd', { hasText: /^5$/ })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog(page)).toHaveCount(0)
    await expect.poll(async () => (await bar(page, 'Buchung', 'Lukas Brenner').boundingBox())!.width).toBeGreaterThan(before.width + 50)
  })

  test('Stornieren im Panel schließt das Panel, der Balken verschwindet', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, signIn } = await setup(page, users)
    await withCalendar(tenantId)
    await signIn()
    await open(page)
    await bar(page, 'Buchung', 'Lukas Brenner').click()
    await dialog(page).getByRole('button', { name: 'Stornieren' }).click()
    const confirm = page.getByRole('dialog', { name: /stornieren\?/ })
    await confirm.getByRole('button', { name: 'Stornieren', exact: true }).click()
    await expect(page.getByText('Buchung storniert.')).toBeVisible()
    await expect(dialog(page)).toHaveCount(0)
    await expect(bar(page, 'Buchung', 'Lukas Brenner')).toHaveCount(0)
    await expect(page).not.toHaveURL(/eintrag=/)
  })

  test('Sperre löschen im Panel schließt das Panel; Link auf überschneidenden Eintrag öffnet diesen im Panel', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, signIn } = await setup(page, users)
    await withCalendar(tenantId)
    await signIn()
    await open(page)
    await bar(page, 'Buchung', 'Dora Doppelt').click()
    await dialog(page).getByRole('link', { name: /Wallner, Petra/ }).click()
    await expect(dialog(page).getByRole('heading', { name: 'Petra Wallner' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(dialog(page)).toHaveCount(0)
    await expect(page).not.toHaveURL(/eintrag=/)

    await bar(page, 'Sperre', 'Eigennutzung').click()
    await dialog(page).getByRole('button', { name: 'Bearbeiten', exact: true }).click()
    await page.getByRole('dialog', { name: 'Sperre bearbeiten' }).getByRole('button', { name: 'Sperre löschen' }).click()
    await page.getByRole('alertdialog', { name: 'Sperre löschen?' }).getByRole('button', { name: 'Sperre löschen' }).click()
    await expect(page.getByText('Sperre gelöscht.')).toBeVisible()
    await expect(dialog(page)).toHaveCount(0)
    await expect(bar(page, 'Sperre', 'Eigennutzung')).toHaveCount(0)
    await expect(page).toHaveURL(/^[^?]*\/\?/)
  })

  test('Mitarbeiter: Panel ohne Preis und ohne „Stornieren“', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, signIn } = await setup(page, users, 'staff')
    await withCalendar(tenantId)
    await signIn()
    await open(page)
    await bar(page, 'Buchung', 'Anna Huber').click()
    await expect(dialog(page).getByRole('heading', { name: 'Anna Huber' })).toBeVisible()
    await expect(dialog(page).getByRole('button', { name: 'Bearbeiten', exact: true })).toBeVisible()
    await expect(dialog(page).getByRole('heading', { name: 'Preis' })).toHaveCount(0)
    await expect(dialog(page).getByText('€')).toHaveCount(0)
    await expect(dialog(page).getByRole('button', { name: 'Stornieren' })).toHaveCount(0)
  })

  test('Alter oder fremder Eintrag in der Adresse: Hinweis statt Panel', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, signIn } = await setup(page, users)
    await withCalendar(tenantId)
    // Eintrag eines anderen Kunden
    const other = await users({ displayName: 'Fremd' })
    const otherTenant = await createTenant('QA9 Fremd', [{ user: other, role: 'owner' }])
    const otherApt = await addApartment(otherTenant, await addProperty(otherTenant, 'Fremdhaus'), 'Fremd 1')
    const foreign = await addEntry(otherTenant, otherApt, { guestId: await addGuest(otherTenant, 'Geheim', 'Gerda'), arrival: day(1), departure: day(3) })
    await signIn()
    for (const id of [foreign.id, '00000000-0000-4000-8000-000000000000']) {
      await page.goto(`/?eintrag=${id}`)
      await ready(page)
      await expect(page.getByText('Dieser Eintrag wurde nicht gefunden.', { exact: false })).toBeVisible()
      await expect(dialog(page)).toHaveCount(0)
      await expect(page).not.toHaveURL(/eintrag=/)
      await expect(page.getByText('Geheim')).toHaveCount(0)
    }
  })
})

test.describe('Anlegen per Klick', () => {
  test('freier Tag öffnet „Neue Buchung“ vorbelegt; nach dem Speichern erscheint der Balken', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, signIn } = await setup(page, users)
    const { see } = await withCalendar(tenantId)
    await addGuest(tenantId, 'Klick', 'Karla')
    void see
    await signIn()
    await open(page)
    const point = await cellPoint(page, 'Top 2', 10)
    await page.mouse.click(point.x, point.y)
    const form = page.getByRole('dialog', { name: 'Neue Buchung' })
    await expect(form).toBeVisible()
    await expect(form.getByLabel('Anreise', { exact: true })).toHaveValue(day(10))
    await expect(form.getByLabel('Abreise', { exact: true })).toHaveValue(day(11))
    await expect(form.getByRole('combobox', { name: 'Wohnung' })).toContainText('Haus See · Top 2')
    await form.getByLabel('Gast suchen').fill('Klick')
    await page.getByRole('option', { name: /Klick, Karla/ }).click()
    const save = form.getByRole('button', { name: 'Buchung speichern', exact: true })
    await save.scrollIntoViewIfNeeded()
    await save.click()
    await expect(page.getByText('Buchung angelegt.')).toBeVisible()
    await expect(page).toHaveURL(/^[^?]*\/(\?|$)/)
    await expect(bar(page, 'Buchung', 'Karla Klick')).toBeVisible()
  })

  test('Mitarbeiter können per Klick anlegen; in archivierten Wohnungen passiert nichts', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, signIn } = await setup(page, users, 'staff')
    await withCalendar(tenantId)
    await signIn()
    await open(page)
    const archived = await cellPoint(page, 'Alt', 8)
    await page.mouse.click(archived.x, archived.y)
    await page.waitForTimeout(500)
    await expect(dialog(page)).toHaveCount(0)
    const free = await cellPoint(page, 'Top 1', 9)
    await page.mouse.click(free.x, free.y)
    await expect(page.getByRole('dialog', { name: 'Neue Buchung' }).getByLabel('Anreise', { exact: true })).toHaveValue(day(9))
    await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Neue Sperre' }).click()
    await expect(page.getByRole('dialog', { name: 'Neue Sperre' })).toBeVisible()
  })
})

test.describe('Filter, gemerkte Ansicht und archivierte Wohnungen', () => {
  test('Objekt-Chips filtern; Ansicht und Filter bleiben nach Neuladen und im Vollbild, der Zeitraum nicht', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, signIn } = await setup(page, users)
    await withCalendar(tenantId)
    await signIn()
    await open(page)
    const chips = page.getByRole('group', { name: 'Objekt' })
    await expect(chips.getByRole('button')).toHaveText(['Alle', 'Haus See', 'Stadthaus'])
    await chips.getByRole('button', { name: 'Stadthaus' }).click()
    await expect(chips.getByRole('button', { name: 'Stadthaus' })).toHaveAttribute('aria-pressed', 'true')
    await expect(timeline(page).getByText('Top 1', { exact: true })).toHaveCount(0)
    await expect(timeline(page).getByText('Loft', { exact: true })).toBeVisible()
    await page.getByRole('tab', { name: 'Monat' }).click()
    await expect(page).toHaveURL(/ansicht=monat/)
    // Monat: x/y zählt nur „Loft“ (Alt ist archiviert)
    await expect(page.getByRole('button', { name: /: 1 von 1 belegt/ }).first()).toBeVisible()

    await page.goto('/')
    await ready(page)
    await expect(page.getByRole('tab', { name: 'Monat' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('group', { name: 'Objekt' }).getByRole('button', { name: 'Stadthaus' })).toHaveAttribute('aria-pressed', 'true')
    await page.getByRole('link', { name: 'Vollbild' }).click()
    await expect(page.getByRole('heading', { level: 1, name: 'Belegung' })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Monat' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('group', { name: 'Objekt' }).getByRole('button', { name: 'Stadthaus' })).toHaveAttribute('aria-pressed', 'true')
  })

  test('nur ein Objekt: keine Chips; archivierte Wohnung nur mit Eintrag und mit Hinweis', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, signIn } = await setup(page, users)
    const p = await addProperty(tenantId, 'Einzelhaus')
    const a = await addApartment(tenantId, p, 'Eins')
    const old = await addApartment(tenantId, p, 'Ehemals', { archived_at: new Date().toISOString() })
    await addApartment(tenantId, p, 'Nie', { archived_at: new Date().toISOString() })
    await addEntry(tenantId, old, { guestId: await addGuest(tenantId, 'Alt', 'Anton'), arrival: day(1), departure: day(2) })
    void a
    await signIn()
    await open(page)
    await expect(page.getByRole('group', { name: 'Objekt' })).toHaveCount(0)
    await expect(timeline(page).getByText('Eins', { exact: true })).toBeVisible()
    await expect(timeline(page).getByText('Ehemals', { exact: true })).toBeVisible()
    await expect(timeline(page).getByText('Einzelhaus · archiviert')).toBeVisible()
    await expect(timeline(page).getByText('Nie', { exact: true })).toHaveCount(0)
    // Ohne Einträge im Bereich verschwindet auch „Ehemals“
    await page.getByRole('button', { name: 'Weiter' }).click()
    await page.getByRole('button', { name: 'Weiter' }).click()
    await expect(timeline(page).getByText('Ehemals', { exact: true })).toHaveCount(0)
  })

  test('Leerzustand ohne Wohnung (Mitarbeiter): Hinweis ohne Link', async ({ page, users }) => {
    desktopOnly()
    const { signIn } = await setup(page, users, 'staff')
    await signIn()
    await page.goto('/')
    await ready(page)
    await expect(page.getByRole('heading', { name: 'Noch keine Wohnung' })).toBeVisible()
    await expect(page.getByText('Sobald der Inhaber eine anlegt', { exact: false })).toBeVisible()
    await expect(page.locator('main a[href="/einstellungen/wohnungen"]')).toHaveCount(0)
  })

  test('Leerzustand ohne Wohnung (Inhaber): Link zur Wohnungsverwaltung; Wohnungen ohne Einträge zeigen leere Zeilen', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, signIn } = await setup(page, users)
    await signIn()
    await page.goto('/belegung')
    await ready(page)
    await expect(page.getByRole('heading', { name: 'Noch keine Wohnung' })).toBeVisible()
    await page.locator('main a[href="/einstellungen/wohnungen"]').click()
    await expect(page).toHaveURL(/\/einstellungen\/wohnungen/)
    await addApartment(tenantId, await addProperty(tenantId, 'Leerhaus'), 'Leer 1')
    await open(page, '/belegung')
    await expect(timeline(page).getByText('Leer 1', { exact: true })).toBeVisible()
    await expect(timeline(page).getByRole('button')).toHaveCount(0)
  })
})

test.describe('Sicherheit', () => {
  test('ohne Anmeldung führt /belegung zur Anmeldung', async ({ page }) => {
    desktopOnly()
    await page.goto('/belegung?ansicht=monat')
    await expect(page).toHaveURL(/\/anmelden/)
  })

  test('manipuliertes Cookie und fremde Objekt-ID fallen auf Standardwerte zurück; HTML im Gastnamen bleibt Text', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, signIn } = await setup(page, users)
    await withCalendar(tenantId)
    const p = await addProperty(tenantId, 'Haus <i>X</i>')
    const a = await addApartment(tenantId, p, 'Top <b>3</b>')
    await addEntry(tenantId, a, { guestId: await addGuest(tenantId, '<img src=x onerror="window.__xss=1">', 'Eve'), arrival: day(0), departure: day(2) })
    await signIn()
    let dialogs = 0
    page.on('dialog', () => dialogs++)
    await page.context().addCookies([{ name: 'apppa-belegung', value: 'monat.11111111-1111-4111-8111-111111111111', url: 'http://localhost:3000' }])
    await open(page)
    await expect(page.getByRole('tab', { name: 'Monat' })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('group', { name: 'Objekt' }).getByRole('button', { name: 'Alle' })).toHaveAttribute('aria-pressed', 'true')
    await page.context().addCookies([{ name: 'apppa-belegung', value: '"><script>alert(1)</script>', url: 'http://localhost:3000' }])
    await open(page, '/?objekt=<script>&ab=nicht-datum&ansicht=x')
    await expect(page.getByRole('tab', { name: 'Zeitleiste' })).toHaveAttribute('aria-selected', 'true')
    await expect(timeline(page).getByText('Top <b>3</b>', { exact: true })).toBeVisible()
    await expect(page.getByRole('group', { name: 'Objekt' }).getByRole('button', { name: 'Haus <i>X</i>' })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Buchung: Eve <img src=x/ })).toBeVisible()
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
    expect(dialogs).toBe(0)
  })
})

test.describe('Layout und Barrierefreiheit', () => {
  test('QA BUG-3/4: am Handy bleibt das Label langer Aufenthalte sichtbar, links neben der Namensspalte scrollt nichts durch', async ({ page, users }) => {
    test.skip(test.info().project.name !== 'mobile', 'nur Handy')
    const { tenantId, signIn } = await setup(page, users)
    await withCalendar(tenantId)
    await signIn()
    await open(page)
    await timeline(page).evaluate((el) => el.scrollBy(400, 0))
    await expect.poll(() => timeline(page).evaluate((el) => el.scrollLeft)).toBeGreaterThan(300)
    const box = await page.evaluate(() => {
      const region = document.querySelector('[role="region"]')!.getBoundingClientRect()
      const name = [...document.querySelectorAll('[role="region"] span')].find((el) => el.textContent === 'Loft')!.closest('.sticky')!.getBoundingClientRect()
      const button = [...document.querySelectorAll('button')].find((b) => b.getAttribute('aria-label')?.startsWith('Buchung: Petra Wallner'))!
      const label = button.querySelector('span')!.getBoundingClientRect()
      const probe = document.elementFromPoint(region.left + 2, name.top + name.height / 2)
      return { regionLeft: region.left, nameLeft: name.left, nameRight: name.right, labelLeft: label.left, probeInNameColumn: Boolean(probe?.closest('.sticky')) }
    })
    expect(box.nameLeft).toBeLessThanOrEqual(box.regionLeft + 1)
    expect(box.probeInNameColumn).toBe(true)
    expect(box.labelLeft).toBeGreaterThanOrEqual(box.nameRight - 1)
    await expect(bar(page, 'Buchung', 'Petra Wallner').locator('span')).toBeInViewport()
  })


  test('Zeitleiste, Monat und Panel ohne axe-Verstöße; die Seite scrollt nicht seitlich', async ({ page, users }) => {
    const { tenantId, signIn } = await setup(page, users)
    await withCalendar(tenantId)
    await signIn()
    const check = async (label: string) => {
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.html.slice(0, 120)).join(' | ')}`), label).toEqual([])
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, label).toBeLessThanOrEqual(0)
    }
    await open(page)
    await check('Zeitleiste')
    // Zeitleiste ist in sich seitlich scrollbar, wenn sie nicht passt
    const fits = await timeline(page).evaluate((el) => el.scrollWidth <= el.clientWidth)
    if (!fits) {
      await timeline(page).evaluate((el) => el.scrollBy(300, 0))
      await expect(timeline(page).getByText('Top 1', { exact: true })).toBeInViewport()
    }
    await open(page, '/belegung?ansicht=monat')
    await check('Monat')
    await open(page, '/')
    await bar(page, 'Buchung', 'Anna Huber').click()
    await expect(dialog(page).getByRole('heading', { name: 'Anna Huber' })).toBeVisible()
    await check('Panel')
  })
})
