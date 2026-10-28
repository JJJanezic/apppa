import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test as base } from '@playwright/test'

import { createTenant, createUser, deleteUser, type E2EUser, hasSupabaseEnv, service, signInAs } from './support/supabase'

// PROJ-27: Personenpreise und Kapazität nach Erwachsenen. Abläufe im Projekt „desktop“, Layout in allen Breiten.
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
const money = (value: string) => new RegExp(`€\\s?${value.replace('.', '\\.')}`)

// Erster Tag des übernächsten Monats (sicher in der Zukunft)
const FUTURE = (() => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Vienna' }).format(new Date())
  const d = new Date(`${today.slice(0, 7)}-01T12:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + 2)
  return d.toISOString().slice(0, 10)
})()
function day(offset: number, from = FUTURE) {
  const d = new Date(`${from}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

// Beispiel der Spec: Erwachsene € 50, bis 2 Jahre € 0, bis 11 Jahre € 20; Reinigung € 60; 6 Personen, davon max. 2 Erwachsene
const PER_PERSON = {
  max_guests: 6,
  max_adults: 2,
  price_mode: 'person',
  adult_price_cents: 5000,
  child_prices: [
    { to_age: 2, price_cents: 0 },
    { to_age: 11, price_cents: 2000 },
  ],
  cleaning_fee_cents: 6000,
}

async function setup(page: Page, users: Users) {
  const owner = await users({ displayName: 'Olga Owner' })
  const tenantId = await createTenant('QA27 Testkunde', [{ user: owner, role: 'owner' }])
  await signInAs(page, owner)
  const { data: property, error } = await service()
    .from('properties')
    .insert({ tenant_id: tenantId, name: 'Haus See', street: 'Seeweg 12', postal_code: '5340', city: 'St. Gilgen', municipality_code: '50330' })
    .select('id')
    .single()
  if (error) throw error
  return { tenantId, propertyId: property.id }
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

async function openApartments(page: Page) {
  await page.goto('/einstellungen/wohnungen')
  await ready(page)
}

async function newBooking(page: Page, apartmentLabel: string) {
  await page.goto('/buchungen')
  await ready(page)
  await page.getByRole('button', { name: 'Neue Buchung' }).first().click()
  await panel(page).getByRole('combobox', { name: 'Wohnung' }).click()
  await page.getByRole('option', { name: apartmentLabel, exact: true }).click()
  await panel(page).getByLabel('Anreise', { exact: true }).fill(FUTURE)
  await panel(page).getByLabel('Abreise geplant').fill(day(3))
}

async function addChildren(page: Page, ages: number[]) {
  for (const [i, age] of ages.entries()) {
    await panel(page).getByRole('button', { name: 'Kind hinzufügen' }).click()
    await panel(page).getByLabel(`Alter von Kind ${i + 1} bei Anreise`).fill(String(age))
  }
}

test.beforeEach(() => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')
})

test.describe('Wohnung konfigurieren', () => {
  test('AC: Erwachsenen-Grenze und Personenpreise mit Kinderstufen speichern; Übersicht zeigt sie; bestehende Wohnung hat Wohnungspreis', async ({
    page,
    users,
  }) => {
    desktopOnly()
    const { tenantId, propertyId } = await setup(page, users)
    await addApartment(tenantId, propertyId, 'Top 1')
    await openApartments(page)
    await page.getByRole('button', { name: /Top 1/ }).first().click()
    await expect(panel(page).getByRole('radio', { name: 'Wohnungspreis' })).toBeChecked()
    await expect(panel(page).getByLabel('Wohnungspreis pro Nacht (€)')).toHaveValue('120,00')
    await expect(panel(page).getByLabel('davon höchstens Erwachsene')).toHaveValue('')

    await panel(page).getByLabel('davon höchstens Erwachsene').fill('2')
    await panel(page).getByRole('radio', { name: 'Personenpreise' }).click()
    await panel(page).getByLabel('Erwachsener pro Nacht (€)').fill('50')
    await panel(page).getByRole('button', { name: 'Stufe hinzufügen' }).click()
    await panel(page).getByLabel('Stufe 1: Kinder bis einschließlich Alter').fill('2')
    await panel(page).getByLabel('Stufe 1: Preis pro Nacht (€)').fill('0')
    await panel(page).getByRole('button', { name: 'Stufe hinzufügen' }).click()
    await panel(page).getByLabel('Stufe 2: Kinder bis einschließlich Alter').fill('11')
    await panel(page).getByLabel('Stufe 2: Preis pro Nacht (€)').fill('20')
    await panel(page).getByRole('button', { name: 'Speichern', exact: true }).click()
    await expect(panel(page)).toHaveCount(0)

    const row = page.getByRole('table').getByRole('row', { name: /Top 1/ })
    await expect(row).toContainText('max. 2 Erw.')
    await expect(row).toContainText(/€\s50,00 \/ Erw\./)

    await page.getByRole('button', { name: /Top 1/ }).first().click()
    await expect(panel(page).getByRole('radio', { name: 'Personenpreise' })).toBeChecked()
    await expect(panel(page).getByLabel('Erwachsener pro Nacht (€)')).toHaveValue('50,00')
    await expect(panel(page).getByLabel('Stufe 2: Kinder bis einschließlich Alter')).toHaveValue('11')
    await expect(panel(page).getByLabel('Stufe 2: Preis pro Nacht (€)')).toHaveValue('20,00')
    const { data } = await service().from('apartments').select('price_mode, max_adults, adult_price_cents, child_prices, price_cents').eq('tenant_id', tenantId).single()
    expect(data).toEqual({
      price_mode: 'person',
      max_adults: 2,
      adult_price_cents: 5000,
      child_prices: [
        { to_age: 2, price_cents: 0 },
        { to_age: 11, price_cents: 2000 },
      ],
      price_cents: 12000,
    })
  })

  test('AC: Prüfregeln für Erwachsenen-Grenze, Erwachsenenpreis und Kinderstufen; Hinweis auf künftige Buchungen', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, propertyId } = await setup(page, users)
    const apt = await addApartment(tenantId, propertyId, 'Top 1')
    const guest = await addGuest(tenantId, 'Huber', 'Anna')
    const { error } = await service()
      .from('bookings')
      .insert({ tenant_id: tenantId, apartment_id: apt, kind: 'booking', arrival: FUTURE, departure: day(3), guest_id: guest, adults: 3, number_year: 2030, number_seq: 1 } as never)
    expect(error).toBeNull()
    await openApartments(page)
    await page.getByRole('button', { name: /Top 1/ }).first().click()

    await panel(page).getByLabel('davon höchstens Erwachsene').fill('2')
    await expect(panel(page).getByText('1 künftige Buchung hat mehr Erwachsene. Sie bleiben bestehen.')).toBeVisible()
    await panel(page).getByLabel('davon höchstens Erwachsene').fill('5')
    await panel(page).getByRole('radio', { name: 'Personenpreise' }).click()
    await panel(page).getByRole('button', { name: 'Stufe hinzufügen' }).click()
    await panel(page).getByLabel('Stufe 1: Kinder bis einschließlich Alter').fill('11')
    await panel(page).getByLabel('Stufe 1: Preis pro Nacht (€)').fill('20')
    await panel(page).getByRole('button', { name: 'Stufe hinzufügen' }).click()
    await panel(page).getByLabel('Stufe 2: Kinder bis einschließlich Alter').fill('2')
    await panel(page).getByRole('button', { name: 'Stufe hinzufügen' }).click()
    await expect(panel(page).getByRole('button', { name: 'Stufe hinzufügen' })).toHaveCount(0)
    await panel(page).getByRole('button', { name: 'Speichern', exact: true }).click()

    for (const message of [
      'Höchstens so viele Erwachsene wie Personen insgesamt.',
      'Bitte den Erwachsenenpreis eingeben.',
      'Die Altersgrenzen müssen aufsteigen (z. B. 2, dann 11).',
      'Bitte einen Preis eingeben (0 für gratis).',
      'Bitte ein Alter von 0 bis 17 eingeben.',
    ]) {
      await expect(panel(page).getByText(message).first()).toBeVisible()
    }
    const { data } = await service().from('apartments').select('price_mode').eq('id', apt).single()
    expect(data?.price_mode).toBe('apartment')
  })
})

