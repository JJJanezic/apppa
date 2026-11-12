import { randomUUID } from 'node:crypto'

import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test as base } from '@playwright/test'

import { noErrorFlash } from './support/error-flash'
import { deDate, viennaDay } from './support/format'
import { createTenant, createUser, deleteUser, type E2EUser, hasSupabaseEnv, service, signInAs } from './support/supabase'

// PROJ-19: Marketing-Einwilligung verwalten. Abläufe nur im Projekt „desktop“ (und auf Wunsch Firefox), Layout und
// Barrierefreiheit in allen Breiten. Testdaten über die Datenbank; Kunden verschwinden mit dem Löschen ihrer Inhaber.

const test = base.extend<{ users: (opts?: Parameters<typeof createUser>[0]) => Promise<E2EUser>; noErrorFlash: void }>({
  noErrorFlash,
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
const desktopOnly = () => test.skip(!['desktop', 'firefox'].includes(test.info().project.name), 'Abläufe nur im Desktop-Projekt (und auf Wunsch Firefox)')
const ready = (page: Page) =>
  page.waitForFunction(() => Object.keys(document.querySelector('main') ?? {}).some((k) => k.startsWith('__reactFiber')))
const section = (page: Page) => page.getByRole('region', { name: 'Marketing-Einwilligung' })
const panel = (page: Page) => page.getByRole('dialog')
const today = () => viennaDay(new Date())
const day = (offset: number) => viennaDay(new Date(Date.now() + offset * 86_400_000))

async function setup(users: Users) {
  const owner = await users({ displayName: 'Olga Owner' })
  const staff = await users({ displayName: 'Sam Staff' })
  const tenantId = await createTenant('QA19 Einwilligung', [
    { user: owner, role: 'owner' },
    { user: staff, role: 'staff' },
  ])
  return { tenantId, owner, staff }
}

async function addGuest(tenantId: string, over: Record<string, unknown> = {}) {
  const { data, error } = await service()
    .from('guests')
    .insert({ tenant_id: tenantId, last_name: 'Huber', first_name: 'Anna', email: 'anna@example.at', ...over })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

// Eintrag direkt in der Datenbank (wie die Übernahme aus Gästeblättern bzw. ein früher erfasster Eintrag)
async function addEvent(tenantId: string, guestId: string, over: Record<string, unknown>) {
  const { data, error } = await service()
    .from('marketing_consent_events')
    .insert({ tenant_id: tenantId, guest_id: guestId, kind: 'grant', origin: 'manual', channel: 'email', occurred_on: day(-10), ...over } as never)
    .select('id')
    .single()
  if (error) throw error
  return (data as { id: string }).id
}

// Hochgeladenes Gästeblatt mit Lfd.-Nr. an einer Buchung des Gastes
async function addSheet(tenantId: string, guestId: string, sheetNumber: string) {
  const { data: property } = await service()
    .from('properties')
    .insert({ tenant_id: tenantId, name: 'Haus See', street: 'Seeweg 12', postal_code: '5340', city: 'St. Gilgen', municipality_code: '50330' })
    .select('id')
    .single()
  const { data: apt } = await service().from('apartments').insert({ tenant_id: tenantId, property_id: property!.id, name: 'Top 1', max_guests: 4, price_cents: 10000 }).select('id').single()
  const { data: booking, error } = await service()
    .from('bookings')
    .insert({
      tenant_id: tenantId, apartment_id: apt!.id, kind: 'booking', arrival: '2026-08-10', planned_departure: '2026-08-14', departure: '2026-08-14',
      guest_id: guestId, check_in: '15:00', check_out: '10:00', adults: 1, number_year: 2026, number_seq: 901,
    })
    .select('id')
    .single()
  if (error) throw error
  await service().from('booking_amounts').insert({ id: booking.id, tenant_id: tenantId, nights_cents: 30000 })
  const path = `${tenantId}/${randomUUID()}.pdf`
  await service().storage.from('guest-sheets').upload(path, new Blob(['%PDF-1.4'], { type: 'application/pdf' }), { contentType: 'application/pdf' })
  const { data: sheet, error: sheetError } = await service()
    .from('guest_sheets')
    .insert({ tenant_id: tenantId, booking_id: booking.id, guest_id: guestId, kind: 'uploaded', pdf_path: path, sheet_number: sheetNumber, marketing_consent: true, signed_on: '2026-08-12' })
    .select('id')
    .single()
  if (sheetError) throw sheetError
  return sheet.id
}

async function openGuest(page: Page, guestId: string) {
  await page.goto(`/gaeste/${guestId}`)
  await ready(page)
  await expect(section(page)).toBeVisible()
}

async function chooseChannel(page: Page, label: string) {
  await panel(page).getByRole('combobox', { name: 'Weg' }).click()
  await page.getByRole('option', { name: label, exact: true }).click()
}

test.beforeEach(() => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')
})

test.describe('Anzeige', () => {
  test('AC: Erteilung über Gästeblatt mit Stand, Verweis und PDF-Link; ohne „Als irrtümlich markieren“ (auch für Mitarbeiter sichtbar)', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const guest = await addGuest(s.tenantId)
    const sheet = await addSheet(s.tenantId, guest, '2026/014')
    await addEvent(s.tenantId, guest, { origin: 'sheet_upload', channel: null, guest_sheet_id: sheet, occurred_on: '2026-08-12' })
    for (const user of [s.owner, s.staff]) {
      await signInAs(page, user)
      await openGuest(page, guest)
      await expect(section(page).getByText('Eingewilligt seit Mi, 12.08.2026 – über Gästeblatt 2026/014')).toBeVisible()
      const link = section(page).getByRole('link', { name: /2026\/014/ })
      await expect(link).toHaveAttribute('href', `/api/gaesteblatt/${sheet}/pdf`)
      await expect(section(page).getByText('Über nacherfasstes Gästeblatt')).toBeVisible()
      await expect(section(page).getByRole('button', { name: 'Als irrtümlich markieren' })).toHaveCount(0)
      const pdf = await page.request.get(`/api/gaesteblatt/${sheet}/pdf`)
      expect(pdf.status()).toBe(200)
    }
  })

  test('Abschnitt „Buchungen“ steht über „Marketing-Einwilligung“ (Wunsch nach dem Deploy, 2026-11-12)', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const guest = await addGuest(s.tenantId)
    await addSheet(s.tenantId, guest, '2026/040')
    await signInAs(page, s.owner)
    await openGuest(page, guest)
    const bookings = page.getByRole('heading', { name: 'Buchungen', level: 2 })
    const consent = page.getByRole('heading', { name: 'Marketing-Einwilligung', level: 2 })
    await expect(bookings).toBeVisible()
    const [b, c] = [await bookings.boundingBox(), await consent.boundingBox()]
    expect(b!.y).toBeLessThan(c!.y)
  })

  test('AC: ohne Eintrag „Keine Einwilligung“, leerer Zustand, kein „Widerruf erfassen“', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const guest = await addGuest(s.tenantId)
    await signInAs(page, s.staff)
    await openGuest(page, guest)
    await expect(section(page).getByText('Keine Einwilligung', { exact: true })).toBeVisible()
    await expect(section(page).getByText('Noch keine Einwilligung erfasst. Gäste willigen in der Regel auf dem Gästeblatt ein.')).toBeVisible()
    await expect(section(page).getByRole('button', { name: 'Einwilligung erfassen' })).toBeVisible()
    await expect(section(page).getByRole('button', { name: 'Widerruf erfassen' })).toHaveCount(0)
  })

  test('AC: Hinweis bei Einwilligung ohne eigene E-Mail oder Anschrift (Plattform-Adresse zählt nicht)', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const platform = await addGuest(s.tenantId, { email: 'x1@guest.booking.com', email_source: 'platform' })
    await addEvent(s.tenantId, platform, {})
    const own = await addGuest(s.tenantId, { last_name: 'Eigen' })
    await addEvent(s.tenantId, own, {})
    await signInAs(page, s.owner)
    await openGuest(page, platform)
    await expect(section(page).getByText('Eingewilligt, aber keine eigene E-Mail-Adresse oder Anschrift erfasst.')).toBeVisible()
    await openGuest(page, own)
    await expect(section(page).getByText(/Eingewilligt seit/)).toBeVisible()
    await expect(section(page).getByText('Eingewilligt, aber keine eigene E-Mail-Adresse oder Anschrift erfasst.')).toHaveCount(0)
  })
})

