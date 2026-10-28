import { expect, type Page, test as base } from '@playwright/test'

import { deDate, dePlain, re, viennaDay, viennaTime } from './support/format'
import { createTenant, createUser, deleteUser, type E2EUser, hasSupabaseEnv, service, signInAs, signInAsAdmin } from './support/supabase'

// PROJ-31: Einheitliche Datums- und Betragsformate. Abläufe im Projekt „desktop“ (auf Wunsch auch „safari“),
// Layout auf Tablet und Handy. Testdaten über die Datenbank; die Kunden verschwinden mit dem Löschen ihrer Inhaber.

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
test.skip(!hasSupabaseEnv, 'Supabase-Umgebung fehlt')

type Users = (opts?: Parameters<typeof createUser>[0]) => Promise<E2EUser>
const desktopOnly = () => test.skip(!['desktop', 'safari'].includes(test.info().project.name), 'Abläufe nur im Desktop-Projekt')
const only = (name: string) => test.skip(test.info().project.name !== name, `nur im Projekt „${name}“`)
const ready = (page: Page) =>
  page.waitForFunction(() => Object.keys(document.querySelector('main') ?? {}).some((k) => k.startsWith('__reactFiber')))
const panel = (page: Page) => page.getByRole('dialog')
// Beträge mit beliebigem Leerzeichen nach „€“ (auch geschütztes)
const money = (value: string) => new RegExp(`€\\s?${re(value)}`)

// Feste Tage laut Spec (Kalendertage, unabhängig von heute)
const ARRIVAL = '2026-10-28' // Mi
const DEPARTURE = '2026-11-03' // Di
const OPTION_UNTIL = '2026-11-05' // Do

async function setup(page: Page, users: Users, role: 'owner' | 'staff' = 'owner') {
  const owner = await users({ displayName: 'Olga Owner' })
  const members: { user: E2EUser; role: 'owner' | 'staff' }[] = [{ user: owner, role: 'owner' }]
  let staff: E2EUser | undefined
  if (role === 'staff') {
    staff = await users({ displayName: 'Sam Staff' })
    members.push({ user: staff, role: 'staff' })
  }
  const tenantId = await createTenant('QA31 Testkunde', members)
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
    .insert({ tenant_id: tenantId, property_id: property!.id, name, max_guests: 4, price_cents: 12000, ...extra } as never)
    .select('id')
    .single()
  if (error) throw error
  return (data as { id: string }).id
}

async function addGuest(tenantId: string, last: string, first: string, extra: Record<string, unknown> = {}) {
  const { data, error } = await service()
    .from('guests')
    .insert({ tenant_id: tenantId, country: 'AT', last_name: last, first_name: first, ...extra } as never)
    .select('id')
    .single()
  if (error) throw error
  return (data as { id: string }).id
}

let seq = 3100
type Entry = { kind?: 'booking' | 'option'; guestId: string; arrival: string; departure: string; optionUntil?: string; nightsCents?: number; charges?: number[] }
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
      option_until: kind === 'option' ? (b.optionUntil ?? OPTION_UNTIL) : null,
    })
    .select('id, number')
    .single()
  if (error) throw error
  const { error: amountError } = await service()
    .from('booking_amounts')
    .insert({ id: data.id, tenant_id: tenantId, nights_cents: b.nightsCents ?? 36000 })
  if (amountError) throw amountError
  for (const [i, cents] of (b.charges ?? []).entries()) {
    const { error: chargeError } = await service()
      .from('booking_charges')
      .insert({ booking_id: data.id, tenant_id: tenantId, label: `Position ${i + 1}`, amount_cents: cents, position: i + 1 })
    if (chargeError) throw chargeError
  }
  return data as { id: string; number: string }
}

async function open(page: Page, path: string) {
  await page.goto(path)
  await ready(page)
}

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
}

