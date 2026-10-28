import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test as base } from '@playwright/test'

import { deDate, re } from './support/format'
import { createTenant, createUser, deleteUser, type E2EUser, hasSupabaseEnv, service, signInAs } from './support/supabase'

// PROJ-30: Buchungs-Erweiterung (Abreise geplant/tatsächlich, Gästeblattnummer, Wohnsitz, Buchungsquelle,
// Monatsauswahl, Mitreisende). Abläufe im Projekt „desktop“, Layout auch auf dem Handy.
// Testdaten über die Datenbank; die Kunden verschwinden mit dem Löschen ihrer Inhaber.

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
// Beträge mit beliebigem Leerzeichen nach „€“ (auch geschütztes)
const money = (value: string) => new RegExp(`€\\s?${value.replace('.', '\\.')}`)

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
  const tenantId = await createTenant('QA30 Testkunde', members)
  await signInAs(page, role === 'staff' ? staff! : owner)
  return { tenantId, owner, staff }
}

async function addApartment(tenantId: string, name = 'Top 1', extra: Record<string, unknown> = {}) {
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
    .insert({ tenant_id: tenantId, property_id: property!.id, name, max_guests: 4, price_cents: 10000, ...extra } as never)
    .select('id')
    .single()
  if (error) throw error
  return (data as { id: string }).id
}

async function addGuest(tenantId: string, last: string, first: string) {
  const { data, error } = await service().from('guests').insert({ tenant_id: tenantId, country: 'AT', last_name: last, first_name: first }).select('id').single()
  if (error) throw error
  return data.id
}

let seq = 300
type Entry = {
  kind?: 'booking' | 'option'
  guestId: string
  arrival: string
  departure: string
  plannedDeparture?: string
  nightsCents?: number
  sheet?: string
  source?: string
  sourceCustom?: string
  residence?: boolean
  adults?: number
}
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
      planned_departure: b.plannedDeparture ?? b.departure,
      departure: b.departure,
      guest_id: b.guestId,
      check_in: '15:00',
      check_out: '10:00',
      adults: b.adults ?? 2,
      number_year: Number(b.arrival.slice(0, 4)),
      number_seq: ++seq,
      option_until: kind === 'option' ? day(5) : null,
      guest_sheet_number: b.sheet ?? null,
      source: b.source ?? 'none',
      source_custom: b.sourceCustom ?? null,
      residence_registered: b.residence ?? false,
    })
    .select('id, number')
    .single()
  if (error) throw error
  const { error: amountError } = await service()
    .from('booking_amounts')
    .insert({ id: data.id, tenant_id: tenantId, nights_cents: b.nightsCents ?? 30000 })
  if (amountError) throw amountError
  return data as { id: string; number: string }
}

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

const departure = (page: Page) => panel(page).getByLabel('Abreise', { exact: true })
const planned = (page: Page) => panel(page).getByLabel('Abreise geplant')
const billed = async (id: string) =>
  (await service().from('booking_amounts').select('nights_cents, billed_nights_cents').eq('id', id).single()).data

test.beforeEach(() => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')
})

