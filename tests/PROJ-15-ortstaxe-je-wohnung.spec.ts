import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test as base } from '@playwright/test'

import { createTenant, createUser, deleteUser, type E2EUser, hasSupabaseEnv, service, signInAs } from './support/supabase'

// PROJ-15: Ortstaxe je Wohnung. Abläufe im Projekt „desktop“, Layout auch auf dem Handy.
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
const desktopOnly = () => test.skip(!['desktop', 'firefox', 'safari'].includes(test.info().project.name), 'Abläufe nicht in Tablet- und Handy-Breite')
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

type RateRow = { valid_from: string; label?: string; method?: string; amount_cents?: number | null; percent_rate?: number | null; base?: string | null; exempt_under_age?: number | null }

async function setup(page: Page, users: Users, withStaff = false) {
  const owner = await users({ displayName: 'Olga Owner' })
  const staff = withStaff ? await users({ displayName: 'Stefan Staff' }) : null
  const tenantId = await createTenant('QA15 Testkunde', [{ user: owner, role: 'owner' }, ...(staff ? [{ user: staff, role: 'staff' as const }] : [])])
  await signInAs(page, owner)
  const { data: property, error } = await service()
    .from('properties')
    .insert({ tenant_id: tenantId, name: 'Haus See', street: 'Seeweg 12', postal_code: '5340', city: 'St. Gilgen', municipality_code: '50330' })
    .select('id')
    .single()
  if (error) throw error
  return { tenantId, propertyId: property.id, owner, staff }
}

async function addApartment(tenantId: string, propertyId: string, name: string, rates: RateRow[] = []) {
  const { data, error } = await service()
    .from('apartments')
    .insert({ tenant_id: tenantId, property_id: propertyId, name, max_guests: 6, price_cents: 10000 })
    .select('id')
    .single()
  if (error) throw error
  for (const r of rates) {
    const { error: e } = await service()
      .from('apartment_tourist_tax_rates')
      .insert({ tenant_id: tenantId, apartment_id: data.id, label: 'Nächtigungsabgabe', method: 'per_person_night', amount_cents: 250, ...r })
    if (e) throw e
  }
  return data.id
}

async function addGuest(tenantId: string, lastName: string, birthDate: string | null = '1980-05-01') {
  const { data, error } = await service()
    .from('guests')
    .insert({ tenant_id: tenantId, country: 'AT', last_name: lastName, first_name: 'Anna', birth_date: birthDate })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

let seq = 0
// Buchung direkt in der Datenbank (Bestand bzw. vorbereiteter Zustand)
async function addBooking(
  tenantId: string,
  apartmentId: string,
  guestId: string,
  opts: { mode?: 'pending' | 'auto' | 'manual'; charges?: { label: string; amount_cents: number; vat_rate?: number; tourist_tax?: boolean }[]; adults?: number } = {}
) {
  const { data, error } = await service()
    .from('bookings')
    .insert({
      tenant_id: tenantId,
      apartment_id: apartmentId,
      kind: 'booking',
      arrival: FUTURE,
      planned_departure: day(4),
      departure: day(4),
      guest_id: guestId,
      adults: opts.adults ?? 2,
      number_year: 2031,
      number_seq: ++seq + Math.floor(Math.random() * 100000),
      tourist_tax_mode: opts.mode ?? 'pending',
    })
    .select('id')
    .single()
  if (error) throw error
  await service().from('booking_amounts').insert({ id: data.id, tenant_id: tenantId, nights_cents: 40000, billed_nights_cents: 40000 })
  for (const [i, c] of (opts.charges ?? []).entries()) {
    const { error: e } = await service()
      .from('booking_charges')
      .insert({ tenant_id: tenantId, booking_id: data.id, position: i + 1, vat_rate: 0, ...c })
    if (e) throw e
  }
  return data.id
}

async function openApartment(page: Page, name: string) {
  await page.goto('/einstellungen/wohnungen')
  await ready(page)
  await page.getByRole('button', { name: new RegExp(name) }).first().click()
  await expect(panel(page)).toBeVisible()
}

async function newBooking(page: Page, apartmentLabel: string, guest: string) {
  await page.goto('/buchungen')
  await ready(page)
  await page.getByRole('button', { name: 'Neue Buchung' }).first().click()
  await panel(page).getByRole('combobox', { name: 'Wohnung' }).click()
  await page.getByRole('option', { name: apartmentLabel, exact: true }).click()
  await panel(page).getByLabel('Anreise', { exact: true }).fill(FUTURE)
  await panel(page).getByLabel('Abreise geplant').fill(day(4))
  await panel(page).getByLabel('Gast suchen').fill(guest)
  await page.getByRole('option', { name: new RegExp(guest) }).click()
  await panel(page).getByLabel('Übernachtungspreis (€)').fill('400')
}

const taxAmount = (page: Page) => panel(page).getByPlaceholder('Betrag (€)').last()

test.beforeEach(() => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')
})