test.describe('Datum', () => {
  test('AC: Buchungs-Detail zeigt „Mi, 28.10.2026“ und „Di, 03.11.2026“; Jahreswechsel mit eigenem Jahr', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId, 'Huber', 'Anna')
    const booking = await addBooking(tenantId, apt, { guestId: guest, arrival: ARRIVAL, departure: DEPARTURE })
    const newYear = await addBooking(tenantId, apt, { guestId: guest, arrival: '2026-12-30', departure: '2027-01-02' })

    expect(deDate(ARRIVAL)).toBe('Mi, 28.10.2026')
    expect(deDate(DEPARTURE)).toBe('Di, 03.11.2026')
    await open(page, `/buchungen/${booking.id}`)
    await expect(page.getByText('Mi, 28.10.2026').first()).toBeVisible()
    await expect(page.getByText('Di, 03.11.2026').first()).toBeVisible()

    await open(page, `/buchungen/${newYear.id}`)
    await expect(page.getByText('Mi, 30.12.2026').first()).toBeVisible()
    await expect(page.getByText('Sa, 02.01.2027').first()).toBeVisible()
  })

  test('AC: Option gilt bis „Do, 05.11.2026“ in Detail, Liste und Kalender', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId, 'Huber', 'Anna')
    const option = await addBooking(tenantId, apt, { kind: 'option', guestId: guest, arrival: ARRIVAL, departure: DEPARTURE })

    await open(page, `/buchungen/${option.id}`)
    await expect(page.getByText('Do, 05.11.2026').first()).toBeVisible()

    await open(page, '/buchungen?monat=2026-10')
    await expect(page.getByRole('table').getByText('Option bis Do, 05.11.2026')).toBeVisible()

    // Kalender: Detail des Eintrags zeigt „Option gilt bis“ im Standardformat
    await open(page, `/belegung?ansicht=monat&monat=2026-10&tag=${ARRIVAL}&eintrag=${option.id}`)
    await expect(page.getByRole('dialog').getByText('Do, 05.11.2026').first()).toBeVisible()
  })

  test('AC: Tagesliste der Monatsansicht: Tag und „bis …“ im Standardformat', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const apt = await addApartment(tenantId)
    await addBooking(tenantId, apt, { guestId: await addGuest(tenantId, 'Huber', 'Anna'), arrival: ARRIVAL, departure: DEPARTURE })

    await open(page, '/belegung?ansicht=monat&monat=2026-10&tag=2026-10-30')
    await expect(page.getByRole('heading', { name: 'Fr, 30.10.2026' })).toBeVisible()
    await expect(page.getByText('bis Di, 03.11.2026')).toBeVisible()
  })

  test('AC: Überschneidungs-Warnung im Formular und Hinweis im Detail nennen die andere Buchung im Standardformat', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId, 'Huber', 'Anna')
    const other = await addGuest(tenantId, 'Berger', 'Bernd')
    await addBooking(tenantId, apt, { guestId: guest, arrival: ARRIVAL, departure: DEPARTURE })
    const second = await addBooking(tenantId, apt, { guestId: other, arrival: '2026-11-01', departure: '2026-11-04' })

    // Hinweis im Detail (QA BUG-1) und Warnung im Formular
    await open(page, `/buchungen/${second.id}`)
    await expect(page.getByText(new RegExp(`${re('Mi, 28.10.2026')}.*${re('Di, 03.11.2026')}`)).first()).toBeVisible()
    await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click()
    await expect(panel(page)).toBeVisible()
    await expect(panel(page).getByText(new RegExp(`${re('Mi, 28.10.2026')}.*${re('Di, 03.11.2026')}`)).first()).toBeVisible()
  })

  test('AC: Geburts- und Ausstellungsdatum ohne Wochentag; Aufenthalte im Standardformat', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId, 'Huber', 'Anna', {
      birth_date: '1978-05-15',
      document_type: 'passport',
      document_number: 'P1234567',
      document_issued_on: '2020-03-02',
      document_authority: 'BH Graz-Umgebung',
      document_country: 'AT',
    })
    const booking = await addBooking(tenantId, apt, { guestId: guest, arrival: ARRIVAL, departure: DEPARTURE })
    const { error: companionError } = await service().from('booking_companions').insert({ booking_id: booking.id, tenant_id: tenantId, last_name: 'Huber', first_name: 'Ben', birth_date: '2015-09-07', position: 1 })
    if (companionError) throw companionError

    await open(page, `/gaeste/${guest}`)
    await expect(page.getByText('15.05.1978', { exact: true })).toBeVisible()
    await expect(page.getByText('02.03.2020', { exact: true })).toBeVisible()
    await expect(page.getByText(/(Mo|Di|Mi|Do|Fr|Sa|So), 15\.05\.1978/)).toHaveCount(0)
    // Aufenthalte: An- und Abreise im Standardformat
    await expect(page.getByText('Mi, 28.10.2026').first()).toBeVisible()
    await expect(page.getByText('Di, 03.11.2026').first()).toBeVisible()

    // Mitreisende im Buchungs-Detail: Geburtsdatum ohne Wochentag
    await open(page, `/buchungen/${booking.id}`)
    await expect(page.getByText('07.09.2015', { exact: true })).toBeVisible()
  })

  test('AC: Betreiber-Protokoll mit Wochentag, Datum und Uhrzeit in Wiener Zeit; Kunden-Detail im Standardformat', async ({ page, users }) => {
    desktopOnly()
    const owner = await users({ displayName: 'Olga Owner' })
    const tenantId = await createTenant('QA31 Protokoll', [{ user: owner, role: 'owner' }])
    const admin = await users({ displayName: 'Ada Admin', admin: true })
    await signInAsAdmin(page, admin)

    await open(page, `/betreiber/kunden/${tenantId}`)
    // Kopf „angelegt am …“ im Standardformat
    await expect(page.getByText(new RegExp(re(deDate(viennaDay(new Date()))))).first()).toBeVisible()

    // Protokolleintrag erzeugen und mit dem gespeicherten Zeitpunkt vergleichen
    await page.getByRole('button', { name: 'Kunde deaktivieren' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Kunde deaktivieren' }).click()
    await expect(page.getByText('Kunde deaktiviert.')).toBeVisible()
    const { data } = await service().from('operator_log').select('created_at').eq('tenant_id', tenantId).order('created_at', { ascending: false }).limit(1).single()
    const at = new Date(data!.created_at)
    await expect(page.getByText(`${deDate(viennaDay(at))}, ${viennaTime(at)}`).first()).toBeVisible()
  })

  test('AC: Monatsüberschrift bleibt „Oktober 2026“ in Buchungsliste und Kalender', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const apt = await addApartment(tenantId)
    await addBooking(tenantId, apt, { guestId: await addGuest(tenantId, 'Huber', 'Anna'), arrival: ARRIVAL, departure: DEPARTURE })
    await open(page, '/buchungen?monat=2026-10')
    await expect(page.getByRole('button', { name: /^Oktober 2026\./ })).toBeVisible()
    await open(page, '/belegung?ansicht=monat&monat=2026-10')
    await expect(page.getByText('Oktober 2026').first()).toBeVisible()
  })
})