test.describe('Formular', () => {
  test('AC: Reihenfolge Anreise → Abreise geplant → Abreise; Standardwerte; Quellen-Liste; Sperre ohne neue Felder', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    await addApartment(tenantId)
    await openList(page)
    await newBooking(page)

    const boxes = await Promise.all(
      [panel(page).getByLabel('Anreise', { exact: true }), planned(page), departure(page)].map(async (l) => (await l.boundingBox())!)
    )
    expect(boxes[0].x).toBeLessThan(boxes[1].x)
    expect(boxes[1].x).toBeLessThan(boxes[2].x)
    await expect(panel(page).getByLabel('Gästeblattnummer (optional)')).toHaveValue('')
    await expect(panel(page).getByRole('checkbox', { name: 'Wohnsitz angemeldet' })).not.toBeChecked()
    const source = panel(page).getByRole('combobox', { name: 'Buchungsquelle' })
    await expect(source).toHaveText('Keine Angabe')
    await source.click()
    await expect(page.getByRole('option')).toHaveText([
      'Website',
      'Instagram',
      'Google Ads',
      'Newsletter',
      'Empfehlung',
      'Plattform-Suche',
      'booking.com',
      'Eigene Angabe',
      'Keine Angabe',
    ])
    await page.keyboard.press('Escape')

    // Option: dieselben Felder
    await panel(page).getByRole('radio', { name: 'Option' }).click()
    await expect(panel(page).getByLabel('Gästeblattnummer (optional)')).toBeVisible()
    await expect(panel(page).getByRole('combobox', { name: 'Buchungsquelle' })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(panel(page)).toBeHidden()

    // Sperre: keine neuen Felder
    await page.getByRole('button', { name: 'Neue Sperre' }).first().click()
    await expect(panel(page)).toBeVisible()
    await expect(panel(page).getByLabel(/Gästeblattnummer/)).toHaveCount(0)
    await expect(panel(page).getByLabel('Abreise geplant')).toHaveCount(0)
    await expect(panel(page).getByRole('combobox', { name: 'Buchungsquelle' })).toHaveCount(0)
  })

  test('AC: Abreise läuft mit der geplanten mit, bis sie von Hand geändert wird; Prüfregeln für Daten, Nummer und Quelle', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    await addApartment(tenantId)
    await openList(page)
    await newBooking(page)

    await panel(page).getByLabel('Anreise', { exact: true }).fill(FUTURE)
    await planned(page).fill(day(5, FUTURE))
    await expect(departure(page)).toHaveValue(day(5, FUTURE))
    await planned(page).fill(day(4, FUTURE))
    await expect(departure(page)).toHaveValue(day(4, FUTURE))
    await departure(page).fill(day(6, FUTURE))
    await planned(page).fill(day(3, FUTURE))
    await expect(departure(page)).toHaveValue(day(6, FUTURE))

    // Abreisen am Anreisetag, Nummer zu lang, eigene Quelle leer
    await planned(page).fill(FUTURE)
    await departure(page).fill(FUTURE)
    await panel(page).getByLabel('Gästeblattnummer (optional)').fill('x'.repeat(31))
    await panel(page).getByRole('combobox', { name: 'Buchungsquelle' }).click()
    await page.getByRole('option', { name: 'Eigene Angabe' }).click()
    await submit(page, 'Buchung speichern')
    for (const message of [
      'Die geplante Abreise muss nach der Anreise liegen.',
      'Die Abreise muss nach der Anreise liegen.',
      'Höchstens 30 Zeichen.',
      'Bitte die Quelle eingeben.',
    ]) {
      await expect(panel(page).getByText(message, { exact: true })).toBeVisible()
    }
    // Wechsel weg von „Eigene Angabe“ blendet den Freitext aus
    await panel(page).getByLabel('Eigene Quelle').fill('Messe')
    await panel(page).getByRole('combobox', { name: 'Buchungsquelle' }).click()
    await page.getByRole('option', { name: 'Website' }).click()
    await expect(panel(page).getByLabel('Eigene Quelle')).toHaveCount(0)
  })
})

