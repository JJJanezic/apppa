import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test as base } from '@playwright/test'

import { createTenant, createUser, deleteUser, type E2EUser, hasSupabaseEnv, service, signInAs } from './support/supabase'

// PROJ-26: Gästeblatt (Meldewesen). Abläufe im Projekt „desktop“ (Vollbild in Tablet-Breite 1180 × 820), Layout auch auf
// Tablet und Handy. Testdaten über die Datenbank; die Kunden verschwinden mit dem Löschen ihrer Inhaber, übrig gebliebene
// Dateien entfernt die tägliche Bereinigung.

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
test.skip(!hasSupabaseEnv, 'ohne Supabase-Zugang')

type Users = (opts?: Parameters<typeof createUser>[0]) => Promise<E2EUser>
const desktopOnly = () => test.skip(test.info().project.name !== 'desktop', 'Abläufe nur im Desktop-Projekt')
const TABLET = { width: 1180, height: 820 }

const TODAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Vienna' }).format(new Date())
const day = (offset: number) => new Date(Date.parse(`${TODAY}T12:00:00Z`) + offset * 86_400_000).toISOString().slice(0, 10)
let seq = 0

const COMPLETE_AT = {
  country: 'AT',
  last_name: 'Huber',
  first_name: 'Anna',
  gender: 'female',
  birth_date: '1980-05-01',
  street: 'Hauptplatz 1',
  postal_code: '6020',
  city: 'Innsbruck',
  address_country: 'AT',
}

// numbering: Nummernbereich 0001–0500 in St. Gilgen und „Gästeblätter nacherfassen“ ein (Erweiterung 2026-11-09)
async function setup(page: Page, users: Users, role: 'owner' | 'staff' = 'owner', numbering = true) {
  const owner = await users({ displayName: 'Olga Owner' })
  const staff = await users({ displayName: 'Sam Staff' })
  const tenantId = await createTenant('QA26 Pichler', [
    { user: owner, role: 'owner' },
    { user: staff, role: 'staff' },
  ])
  const { data: property } = await service()
    .from('properties')
    .insert({ tenant_id: tenantId, name: 'Haus See', street: 'Seeweg 12', postal_code: '5340', city: 'St. Gilgen', municipality_code: '50330' })
    .select('id')
    .single()
  const { data: apt, error } = await service()
    .from('apartments')
    .insert({ tenant_id: tenantId, property_id: property!.id, name: 'Top 1', max_guests: 6, price_cents: 10000 })
    .select('id')
    .single()
  if (error) throw error
  if (numbering) {
    await service().from('guest_sheet_number_ranges').insert({ tenant_id: tenantId, municipality_code: '50330', range_from: '0001', range_to: '0500' })
    await service().from('guest_sheet_options').upsert({ tenant_id: tenantId, backfill_enabled: true }, { onConflict: 'tenant_id' })
  }
  await signInAs(page, role === 'staff' ? staff : owner)
  return { tenantId, apartmentId: apt.id, owner, staff }
}

async function addGuest(tenantId: string, over: Record<string, unknown> = {}) {
  const { data, error } = await service().from('guests').insert({ tenant_id: tenantId, ...COMPLETE_AT, ...over }).select('id').single()
  if (error) throw error
  return data.id
}

async function addBooking(
  tenantId: string,
  apartmentId: string,
  guestId: string,
  over: { kind?: string; adults?: number; residence?: boolean; arrival?: string; sheet?: string; companions?: { last_name: string; first_name: string; birth_date?: string }[] } = {}
) {
  const arrival = over.arrival ?? day(-seq * 6 - 1)
  seq++
  const kind = over.kind ?? 'booking'
  const { data, error } = await service()
    .from('bookings')
    .insert({
      tenant_id: tenantId,
      apartment_id: apartmentId,
      kind,
      arrival,
      planned_departure: day(30 + seq),
      departure: day(30 + seq),
      guest_id: guestId,
      check_in: '15:00',
      check_out: '10:00',
      adults: over.adults ?? 1,
      number_year: 2026,
      number_seq: 900 + seq,
      option_until: kind === 'option' ? day(20) : null,
      residence_registered: over.residence ?? false,
      guest_sheet_number: over.sheet ?? null,
    })
    .select('id, number')
    .single()
  if (error) throw error
  await service().from('booking_amounts').insert({ id: data.id, tenant_id: tenantId, nights_cents: 30000 })
  if (over.companions?.length) {
    const { error: e } = await service()
      .from('booking_companions')
      .insert(over.companions.map((c, i) => ({ booking_id: data.id, tenant_id: tenantId, position: i + 1, birth_date: null, ...c })))
    if (e) throw e
  }
  return data
}

async function draw(page: Page, id: string) {
  const canvas = page.locator(`#${id}`)
  await canvas.scrollIntoViewIfNeeded()
  const box = (await canvas.boundingBox())!
  await page.mouse.move(box.x + 40, box.y + 100)
  await page.mouse.down()
  for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + 40 + i * 25, box.y + 100 + (i % 2 ? -30 : 30), { steps: 3 })
  await page.mouse.up()
}

async function openSheet(page: Page, bookingId: string) {
  await page.setViewportSize(TABLET)
  await page.goto(`/gaesteblatt/${bookingId}`)
  await expect(page.getByRole('heading', { name: 'Mitreisende im familiären Verbund' })).toBeVisible()
  // Hydrierung abwarten (Unterschriftsfläche angebunden)
  await page.waitForFunction(() => Object.keys(document.querySelector('canvas') ?? {}).length >= 0 && document.readyState === 'complete')
  await page.waitForTimeout(500)
}

// genau „Gespeichert“ (nicht „Wird gespeichert …“)
const saved = (page: Page) => expect(page.getByRole('status').filter({ hasText: /^Gespeichert$/ })).toBeVisible({ timeout: 10_000 })

async function signAndFinish(page: Page, opts: { consent?: boolean } = {}) {
  await draw(page, 'unterschrift-1')
  await expect(page.getByText('Unterschrieben.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Weiter' }).click()
  await expect(page.getByRole('heading', { name: 'Einwilligung in Marketing' })).toBeVisible()
  if (opts.consent) await page.getByLabel('Ich willige ein.').check()
  await draw(page, 'unterschrift-2')
  await page.getByRole('button', { name: 'Fertig' }).click()
  await page.waitForURL(/\/buchungen\/[^/?]+$/, { timeout: 30_000 })
  await expect(page.getByText('Gästeblatt gespeichert.')).toBeVisible()
}

