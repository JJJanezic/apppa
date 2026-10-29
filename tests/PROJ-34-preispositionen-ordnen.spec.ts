import { expect, type Locator, type Page, test as base } from '@playwright/test'

import { createTenant, createUser, deleteUser, type E2EUser, hasSupabaseEnv, service, signInAs } from './support/supabase'

// PROJ-34: Preispositionen ordnen. Abläufe im Projekt „desktop“, Touch und 375 px im Projekt „mobile“.
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
const desktopOnly = () => test.skip(!['desktop', 'safari', 'firefox'].includes(test.info().project.name), 'Abläufe nur im Desktop-Projekt')
const ready = (page: Page) =>
  page.waitForFunction(() => Object.keys(document.querySelector('main') ?? {}).some((k) => k.startsWith('__reactFiber')))
const panel = (page: Page) => page.getByRole('dialog')

const THREE: [string, number][] = [
  ['Reinigung', 6000],
  ['Endreinigung Haustier', 3000],
  ['Rabatt', -5000],
]

async function setup(page: Page, users: Users, role: 'owner' | 'staff' = 'owner') {
  const owner = await users({ displayName: 'Olga Owner' })
  const members: { user: E2EUser; role: 'owner' | 'staff' }[] = [{ user: owner, role: 'owner' }]
  let staff: E2EUser | undefined
  if (role === 'staff') {
    staff = await users({ displayName: 'Sam Staff' })
    members.push({ user: staff, role: 'staff' })
  }
  const tenantId = await createTenant('QA34 Testkunde', members)
  await signInAs(page, role === 'staff' ? staff! : owner)
  return { tenantId }
}

let seq = 3400
async function addBooking(tenantId: string, charges: [string, number][]) {
  const { data: property, error: propertyError } = await service()
    .from('properties')
    .insert({ tenant_id: tenantId, name: 'Haus See', street: 'Seeweg 12', postal_code: '5340', city: 'St. Gilgen', municipality_code: '50330' })
    .select('id')
    .single()
  if (propertyError) throw propertyError
  const { data: apartment, error: apartmentError } = await service()
    .from('apartments')
    .insert({ tenant_id: tenantId, property_id: property.id, name: 'Top 1', max_guests: 4, price_cents: 10000 } as never)
    .select('id')
    .single()
  if (apartmentError) throw apartmentError
  const { data: guest, error: guestError } = await service()
    .from('guests')
    .insert({ tenant_id: tenantId, country: 'AT', last_name: 'Huber', first_name: 'Anna' } as never)
    .select('id')
    .single()
  if (guestError) throw guestError
  const { data, error } = await service()
    .from('bookings')
    .insert({
      tenant_id: tenantId,
      apartment_id: (apartment as { id: string }).id,
      kind: 'booking',
      arrival: '2026-11-10',
      planned_departure: '2026-11-13',
      departure: '2026-11-13',
      guest_id: (guest as { id: string }).id,
      check_in: '15:00',
      check_out: '10:00',
      adults: 2,
      number_year: 2026,
      number_seq: ++seq,
    })
    .select('id')
    .single()
  if (error) throw error
  const { error: amountError } = await service().from('booking_amounts').insert({ id: data.id, tenant_id: tenantId, nights_cents: 30000 })
  if (amountError) throw amountError
  for (const [i, [label, cents]] of charges.entries()) {
    const { error: chargeError } = await service()
      .from('booking_charges')
      .insert({ booking_id: data.id, tenant_id: tenantId, label, amount_cents: cents, position: i + 1 })
    if (chargeError) throw chargeError
  }
  return data.id as string
}

const stored = async (bookingId: string) =>
  (await service().from('booking_charges').select('position, label').eq('booking_id', bookingId).order('position')).data

async function edit(page: Page, bookingId: string) {
  await page.goto(`/buchungen/${bookingId}`)
  await ready(page)
  await openPanel(page)
}

// Panel öffnen und warten, bis es fertig hereingefahren ist (sonst greift die Maus neben den Griff)
async function openPanel(page: Page) {
  await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click()
  await expect(panel(page)).toBeVisible()
  await panel(page).evaluate((e) => Promise.all(e.getAnimations().map((a) => a.finished)))
}

