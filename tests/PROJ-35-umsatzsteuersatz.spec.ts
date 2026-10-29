import { expect, type Page, test as base } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

import type { Json } from '../src/types/database'
import { anon, createTenant, createUser, deleteUser, type E2EUser, hasSupabaseEnv, service, signInAs } from './support/supabase'

// PROJ-35: Umsatzsteuersatz je Position. Datenbank-Regeln direkt gegen die Speicherfunktionen, dazu Formular und Detail.
// Abläufe im Desktop-Projekt (und Firefox/Safari), Layout auch auf Tablet und Handy.

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
const desktopOnly = () => test.skip(['tablet', 'mobile'].includes(test.info().project.name), 'Abläufe nur im Desktop-Projekt')
const ready = (page: Page) =>
  page.waitForFunction(() => Object.keys(document.querySelector('main') ?? {}).some((k) => k.startsWith('__reactFiber')))
const panel = (page: Page) => page.getByRole('dialog')
const text = (s: string) => s.replace(/[  ]/g, ' ').replace(/\s+/g, ' ')

type Seed = { label: string; cents: number; rate: number }

async function signedIn(user: E2EUser) {
  const client = anon()
  await client.auth.signInWithPassword({ email: user.email, password: user.password })
  return client
}

async function setup(users: Users, { staff = false } = {}) {
  const owner = await users({ displayName: 'Olga Owner' })
  const members: { user: E2EUser; role: 'owner' | 'staff' }[] = [{ user: owner, role: 'owner' }]
  const staffUser = staff ? await users({ displayName: 'Sam Staff' }) : undefined
  if (staffUser) members.push({ user: staffUser, role: 'staff' })
  const tenantId = await createTenant('QA35 Testkunde', members)
  return { owner, staff: staffUser, tenantId }
}

let seq = 3500
async function addBooking(
  tenantId: string,
  { nights = 30000, nightsRate = 10, charges = [] as Seed[], cleaningFee = null as number | null } = {}
) {
  const { data: property, error: propertyError } = await service()
    .from('properties')
    .insert({ tenant_id: tenantId, name: `Haus See ${++seq}`, street: 'Seeweg 12', postal_code: '5340', city: 'St. Gilgen', municipality_code: '50330' })
    .select('id')
    .single()
  if (propertyError) throw propertyError
  const { data: apartment, error: apartmentError } = await service()
    .from('apartments')
    .insert({ tenant_id: tenantId, property_id: property.id, name: 'Top 1', max_guests: 4, price_cents: 10000, cleaning_fee_cents: cleaningFee } as never)
    .select('id')
    .single()
  if (apartmentError) throw apartmentError
  const { data: guest, error: guestError } = await service()
    .from('guests')
    .insert({ tenant_id: tenantId, country: 'AT', last_name: 'Huber', first_name: 'Anna' } as never)
    .select('id')
    .single()
  if (guestError) throw guestError
  const apartmentId = (apartment as { id: string }).id
  const guestId = (guest as { id: string }).id
  const { data, error } = await service()
    .from('bookings')
    .insert({
      tenant_id: tenantId,
      apartment_id: apartmentId,
      kind: 'booking',
      arrival: '2026-11-10',
      planned_departure: '2026-11-13',
      departure: '2026-11-13',
      guest_id: guestId,
      check_in: '15:00',
      check_out: '10:00',
      adults: 2,
      number_year: 2026,
      number_seq: ++seq,
    })
    .select('id, updated_at')
    .single()
  if (error) throw error
  const { error: amountError } = await service()
    .from('booking_amounts')
    .insert({ id: data.id, tenant_id: tenantId, nights_cents: nights, nights_vat_rate: nightsRate })
  if (amountError) throw amountError
  for (const [i, c] of charges.entries()) {
    const { error: chargeError } = await service()
      .from('booking_charges')
      .insert({ booking_id: data.id, tenant_id: tenantId, label: c.label, amount_cents: c.cents, position: i + 1, vat_rate: c.rate })
    if (chargeError) throw chargeError
  }
  return { id: data.id as string, apartmentId, guestId }
}

