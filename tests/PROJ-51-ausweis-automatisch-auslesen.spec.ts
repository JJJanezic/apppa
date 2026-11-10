import path from 'node:path'

import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test as base } from '@playwright/test'

import { createTenant, createUser, deleteUser, type E2EUser, hasSupabaseEnv, service, signInAs, signInAsAdmin } from './support/supabase'

// PROJ-51: Ausweis automatisch auslesen. Läuft gegen den Test-Leser (ID_READING_FAKE=1 in .env.local, nie in Produktion):
// Muster „Erika Mustermann“; Nachname „Fehler…“ → Dienst nicht erreichbar, „Kein…“ → kein Ausweis, „Unsicher…“ → Dokument-ID
// unsicher. Abläufe nur im Projekt „desktop“, Barrierefreiheit des Dialogs auch am Handy.

const BUCKET = 'guest-documents'
const fixture = (name: string) => path.join(__dirname, 'fixtures', name)
type Users = (opts?: Parameters<typeof createUser>[0]) => Promise<E2EUser>

const test = base.extend<{ users: Users; tenants: string[] }>({
  tenants: async ({}, use) => {
    const ids: string[] = []
    await use(ids)
    for (const id of ids) {
      const { data } = await service().storage.from(BUCKET).list(id, { limit: 1000 })
      if (data?.length) await service().storage.from(BUCKET).remove(data.map((f) => `${id}/${f.name}`))
      await service().from('tenants').delete().eq('id', id)
    }
  },
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
test.beforeEach(() => {
  test.skip(!hasSupabaseEnv, 'keine .env.local')
})

const desktopOnly = () => test.skip(test.info().project.name !== 'desktop', 'Abläufe nur im Desktop-Projekt')
const ready = (page: Page) =>
  page.waitForFunction(() => Object.keys(document.querySelector('main') ?? {}).some((k) => k.startsWith('__reactFiber')))
const panel = (page: Page) => page.getByRole('dialog').filter({ has: page.getByRole('button', { name: /Reisedokument/ }) })
const comparison = (page: Page) => page.getByRole('dialog', { name: 'Angaben vom Ausweis' })

async function setup(page: Page, users: Users, tenants: string[], opts: { role?: 'owner' | 'staff'; enabled?: boolean; limit?: number } = {}) {
  const owner = await users({ displayName: 'Olga Owner' })
  const staff = await users({ displayName: 'Sam Staff' })
  const tenantId = await createTenant('QA51 Ausweis', [
    { user: owner, role: 'owner' },
    { user: staff, role: 'staff' },
  ])
  tenants.push(tenantId)
  if (opts.enabled ?? true) {
    const { error } = await service().from('id_reading_settings').insert({ tenant_id: tenantId, enabled: true, daily_limit: opts.limit ?? 50 })
    if (error) throw error
  }
  await signInAs(page, opts.role === 'staff' ? staff : owner)
  return { tenantId, owner, staff }
}

async function storeImage(tenantId: string) {
  const name = `${tenantId}/${crypto.randomUUID()}.jpg`
  const { readFileSync } = await import('node:fs')
  const { error } = await service().storage.from(BUCKET).upload(name, readFileSync(fixture('ausweis.jpg')), { contentType: 'image/jpeg' })
  if (error) throw error
  return name
}

async function addGuest(tenantId: string, fields: Record<string, unknown>) {
  const { data, error } = await service()
    .from('guests')
    .insert({ tenant_id: tenantId, country: 'DE', ...fields } as never)
    .select('id')
    .single()
  if (error) throw error
  return (data as { id: string }).id
}

// Gast mit Ausweisbild (Vorderseite) und offenem Bearbeiten-Formular samt Abschnitt „Reisedokument“
async function openGuestForm(page: Page, tenantId: string, fields: Record<string, unknown> = {}) {
  const front = await storeImage(tenantId)
  const id = await addGuest(tenantId, {
    last_name: 'Muster',
    first_name: 'Maria',
    document_type: 'passport',
    document_number: 'X1',
    document_front_path: front,
    ...fields,
  })
  await page.goto(`/gaeste/${id}`)
  await ready(page)
  await page.getByRole('button', { name: 'Bearbeiten' }).click()
  const trigger = panel(page).getByRole('button', { name: /Reisedokument/ })
  if ((await trigger.getAttribute('aria-expanded')) !== 'true') await trigger.click()
  return id
}

const row = (page: Page, label: string) => comparison(page).locator('li').filter({ has: page.getByText(label, { exact: true }) })

test.describe('Gastformular', () => {
  test('AC: ohne Freischaltung kein Knopf; mit Freischaltung und Bild erscheint „Ausweis auslesen“', async ({ page, users, tenants }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users, tenants, { enabled: false })
    await openGuestForm(page, tenantId)
    await expect(panel(page).getByRole('button', { name: 'Ausweis auslesen' })).toHaveCount(0)
    await service().from('id_reading_settings').insert({ tenant_id: tenantId, enabled: true })
    await page.reload()
    await ready(page)
    await page.getByRole('button', { name: 'Bearbeiten' }).click()
    const trigger = panel(page).getByRole('button', { name: /Reisedokument/ })
    if ((await trigger.getAttribute('aria-expanded')) !== 'true') await trigger.click()
    await expect(panel(page).getByRole('button', { name: 'Ausweis auslesen' })).toBeVisible()
  })

  test('AC: Gegenüberstellung mit Abweichung, Neu und Gleich; Übernehmen füllt das Formular, Speichern schreibt mit Vermerk „Ausweis“', async ({ page, users, tenants }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users, tenants)
    const id = await openGuestForm(page, tenantId, { last_name: 'Mustermann', first_name: 'Maria', birth_date: null })
    await panel(page).getByRole('button', { name: 'Ausweis auslesen' }).click()
    await expect(comparison(page)).toBeVisible()
    await expect(row(page, 'Nachname').getByText('Gleich')).toBeVisible()
    await expect(row(page, 'Vorname').getByText('Abweichung')).toBeVisible()
    await expect(row(page, 'Vorname').getByRole('radio', { name: /Vom Ausweis/ })).toBeChecked()
    await expect(row(page, 'Geburtsdatum').getByText('Neu')).toBeVisible()
    await expect(row(page, 'Geburtsdatum').getByText('12.08.1983')).toBeVisible()
    await expect(row(page, 'Ausstellender Staat').getByText('Deutschland')).toBeVisible()
    // Vorname: vorhandenen Wert behalten
    await row(page, 'Vorname').getByRole('radio', { name: /Vorhanden/ }).click()
    await comparison(page).getByRole('button', { name: /Angaben übernehmen/ }).click()
    await expect(comparison(page)).toHaveCount(0)
    await expect(panel(page).getByLabel('Vorname')).toHaveValue('Maria')
    await expect(panel(page).getByLabel('Geburtsdatum')).toHaveValue('1983-08-12')
    await expect(panel(page).getByLabel('Dokument-ID')).toHaveValue('LZ6311T47')
    // erst „Speichern“ schreibt
    expect((await service().from('guests').select('birth_date').eq('id', id).single()).data!.birth_date).toBeNull()
    await panel(page).getByRole('button', { name: 'Speichern', exact: true }).click()
    await expect(panel(page)).toHaveCount(0)
    const { data: guest } = await service().from('guests').select('first_name, birth_date, document_number, document_authority').eq('id', id).single()
    expect(guest).toEqual({ first_name: 'Maria', birth_date: '1983-08-12', document_number: 'LZ6311T47', document_authority: 'Stadt Köln' })
    const { data: log } = await service().from('audit_log').select('actor_label').eq('table_name', 'guests').eq('record_id', id).order('id', { ascending: false }).limit(1).single()
    expect(log!.actor_label).toBe('Ausweis')
    // Auslesung gezählt, ohne gelesene Werte
    const { data: readings } = await service().from('id_readings').select('*').eq('tenant_id', tenantId)
    expect(readings).toHaveLength(1)
    expect(readings![0]).toMatchObject({ outcome: 'read', counted: true, guest_id: id, place: 'guestForm' })
    expect(JSON.stringify(readings)).not.toContain('Mustermann')
  })

  test('AC: Abbrechen ändert nichts', async ({ page, users, tenants }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users, tenants)
    await openGuestForm(page, tenantId)
    await panel(page).getByRole('button', { name: 'Ausweis auslesen' }).click()
    await comparison(page).getByRole('button', { name: 'Abbrechen' }).click()
    await expect(comparison(page)).toHaveCount(0)
    await expect(panel(page).getByLabel('Vorname')).toHaveValue('Maria')
    await expect(panel(page).getByLabel('Dokument-ID')).toHaveValue('X1')
  })

  test('AC: unsicherer Wert gelb und nicht vorausgewählt; fremder Ausweis mit Hinweis ohne Vorauswahl bei Name und Geburtsdatum', async ({ page, users, tenants }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users, tenants)
    await openGuestForm(page, tenantId, { last_name: 'Unsicher', birth_date: '1970-01-01' })
    await panel(page).getByRole('button', { name: 'Ausweis auslesen' }).click()
    await expect(row(page, 'Dokument-ID').getByText('Bitte prüfen')).toBeVisible()
    await expect(row(page, 'Dokument-ID').getByRole('radio', { name: /Vorhanden/ })).toBeChecked()
    await expect(comparison(page).getByText('Der Ausweis passt möglicherweise nicht zu diesem Gast.', { exact: false })).toBeVisible()
    for (const label of ['Nachname', 'Vorname', 'Geburtsdatum']) await expect(row(page, label).getByRole('radio', { name: /Vorhanden/ })).toBeChecked()
    await expect(row(page, 'Ausstellungsdatum').getByRole('radio', { name: /Vom Ausweis/ })).toBeChecked()
  })

  test('AC: Fehler „nicht erreichbar“ und „kein Ausweis“; Felder bleiben bearbeitbar', async ({ page, users, tenants }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users, tenants)
    await openGuestForm(page, tenantId, { last_name: 'Fehlerfall' })
    await panel(page).getByRole('button', { name: 'Ausweis auslesen' }).click()
    await expect(panel(page).getByRole('alert').filter({ hasText: 'Der Ausweis konnte gerade nicht gelesen werden.' })).toBeVisible()
    await expect(panel(page).getByLabel('Dokument-ID')).toBeEditable()
    await panel(page).getByLabel('Nachname').fill('Keinausweis')
    await panel(page).getByRole('button', { name: 'Ausweis auslesen' }).click()
    await expect(panel(page).getByRole('alert').filter({ hasText: 'Auf dem Bild wurde kein Ausweis erkannt.' })).toBeVisible()
    // „nicht erreichbar“ zählt nicht
    const { data } = await service().from('id_readings').select('outcome, counted').eq('tenant_id', tenantId).order('started_at')
    expect(data).toEqual([
      { outcome: 'unreachable', counted: false },
      { outcome: 'no_document', counted: true },
    ])
  })

  test('AC: Tageslimit erreicht → Meldung, nichts gelesen', async ({ page, users, tenants }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users, tenants, { limit: 1 })
    await service().from('id_readings').insert({ tenant_id: tenantId, place: 'guestForm', outcome: 'read' })
    await openGuestForm(page, tenantId)
    await panel(page).getByRole('button', { name: 'Ausweis auslesen' }).click()
    await expect(panel(page).getByRole('alert').filter({ hasText: 'Das Tageslimit für das Auslesen ist erreicht.' })).toBeVisible()
    await expect(comparison(page)).toHaveCount(0)
  })

  test('Barrierefreiheit der Gegenüberstellung (alle Breiten)', async ({ page, users, tenants }) => {
    const { tenantId } = await setup(page, users, tenants)
    await openGuestForm(page, tenantId)
    await panel(page).getByRole('button', { name: 'Ausweis auslesen' }).click()
    await expect(comparison(page)).toBeVisible()
    await page.waitForTimeout(400)
    const results = await new AxeBuilder({ page }).include('[role="dialog"]').analyze()
    expect(results.violations.map((v) => v.id)).toEqual([])
    // kein Querscrollen im Dialog
    const overflow = await comparison(page).evaluate((el) => el.scrollWidth - el.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  })
})