test.describe('Umbenennung', () => {
  test('AC: Gastformular mit „Staatsangehörigkeit“ und „Herkunftsland“ in der Adresse; Gästeliste mit Spalte „Staatsangehörigkeit“', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    await addGuest(tenantId, { country: 'DE' })
    await page.goto('/gaeste')
    await expect(page.getByRole('columnheader', { name: 'Staatsangehörigkeit' })).toBeVisible()
    await expect(page.getByRole('cell', { name: 'Deutschland' })).toBeVisible()
    await page.getByRole('button', { name: 'Gast anlegen' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('combobox', { name: 'Staatsangehörigkeit' })).toBeVisible()
    await expect(dialog.getByRole('combobox', { name: 'Herkunftsland' })).toBeVisible()
    await expect(dialog.getByText('Staatsangehörigkeit des Gastes, für das Gästeblatt.')).toBeVisible()
  })
})

test.describe('Abschnitt in der Buchung', () => {
  test('AC: Buchung ohne Blatt zeigt „Noch kein Gästeblatt“ mit beiden Knöpfen; Option, Wohnsitz und ohne Gast', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, apartmentId } = await setup(page, users, 'staff')
    const guest = await addGuest(tenantId)
    const booking = await addBooking(tenantId, apartmentId, guest)
    await page.goto(`/buchungen/${booking.id}`)
    await expect(page.getByText('Noch kein Gästeblatt.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Gästeblatt', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Gästeblatt hochladen' })).toBeVisible()

    for (const over of [{ kind: 'option' }, { residence: true }]) {
      const b = await addBooking(tenantId, apartmentId, guest, over)
      await page.goto(`/buchungen/${b.id}`)
      await expect(page.getByRole('heading', { name: 'Aufenthalt' })).toBeVisible()
      await expect(page.getByRole('heading', { name: 'Gästeblatt', exact: true })).toHaveCount(0)
    }

    // Buchungen haben immer einen Gast (Datenbank); gesperrt ist das Blatt bei anonymisiertem Gast, Hochladen geht
    const anonymous = await addGuest(tenantId, { last_name: 'Anonym' })
    const anonBooking = await addBooking(tenantId, apartmentId, anonymous)
    expect((await service().rpc('anonymize_guest' as never, { p_guest_id: anonymous } as never)).error).toBeNull()
    await page.goto(`/buchungen/${anonBooking.id}`)
    await expect(page.getByRole('button', { name: 'Gästeblatt', exact: true })).toBeDisabled()
    await expect(page.getByText('Der Gast wurde anonymisiert.')).toBeVisible()
    await page.getByRole('button', { name: 'Gästeblatt hochladen' }).click()
    await expect(page.getByRole('checkbox', { name: 'Marketing-Einwilligung liegt unterschrieben vor' })).toBeDisabled()
  })
})