test.describe('Erteilung von Hand', () => {
  test('AC: Mitarbeiter erfasst Erteilung per E-Mail; Hinweis ohne Beleg; „Mündlich“ nicht wählbar; Stand und „Erfasst von“', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const guest = await addGuest(s.tenantId)
    await signInAs(page, s.staff)
    await openGuest(page, guest)
    await section(page).getByRole('button', { name: 'Einwilligung erfassen' }).click()
    await expect(panel(page).getByText('Ohne Beleg lässt sich die Einwilligung später schwer nachweisen.')).toBeVisible()
    await panel(page).getByRole('combobox', { name: 'Weg' }).click()
    await expect(page.getByRole('option', { name: 'E-Mail', exact: true })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Mündlich/telefonisch' })).toHaveCount(0)
    await page.getByRole('option', { name: 'E-Mail', exact: true }).click()
    await panel(page).getByLabel('Notiz').fill('Mail vom 3.12. an info@')
    await panel(page).getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Einwilligung erfasst.', { exact: true })).toBeVisible()
    await expect(section(page).getByText(`Eingewilligt seit ${deDate(today())}`, { exact: true })).toBeVisible()
    await expect(section(page).getByText('Weg: E-Mail')).toBeVisible()
    await expect(section(page).getByText('Mail vom 3.12. an info@')).toBeVisible()
    await expect(section(page).getByText(new RegExp(`Erfasst von Sam Staff am ${deDate(today()).replaceAll('.', '\\.')}`))).toBeVisible()
    const { data } = await service().from('marketing_consent_events').select('created_by, channel').eq('guest_id', guest).single()
    expect(data).toEqual({ created_by: s.staff.id, channel: 'email' })
  })

  test('AC: Datum in der Zukunft oder ohne Weg → Fehlermeldung am Feld, nichts gespeichert', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const guest = await addGuest(s.tenantId, { birth_date: '1990-05-01' })
    await signInAs(page, s.owner)
    await openGuest(page, guest)
    await section(page).getByRole('button', { name: 'Einwilligung erfassen' }).click()
    await panel(page).getByRole('button', { name: 'Speichern' }).click()
    await expect(panel(page).getByText('Bitte den Weg wählen.')).toBeVisible()
    await chooseChannel(page, 'E-Mail')
    await panel(page).getByLabel('Eingewilligt am').fill(day(1))
    await panel(page).getByRole('button', { name: 'Speichern' }).click()
    await expect(panel(page).getByText('Das Datum darf nicht in der Zukunft liegen.')).toBeVisible()
    await panel(page).getByLabel('Eingewilligt am').fill('1990-04-30')
    await panel(page).getByRole('button', { name: 'Speichern' }).click()
    await expect(panel(page).getByText('Das Datum liegt vor dem Geburtsdatum des Gastes.')).toBeVisible()
    const { count } = await service().from('marketing_consent_events').select('id', { count: 'exact', head: true }).eq('guest_id', guest)
    expect(count).toBe(0)
  })

  test('AC: HEIC-Foto als Beleg wird als JPEG abgelegt und lässt sich öffnen; falsches Format abgelehnt', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const guest = await addGuest(s.tenantId)
    await signInAs(page, s.staff)
    await openGuest(page, guest)
    await section(page).getByRole('button', { name: 'Einwilligung erfassen' }).click()
    await chooseChannel(page, 'Schriftlich (Papier)')
    const file = panel(page).locator('#einwilligung-beleg')
    await file.setInputFiles({ name: 'brief.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from('x') })
    await expect(panel(page).getByText('Bitte ein PDF oder ein Bild (JPEG, PNG, HEIC, WebP) wählen.')).toBeVisible()
    await file.setInputFiles('tests/fixtures/ausweis.heic')
    await expect(panel(page).getByText('ausweis.heic')).toBeVisible({ timeout: 30_000 })
    await expect(panel(page).getByText('Ohne Beleg lässt sich die Einwilligung später schwer nachweisen.')).toHaveCount(0)
    await panel(page).getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Einwilligung erfasst.', { exact: true })).toBeVisible()
    const { data } = await service().from('marketing_consent_events').select('receipt_path').eq('guest_id', guest).single()
    expect(data!.receipt_path).toMatch(new RegExp(`^${s.tenantId}/[0-9a-f-]{36}\\.jpg$`))
    const popup = page.waitForEvent('popup')
    await section(page).getByRole('button', { name: 'Beleg öffnen' }).click()
    const win = await popup
    await win.waitForURL(/marketing-consent-receipts/)
    await win.close()
  })
})