async function stored(bookingId: string) {
  const [amounts, charges] = await Promise.all([
    service().from('booking_amounts').select('nights_cents, nights_vat_rate, cancellation_fee_cents, cancellation_fee_vat_rate').eq('id', bookingId).single(),
    service().from('booking_charges').select('position, label, amount_cents, vat_rate').eq('booking_id', bookingId).order('position'),
  ])
  return { amounts: amounts.data!, charges: charges.data ?? [] }
}

async function updatedAt(bookingId: string) {
  return (await service().from('bookings').select('updated_at').eq('id', bookingId).single()).data!.updated_at
}

// Eingabe für save_booking wie die Server-Aktion sie schickt
async function input(tenantId: string, b: { id: string; apartmentId: string; guestId: string }, amounts: Json | undefined, { edit = true } = {}) {
  return {
    p_input: {
      id: edit ? b.id : null,
      updated_at: edit ? await updatedAt(b.id) : null,
      tenant_id: tenantId,
      kind: 'booking',
      apartment_id: b.apartmentId,
      arrival: edit ? '2026-11-10' : '2026-12-10',
      planned_departure: edit ? '2026-11-13' : '2026-12-13',
      departure: edit ? '2026-11-13' : '2026-12-13',
      check_in: '15:00',
      check_out: '10:00',
      guest_sheet_number: null,
      confirm_guest_sheet_number: false,
      residence_registered: false,
      source: 'none',
      source_custom: null,
      guest_id: b.guestId,
      new_guest: null,
      adults: 2,
      child_ages: [],
      option_until: null,
      note: null,
      amounts: amounts ?? null,
    } as Json,
    p_confirm: false,
  }
}