test.describe('Vollbild-Ansicht', () => {
  test('AC: Pflichtfelder markiert, ergänzen speichert am Gast, Unterschrift erst danach; Mitarbeiter mit Einwilligung bis „Fertig“', async ({ page, users }) => {
    desktopOnly()
    test.setTimeout(90_000)
    const { tenantId, apartmentId } = await setup(page, users, 'staff')
    const guest = await addGuest(tenantId, { birth_date: null, postal_code: null, city: null })
    const booking = await addBooking(tenantId, apartmentId, guest)
    await openSheet(page, booking.id)

    // ohne App-Menü, mit Kundenname und Fortschritt
    await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toHaveCount(0)
    await expect(page.getByText('QA26 Pichler').first()).toBeVisible()
    await expect(page.getByRole('list', { name: 'Fortschritt' })).toContainText('Meldedaten')
    // Österreich: kein Reisedokument
    await expect(page.getByRole('heading', { name: 'Reisedokument' })).toHaveCount(0)
    await expect(page.getByText('Bitte zuerst alle markierten Felder ergänzen.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Weiter' })).toBeDisabled()

    // Geburtsdatum in der Zukunft wird nicht gespeichert
    await page.getByLabel('Geburtsdatum').fill('2999-01-01')
    await page.getByLabel('Familienname').click()
    await expect(page.getByText('Das Geburtsdatum darf nicht in der Zukunft liegen.')).toBeVisible()

    await page.getByLabel('Geburtsdatum').fill('1980-05-01')
    await page.getByLabel('Postleitzahl').fill('6020')
    await page.getByLabel('Familienname').click()
    await expect(page.getByLabel('Ortsgemeinde')).toHaveValue('Innsbruck')
    // Lfd.-Nr. nur lesen, vergeben beim „Fertig“ (Erweiterung 2026-11-09)
    await expect(page.getByText('wird beim Abschluss vergeben')).toBeVisible()
    await page.waitForTimeout(1600)
    await saved(page)
    const { data: g } = await service().from('guests').select('birth_date, postal_code, city').eq('id', guest).single()
    expect(g).toEqual({ birth_date: '1980-05-01', postal_code: '6020', city: 'Innsbruck' })
    const { data: log } = await service().from('audit_log').select('actor_label').eq('record_id', guest).order('id', { ascending: false }).limit(1).single()
    expect(log!.actor_label).toBe('Gästeblatt')

    // Änderung nach Unterschrift 1 löscht sie
    await draw(page, 'unterschrift-1')
    await expect(page.getByRole('button', { name: 'Weiter' })).toBeEnabled()
    await page.getByLabel('Straße/Gasse/Platz').fill('Hauptplatz 2')
    await expect(page.getByText('Die Angaben wurden geändert. Bitte erneut unterschreiben.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Weiter' })).toBeDisabled()
    await page.getByLabel('Familienname').click()
    await page.waitForTimeout(1600)
    await saved(page)

    // Seite 2: Kästchen nicht vorausgewählt, „Fertig“ erst nach Unterschrift 2; „Zurück“ behält Unterschrift 1
    await draw(page, 'unterschrift-1')
    await page.getByRole('button', { name: 'Weiter' }).click()
    await expect(page.getByLabel('Ich willige ein.')).not.toBeChecked()
    await expect(page.getByRole('button', { name: 'Fertig' })).toBeDisabled()
    await page.getByRole('button', { name: 'Zurück' }).click()
    await expect(page.getByText('Unterschrieben.', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Weiter' }).click()
    await page.getByLabel('Ich willige ein.').check()
    await draw(page, 'unterschrift-2')
    await page.getByRole('button', { name: 'Fertig' }).click()
    await page.waitForURL(/\/buchungen\/[^/?]+$/, { timeout: 30_000 })
    await expect(page.getByText('Gästeblatt gespeichert.')).toBeVisible()
    await expect(page.getByText(/Unterschrieben am/)).toBeVisible()
    await expect(page.getByText('erteilt', { exact: true })).toBeVisible()

    const { data: sheet } = await service().from('guest_sheets').select('id, kind, sheet_number, marketing_consent, created_by').eq('booking_id', booking.id).single()
    expect(sheet).toMatchObject({ kind: 'signed', sheet_number: '0001', marketing_consent: true })
    const { data: consent } = await service().from('guests').select('marketing_consent_sheet_id').eq('id', guest).single()
    expect(consent!.marketing_consent_sheet_id).toBe(sheet!.id)
    const pdf = await page.request.get(`/api/gaesteblatt/${sheet!.id}/pdf`)
    expect(pdf.status()).toBe(200)
    expect(pdf.headers()['content-type']).toBe('application/pdf')
    expect(pdf.headers()['cache-control']).toBe('no-store')
  })

  test('AC: ausländischer Gast mit Reisedokument; fehlende Mitreisende hinzufügen', async ({ page, users }) => {
    desktopOnly()
    test.setTimeout(90_000)
    const { tenantId, apartmentId } = await setup(page, users)
    const guest = await addGuest(tenantId, { country: 'IT', address_country: 'IT', postal_code: '39100', city: 'Bolzano' })
    const booking = await addBooking(tenantId, apartmentId, guest, { adults: 3, companions: [{ last_name: 'Rossi', first_name: 'Luca', birth_date: '2016-07-09' }] })
    await openSheet(page, booking.id)
    await expect(page.getByRole('heading', { name: 'Reisedokument' })).toBeVisible()
    await expect(page.getByText('Es fehlt noch 1 mitreisende Person.')).toBeVisible()
    await page.getByRole('combobox', { name: 'Art' }).click()
    await page.getByRole('option', { name: 'Reisepass' }).click()
    await page.getByLabel('Nummer').fill('YA1234567')
    await page.getByLabel('Ausstellungsdatum').fill('2020-02-01')
    await page.getByLabel('Ausstellende Behörde').fill('Questura')
    await page.getByRole('combobox', { name: 'Staat', exact: true }).click()
    await page.getByRole('option', { name: 'Italien' }).click()
    await page.getByRole('button', { name: 'Mitreisende hinzufügen' }).click()
    const rows = page.getByRole('group', { name: /Mitreisende Person/ })
    await rows.nth(1).getByLabel('Familienname').fill('Rossi')
    await rows.nth(1).getByLabel('Vorname(n)').fill('Sara')
    await rows.nth(1).getByLabel('Geburtsdatum').fill('2018-01-02')
    await page.getByLabel('Familienname').first().click()
    await page.waitForTimeout(1600)
    await saved(page)
    await expect(page.getByText('Bitte zuerst alle markierten Felder ergänzen.')).toHaveCount(0)
    const { data: companions } = await service().from('booking_companions').select('first_name').eq('booking_id', booking.id).order('position')
    expect(companions!.map((c) => c.first_name)).toEqual(['Luca', 'Sara'])
    await signAndFinish(page)
    const { data: sheet } = await service().from('guest_sheets').select('snapshot').eq('booking_id', booking.id).single()
    const snap = sheet!.snapshot as { guest: { documentNumber: string }; companions: unknown[] }
    expect(snap.guest.documentNumber).toBe('YA1234567')
    expect(snap.companions).toHaveLength(2)
  })

  test('AC: „Abbrechen“ fragt nach; ergänzte Daten bleiben, es entsteht kein Blatt', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, apartmentId } = await setup(page, users)
    const guest = await addGuest(tenantId, { birth_date: null })
    const booking = await addBooking(tenantId, apartmentId, guest)
    await openSheet(page, booking.id)
    await page.getByLabel('Geburtsdatum').fill('1980-05-01')
    await page.getByLabel('Familienname').click()
    await saved(page)
    await page.getByRole('button', { name: 'Abbrechen' }).click()
    await expect(page.getByRole('alertdialog')).toContainText('Ergänzte Daten bleiben gespeichert, Unterschriften nicht.')
    await page.getByRole('alertdialog').getByRole('button', { name: 'Abbrechen' }).click()
    await page.waitForURL(/\/buchungen\//)
    await expect(page.getByText('Noch kein Gästeblatt.')).toBeVisible()
    const { data } = await service().from('guests').select('birth_date').eq('id', guest).single()
    expect(data!.birth_date).toBe('1980-05-01')
  })

  test('Edge: anonymisierter Gast und Option führen zurück zur Buchung', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, apartmentId } = await setup(page, users)
    const anonymous = await addGuest(tenantId)
    const anonBooking = await addBooking(tenantId, apartmentId, anonymous)
    expect((await service().rpc('anonymize_guest' as never, { p_guest_id: anonymous } as never)).error).toBeNull()
    await page.goto(`/gaesteblatt/${anonBooking.id}`)
    await expect(page.getByText('Der Gast wurde anonymisiert. Ein Gästeblatt ist nicht möglich.')).toBeVisible()
    const option = await addBooking(tenantId, apartmentId, await addGuest(tenantId), { kind: 'option' })
    await page.goto(`/gaesteblatt/${option.id}`)
    await expect(page.getByText(/kein Gästeblatt vorgesehen/)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Zurück zur Buchung' })).toBeVisible()
  })

  test('Edge: gleichzeitig gespeichertes Blatt → „Verwerfen“ oder „Als neues Blatt speichern“', async ({ page, users }) => {
    desktopOnly()
    test.setTimeout(90_000)
    const { tenantId, apartmentId } = await setup(page, users)
    const booking = await addBooking(tenantId, apartmentId, await addGuest(tenantId))
    await openSheet(page, booking.id)
    // Auf einem anderen Gerät wurde inzwischen ein Papierblatt hochgeladen
    const path = `${tenantId}/${crypto.randomUUID()}.pdf`
    await service().storage.from('guest-sheets').upload(path, new Blob(['%PDF-1.4'], { type: 'application/pdf' }), { contentType: 'application/pdf' })
    await service().from('guest_sheets').insert({ tenant_id: tenantId, booking_id: booking.id, kind: 'uploaded', pdf_path: path })
    await draw(page, 'unterschrift-1')
    await page.getByRole('button', { name: 'Weiter' }).click()
    await draw(page, 'unterschrift-2')
    await page.getByRole('button', { name: 'Fertig' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog).toContainText('inzwischen ein Gästeblatt gespeichert')
    await dialog.getByRole('button', { name: 'Als neues Blatt speichern' }).click()
    await page.waitForURL(/\/buchungen\/[^/?]+$/, { timeout: 30_000 })
    await expect(page.getByText(/Früheres Gästeblatt/)).toBeVisible()
    const { data } = await service().from('guest_sheets').select('kind, replaced_at').eq('booking_id', booking.id).order('created_at')
    expect(data!.map((s) => [s.kind, s.replaced_at !== null])).toEqual([
      ['uploaded', true],
      ['signed', false],
    ])
  })
})