test.describe('Widerruf', () => {
  test('AC: Mitarbeiter widerruft mündlich mit heutigem Datum; Erteilung bleibt im Verlauf; danach kein „Widerruf erfassen“', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const guest = await addGuest(s.tenantId)
    await addEvent(s.tenantId, guest, { occurred_on: day(-20) })
    await signInAs(page, s.staff)
    await openGuest(page, guest)
    await section(page).getByRole('button', { name: 'Widerruf erfassen' }).click()
    await chooseChannel(page, 'Mündlich/telefonisch')
    await expect(panel(page).getByText('Ohne Beleg lässt sich die Einwilligung später schwer nachweisen.')).toHaveCount(0)
    await panel(page).getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Widerruf erfasst.', { exact: true })).toBeVisible()
    await expect(section(page).getByText(`Widerrufen am ${deDate(today())}`, { exact: true })).toBeVisible()
    await expect(section(page).getByText('Einwilligung erteilt')).toBeVisible()
    await expect(section(page).getByRole('button', { name: 'Widerruf erfassen' })).toHaveCount(0)
    await expect(section(page).getByRole('button', { name: 'Einwilligung erfassen' })).toBeVisible()
  })

  test('AC: Widerruf vor der jüngsten Erteilung → Hinweis vor dem Speichern, Stand bleibt „Erteilt“', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const guest = await addGuest(s.tenantId)
    await addEvent(s.tenantId, guest, { occurred_on: day(-5) })
    await signInAs(page, s.owner)
    await openGuest(page, guest)
    await section(page).getByRole('button', { name: 'Widerruf erfassen' }).click()
    await panel(page).getByLabel('Widerrufen am').fill(day(-7))
    await expect(panel(page).getByText(`Liegt vor dem letzten Eintrag vom ${deDate(day(-5))} und ändert den Stand nicht.`)).toBeVisible()
    await chooseChannel(page, 'E-Mail')
    await panel(page).getByRole('button', { name: 'Speichern' }).click()
    const alert = page.getByRole('alertdialog')
    await expect(alert.getByText(`Der Widerruf liegt vor der letzten Einwilligung vom ${deDate(day(-5))} und ändert den Stand nicht.`)).toBeVisible()
    await alert.getByRole('button', { name: 'Trotzdem speichern' }).click()
    await expect(page.getByText('Widerruf erfasst.', { exact: true })).toBeVisible()
    await expect(section(page).getByText(`Eingewilligt seit ${deDate(day(-5))}`, { exact: true })).toBeVisible()
    await expect(section(page).getByRole('listitem')).toHaveCount(2)
  })

  test('AC: neue Erteilung über Gästeblatt nach Widerruf gilt wieder; Widerruf bleibt im Verlauf', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const guest = await addGuest(s.tenantId)
    await addEvent(s.tenantId, guest, { occurred_on: '2026-07-01' })
    await addEvent(s.tenantId, guest, { kind: 'revoke', channel: 'oral', occurred_on: '2026-08-01' })
    const sheet = await addSheet(s.tenantId, guest, '2026/020')
    await addEvent(s.tenantId, guest, { origin: 'sheet_upload', channel: null, guest_sheet_id: sheet, occurred_on: '2026-08-12' })
    await signInAs(page, s.owner)
    await openGuest(page, guest)
    await expect(section(page).getByText('Eingewilligt seit Mi, 12.08.2026 – über Gästeblatt 2026/020')).toBeVisible()
    await expect(section(page).getByText('Widerrufen', { exact: true })).toBeVisible()
  })
})