test.describe('Abreise und Preis', () => {
  test('AC: Verlängerung rechnet 500 € → 600 €, frühere Abreise bleibt 500 €, zurück auf geplant 500 €; Detail zeigt beide Abreisen nur bei Abweichung', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId, 'Huber', 'Anna')
    const booking = await addBooking(tenantId, apt, { guestId: guest, arrival: FUTURE, departure: day(5, FUTURE), nightsCents: 50000 })
    await service().from('booking_charges').insert({ tenant_id: tenantId, booking_id: booking.id, position: 1, label: 'Reinigung', amount_cents: 6000 })

    await openBooking(page, booking.id)
    await expect(page.getByText('Abreise geplant')).toHaveCount(0)
    await edit(page)
    await departure(page).fill(day(6, FUTURE))
    await expect(panel(page).getByText(/Verlängert: vereinbart €\s?500,00 für 5 Nächte, abzurechnen 6 Nächte: €\s?600,00/)).toBeVisible()
    await expect(panel(page).getByText(money('660'))).toBeVisible() // 600 + Reinigung 60
    await submit(page, 'Änderungen speichern')
    await expect(page.getByText('Änderungen gespeichert.')).toBeVisible()
    expect(await billed(booking.id)).toEqual({ nights_cents: 50000, billed_nights_cents: 60000 })
    await expect(page.getByText('Abreise geplant')).toBeVisible()
    await expect(page.getByText(/Vereinbart €\s?500,00 für 5 Nächte, anteilig auf 6 Nächte hochgerechnet/)).toBeVisible()
    await expect(page.getByText(money('660,00'))).toBeVisible()
    expect((await service().from('booking_charges').select('amount_cents').eq('booking_id', booking.id)).data).toEqual([{ amount_cents: 6000 }])

    // frühere Abreise: voller Zeitraum
    await edit(page)
    await departure(page).fill(day(3, FUTURE))
    await expect(panel(page).getByText('Frühere Abreise: abgerechnet wird der volle gebuchte Zeitraum (5 Nächte).')).toBeVisible()
    await submit(page, 'Änderungen speichern')
    await expect(page.getByText('Änderungen gespeichert.').first()).toBeVisible()
    await expect.poll(() => billed(booking.id)).toEqual({ nights_cents: 50000, billed_nights_cents: 50000 })
    await expect(page.getByText('abgerechnet 5 Nächte')).toBeVisible()

    // zurück auf geplant: nur ein Abreisedatum
    await edit(page)
    await departure(page).fill(day(5, FUTURE))
    await submit(page, 'Änderungen speichern')
    await expect(page.getByText('Abreise geplant')).toHaveCount(0)
    expect(await billed(booking.id)).toEqual({ nights_cents: 50000, billed_nights_cents: 50000 })
  })

  test('AC: Mitarbeiter verlängert: Preis wird hochgerechnet, ohne dass er Beträge sieht; frühere Abreise gibt den Kalender frei', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users, 'staff')
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId, 'Huber', 'Anna')
    const booking = await addBooking(tenantId, apt, { guestId: guest, arrival: day(1), departure: day(6), nightsCents: 50000 })
    await openBooking(page, booking.id)
    await edit(page)
    await expect(panel(page).getByText(/€/)).toHaveCount(0)
    await departure(page).fill(day(7))
    await submit(page, 'Änderungen speichern')
    await expect(page.getByText('Änderungen gespeichert.')).toBeVisible()
    expect(await billed(booking.id)).toEqual({ nights_cents: 50000, billed_nights_cents: 60000 })
    expect((await service().from('bookings').select('price_review').eq('id', booking.id).single()).data?.price_review).toBe(false)
    await expect(page.getByText(/€/)).toHaveCount(0)

    // frühere Abreise am Tag +4: Kalender zeigt den Balken nur bis dahin
    await edit(page)
    await departure(page).fill(day(4))
    await submit(page, 'Änderungen speichern')
    await expect(panel(page)).toBeHidden()
    await expect.poll(async () => (await service().from('bookings').select('departure').eq('id', booking.id).single()).data?.departure).toBe(day(4))
    await page.goto('/')
    await ready(page)
    const bar = page.getByRole('button', { name: /^Buchung: Anna Huber,/ })
    await expect(bar).toHaveAccessibleName(new RegExp(`bis ${re(deDate(day(4)))}$`))
  })
})

