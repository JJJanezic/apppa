import { expect, type Page, test as base } from '@playwright/test'

import { re } from './support/format'
import { createTenant, createUser, deleteUser, type E2EUser, hasSupabaseEnv, service, signInAs } from './support/supabase'

// PROJ-32: Negative Beträge bei Zusatzkosten. Abläufe im Projekt „desktop“, Handy-Karte im Projekt „mobile“.
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
test.skip(!hasSupabaseEnv, 'Supabase-Umgebung fehlt')

type Users = (opts?: Parameters<typeof createUser>[0]) => Promise<E2EUser>
const desktopOnly = () => test.skip(!['desktop', 'safari'].includes(test.info().project.name), 'Abläufe nur im Desktop-Projekt')
const only = (name: string) => test.skip(test.info().project.name !== name, `nur im Projekt „${name}“`)
const ready = (page: Page) =>
  page.waitForFunction(() => Object.keys(document.querySelector('main') ?? {}).some((k) => k.startsWith('__reactFiber')))
const panel = (page: Page) => page.getByRole('dialog')
// „€ 310,00“ bzw. „-€ 50,00“ mit beliebigem Leerzeichen nach „€“; positive Beträge ohne vorangestelltes Minus
const money = (value: string) => new RegExp(`(^|[^-])€\\s?${re(value)}`)
const minus = (value: string) => new RegExp(`-€\\s?${re(value)}`)
const INVALID = 'Bitte einen Betrag wie 125 oder 125,50 eingeben.'

const ARRIVAL = '2026-11-10'
const DEPARTURE = '2026-11-13'

async function setup(page: Page, users: Users, role: 'owner' | 'staff' = 'owner') {
  const owner = await users({ displayName: 'Olga Owner' })
  const members: { user: E2EUser; role: 'owner' | 'staff' }[] = [{ user: owner, role: 'owner' }]
  let staff: E2EUser | undefined
  if (role === 'staff') {
    staff = await users({ displayName: 'Sam Staff' })
    members.push({ user: staff, role: 'staff' })
  }
  const tenantId = await createTenant('QA32 Testkunde', members)
  await signInAs(page, role === 'staff' ? staff! : owner)
  return { tenantId }
}

async function addApartment(tenantId: string) {
  const { data: property, error: propertyError } = await service()
    .from('properties')
    .insert({ tenant_id: tenantId, name: 'Haus See', street: 'Seeweg 12', postal_code: '5340', city: 'St. Gilgen', municipality_code: '50330' })
    .select('id')
    .single()
  if (propertyError) throw propertyError
  const { data, error } = await service()
    .from('apartments')
    .insert({ tenant_id: tenantId, property_id: property.id, name: 'Top 1', max_guests: 4, price_cents: 10000 } as never)
    .select('id')
    .single()
  if (error) throw error
  return (data as { id: string }).id
}

async function addGuest(tenantId: string) {
  const { data, error } = await service()
    .from('guests')
    .insert({ tenant_id: tenantId, country: 'AT', last_name: 'Huber', first_name: 'Anna' } as never)
    .select('id')
    .single()
  if (error) throw error
  return (data as { id: string }).id
}

let seq = 3200
type Entry = { arrival?: string; plannedDeparture?: string; departure?: string; nightsCents: number; billedCents?: number; charges?: [string, number][] }
async function addBooking(tenantId: string, apartmentId: string, guestId: string, b: Entry) {
  const arrival = b.arrival ?? ARRIVAL
  const departure = b.departure ?? DEPARTURE
  const { data, error } = await service()
    .from('bookings')
    .insert({
      tenant_id: tenantId,
      apartment_id: apartmentId,
      kind: 'booking',
      arrival,
      planned_departure: b.plannedDeparture ?? departure,
      departure,
      guest_id: guestId,
      check_in: '15:00',
      check_out: '10:00',
      adults: 2,
      number_year: Number(arrival.slice(0, 4)),
      number_seq: ++seq,
    })
    .select('id, number')
    .single()
  if (error) throw error
  const { error: amountError } = await service().from('booking_amounts').insert({ id: data.id, tenant_id: tenantId, nights_cents: b.nightsCents })
  if (amountError) throw amountError
  // Der Einfüge-Trigger setzt den abgerechneten Preis = vereinbarter Preis; Verlängerung danach setzen
  if (b.billedCents !== undefined) {
    const { error: billedError } = await service().from('booking_amounts').update({ billed_nights_cents: b.billedCents }).eq('id', data.id)
    if (billedError) throw billedError
  }
  for (const [i, [label, cents]] of (b.charges ?? []).entries()) {
    const { error: chargeError } = await service()
      .from('booking_charges')
      .insert({ booking_id: data.id, tenant_id: tenantId, label, amount_cents: cents, position: i + 1 })
    if (chargeError) throw chargeError
  }
  return data as { id: string; number: string }
}