test.describe('Gästeblatt', () => {
  test('AC: Mitarbeiter liest auf Seite 1 aus, Übernehmen speichert sofort mit Vermerk', async ({ page, users, tenants }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users, tenants, { role: 'staff' })
    const { data: property } = await service()
      .from('properties')
      .insert({ tenant_id: tenantId, name: 'Haus See', street: 'Seeweg 12', postal_code: '5340', city: 'St. Gilgen', municipality_code: '50330' })
      .select('id')
      .single()
    const { data: apt } = await service().from('apartments').insert({ tenant_id: tenantId, property_id: property!.id, name: 'Top 1', max_guests: 4, price_cents: 10000 }).select('id').single()
    // Gästeblatt braucht einen freien Nummernbereich der Gemeinde (PROJ-26)
    await service().from('guest_sheet_number_ranges').insert({ tenant_id: tenantId, municipality_code: '50330', range_from: '0001', range_to: '0500' })
    const front = await storeImage(tenantId)
    const guestId = await addGuest(tenantId, { last_name: 'Mustermann', first_name: 'Erika', document_front_path: front, document_type: 'id_card', document_number: 'OLD1' })
    const iso = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10)
    const { data: booking, error } = await service()
      .from('bookings')
      .insert({
        tenant_id: tenantId,
        apartment_id: apt!.id,
        kind: 'booking',
        arrival: iso(0),
        planned_departure: iso(2),
        departure: iso(2),
        guest_id: guestId,
        adults: 1,
        number_year: 2026,
        number_seq: 951,
      })
      .select('id')
      .single()
    if (error) throw error
    await service().from('booking_amounts').insert({ id: booking!.id, tenant_id: tenantId, nights_cents: 20000 })
    await page.setViewportSize({ width: 1180, height: 820 })
    await page.goto(`/gaesteblatt/${booking!.id}`)
    await expect(page.getByRole('heading', { name: 'Reisedokument' })).toBeVisible()
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: 'Ausweis auslesen' }).click()
    await expect(row(page, 'Dokument-ID').getByText('Abweichung')).toBeVisible()
    await comparison(page).getByRole('button', { name: /Angaben übernehmen/ }).click()
    await expect(page.getByRole('status').filter({ hasText: /^Gespeichert$/ })).toBeVisible({ timeout: 10_000 })
    await expect
      .poll(async () => (await service().from('guests').select('document_number').eq('id', guestId).single()).data!.document_number)
      .toBe('LZ6311T47')
    const { data: labels } = await service().from('audit_log').select('actor_label').eq('table_name', 'guests').eq('record_id', guestId)
    expect(labels!.map((l) => l.actor_label)).toContain('Gästeblatt, aus Ausweis gelesen')
  })
})