test.describe('Irrtümlich markieren', () => {
  test('AC: Inhaber markiert mit Grund; ohne Grund Fehlermeldung; durchgestrichen mit Grund, Person, Datum; Stand aus den übrigen Einträgen', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const guest = await addGuest(s.tenantId)
    await addEvent(s.tenantId, guest, { occurred_on: day(-10) })
    await addEvent(s.tenantId, guest, { kind: 'revoke', channel: 'other', occurred_on: day(-2) })
    await signInAs(page, s.owner)
    await openGuest(page, guest)
    await expect(section(page).getByText(`Widerrufen am ${deDate(day(-2))}`, { exact: true })).toBeVisible()
    await section(page).getByRole('button', { name: 'Als irrtümlich markieren' }).first().click()
    await panel(page).getByRole('button', { name: 'Als irrtümlich markieren' }).click()
    await expect(panel(page).getByText('Bitte einen Grund angeben.')).toBeVisible()
    await panel(page).getByLabel('Grund').fill('beim falschen Gast erfasst')
    await panel(page).getByRole('button', { name: 'Als irrtümlich markieren' }).click()
    await expect(page.getByText('Eintrag als irrtümlich markiert.', { exact: true })).toBeVisible()
    await expect(section(page).getByText(`Irrtümlich – beim falschen Gast erfasst (Olga Owner, ${deDate(today())})`)).toBeVisible()
    await expect(section(page).getByText(`Eingewilligt seit ${deDate(day(-10))}`, { exact: true })).toBeVisible()
    // nur noch die Erteilung ist markierbar
    await expect(section(page).getByRole('button', { name: 'Als irrtümlich markieren' })).toHaveCount(1)
  })

  test('AC: Mitarbeiter sehen „Als irrtümlich markieren“ nicht', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const guest = await addGuest(s.tenantId)
    await addEvent(s.tenantId, guest, {})
    await signInAs(page, s.staff)
    await openGuest(page, guest)
    await expect(section(page).getByText(/Eingewilligt seit/)).toBeVisible()
    await expect(section(page).getByRole('button', { name: 'Als irrtümlich markieren' })).toHaveCount(0)
  })
})