const charges = async (bookingId: string) =>
  (await service().from('booking_charges').select('label, amount_cents').eq('booking_id', bookingId).order('position')).data

async function open(page: Page, path: string) {
  await page.goto(path)
  await ready(page)
}

async function edit(page: Page, bookingId: string) {
  await open(page, `/buchungen/${bookingId}`)
  await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click()
  await expect(panel(page)).toBeVisible()
}

const chargeAmount = (page: Page, i: number) => panel(page).getByLabel('Betrag (€)', { exact: true }).nth(i)
const chargeLabel = (page: Page, i: number) => panel(page).getByLabel('Bezeichnung', { exact: true }).nth(i)
const save = (page: Page) => panel(page).getByRole('button', { name: 'Änderungen speichern', exact: true }).click()

test.describe('Eingabe', () => {
  test('AC: Minus im Betragsfeld der Zusatzkosten wird beim Verlassen umgeschrieben („-50“ → „-50,00“, „-0“ → „0,00“)', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const booking = await addBooking(tenantId, await addApartment(tenantId), await addGuest(tenantId), { nightsCents: 30000 })
    await edit(page, booking.id)
    await panel(page).getByRole('button', { name: 'Position hinzufügen' }).click()
    const amount = chargeAmount(page, 0)
    for (const [input, expected] of [
      ['-50', '-50,00'],
      ['-1250,5', '-1.250,50'],
      ['-1.250,50', '-1.250,50'],
      ['- 5', '-5,00'],
      ['−5', '-5,00'],
      ['-0', '0,00'],
      ['-0,00', '0,00'],
    ]) {
      await amount.fill(input)
      await amount.press('Tab')
      await expect(amount).toHaveValue(expected)
    }
  })

  test('AC: „-“, „--5“, „5-“ und unter -1.000.000,00 melden den bisherigen Fehler; Eingabe bleibt, nichts gespeichert', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const booking = await addBooking(tenantId, await addApartment(tenantId), await addGuest(tenantId), { nightsCents: 30000 })
    await edit(page, booking.id)
    await panel(page).getByRole('button', { name: 'Position hinzufügen' }).click()
    await chargeLabel(page, 0).fill('Rabatt')
    const amount = chargeAmount(page, 0)
    for (const input of ['-', '--5', '5-', '-1.000.000,01']) {
      await amount.fill(input)
      await amount.press('Tab')
      await save(page)
      await expect(panel(page).getByText(INVALID)).toBeVisible()
      await expect(amount).toHaveValue(input)
    }
    // Genau -1.000.000,00 ist erlaubt
    await amount.fill('-1000000')
    await amount.press('Tab')
    await expect(amount).toHaveValue('-1.000.000,00')
    await save(page)
    await expect(panel(page)).toBeHidden()
    await expect.poll(() => charges(booking.id)).toEqual([{ label: 'Rabatt', amount_cents: -100000000 }])
  })

  test('AC: Negativer Übernachtungspreis und negative Stornogebühr werden abgelehnt', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const booking = await addBooking(tenantId, await addApartment(tenantId), await addGuest(tenantId), { nightsCents: 30000 })
    await edit(page, booking.id)
    const price = panel(page).getByLabel('Übernachtungspreis (€)')
    await price.fill('-50')
    await price.press('Tab')
    await expect(price).toHaveValue('-50')
    await save(page)
    await expect(panel(page).getByText(INVALID)).toBeVisible()
    await page.keyboard.press('Escape')
    await expect.poll(async () => (await service().from('booking_amounts').select('nights_cents').eq('id', booking.id).single()).data?.nights_cents).toBe(30000)

    await open(page, `/buchungen/${booking.id}`)
    await page.getByRole('button', { name: 'Stornieren' }).click()
    const dialog = page.getByRole('dialog', { name: `Buchung ${booking.number} stornieren?` })
    await dialog.getByLabel('Stornogebühr in € (optional)').fill('-50')
    await dialog.getByRole('button', { name: 'Stornieren' }).click()
    await expect(dialog.getByText(INVALID)).toBeVisible()
    expect((await service().from('bookings').select('cancelled_at').eq('id', booking.id).single()).data?.cancelled_at).toBeNull()
  })
})