test.describe('Nach der Unterschrift', () => {
  test('AC: „Neu unterschreiben lassen“ mit Rückfrage; Hinweis nach geänderter Ankunft; Storno behält das Blatt', async ({ page, users }) => {
    desktopOnly()
    test.setTimeout(120_000)
    const { tenantId, apartmentId } = await setup(page, users)
    const booking = await addBooking(tenantId, apartmentId, await addGuest(tenantId))
    await openSheet(page, booking.id)
    await signAndFinish(page)

    await page.getByRole('button', { name: 'Neu unterschreiben lassen' }).click()
    await expect(page.getByRole('alertdialog')).toContainText('bleibt als „ersetzt“ erhalten')
    await page.getByRole('alertdialog').getByRole('button', { name: 'Neu unterschreiben lassen' }).click()
    await page.waitForURL(/\/gaesteblatt\//)
    await expect(page.getByText(/Mit „Fertig“ wird es ersetzt/)).toBeVisible()
    await page.waitForTimeout(500)
    await signAndFinish(page)
    await expect(page.getByText('Früheres Gästeblatt (1)')).toBeVisible()

    const { data: b } = await service().from('bookings').select('arrival').eq('id', booking.id).single()
    await service().from('bookings').update({ arrival: new Date(Date.parse(`${b!.arrival}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10) }).eq('id', booking.id)
    await page.reload()
    await expect(page.getByText(/Buchung nach der Unterschrift geändert/)).toBeVisible()
    await page.goto('/gaesteblaetter?monat=alle')
    await expect(page.getByText('Buchung geändert').first()).toBeVisible()

    await service().from('bookings').update({ cancelled_at: new Date().toISOString(), cancel_reason: 'QA' }).eq('id', booking.id)
    await page.goto(`/buchungen/${booking.id}`)
    await expect(page.getByText('Buchung storniert. Das Gästeblatt bleibt erhalten.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Gästeblatt ansehen' })).toBeVisible()
  })
})

test.describe('Hochladen', () => {
  test('AC: nur PDF; Hochladen ohne Pflichtfeld-Prüfung mit Einwilligung; Ersetzen mit Rückfrage', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, apartmentId } = await setup(page, users, 'staff')
    const guest = await addGuest(tenantId, { birth_date: null })
    const booking = await addBooking(tenantId, apartmentId, guest, { sheet: '17' })
    await page.goto(`/buchungen/${booking.id}`)
    await page.getByRole('button', { name: 'Gästeblatt hochladen' }).click()
    const dialog = page.getByRole('dialog')
    // Lfd.-Nr. aus der Buchung, nur lesen (Erweiterung 2026-11-09)
    await expect(dialog.getByText('17', { exact: true })).toBeVisible()
    await expect(dialog.getByRole('textbox', { name: 'Lfd.-Nr.' })).toHaveCount(0)
    const file = dialog.locator('input[type=file]')
    await file.setInputFiles({ name: 'blatt.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('x') })
    await expect(dialog.getByText('Bitte eine PDF-Datei wählen.')).toBeVisible()
    await file.setInputFiles({ name: 'blatt.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF\n') })
    await dialog.getByLabel('Unterschrieben am').fill('2025-08-12')
    await dialog.getByRole('checkbox', { name: 'Marketing-Einwilligung liegt unterschrieben vor' }).check()
    await dialog.getByRole('button', { name: 'Hochladen' }).click()
    await expect(page.getByText('Gästeblatt gespeichert.')).toBeVisible()
    await expect(page.getByText(/Hochgeladen am .* von Sam Staff · unterschrieben am Di, 12\.08\.2025/)).toBeVisible()
    const { data: g } = await service().from('guests').select('marketing_consent_at').eq('id', guest).single()
    expect(new Date(g!.marketing_consent_at!).toISOString()).toBe('2025-08-11T22:00:00.000Z')
    const { data: b } = await service().from('bookings').select('guest_sheet_number').eq('id', booking.id).single()
    expect(b!.guest_sheet_number).toBe('17')

    await page.getByRole('button', { name: 'Gästeblatt hochladen' }).click()
    await expect(page.getByRole('alertdialog')).toContainText('Bestehendes Gästeblatt ersetzen?')
    await page.getByRole('alertdialog').getByRole('button', { name: 'Ersetzen' }).click()
    await page.getByRole('dialog').locator('input[type=file]').setInputFiles({ name: 'neu.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\n%%EOF\n') })
    await page.getByRole('dialog').getByRole('button', { name: 'Hochladen' }).click()
    await expect(page.getByText('Früheres Gästeblatt (1)')).toBeVisible()
  })
})

test.describe('Liste „Gästeblätter“', () => {
  test('AC: Leerzustand, Liste mit PDF und Buchung, „Gästeblatt fehlt“ ohne Wohnsitz-Buchungen, Suche', async ({ page, users }) => {
    desktopOnly()
    test.setTimeout(90_000)
    const { tenantId, apartmentId } = await setup(page, users, 'staff')
    await page.goto('/gaesteblaetter')
    await expect(page.getByText('Noch keine Gästeblätter')).toBeVisible()

    const guest = await addGuest(tenantId)
    const done = await addBooking(tenantId, apartmentId, guest, { arrival: TODAY })
    const missing = await addBooking(tenantId, apartmentId, await addGuest(tenantId, { last_name: 'Fehlt' }), { arrival: TODAY })
    const residence = await addBooking(tenantId, apartmentId, await addGuest(tenantId, { last_name: 'Wohnsitz' }), { arrival: TODAY, residence: true })
    await openSheet(page, done.id)
    await signAndFinish(page)

    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/gaesteblaetter')
    await expect(page.getByText('1 Gästeblatt')).toBeVisible()
    const row = page.getByRole('row').filter({ hasText: 'Huber, Anna' })
    await expect(row.getByRole('link', { name: '0001' })).toHaveAttribute('href', /\/api\/gaesteblatt\/.+\/pdf/)
    await expect(row.getByRole('link', { name: done.number! })).toHaveAttribute('href', `/buchungen/${done.id}`)
    await expect(row).toContainText('unterschrieben')

    await page.getByRole('switch', { name: 'Gästeblatt fehlt' }).click()
    await expect(page).toHaveURL(/fehlt=1/)
    await expect(page.getByRole('row').filter({ hasText: 'Fehlt' })).toBeVisible()
    await expect(page.getByRole('row').filter({ hasText: 'Wohnsitz' })).toHaveCount(0)
    await expect(page.getByRole('row').filter({ hasText: 'Huber' })).toHaveCount(0)
    expect(missing.id && residence.id).toBeTruthy()

    await page.getByRole('switch', { name: 'Gästeblatt fehlt' }).click()
    await expect(page).not.toHaveURL(/fehlt=1/)
    await expect(page.getByText('1 Gästeblatt')).toBeVisible()
    await page.getByRole('searchbox', { name: 'Gästeblätter durchsuchen' }).fill('nicht-vorhanden')
    await expect(page.getByText('Kein Gästeblatt passt zur Suche.')).toBeVisible()
  })
})

test.describe('Einstellungen und Stammdaten', () => {
  test('AC: Inhaber sieht Standardtexte, unbekannter Platzhalter und leerer Text werden abgelehnt, Zurücksetzen, Speichern', async ({ page, users }) => {
    desktopOnly()
    await setup(page, users)
    await page.goto('/einstellungen/gaesteblatt')
    await expect(page.getByRole('link', { name: 'Gästeblatt', exact: true })).toHaveAttribute('aria-current', 'page')
    const privacy = page.getByRole('textbox', { name: 'Text Teil A' })
    await expect(privacy).toContainText('Verantwortlich für die Verarbeitung')
    await expect(page.getByText(/\{E-Mail\} ist in den Stammdaten nicht ausgefüllt/)).toBeVisible()

    await privacy.click()
    await page.keyboard.press('ControlOrMeta+End')
    await page.keyboard.type(' {Gastname}')
    await page.getByRole('button', { name: 'Texte speichern' }).click()
    await expect(page.getByText('Unbekannter Platzhalter: {Gastname}')).toBeVisible()

    await page.getByRole('button', { name: 'Auf Standard zurücksetzen' }).first().click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Zurücksetzen' }).click()
    // BUG-2 aus QA: Der Editor zeigt nach dem Zurücksetzen sofort den Standardtext
    await expect(page.getByRole('textbox', { name: 'Text Teil A' })).not.toContainText('{Gastname}')
    await expect(page.getByRole('textbox', { name: 'Text Teil A' })).toContainText('Verantwortlich für die Verarbeitung')
    await page.getByRole('button', { name: 'Texte speichern' }).click()
    await expect(page.getByText('Texte gespeichert.')).toBeVisible()
    await page.reload()
    await expect(page.getByRole('textbox', { name: 'Text Teil A' })).not.toContainText('{Gastname}')

    await page.goto('/einstellungen/stammdaten')
    await page.getByLabel('E-Mail').fill('office@pichler.at')
    await page.getByLabel('Telefon').fill('+43 512 123456')
    // exakt: darunter steht „Kennzahlen speichern“ (Erweiterung 2026-11-09)
    await page.getByRole('button', { name: 'Speichern', exact: true }).click()
    await expect(page.getByText('Kundendaten gespeichert.')).toBeVisible()
    await page.goto('/einstellungen/gaesteblatt')
    await expect(page.getByRole('textbox', { name: 'Text Teil A' })).toContainText('Verantwortlich')
    // Mit dem Speichern steht auch der voreingestellte Staat in den Stammdaten: keine leeren Platzhalter mehr
    await expect(page.getByText('Österreich, E-Mail: office@pichler.at, Telefon: +43 512 123456').first()).toBeVisible()
    await expect(page.getByText(/ist in den Stammdaten nicht ausgefüllt/)).toHaveCount(0)
  })

  test('AC: Mitarbeiter sieht weder den Reiter noch die Seite', async ({ page, users }) => {
    desktopOnly()
    await setup(page, users, 'staff')
    const response = await page.goto('/einstellungen/gaesteblatt')
    expect(response?.status()).toBe(404)
  })
})

test.describe('Sicherheit', () => {
  test('PDF nur angemeldet und nur für den eigenen Kunden; Fertigstellen prüft Kunde und Eingaben', async ({ page, users, browser }) => {
    desktopOnly()
    test.setTimeout(90_000)
    const { tenantId, apartmentId } = await setup(page, users)
    const booking = await addBooking(tenantId, apartmentId, await addGuest(tenantId))
    await openSheet(page, booking.id)
    await signAndFinish(page)
    const { data: sheet } = await service().from('guest_sheets').select('id').eq('booking_id', booking.id).single()

    const anonymous = await browser.newContext()
    const anonResponse = await anonymous.request.get(`http://localhost:3000/api/gaesteblatt/${sheet!.id}/pdf`, { maxRedirects: 0 })
    expect([302, 307, 401]).toContain(anonResponse.status())
    await anonymous.close()

    const other = await users({ displayName: 'Fremd' })
    await createTenant('QA26 Fremd', [{ user: other, role: 'owner' }])
    const otherPage = await browser.newPage()
    await signInAs(otherPage, other)
    expect((await otherPage.request.get(`/api/gaesteblatt/${sheet!.id}/pdf`)).status()).toBe(404)
    expect((await otherPage.goto(`/gaesteblatt/${booking.id}`))?.status()).toBe(404)
    const forged = await otherPage.request.post('/api/gaesteblatt/fertig', {
      data: { tenantId, bookingId: booking.id, bookingUpdatedAt: '', guestUpdatedAt: '', previousSheetId: null, marketingConsent: true, signature1: { image: 'data:image/png;base64,AA==', signedAt: new Date().toISOString() }, signature2: { image: 'data:image/png;base64,AA==', signedAt: new Date().toISOString() } },
    })
    expect(forged.status()).toBe(403)
    const invalid = await page.request.post('/api/gaesteblatt/fertig', { data: { tenantId, bookingId: booking.id, signature1: { image: '<script>', signedAt: 'x' } } })
    expect(invalid.status()).toBe(400)
    await otherPage.close()
  })
})

test.describe('QA-Korrekturen', () => {
  test('BUG-1: Unterschrift direkt nach dem Verlassen eines Felds bleibt erhalten', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, apartmentId } = await setup(page, users, 'staff')
    const booking = await addBooking(tenantId, apartmentId, await addGuest(tenantId))
    await openSheet(page, booking.id)
    // Fokus im Feld, sofort zum Stift: Der Strich verlässt das Feld, während noch gespeichert wird
    await page.getByLabel('Straße/Gasse/Platz').fill('Hauptplatz 3')
    await draw(page, 'unterschrift-1')
    await page.waitForTimeout(2000)
    await expect(page.getByText('Unterschrieben.', { exact: true })).toBeVisible()
    await expect(page.getByText('Die Angaben wurden geändert. Bitte erneut unterschreiben.')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Weiter' })).toBeEnabled()
    await page.getByRole('button', { name: 'Weiter' }).click()
    await expect(page.getByRole('heading', { name: 'Einwilligung in Marketing' })).toBeVisible()
    const { data } = await service().from('guests').select('street').eq('id', (await service().from('bookings').select('guest_id').eq('id', booking.id).single()).data!.guest_id!).single()
    expect(data!.street).toBe('Hauptplatz 3')
  })

  test('BUG-1: „Weiter“ bleibt auf Seite 1, wenn eine Angabe nicht gespeichert werden kann', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, apartmentId } = await setup(page, users)
    const booking = await addBooking(tenantId, apartmentId, await addGuest(tenantId))
    await openSheet(page, booking.id)
    await page.getByLabel('Geburtsdatum').fill('2999-01-01')
    await draw(page, 'unterschrift-1')
    await page.getByRole('button', { name: 'Weiter' }).click()
    await expect(page.getByText('Einige Angaben konnten nicht gespeichert werden. Bitte die Felder auf Seite 1 prüfen.')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Mitreisende im familiären Verbund' })).toBeVisible()
  })

  test('BUG-4: Lösch-Dialog eines Gastes, an dem nur ein Gästeblatt hängt, kündigt das Anonymisieren an', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, apartmentId } = await setup(page, users)
    const first = await addGuest(tenantId, { last_name: 'Erstgast' })
    const booking = await addBooking(tenantId, apartmentId, first)
    const path = `${tenantId}/${crypto.randomUUID()}.pdf`
    await service().storage.from('guest-sheets').upload(path, new Blob(['%PDF-1.4'], { type: 'application/pdf' }), { contentType: 'application/pdf' })
    await service().from('guest_sheets').insert({ tenant_id: tenantId, booking_id: booking.id, guest_id: first, kind: 'uploaded', pdf_path: path })
    // Die Buchung gehört inzwischen einem anderen Gast: Am ersten hängt nur noch das Blatt
    await service().from('bookings').update({ guest_id: await addGuest(tenantId, { last_name: 'Zweitgast' }) }).eq('id', booking.id)
    await page.goto(`/gaeste/${first}`)
    await page.waitForFunction(() => Object.keys(document.querySelector('main') ?? {}).some((k) => k.startsWith('__reactFiber')))
    await page.getByRole('button', { name: 'Gast löschen' }).click()
    await expect(page.getByRole('alertdialog')).toContainText('mit Gästeblättern verknüpft')
  })
})

test.describe('Nachbesserung nach dem Deploy', () => {
  test('Fehlende Felder sind rot umrandet, auch PLZ, Ort und Länderauswahl', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, apartmentId } = await setup(page, users)
    const guest = await addGuest(tenantId, { birth_date: null, postal_code: null, city: null, address_country: null })
    const booking = await addBooking(tenantId, apartmentId, guest)
    await openSheet(page, booking.id)
    const red = 'rgb(220, 38, 38)'
    for (const label of ['Geburtsdatum', 'Postleitzahl', 'Ortsgemeinde']) {
      await expect(page.getByLabel(label)).toHaveCSS('border-top-color', red)
    }
    const picker = page.getByRole('combobox', { name: 'Herkunftsland' })
    await expect(picker.locator('xpath=..')).toHaveClass(/ring-red-600/)
    await expect(page.getByLabel('Familienname')).not.toHaveCSS('border-top-color', red)
  })

  test('Ausweisbilder lassen sich bei ausländischen Gästen ohne Bilder aufnehmen; bei Österreichern nicht', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, apartmentId } = await setup(page, users, 'staff')
    const foreign = await addBooking(tenantId, apartmentId, await addGuest(tenantId, { country: 'DE' }))
    await openSheet(page, foreign.id)
    await expect(page.getByText('Bilder des Reisedokuments')).toBeVisible()
    await expect(page.getByText('Vorderseite', { exact: true })).toBeVisible()
    await expect(page.getByText('Rückseite', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Bild hinzufügen' })).toHaveCount(2)
    const local = await addBooking(tenantId, apartmentId, await addGuest(tenantId))
    await openSheet(page, local.id)
    await expect(page.getByText('Bilder des Reisedokuments')).toHaveCount(0)
  })

  test('E-Mail auf Seite 2 nur bei Gästen ohne E-Mail; wird beim Verlassen am Gast gespeichert', async ({ page, users }) => {
    desktopOnly()
    test.setTimeout(90_000)
    const { tenantId, apartmentId } = await setup(page, users, 'staff')
    const guest = await addGuest(tenantId)
    const booking = await addBooking(tenantId, apartmentId, guest)
    await openSheet(page, booking.id)
    await draw(page, 'unterschrift-1')
    await page.getByRole('button', { name: 'Weiter' }).click()
    const email = page.getByLabel('E-Mail-Adresse')
    await email.fill('falsch@')
    await page.getByLabel('Ich willige ein.').click()
    await expect(page.getByText('Bitte prüfe die E-Mail-Adresse')).toBeVisible()
    await email.fill('Anna.Huber@Example.at')
    await page.getByLabel('Ich willige ein.').click()
    await expect(page.getByText('E-Mail-Adresse gespeichert.')).toBeVisible()
    const { data } = await service().from('guests').select('email').eq('id', guest).single()
    expect(data!.email).toBe('anna.huber@example.at')
    await draw(page, 'unterschrift-2')
    await page.getByRole('button', { name: 'Fertig' }).click()
    await page.waitForURL(/\/buchungen\/[^/?]+$/, { timeout: 30_000 })

    const other = await addBooking(tenantId, apartmentId, await addGuest(tenantId, { email: 'schon@example.at' }))
    await openSheet(page, other.id)
    await draw(page, 'unterschrift-1')
    await page.getByRole('button', { name: 'Weiter' }).click()
    await expect(page.getByRole('heading', { name: 'Einwilligung in Marketing' })).toBeVisible()
    await expect(page.getByLabel('E-Mail-Adresse')).toHaveCount(0)
  })
})