test.describe('Speicherfunktionen (Datenbank)', () => {
  test('Inhaber speichert Sätze; ungültige Sätze werden abgelehnt (22023), nichts gespeichert', async ({ users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const b = await addBooking(tenantId, { charges: [{ label: 'Reinigung', cents: 6000, rate: 10 }] })
    const client = await signedIn(owner)

    const ok = await client.rpc(
      'save_booking',
      await input(tenantId, b, {
        nights_cents: 30000,
        nights_vat_rate: '13.00',
        charges: [
          { label: 'Parkplatz', amount_cents: 3000, vat_rate: '5.50' },
          { label: 'Nächtigungsabgabe', amount_cents: 1200, vat_rate: '0.00' },
        ],
      })
    )
    expect(ok.error).toBeNull()
    expect(await stored(b.id)).toMatchObject({
      amounts: { nights_vat_rate: 13 },
      charges: [
        { position: 1, label: 'Parkplatz', vat_rate: 5.5 },
        { position: 2, label: 'Nächtigungsabgabe', vat_rate: 0 },
      ],
    })

    for (const bad of ['10.555', '101', '100.01', 'abc', '-1', '', null]) {
      const r = await client.rpc(
        'save_booking',
        await input(tenantId, b, { nights_cents: 30000, nights_vat_rate: '10.00', charges: [{ label: 'X', amount_cents: 100, vat_rate: bad }] })
      )
      expect(r.error?.code, `Satz ${bad}`).toBe('22023')
    }
    const nightsBad = await client.rpc('save_booking', await input(tenantId, b, { nights_cents: 30000, nights_vat_rate: '10,5', charges: [] }))
    expect(nightsBad.error?.code).toBe('22023')
    // Grenzwerte
    const edges = await client.rpc(
      'save_booking',
      await input(tenantId, b, { nights_cents: 30000, nights_vat_rate: '0', charges: [{ label: 'X', amount_cents: 100, vat_rate: '100' }] })
    )
    expect(edges.error).toBeNull()
    expect(await stored(b.id)).toMatchObject({ amounts: { nights_vat_rate: 0 }, charges: [{ vat_rate: 100 }] })
  })

  test('Mitarbeiter: neue Buchung mit Standard 10 % und Reinigung 10 %; Ändern lässt die Sätze unverändert', async ({ users }) => {
    desktopOnly()
    const { staff, tenantId } = await setup(users, { staff: true })
    const b = await addBooking(tenantId, { nightsRate: 13, charges: [{ label: 'Parkplatz', cents: 3000, rate: 5.5 }], cleaningFee: 6000 })
    const client = await signedIn(staff!)

    const created = await client.rpc('save_booking', await input(tenantId, b, undefined, { edit: false }))
    expect(created.error).toBeNull()
    const newId = (created.data as { id: string }).id
    expect(await stored(newId)).toMatchObject({ amounts: { nights_vat_rate: 10 }, charges: [{ label: 'Reinigung', vat_rate: 10 }] })

    // Mitarbeiter schickt Beträge mit – sie werden ignoriert, die Sätze bleiben
    const edited = await client.rpc(
      'save_booking',
      await input(tenantId, b, { nights_cents: 1, nights_vat_rate: '20.00', charges: [{ label: 'Y', amount_cents: 1, vat_rate: '20.00' }] })
    )
    expect(edited.error).toBeNull()
    expect(await stored(b.id)).toMatchObject({ amounts: { nights_cents: 30000, nights_vat_rate: 13 }, charges: [{ label: 'Parkplatz', vat_rate: 5.5 }] })
    // Mitarbeiter lesen weder Beträge noch Sätze
    expect((await client.from('booking_charges').select('vat_rate').eq('booking_id', b.id)).data ?? []).toHaveLength(0)
  })

  test('Stornieren und Stornogebühr ändern speichern den Satz; ohne Angabe 0,00 bzw. unverändert; ungültig → 22023', async ({ users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const client = await signedIn(owner)
    const a = await addBooking(tenantId)
    const bad = await client.rpc('cancel_booking', { p_booking_id: a.id, p_fee_cents: 5000, p_fee_vat_rate: '20.001' })
    expect(bad.error?.code).toBe('22023')
    expect((await service().from('bookings').select('cancelled_at').eq('id', a.id).single()).data!.cancelled_at).toBeNull()

    expect((await client.rpc('cancel_booking', { p_booking_id: a.id, p_fee_cents: 5000, p_fee_vat_rate: '20.00' })).error).toBeNull()
    expect((await stored(a.id)).amounts).toMatchObject({ cancellation_fee_cents: 5000, cancellation_fee_vat_rate: 20 })

    // Gebühr ändern ohne Satz: Satz bleibt; mit Satz: neu
    const keep = await client.rpc('save_booking_note', { p_booking_id: a.id, p_updated_at: await updatedAt(a.id), p_note: '', p_set_fee: true, p_fee_cents: 6000 })
    expect(keep.error).toBeNull()
    expect((await stored(a.id)).amounts).toMatchObject({ cancellation_fee_cents: 6000, cancellation_fee_vat_rate: 20 })
    const change = await client.rpc('save_booking_note', {
      p_booking_id: a.id,
      p_updated_at: await updatedAt(a.id),
      p_note: '',
      p_set_fee: true,
      p_fee_cents: 6000,
      p_fee_vat_rate: '10.00',
    })
    expect(change.error).toBeNull()
    expect((await stored(a.id)).amounts.cancellation_fee_vat_rate).toBe(10)

    const c = await addBooking(tenantId)
    expect((await client.rpc('cancel_booking', { p_booking_id: c.id, p_fee_cents: 1000 })).error).toBeNull()
    expect((await stored(c.id)).amounts.cancellation_fee_vat_rate).toBe(0)
  })
})

test.describe('Formular und Detail', () => {
  test('AC: Sätze im Formular – Vorbelegung, Auswahl setzt den Satz, Tippen nicht, Format „13,00“; gespeichert und im Detail', async ({
    page,
    users,
  }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const b = await addBooking(tenantId)
    await signInAs(page, owner)
    await page.goto(`/buchungen/${b.id}`)
    await ready(page)
    await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click()
    const p = panel(page)
    await expect(p.getByLabel('USt %', { exact: true })).toHaveValue('10,00')

    // Neue Position: 20,00; Auswahl per Tastatur „Reinigung“ → 10,00
    await p.getByRole('button', { name: 'Position hinzufügen' }).click()
    const label = p.getByRole('combobox', { name: 'Bezeichnung' }).first()
    const rate = p.getByLabel('Umsatzsteuersatz in Prozent, Position 1')
    await expect(rate).toHaveValue('20,00')
    await label.fill('Rein')
    await expect(p.getByRole('listbox', { name: 'Bezeichnungen zur Auswahl' })).toBeVisible()
    await label.press('ArrowDown')
    await label.press('Enter')
    await expect(label).toHaveValue('Reinigung')
    await expect(rate).toHaveValue('10,00')
    await expect(panel(page)).toBeVisible()

    // Von Hand 13 → „13,00“; Bezeichnung frei ändern lässt den Satz
    await rate.fill('13')
    await rate.blur()
    await expect(rate).toHaveValue('13,00')
    await label.fill('Reinigung Extra')
    await label.press('Escape')
    await expect(panel(page)).toBeVisible()
    await expect(rate).toHaveValue('13,00')
    await p.getByLabel('Betrag (€)').first().fill('60')

    // Zweite Position: Auswahl per Maus „Nächtigungsabgabe“ → 0,00
    await p.getByRole('button', { name: 'Position hinzufügen' }).click()
    const label2 = p.getByRole('combobox', { name: 'Bezeichnung' }).nth(1)
    await label2.click()
    await p.getByRole('option', { name: 'Nächtigungsabgabe' }).click()
    await expect(p.getByLabel('Umsatzsteuersatz in Prozent, Position 2')).toHaveValue('0,00')
    await p.getByLabel('Betrag (€)').nth(1).fill('12')

    // Ungültiger Satz → Meldung, nichts gespeichert
    await p.getByLabel('USt %', { exact: true }).fill('10,555')
    await p.getByRole('button', { name: 'Änderungen speichern' }).click()
    await expect(p.getByText('Bitte einen Satz zwischen 0 und 100')).toBeVisible()
    await p.getByLabel('USt %', { exact: true }).fill('10')
    await p.getByRole('button', { name: 'Änderungen speichern' }).click()
    await expect(panel(page)).toBeHidden()

    expect(await stored(b.id)).toMatchObject({
      amounts: { nights_vat_rate: 10 },
      charges: [
        { label: 'Reinigung Extra', amount_cents: 6000, vat_rate: 13 },
        { label: 'Nächtigungsabgabe', amount_cents: 1200, vat_rate: 0 },
      ],
    })
    const main = text(await page.locator('main').innerText())
    expect(main).toContain('Übernachtungen · 10 %')
    expect(main).toContain('Reinigung Extra · 13 %')
    expect(main).toContain('Nächtigungsabgabe · 0 %')
  })

  test('AC: Detail zeigt „darin enthaltene USt“ je Satz (Beispiel der Spec), ohne 0 %', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const b = await addBooking(tenantId, {
      charges: [
        { label: 'Reinigung', cents: 6000, rate: 10 },
        { label: 'Parkplatz', cents: 3000, rate: 20 },
        { label: 'Nächtigungsabgabe', cents: 1200, rate: 0 },
      ],
    })
    await signInAs(page, owner)
    await page.goto(`/buchungen/${b.id}`)
    await ready(page)
    const vat = page.locator('dl[aria-labelledby="enthaltene-ust"]')
    await expect(page.getByRole('heading', { name: 'darin enthaltene USt' })).toBeVisible()
    expect(text(await vat.innerText())).toBe('10 % € 32,73 20 % € 5,00')
  })

  test('AC: Kleinunternehmer – keine Satzfelder, kein Ausweis, Hinweis; Sätze bleiben gespeichert', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const { error } = await service().from('vat_status_changes').insert({ tenant_id: tenantId, valid_from: '2020-01-01', small_business: true })
    expect(error).toBeNull()
    const b = await addBooking(tenantId, { nightsRate: 13, charges: [{ label: 'Reinigung', cents: 6000, rate: 10 }] })
    await signInAs(page, owner)
    await page.goto(`/buchungen/${b.id}`)
    await ready(page)
    await expect(page.getByText('Keine Umsatzsteuer (Kleinunternehmer)')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'darin enthaltene USt' })).toHaveCount(0)
    expect(text(await page.locator('main').innerText())).not.toContain(' · 10 %')

    await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click()
    const p = panel(page)
    await expect(p.getByLabel('Übernachtungspreis (€)')).toBeVisible()
    await expect(p.getByLabel('USt %', { exact: true })).toHaveCount(0)
    await expect(p.getByText('% USt')).toHaveCount(0)
    // Neue Position bekommt im Hintergrund 20,00
    await p.getByRole('button', { name: 'Position hinzufügen' }).click()
    await p.getByRole('combobox', { name: 'Bezeichnung' }).nth(1).fill('Parkplatz')
    await p.getByLabel('Betrag (€)').nth(1).fill('30')
    await p.getByRole('button', { name: 'Änderungen speichern' }).click()
    await expect(panel(page)).toBeHidden()
    expect(await stored(b.id)).toMatchObject({
      amounts: { nights_vat_rate: 13 },
      charges: [
        { label: 'Reinigung', vat_rate: 10 },
        { label: 'Parkplatz', vat_rate: 20 },
      ],
    })
  })

  test('AC: Stornieren mit Gebühr und Satz; im Detail zählt nur die Stornogebühr', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const b = await addBooking(tenantId, { charges: [{ label: 'Reinigung', cents: 6000, rate: 10 }] })
    await signInAs(page, owner)
    await page.goto(`/buchungen/${b.id}`)
    await ready(page)
    await page.getByRole('button', { name: 'Stornieren' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByLabel('USt %')).toHaveValue('0,00')
    await dialog.getByLabel('Stornogebühr in € (optional)').fill('120')
    await dialog.getByLabel('USt %').fill('20')
    await dialog.getByRole('button', { name: 'Stornieren' }).click()
    await expect(dialog).toBeHidden()
    expect((await stored(b.id)).amounts).toMatchObject({ cancellation_fee_cents: 12000, cancellation_fee_vat_rate: 20 })
    // Nach dem Neuladen zählt nur noch die Stornogebühr
    const vat = page.locator('dl[aria-labelledby="enthaltene-ust"]')
    await expect.poll(async () => text(await vat.innerText())).toBe('20 % € 20,00')
  })

  test('AC: Satz wandert beim Verschieben mit (PROJ-34); Auswahl überschreibt einen Hand-Satz', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const b = await addBooking(tenantId, {
      charges: [
        { label: 'Reinigung', cents: 6000, rate: 10 },
        { label: 'Parkplatz', cents: 3000, rate: 5.5 },
      ],
    })
    await signInAs(page, owner)
    await page.goto(`/buchungen/${b.id}`)
    await ready(page)
    await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click()
    const p = panel(page)
    await p.evaluate((e) => Promise.all(e.getAnimations().map((a) => a.finished)))

    // „Parkplatz“ per Tastatur nach oben: der Satz 5,50 geht mit
    await p.getByRole('button', { name: 'Parkplatz verschieben', exact: true }).focus()
    const live = page.locator('[id^="DndLiveRegion"]')
    await page.keyboard.press('Space')
    await expect(live).toContainText('Parkplatz aufgenommen')
    await page.keyboard.press('ArrowUp')
    await expect(live).toContainText('Parkplatz auf Position 1 von 2.')
    await page.keyboard.press('Space')
    await expect(live).toContainText('Parkplatz abgelegt auf Position 1 von 2.')
    await expect(p.getByRole('combobox', { name: 'Bezeichnung' }).first()).toHaveValue('Parkplatz')
    await expect(p.getByLabel('Umsatzsteuersatz in Prozent, Position 1')).toHaveValue('5,50')
    await expect(p.getByLabel('Umsatzsteuersatz in Prozent, Position 2')).toHaveValue('10,00')

    // Hand-Satz 13,00 an Position 2, dann „Reinigung“ aus der Auswahl wählen → 10,00
    const rate2 = p.getByLabel('Umsatzsteuersatz in Prozent, Position 2')
    await rate2.fill('13')
    await rate2.blur()
    const label2 = p.getByRole('combobox', { name: 'Bezeichnung' }).nth(1)
    await label2.fill('')
    await p.getByRole('option', { name: 'Reinigung' }).click()
    await expect(rate2).toHaveValue('10,00')

    await p.getByRole('button', { name: 'Änderungen speichern' }).click()
    await expect(panel(page)).toBeHidden()
    expect((await stored(b.id)).charges).toMatchObject([
      { position: 1, label: 'Parkplatz', vat_rate: 5.5 },
      { position: 2, label: 'Reinigung', vat_rate: 10 },
    ])
  })

  test('AC: Kleinunternehmer-Stichtag – Abreise darüber verschoben blendet die Satzfelder ein bzw. aus', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    // Kleinunternehmer ab 13.11.2026; die Buchung reist am 13.11. ab
    const { error } = await service().from('vat_status_changes').insert({ tenant_id: tenantId, valid_from: '2026-11-13', small_business: true })
    expect(error).toBeNull()
    const b = await addBooking(tenantId, { charges: [{ label: 'Reinigung', cents: 6000, rate: 10 }] })
    await signInAs(page, owner)
    await page.goto(`/buchungen/${b.id}`)
    await ready(page)
    await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click()
    const p = panel(page)
    const nightsVat = p.getByLabel('USt %', { exact: true })
    await expect(nightsVat).toHaveCount(0)

    // Tatsächliche Abreise vor den Stichtag → mit Umsatzsteuer: Felder erscheinen mit den gespeicherten Sätzen
    await p.getByLabel('Abreise', { exact: true }).fill('2026-11-12')
    await expect(nightsVat).toHaveValue('10,00')
    await expect(p.getByLabel('Umsatzsteuersatz in Prozent, Position 1')).toHaveValue('10,00')
    // Zurück auf den Stichtag → wieder ausgeblendet
    await p.getByLabel('Abreise', { exact: true }).fill('2026-11-13')
    await expect(nightsVat).toHaveCount(0)
  })

  test('Layout: Formular mit Sätzen ohne seitliches Scrollen, keine automatisch erkennbaren WCAG-2.1-AA-Verstöße', async ({ page, users }) => {
    const { owner, tenantId } = await setup(users)
    const b = await addBooking(tenantId, {
      charges: [
        { label: 'Reinigung', cents: 6000, rate: 10 },
        { label: 'Parkplatz', cents: 3000, rate: 20 },
      ],
    })
    await signInAs(page, owner)
    await page.goto(`/buchungen/${b.id}`)
    await ready(page)
    await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click()
    const p = panel(page)
    await expect(p.getByLabel('Umsatzsteuersatz in Prozent, Position 2')).toBeVisible()
    const overflow = await p.evaluate((el) => el.scrollWidth - el.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    const results = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
    expect(results.violations).toEqual([])
  })
})