test.describe('Tarife an der Wohnung', () => {
  test('AC: Leerzustand; Tarif anlegen; „Aktuell“ nach erneutem Öffnen; gespeicherte Werte', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, propertyId } = await setup(page, users)
    const apt = await addApartment(tenantId, propertyId, 'Top 1')
    await openApartment(page, 'Top 1')
    const section = panel(page).getByRole('group', { name: 'Ortstaxe' })
    await expect(section.getByText('Keine Ortstaxe hinterlegt: Buchungen dieser Wohnung erhalten keine Abgabe.')).toBeVisible()

    await section.getByRole('button', { name: 'Tarif hinzufügen' }).click()
    await expect(section.getByLabel('Bezeichnung', { exact: true })).toHaveValue('Nächtigungsabgabe')
    await expect(section.getByLabel('USt-Satz')).toHaveValue('0,00')
    await section.getByLabel('Gültig ab').fill('2026-01-01')
    await section.getByLabel('Betrag (€)').fill('2,50')
    await section.getByLabel('Befreit unter').fill('15')
    await panel(page).getByRole('button', { name: 'Speichern', exact: true }).click()
    await expect(panel(page)).toHaveCount(0)

    const { data } = await service().from('apartment_tourist_tax_rates').select('*').eq('apartment_id', apt)
    expect(data).toEqual([expect.objectContaining({ valid_from: '2026-01-01', label: 'Nächtigungsabgabe', method: 'per_person_night', amount_cents: 250, exempt_under_age: 15, vat_rate: 0 })])

    await openApartment(page, 'Top 1')
    await expect(
      panel(page).getByText(/Aktuell: Nächtigungsabgabe €\s2,50 pro Person und Nacht, befreit unter 15 Jahren, seit Do, 01\.01\.2026/)
    ).toBeVisible()
  })

  test('AC: Prozent zeigt Prozentsatz und Basis, keine Altersgrenze; künftiger Tarif gekennzeichnet; Prüfregeln', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, propertyId } = await setup(page, users)
    await addApartment(tenantId, propertyId, 'Top 1', [{ valid_from: '2026-01-01' }])
    await openApartment(page, 'Top 1')
    const section = panel(page).getByRole('group', { name: 'Ortstaxe' })
    await section.getByRole('button', { name: 'Tarif hinzufügen' }).click()
    const entry = section.getByRole('group', { name: 'Tarif 1' })
    await entry.getByRole('radio', { name: 'Prozent vom Übernachtungspreis' }).click()
    await expect(entry.getByLabel('Prozentsatz')).toBeVisible()
    await expect(entry.getByRole('radio', { name: 'Übernachtungspreis netto (ohne USt)' })).toBeVisible()
    await expect(entry.getByLabel('Befreit unter')).toHaveCount(0)

    // gleiches Datum wie der bestehende Eintrag, leere Bezeichnung, Prozent 0
    await entry.getByLabel('Gültig ab').fill('2026-01-01')
    await entry.getByLabel('Bezeichnung', { exact: true }).fill(' ')
    await entry.getByLabel('Prozentsatz').fill('0')
    await panel(page).getByRole('button', { name: 'Speichern', exact: true }).click()
    // Meldung beim neuen Eintrag, nicht beim gespeicherten (QA BUG-2)
    await expect(entry.getByText('Für dieses Datum gibt es schon einen Tarif.')).toBeVisible()
    await expect(section.getByRole('group', { name: 'Tarif 2' }).getByText('Für dieses Datum gibt es schon einen Tarif.')).toHaveCount(0)
    await expect(entry.getByText('Bitte eine Bezeichnung eingeben.')).toBeVisible()
    await expect(entry.getByText(/Bitte einen Prozentsatz über 0 bis 100/)).toBeVisible()

    await entry.getByLabel('Gültig ab').fill(`${new Date().getFullYear() + 2}-01-01`)
    await expect(entry.getByText('künftig')).toBeVisible()
  })

  test('AC: Mitarbeiter kann Tarife weder lesen noch ändern', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, propertyId, staff } = await setup(page, users, true)
    await addApartment(tenantId, propertyId, 'Top 1', [{ valid_from: '2026-01-01' }])
    await signInAs(page, staff!)
    await page.goto('/einstellungen/wohnungen')
    await expect(page.getByText('Nächtigungsabgabe')).toHaveCount(0)
  })
})