test.describe('Speichern und Endbetrag', () => {
  test('AC: € 300,00 + Reinigung € 60,00 + Rabatt -€ 50,00 = € 310,00 in Formular, Detail und Liste; Bearbeiten zeigt „-50,00“', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const booking = await addBooking(tenantId, await addApartment(tenantId), await addGuest(tenantId), {
      nightsCents: 30000,
      charges: [['Reinigung', 6000]],
    })
    await edit(page, booking.id)
    await panel(page).getByRole('button', { name: 'Position hinzufügen' }).click()
    await chargeLabel(page, 1).fill('Rabatt')
    await chargeAmount(page, 1).fill('-50')
    await chargeAmount(page, 1).press('Tab')
    await expect(panel(page).getByText(money('310,00'))).toBeVisible()
    await save(page)
    await expect(panel(page)).toBeHidden()
    await expect.poll(() => charges(booking.id)).toEqual([
      { label: 'Reinigung', amount_cents: 6000 },
      { label: 'Rabatt', amount_cents: -5000 },
    ])

    await open(page, `/buchungen/${booking.id}`)
    const discount = page.getByText(minus('50,00'))
    await expect(discount).toBeVisible()
    await expect(discount).toHaveClass(/text-destructive/)
    const total = page.getByText(money('310,00'))
    await expect(total).toBeVisible()
    await expect(total).not.toHaveClass(/text-destructive/)

    await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click()
    await expect(chargeAmount(page, 1)).toHaveValue('-50,00')
    // Rot nur in Anzeigen, nicht im Eingabefeld
    await expect(chargeAmount(page, 1)).not.toHaveClass(/text-destructive/)
  })

  test('AC: Gutschrift höher als der Rest → Endbetrag -€ 50,00 in Rot in Detail, Liste und Formular-Summe', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const booking = await addBooking(tenantId, await addApartment(tenantId), await addGuest(tenantId), {
      nightsCents: 10000,
      charges: [['Gutschrift', -15000]],
    })

    await open(page, `/buchungen/${booking.id}`)
    const total = page.getByText(minus('50,00'))
    await expect(total).toBeVisible()
    await expect(total).toHaveClass(/text-destructive/)
    await expect(page.getByText(minus('150,00'))).toHaveClass(/text-destructive/)
    await expect(page.getByText(money('100,00'))).not.toHaveClass(/text-destructive/)

    await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click()
    await expect(chargeAmount(page, 0)).toHaveValue('-150,00')
    const formTotal = panel(page).getByText(minus('50,00'))
    await expect(formTotal).toBeVisible()
    await expect(formTotal).toHaveClass(/text-destructive/)
    // Speichern ohne Warnung
    await save(page)
    await expect(panel(page)).toBeHidden()

    await open(page, '/buchungen?monat=2026-11')
    const cell = page.getByRole('table').getByText(minus('50,00'))
    await expect(cell).toBeVisible()
    await expect(cell).toHaveClass(/text-destructive/)
  })

  test('AC: Endbetrag genau 0 und nur negative Positionen ohne Übernachtungspreis', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId)
    const zero = await addBooking(tenantId, apt, guest, { nightsCents: 5000, charges: [['Rabatt', -5000]] })
    const onlyNegative = await addBooking(tenantId, apt, guest, {
      arrival: '2026-11-20',
      departure: '2026-11-22',
      nightsCents: 0,
      charges: [['Gutschrift', -2500]],
    })

    await open(page, `/buchungen/${zero.id}`)
    const totalZero = page.getByText(money('0,00'))
    await expect(totalZero).toBeVisible()
    await expect(totalZero).not.toHaveClass(/text-destructive/)
    await expect(page.getByText(minus('0,00'))).toHaveCount(0)

    await open(page, `/buchungen/${onlyNegative.id}`)
    await expect(page.getByText(minus('25,00')).first()).toHaveClass(/text-destructive/)
  })

  test('AC: Verlängerung (PROJ-30): nur der Übernachtungspreis wird anteilig, negative Position bleibt', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    // 3 Nächte vereinbart (€ 300,00), tatsächlich 4 Nächte → abgerechnet € 400,00; Rabatt -€ 50,00 → € 350,00
    const booking = await addBooking(tenantId, await addApartment(tenantId), await addGuest(tenantId), {
      plannedDeparture: DEPARTURE,
      departure: '2026-11-14',
      nightsCents: 30000,
      billedCents: 40000,
      charges: [['Rabatt', -5000]],
    })
    await open(page, `/buchungen/${booking.id}`)
    await expect(page.getByText(money('400,00')).first()).toBeVisible()
    await expect(page.getByText(minus('50,00'))).toBeVisible()
    await expect(page.getByText(money('350,00'))).toBeVisible()
  })

  test('AC: Mitarbeiter speichert eine Buchung mit negativer Position; alle Positionen bleiben unverändert', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users, 'staff')
    const booking = await addBooking(tenantId, await addApartment(tenantId), await addGuest(tenantId), {
      nightsCents: 30000,
      charges: [['Reinigung', 6000], ['Rabatt', -5000]],
    })
    await open(page, `/buchungen/${booking.id}`)
    // Mitarbeiter sehen keine Beträge
    await expect(page.getByText(minus('50,00'))).toHaveCount(0)
    await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click()
    await expect(panel(page).getByLabel('Betrag (€)', { exact: true })).toHaveCount(0)
    await panel(page).getByLabel('Notiz', { exact: true }).fill('Mitarbeiter-Änderung')
    await save(page)
    await expect(panel(page)).toBeHidden()
    await expect.poll(async () => (await service().from('bookings').select('note').eq('id', booking.id).single()).data?.note).toBe('Mitarbeiter-Änderung')
    expect(await charges(booking.id)).toEqual([
      { label: 'Reinigung', amount_cents: 6000 },
      { label: 'Rabatt', amount_cents: -5000 },
    ])
  })
})