test.describe('Gästeliste', () => {
  test('AC: Filter „Erteilt“, „Widerrufen“, „Keine“ zusammen mit der Suche; anonymisierter Gast nie „Erteilt“', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const granted = await addGuest(s.tenantId, { last_name: 'Erteiltmann' })
    await addEvent(s.tenantId, granted, {})
    const revoked = await addGuest(s.tenantId, { last_name: 'Widerrufer' })
    await addEvent(s.tenantId, revoked, { occurred_on: day(-10) })
    await addEvent(s.tenantId, revoked, { kind: 'revoke', channel: 'oral', occurred_on: day(-1) })
    const none = await addGuest(s.tenantId, { last_name: 'Keinermann' })
    const anon = await addGuest(s.tenantId, { last_name: 'Früher', first_name: 'Erteilt' })
    await addEvent(s.tenantId, anon, {})
    await service().from('guests').update({ anonymized_at: new Date().toISOString(), last_name: 'Gelöschter Gast', first_name: null, marketing_consent_state: 'none', marketing_consent_on: null }).eq('id', anon)
    await signInAs(page, s.owner)
    await page.goto('/gaeste')
    await ready(page)
    await page.getByRole('combobox', { name: 'Marketing-Einwilligung' }).click()
    await page.getByRole('option', { name: 'Erteilt', exact: true }).click()
    await expect(page).toHaveURL(/einwilligung=erteilt/)
    const names = page.getByRole('table').locator(`a[href^="/gaeste/"]:not([href^="/gaeste/firmen"])`)
    await expect(names).toHaveCount(1)
    await expect(names.first()).toHaveAttribute('href', `/gaeste/${granted}`)
    await page.goto('/gaeste?einwilligung=widerrufen')
    await ready(page)
    await expect(names).toHaveCount(1)
    await expect(names.first()).toHaveAttribute('href', `/gaeste/${revoked}`)
    await page.goto('/gaeste?einwilligung=keine&q=Keiner')
    await ready(page)
    await expect(names).toHaveCount(1)
    await expect(names.first()).toHaveAttribute('href', `/gaeste/${none}`)
    await page.goto('/gaeste?einwilligung=erteilt&q=Widerrufer')
    await ready(page)
    await expect(names).toHaveCount(0)
  })
})