test.describe('Abgabe in der Buchung', () => {
  test('AC: 2 Erwachsene + 1 Kind, 4 Nächte, € 2,50 → automatische Position € 30,00 mit 0 %; im Detail normale Zusatzposition', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, propertyId } = await setup(page, users)
    await addApartment(tenantId, propertyId, 'Top 1', [{ valid_from: '2026-01-01' }])
    await addGuest(tenantId, 'Huber')
    await newBooking(page, 'Haus See · Top 1', 'Huber')
    await panel(page).getByLabel('Erwachsene').fill('2')
    await panel(page).getByRole('button', { name: 'Kind hinzufügen' }).click()
    await panel(page).getByLabel('Alter von Kind 1 bei Anreise').fill('4')
    await expect(panel(page).getByText('automatisch berechnet')).toBeVisible()
    await expect(panel(page).getByPlaceholder('Bezeichnung').last()).toHaveValue('Nächtigungsabgabe')
    await expect(taxAmount(page)).toHaveValue('30,00')
    await panel(page).getByRole('button', { name: 'Buchung speichern' }).click()

    await expect(page).toHaveURL(/\/buchungen\/[0-9a-f-]{36}$/)
    const priceSection = page.getByRole('region').filter({ hasText: 'Preis' }).or(page.locator('section', { hasText: 'Endbetrag' }))
    await expect(priceSection.getByText('Nächtigungsabgabe').first()).toBeVisible()
    await expect(page.getByText(money('30,00')).first()).toBeVisible()
    const id = page.url().split('/').pop()!
    const { data } = await service().from('booking_charges').select('label, amount_cents, vat_rate, tourist_tax, tax_person_nights').eq('booking_id', id)
    expect(data).toEqual([{ label: 'Nächtigungsabgabe', amount_cents: 3000, vat_rate: 0, tourist_tax: true, tax_person_nights: 12 }])
    expect((await service().from('bookings').select('tourist_tax_mode').eq('id', id).single()).data?.tourist_tax_mode).toBe('auto')
  })

  test('AC: Hauptgast befreit halbiert die Abgabe; Detail zeigt „von der Ortstaxe befreit“', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, propertyId } = await setup(page, users)
    await addApartment(tenantId, propertyId, 'Top 1', [{ valid_from: '2026-01-01' }])
    await addGuest(tenantId, 'Huber')
    await newBooking(page, 'Haus See · Top 1', 'Huber')
    await panel(page).getByLabel('Erwachsene').fill('2')
    await expect(taxAmount(page)).toHaveValue('20,00')
    await panel(page).getByLabel('Hauptgast von der Ortstaxe befreit').check()
    await expect(taxAmount(page)).toHaveValue('10,00')
    await panel(page).getByRole('button', { name: 'Buchung speichern' }).click()
    await expect(page).toHaveURL(/\/buchungen\/[0-9a-f-]{36}$/)
    await expect(page.getByText('von der Ortstaxe befreit')).toBeVisible()
    await expect(page.getByText(money('10,00')).first()).toBeVisible()
  })

  test('AC: Kind ohne Geburtsdatum zahlt, mit Hinweis; Nächte ohne Tarif werden genannt', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, propertyId } = await setup(page, users)
    await addApartment(tenantId, propertyId, 'Top 1', [{ valid_from: day(2), exempt_under_age: 15 }])
    await addGuest(tenantId, 'Huber')
    await newBooking(page, 'Haus See · Top 1', 'Huber')
    await panel(page).getByLabel('Erwachsene').fill('1')
    await panel(page).getByRole('button', { name: 'Kind hinzufügen' }).click()
    await panel(page).getByLabel('Alter von Kind 1 bei Anreise').fill('4')
    // 2 von 4 Nächten mit Tarif, 2 Personen (Kind ohne Geburtsdatum zahlt)
    await expect(taxAmount(page)).toHaveValue('10,00')
    await expect(panel(page).getByText('Für 1 Person fehlt das Geburtsdatum: Abgabe ohne Altersbefreiung berechnet.')).toBeVisible()
    await expect(panel(page).getByText('Für 2 Nächte ist kein Ortstaxe-Tarif hinterlegt.')).toBeVisible()
    // Erwachsener ohne Namen zählt nicht mit (QA BUG-1)
    await panel(page).getByLabel('Erwachsene').fill('2')
    await expect(taxAmount(page)).toHaveValue('15,00')
    await expect(panel(page).getByText('Für 1 Person fehlt das Geburtsdatum: Abgabe ohne Altersbefreiung berechnet.')).toBeVisible()
  })

  test('AC: Von Hand geänderter Betrag bleibt bei Personenänderung; „Abgabe neu berechnen“ stellt die Berechnung wieder her', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, propertyId } = await setup(page, users)
    await addApartment(tenantId, propertyId, 'Top 1', [{ valid_from: '2026-01-01' }])
    await addGuest(tenantId, 'Huber')
    await newBooking(page, 'Haus See · Top 1', 'Huber')
    await panel(page).getByLabel('Erwachsene').fill('2')
    await expect(taxAmount(page)).toHaveValue('20,00')
    await taxAmount(page).fill('15')
    await expect(panel(page).getByText('von Hand geändert')).toBeVisible()
    await panel(page).getByLabel('Erwachsene').fill('3')
    await expect(taxAmount(page)).toHaveValue('15,00')
    await panel(page).getByRole('button', { name: 'Abgabe neu berechnen' }).click()
    await expect(taxAmount(page)).toHaveValue('30,00')
    await expect(panel(page).getByText('automatisch berechnet')).toBeVisible()
  })

  test('AC: Bestand („noch nicht berechnet“) bleibt beim Tarif-Anlegen; Bearbeiten bietet „Abgabe berechnen“ mit Doppelungs-Hinweis an', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, propertyId } = await setup(page, users)
    const apt = await addApartment(tenantId, propertyId, 'Top 1', [{ valid_from: '2026-01-01' }])
    const id = await addBooking(tenantId, apt, await addGuest(tenantId, 'Huber'), {
      charges: [{ label: 'Nächtigungsabgabe', amount_cents: 1800, tourist_tax: false }],
    })
    await page.goto(`/buchungen/${id}`)
    await ready(page)
    await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click()
    await expect(panel(page).getByText('Es gibt bereits eine Position „Nächtigungsabgabe“. Bitte prüfen, sonst wird die Abgabe doppelt verrechnet.')).toBeVisible()
    await panel(page).getByRole('button', { name: 'Abgabe berechnen' }).click()
    await expect(panel(page).getByText('automatisch berechnet')).toBeVisible()
    // alte Position entfernen und speichern
    await panel(page).getByRole('button', { name: 'Position 1 entfernen' }).click()
    await panel(page).getByRole('button', { name: 'Änderungen speichern' }).click()
    await expect(panel(page)).toHaveCount(0)
    const { data } = await service().from('booking_charges').select('amount_cents, tourist_tax').eq('booking_id', id)
    expect(data).toEqual([{ amount_cents: 2000, tourist_tax: true }])
  })

  test('PROJ-14 BUG-7: gekennzeichnete Alt-Position (ohne Tarif) wird bei „Abgabe berechnen“ ersetzt, kein Doppelungs-Hinweis', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, propertyId } = await setup(page, users)
    const apt = await addApartment(tenantId, propertyId, 'Top 1', [{ valid_from: '2026-01-01' }])
    // Stand nach der Migration 20261107194628: Kennzeichen gesetzt, kein Tarif-Verweis
    const id = await addBooking(tenantId, apt, await addGuest(tenantId, 'Huber'), {
      charges: [{ label: 'Nächtigungsabgabe', amount_cents: 1800, tourist_tax: true }],
    })
    await page.goto(`/buchungen/${id}`)
    await ready(page)
    await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click()
    await expect(panel(page).getByText('von Hand geändert')).toBeVisible()
    await expect(panel(page).getByText(/Es gibt bereits eine Position/)).toHaveCount(0)
    await panel(page).getByRole('button', { name: 'Abgabe berechnen' }).click()
    await expect(panel(page).getByText('automatisch berechnet')).toHaveCount(1)
    await expect(panel(page).getByText('von Hand geändert')).toHaveCount(0)
    await panel(page).getByRole('button', { name: 'Änderungen speichern' }).click()
    await expect(panel(page)).toHaveCount(0)
    const { data } = await service().from('booking_charges').select('amount_cents, tourist_tax').eq('booking_id', id)
    expect(data).toEqual([{ amount_cents: 2000, tourist_tax: true }])
  })

  test('Mehr als 20 Positionen durch die Abgabe: Hinweis, Speichern gesperrt, nach Entfernen wieder möglich (QA BUG-4)', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, propertyId } = await setup(page, users)
    const apt = await addApartment(tenantId, propertyId, 'Top 1', [{ valid_from: '2026-01-01' }])
    const id = await addBooking(tenantId, apt, await addGuest(tenantId, 'Huber'), {
      charges: Array.from({ length: 20 }, (_, i) => ({ label: `Posten ${i + 1}`, amount_cents: 100 })),
    })
    await page.goto(`/buchungen/${id}`)
    await ready(page)
    await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click()
    await panel(page).getByRole('button', { name: 'Abgabe berechnen' }).click()
    await expect(panel(page).getByRole('alert').getByText('Mit der Ortstaxe sind es mehr als 20 Positionen.', { exact: false })).toBeVisible()
    await expect(panel(page).getByRole('button', { name: 'Änderungen speichern' })).toBeDisabled()
    await panel(page).getByRole('button', { name: 'Position 1 entfernen' }).click()
    await expect(panel(page).getByRole('button', { name: 'Änderungen speichern' })).toBeEnabled()
  })

  test('AC: Mitreisender „Von der Ortstaxe befreit“ im Mitreisende-Panel; Mitarbeiter sieht keine Abgabe-Positionen', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, propertyId, staff } = await setup(page, users, true)
    const apt = await addApartment(tenantId, propertyId, 'Top 1', [{ valid_from: '2026-01-01' }])
    const id = await addBooking(tenantId, apt, await addGuest(tenantId, 'Huber'), {
      mode: 'auto',
      charges: [{ label: 'Nächtigungsabgabe', amount_cents: 2000, tourist_tax: true }],
    })
    await signInAs(page, staff!)
    await page.goto(`/buchungen/${id}`)
    await ready(page)
    await expect(page.getByText('Nächtigungsabgabe')).toHaveCount(0)
    await page.getByRole('button', { name: 'Mitreisende bearbeiten' }).click()
    await panel(page).getByRole('button', { name: 'Person hinzufügen' }).click()
    await panel(page).getByLabel('Vorname').fill('Max')
    await panel(page).getByLabel('Von der Ortstaxe befreit').check()
    await panel(page).getByRole('button', { name: 'Mitreisende speichern' }).click()
    await expect(panel(page)).toHaveCount(0)
    await expect(page.getByText('von der Ortstaxe befreit')).toBeVisible()
    const { data } = await service().from('booking_charges').select('amount_cents').eq('booking_id', id).eq('tourist_tax', true)
    expect(data).toEqual([{ amount_cents: 1000 }])
  })
})

