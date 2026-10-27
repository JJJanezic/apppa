import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test as base } from '@playwright/test'

import { createTenant, createUser, deleteUser, type E2EUser, hasSupabaseEnv, service, signInAs } from './support/supabase'

// PROJ-8: Manuelle Buchungen. Abläufe nur im Projekt „desktop“, Layout und Barrierefreiheit in allen Breiten.
// Testdaten werden über die Datenbank angelegt; die Kunden verschwinden mit dem Löschen ihrer Inhaber.
// Daten relativ zu heute (Wien), damit Optionen und „künftige Buchungen“ unabhängig vom Testtag stimmen.

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

const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Vienna' }).format(new Date())
function day(offset: number, from = TODAY) {
  const d = new Date(`${from}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}
const month = (iso: string) => iso.slice(0, 7)
// Erster Tag des übernächsten Monats: Einträge dort liegen sicher in der Zukunft und in einem Monat
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
  const tenantId = await createTenant('QA8 Testkunde', members)
  await signInAs(page, role === 'staff' ? staff! : owner)
  return { tenantId, owner, staff }
}

async function addProperty(tenantId: string, name = 'Haus See') {
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
    .insert({ tenant_id: tenantId, property_id: propertyId, name, max_guests: 4, price_cents: 12000, cleaning_fee_cents: 6000, ...extra } as never)
    .select('id')
    .single()
  if (error) throw error
  return (data as { id: string }).id
}

async function addGuest(tenantId: string, fields: Record<string, unknown>) {
  const { data, error } = await service()
    .from('guests')
    .insert({ tenant_id: tenantId, country: 'AT', ...fields } as never)
    .select('id')
    .single()
  if (error) throw error
  return (data as { id: string }).id
}

let seq = 100
// Eintrag direkt in der Datenbank (Systemrechte); Buchungen und Optionen mit Nummer und Beträgen
async function addBooking(
  tenantId: string,
  apartmentId: string,
  b: { kind?: 'booking' | 'option' | 'block'; guestId?: string; arrival: string; departure: string; adults?: number; childAges?: number[]; optionUntil?: string; reason?: string; note?: string; cancelled?: boolean; nightsCents?: number }
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
      adults: block ? null : (b.adults ?? 2),
      child_ages: b.childAges ?? [],
      number_year: block ? null : Number(b.arrival.slice(0, 4)),
      number_seq: block ? null : ++seq,
      option_until: kind === 'option' ? b.optionUntil : null,
      block_reason: block ? (b.reason ?? 'owner_use') : null,
      note: b.note ?? null,
      cancelled_at: b.cancelled ? new Date().toISOString() : null,
    } as never)
    .select('id, number')
    .single()
  if (error) throw error
  const row = data as { id: string; number: string | null }
  if (!block) {
    const { error: amountError } = await service()
      .from('booking_amounts')
      .insert({ id: row.id, tenant_id: tenantId, nights_cents: b.nightsCents ?? 30000 } as never)
    if (amountError) throw amountError
  }
  return row
}

// Kunde mit einem Objekt und zwei Wohnungen (Top 1: 120 €/Nacht, Reinigung 60 €, 4 Personen; Top 2 ohne Preise)
async function withApartments(tenantId: string) {
  const propertyId = await addProperty(tenantId)
  const top1 = await addApartment(tenantId, propertyId, 'Top 1')
  const top2 = await addApartment(tenantId, propertyId, 'Top 2', { price_cents: null, cleaning_fee_cents: null, max_guests: 2 })
  return { propertyId, top1, top2 }
}

async function openList(page: Page, query = '') {
  await page.goto(`/buchungen${query}`)
  await ready(page)
}

async function openBooking(page: Page, id: string) {
  await page.goto(`/buchungen/${id}`)
  await ready(page)
}

async function chooseApartment(page: Page, label: string) {
  await panel(page).getByRole('combobox', { name: 'Wohnung' }).click()
  await page.getByRole('option', { name: label, exact: true }).click()
}

async function setPeriod(page: Page, arrival: string, departure: string, labels = ['Anreise', 'Abreise geplant']) {
  await panel(page).getByLabel(labels[0], { exact: true }).fill(arrival)
  await panel(page).getByLabel(labels[1], { exact: true }).fill(departure)
}

async function pickGuest(page: Page, search: string, name: RegExp) {
  await panel(page).getByLabel('Gast suchen').fill(search)
  await page.getByRole('option', { name }).click()
}

async function submit(page: Page, label: string) {
  const button = panel(page).getByRole('button', { name: label, exact: true })
  await button.scrollIntoViewIfNeeded()
  await button.click()
}

async function newBooking(page: Page) {
  await page.getByRole('button', { name: 'Neue Buchung' }).first().click()
  await expect(panel(page)).toBeVisible()
}

test.beforeEach(() => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')
})

test.describe('Zugang und Leerzustände', () => {
  test('AC: ohne Wohnung Hinweis mit Link zu den Wohnungen; ohne Buchungen Leerzustand mit „Neue Buchung“ und „Neue Sperre“', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    await openList(page)
    await expect(page.getByRole('heading', { name: 'Noch keine Wohnung' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Zu den Wohnungen' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Neue Buchung' })).toHaveCount(0)

    await withApartments(tenantId)
    await openList(page)
    await expect(page.getByRole('heading', { name: 'Noch keine Buchungen' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Neue Buchung' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Neue Sperre' }).first()).toBeVisible()
  })

  test('AC: Buchungen eines anderen Kunden sind auch per Adresse nicht erreichbar', async ({ page, users }) => {
    desktopOnly()
    await setup(page, users)
    const other = await users({ displayName: 'Fremd' })
    const otherTenant = await createTenant('QA8 Fremdkunde', [{ user: other, role: 'owner' }])
    const { top1 } = await withApartments(otherTenant)
    const guest = await addGuest(otherTenant, { last_name: 'Geheim' })
    const foreign = await addBooking(otherTenant, top1, { guestId: guest, arrival: FUTURE, departure: day(3, FUTURE) })
    const res = await page.goto(`/buchungen/${foreign.id}`)
    expect(res?.status()).toBe(404)
  })
})

test.describe('Buchung anlegen (Inhaber)', () => {
  test('AC: Zeiten und Reinigung aus der Wohnung, Preisvorschlag, Zusatzkosten, Kinder; gespeichert mit nächster Nummer', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const { propertyId } = await withApartments(tenantId)
    await addApartment(tenantId, propertyId, 'Top 3', { check_in: '16:00', check_out: '09:30' })
    await addGuest(tenantId, { last_name: 'Huber', first_name: 'Anna' })
    await openList(page)
    await newBooking(page)

    await chooseApartment(page, 'Haus See · Top 3')
    await expect(panel(page).getByLabel('Check-in')).toHaveValue('16:00')
    await expect(panel(page).getByLabel('Check-out')).toHaveValue('09:30')
    await expect(panel(page).getByPlaceholder('Bezeichnung')).toHaveValue('Reinigung')
    await expect(panel(page).getByPlaceholder('Betrag (€)')).toHaveValue('60')

    await setPeriod(page, FUTURE, day(3, FUTURE))
    await expect(panel(page).getByText('3 Nächte')).toBeVisible()
    await expect(panel(page).getByLabel('Übernachtungspreis (€)')).toHaveValue('360')
    await expect(panel(page).getByText(money('420'))).toBeVisible()

    // weitere Position aus den Vorschlägen
    await panel(page).getByRole('button', { name: 'Position hinzufügen' }).click()
    await panel(page).getByPlaceholder('Bezeichnung').nth(1).fill('Haustier')
    await panel(page).getByPlaceholder('Betrag (€)').nth(1).fill('15,50')
    await expect(panel(page).getByText(money('435,50'))).toBeVisible()

    // Preis von Hand geändert: neuer Zeitraum ändert ihn nicht, bietet aber den Vorschlag an
    await panel(page).getByLabel('Übernachtungspreis (€)').fill('300')
    await panel(page).getByLabel('Abreise geplant').fill(day(4, FUTURE))
    await expect(panel(page).getByLabel('Übernachtungspreis (€)')).toHaveValue('300')
    await panel(page).getByRole('button', { name: /Neuen Vorschlag .*480.* übernehmen/ }).click()
    await expect(panel(page).getByLabel('Übernachtungspreis (€)')).toHaveValue('480')

    await pickGuest(page, 'Huber', /Huber, Anna/)
    await panel(page).getByLabel('Erwachsene').fill('2')
    await panel(page).getByRole('button', { name: 'Kind hinzufügen' }).click()
    await panel(page).getByLabel('Alter von Kind 1 bei Anreise').fill('4')
    await submit(page, 'Buchung speichern')

    await expect(page).toHaveURL(/\/buchungen\/[0-9a-f-]{36}$/)
    await expect(page.getByRole('heading', { name: 'Anna Huber' })).toBeVisible()
    await expect(page.getByText(`${FUTURE.slice(0, 4)}-0001 · Haus See · Top 3`)).toBeVisible()
    await expect(page.getByText('3 (2 Erwachsene, 1 Kind)')).toBeVisible()
    await expect(page.getByText('4 Jahre')).toBeVisible()
    await expect(page.getByText(money('555,50'))).toBeVisible() // 480 + 60 + 15,50
  })

  test('BUG-1 (behoben): Bei nur einer aktiven Wohnung ist deren Reinigungsgebühr eingetragen', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const propertyId = await addProperty(tenantId)
    await addApartment(tenantId, propertyId, 'Top 1')
    await openList(page)
    await newBooking(page)
    await expect(panel(page).getByRole('combobox', { name: 'Wohnung' })).toHaveText('Haus See · Top 1')
    await expect(panel(page).getByPlaceholder('Bezeichnung')).toHaveValue('Reinigung', { timeout: 3000 })
  })

  test('AC: Pflichtfelder, Zeitraum, Kinderalter, Ablaufdatum, Positionen und Preis ohne Standardpreis werden geprüft', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    await withApartments(tenantId)
    await openList(page)
    await newBooking(page)

    await submit(page, 'Buchung speichern')
    for (const message of [
      'Bitte eine Wohnung wählen.',
      'Bitte die Anreise eingeben.',
      'Bitte die Abreise eingeben.',
      'Bitte einen Gast wählen oder neu anlegen.',
      'Bitte den Übernachtungspreis eingeben.',
    ]) {
      await expect(panel(page).getByText(message)).toBeVisible()
    }

    // Wohnung ohne Standardpreis: Preis bleibt leer und ist Pflicht
    await chooseApartment(page, 'Haus See · Top 2')
    await expect(panel(page).getByText('Die Wohnung hat keinen Preis hinterlegt. Bitte den Preis eingeben.')).toBeVisible()
    await setPeriod(page, day(5, FUTURE), day(2, FUTURE))
    await expect(panel(page).getByText('Die Abreise muss nach der Anreise liegen.')).toBeVisible()
    await setPeriod(page, FUTURE, day(2, FUTURE))
    await expect(panel(page).getByLabel('Übernachtungspreis (€)')).toHaveValue('')

    await panel(page).getByRole('button', { name: 'Kind hinzufügen' }).click()
    await panel(page).getByLabel('Alter von Kind 1 bei Anreise').fill('18')
    await panel(page).getByRole('button', { name: 'Position hinzufügen' }).click()
    await panel(page).getByPlaceholder('Betrag (€)').fill('-5')
    await panel(page).getByRole('radio', { name: 'Option' }).click()
    await panel(page).getByLabel('Option gilt bis').fill(day(-1))
    await submit(page, 'Option speichern')
    await expect(panel(page).getByText('Bitte ein Alter von 0 bis 17 eingeben.')).toBeVisible()
    await expect(panel(page).getByText('Bitte eine Bezeichnung eingeben.')).toBeVisible()
    await expect(panel(page).getByText('Bitte einen Betrag wie 125 oder 125,50 eingeben.')).toBeVisible()
    await expect(panel(page).getByText('Das Ablaufdatum darf nicht in der Vergangenheit liegen.')).toBeVisible()
    expect((await service().from('bookings').select('id').eq('tenant_id', tenantId)).data).toEqual([])
  })
})

test.describe('Mitarbeiter', () => {
  test('AC: Mitarbeiter legt Buchung mit neuem Gast an (Dublettenwarnung), sieht keine Beträge; Buchung erhält den Preisvorschlag', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users, 'staff')
    await withApartments(tenantId)
    await addGuest(tenantId, { last_name: 'Berger', first_name: 'Paul', email: 'paul@example.at' })
    await openList(page)
    await newBooking(page)
    await expect(panel(page).getByText(/Den Preis setzt die App/)).toBeVisible()
    await expect(panel(page).getByLabel('Übernachtungspreis (€)')).toHaveCount(0)

    await chooseApartment(page, 'Haus See · Top 1')
    await setPeriod(page, FUTURE, day(3, FUTURE))
    await panel(page).getByRole('radio', { name: 'Neuer Gast' }).click()
    await panel(page).getByLabel('Nachname').fill('Berger')
    await panel(page).getByLabel('Vorname').fill('Paul')
    await panel(page).getByRole('combobox', { name: 'Herkunftsland' }).click()
    await page.getByPlaceholder('Land suchen').fill('Österreich')
    await page.getByRole('option', { name: 'Österreich', exact: true }).click()
    await submit(page, 'Buchung speichern')
    await expect(panel(page).getByText('Möglicher Doppeleintrag')).toBeVisible()
    await panel(page).getByRole('button', { name: 'Trotzdem anlegen' }).click()

    await expect(page).toHaveURL(/\/buchungen\/[0-9a-f-]{36}$/)
    await expect(page.getByRole('heading', { name: 'Paul Berger' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Preis' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Stornieren' })).toHaveCount(0)
    const id = page.url().split('/').pop()!
    const { data: amounts } = await service().from('booking_amounts').select('nights_cents').eq('id', id).single()
    expect(amounts?.nights_cents).toBe(36000)
    const { data: charges } = await service().from('booking_charges').select('label, amount_cents').eq('booking_id', id)
    expect(charges).toEqual([{ label: 'Reinigung', amount_cents: 6000 }])
    const { count } = await service().from('guests').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('last_name', 'Berger')
    expect(count).toBe(2)

    await openList(page, `?monat=${month(FUTURE)}`)
    await expect(page.getByRole('columnheader', { name: 'Betrag' })).toHaveCount(0)
    await expect(page.getByRole('table').getByText('€')).toHaveCount(0)
  })

  test('AC: Überschneidung und Überbelegung sperren Speichern für Mitarbeiter; kein Löschen von Sperren', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users, 'staff')
    const { top1 } = await withApartments(tenantId)
    const guest = await addGuest(tenantId, { last_name: 'Huber', first_name: 'Anna' })
    await addBooking(tenantId, top1, { guestId: guest, arrival: FUTURE, departure: day(4, FUTURE) })
    const block = await addBooking(tenantId, top1, { kind: 'block', arrival: day(10, FUTURE), departure: day(12, FUTURE) })
    await openList(page)
    await newBooking(page)
    await chooseApartment(page, 'Haus See · Top 1')
    await setPeriod(page, day(2, FUTURE), day(5, FUTURE))
    await panel(page).getByLabel('Erwachsene').fill('5')
    const alert = panel(page).getByRole('alert')
    await expect(alert.getByText(/Überschneidung mit Buchung · .* · Huber, Anna/)).toBeVisible()
    await expect(alert.getByText('5 Personen, die Wohnung ist für höchstens 4 ausgelegt.')).toBeVisible()
    await expect(alert.getByText(/So lässt sich nicht speichern/)).toBeVisible()
    await expect(panel(page).getByLabel('Trotzdem speichern')).toHaveCount(0)
    await expect(panel(page).getByRole('button', { name: 'Buchung speichern' })).toBeDisabled()

    await openBooking(page, block.id)
    await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click()
    await expect(panel(page).getByRole('button', { name: 'Sperre speichern' })).toBeVisible()
    await expect(panel(page).getByRole('button', { name: 'Sperre löschen' })).toHaveCount(0)
  })
})

test.describe('Mitarbeiter bestätigt Option', () => {
  test('BUG-3 (behoben): belegter Zeitraum beim Bestätigen zeigt Hinweis auf den Inhaber statt „Trotzdem speichern“', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users, 'staff')
    const { top1 } = await withApartments(tenantId)
    const guest = await addGuest(tenantId, { last_name: 'Huber', first_name: 'Anna' })
    const option = await addBooking(tenantId, top1, { kind: 'option', guestId: guest, arrival: FUTURE, departure: day(3, FUTURE), optionUntil: day(-1) })
    await addBooking(tenantId, top1, { guestId: guest, arrival: day(1, FUTURE), departure: day(4, FUTURE) })
    await openBooking(page, option.id)
    await page.getByRole('button', { name: 'Option bestätigen' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Bestätigen' }).click()
    await expect(page.getByText(/Bitte den Inhaber fragen\./)).toBeVisible()
    await expect(page.getByText(/Trotzdem speichern/)).toHaveCount(0)
    const { data } = await service().from('bookings').select('kind').eq('id', option.id).single()
    expect(data?.kind).toBe('option')
  })
})

test.describe('Konflikte', () => {
  test('AC: Inhaber bestätigt „Trotzdem speichern“, Buchung ist als „überschneidet sich“ gekennzeichnet; Wechseltag und stornierte Einträge ohne Warnung', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const { top1 } = await withApartments(tenantId)
    const guest = await addGuest(tenantId, { last_name: 'Huber', first_name: 'Anna' })
    await addBooking(tenantId, top1, { guestId: guest, arrival: FUTURE, departure: day(4, FUTURE) })
    await addBooking(tenantId, top1, { guestId: guest, arrival: day(8, FUTURE), departure: day(12, FUTURE), cancelled: true })
    await openList(page)

    // Wechseltag (Anreise = Abreise der anderen) und stornierte Buchung: keine Warnung
    await newBooking(page)
    await chooseApartment(page, 'Haus See · Top 1')
    await setPeriod(page, day(4, FUTURE), day(10, FUTURE))
    await pickGuest(page, 'Huber', /Huber, Anna/)
    await expect(panel(page).getByText('6 Nächte')).toBeVisible()
    await page.waitForTimeout(800) // Vorschau der Prüfung abwarten
    await expect(panel(page).getByRole('alert')).toHaveCount(0)
    await submit(page, 'Buchung speichern')
    await expect(page).toHaveURL(/\/buchungen\/[0-9a-f-]{36}$/)
    await expect(page.getByText('überschneidet sich')).toHaveCount(0)

    // Überschneidung: Speichern erst nach ausdrücklicher Bestätigung
    await openList(page)
    await newBooking(page)
    await chooseApartment(page, 'Haus See · Top 1')
    await setPeriod(page, day(2, FUTURE), day(6, FUTURE))
    await pickGuest(page, 'Huber', /Huber, Anna/)
    await expect(panel(page).getByRole('alert').getByText(/Überschneidung mit Buchung/)).toHaveCount(2)
    await expect(panel(page).getByRole('button', { name: 'Buchung speichern' })).toBeDisabled()
    await panel(page).getByLabel(/Trotzdem speichern/).click()
    await submit(page, 'Buchung speichern')
    await expect(page).toHaveURL(/\/buchungen\/[0-9a-f-]{36}$/)
    await expect(page.getByText('überschneidet sich').first()).toBeVisible()
    await expect(page.getByText('Trotz Warnung gespeichert von Olga Owner.')).toBeVisible()
  })

  test('AC: Sperre über einer Buchung warnt ebenso; Inhaber löscht die Sperre, der Zeitraum ist frei', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const { top1 } = await withApartments(tenantId)
    const guest = await addGuest(tenantId, { last_name: 'Huber', first_name: 'Anna' })
    await addBooking(tenantId, top1, { guestId: guest, arrival: FUTURE, departure: day(4, FUTURE) })
    await openList(page)
    await page.getByRole('button', { name: 'Neue Sperre' }).first().click()
    await chooseApartment(page, 'Haus See · Top 1')
    await setPeriod(page, day(1, FUTURE), day(3, FUTURE), ['Von', 'Bis (frei ab)'])
    await panel(page).getByRole('combobox', { name: 'Grund' }).click()
    await page.getByRole('option', { name: 'Sonstiges' }).click()
    await expect(panel(page).getByRole('alert').getByText(/Überschneidung mit Buchung/)).toBeVisible()
    await panel(page).getByLabel(/Trotzdem speichern/).click()
    await submit(page, 'Sperre speichern')
    await expect(panel(page).getByText('Bei „Sonstiges“ bitte eine Notiz eingeben.')).toBeVisible()
    await panel(page).getByLabel('Notiz').fill('Wasserschaden')
    await submit(page, 'Sperre speichern')
    await expect(page.getByRole('heading', { name: 'Sperre: Sonstiges' })).toBeVisible()
    const { data: blocks } = await service().from('bookings').select('guest_id, number').eq('tenant_id', tenantId).eq('kind', 'block')
    expect(blocks).toEqual([{ guest_id: null, number: null }])

    await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click()
    await panel(page).getByRole('button', { name: 'Sperre löschen' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Sperre löschen' }).click()
    await expect(page).toHaveURL(/\/buchungen(\?.*)?$/)
    await expect.poll(async () => (await service().from('bookings').select('id').eq('kind', 'block').eq('tenant_id', tenantId)).data?.length).toBe(0)
  })
})

test.describe('Optionen und Stornieren', () => {
  test('AC: Option mit vorbelegtem Ablaufdatum anlegen und bestätigen (gleiche Nummer)', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    await withApartments(tenantId)
    await addGuest(tenantId, { last_name: 'Huber', first_name: 'Anna' })
    await openList(page)
    await newBooking(page)
    await panel(page).getByRole('radio', { name: 'Option' }).click()
    await expect(panel(page).getByLabel('Option gilt bis')).toHaveValue(day(7))
    await chooseApartment(page, 'Haus See · Top 1')
    await setPeriod(page, FUTURE, day(2, FUTURE))
    await pickGuest(page, 'Huber', /Huber, Anna/)
    await submit(page, 'Option speichern')
    await expect(page).toHaveURL(/\/buchungen\/[0-9a-f-]{36}$/)
    const number = `${FUTURE.slice(0, 4)}-0001`
    await expect(page.getByText(`${number} · Haus See · Top 1`)).toBeVisible()
    await expect(page.getByText(/^Option bis/)).toBeVisible()

    await page.getByRole('button', { name: 'Option bestätigen' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Bestätigen' }).click()
    await expect(page.getByText('Option bestätigt.')).toBeVisible()
    await expect(page.getByText(/^Option bis/)).toHaveCount(0)
    await expect(page.getByText(`${number} · Haus See · Top 1`)).toBeVisible()
    const { data } = await service().from('bookings').select('kind, number').eq('tenant_id', tenantId).single()
    expect(data).toEqual({ kind: 'booking', number })
  })

  test('AC: verfallene Option belegt nichts, ist ohne Filter ausgeblendet und lässt sich bei freiem Zeitraum bestätigen', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const { top1 } = await withApartments(tenantId)
    const guest = await addGuest(tenantId, { last_name: 'Huber', first_name: 'Anna' })
    const option = await addBooking(tenantId, top1, { kind: 'option', guestId: guest, arrival: FUTURE, departure: day(3, FUTURE), optionUntil: day(-1) })

    await openList(page, `?monat=${month(FUTURE)}`)
    await expect(page.getByRole('heading', { name: 'Keine Einträge gefunden' })).toBeVisible()
    await openList(page, `?monat=${month(FUTURE)}&zustand=verfallen`)
    await expect(page.getByRole('table').getByText('verfallen')).toBeVisible()

    await openBooking(page, option.id)
    await expect(page.getByText(/Die Option ist am .* verfallen/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Bearbeiten', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Notiz bearbeiten' })).toBeVisible()
    await page.getByRole('button', { name: 'Option bestätigen' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Bestätigen' }).click()
    await expect(page.getByText('Option bestätigt.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Bearbeiten', exact: true })).toBeVisible()
  })

  test('AC: Inhaber storniert mit Grund und Gebühr; Buchung bleibt sichtbar, Zeitraum frei, nur Notiz und Gebühr änderbar', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const { top1 } = await withApartments(tenantId)
    const guest = await addGuest(tenantId, { last_name: 'Huber', first_name: 'Anna' })
    const booking = await addBooking(tenantId, top1, { guestId: guest, arrival: FUTURE, departure: day(3, FUTURE) })
    await openBooking(page, booking.id)
    await page.getByRole('button', { name: 'Stornieren' }).click()
    const dialog = page.getByRole('dialog', { name: `Buchung ${booking.number} stornieren?` })
    await expect(dialog).toBeVisible()
    await dialog.getByLabel('Grund (optional)').fill('Krankheit')
    await dialog.getByLabel('Stornogebühr in € (optional)').fill('90')
    await dialog.getByRole('button', { name: 'Stornieren' }).click()

    await expect(page.getByText(/Storniert am .* von Olga Owner\./)).toBeVisible()
    await expect(page.getByText('Krankheit')).toBeVisible()
    await expect(page.getByText('Stornogebühr')).toBeVisible()
    await expect(page.getByText(money('90,00'))).toBeVisible()
    await expect(page.getByRole('button', { name: 'Bearbeiten', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Stornieren' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Notiz bearbeiten' }).click()
    await expect(panel(page).getByLabel('Stornogebühr in € (optional)')).toHaveValue('90')

    // Zeitraum ist wieder frei; ohne Filter ausgeblendet, mit Filter „storniert“ sichtbar
    await openList(page, `?monat=${month(FUTURE)}`)
    await expect(page.getByRole('heading', { name: 'Keine Einträge gefunden' })).toBeVisible()
    await openList(page, `?monat=${month(FUTURE)}&zustand=storniert`)
    await expect(page.getByRole('table').getByText('storniert')).toBeVisible()
  })
})

test.describe('Bearbeiten und Mitreisende', () => {
  test('AC: Mitreisende bis Personen minus 1; Pflichtangaben; Personenzahl nicht unter Hauptgast + Mitreisende', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users, 'staff')
    const { top1 } = await withApartments(tenantId)
    const guest = await addGuest(tenantId, { last_name: 'Huber', first_name: 'Anna' })
    const booking = await addBooking(tenantId, top1, { guestId: guest, arrival: FUTURE, departure: day(3, FUTURE), adults: 2, childAges: [5] })
    await openBooking(page, booking.id)
    await page.getByRole('button', { name: 'Mitreisende bearbeiten' }).click()
    await expect(panel(page).getByText('Höchstens 2 Personen neben dem Hauptgast.')).toBeVisible()
    await panel(page).getByRole('button', { name: 'Person hinzufügen' }).click()
    await panel(page).getByRole('button', { name: 'Person hinzufügen' }).click()
    await expect(panel(page).getByRole('button', { name: 'Person hinzufügen' })).toHaveCount(0)

    const first = panel(page).getByLabel('Vorname')
    const last = panel(page).getByLabel('Nachname')
    await first.nth(0).fill('Max')
    await last.nth(1).fill('')
    await panel(page).getByLabel('Geburtsdatum').nth(1).fill(day(30))
    await submit(page, 'Mitreisende speichern')
    await expect(panel(page).getByText('Bitte den Vornamen eingeben.')).toBeVisible()
    await expect(panel(page).getByText('Bitte den Nachnamen eingeben.')).toBeVisible()
    await expect(panel(page).getByText('Das Geburtsdatum darf nicht in der Zukunft liegen.')).toBeVisible()

    await first.nth(1).fill('Lena')
    await last.nth(0).fill('Huber')
    await last.nth(1).fill('Huber')
    await panel(page).getByLabel('Geburtsdatum').nth(1).fill('2021-05-01')
    await submit(page, 'Mitreisende speichern')
    await expect(page.getByText('Mitreisende gespeichert.')).toBeVisible()
    await expect(page.getByText('Huber, Max')).toBeVisible()
    await expect(page.getByText('Huber, Lena')).toBeVisible()

    // Personenzahl senken, obwohl beide Mitreisende erfasst sind
    await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click()
    await panel(page).getByRole('button', { name: 'Kind 1 entfernen' }).click()
    await submit(page, 'Änderungen speichern')
    await expect(panel(page).getByText(/Es sind mehr Mitreisende erfasst/)).toBeVisible()
  })

  test('AC: Änderungen anderer werden nicht überschrieben; Mitarbeiter-Änderung am Zeitraum zeigt dem Inhaber „Preis prüfen“', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, owner } = await setup(page, users, 'staff')
    const { top1 } = await withApartments(tenantId)
    const guest = await addGuest(tenantId, { last_name: 'Huber', first_name: 'Anna' })
    const booking = await addBooking(tenantId, top1, { guestId: guest, arrival: FUTURE, departure: day(3, FUTURE), nightsCents: 33300 })
    await openBooking(page, booking.id)
    await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click()
    await expect(panel(page).getByLabel('Abreise', { exact: true })).toHaveValue(day(3, FUTURE))

    // jemand anderer speichert inzwischen
    await service().from('bookings').update({ note: 'Von anderer Person geändert' }).eq('id', booking.id)
    await panel(page).getByLabel('Abreise geplant').fill(day(5, FUTURE))
    await submit(page, 'Änderungen speichern')
    await expect(panel(page).getByText(/wurde inzwischen von jemand anderem geändert/)).toBeVisible()
    await expect(panel(page).getByLabel('Abreise', { exact: true })).toHaveValue(day(5, FUTURE))
    await panel(page).getByRole('button', { name: 'Aktuelle Fassung laden' }).click()
    await page.keyboard.press('Escape')

    await openBooking(page, booking.id)
    await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click()
    await panel(page).getByLabel('Abreise geplant').fill(day(5, FUTURE))
    await submit(page, 'Änderungen speichern')
    await expect(page.getByText('Änderungen gespeichert.')).toBeVisible()
    const { data } = await service().from('booking_amounts').select('nights_cents').eq('id', booking.id).single()
    expect(data?.nights_cents).toBe(33300)

    await page.context().clearCookies()
    await signInAs(page, owner)
    await openBooking(page, booking.id)
    await expect(page.getByText('Ein Mitarbeiter hat die Buchung angelegt oder Zeitraum, Wohnung bzw. Personen geändert. Bitte den Preis prüfen.')).toBeVisible()
    await openList(page, `?monat=${month(FUTURE)}`)
    await expect(page.getByRole('table').getByText('Preis prüfen')).toBeVisible()
  })
})

test.describe('Bearbeiten ohne Uhrzeiten', () => {
  test('BUG-2 (behoben): Buchung ohne Check-in/-out-Zeit lässt sich speichern', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const { top1 } = await withApartments(tenantId)
    const guest = await addGuest(tenantId, { last_name: 'Huber', first_name: 'Anna' })
    const booking = await addBooking(tenantId, top1, { guestId: guest, arrival: FUTURE, departure: day(3, FUTURE) })
    await service().from('bookings').update({ check_in: null, check_out: null } as never).eq('id', booking.id)
    await openBooking(page, booking.id)
    await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click()
    await panel(page).getByLabel('Notiz').fill('Spätanreise')
    await submit(page, 'Änderungen speichern')
    await expect(page.getByText('Änderungen gespeichert.')).toBeVisible({ timeout: 3000 })
  })
})

test.describe('Liste', () => {
  test('AC: Monatsliste sortiert mit Betrag (Inhaber), Blättern und „Heute“, Filter, Suche über alle Monate', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const { top1, top2 } = await withApartments(tenantId)
    const huber = await addGuest(tenantId, { last_name: 'Huber', first_name: 'Anna' })
    const müller = await addGuest(tenantId, { last_name: 'Müller', first_name: 'René' })
    const later = await addBooking(tenantId, top1, { guestId: huber, arrival: day(10, FUTURE), departure: day(12, FUTURE), nightsCents: 24000 })
    await addBooking(tenantId, top2, { guestId: müller, arrival: day(2, FUTURE), departure: day(4, FUTURE), adults: 1 })
    await addBooking(tenantId, top2, { kind: 'block', arrival: day(20, FUTURE), departure: day(22, FUTURE), reason: 'renovation' })
    const thisMonth = await addBooking(tenantId, top1, { guestId: müller, arrival: TODAY, departure: day(1) })

    await openList(page, `?monat=${month(FUTURE)}`)
    await expect(page.getByText('3 Einträge in diesem Monat')).toBeVisible()
    const rows = page.getByRole('table').getByRole('row')
    await expect(rows.nth(1)).toContainText('Müller, René')
    await expect(rows.nth(2)).toContainText('Huber, Anna')
    await expect(rows.nth(2)).toContainText(later.number!)
    await expect(rows.nth(2)).toContainText(money('240'))
    await expect(rows.nth(3)).toContainText('Renovierung')

    await openList(page, `?monat=${month(FUTURE)}&art=sperre`)
    await expect(page.getByText('1 Eintrag in diesem Monat')).toBeVisible()
    await openList(page, `?monat=${month(FUTURE)}&wohnung=${top1}`)
    await expect(page.getByText('1 Eintrag in diesem Monat')).toBeVisible()

    await openList(page, `?monat=${month(FUTURE)}`)
    await page.getByRole('link', { name: 'Vorheriger Monat' }).click()
    await expect(page).toHaveURL(new RegExp(`monat=${month(day(-1, FUTURE))}`))
    await page.getByRole('link', { name: 'Heute' }).click()
    await expect(page).toHaveURL(/\/buchungen$/)
    await expect(page.getByRole('table').getByText(thisMonth.number!)).toBeVisible()

    await page.getByRole('searchbox', { name: 'Buchungen durchsuchen' }).fill('rene mul')
    await expect(page.getByText('2 Treffer in allen Monaten')).toBeVisible()
    await page.getByRole('searchbox', { name: 'Buchungen durchsuchen' }).fill(later.number!)
    await expect(page.getByText('1 Treffer in allen Monaten')).toBeVisible()
    await expect(page.getByRole('table').getByText('Huber, Anna')).toBeVisible()
  })
})

test.describe('Anschluss an Gäste und Wohnungen', () => {
  test('AC: Gast-Detail zeigt Aufenthalte und Buchungen; Löschen anonymisiert und entfernt Mitreisende; Sortierung nach letztem Aufenthalt', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const { top1 } = await withApartments(tenantId)
    const huber = await addGuest(tenantId, { last_name: 'Huber', first_name: 'Anna' })
    const adam = await addGuest(tenantId, { last_name: 'Adam', first_name: 'Eva' })
    await addBooking(tenantId, top1, { guestId: adam, arrival: day(-200), departure: day(-197) })
    const past = await addBooking(tenantId, top1, { guestId: huber, arrival: day(-30), departure: day(-27) })
    await addBooking(tenantId, top1, { guestId: huber, arrival: FUTURE, departure: day(3, FUTURE) })
    await addBooking(tenantId, top1, { guestId: huber, arrival: day(-60), departure: day(-58), cancelled: true })
    await service().from('booking_companions').insert({ tenant_id: tenantId, booking_id: past.id, position: 1, first_name: 'Max', last_name: 'Huber' } as never)

    await page.goto(`/gaeste/${huber}`)
    await ready(page)
    const stays = page.getByRole('region', { name: 'Aufenthalte' }).or(page.locator('section', { hasText: 'Aufenthalte' }).first())
    await expect(stays.getByText('2', { exact: true }).first()).toBeVisible()
    await expect(page.getByRole('table').getByRole('row')).toHaveCount(4)
    await expect(page.getByRole('table').getByText('storniert')).toBeVisible()

    await page.goto('/gaeste?sortierung=aufenthalt')
    await ready(page)
    await expect(page.getByRole('table').getByRole('link')).toHaveText(['Huber, Anna', 'Adam, Eva'])

    await page.goto(`/gaeste/${huber}`)
    await ready(page)
    await page.getByRole('button', { name: 'Gast löschen' }).click()
    await page.getByRole('alertdialog').getByRole('button').last().click()
    await expect(page.getByRole('heading', { name: 'Gelöschter Gast' })).toBeVisible()
    await openBooking(page, past.id)
    await expect(page.getByRole('heading', { name: 'Gelöschter Gast' })).toBeVisible()
    await expect(page.getByText('Huber, Max')).toHaveCount(0)
    await expect(page.getByText('2 Erwachsene')).toBeVisible()
  })

  test('AC: Wohnung mit Buchungen ohne „Endgültig löschen“; Archivieren nennt künftige Buchungen; Hinweis bei kleinerer Personenzahl', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const { top1 } = await withApartments(tenantId)
    const guest = await addGuest(tenantId, { last_name: 'Huber', first_name: 'Anna' })
    await addBooking(tenantId, top1, { guestId: guest, arrival: FUTURE, departure: day(3, FUTURE), adults: 4 })
    await page.goto('/einstellungen/wohnungen')
    await ready(page)
    await page.getByRole('button', { name: /Top 1/ }).first().click()
    await expect(panel(page).getByText(/hat Buchungen und lässt sich nicht endgültig löschen/)).toBeVisible()
    await expect(panel(page).getByRole('button', { name: 'Endgültig löschen' })).toHaveCount(0)
    await expect(panel(page).getByLabel('Reinigungsgebühr (€)')).toHaveValue('60')
    await panel(page).getByLabel(/Personen/).first().fill('2')
    await expect(panel(page).getByText('1 künftige Buchung hat mehr Personen. Sie bleiben bestehen.')).toBeVisible()
    await panel(page).getByRole('button', { name: 'Archivieren' }).click()
    await expect(page.getByRole('alertdialog').getByText('1 künftige Buchung bleibt bestehen.')).toBeVisible()
  })
})

test.describe('Safari-Zeilenklick', () => {
  test('Nur der Name ist der Link (keine Klickfläche über die Zeile); jeder Name öffnet seine eigene Buchung', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const { top1 } = await withApartments(tenantId)
    const first = await addBooking(tenantId, top1, { guestId: await addGuest(tenantId, { last_name: 'Erste', first_name: 'Eva' }), arrival: FUTURE, departure: day(2, FUTURE) })
    await addBooking(tenantId, top1, { guestId: await addGuest(tenantId, { last_name: 'Letzte', first_name: 'Lea' }), arrival: day(3, FUTURE), departure: day(5, FUTURE) })
    await openList(page, `?monat=${month(FUTURE)}`)
    const link = page.getByRole('table').getByRole('link', { name: 'Erste, Eva' })
    // Safari verankert after:absolute nicht an <tr>: die Fläche darf es nicht mehr geben
    const overlay = await link.evaluate((el) => getComputedStyle(el, '::after').position)
    expect(overlay).not.toBe('absolute')
    await link.click()
    await expect(page).toHaveURL(new RegExp(`/buchungen/${first.id}$`))
  })
})

test.describe('Layout und Barrierefreiheit', () => {
  test('Liste, Detail und Panel: keine automatisch erkennbaren WCAG-2.1-AA-Verstöße, kein seitliches Scrollen, Karten auf dem Handy', async ({ page, users }) => {
    const { tenantId } = await setup(page, users)
    const { top1 } = await withApartments(tenantId)
    const guest = await addGuest(tenantId, { last_name: 'Huber-Oberleitner', first_name: 'Anna-Katharina' })
    const booking = await addBooking(tenantId, top1, { guestId: guest, arrival: TODAY, departure: day(3), childAges: [4], note: 'Spät' })
    await addBooking(tenantId, top1, { kind: 'option', guestId: guest, arrival: day(1), departure: day(2), optionUntil: day(5) })
    const scan = async (label: string) => {
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      expect(results.violations, label).toEqual([])
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, label).toBeLessThanOrEqual(0)
    }
    await openList(page)
    await expect(page.getByText(booking.number!).filter({ visible: true }).first()).toBeVisible()
    await scan('Liste')
    if (test.info().project.name === 'mobile') await expect(page.getByRole('table')).toBeHidden()
    await openBooking(page, booking.id)
    await scan('Detail')
    await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click()
    await expect(panel(page)).toBeVisible()
    await page.waitForTimeout(800) // Warnungs-Vorschau
    await scan('Panel')
  })
})