test.describe('Betreiber und Inhaber', () => {
  test('AC: Betreiber schaltet frei und setzt das Tageslimit; Zähler sichtbar', async ({ page, users, tenants }) => {
    desktopOnly()
    const admin = await users({ displayName: 'Ada Admin', admin: true })
    const tenantId = await createTenant('QA51 Betreiber', [{ user: admin, role: 'owner' }])
    tenants.push(tenantId)
    await signInAsAdmin(page, admin)
    await page.goto(`/betreiber/kunden/${tenantId}`)
    await ready(page)
    const section = page.locator('section', { has: page.getByRole('heading', { name: 'Ausweis automatisch auslesen (experimentell)' }) })
    await expect(section.getByRole('switch')).not.toBeChecked()
    await expect(section.getByText('Auslesungen laufender Monat')).toBeVisible()
    await section.getByRole('switch').click()
    await section.getByLabel('Tageslimit (Auslesungen pro Tag)').fill('20')
    await section.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Einstellung gespeichert.')).toBeVisible()
    await expect
      .poll(async () => (await service().from('id_reading_settings').select('enabled, daily_limit').eq('tenant_id', tenantId).maybeSingle()).data)
      .toEqual({ enabled: true, daily_limit: 20 })
    await section.getByLabel('Tageslimit (Auslesungen pro Tag)').fill('0')
    await expect(section.getByText('Bitte eine ganze Zahl von 1 bis 1000 eingeben.')).toBeVisible()
    await expect(section.getByRole('button', { name: 'Speichern' })).toBeDisabled()
  })

  test('AC: Inhaber mit eigenem Datenschutz-Text sieht den Hinweis einmal; „Verstanden“ blendet ihn aus', async ({ page, users, tenants }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users, tenants)
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Eigener Text' }] }] }
    const { error } = await service().from('guest_sheet_settings').insert({ tenant_id: tenantId, privacy_text: doc } as never)
    if (error) throw error
    await page.goto('/einstellungen/gaesteblatt')
    await ready(page)
    await expect(page.getByText('Datenschutz-Information prüfen')).toBeVisible()
    await page.getByRole('button', { name: 'Verstanden' }).click()
    await expect(page.getByText('Datenschutz-Information prüfen')).toHaveCount(0)
    await page.reload()
    await ready(page)
    await expect(page.getByText('Datenschutz-Information prüfen')).toHaveCount(0)
  })

  test('AC: Mitarbeiter sieht im Gast-Detail eines bestehenden Gastes keinen Knopf (kein Bearbeiten)', async ({ page, users, tenants }) => {
    desktopOnly()
    const { tenantId } = await setup(page, users, tenants, { role: 'staff' })
    const id = await addGuest(tenantId, { last_name: 'Muster', document_type: 'passport', document_number: 'X1', document_front_path: await storeImage(tenantId) })
    await page.goto(`/gaeste/${id}`)
    await ready(page)
    await expect(page.getByRole('button', { name: 'Bearbeiten' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Ausweis auslesen' })).toHaveCount(0)
  })
})