test.describe('Buchungsliste', () => {
  test('AC: Ab Tablet steht in „Zeitraum“ oben die Anreise, darunter die Abreise', async ({ page, users }) => {
    test.skip(test.info().project.name === 'mobile', 'Tabelle erst ab Tablet')
    const { tenantId } = await setup(page, users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId, 'Huber', 'Anna-Maria-Theresia-Josefine Von Hohenberg-Schwarzenau')
    await addBooking(tenantId, apt, { guestId: guest, arrival: ARRIVAL, departure: DEPARTURE })

    await open(page, '/buchungen?monat=2026-10')
    const cell = page.getByRole('table').getByRole('row').nth(1).getByRole('cell').first()
    const lines = cell.locator('span.block')
    await expect(lines).toHaveText(['Mi, 28.10.2026', 'Di, 03.11.2026'])
    const [top, bottom] = await Promise.all([lines.nth(0).boundingBox(), lines.nth(1).boundingBox()])
    expect(bottom!.y).toBeGreaterThan(top!.y)
    // je Datum eine Zeile (kein Umbruch innerhalb eines Datums)
    expect(top!.height).toBeLessThan(30)
    expect(bottom!.height).toBeLessThan(30)
    // Screenreader liest „Mi, 28.10.2026 – Di, 03.11.2026“
    await expect(cell).toHaveText('Mi, 28.10.2026 – Di, 03.11.2026')
    await noHorizontalScroll(page)
  })

  test('AC: Auf dem Handy steht der Zeitraum „Mi, 28.10.2026 – Di, 03.11.2026“ mit Nächten, ohne seitliches Scrollen', async ({ page, users }) => {
    only('mobile')
    const { tenantId } = await setup(page, users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId, 'Huber', 'Anna')
    await addBooking(tenantId, apt, { guestId: guest, arrival: ARRIVAL, departure: DEPARTURE })

    await open(page, '/buchungen?monat=2026-10')
    await expect(page.getByText(/^Mi, 28\.10\.2026 – Di, 03\.11\.2026 · 6 Nächte/)).toBeVisible()
    // „2 Personen“ bleibt zusammen (QA BUG-5)
    const persons = page.getByText('2 Personen', { exact: true })
    expect((await persons.boundingBox())!.height).toBeLessThan(30)
    await noHorizontalScroll(page)
  })

  test('AC: Suche über alle Monate zeigt das Jahr bei jedem Datum', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId, 'Huber', 'Anna')
    await addBooking(tenantId, apt, { guestId: guest, arrival: ARRIVAL, departure: DEPARTURE })
    await addBooking(tenantId, apt, { guestId: guest, arrival: '2027-02-10', departure: '2027-02-12' })

    await open(page, '/buchungen?q=Huber')
    const table = page.getByRole('table')
    await expect(table.getByText('Mi, 28.10.2026')).toBeVisible()
    await expect(table.getByText('Mi, 10.02.2027')).toBeVisible()
    await expect(table.getByText('Fr, 12.02.2027')).toBeVisible()
  })
})