const labels = (page: Page) => panel(page).getByLabel('Bezeichnung', { exact: true })
const handle = (page: Page, label: string) => panel(page).getByRole('button', { name: `${label} verschieben`, exact: true })
const handles = (page: Page) => panel(page).getByRole('button', { name: / verschieben$/ })
const save = (page: Page) => panel(page).getByRole('button', { name: 'Änderungen speichern', exact: true }).click()
const liveRegion = (page: Page) => page.locator('[id^="DndLiveRegion"]')

// Nach dem Aufnehmen vermisst dnd-kit die Positionen erst im nächsten Bildaufbau; bei zweizeiligen Positionen
// (PROJ-35) kam ein sofortiger Pfeiltastendruck sonst zu früh
const settled = (page: Page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))))

async function expectOrder(page: Page, order: string[]) {
  await expect.poll(async () => labels(page).evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value))).toEqual(order)
}

// Reihenfolge der Positionen im Buchungs-Detail (Textreihenfolge im Preisbereich)
async function detailOrder(page: Page, names: string[]) {
  const text = (await page.locator('main').innerText()).replace(/\s+/g, ' ')
  return [...names].sort((a, b) => text.indexOf(` ${a} `) - text.indexOf(` ${b} `))
}

async function mouseDrag(page: Page, from: Locator, to: Locator) {
  // Die Positionen liegen im Panel oft unterhalb des sichtbaren Bereichs
  await to.scrollIntoViewIfNeeded()
  await from.scrollIntoViewIfNeeded()
  const a = (await from.boundingBox())!
  const b = (await to.boundingBox())!
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
  await page.mouse.down()
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2 - 10, { steps: 4 })
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 12 })
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2 - 4, { steps: 4 })
  await page.mouse.up()
  // @dnd-kit verschluckt Klicks in den ersten 50 ms nach dem Ablegen (Schutz vor Klick am Ende des Ziehens)
  await page.waitForTimeout(100)
}

test.describe('Darstellung', () => {
  test('AC: Griff ab zwei Zusatzpositionen; Übernachtung ohne Griff; neue Position unten', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const booking = await addBooking(tenantId, [['Reinigung', 6000]])
    await edit(page, booking)
    await expect(handles(page)).toHaveCount(0)

    await panel(page).getByRole('button', { name: 'Position hinzufügen' }).click()
    await labels(page).nth(1).fill('Rabatt')
    await expectOrder(page, ['Reinigung', 'Rabatt'])
    await expect(handles(page)).toHaveCount(2)
    await expect(handle(page, 'Reinigung')).toBeVisible()
    await expect(handle(page, 'Rabatt')).toBeVisible()

    // Übernachtungspreis steht über den Positionen
    const price = (await panel(page).getByLabel('Übernachtungspreis (€)').boundingBox())!
    const first = (await handle(page, 'Reinigung').boundingBox())!
    expect(price.y).toBeLessThan(first.y)

    // Leere Bezeichnung: Griff heißt nach der Stelle
    await panel(page).getByRole('button', { name: 'Position hinzufügen' }).click()
    await expect(handle(page, 'Position 3')).toBeVisible()
  })
})