test.describe('Tarifänderung und Rechnung', () => {
  test('AC: Tariferhöhung zieht nicht nach; beim Bearbeiten „Abgabe neu berechnen“, ohne Klick bleibt der Betrag; mit Klick neuer Betrag', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, propertyId } = await setup(page, users)
    const apt = await addApartment(tenantId, propertyId, 'Top 1', [{ valid_from: '2026-01-01' }])
    const id = await addBooking(tenantId, apt, await addGuest(tenantId, 'Huber'), {
      mode: 'auto',
      charges: [{ label: 'Nächtigungsabgabe', amount_cents: 2000, tourist_tax: true }],
    })
    await service().from('apartment_tourist_tax_rates').update({ amount_cents: 300 }).eq('apartment_id', apt)
    const stored = async () => (await service().from('booking_charges').select('amount_cents').eq('booking_id', id).eq('tourist_tax', true)).data
    await page.goto(`/buchungen/${id}`)
    await ready(page)
    await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click()
    await expect(panel(page).getByRole('button', { name: 'Abgabe neu berechnen' })).toBeVisible()
    await expect(taxAmount(page)).toHaveValue('20,00')
    // Ohne Klick speichern: Betrag bleibt
    await panel(page).getByLabel('Notiz').fill('nur Notiz')
    await panel(page).getByRole('button', { name: 'Änderungen speichern' }).click()
    await expect(panel(page)).toHaveCount(0)
    expect(await stored()).toEqual([{ amount_cents: 2000 }])
    // Mit Klick: neuer Betrag (erst bearbeiten, wenn die Seite neu geladen ist)
    await expect(page.getByText('nur Notiz')).toBeVisible()
    await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click()
    await panel(page).getByRole('button', { name: 'Abgabe neu berechnen' }).click()
    await expect(taxAmount(page)).toHaveValue('24,00')
    await panel(page).getByRole('button', { name: 'Änderungen speichern' }).click()
    await expect(panel(page)).toHaveCount(0)
    expect(await stored()).toEqual([{ amount_cents: 2400 }])
  })

  test('AC: Buchung mit nacherfasster Rechnung bekommt kein Angebot; ein Rechnungsentwurf verhindert es nicht', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, propertyId } = await setup(page, users)
    const apt = await addApartment(tenantId, propertyId, 'Top 1', [{ valid_from: '2026-01-01' }])
    const guest = await addGuest(tenantId, 'Huber')
    const id = await addBooking(tenantId, apt, guest)
    const invoice = { tenant_id: tenantId, booking_id: id, invoice_date: '2026-10-01', recipient: 'Huber Anna', total_cents: 40000 }
    const { data, error } = await service()
      .from('invoices')
      .insert({ ...invoice, origin: 'draft', kind: 'invoice', recipient_kind: 'guest', company_salutation: 'generic', guest_names: 'main', due_days: 14, due_basis: 'after_invoice' } as never)
      .select('id')
      .single()
    expect(error).toBeNull()
    await page.goto(`/buchungen/${id}`)
    await ready(page)
    await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click()
    await expect(panel(page).getByRole('button', { name: 'Abgabe berechnen' })).toBeVisible()

    const backfilled = await service()
      .from('invoices')
      .update({ origin: 'backfilled', number: 'RE-2026-1' } as never)
      .eq('id', (data as unknown as { id: string }).id)
    expect(backfilled.error).toBeNull()
    await page.reload()
    await ready(page)
    await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click()
    await expect(panel(page)).toBeVisible()
    await expect(panel(page).getByRole('button', { name: /Abgabe (neu )?berechnen/ })).toHaveCount(0)
  })
})