test.describe('Gästeblattnummer, Wohnsitz und Quelle', () => {
  test('AC: doppelte Nummer (andere Schreibweise, auch storniert) warnt; Mitarbeiter speichert bewusst trotzdem', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users, 'staff')
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId, 'Huber', 'Anna')
    const first = await addBooking(tenantId, apt, { guestId: guest, arrival: day(-20), departure: day(-18), sheet: 'A-123' })
    await service().from('bookings').update({ cancelled_at: new Date().toISOString() }).eq('id', first.id)

    await openList(page, `?monat=${month(FUTURE)}`)
    await newBooking(page)
    await panel(page).getByLabel('Anreise', { exact: true }).fill(FUTURE)
    await planned(page).fill(day(2, FUTURE))
    await pickGuest(page, 'Huber', /Huber, Anna/)
    await panel(page).getByLabel('Gästeblattnummer (optional)').fill(' a-123 ')
    const warning = panel(page).getByRole('alert').filter({ hasText: 'Gästeblattnummer bereits vergeben' })
    await expect(warning).toBeVisible()
    await expect(warning).toContainText(`Buchung · ${first.number} · Huber, Anna · storniert`)
    await expect(panel(page).getByRole('button', { name: 'Buchung speichern' })).toBeDisabled()
    await warning.getByRole('checkbox', { name: /Trotzdem speichern/ }).check()
    await submit(page, 'Buchung speichern')
    await expect(page).toHaveURL(/\/buchungen\/[0-9a-f-]{36}$/)
    const id = page.url().split('/').pop()!
    expect((await service().from('bookings').select('guest_sheet_number').eq('id', id).single()).data?.guest_sheet_number).toBe('a-123')

    // erneutes Speichern mit unveränderter Nummer warnt nicht mehr
    await edit(page)
    await page.waitForTimeout(800) // Warnungs-Vorschau
    await expect(panel(page).getByText('Gästeblattnummer bereits vergeben')).toHaveCount(0)
  })

  test('AC: Detail und Liste zeigen Nummer, Quelle (Freitext) und Wohnsitz; Suche nach Nummer; Filter „Quelle“ in der Adresse', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId, 'Huber', 'Anna')
    const other = await addGuest(tenantId, 'Berger', 'Paul')
    const custom = await addBooking(tenantId, apt, { guestId: guest, arrival: FUTURE, departure: day(2, FUTURE), sheet: 'GB-77', source: 'custom', sourceCustom: 'Messe Salzburg', residence: true })
    await addBooking(tenantId, apt, { guestId: other, arrival: day(3, FUTURE), departure: day(5, FUTURE), source: 'booking_com' })
    await addBooking(tenantId, apt, { kind: 'option', guestId: guest, arrival: day(6, FUTURE), departure: day(8, FUTURE), source: 'booking_com' })

    await openBooking(page, custom.id)
    await expect(page.getByText('Messe Salzburg')).toBeVisible()
    await expect(page.getByText('GB-77')).toBeVisible()
    await expect(page.getByText('Wohnsitz angemeldet (keine Ortstaxe)')).toBeVisible()

    await openList(page, `?monat=${month(FUTURE)}`)
    await expect(page.getByText(`${custom.number} · Gästeblatt GB-77`).filter({ visible: true })).toBeVisible()
    await page.getByRole('combobox', { name: 'Quelle' }).click()
    await page.getByRole('option', { name: 'booking.com' }).click()
    await expect(page).toHaveURL(/quelle=booking-com/)
    await expect(page.getByRole('table').getByRole('link')).toHaveText(['Berger, Paul', 'Huber, Anna'])

    await openList(page)
    await page.getByLabel('Buchungen durchsuchen').fill('gb-77')
    await expect(page).toHaveURL(/q=gb-77/)
    await expect(page.getByRole('table').getByRole('link')).toHaveText(['Huber, Anna'])

    // BUG-1: Nummer mit Schrägstrich und Punkt
    await service().from('bookings').update({ guest_sheet_number: 'GB/2026.17' }).eq('id', custom.id)
    await openList(page)
    await page.getByLabel('Buchungen durchsuchen').fill('gb/2026.17')
    await expect(page.getByRole('table').getByRole('link')).toHaveText(['Huber, Anna'])
  })

  test('AC: booking.com-Buchung in Accent-700, Option mit Rahmen in Accent-700, andere Quelle „Direkt“; Legende', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const top1 = await addApartment(tenantId, 'Top 1')
    const top2 = await addApartment(tenantId, 'Top 2')
    await addBooking(tenantId, top1, { guestId: await addGuest(tenantId, 'Booking', 'Bea'), arrival: day(0), departure: day(3), source: 'booking_com' })
    await addBooking(tenantId, top2, { kind: 'option', guestId: await addGuest(tenantId, 'Option', 'Otto'), arrival: day(0), departure: day(3), source: 'booking_com' })
    await addBooking(tenantId, top1, { guestId: await addGuest(tenantId, 'Insta', 'Ines'), arrival: day(4), departure: day(6), source: 'instagram' })
    await page.goto('/')
    await ready(page)
    const bookingBar = page.getByRole('button', { name: /^Buchung: Bea Booking,/ })
    await expect(bookingBar).toHaveClass(/bg-ds-accent-700/)
    await expect(bookingBar).toHaveCSS('background-color', 'rgb(0, 103, 134)')
    await expect(bookingBar).toHaveCSS('color', 'rgb(255, 255, 255)')
    await expect(page.getByRole('button', { name: /^Option: Otto Option,/ })).toHaveCSS('border-top-color', 'rgb(0, 103, 134)')
    await expect(page.getByRole('button', { name: /^Buchung: Ines Insta,/ })).toHaveClass(/bg-ds-neutral-800/)
    await expect(page.getByRole('list', { name: 'Legende' }).getByText('booking.com')).toBeVisible()

    // Vollbild, Monatsansicht und Tagesliste
    await page.goto(`/belegung?ansicht=monat&monat=${month(TODAY)}&tag=${TODAY}`)
    await ready(page)
    await expect(page.getByRole('list', { name: 'Legende' }).getByText('booking.com')).toBeVisible()
  })
})