test.describe('Maus', () => {
  test('AC: „Rabatt“ über „Reinigung“ ziehen ordnet um; Speichern übernimmt die Reihenfolge in Detail und Bearbeiten; Endbetrag unverändert', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const booking = await addBooking(tenantId, THREE)
    await edit(page, booking)
    const total = await panel(page).getByText('Endbetrag').locator('..').innerText()

    await mouseDrag(page, handle(page, 'Rabatt'), handle(page, 'Reinigung'))
    await expectOrder(page, ['Rabatt', 'Reinigung', 'Endreinigung Haustier'])
    expect(await panel(page).getByText('Endbetrag').locator('..').innerText()).toBe(total)

    await save(page)
    await expect(panel(page)).toBeHidden()
    await expect.poll(() => stored(booking)).toEqual([
      { position: 1, label: 'Rabatt' },
      { position: 2, label: 'Reinigung' },
      { position: 3, label: 'Endreinigung Haustier' },
    ])
    await page.reload()
    await ready(page)
    expect(await detailOrder(page, ['Übernachtung', 'Rabatt', 'Reinigung', 'Endreinigung Haustier'])).toEqual([
      'Übernachtung',
      'Rabatt',
      'Reinigung',
      'Endreinigung Haustier',
    ])

    await openPanel(page)
    await expectOrder(page, ['Rabatt', 'Reinigung', 'Endreinigung Haustier'])
  })

  test('AC: Ganz nach oben gezogen landet die Position unter der Übernachtung', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const booking = await addBooking(tenantId, THREE)
    await edit(page, booking)
    await mouseDrag(page, handle(page, 'Endreinigung Haustier'), panel(page).getByLabel('Übernachtungspreis (€)'))
    await expectOrder(page, ['Endreinigung Haustier', 'Reinigung', 'Rabatt'])
    const price = (await panel(page).getByLabel('Übernachtungspreis (€)').boundingBox())!
    const first = (await labels(page).first().boundingBox())!
    expect(price.y).toBeLessThan(first.y)
  })

  test('AC: Schließen ohne Speichern verwirft die neue Reihenfolge', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const booking = await addBooking(tenantId, THREE)
    await edit(page, booking)
    await mouseDrag(page, handle(page, 'Rabatt'), handle(page, 'Reinigung'))
    await expectOrder(page, ['Rabatt', 'Reinigung', 'Endreinigung Haustier'])
    await page.keyboard.press('Escape')
    await expect(panel(page)).toBeHidden()
    await openPanel(page)
    await expectOrder(page, ['Reinigung', 'Endreinigung Haustier', 'Rabatt'])
    expect(await stored(booking)).toEqual([
      { position: 1, label: 'Reinigung' },
      { position: 2, label: 'Endreinigung Haustier' },
      { position: 3, label: 'Rabatt' },
    ])
  })
})

test.describe('Tastatur', () => {
  test('AC: Leertaste, Pfeil nach oben, Leertaste verschiebt; Ansage „Position 1 von 3“; Fokusrahmen am Griff', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const booking = await addBooking(tenantId, THREE)
    await edit(page, booking)

    // Mit Tab erreichbar: der Griff steht in der Tab-Reihenfolge direkt vor der Bezeichnung
    await labels(page).nth(2).focus()
    await page.keyboard.press('Shift+Tab')
    const rabatt = handle(page, 'Rabatt')
    await expect(rabatt).toBeFocused()
    expect(await rabatt.evaluate((e) => getComputedStyle(e).boxShadow)).not.toBe('none')

    await page.keyboard.press('Space')
    await expect(liveRegion(page)).toContainText('Rabatt aufgenommen, Position 3 von 3.')
    await settled(page)
    await page.keyboard.press('ArrowUp')
    await expect(liveRegion(page)).toContainText('Rabatt auf Position 2 von 3.')
    await page.keyboard.press('ArrowUp')
    await expect(liveRegion(page)).toContainText('Rabatt auf Position 1 von 3.')
    await page.keyboard.press('Space')
    await expect(liveRegion(page)).toContainText('Rabatt abgelegt auf Position 1 von 3.')
    await expectOrder(page, ['Rabatt', 'Reinigung', 'Endreinigung Haustier'])
    await expect(handle(page, 'Rabatt')).toBeFocused()
  })

  test('AC: Escape bricht das Verschieben ab, Position kehrt zurück, Panel bleibt offen', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const booking = await addBooking(tenantId, THREE)
    await edit(page, booking)
    await handle(page, 'Reinigung').focus()
    await page.keyboard.press('Space')
    await expect(liveRegion(page)).toContainText('Reinigung aufgenommen, Position 1 von 3.')
    await settled(page)
    await page.keyboard.press('ArrowDown')
    await expect(liveRegion(page)).toContainText('Reinigung auf Position 2 von 3.')
    await page.keyboard.press('Escape')
    await expect(liveRegion(page)).toContainText('Verschieben abgebrochen. Reinigung bleibt auf Position 1 von 3.')
    await expect(panel(page)).toBeVisible()
    await expectOrder(page, ['Reinigung', 'Endreinigung Haustier', 'Rabatt'])
    // Danach schließt Escape das Panel wie gewohnt
    await page.keyboard.press('Escape')
    await expect(panel(page)).toBeHidden()
  })
})