test.describe('Layout und Barrierefreiheit', () => {
  test('Wohnungsformular mit Tarif und Buchungsformular mit Abgabe: keine WCAG-2.1-AA-Verstöße, kein seitliches Scrollen (auch 375 px)', async ({ page, users }) => {
    test.skip(test.info().project.name === 'tablet', 'Desktop und Handy genügen')
    const { tenantId, propertyId } = await setup(page, users)
    await addApartment(tenantId, propertyId, 'Top 1', [{ valid_from: '2026-01-01', exempt_under_age: 15 }, { valid_from: '2030-01-01', method: 'percent', amount_cents: null, percent_rate: 3.2, base: 'net' }])
    await addGuest(tenantId, 'Huber')
    const scan = async (label: string) => {
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      expect(results.violations, label).toEqual([])
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, label).toBeLessThanOrEqual(0)
    }
    await openApartment(page, 'Top 1')
    await panel(page).getByRole('group', { name: 'Ortstaxe' }).scrollIntoViewIfNeeded()
    await scan('Wohnung')
    await page.keyboard.press('Escape')
    await newBooking(page, 'Haus See · Top 1', 'Huber')
    await panel(page).getByRole('button', { name: 'Kind hinzufügen' }).click()
    await panel(page).getByLabel('Alter von Kind 1 bei Anreise').fill('4')
    await expect(panel(page).getByText('automatisch berechnet')).toBeVisible()
    await scan('Buchung')
  })
})