test.describe('Anzeige', () => {
  test('AC: Handy-Karte der Buchungsliste zeigt den negativen Endbetrag in Rot, ohne seitliches Scrollen', async ({ page, users }) => {
    only('mobile')
    const { tenantId } = await setup(page, users)
    await addBooking(tenantId, await addApartment(tenantId), await addGuest(tenantId), { nightsCents: 10000, charges: [['Gutschrift', -15000]] })
    await open(page, '/buchungen?monat=2026-11')
    const amount = page.getByRole('listitem').getByText(minus('50,00'))
    await expect(amount).toBeVisible()
    await expect(amount).toHaveClass(/text-destructive/)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
  })
})

test.describe('Vorschläge', () => {
  // PROJ-35: Die Auswahl enthält nur noch „Reinigung“ und „Nächtigungsabgabe“; „Rabatt“ wird frei eingetippt
  test('AC: Auswahl enthält „Nächtigungsabgabe“ (PROJ-35: ohne „Rabatt“); der Betrag bleibt leer', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const booking = await addBooking(tenantId, await addApartment(tenantId), await addGuest(tenantId), { nightsCents: 30000 })
    await edit(page, booking.id)
    await panel(page).getByRole('button', { name: 'Position hinzufügen' }).click()
    await chargeLabel(page, 0).click()
    await expect(panel(page).getByRole('option')).toHaveText(['Reinigung', 'Nächtigungsabgabe'])
    await chargeLabel(page, 0).fill('Nächtigungsabgabe')
    await expect(chargeAmount(page, 0)).toHaveValue('')
    await save(page)
    await expect(panel(page).getByText('Bitte einen Betrag eingeben.')).toBeVisible()
  })
})