test.describe('Layout und Barrierefreiheit', () => {
  test('Vollbild, Liste und Einstellungen ohne automatisch erkennbare WCAG-2.1-AA-Verstöße und ohne seitliches Scrollen', async ({ page, users }) => {
    const { tenantId, apartmentId } = await setup(page, users)
    const booking = await addBooking(tenantId, apartmentId, await addGuest(tenantId, { country: 'IT', birth_date: null }), { adults: 2 })
    for (const path of [`/gaesteblatt/${booking.id}`, '/gaesteblaetter?fehlt=1', '/einstellungen/gaesteblatt', '/einstellungen/stammdaten', `/buchungen/${booking.id}`]) {
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      expect(axe.violations.map((v) => `${path}: ${v.id}`)).toEqual([])
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      expect(overflow, path).toBeLessThanOrEqual(0)
    }
  })
})

// ---- Erweiterung 2026-11-09: Kennzahl und Gästeblattnummer je Gemeinde ---------------------------------------------

const ranges = (tenantId: string) =>
  service().from('guest_sheet_number_ranges').select('range_from, range_to, next_number, exhausted_at').eq('tenant_id', tenantId).order('position')

test.describe('Kennzahl und Gästeblattnummer je Gemeinde', () => {
  test('AC: Kennzahl je Gemeinde in den Stammdaten mit führenden Nullen; Hinweis bei fehlender Kennzahl', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users)
    await service().from('properties').insert({ tenant_id: tenantId, name: 'Haus Burg', street: 'Hauptstraße 1', postal_code: '7000', city: 'Eisenstadt', municipality_code: '10101' })
    await page.goto('/einstellungen/stammdaten')
    await expect(page.getByRole('heading', { name: 'Kennzahlen je Gemeinde' })).toBeVisible()
    await expect(page.getByText('Kennzahl fehlt – wird auf dem Gästeblatt leer gedruckt.')).toHaveCount(2)
    await page.getByLabel('Kennzahl St. Gilgen (50330)').fill('00123')
    await page.getByLabel('Kennzahl Eisenstadt (10101)').fill('12 3')
    await page.getByRole('button', { name: 'Kennzahlen speichern' }).click()
    await expect(page.getByText('Nur Buchstaben, Ziffern und „-“, „/“, „.“ – ohne Leerzeichen.')).toBeVisible()
    await page.getByLabel('Kennzahl Eisenstadt (10101)').fill('')
    await page.getByRole('button', { name: 'Kennzahlen speichern' }).click()
    await expect(page.getByText('Kennzahlen gespeichert.')).toBeVisible()
    await page.reload()
    await expect(page.getByLabel('Kennzahl St. Gilgen (50330)')).toHaveValue('00123')
    await expect(page.getByText('Kennzahl fehlt – wird auf dem Gästeblatt leer gedruckt.')).toHaveCount(1)
  })

  test('AC: Nummer erst beim „Fertig“, Kennzahl im Kopf; Abbrechen verbraucht keine; neu unterschreiben behält die Nummer', async ({ page, users }) => {
    desktopOnly()
    test.setTimeout(120_000)
    const { tenantId, apartmentId } = await setup(page, users, 'staff', false)
    await service().from('guest_sheet_number_ranges').insert({ tenant_id: tenantId, municipality_code: '50330', range_from: '0042', range_to: '0500' })
    await service().from('establishment_numbers').insert({ tenant_id: tenantId, municipality_code: '50330', establishment_number: '00123' })
    // 0043 ist an einer anderen Buchung nacherfasst und wird übersprungen
    await addBooking(tenantId, apartmentId, await addGuest(tenantId, { last_name: 'Alt' }), { sheet: '0043' })
    const booking = await addBooking(tenantId, apartmentId, await addGuest(tenantId))

    await openSheet(page, booking.id)
    await expect(page.getByText('wird beim Abschluss vergeben')).toBeVisible()
    await expect(page.getByText('00123', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Abbrechen' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Abbrechen', exact: true }).click()
    await page.waitForURL(/\/buchungen\//)
    expect((await ranges(tenantId)).data![0].next_number).toBeNull()

    await openSheet(page, booking.id)
    await signAndFinish(page)
    const { data: sheet } = await service().from('guest_sheets').select('sheet_number, snapshot').eq('booking_id', booking.id).single()
    expect(sheet!.sheet_number).toBe('0042')
    expect((sheet!.snapshot as { establishmentNumber: string }).establishmentNumber).toBe('00123')
    await expect(page.getByText('0042', { exact: true }).first()).toBeVisible()

    // Kennzahl später geändert: das Blatt behält die alte
    await service().from('establishment_numbers').update({ establishment_number: '999' }).eq('tenant_id', tenantId)
    await page.getByRole('button', { name: 'Neu unterschreiben lassen' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Neu unterschreiben lassen' }).click()
    await expect(page.getByRole('heading', { name: 'Mitreisende im familiären Verbund' })).toBeVisible()
    await expect(page.getByText('0042', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('999', { exact: true })).toBeVisible()
    await page.waitForTimeout(500)
    await signAndFinish(page)
    const { data: all } = await service().from('guest_sheets').select('sheet_number, snapshot, replaced_at').eq('booking_id', booking.id).order('created_at')
    expect(all!.map((s) => s.sheet_number)).toEqual(['0042', '0042'])
    expect((all![0].snapshot as { establishmentNumber: string }).establishmentNumber).toBe('00123')
    // Zähler: 0042 vergeben, „neu unterschreiben“ hat keine weitere Nummer verbraucht (das Überspringen von 0043 prüft der
    // Integrationstest; die Lesesicht zählt belegte Nummern nur für Mitglieder und Betreiber, nicht für die Service-Rolle)
    expect((await ranges(tenantId)).data![0].next_number).toBe('0043')
  })

  test('AC: Bereiche in den Einstellungen anlegen, Überschneidung abgelehnt, folgenden Bereich löschen; Frühwarnung', async ({ page, users }) => {
    desktopOnly()
    await setup(page, users, 'owner', false)
    await page.goto('/einstellungen/gaesteblatt')
    await expect(page.getByRole('heading', { name: 'Laufende Nummer je Gemeinde' })).toBeVisible()
    await expect(page.getByText('Nummernbereich für St. Gilgen noch nicht festgelegt.')).toBeVisible()

    const add = async (from: string, to: string, next?: string) => {
      await page.getByRole('button', { name: 'Nummernbereich hinzufügen' }).click()
      const dialog = page.getByRole('dialog')
      await dialog.getByLabel('von').fill(from)
      await dialog.getByLabel('bis').fill(to)
      if (next !== undefined) await dialog.getByLabel('Nächste Nummer').fill(next)
      await dialog.getByRole('button', { name: 'Bereich speichern' }).click()
      return dialog
    }
    await add('0001', '0010', '0006')
    await expect(page.getByText('Nummernbereich gespeichert.')).toBeVisible()
    await expect(page.getByText('St. Gilgen: nur noch 5 Nummern frei.')).toBeVisible()
    await expect(page.getByText('Nächste Nummer: 0006 · 5 Nummern frei')).toBeVisible()

    const overlap = await add('0008', '0020')
    await expect(overlap.getByText('Überschneidet sich mit einem anderen Bereich dieser Gemeinde.')).toBeVisible()
    await overlap.getByRole('button', { name: 'Abbrechen' }).click()

    await add('B-0001', 'B-0100')
    await expect(page.getByText('Nummernbereich gespeichert.').first()).toBeVisible()
    await expect(page.getByText(/nur noch .* Nummern frei/)).toHaveCount(0)
    await expect(page.getByRole('cell', { name: 'Folgt' })).toBeVisible()

    await page.getByRole('button', { name: 'Bereich B-0001 bis B-0100 löschen' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Löschen' }).click()
    await expect(page.getByText('Nummernbereich gelöscht.')).toBeVisible()
    await expect(page.getByText('St. Gilgen: nur noch 5 Nummern frei.')).toBeVisible()
    // Bereich in Verwendung lässt sich nicht löschen
    await expect(page.getByRole('button', { name: 'Bereich 0001 bis 0010 löschen' })).toHaveCount(0)
  })

  test('AC: ohne Nummernbereich ist „Gästeblatt“ gesperrt; Dashboard nennt Kunde und Gemeinde, Mitarbeiter ohne Link', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, apartmentId, owner } = await setup(page, users, 'staff', false)
    const booking = await addBooking(tenantId, apartmentId, await addGuest(tenantId))
    await page.goto(`/buchungen/${booking.id}`)
    await expect(page.getByText('Nummernbereich für St. Gilgen noch nicht festgelegt. Bitte in Einstellungen → Gästeblatt einen Nummernbereich erfassen.')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Gästeblatt', exact: true })).toBeDisabled()
    await page.goto(`/gaesteblatt/${booking.id}`)
    await expect(page.getByText('Für die Gemeinde St. Gilgen ist keine Gästeblattnummer verfügbar.', { exact: false })).toBeVisible()

    await page.goto('/')
    const alerts = page.getByRole('region', { name: 'Gästeblattnummern' })
    await expect(alerts).toContainText('QA26 Pichler · Nummernbereich für St. Gilgen (50330) noch nicht festgelegt.')
    await expect(alerts.getByRole('link')).toHaveCount(0)
    await expect(alerts.getByRole('button')).toHaveCount(0)

    // Inhaber: Zeile führt zu den Einstellungen; mit Bereich verschwindet der Hinweis
    await signInAs(page, owner)
    await page.goto('/')
    await page.getByRole('region', { name: 'Gästeblattnummern' }).getByRole('link').click()
    await page.waitForURL(/\/einstellungen\/gaesteblatt/)
    await service().from('guest_sheet_number_ranges').insert({ tenant_id: tenantId, municipality_code: '50330', range_from: '1', range_to: '500' })
    await page.goto('/')
    await expect(page.getByRole('heading', { name: /Guten|Hallo|Grüß/ })).toBeVisible()
    await expect(page.getByRole('region', { name: 'Gästeblattnummern' })).toHaveCount(0)
  })

  test('AC: „Gästeblätter nacherfassen“ aus: kein Nummernfeld, kein Hochladen, Nummer bleibt beim Speichern; ein: beides da', async ({ page, users }) => {
    desktopOnly()
    const { tenantId, apartmentId } = await setup(page, users, 'owner', false)
    await service().from('guest_sheet_number_ranges').insert({ tenant_id: tenantId, municipality_code: '50330', range_from: '0001', range_to: '0500' })
    const booking = await addBooking(tenantId, apartmentId, await addGuest(tenantId), { sheet: 'X-7' })
    await page.goto(`/buchungen/${booking.id}`)
    await expect(page.getByRole('button', { name: 'Gästeblatt hochladen' })).toHaveCount(0)
    await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click()
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Änderungen speichern', exact: true })).toBeEnabled()
    await expect(page.getByLabel(/Gästeblattnummer/)).toHaveCount(0)
    await page.getByRole('dialog').getByRole('button', { name: 'Änderungen speichern', exact: true }).click()
    await expect(page.getByRole('dialog')).toHaveCount(0)
    expect((await service().from('bookings').select('guest_sheet_number').eq('id', booking.id).single()).data!.guest_sheet_number).toBe('X-7')

    await page.goto('/einstellungen/gaesteblatt')
    await page.getByRole('switch', { name: 'Gästeblätter nacherfassen' }).click()
    await page.getByRole('button', { name: 'Speichern', exact: true }).click()
    await expect(page.getByText('Einstellung gespeichert.')).toBeVisible()
    await page.goto(`/buchungen/${booking.id}`)
    await expect(page.getByRole('button', { name: 'Gästeblatt hochladen' })).toBeVisible()
    await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click()
    await expect(page.getByLabel('Gästeblattnummer (optional)')).toHaveValue('X-7')
  })
})