test.describe('Monatsauswahl', () => {
  test('AC: „Springen zu“ vorbelegt mit dem 1., springt in den Monat, Filter bleiben; leer deaktiviert; Escape schließt', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const apt = await addApartment(tenantId)
    await addBooking(tenantId, apt, { guestId: await addGuest(tenantId, 'Huber', 'Anna'), arrival: FUTURE, departure: day(2, FUTURE) })
    await openList(page, `?monat=${month(FUTURE)}&wohnung=${apt}&quelle=keine`)

    const trigger = page.getByRole('button', { name: /\. Monat wählen$/ })
    await trigger.click()
    const field = page.getByLabel('Springen zu')
    await expect(field).toHaveValue(`${month(FUTURE)}-01`)
    await field.fill('')
    await expect(page.getByRole('button', { name: 'Anzeigen', exact: true })).toBeDisabled()
    await page.keyboard.press('Escape')
    await expect(field).toBeHidden()
    await expect(page).toHaveURL(new RegExp(`monat=${month(FUTURE)}`))

    await trigger.click()
    await field.fill('2027-03-14')
    await page.getByRole('button', { name: 'Anzeigen', exact: true }).click()
    await expect(page).toHaveURL(/monat=2027-03/)
    await expect(page).toHaveURL(new RegExp(`wohnung=${apt}`))
    await expect(page).toHaveURL(/quelle=keine/)
    await expect(field).toBeHidden()
    await expect(page.getByRole('button', { name: /^März 2027\. Monat wählen$/ })).toBeVisible()

    // Tastatur: Enter öffnet, Datum eingeben, Enter springt
    await page.getByRole('button', { name: /^März 2027\./ }).focus()
    await page.keyboard.press('Enter')
    await expect(field).toBeFocused()
    await field.fill('2027-05-02')
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/monat=2027-05/)

    // Suche aktiv: keine Monatsleiste
    await page.getByLabel('Buchungen durchsuchen').fill('Huber')
    await expect(page).toHaveURL(/q=Huber/)
    await expect(page.getByRole('button', { name: /Monat wählen$/ })).toHaveCount(0)
  })
})

test.describe('Mitreisende', () => {
  test('AC: Nachname links von Vorname, Fokus im Vornamen; weiter höchstens Personen minus 1', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const apt = await addApartment(tenantId, 'Top 1', { max_guests: 6 })
    const booking = await addBooking(tenantId, apt, { guestId: await addGuest(tenantId, 'Huber', 'Anna'), arrival: FUTURE, departure: day(2, FUTURE), adults: 5 })
    await openBooking(page, booking.id)
    await page.getByRole('button', { name: 'Mitreisende bearbeiten' }).click()
    await expect(panel(page).getByText('Höchstens 4 Personen neben dem Hauptgast.')).toBeVisible()
    for (let i = 0; i < 4; i++) await panel(page).getByRole('button', { name: 'Person hinzufügen' }).click()
    await expect(panel(page).getByRole('button', { name: 'Person hinzufügen' })).toHaveCount(0)
    const last = panel(page).getByLabel('Nachname').first()
    const first = panel(page).getByLabel('Vorname').first()
    expect((await last.boundingBox())!.x).toBeLessThan((await first.boundingBox())!.x)
    await expect(last).toHaveValue('Huber')
    await expect(panel(page).getByLabel('Vorname').last()).toBeFocused()
  })
})

test.describe('Layout und Barrierefreiheit', () => {
  test('Formular, Detail und Sprungauswahl: keine WCAG-2.1-AA-Verstöße, kein seitliches Scrollen (auch 375 px)', async ({ page, users }) => {
    test.skip(test.info().project.name === 'tablet', 'Desktop und Handy genügen')
    const { tenantId } = await setup(page, users)
    const apt = await addApartment(tenantId)
    const booking = await addBooking(tenantId, apt, {
      guestId: await addGuest(tenantId, 'Huber-Oberleitner', 'Anna-Katharina'),
      arrival: FUTURE,
      plannedDeparture: day(3, FUTURE),
      departure: day(4, FUTURE),
      sheet: 'GB-2026-000123',
      source: 'booking_com',
      residence: true,
      nightsCents: 30000,
    })
    const scan = async (label: string) => {
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      expect(results.violations, label).toEqual([])
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, label).toBeLessThanOrEqual(0)
    }
    await openBooking(page, booking.id)
    await scan('Detail')
    await edit(page)
    await page.waitForTimeout(800)
    await scan('Formular')
    await page.keyboard.press('Escape')

    await openList(page, `?monat=${month(FUTURE)}`)
    await page.getByRole('button', { name: /\. Monat wählen$/ }).click()
    await page.waitForTimeout(400) // Einblend-Animation des Popovers
    const box = (await page.getByLabel('Springen zu').locator('xpath=ancestor::form').boundingBox())!
    const width = page.viewportSize()!.width
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(width)
    await scan('Sprungauswahl')
  })
})
