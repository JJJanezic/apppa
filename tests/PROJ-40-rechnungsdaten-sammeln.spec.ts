import { randomUUID } from 'node:crypto'

import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test as base } from '@playwright/test'

import type { Json } from '../src/types/database'
import { anon, createTenant, createUser, deleteUser, type E2EUser, hasSupabaseEnv, service, signInAs } from './support/supabase'

// PROJ-40: Rechnungsdaten sammeln (Entwurf). Die Datenbank-Regeln prüft supabase/tests/invoice-drafts.integration.test.ts;
// hier die Abläufe in der Oberfläche. Abläufe im Desktop-Projekt, Layout auch auf Tablet und Handy.

type Users = (opts?: Parameters<typeof createUser>[0]) => Promise<E2EUser>

const test = base.extend<{ users: Users }>({
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

const desktopOnly = () => test.skip(['tablet', 'mobile'].includes(test.info().project.name), 'Abläufe nur im Desktop-Projekt')
const ready = (page: Page) =>
  page.waitForFunction(() => Object.keys(document.querySelector('main') ?? {}).some((k) => k.startsWith('__reactFiber')))
const text = (s: string) => s.replace(/[  ]/g, ' ').replace(/\s+/g, ' ')

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
  const tenantId = await createTenant(`QA40 Testkunde ${randomUUID().slice(0, 8)}`, members)
  // Aussteller vollständig (Pflichtangaben)
  await service()
    .from('tenants')
    .update({ address_line1: 'Seeweg 12', postal_code: '5340', city: 'St. Gilgen', country: 'AT', vat_id: 'ATU12345678' } as never)
    .eq('id', tenantId)
  return { owner, staff: staffUser, tenantId }
}

let seq = 4000
async function addApartment(tenantId: string) {
  const { data: property, error } = await service()
    .from('properties')
    .insert({ tenant_id: tenantId, name: 'Haus See', street: 'Seeweg 12', postal_code: '5340', city: 'St. Gilgen', municipality_code: '50330' })
    .select('id')
    .single()
  if (error) throw error
  const { data, error: e } = await service()
    .from('apartments')
    .insert({ tenant_id: tenantId, property_id: property.id, name: 'Top 3', max_guests: 4, price_cents: 10000 } as never)
    .select('id')
    .single()
  if (e) throw e
  return (data as { id: string }).id
}

type GuestSeed = { last?: string; first?: string; company?: string; companyVat?: string; titlePrefix?: string; gender?: string }
async function addGuest(tenantId: string, g: GuestSeed = {}) {
  const company = g.company
    ? { company_name: g.company, company_vat_id: g.companyVat ?? null, company_address_line1: 'Hauptplatz 1', company_postal_code: '4020', company_city: 'Linz', company_country: 'AT' }
    : {}
  const { data, error } = await service()
    .from('guests')
    .insert({
      tenant_id: tenantId,
      country: 'AT',
      last_name: g.last ?? 'Huber',
      first_name: g.first ?? 'Maria',
      title_prefix: g.titlePrefix ?? null,
      gender: g.gender ?? 'female',
      street: 'Gartenweg 3',
      postal_code: '5020',
      city: 'Salzburg',
      address_country: 'AT',
      ...company,
    } as never)
    .select('id')
    .single()
  if (error) throw error
  return (data as { id: string }).id
}

type Seed = { label: string; cents: number; rate: number }
async function addBooking(
  tenantId: string,
  apartmentId: string,
  b: { guestId?: string; kind?: 'booking' | 'option' | 'block'; arrival?: string; departure?: string; nights?: number; nightsRate?: number; charges?: Seed[]; cancelled?: boolean; fee?: number } = {}
) {
  const kind = b.kind ?? 'booking'
  const block = kind === 'block'
  const arrival = b.arrival ?? '2026-10-14'
  const departure = b.departure ?? '2026-10-17'
  const { data, error } = await service()
    .from('bookings')
    .insert({
      tenant_id: tenantId,
      apartment_id: apartmentId,
      kind,
      arrival,
      planned_departure: departure,
      departure,
      guest_id: block ? null : b.guestId,
      check_in: block ? null : '15:00',
      check_out: block ? null : '10:00',
      adults: block ? null : 2,
      child_ages: [],
      number_year: block ? null : Number(arrival.slice(0, 4)),
      number_seq: block ? null : ++seq,
      option_until: kind === 'option' ? '2026-12-31' : null,
      block_reason: block ? 'owner_use' : null,
      cancelled_at: b.cancelled ? new Date().toISOString() : null,
    } as never)
    .select('id, number')
    .single()
  if (error) throw error
  const row = data as { id: string; number: string | null }
  if (!block) {
    const { error: amountError } = await service()
      .from('booking_amounts')
      .insert({
        id: row.id,
        tenant_id: tenantId,
        nights_cents: b.nights ?? 90000,
        nights_vat_rate: b.nightsRate ?? 10,
        cancellation_fee_cents: b.fee ?? null,
        cancellation_fee_vat_rate: 0,
      } as never)
    if (amountError) throw amountError
    for (const [i, c] of (b.charges ?? []).entries()) {
      const { error: chargeError } = await service()
        .from('booking_charges')
        .insert({ booking_id: row.id, tenant_id: tenantId, label: c.label, amount_cents: c.cents, position: i + 1, vat_rate: c.rate })
      if (chargeError) throw chargeError
    }
  }
  return row
}

type DraftLine = { label: string; amount_cents: number; vat_rate: string; source_kind?: string | null; source_charge_id?: string | null }
// Entwurf wie die Server-Aktion ihn speichert (im Namen des Inhabers)
async function addDraft(owner: E2EUser, tenantId: string, bookingId: string, over: Record<string, unknown> = {}) {
  const client = await signedIn(owner)
  const { data, error } = await client.rpc('save_invoice_draft', {
    p_input: {
      id: null,
      updated_at: null,
      tenant_id: tenantId,
      booking_id: bookingId,
      kind: 'invoice',
      invoice_date: '2026-10-20',
      recipient_kind: 'guest',
      recipient: { name: 'Maria Huber', line1: 'Gartenweg 3', line2: '', postal_code: '5020', city: 'Salzburg', country: 'AT', vat_id: '' },
      company_salutation: 'generic',
      guest_names: 'none',
      partial: null,
      lines: [{ label: 'Übernachtung', amount_cents: 90000, vat_rate: '10.00', source_kind: 'nights', source_charge_id: null }] satisfies DraftLine[],
      deduction_ids: [],
      texts: { intro: { block_id: null, body: null }, payment: { block_id: null, body: null }, closing: { block_id: null, body: null } },
      payment: { deposit_percent: null, deposit_days: null, due_days: 0, due_basis: 'after_invoice' },
      booking_fingerprint: null,
      ...over,
    } as unknown as Json,
  })
  if (error) throw error
  return data as string
}

const partial = (cents: number, lines: DraftLine[]) => ({ kind: 'partial', partial: { mode: 'amount', percent: null, amount_cents: cents }, lines })

async function addBackfilled(owner: E2EUser, tenantId: string, bookingId: string, cents: number, number = `AR-${randomUUID().slice(0, 6)}`) {
  const client = await signedIn(owner)
  const { data, error } = await client.rpc('save_invoice', {
    p_input: {
      tenant_id: tenantId,
      number,
      invoice_date: '2026-09-30',
      booking_id: bookingId,
      recipient: 'Huber Maria',
      lines: [{ label: 'Anzahlung', amount_cents: cents, vat_rate: '10.00' }],
    } as unknown as Json,
  })
  if (error) throw error
  return (data as { id: string }).id
}

async function draftRow(id: string) {
  return (await service().from('invoices').select('*, lines:invoice_lines(position, label, amount_cents, vat_rate, source_kind)').eq('id', id).maybeSingle()).data
}

async function openBooking(page: Page, id: string) {
  await page.goto(`/buchungen/${id}`)
  await ready(page)
}
async function openCreate(page: Page, bookingId: string) {
  await page.goto(`/rechnungen/neu?buchung=${bookingId}`)
  await ready(page)
  // <main> ist früher aktiv als das Formular; eine sofortige Eingabe ginge sonst verloren. Der Editor erscheint erst danach.
  // Ohne Formular (z. B. voll verrechnet) gibt es nichts abzuwarten
  if (await page.locator('input[type="date"]').count()) await expect(page.locator('.ProseMirror').first()).toBeVisible()
}
const lineBox = (page: Page, label: string) => page.getByRole('checkbox', { name: `„${label}“ auf die Rechnung` })
const invoicesSection = (page: Page) => page.locator('section').filter({ has: page.getByRole('heading', { name: 'Rechnungen', exact: true }) })
const totalRow = (page: Page) => page.getByRole('region', { name: 'Summen' }).locator('dl').first()

async function saveDraft(page: Page) {
  const button = page.getByRole('button', { name: 'Entwurf speichern', exact: true })
  await button.scrollIntoViewIfNeeded()
  await button.click()
  await expect(page).toHaveURL(/\/rechnungen\/[0-9a-f-]{36}$/)
  await ready(page)
  return page.url().split('/').pop()!
}

// ---------------------------------------------------------------------------------------------------------------------

test.describe('Knopf „Rechnung“', () => {
  test('AC: Inhaber sieht den aktiven Knopf rechts außen; Mitarbeiter keinen; Sperre keinen', async ({ page, users }) => {
    desktopOnly()
    const { owner, staff, tenantId } = await setup(users, { staff: true })
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId)
    const booking = await addBooking(tenantId, apt, { guestId: guest })
    const block = await addBooking(tenantId, apt, { kind: 'block', arrival: '2026-11-20', departure: '2026-11-22' })

    await signInAs(page, owner)
    await openBooking(page, booking.id)
    const button = page.getByRole('link', { name: 'Rechnung', exact: true })
    await expect(button).toBeVisible()
    // rechts außen: rechts von „Stornieren“
    const cancel = await page.getByRole('button', { name: 'Stornieren' }).boundingBox()
    const invoice = await button.boundingBox()
    expect(invoice!.x).toBeGreaterThan(cancel!.x)
    await openBooking(page, block.id)
    await expect(page.getByRole('link', { name: 'Rechnung', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Rechnung', exact: true })).toHaveCount(0)

    await page.context().clearCookies()
    await signInAs(page, staff!)
    await openBooking(page, booking.id)
    await expect(page.getByRole('link', { name: 'Rechnung', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Rechnung', exact: true })).toHaveCount(0)
  })

  test('AC: Knopf inaktiv bei voll verrechnet (Entwurf), aktiv bei 200 nacherfasst + 100 Entwurf; nach Löschen des Entwurfs wieder aktiv', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId)
    const full = await addBooking(tenantId, apt, { guestId: guest, nights: 50000 })
    const fullDraft = await addDraft(owner, tenantId, full.id, { lines: [{ label: 'Übernachtung', amount_cents: 50000, vat_rate: '10.00', source_kind: 'nights' }] })
    const mixed = await addBooking(tenantId, apt, { guestId: guest, nights: 50000, arrival: '2026-11-02', departure: '2026-11-05' })
    await addBackfilled(owner, tenantId, mixed.id, 20000)
    await addDraft(owner, tenantId, mixed.id, { lines: [{ label: 'Teil', amount_cents: 10000, vat_rate: '10.00' }] })

    await signInAs(page, owner)
    await openBooking(page, full.id)
    await expect(page.getByRole('button', { name: 'Rechnung', exact: true })).toBeDisabled()
    await expect(page.getByText('Bereits vollständig verrechnet oder in Entwürfen.')).toBeVisible()
    // direkter Aufruf zeigt die Begründung statt des Formulars
    await openCreate(page, full.id)
    await expect(page.getByText('Keine neue Rechnung möglich')).toBeVisible()

    await openBooking(page, mixed.id)
    await expect(page.getByRole('link', { name: 'Rechnung', exact: true })).toBeVisible()
    const section = text(await invoicesSection(page).innerText())
    expect(section).toMatch(/Verrechnet\s*€ 200,00/)
    expect(section).toMatch(/In Entwürfen\s*€ 100,00/)

    // Entwurf löschen: Abbrechen behält, Bestätigen entfernt → Buchung, Knopf aktiv
    await page.goto(`/rechnungen/${fullDraft}`)
    await ready(page)
    await page.getByRole('button', { name: 'Löschen' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Abbrechen' }).click()
    expect(await draftRow(fullDraft)).not.toBeNull()
    await page.getByRole('button', { name: 'Löschen' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Endgültig löschen' }).click()
    await expect(page).toHaveURL(new RegExp(`/buchungen/${full.id}`))
    await expect(page.getByRole('link', { name: 'Rechnung', exact: true })).toBeVisible()
    expect(await draftRow(fullDraft)).toBeNull()
  })

  test('AC: Option mit Hinweis; storniert ohne Gebühr inaktiv; storniert mit Gebühr € 120 nur die Gebühr, danach inaktiv', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId)
    const option = await addBooking(tenantId, apt, { guestId: guest, kind: 'option', arrival: '2026-12-01', departure: '2026-12-04' })
    const noFee = await addBooking(tenantId, apt, { guestId: guest, cancelled: true, arrival: '2026-11-02', departure: '2026-11-05' })
    const fee = await addBooking(tenantId, apt, { guestId: guest, cancelled: true, fee: 12000, arrival: '2026-11-10', departure: '2026-11-12', charges: [{ label: 'Reinigung', cents: 5000, rate: 20 }] })

    await signInAs(page, owner)
    await openBooking(page, option.id)
    await page.getByRole('link', { name: 'Rechnung', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Rechnung erstellen' })).toBeVisible()
    await expect(page.getByText('Buchung ist noch eine Option.')).toBeVisible()

    await openBooking(page, noFee.id)
    await expect(page.getByRole('button', { name: 'Rechnung', exact: true })).toBeDisabled()
    await expect(page.getByText('Storniert ohne Stornogebühr: nichts zu verrechnen.')).toBeVisible()

    await openCreate(page, fee.id)
    await expect(lineBox(page, 'Stornogebühr')).toBeChecked()
    await expect(page.getByLabel(/^Betrag der Position \d+$/)).toHaveCount(1)
    await expect(page.getByLabel('Betrag der Position 1')).toHaveValue('120,00')
    await saveDraft(page)
    await openBooking(page, fee.id)
    await expect(page.getByRole('button', { name: 'Rechnung', exact: true })).toBeDisabled()
  })
})

test.describe('Rechnung erstellen', () => {
  test('AC: Vorbelegung, Reihenfolge der Positionen, Speichern → Detailseite ohne Nummer; eigene Werte gespeichert, Buchung unverändert', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId, { titlePrefix: 'Dr.' })
    const booking = await addBooking(tenantId, apt, {
      guestId: guest,
      charges: [
        { label: 'Reinigung', cents: 10000, rate: 20 },
        { label: 'Rabatt', cents: -5000, rate: 10 },
      ],
    })
    await signInAs(page, owner)
    await openBooking(page, booking.id)
    await page.getByRole('link', { name: 'Rechnung', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/rechnungen/neu\\?buchung=${booking.id}`))
    await ready(page)

    await expect(page.getByRole('radiogroup', { name: 'Art' }).getByRole('radio', { name: /^Rechnung/ })).toBeChecked()
    await expect(page.getByRole('radiogroup', { name: 'Empfänger' }).getByRole('radio', { name: 'Gast' })).toBeChecked()
    await expect(page.getByRole('radiogroup', { name: 'Empfänger' }).getByRole('radio', { name: 'Firma' })).toBeDisabled()
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Dr. Maria Huber')
    await expect(page.getByLabel('Adresszeile 1')).toHaveValue('Gartenweg 3')
    await expect(page.getByLabel('Rechnungsdatum')).toHaveValue(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Vienna' }).format(new Date()))
    await expect(page.getByRole('radiogroup', { name: 'Gastnamen auf der Rechnung' }).getByRole('radio', { name: 'Keine Gastnamen' })).toBeChecked()
    for (const title of ['Einleitung', 'Zahlungsmodalitäten', 'Abschlusstext']) await expect(page.getByRole('heading', { name: title })).toBeVisible()
    // Positionen in der Reihenfolge der Buchung, alle angewählt
    const labels = page.getByLabel(/^Bezeichnung der Position \d+$/)
    await expect(labels).toHaveCount(3)
    expect(await labels.evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value))).toEqual(['Übernachtung', 'Reinigung', 'Rabatt'])
    for (const l of ['Übernachtung', 'Reinigung', 'Rabatt']) await expect(lineBox(page, l)).toBeChecked()
    await expect(totalRow(page)).toContainText('€ 950,00')

    // eigene Werte: Betrag ändern, Position hinzufügen, Anschrift überschreiben
    await page.getByLabel('Betrag der Position 2').fill('120,00')
    await page.getByRole('button', { name: 'Position hinzufügen' }).click()
    await page.getByLabel('Bezeichnung der Position 4').fill('Parkplatz')
    await page.getByLabel('Betrag der Position 4').fill('15,00')
    await page.getByLabel('Adresszeile 1').fill('Andere Gasse 9')
    const id = await saveDraft(page)

    await expect(page.getByRole('heading', { name: 'Rechnung (Entwurf)' })).toBeVisible()
    await expect(page.getByText('Wird beim Ausstellen vergeben')).toBeVisible()
    const row = await draftRow(id)
    expect(row).toMatchObject({ origin: 'draft', number: null, recipient_line1: 'Andere Gasse 9', total_cents: 90000 + 12000 - 5000 + 1500 })
    expect([...row!.lines].sort((a, b) => a.position - b.position).map((l) => [l.label, l.amount_cents])).toEqual([
      ['Übernachtung', 90000],
      ['Reinigung', 12000],
      ['Rabatt', -5000],
      ['Parkplatz', 1500],
    ])
    const { data: charges } = await service().from('booking_charges').select('amount_cents').eq('booking_id', booking.id).order('position')
    expect(charges?.map((c) => c.amount_cents)).toEqual([10000, -5000])
    const { data: g } = await service().from('guests').select('street').eq('id', guest).single()
    expect(g?.street).toBe('Gartenweg 3')
  })

  test('AC: zweiter Entwurf – Übernachtung abgewählt „in Entwurf vom …“, übrige angewählt; bewusst angewählt wird übernommen; alle abgewählt speicherbar mit „Keine Position“', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId)
    const booking = await addBooking(tenantId, apt, { guestId: guest, charges: [{ label: 'Reinigung', cents: 10000, rate: 20 }] })
    await addDraft(owner, tenantId, booking.id)
    // Teilrechnung verbraucht keine Positionen
    await addDraft(owner, tenantId, booking.id, partial(5000, [{ label: 'A', amount_cents: 5000, vat_rate: '10.00' }]))
    await signInAs(page, owner)
    await openCreate(page, booking.id)
    await expect(lineBox(page, 'Übernachtung')).not.toBeChecked()
    await expect(page.getByText('in Entwurf vom 20.10.2026')).toBeVisible()
    await expect(lineBox(page, 'Reinigung')).toBeChecked()
    await lineBox(page, 'Übernachtung').check()
    await expect(totalRow(page)).toContainText('€ 1.000,00')
    await lineBox(page, 'Übernachtung').uncheck()
    await lineBox(page, 'Reinigung').uncheck()
    await expect(page.getByText('Keine Position', { exact: true })).toBeVisible()
    const id = await saveDraft(page)
    expect((await draftRow(id))!.lines).toHaveLength(0)
    await expect(page.getByText('Keine Position', { exact: true })).toBeVisible()
  })

  test('AC: ungespeicherte Änderungen – Rückfrage beim Verlassen (Link, Abbrechen, Zurück im Browser)', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId)
    const booking = await addBooking(tenantId, apt, { guestId: guest })
    await signInAs(page, owner)
    await openBooking(page, booking.id)
    await page.getByRole('link', { name: 'Rechnung', exact: true }).click()
    await ready(page)
    await page.getByLabel('Adresszeile 1').fill('Geändert 1')

    await page.getByRole('link', { name: 'Zurück zur Buchung' }).first().click()
    await expect(page.getByRole('alertdialog', { name: 'Seite verlassen?' })).toBeVisible()
    await page.getByRole('button', { name: 'Weiter bearbeiten' }).click()
    await expect(page.getByLabel('Adresszeile 1')).toHaveValue('Geändert 1')

    await page.getByRole('button', { name: 'Abbrechen', exact: true }).click()
    await expect(page.getByRole('alertdialog', { name: 'Seite verlassen?' })).toBeVisible()
    await page.getByRole('button', { name: 'Weiter bearbeiten' }).click()

  })

  test('BUG-1: Zurück-Taste des Browsers fragt bei ungespeicherten Änderungen nach; Weiter bearbeiten bzw. Verwerfen', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId)
    const booking = await addBooking(tenantId, apt, { guestId: guest })
    await signInAs(page, owner)
    await openBooking(page, booking.id)
    await page.getByRole('link', { name: 'Rechnung', exact: true }).click()
    await ready(page)
    await page.getByLabel('Adresszeile 1').fill('Geändert 1')
    await page.goBack()
    await expect(page.getByRole('alertdialog', { name: 'Seite verlassen?' })).toBeVisible({ timeout: 3000 })
    await expect(page).toHaveURL(/\/rechnungen\/neu/)
    // Weiter bearbeiten: Eingaben bleiben, „Zurück“ fragt erneut
    await page.getByRole('button', { name: 'Weiter bearbeiten' }).click()
    await expect(page.getByLabel('Adresszeile 1')).toHaveValue('Geändert 1')
    await page.goBack()
    await expect(page.getByRole('alertdialog', { name: 'Seite verlassen?' })).toBeVisible({ timeout: 3000 })
    // Verwerfen: zurück zur Buchung
    await page.getByRole('button', { name: 'Verwerfen und verlassen' }).click()
    await expect(page).toHaveURL(new RegExp(`/buchungen/${booking.id}$`))
  })
})

test.describe('Teil- und Schlussrechnung', () => {
  test('AC: Teilrechnung 20 % von € 1.000 → € 200 (180 zu 10 %, 20 zu 20 %); Betrag € 250 → 25 %; 0 → Fehler; Hinweis über Gesamtpreis', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId)
    const booking = await addBooking(tenantId, apt, { guestId: guest, charges: [{ label: 'Reinigung', cents: 10000, rate: 20 }] })
    await addBackfilled(owner, tenantId, booking.id, 90000)
    await signInAs(page, owner)
    await openCreate(page, booking.id)
    await page.getByRole('radiogroup', { name: 'Art' }).getByRole('radio', { name: /^Teilrechnung/ }).click()
    // 0 → Fehlermeldung (vor einem Wechsel Prozent/Betrag; danach fehlt sie: BUG-2)
    await page.getByLabel(/^Prozent vom Gesamtpreis/).fill('0')
    await page.getByRole('button', { name: 'Entwurf speichern' }).click()
    await expect(page.getByText('Bitte gib einen Teilbetrag größer als 0 ein.')).toBeVisible()
    await page.getByLabel(/^Prozent vom Gesamtpreis/).fill('20')
    await expect(page.getByText('entspricht € 200,00')).toBeVisible()
    await expect(page.locator('dl[aria-label="Aufteilung nach Umsatzsteuersatz"]')).toContainText('€ 180,00')
    await expect(page.locator('dl[aria-label="Aufteilung nach Umsatzsteuersatz"]')).toContainText('€ 20,00')
    await expect(page.locator('dl[aria-label="Darin enthaltene Umsatzsteuer"]')).toContainText('€ 16,36')
    await expect(page.locator('dl[aria-label="Darin enthaltene Umsatzsteuer"]')).toContainText('€ 3,33')
    // 900 nacherfasst + 200 > 1.000 → Hinweis, kein Sperren
    await expect(page.getByText(/liegt dieser Betrag über dem Gesamtpreis/)).toBeVisible()

    // Speichern mit Prozent (ohne Wechsel auf Betrag, siehe BUG-2)
    const id = await saveDraft(page)
    expect(await draftRow(id)).toMatchObject({ kind: 'partial', partial_mode: 'percent', partial_percent: 20, partial_amount_cents: 20000, total_cents: 20000 })
  })

  test('AC: Teilrechnung – Betrag € 250,00 zeigt 25 %', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId)
    const booking = await addBooking(tenantId, apt, { guestId: guest, charges: [{ label: 'Reinigung', cents: 10000, rate: 20 }] })
    await signInAs(page, owner)
    await openCreate(page, booking.id)
    await page.getByRole('radiogroup', { name: 'Art' }).getByRole('radio', { name: /^Teilrechnung/ }).click()
    await page.getByRole('radiogroup', { name: 'Eingabe als' }).getByRole('radio', { name: 'Betrag' }).click()
    await page.getByLabel('Betrag in Euro').fill('250,00')
    await expect(page.getByText('entspricht 25 % des Gesamtpreises')).toBeVisible()
  })

  test('BUG-2: Teilrechnung nach Wechsel Prozent → Betrag lässt sich nicht speichern (gültiger Betrag, keine Meldung)', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId)
    const booking = await addBooking(tenantId, apt, { guestId: guest })
    await signInAs(page, owner)
    await openCreate(page, booking.id)
    await page.getByRole('radiogroup', { name: 'Art' }).getByRole('radio', { name: /^Teilrechnung/ }).click()
    await page.getByRole('radiogroup', { name: 'Eingabe als' }).getByRole('radio', { name: 'Betrag' }).click()
    await page.getByLabel('Betrag in Euro').fill('250,00')
    const id = await saveDraft(page)
    expect(await draftRow(id)).toMatchObject({ kind: 'partial', partial_mode: 'amount', partial_amount_cents: 25000 })
  })

  test('BUG-2: nach Wechsel Prozent/Betrag – Teilbetrag 0 zeigt keine Fehlermeldung', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId)
    const booking = await addBooking(tenantId, apt, { guestId: guest })
    await signInAs(page, owner)
    await openCreate(page, booking.id)
    await page.getByRole('radiogroup', { name: 'Art' }).getByRole('radio', { name: /^Teilrechnung/ }).click()
    await page.getByRole('radiogroup', { name: 'Eingabe als' }).getByRole('radio', { name: 'Betrag' }).click()
    await page.getByLabel('Betrag in Euro').fill('0')
    await page.getByRole('button', { name: 'Entwurf speichern' }).click()
    await expect(page.getByText('Bitte gib einen Teilbetrag größer als 0 ein.')).toBeVisible({ timeout: 3000 })
  })

  test('AC: Schlussrechnung – alle Positionen voll, Teilrechnung vorausgewählt, nacherfasste abgewählt, Rechnung (Art) nicht; Betrag € 800; Vorschau mit Abzugszeile', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId)
    const booking = await addBooking(tenantId, apt, { guestId: guest, charges: [{ label: 'Reinigung', cents: 10000, rate: 20 }] })
    await addDraft(owner, tenantId, booking.id, { ...partial(20000, [{ label: 'A', amount_cents: 18000, vat_rate: '10.00' }, { label: 'A', amount_cents: 2000, vat_rate: '20.00' }]), invoice_date: '2026-10-03' })
    await addBackfilled(owner, tenantId, booking.id, 5000, 'ALT-7')
    await signInAs(page, owner)
    await openCreate(page, booking.id)
    await page.getByRole('radiogroup', { name: 'Art' }).getByRole('radio', { name: /^Schlussrechnung/ }).click()
    await expect(lineBox(page, 'Übernachtung')).toBeChecked()
    await expect(lineBox(page, 'Reinigung')).toBeChecked()
    await expect(page.getByRole('checkbox', { name: /Teilrechnung \(Entwurf\)/ })).toBeChecked()
    await expect(page.getByRole('checkbox', { name: /Rechnung ALT-7 \(nacherfasst\)/ })).not.toBeChecked()
    await expect(totalRow(page)).toContainText('€ 800,00')

    await page.getByRole('button', { name: 'Vorschau' }).click()
    const preview = page.getByRole('article', { name: 'Rechnungsvorschau' })
    await expect(preview).toContainText('abzüglich Teilrechnung (Entwurf) vom 03.10.2026')
    await expect(preview).toContainText('-€ 200,00')
    await expect(preview).toContainText('darin USt 10 %')
    await page.getByRole('button', { name: 'Zurück zum Entwurf' }).first().click()

    // Abzüge höher als die Leistungen → 0 oder negativ mit Hinweis
    await lineBox(page, 'Übernachtung').uncheck()
    await expect(page.getByText('Die Abzüge sind höher als die Leistungen: Der Rechnungsbetrag ist 0 oder negativ.')).toBeVisible()
    await expect(totalRow(page)).toContainText('-€ 100,00')
  })

  test('AC: Rechnung (Art) zur Buchung → bei Schlussrechnung nicht bei den Abzügen, ihre Positionen abgewählt', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId)
    const booking = await addBooking(tenantId, apt, { guestId: guest, charges: [{ label: 'Reinigung', cents: 10000, rate: 20 }] })
    await addDraft(owner, tenantId, booking.id)
    await signInAs(page, owner)
    await openCreate(page, booking.id)
    await page.getByRole('radiogroup', { name: 'Art' }).getByRole('radio', { name: /^Schlussrechnung/ }).click()
    await expect(page.getByText('Keine Teilrechnungen oder nacherfassten Rechnungen zu dieser Buchung.')).toBeVisible()
    await expect(lineBox(page, 'Übernachtung')).not.toBeChecked()
  })
})

test.describe('Empfänger, Texte, Zahlungsregeln', () => {
  test('AC: Firma vorausgewählt mit Firmendaten; Wechsel nach Änderung mit Rückfrage; {Anrede} bei Firma wählbar', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId, { company: 'Muster GmbH', companyVat: 'ATU99999999', gender: 'male', last: 'Gruber', first: 'Franz' })
    const booking = await addBooking(tenantId, apt, { guestId: guest })
    await signInAs(page, owner)
    await openCreate(page, booking.id)
    await expect(page.getByRole('radiogroup', { name: 'Empfänger' }).getByRole('radio', { name: 'Firma' })).toBeChecked()
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Muster GmbH')
    await expect(page.getByLabel('Adresszeile 1')).toHaveValue('Hauptplatz 1')
    await expect(page.getByLabel('UID (optional)')).toHaveValue('ATU99999999')
    await expect(page.getByRole('radiogroup', { name: 'Gastnamen auf der Rechnung' }).getByRole('radio', { name: 'Keine Gastnamen' })).toBeChecked()
    await expect(page.getByRole('radio', { name: 'Sehr geehrte Damen und Herren' })).toBeChecked()

    // Vorschau: Standard-Einleitung mit {Anrede}
    await page.getByRole('button', { name: 'Vorschau' }).click()
    await expect(page.getByRole('article', { name: 'Rechnungsvorschau' })).toContainText('Sehr geehrte Damen und Herren, vielen Dank')
    await page.getByRole('button', { name: 'Zurück zum Entwurf' }).first().click()
    await page.getByRole('radio', { name: 'Anrede des Hauptgasts' }).click()
    await page.getByRole('button', { name: 'Vorschau' }).click()
    await expect(page.getByRole('article', { name: 'Rechnungsvorschau' })).toContainText('Sehr geehrter Herr Gruber, vielen Dank')
    await page.getByRole('button', { name: 'Zurück zum Entwurf' }).first().click()

    await page.getByLabel('Adresszeile 1').fill('Reisebüro-Gasse 1')
    await page.getByRole('radiogroup', { name: 'Empfänger' }).getByRole('radio', { name: 'Gast' }).click()
    await expect(page.getByRole('alertdialog', { name: 'Empfänger neu belegen?' })).toBeVisible()
    await page.getByRole('button', { name: 'Neu belegen' }).click()
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('Franz Gruber')
    await expect(page.getByLabel('Adresszeile 1')).toHaveValue('Gartenweg 3')
  })

  test('AC: Rechnungsdatum in der Vergangenheit mit Hinweis; unbekannter Platzhalter verhindert das Speichern', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId)
    const booking = await addBooking(tenantId, apt, { guestId: guest })
    await signInAs(page, owner)
    await openCreate(page, booking.id)
    await page.getByLabel('Rechnungsdatum').fill('2026-10-01')
    await expect(page.getByText('Das Rechnungsdatum liegt in der Vergangenheit. Du kannst trotzdem speichern.')).toBeVisible()
    const editor = page.getByRole('region', { name: 'Einleitung' }).getByRole('textbox', { name: 'Text für diese Rechnung', exact: true })
    await editor.click()
    await page.keyboard.press('End')
    await page.keyboard.type(' {Gastname}')
    await page.getByRole('button', { name: 'Entwurf speichern' }).click()
    await expect(page.getByText('Unbekannter Platzhalter: {Gastname}')).toBeVisible()
    await expect(page).toHaveURL(/\/rechnungen\/neu/)
  })

  test('AC: Baustein in den Einstellungen geändert → Entwurf behält den alten Text; geänderter Text wird erst nach Rückfrage ersetzt', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId)
    const booking = await addBooking(tenantId, apt, { guestId: guest })
    await signInAs(page, owner)
    await openCreate(page, booking.id)
    const id = await saveDraft(page)
    await service()
      .from('invoice_text_blocks')
      .update({ body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Ganz neuer Einleitungstext' }] }] } } as never)
      .eq('tenant_id', tenantId)
      .eq('block', 'intro')
    await page.goto(`/rechnungen/${id}/bearbeiten`)
    await ready(page)
    const intro = page.getByRole('region', { name: 'Einleitung' })
    await expect(intro.getByRole('textbox', { name: 'Text für diese Rechnung', exact: true })).toContainText('vielen Dank für Ihren Aufenthalt')
    await expect(intro.getByRole('textbox', { name: 'Text für diese Rechnung', exact: true })).not.toContainText('Ganz neuer Einleitungstext')
    // Text ist gegenüber dem (geänderten) Baustein abweichend → Wechsel nur nach Rückfrage
    await intro.getByRole('combobox', { name: 'Baustein' }).click()
    await page.getByRole('option', { name: 'Kein Text' }).click()
    await expect(page.getByRole('alertdialog', { name: 'Text ersetzen?' })).toBeVisible()
    await page.getByRole('button', { name: 'Behalten' }).click()
    await expect(intro.getByRole('textbox', { name: 'Text für diese Rechnung', exact: true })).toContainText('vielen Dank für Ihren Aufenthalt')
  })

  test('AC: Baustein mit Schrift und Größe: Kopie im Entwurf, Vorschau, Änderung fragt nach und ändert den Baustein nicht', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId)
    const booking = await addBooking(tenantId, apt, { guestId: guest })
    const attrs = { fontFamily: 'tinos', fontSize: 12 }
    const body = { type: 'doc', attrs, content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Formatierter Dank' }] }] }
    const { data: block } = await service()
      .from('invoice_text_blocks')
      .insert({ tenant_id: tenantId, block: 'intro', name: 'Mit Format', body } as never)
      .select('id, body')
      .single()
    await signInAs(page, owner)
    await openCreate(page, booking.id)
    const intro = page.getByRole('region', { name: 'Einleitung' })
    await intro.getByRole('combobox', { name: 'Baustein' }).click()
    await page.getByRole('option', { name: 'Mit Format' }).click()
    const box = intro.getByRole('textbox', { name: 'Text für diese Rechnung', exact: true })
    await expect(box).toHaveText('Formatierter Dank')
    await expect(box).toHaveCSS('font-family', /Tinos/)
    await expect(box).toHaveCSS('font-size', '16px')

    await page.getByRole('button', { name: 'Vorschau' }).click()
    const shown = page.getByRole('article', { name: 'Rechnungsvorschau' }).locator('div.break-words').filter({ hasText: 'Formatierter Dank' })
    await expect(shown).toHaveCSS('font-family', /Tinos/)
    await page.getByRole('button', { name: 'Zurück zum Entwurf' }).first().click()

    // Nur die Größe geändert: Ein anderer Baustein ersetzt den Text erst nach Rückfrage
    const size = intro.getByRole('textbox', { name: 'Schriftgröße in pt' })
    await size.fill('9')
    await size.blur()
    await expect(box).toHaveCSS('font-size', '12px')
    await intro.getByRole('combobox', { name: 'Baustein' }).click()
    await page.getByRole('option', { name: 'Kein Text' }).click()
    await expect(page.getByRole('alertdialog')).toBeVisible()
    await page.getByRole('alertdialog').getByRole('button').first().press('Escape')
    await expect(box).toHaveCSS('font-size', '12px')

    await saveDraft(page)
    const { data: row } = await service().from('invoices').select('intro_text').eq('tenant_id', tenantId).single()
    expect((row as { intro_text: { attrs: unknown } }).intro_text.attrs).toEqual({ fontFamily: 'tinos', fontSize: 9 })
    const { data: unchanged } = await service().from('invoice_text_blocks').select('body').eq('id', (block as { id: string }).id).single()
    expect((unchanged as { body: { attrs: unknown } }).body.attrs).toEqual(attrs)
  })

  test('AC: Baustein „Anzahlung 20 %, Rest vor Anreise“ – € 90,00 fällig 04.10., Rest € 360,00 fällig 13.10.; 30 % je Rechnung lässt den Baustein unverändert', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId)
    const booking = await addBooking(tenantId, apt, { guestId: guest, nights: 45000 })
    await signInAs(page, owner)
    await openCreate(page, booking.id)
    await page.getByLabel('Rechnungsdatum').fill('2026-10-01')
    const payment = page.getByRole('region', { name: 'Zahlungsmodalitäten' })
    await payment.getByRole('combobox', { name: 'Baustein' }).click()
    await page.getByRole('option', { name: 'Anzahlung 20 %, Rest vor Anreise' }).click()
    await expect(payment).toContainText('Anzahlung € 90,00 fällig am 04.10.2026, Rest € 360,00')
    await expect(payment).toContainText('Fällig am 13.10.2026')

    await payment.getByLabel('Anzahlung in Prozent').fill('30')
    await expect(payment).toContainText('Anzahlung € 135,00')
    const id = await saveDraft(page)
    expect(await draftRow(id)).toMatchObject({ deposit_percent: 30, deposit_days: 3, due_days: 1, due_basis: 'before_arrival' })
    const { data: block } = await service().from('invoice_text_blocks').select('deposit_percent').eq('tenant_id', tenantId).eq('name', 'Anzahlung 20 %, Rest vor Anreise').single()
    expect(block?.deposit_percent).toBe(20)
  })

  test('AC: „1 Tag vor Anreise“ mit Rechnungsdatum nach Anreise → Rechnungsdatum mit Hinweis; ohne Zahlungsbaustein am Rechnungsdatum fällig', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId)
    const booking = await addBooking(tenantId, apt, { guestId: guest })
    await signInAs(page, owner)
    await openCreate(page, booking.id)
    const payment = page.getByRole('region', { name: 'Zahlungsmodalitäten' })
    await payment.getByRole('combobox', { name: 'Baustein' }).click()
    await page.getByRole('option', { name: 'Kein Text' }).click()
    await page.getByLabel('Rechnungsdatum').fill('2026-10-20')
    await expect(payment).toContainText('Fällig am 20.10.2026')
    await payment.getByRole('combobox', { name: 'Baustein' }).click()
    await page.getByRole('option', { name: 'Anzahlung 20 %, Rest vor Anreise' }).click()
    await expect(payment).toContainText('Fällig am 20.10.2026')
    await expect(payment).toContainText('Fälligkeit liegt vor dem Rechnungsdatum, sofort fällig gesetzt.')
  })
})

test.describe('Pflichtangaben und Vorschau', () => {
  test('AC: € 500 ohne PLZ → Fehler mit „Zum Feld“; UID des Ausstellers fehlt; € 12.000 Firma ohne UID; vollständig alle ✓', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId)
    const booking = await addBooking(tenantId, apt, { guestId: guest, nights: 50000 })
    await signInAs(page, owner)
    await openCreate(page, booking.id)
    const checks = page.getByRole('region', { name: 'Pflichtangaben' })
    await expect(checks).toContainText('Alle Pflichtangaben sind vorhanden')
    await page.getByLabel('PLZ').fill('')
    await expect(checks).toContainText('PLZ des Empfängers fehlt (ab € 400 brutto)')
    await checks.getByRole('button', { name: 'Zum Feld' }).click()
    await expect(page.getByLabel('PLZ')).toBeFocused()
    // unter € 400 kein Fehler zur Anschrift
    await page.getByLabel('Betrag der Position 1').fill('300,00')
    await expect(checks).toContainText('Alle Pflichtangaben sind vorhanden')

    await service().from('tenants').update({ vat_id: null } as never).eq('id', tenantId)
    await page.reload()
    await ready(page)
    await expect(checks).toContainText('UID des Ausstellers fehlt (ab € 400 brutto)')
    await expect(checks.getByRole('link', { name: 'Zu den Stammdaten' })).toBeVisible()
    await page.getByLabel('Betrag der Position 1').fill('12000,00')
    await expect(checks).toContainText('UID des Empfängers fehlt (ab € 10.000 brutto)')
    // speichern trotz Fehlern
    await saveDraft(page)
  })

  test('AC: Vorschau mit ungespeicherten Änderungen – Reihenfolge, „Entwurf“, Datum ohne Wochentag, Gastnamen mit Mitreisenden; zurück ohne Datenverlust', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    await service().from('invoice_settings').update({ footer: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'IBAN AT12 3456' }] }] } } as never).eq('tenant_id', tenantId)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId, { titlePrefix: 'Mag.' })
    const booking = await addBooking(tenantId, apt, { guestId: guest })
    await service().from('booking_companions').insert([
      { tenant_id: tenantId, booking_id: booking.id, position: 1, first_name: 'Paul', last_name: 'Huber' },
    ] as never)
    await signInAs(page, owner)
    await openCreate(page, booking.id)
    await page.getByLabel('Rechnungsdatum').fill('2026-10-20')
    await page.getByRole('radio', { name: 'Hauptgast mit Mitreisenden' }).click()
    await page.getByLabel('Adresszeile 2 (optional)').fill('Stiege 2')
    const editor = page.getByRole('region', { name: 'Abschlusstext' }).getByRole('textbox', { name: 'Text für diese Rechnung', exact: true })
    await editor.click()
    await page.keyboard.press('End')
    await page.keyboard.type(' Nummer {Rechnungsnummer}.')

    await page.getByRole('button', { name: 'Vorschau' }).click()
    const preview = page.getByRole('article', { name: 'Rechnungsvorschau' })
    const content = text(await preview.innerText())
    const order = ['Seeweg 12', 'Mag. Maria Huber', 'St. Gilgen, 20.10.2026', 'Rechnungsnummer: Entwurf', 'vom 14.10.2026 bis 17.10.2026', 'Gäste: Mag. Maria Huber, Paul Huber', 'vielen Dank', 'Rechnungsbetrag', 'Bitte überweisen', 'Nummer Entwurf.', 'IBAN AT12 3456']
    let at = -1
    for (const part of order) {
      const i = content.indexOf(part)
      expect(i, part).toBeGreaterThan(at)
      at = i
    }
    await expect(preview.getByText('Entwurf', { exact: true })).toBeVisible()
    expect(content).not.toMatch(/\b(Mo|Di|Mi|Do|Fr|Sa|So), \d/)

    await page.getByRole('button', { name: 'Zurück zum Entwurf' }).first().click()
    await expect(page.getByLabel('Adresszeile 2 (optional)')).toHaveValue('Stiege 2')
    await expect(page.getByLabel('Rechnungsdatum')).toHaveValue('2026-10-20')
    await expect(page.getByRole('radio', { name: 'Hauptgast mit Mitreisenden' })).toBeChecked()
  })

  test('AC: Kleinunternehmer-Buchung – Teilrechnung ohne USt, Hinweis nach Block 5', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    await service().from('vat_status_changes').insert({ tenant_id: tenantId, valid_from: '2026-01-01', small_business: true } as never)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId)
    const booking = await addBooking(tenantId, apt, { guestId: guest })
    await signInAs(page, owner)
    await openCreate(page, booking.id)
    await page.getByRole('radiogroup', { name: 'Art' }).getByRole('radio', { name: /^Teilrechnung/ }).click()
    await page.getByLabel(/^Prozent vom Gesamtpreis/).fill('20')
    await expect(page.getByText('Keine Umsatzsteuer (Kleinunternehmer)')).toBeVisible()
    await expect(page.locator('dl[aria-label="Darin enthaltene Umsatzsteuer"]')).toHaveCount(0)
    await page.getByRole('button', { name: 'Vorschau' }).click()
    const content = text(await page.getByRole('article', { name: 'Rechnungsvorschau' }).innerText())
    expect(content.indexOf('Kleinunternehmerregelung')).toBeGreaterThan(content.indexOf('Rechnungsbetrag'))
    expect(content.indexOf('Kleinunternehmerregelung')).toBeLessThan(content.indexOf('Bitte überweisen'))
    expect(content).not.toContain('Darin enthaltene Umsatzsteuer')
  })
})

test.describe('Detail, Listen, Mitarbeiter, Buchungsänderung', () => {
  test('AC: Liste mit „–“ und Status „Entwurf“; Buchungsübersicht – „ohne Rechnung“ zeigt Buchung mit nur einem Entwurf, Spalte „Entwurf“ als Link', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId)
    const booking = await addBooking(tenantId, apt, { guestId: guest })
    const id = await addDraft(owner, tenantId, booking.id, partial(10000, [{ label: 'A', amount_cents: 10000, vat_rate: '10.00' }]))
    await signInAs(page, owner)
    await page.goto('/rechnungen')
    await ready(page)
    const row = page.getByRole('row').filter({ hasText: 'Maria Huber' })
    await expect(row).toContainText('–')
    await expect(row).toContainText('20.10.2026')
    await expect(row).toContainText('Entwurf')
    await expect(row).toContainText('Teilrechnung')
    await expect(row).toContainText('€ 100,00')

    await page.goto('/buchungen?rechnung=ohne')
    await ready(page)
    const bookingRow = page.getByRole('row').filter({ hasText: booking.number! })
    await expect(bookingRow).toHaveCount(1)
    await bookingRow.getByRole('link', { name: 'Entwurf' }).click()
    await expect(page).toHaveURL(new RegExp(`/rechnungen/${id}$`))
  })

  test('AC: Mitarbeiter sieht Entwurf in Liste, Detail und Vorschau ohne Bearbeitungsknöpfe; /neu und /bearbeiten nicht erreichbar', async ({ page, users }) => {
    desktopOnly()
    const { owner, staff, tenantId } = await setup(users, { staff: true })
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId)
    const booking = await addBooking(tenantId, apt, { guestId: guest })
    const id = await addDraft(owner, tenantId, booking.id)
    await signInAs(page, staff!)
    await page.goto(`/rechnungen/${id}`)
    await ready(page)
    await expect(page.getByRole('heading', { name: 'Rechnung (Entwurf)' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Löschen' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Bearbeiten' })).toHaveCount(0)
    await page.getByRole('link', { name: 'Vorschau' }).click()
    await expect(page.getByRole('article', { name: 'Rechnungsvorschau' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Bearbeiten' })).toHaveCount(0)
    for (const path of [`/rechnungen/${id}/bearbeiten`, `/rechnungen/neu?buchung=${booking.id}`]) {
      await page.goto(path)
      await expect(page.getByRole('heading', { name: /nicht gefunden/i })).toBeVisible()
    }
    await openBooking(page, booking.id)
    await expect(invoicesSection(page)).toContainText('Entwurf')
  })

  test('AC: Preis der Buchung nach dem Speichern geändert → Hinweis mit „Positionen neu übernehmen“; Bestätigen ersetzt die Positionen', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId)
    const booking = await addBooking(tenantId, apt, { guestId: guest })
    await signInAs(page, owner)
    await openCreate(page, booking.id)
    const id = await saveDraft(page)
    await service().from('booking_amounts').update({ nights_cents: 95000, billed_nights_cents: 95000 } as never).eq('id', booking.id)
    await page.reload()
    await ready(page)
    await expect(page.getByText('Die Buchung wurde seit dem Entwurf geändert (Preis, Positionen, Storno oder Hauptgast).')).toBeVisible()
    await page.getByRole('link', { name: 'Positionen neu übernehmen' }).click()
    await ready(page)
    await page.getByRole('button', { name: 'Positionen neu übernehmen' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Neu übernehmen' }).click()
    await expect(page.getByLabel('Betrag der Position 1')).toHaveValue('950,00')
    await saveDraft(page)
    expect((await draftRow(id))!.total_cents).toBe(95000)
    await expect(page.getByText('Die Buchung wurde seit dem Entwurf geändert')).toHaveCount(0)
  })

  test('BUG-3: Hauptgast der Buchung gewechselt → Hinweis „Buchung wurde seit dem Entwurf geändert“; Empfängerkopie bleibt', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId)
    const other = await addGuest(tenantId, { last: 'Berger', first: 'Anna' })
    const booking = await addBooking(tenantId, apt, { guestId: guest })
    await signInAs(page, owner)
    await openCreate(page, booking.id)
    const id = await saveDraft(page)
    await expect(page.getByText('Die Buchung wurde seit dem Entwurf geändert')).toHaveCount(0)
    await service().from('bookings').update({ guest_id: other } as never).eq('id', booking.id)
    await page.reload()
    await ready(page)
    await expect(page.getByText('Die Buchung wurde seit dem Entwurf geändert (Preis, Positionen, Storno oder Hauptgast).')).toBeVisible()
    expect((await draftRow(id))!.recipient_name).toBe('Maria Huber')
  })

  test('BUG-5: Vorschau-Seite zeigt „Abgezogene Rechnung existiert nicht mehr“ nach dem Löschen der Teilrechnung', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId)
    const booking = await addBooking(tenantId, apt, { guestId: guest })
    const part = await addDraft(owner, tenantId, booking.id, partial(20000, [{ label: 'A', amount_cents: 20000, vat_rate: '10.00' }]))
    const final = await addDraft(owner, tenantId, booking.id, { kind: 'final', deduction_ids: [part] })
    const client = await signedIn(owner)
    await client.rpc('delete_invoice_draft', { p_invoice_id: part })
    await signInAs(page, owner)
    await page.goto(`/rechnungen/${final}/vorschau`)
    await ready(page)
    await expect(page.getByRole('article', { name: 'Rechnungsvorschau' }).getByText('Abgezogene Rechnung existiert nicht mehr.')).toBeVisible()
  })

  test('AC: Gleichzeitige Bearbeitung – der zweite erhält „inzwischen geändert“, Änderung nicht gespeichert; „Aktuelle Fassung laden“ zeigt die neue Fassung', async ({ page, browser, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId)
    const booking = await addBooking(tenantId, apt, { guestId: guest })
    const id = await addDraft(owner, tenantId, booking.id)
    const other = await browser.newContext({ storageState: { cookies: [], origins: [] } })
    const second = await other.newPage()
    await signInAs(page, owner)
    await signInAs(second, owner)
    for (const p of [page, second]) {
      await p.goto(`/rechnungen/${id}/bearbeiten`)
      await ready(p)
    }
    await page.getByLabel('Ort').fill('Wien')
    await saveDraft(page)
    await second.getByLabel('Ort').fill('Graz')
    await second.getByRole('button', { name: 'Entwurf speichern' }).click()
    await expect(second.getByText('Der Entwurf wurde inzwischen geändert.')).toBeVisible()
    expect((await draftRow(id))!.recipient_city).toBe('Wien')
    await second.getByRole('button', { name: 'Aktuelle Fassung laden' }).click()
    await expect(second.getByLabel('Ort')).toHaveValue('Wien')
    await other.close()
  })

  test('AC: Anlegen, Ändern und Löschen stehen mit Person im Änderungsprotokoll', async ({ users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId)
    const booking = await addBooking(tenantId, apt, { guestId: guest })
    const id = await addDraft(owner, tenantId, booking.id)
    const client = await signedIn(owner)
    const row = await draftRow(id)
    await client.rpc('save_invoice_draft', {
      p_input: {
        id, updated_at: row!.updated_at, tenant_id: tenantId, booking_id: booking.id, kind: 'invoice', invoice_date: '2026-10-21', recipient_kind: 'guest',
        recipient: { name: 'X' }, company_salutation: 'generic', guest_names: 'none', partial: null, lines: [], deduction_ids: [], texts: {},
        payment: { deposit_percent: null, deposit_days: null, due_days: 0, due_basis: 'after_invoice' },
      } as unknown as Json,
    })
    await client.rpc('delete_invoice_draft', { p_invoice_id: id })
    const { data } = await service().from('audit_log').select('action, actor_id').eq('table_name', 'invoices').eq('record_id', id)
    expect(new Set((data ?? []).map((r) => r.action))).toEqual(new Set(['insert', 'update', 'delete']))
    expect((data ?? []).every((r) => r.actor_id === owner.id)).toBe(true)
  })
})

test.describe('Sicherheit', () => {
  test('Fremder Inhaber: Entwurf, Vorschau, Bearbeiten und „Rechnung erstellen“ eines anderen Kunden → nicht gefunden; HTML im Empfänger wird als Text gezeigt', async ({ page, users }) => {
    desktopOnly()
    const a = await setup(users)
    const b = await setup(users)
    const apt = await addApartment(a.tenantId)
    const guest = await addGuest(a.tenantId)
    const booking = await addBooking(a.tenantId, apt, { guestId: guest })
    const id = await addDraft(a.owner, a.tenantId, booking.id, {
      recipient: { name: '<img src=x onerror="window.__xss=1">Huber', line1: '<script>window.__xss=1</script>', line2: '', postal_code: '5020', city: 'Salzburg', country: 'AT', vat_id: '' },
    })
    await signInAs(page, b.owner)
    for (const path of [`/rechnungen/${id}`, `/rechnungen/${id}/vorschau`, `/rechnungen/${id}/bearbeiten`, `/rechnungen/neu?buchung=${booking.id}`]) {
      await page.goto(path)
      await expect(page.getByRole('heading', { name: /nicht gefunden/i }), path).toBeVisible()
    }
    await page.context().clearCookies()
    await signInAs(page, a.owner)
    await page.goto(`/rechnungen/${id}/vorschau`)
    await ready(page)
    await expect(page.getByRole('article', { name: 'Rechnungsvorschau' })).toContainText('<img src=x onerror="window.__xss=1">Huber')
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
  })
})

test.describe('Layout', () => {
  test('Formular, Detail und Vorschau ohne seitliches Scrollen, Bedienelemente ≥ 44 px, keine WCAG-2.1-AA-Verstöße', async ({ page, users }) => {
    const { owner, tenantId } = await setup(users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId, { company: 'Sehr lange Firmenbezeichnung Gesellschaft mit beschränkter Haftung und Co KG Niederlassung Salzburg' })
    const booking = await addBooking(tenantId, apt, { guestId: guest, charges: [{ label: 'Reinigung', cents: 10000, rate: 20 }] })
    const id = await addDraft(owner, tenantId, booking.id)
    await signInAs(page, owner)
    for (const path of [`/rechnungen/neu?buchung=${booking.id}`, `/rechnungen/${id}`, `/rechnungen/${id}/vorschau`]) {
      await page.goto(path)
      await ready(page)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, path).toBeLessThanOrEqual(0)
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`), path).toEqual([])
      if (test.info().project.name === 'mobile') {
        const small = await page.evaluate(() =>
          [...document.querySelectorAll<HTMLElement>('main button, main a, main input:not([type="hidden"]), main [role="combobox"], main [role="radio"], main [role="checkbox"], main [role="switch"]')]
            .filter((el) => {
              const r = el.getBoundingClientRect()
              // unsichtbare Hilfsfelder (Radix: aria-hidden, nicht anklickbar) sind keine Bedienelemente
              if (r.width === 0 || r.height === 0 || el.getAttribute('aria-hidden') === 'true') return false
              // Radio/Checkbox/Schalter: die Beschriftung (Label) ist die Trefferfläche
              const target = el.closest('label') ?? el.closest('[class*="size-11"]') ?? el
              const t = target.getBoundingClientRect()
              // Links im Fließtext ausgenommen; Buchungslink im Kopf ≥ 44 px (BUG-4)
              return t.height < 44 && !(el.tagName === 'A' && el.closest('p, li, dd, span'))
            })
            .map((el) => `${el.tagName} ${el.getAttribute('aria-label') ?? el.textContent?.trim().slice(0, 30)}`)
        )
        expect(small, path).toEqual([])
      }
    }
  })
})

test.describe('QA Editor-Erweiterung (PROJ-39)', () => {
  const intro = (page: Page) => page.getByRole('region', { name: 'Einleitung' })

  test('BUG-4: Datum, sofort beim Erscheinen eingegeben, gilt in Vorschau und beim Speichern', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId)
    const booking = await addBooking(tenantId, apt, { guestId: guest })
    await signInAs(page, owner)
    // JavaScript zurückhalten (wie am langsamen Handy): Die Eingabe liegt sicher vor dem Aktivwerden des Formulars
    let release = () => {}
    const held = new Promise<void>((resolve) => (release = resolve))
    await page.route('**/_next/static/chunks/**/*.js*', async (route) => {
      await held
      await route.continue()
    })
    await page.goto(`/rechnungen/neu?buchung=${booking.id}`, { waitUntil: 'commit' })
    await page.getByLabel('Rechnungsdatum').fill('2026-10-20')
    await page.getByLabel('Adresszeile 1').fill('Früh getippt 1')
    expect(await page.getByLabel('Rechnungsdatum').evaluate((el) => Object.keys(el).some((k) => k.startsWith('__reactProps')))).toBe(false)
    release()
    await expect(page.locator('.ProseMirror').first()).toBeVisible()
    await expect(page.getByLabel('Rechnungsdatum')).toHaveValue('2026-10-20')
    await page.getByRole('button', { name: 'Vorschau' }).click()
    const preview = page.getByRole('article', { name: 'Rechnungsvorschau' })
    await expect(preview).toContainText('St. Gilgen, 20.10.2026')
    await expect(preview).toContainText('Früh getippt 1')
    await page.getByRole('button', { name: 'Zurück zum Entwurf' }).first().click()
    const id = await saveDraft(page)
    const { data: row } = await service().from('invoices').select('invoice_date').eq('id', id).single()
    expect((row as { invoice_date: string }).invoice_date).toBe('2026-10-20')
  })

  test('BUG-7: Hinweise zu {Anrede} erscheinen als Text, nicht als Fehlerschlüssel', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId)
    const booking = await addBooking(tenantId, apt, { guestId: guest })
    await signInAs(page, owner)
    await openCreate(page, booking.id)
    await expect(page.getByText('{Anrede} richtet sich nach dem Hauptgast (Geschlecht und Titel).')).toBeVisible()
    await expect(page.getByText(/invoiceDrafts\./)).toHaveCount(0)
  })

  test('BUG-4: ohne frühe Eingabe gilt der Entwurf nicht als geändert', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId)
    const booking = await addBooking(tenantId, apt, { guestId: guest })
    await signInAs(page, owner)
    await openCreate(page, booking.id)
    await page.getByRole('link', { name: /^Buchung/ }).first().click()
    await expect(page).toHaveURL(/\/buchungen/)
    await expect(page.getByRole('alertdialog')).toHaveCount(0)
  })

  test('AC: Einstellungen und Code im Entwurf: speichern, Detail, erneut öffnen, Rückfrage, Unerlaubtes bricht ab', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId)
    const booking = await addBooking(tenantId, apt, { guestId: guest })
    await signInAs(page, owner)
    await openCreate(page, booking.id)

    // Nur eine Formatänderung gilt als ungespeicherte Änderung
    await intro(page).getByRole('button', { name: 'Blocksatz' }).click()
    await page.getByRole('link', { name: /^Buchung/ }).first().click()
    await expect(page.getByRole('alertdialog', { name: 'Seite verlassen?' })).toBeVisible()
    await page.getByRole('alertdialog').getByRole('button', { name: /bearbeiten/i }).click()

    // Code mit Unerlaubtem: nichts gespeichert, Hinweis im Formular
    await intro(page).getByRole('button', { name: 'HTML-Code bearbeiten' }).click()
    const code = intro(page).locator('textarea')
    await code.fill('<div style="font-family: Tinos; font-size: 12pt; text-align: justify"><p>{Anrede}, <a href="https://x.example">danke</a></p></div>')
    await page.getByRole('button', { name: 'Entwurf speichern', exact: true }).click()
    await expect(intro(page).getByText('Entfernt: <a>')).toBeVisible()
    await expect(page).toHaveURL(/\/rechnungen\/neu/)

    const id = await saveDraft(page)
    const { data: row } = await service().from('invoices').select('intro_text').eq('id', id).single()
    expect((row as { intro_text: { attrs: unknown } }).intro_text.attrs).toEqual({ fontFamily: 'tinos', fontSize: 12, textAlign: 'justify' })

    await page.goto(`/rechnungen/${id}/bearbeiten`)
    await ready(page)
    const box = intro(page).getByRole('textbox', { name: 'Text für diese Rechnung', exact: true })
    await expect(box).toHaveCSS('font-family', /Tinos/)
    await expect(box).toHaveCSS('text-align', 'justify')
    await expect(intro(page).getByRole('textbox', { name: 'Schriftgröße in pt' })).toHaveValue('12')
    await page.getByRole('button', { name: 'Vorschau' }).click()
    const shown = page.getByRole('article', { name: 'Rechnungsvorschau' }).locator('div.break-words').filter({ hasText: 'danke' })
    await expect(shown).toHaveCSS('font-family', /Tinos/)
    await expect(shown).toHaveCSS('text-align', 'justify')
  })
})