test.describe('Speichern und Rollen', () => {
  test('AC: Fehlermeldung wandert mit der Position; gelöschte mittlere Position hinterlässt keine Lücke', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const booking = await addBooking(tenantId, THREE)
    await edit(page, booking)
    await labels(page).nth(1).fill('')
    await save(page)
    const message = panel(page).getByText('Bitte eine Bezeichnung eingeben.')
    await expect(message).toBeVisible()
    const before = (await message.boundingBox())!.y

    await mouseDrag(page, handle(page, 'Position 2'), handle(page, 'Reinigung'))
    await expectOrder(page, ['', 'Reinigung', 'Rabatt'])
    await expect(message).toBeVisible()
    expect((await message.boundingBox())!.y).toBeLessThan(before)

    // Leere Position löschen (jetzt an erster Stelle) und Mitte einer neuen Dreierliste löschen
    await panel(page).getByRole('button', { name: 'Position 1 entfernen' }).click()
    await expectOrder(page, ['Reinigung', 'Rabatt'])
    await save(page)
    await expect(panel(page)).toBeHidden()
    await expect.poll(() => stored(booking)).toEqual([
      { position: 1, label: 'Reinigung' },
      { position: 2, label: 'Rabatt' },
    ])
  })

  test('AC: Mitarbeiter speichert, Reihenfolge bleibt unverändert', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users, 'staff')
    const order: [string, number][] = [THREE[2], THREE[0], THREE[1]]
    const booking = await addBooking(tenantId, order)
    await edit(page, booking)
    await expect(handles(page)).toHaveCount(0)
    await panel(page).getByLabel('Notiz').fill('Später Check-in')
    await save(page)
    await expect(panel(page)).toBeHidden()
    expect(await stored(booking)).toEqual([
      { position: 1, label: 'Rabatt' },
      { position: 2, label: 'Reinigung' },
      { position: 3, label: 'Endreinigung Haustier' },
    ])
  })
})

test.describe('Handy', () => {
  test('AC: 375 px (Handy) bzw. 768 px (Tablet) ohne seitliches Scrollen, Griff 44 × 44 px, Verschieben mit dem Finger', async ({ page, users }) => {
    test.skip(!['mobile', 'tablet'].includes(test.info().project.name), 'nur Handy und Tablet')
    const { tenantId } = await setup(page, users)
    const booking = await addBooking(tenantId, THREE)
    await edit(page, booking)

    const grip = handle(page, 'Rabatt')
    await grip.scrollIntoViewIfNeeded()
    const box = (await grip.boundingBox())!
    expect(box.width).toBeGreaterThanOrEqual(44)
    expect(box.height).toBeGreaterThanOrEqual(44)
    const overflow = await panel(page).evaluate((e) => e.scrollWidth - e.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)

    // Touch-Ziehen über das Chrome-Protokoll (Playwright kennt nur Tippen)
    const target = (await handle(page, 'Reinigung').boundingBox())!
    const cdp = await page.context().newCDPSession(page)
    const x = box.x + box.width / 2
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', y?: number) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: y === undefined ? [] : [{ x, y }] })
    await touch('touchStart', box.y + box.height / 2)
    const from = box.y + box.height / 2
    const to = target.y + target.height / 2 - 4
    for (let i = 1; i <= 15; i++) await touch('touchMove', from + ((to - from) * i) / 15)
    await touch('touchEnd')
    await expectOrder(page, ['Rabatt', 'Reinigung', 'Endreinigung Haustier'])
  })
})