test.describe('Belegungskalender', () => {
  test('AC: Zeitraum oben „So, 25.10.2026 – Sa, 07.11.2026“; Balken-Beschriftung mit beiden Daten; Tageskopf kurz', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId, 'Huber', 'Anna')
    await addBooking(tenantId, apt, { guestId: guest, arrival: ARRIVAL, departure: DEPARTURE })

    await open(page, '/belegung?ansicht=zeitleiste&ab=2026-10-25')
    // Desktop zeigt vier Wochen ab dem gewählten Tag
    await expect(page.getByRole('button', { name: /^So, 25\.10\.2026 – Sa, 21\.11\.2026\. Datum wählen/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Buchung: Anna Huber,/ })).toHaveAccessibleName(
      /Mi, 28\.10\.2026 bis Di, 03\.11\.2026$/
    )
    // Tageskopf bleibt kurz: Wochentag und Tageszahl, ohne Überlauf
    const grid = page.getByRole('region', { name: 'Belegung je Wohnung, seitlich scrollbar' })
    await expect(grid.getByText('25.10.2026')).toHaveCount(0)
    const overflowing = await grid.evaluate((el) =>
      [...el.querySelectorAll('span')]
        .filter((s) => s.children.length === 0 && !s.classList.contains('sr-only') && s.scrollWidth > s.clientWidth + 1)
        .map((s) => `${s.textContent} (${s.className})`)
    )
    expect(overflowing).toEqual([])
  })

  test('AC: Monatskästchen ohne Überlauf, Beschriftung für Screenreader im Standardformat', async ({ page, users }) => {
    test.skip(test.info().project.name === 'tablet', 'Desktop und Handy genügen')
    const { tenantId } = await setup(page, users)
    await addApartment(tenantId)
    await open(page, '/belegung?ansicht=monat&monat=2026-10')
    await expect(page.getByRole('button', { name: /^Mi, 28\.10\.2026: / })).toBeVisible()
    await noHorizontalScroll(page)
  })

  test('AC: Zeitleiste auf dem Handy ohne seitliches Scrollen der Seite', async ({ page, users }) => {
    only('mobile')
    const { tenantId } = await setup(page, users)
    const apt = await addApartment(tenantId)
    await addBooking(tenantId, apt, { guestId: await addGuest(tenantId, 'Huber', 'Anna'), arrival: ARRIVAL, departure: DEPARTURE })
    await open(page, '/belegung?ansicht=zeitleiste&ab=2026-10-25')
    const period = page.getByRole('button', { name: /^So, 25\.10\.2026 – .*Datum wählen/ })
    // Umbruch nur am „–“, nie innerhalb eines Datums (QA BUG-2)
    await expect(period).toHaveText(/^So,\u00a025\.10\.2026 – Sa,\u00a021\.11\.2026$/)
    // „Heute“ hält den Seitenabstand von 16 px ein (QA BUG-3)
    const today = (await page.getByRole('button', { name: 'Heute', exact: true }).boundingBox())!
    expect(today.x + today.width).toBeLessThanOrEqual(375 - 16 + 0.5)
    await noHorizontalScroll(page)
  })
})