test.describe('Anonymisieren', () => {
  test('AC: Verlauf bleibt ohne Notiz und Beleg, Stand „Keine“, keine Knöpfe; Beleg-Datei gelöscht', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const guest = await addGuest(s.tenantId)
    const receipt = `${s.tenantId}/${randomUUID()}.pdf`
    await service().storage.from('marketing-consent-receipts').upload(receipt, new Blob(['%PDF-1.4'], { type: 'application/pdf' }), { contentType: 'application/pdf' })
    await addEvent(s.tenantId, guest, { note: 'Notiz mit Daten', receipt_path: receipt })
    await addSheet(s.tenantId, guest, '2026/030')
    await signInAs(page, s.owner)
    await openGuest(page, guest)
    await expect(section(page).getByText('Notiz mit Daten')).toBeVisible()
    await page.getByRole('button', { name: 'Gast löschen' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Anonymisieren' }).click()
    await expect(page.getByText(/wurde am .* anonymisiert/)).toBeVisible()
    await expect(section(page).getByText('Keine Einwilligung', { exact: true })).toBeVisible()
    await expect(section(page).getByText('Einwilligung erteilt')).toBeVisible()
    await expect(section(page).getByText('Weg: E-Mail')).toBeVisible()
    await expect(section(page).getByText('Notiz mit Daten')).toHaveCount(0)
    await expect(section(page).getByRole('button', { name: 'Beleg öffnen' })).toHaveCount(0)
    await expect(section(page).getByRole('button')).toHaveCount(0)
    const { data: files } = await service().storage.from('marketing-consent-receipts').list(s.tenantId)
    expect(files ?? []).toHaveLength(0)
  })
})

test.describe('Rechte', () => {
  test('AC: Nutzer eines anderen Kunden sehen den Gast samt Verlauf nicht', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const guest = await addGuest(s.tenantId)
    await addEvent(s.tenantId, guest, { note: 'geheim' })
    const stranger = await users({ displayName: 'Fremd' })
    await createTenant('QA19 Fremd', [{ user: stranger, role: 'owner' }])
    await signInAs(page, stranger)
    const res = await page.goto(`/gaeste/${guest}`)
    expect(res?.status()).toBe(404)
    await expect(page.getByText('geheim')).toHaveCount(0)
  })
})

test.describe('Layout und Barrierefreiheit', () => {
  test('Abschnitt, Dialog und Filter ohne waagrechtes Scrollen und ohne axe-Verstöße', async ({ page, users }) => {
    const s = await setup(users)
    const guest = await addGuest(s.tenantId)
    await addEvent(s.tenantId, guest, { occurred_on: day(-10), note: 'Eine längere Notiz, die am Handy umbrechen muss, ohne dass die Seite seitlich scrollt.' })
    await addEvent(s.tenantId, guest, { kind: 'revoke', channel: 'oral', occurred_on: day(-3) })
    await signInAs(page, s.owner)
    const check = async (label: string) => {
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      expect(results.violations, label).toEqual([])
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, label).toBeLessThanOrEqual(0)
    }
    await openGuest(page, guest)
    await check('Gastseite')
    await section(page).getByRole('button', { name: 'Einwilligung erfassen' }).click()
    await expect(panel(page).getByRole('combobox', { name: 'Weg' })).toBeVisible()
    await page.waitForTimeout(400)
    await check('Dialog')
    await page.keyboard.press('Escape')
    await page.goto('/gaeste?einwilligung=widerrufen')
    await ready(page)
    await check('Gästeliste')
  })
})