test.describe('Randfälle (QA)', () => {
  test('Edge: Escape während des Ziehens mit der Maus bricht ab, Panel bleibt offen', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const booking = await addBooking(tenantId, THREE)
    await edit(page, booking)
    const from = handle(page, 'Rabatt')
    await handle(page, 'Reinigung').scrollIntoViewIfNeeded()
    await from.scrollIntoViewIfNeeded()
    const a = (await from.boundingBox())!
    const b = (await handle(page, 'Reinigung').boundingBox())!
    await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2)
    await page.mouse.down()
    await page.mouse.move(a.x + a.width / 2, b.y + b.height / 2, { steps: 12 })
    await page.keyboard.press('Escape')
    await page.mouse.up()
    await expect(liveRegion(page)).toContainText('Verschieben abgebrochen. Rabatt bleibt auf Position 3 von 3.')
    await expect(panel(page)).toBeVisible()
    await expectOrder(page, ['Reinigung', 'Endreinigung Haustier', 'Rabatt'])
  })

  test('Edge: 20 Positionen – letzte per Tastatur nach oben, Speichern lückenlos 1–20, kein „Position hinzufügen“', async ({ page, users }) => {
    desktopOnly()
    test.setTimeout(90_000)
    const { tenantId } = await setup(page, users)
    const twenty = Array.from({ length: 20 }, (_, i) => [`P${i + 1}`, 1000] as [string, number])
    const booking = await addBooking(tenantId, twenty)
    await edit(page, booking)
    await expect(handles(page)).toHaveCount(20)
    await expect(panel(page).getByRole('button', { name: 'Position hinzufügen' })).toHaveCount(0)
    await handle(page, 'P20').focus()
    await page.keyboard.press('Space')
    await expect(liveRegion(page)).toContainText('P20 aufgenommen, Position 20 von 20.')
    await settled(page)
    for (let pos = 19; pos >= 1; pos--) {
      await page.keyboard.press('ArrowUp')
      await expect(liveRegion(page)).toContainText(`P20 auf Position ${pos} von 20.`)
    }
    await page.keyboard.press('Space')
    await expect(liveRegion(page)).toContainText('P20 abgelegt auf Position 1 von 20.')
    await save(page)
    await expect(panel(page)).toBeHidden()
    const expected = ['P20', ...twenty.slice(0, 19).map(([l]) => l)].map((label, i) => ({ position: i + 1, label }))
    await expect.poll(() => stored(booking)).toEqual(expected)
  })

  test('Edge: Gleichzeitige Bearbeitung – Schutz vor Überschreiben greift auch für die Reihenfolge', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const booking = await addBooking(tenantId, THREE)
    await edit(page, booking)
    await mouseDrag(page, handle(page, 'Rabatt'), handle(page, 'Reinigung'))
    await expectOrder(page, ['Rabatt', 'Reinigung', 'Endreinigung Haustier'])
    // Jemand anderes ändert die Buchung in der Zwischenzeit
    const { error } = await service().from('bookings').update({ note: 'Von jemand anderem' }).eq('id', booking)
    if (error) throw error
    await save(page)
    await expect(panel(page).getByText('Diese Buchung wurde inzwischen von jemand anderem geändert.')).toBeVisible()
    await expectOrder(page, ['Rabatt', 'Reinigung', 'Endreinigung Haustier'])
    expect(await stored(booking)).toEqual([
      { position: 1, label: 'Reinigung' },
      { position: 2, label: 'Endreinigung Haustier' },
      { position: 3, label: 'Rabatt' },
    ])
  })

  test('Edge: Negativer Betrag bleibt beim Verschieben an seiner Position (Betrag wandert mit)', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const booking = await addBooking(tenantId, THREE)
    await edit(page, booking)
    await mouseDrag(page, handle(page, 'Rabatt'), handle(page, 'Reinigung'))
    await expectOrder(page, ['Rabatt', 'Reinigung', 'Endreinigung Haustier'])
    const amounts = await panel(page).getByLabel('Betrag (€)', { exact: true }).evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value))
    expect(amounts).toEqual(['-50,00', '60,00', '30,00'])
    await save(page)
    await expect(panel(page)).toBeHidden()
    await expect
      .poll(async () => (await service().from('booking_charges').select('label, amount_cents').eq('booking_id', booking).order('position')).data)
      .toEqual([
        { label: 'Rabatt', amount_cents: -5000 },
        { label: 'Reinigung', amount_cents: 6000 },
        { label: 'Endreinigung Haustier', amount_cents: 3000 },
      ])
  })

  test('Sicherheit: HTML in der Bezeichnung wird in Griff-Namen und Ansagen nur als Text ausgegeben', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    const evil = '<img src=x onerror="window.__xss=1">'
    const booking = await addBooking(tenantId, [
      [evil, 1000],
      ['Reinigung', 6000],
    ])
    await edit(page, booking)
    const grip = handle(page, evil)
    await expect(grip).toBeVisible()
    await grip.focus()
    await page.keyboard.press('Space')
    await expect(liveRegion(page)).toContainText(`${evil} aufgenommen, Position 1 von 2.`)
    await settled(page)
    await page.keyboard.press('Escape')
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
    expect(await liveRegion(page).locator('img').count()).toBe(0)
  })
})