test.describe('Beträge', () => {
  test('AC: Endbetrag „€ 360,00“ und „€ 1.250,00“ in Liste und Detail; „€ 1.000.000,00“ passt', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId, 'Huber', 'Anna')
    const small = await addBooking(tenantId, apt, { guestId: guest, arrival: ARRIVAL, departure: DEPARTURE, nightsCents: 36000 })
    await addBooking(tenantId, apt, { guestId: guest, arrival: '2026-10-10', departure: '2026-10-12', nightsCents: 100000, charges: [25000] })
    const big = await addBooking(tenantId, apt, { guestId: guest, arrival: '2026-10-01', departure: '2026-10-03', nightsCents: 100_000_000 })

    await open(page, '/buchungen?monat=2026-10')
    const table = page.getByRole('table')
    await expect(table.getByText(money('360,00'))).toBeVisible()
    await expect(table.getByText(money('1.250,00'))).toBeVisible()
    await expect(table.getByText(money('1.000.000,00'))).toBeVisible()
    await noHorizontalScroll(page)

    await open(page, `/buchungen/${small.id}`)
    await expect(page.getByText(money('360,00')).first()).toBeVisible()
    await open(page, `/buchungen/${big.id}`)
    await expect(page.getByText(money('1.000.000,00')).first()).toBeVisible()
    await noHorizontalScroll(page)
  })

  test('AC: Formular „Buchung bearbeiten“ zeigt „360,00“; Preisvorschlag mit zwei Nachkommastellen', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId, 'Huber', 'Anna')
    const booking = await addBooking(tenantId, apt, { guestId: guest, arrival: ARRIVAL, departure: DEPARTURE, nightsCents: 36000 })

    await open(page, `/buchungen/${booking.id}`)
    await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click()
    await expect(panel(page).getByLabel('Übernachtungspreis (€)')).toHaveValue('360,00')
    // Vorschlag 6 × € 120,00 = € 720,00 weicht ab und wird angeboten
    await expect(panel(page).getByRole('button', { name: /Neuen Vorschlag €\s?720,00 übernehmen/ })).toBeVisible()
  })

  test('AC: Betragsfeld formatiert beim Verlassen („1250“ → „1.250,00“, „45,5“ → „45,50“), nicht beim Tippen; ungültig und leer bleiben', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId, 'Huber', 'Anna')
    const booking = await addBooking(tenantId, apt, { guestId: guest, arrival: ARRIVAL, departure: DEPARTURE, nightsCents: 36000 })

    await open(page, `/buchungen/${booking.id}`)
    await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click()
    const price = panel(page).getByLabel('Übernachtungspreis (€)')

    // Während des Tippens bleibt „12“ stehen
    await price.fill('')
    await price.pressSequentially('12')
    await expect(price).toHaveValue('12')
    await expect(price).toBeFocused()

    for (const [input, expected] of [
      ['1250', '1.250,00'],
      ['45,5', '45,50'],
      ['1.250,5', '1.250,50'],
      ['125.5', '125,50'],
      ['0', '0,00'],
    ]) {
      await price.fill(input)
      await price.press('Tab')
      await expect(price).toHaveValue(expected)
    }

    // ungültig bleibt stehen, Speichern meldet den bisherigen Fehler
    await price.fill('abc')
    await price.press('Tab')
    await expect(price).toHaveValue('abc')
    await panel(page).getByRole('button', { name: 'Änderungen speichern', exact: true }).click()
    await expect(panel(page).getByText('Bitte einen Betrag wie 125 oder 125,50 eingeben.')).toBeVisible()

    // „1.250,00“ wird genau als 1.250,00 € gespeichert
    await price.fill('1250')
    await price.press('Tab')
    await expect(price).toHaveValue('1.250,00')
    await panel(page).getByRole('button', { name: 'Änderungen speichern', exact: true }).click()
    await expect(panel(page)).toBeHidden()
    await expect
      .poll(async () => (await service().from('booking_amounts').select('nights_cents').eq('id', booking.id).single()).data?.nights_cents)
      .toBe(125000)
    await expect(page.getByText(money('1.250,00')).first()).toBeVisible()
  })

  test('AC: Leere optionale Stornogebühr bleibt leer; „90“ wird zu „90,00“', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId, 'Huber', 'Anna')
    const booking = await addBooking(tenantId, apt, { guestId: guest, arrival: '2027-03-01', departure: '2027-03-04' })

    await open(page, `/buchungen/${booking.id}`)
    await page.getByRole('button', { name: 'Stornieren' }).click()
    const dialog = page.getByRole('dialog', { name: `Buchung ${booking.number} stornieren?` })
    const fee = dialog.getByLabel('Stornogebühr in € (optional)')
    await fee.focus()
    await fee.press('Tab')
    await expect(fee).toHaveValue('')
    await fee.fill('90')
    await fee.press('Tab')
    await expect(fee).toHaveValue('90,00')
  })

  test('AC: Wohnungsübersicht und -formular zeigen Preise mit zwei Nachkommastellen; „1.250,00“ wird als Wohnungspreis angenommen', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    await addApartment(tenantId, 'Top 1', { price_cents: 12000, cleaning_fee_cents: 6000 })

    await open(page, '/einstellungen/wohnungen')
    await expect(page.getByRole('row', { name: /Top 1.*€\s?120,00/ })).toBeVisible()
    await page.getByRole('button', { name: 'Top 1 bearbeiten' }).click()
    await expect(panel(page)).toBeVisible()
    const price = panel(page).getByLabel('Wohnungspreis pro Nacht (€)')
    await expect(price).toHaveValue('120,00')
    await expect(panel(page).getByLabel('Reinigungsgebühr (€)')).toHaveValue('60,00')
    await price.fill('1250')
    await price.press('Tab')
    await expect(price).toHaveValue('1.250,00')
    await panel(page).getByRole('button', { name: 'Speichern', exact: true }).click()
    await expect(page.getByText('Änderungen gespeichert.')).toBeVisible()
    await expect(page.getByRole('row', { name: /Top 1.*€\s?1\.250,00/ })).toBeVisible()
  })

  test('Edge: Mitarbeiter sehen keine Beträge, aber die neuen Datumsformate', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users, 'staff')
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId, 'Huber', 'Anna')
    const booking = await addBooking(tenantId, apt, { guestId: guest, arrival: ARRIVAL, departure: DEPARTURE })
    await open(page, '/buchungen?monat=2026-10')
    await expect(page.getByRole('table').getByText('Mi, 28.10.2026')).toBeVisible()
    await expect(page.getByRole('table').getByText('€')).toHaveCount(0)
    await open(page, `/buchungen/${booking.id}`)
    await expect(page.getByText('Mi, 28.10.2026').first()).toBeVisible()
    await expect(page.getByText(/€/)).toHaveCount(0)
  })
})