test.describe('Buchung mit Personenpreisen', () => {
  test('AC: Vorschlag € 510 mit Rechnung; folgt Personen; vereinbarter Preis mit eigenen Gebühren weicht ab', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, propertyId } = await setup(page, users)
    await addApartment(tenantId, propertyId, 'Top 1', PER_PERSON)
    await addGuest(tenantId, 'Huber', 'Anna')
    await newBooking(page, 'Haus See · Top 1')
    await expect(panel(page).getByPlaceholder('Betrag (€)')).toHaveValue('60,00')

    await panel(page).getByLabel('Erwachsene').fill('2')
    await addChildren(page, [1, 8, 14])
    await expect(panel(page).getByLabel('Übernachtungspreis (€)')).toHaveValue('510,00')
    await expect(panel(page).getByText(/Vorschlag: €\s510,00 \(3 Nächte × \(3 × €\s50,00 \+ 1 × €\s0,00 \+ 1 × €\s20,00\)\)/)).toBeVisible()
    // Vorschlag folgt den Personen, solange der Preis nicht von Hand geändert ist
    await panel(page).getByRole('button', { name: 'Kind 3 entfernen' }).click()
    await expect(panel(page).getByLabel('Übernachtungspreis (€)')).toHaveValue('360,00')
    await panel(page).getByRole('button', { name: 'Kind hinzufügen' }).click()
    await panel(page).getByLabel('Alter von Kind 3 bei Anreise').fill('14')
    await expect(panel(page).getByLabel('Übernachtungspreis (€)')).toHaveValue('510,00')

    // vereinbarter Preis: € 450, Reinigung € 70, Haustier € 15 → € 535
    await panel(page).getByLabel('Übernachtungspreis (€)').fill('450')
    await panel(page).getByPlaceholder('Betrag (€)').first().fill('70')
    await panel(page).getByRole('button', { name: 'Position hinzufügen' }).click()
    await panel(page).getByPlaceholder('Bezeichnung').nth(1).fill('Haustier')
    await panel(page).getByPlaceholder('Betrag (€)').nth(1).fill('15')
    await expect(panel(page).getByRole('button', { name: /Neuen Vorschlag .*510.* übernehmen/ })).toBeVisible()
    await panel(page).getByLabel('Gast suchen').fill('Huber')
    await page.getByRole('option', { name: /Huber, Anna/ }).click()
    // Kapazität: 2 Erwachsene + 3 Kinder = 5 ≤ 6, Erwachsene 2 ≤ 2 → keine Warnung
    await page.waitForTimeout(800)
    await expect(panel(page).getByRole('alert')).toHaveCount(0)
    await panel(page).getByRole('button', { name: 'Buchung speichern' }).click()

    await expect(page).toHaveURL(/\/buchungen\/[0-9a-f-]{36}$/)
    await expect(page.getByText(money('535,00'))).toBeVisible()
    await expect(page.getByText(money('450,00'))).toBeVisible()
  })

  test('AC: Erwachsenen-Grenze warnt bei 3 Erwachsenen, nicht bei 1 Erwachsenem + 3 Kindern; Wohnungspreis rechnet wie bisher', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, propertyId } = await setup(page, users)
    await addApartment(tenantId, propertyId, 'Top 1', { ...PER_PERSON, max_guests: 4 })
    await addApartment(tenantId, propertyId, 'Top 2', { max_guests: 4, price_cents: 12000 })
    await newBooking(page, 'Haus See · Top 1')
    await panel(page).getByLabel('Erwachsene').fill('3')
    await expect(panel(page).getByRole('alert').getByText('3 Erwachsene, die Wohnung ist für höchstens 2 Erwachsene ausgelegt.')).toBeVisible()
    await expect(panel(page).getByRole('button', { name: 'Buchung speichern' })).toBeDisabled()

    await panel(page).getByLabel('Erwachsene').fill('1')
    await addChildren(page, [3, 5, 8])
    await page.waitForTimeout(800)
    await expect(panel(page).getByRole('alert')).toHaveCount(0)

    // Wohnungspreis: 3 × € 120, unabhängig von den Personen
    await panel(page).getByRole('combobox', { name: 'Wohnung' }).click()
    await page.getByRole('option', { name: 'Haus See · Top 2', exact: true }).click()
    await expect(panel(page).getByLabel('Übernachtungspreis (€)')).toHaveValue('360,00')
    await expect(panel(page).getByText(/Vorschlag: €\s360,00 \(3 × €\s120,00\)/)).toBeVisible()
  })

  test('QA BUG-2: Rechnung über dem Höchstbetrag ergibt keinen Vorschlag, sondern einen Hinweis', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, propertyId } = await setup(page, users)
    await addApartment(tenantId, propertyId, 'Top 1', { ...PER_PERSON, max_guests: 50, max_adults: null, adult_price_cents: 1_000_000 })
    await newBooking(page, 'Haus See · Top 1')
    await expect(panel(page).getByLabel('Übernachtungspreis (€)')).not.toHaveValue('')
    await panel(page).getByLabel('Erwachsene').fill('50')
    await expect(panel(page).getByText('Der rechnerische Preis übersteigt den Höchstbetrag von € 1.000.000,00. Bitte den Preis eingeben.')).toBeVisible()
    await expect(panel(page).getByLabel('Übernachtungspreis (€)')).toHaveValue('')
    await expect(panel(page).getByText(/Vorschlag:/)).toHaveCount(0)
  })
})