test.describe('Safari', () => {
  test('Safari: Betragsfeld formatiert nach Tab, Zeilenklick öffnet die richtige Buchung', async ({ page, users }) => {
    only('safari')
    const { tenantId } = await setup(page, users)
    const apt = await addApartment(tenantId)
    const anna = await addGuest(tenantId, 'Huber', 'Anna')
    const bernd = await addGuest(tenantId, 'Berger', 'Bernd')
    const first = await addBooking(tenantId, apt, { guestId: anna, arrival: '2026-10-05', departure: '2026-10-07' })
    await addBooking(tenantId, apt, { guestId: bernd, arrival: ARRIVAL, departure: DEPARTURE })

    await open(page, '/buchungen?monat=2026-10')
    await page.getByRole('link', { name: 'Huber, Anna' }).click()
    await expect(page).toHaveURL(new RegExp(`/buchungen/${first.id}$`))
    await ready(page)
    await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click()
    const price = panel(page).getByLabel('Übernachtungspreis (€)')
    await expect(price).toHaveValue('360,00')
    await price.fill('1250')
    await price.press('Tab')
    await expect(price).toHaveValue('1.250,00')
  })
})

// Unabhängige Kontrolle des Test-Helfers
test('Helfer: dePlain', () => {
  only('desktop')
  expect(dePlain('1978-05-15')).toBe('15.05.1978')
})