async function addBooking(tenantId: string, apartmentId: string, guestId: string, seq: number, nightsCents: number) {
  const { data, error } = await service()
    .from('bookings')
    .insert({
      tenant_id: tenantId, apartment_id: apartmentId, kind: 'booking', arrival: FUTURE, departure: day(3), guest_id: guestId,
      adults: 2, child_ages: [8], number_year: 2030, number_seq: seq,
    } as never)
    .select('id')
    .single()
  if (error) throw error
  const id = (data as { id: string }).id
  const { error: amountError } = await service().from('booking_amounts').insert({ id, tenant_id: tenantId, nights_cents: nightsCents } as never)
  if (amountError) throw amountError
  return id
}

test.describe('Mitarbeiter und bestehende Buchungen', () => {
  test('AC: Mitarbeiter sieht keine Preise, ist bei 3 Erwachsenen blockiert; seine Buchung erhält € 510 + Reinigung einmal', async ({ page, users }) => {
    desktopOnly()
    const owner = await users({ displayName: 'Olga Owner' })
    const staff = await users({ displayName: 'Sam Staff' })
    const tenantId = await createTenant('QA27 Testkunde', [
      { user: owner, role: 'owner' },
      { user: staff, role: 'staff' },
    ])
    const { data: property } = await service()
      .from('properties')
      .insert({ tenant_id: tenantId, name: 'Haus See', street: 'Seeweg 12', postal_code: '5340', city: 'St. Gilgen', municipality_code: '50330' })
      .select('id')
      .single()
    await addApartment(tenantId, property!.id, 'Top 1', PER_PERSON)
    await addGuest(tenantId, 'Huber', 'Anna')
    await signInAs(page, staff)

    await newBooking(page, 'Haus See · Top 1')
    await expect(panel(page).getByLabel('Übernachtungspreis (€)')).toHaveCount(0)
    await expect(panel(page).getByText(/Vorschlag/)).toHaveCount(0)
    await expect(panel(page).getByText('€')).toHaveCount(0)
    await panel(page).getByLabel('Erwachsene').fill('3')
    const alert = panel(page).getByRole('alert')
    await expect(alert.getByText('3 Erwachsene, die Wohnung ist für höchstens 2 Erwachsene ausgelegt.')).toBeVisible()
    await expect(panel(page).getByLabel(/Trotzdem speichern/)).toHaveCount(0)
    await expect(panel(page).getByRole('button', { name: 'Buchung speichern' })).toBeDisabled()

    await panel(page).getByLabel('Erwachsene').fill('2')
    await addChildren(page, [1, 8, 14])
    await panel(page).getByLabel('Gast suchen').fill('Huber')
    await page.getByRole('option', { name: /Huber, Anna/ }).click()
    await page.waitForTimeout(800)
    await expect(panel(page).getByRole('alert')).toHaveCount(0)
    await panel(page).getByRole('button', { name: 'Buchung speichern' }).click()
    await expect(page).toHaveURL(/\/buchungen\/[0-9a-f-]{36}$/)
    const id = page.url().split('/').pop()!
    const { data: amounts } = await service().from('booking_amounts').select('nights_cents').eq('id', id).single()
    expect(amounts?.nights_cents).toBe(51000)
    const { data: charges } = await service().from('booking_charges').select('label, amount_cents').eq('booking_id', id)
    expect(charges).toEqual([{ label: 'Reinigung', amount_cents: 6000 }])
  })

  test('AC: Mitarbeiter ändert Erwachsene; Preis bleibt, Inhaber sieht „Preis prüfen“; Inhaber übersteuert die Erwachsenen-Warnung', async ({ page, users }) => {
    desktopOnly()
    const owner = await users({ displayName: 'Olga Owner' })
    const staff = await users({ displayName: 'Sam Staff' })
    const tenantId = await createTenant('QA27 Testkunde', [
      { user: owner, role: 'owner' },
      { user: staff, role: 'staff' },
    ])
    const { data: property } = await service()
      .from('properties')
      .insert({ tenant_id: tenantId, name: 'Haus See', street: 'Seeweg 12', postal_code: '5340', city: 'St. Gilgen', municipality_code: '50330' })
      .select('id')
      .single()
    const apt = await addApartment(tenantId, property!.id, 'Top 1', PER_PERSON)
    const guest = await addGuest(tenantId, 'Huber', 'Anna')
    const booking = await addBooking(tenantId, apt, guest, 1, 45000)
    await signInAs(page, staff)

    await page.goto(`/buchungen/${booking}`)
    await ready(page)
    await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click()
    await panel(page).getByLabel('Erwachsene').fill('1')
    await panel(page).getByRole('button', { name: 'Änderungen speichern' }).click()
    await expect(page.getByText('Änderungen gespeichert.')).toBeVisible()
    const { data: after } = await service().from('bookings').select('adults, price_review').eq('id', booking).single()
    expect(after).toEqual({ adults: 1, price_review: true })
    expect((await service().from('booking_amounts').select('nights_cents').eq('id', booking).single()).data?.nights_cents).toBe(45000)

    await page.context().clearCookies()
    await signInAs(page, owner)
    await page.goto(`/buchungen?monat=${FUTURE.slice(0, 7)}`)
    await ready(page)
    await expect(page.getByRole('table').getByText('Preis prüfen')).toBeVisible()

    // Inhaber: Hinweis nennt auch Personen (QA BUG-1); 3 Erwachsene bei max. 2 → bewusst übersteuern
    await page.goto(`/buchungen/${booking}`)
    await ready(page)
    await expect(page.getByText('Ein Mitarbeiter hat die Buchung angelegt oder Zeitraum, Wohnung bzw. Personen geändert. Bitte den Preis prüfen.')).toBeVisible()
    await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click()
    await panel(page).getByLabel('Erwachsene').fill('3')
    await expect(panel(page).getByRole('alert').getByText('3 Erwachsene, die Wohnung ist für höchstens 2 Erwachsene ausgelegt.')).toBeVisible()
    await panel(page).getByLabel(/Trotzdem speichern/).click()
    await panel(page).getByRole('button', { name: 'Änderungen speichern' }).click()
    await expect(page.getByText('Änderungen gespeichert.')).toBeVisible()
    const { data: owned } = await service().from('bookings').select('adults, price_review, override_at').eq('id', booking).single()
    expect(owned?.adults).toBe(3)
    expect(owned?.price_review).toBe(false)
    expect(owned?.override_at).not.toBeNull()
    // vereinbarter Preis bleibt (Bestand gilt als von Hand gesetzt)
    expect((await service().from('booking_amounts').select('nights_cents').eq('id', booking).single()).data?.nights_cents).toBe(45000)
  })

  test('AC: bestehende Buchung behält ihre Beträge, wenn der Inhaber die Preise der Wohnung ändert', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, propertyId } = await setup(page, users)
    const apt = await addApartment(tenantId, propertyId, 'Top 1', PER_PERSON)
    const guest = await addGuest(tenantId, 'Huber', 'Anna')
    const booking = await addBooking(tenantId, apt, guest, 1, 45000)
    await openApartments(page)
    await page.getByRole('button', { name: /Top 1/ }).first().click()
    await panel(page).getByLabel('Erwachsener pro Nacht (€)').fill('80')
    await panel(page).getByRole('radio', { name: 'Wohnungspreis' }).click()
    await panel(page).getByRole('button', { name: 'Speichern', exact: true }).click()
    await expect(panel(page)).toHaveCount(0)

    await page.goto(`/buchungen/${booking}`)
    await ready(page)
    await expect(page.getByText(money('450,00')).first()).toBeVisible()
    const { data } = await service().from('apartments').select('price_mode, adult_price_cents').eq('id', apt).single()
    expect(data).toEqual({ price_mode: 'apartment', adult_price_cents: 8000 })
    expect((await service().from('booking_amounts').select('nights_cents').eq('id', booking).single()).data?.nights_cents).toBe(45000)
  })
})

test.describe('Layout und Barrierefreiheit', () => {
  test('Wohnungs-Panel mit Personenpreisen: keine automatisch erkennbaren WCAG-2.1-AA-Verstöße, kein seitliches Scrollen', async ({ page, users }) => {
    const { tenantId, propertyId } = await setup(page, users)
    await addApartment(tenantId, propertyId, 'Top 1', PER_PERSON)
    await openApartments(page)
    await page.getByRole('button', { name: /Top 1/ }).first().click()
    await expect(panel(page).getByLabel('Erwachsener pro Nacht (€)')).toBeVisible()
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    expect(results.violations).toEqual([])
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
})
