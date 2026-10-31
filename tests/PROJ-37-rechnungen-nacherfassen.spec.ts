import { randomUUID } from 'node:crypto'

import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test as base } from '@playwright/test'

import type { Json } from '../src/types/database'
import {
  anon,
  createTenant,
  createUser,
  deleteUser,
  type E2EUser,
  hasSupabaseEnv,
  service,
  signInAs,
  signInAsAdmin,
} from './support/supabase'

// PROJ-37: Rechnungen nacherfassen. Die Datenbank-Regeln prüft supabase/tests/invoices.integration.test.ts;
// hier die Abläufe in der Oberfläche. Abläufe im Desktop-Projekt (und Firefox/Safari), Layout auch auf Tablet und Handy.

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
const panel = (page: Page) => page.getByRole('dialog')
const text = (s: string) => s.replace(/[  ]/g, ' ').replace(/\s+/g, ' ')
const pdf = (name = 'rechnung.pdf', size = 0) => ({
  name,
  mimeType: 'application/pdf',
  buffer: Buffer.concat([Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n'), Buffer.alloc(size)]),
})

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
  const tenantId = await createTenant(`QA37 Testkunde ${randomUUID().slice(0, 8)}`, members)
  return { owner, staff: staffUser, tenantId }
}

let seq = 3700
async function addApartment(tenantId: string) {
  const { data: property, error } = await service()
    .from('properties')
    .insert({ tenant_id: tenantId, name: 'Haus See', street: 'Seeweg 12', postal_code: '5340', city: 'St. Gilgen', municipality_code: '50330' })
    .select('id')
    .single()
  if (error) throw error
  const { data: apartment, error: apartmentError } = await service()
    .from('apartments')
    .insert({ tenant_id: tenantId, property_id: property.id, name: 'Top 3', max_guests: 4, price_cents: 10000 } as never)
    .select('id')
    .single()
  if (apartmentError) throw apartmentError
  return (apartment as { id: string }).id
}

async function addGuest(tenantId: string, g: { last: string; first: string; company?: string }) {
  const { data, error } = await service()
    .from('guests')
    .insert({ tenant_id: tenantId, country: 'AT', last_name: g.last, first_name: g.first, company_name: g.company ?? null } as never)
    .select('id')
    .single()
  if (error) throw error
  return (data as { id: string }).id
}

type Seed = { label: string; cents: number; rate: number }

async function addBooking(
  tenantId: string,
  apartmentId: string,
  b: {
    guestId?: string
    kind?: 'booking' | 'option' | 'block'
    arrival?: string
    departure?: string
    nights?: number
    charges?: Seed[]
    cancelled?: boolean
    fee?: number
  } = {}
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
      option_until: kind === 'option' ? arrival : null,
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
        nights_cents: b.nights ?? 30000,
        nights_vat_rate: 10,
        cancellation_fee_cents: b.fee ?? null,
        cancellation_fee_vat_rate: 20,
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

// Rechnung wie die Server-Aktion sie speichert (im Namen des Inhabers)
async function addInvoice(
  owner: E2EUser,
  tenantId: string,
  inv: { number: string; date?: string; recipient?: string; lines?: Seed[]; bookingId?: string; guestId?: string }
) {
  const client = await signedIn(owner)
  const { data, error } = await client.rpc('save_invoice', {
    p_input: {
      tenant_id: tenantId,
      number: inv.number,
      invoice_date: inv.date ?? '2026-10-20',
      booking_id: inv.bookingId ?? null,
      guest_id: inv.guestId ?? null,
      recipient: inv.recipient ?? 'Huber Maria',
      lines: (inv.lines ?? [{ label: 'Übernachtung', cents: 30000, rate: 10 }]).map((l) => ({
        label: l.label,
        amount_cents: l.cents,
        vat_rate: l.rate.toFixed(2),
      })),
      pdf_path: null,
    } as unknown as Json,
  })
  if (error) throw error
  return (data as { id: string }).id
}

async function invoiceRow(id: string) {
  return (await service().from('invoices').select('*').eq('id', id).maybeSingle()).data
}

async function openList(page: Page, search = '') {
  await page.goto(`/rechnungen${search}`)
  await ready(page)
}

async function openCreate(page: Page) {
  await openList(page)
  await page.getByRole('button', { name: 'Rechnung nacherfassen' }).first().click()
  await expect(panel(page).getByRole('heading', { name: 'Rechnung nacherfassen' })).toBeVisible()
}

async function addLine(page: Page, label: string, amount: string, vat?: string) {
  await panel(page).getByRole('button', { name: 'Position hinzufügen' }).click()
  const n = await panel(page).getByLabel(/^Betrag der Position \d+$/).count()
  await panel(page).getByLabel(`Bezeichnung der Position ${n}`).fill(label)
  await panel(page).getByLabel(`Betrag der Position ${n}`).fill(amount)
  if (vat !== undefined) await panel(page).getByLabel(`Umsatzsteuersatz der Position ${n}`).fill(vat)
}

async function save(page: Page, name = 'Rechnung speichern') {
  const button = panel(page).getByRole('button', { name, exact: true })
  await button.scrollIntoViewIfNeeded()
  await button.click()
}

test.describe('Menüpunkt und Liste', () => {
  test('AC: „Rechnungen“ steht zwischen „Gäste“ und „Einstellungen“ (Desktop) bzw. unter „Mehr“ (Handy)', async ({ page, users }) => {
    const { owner } = await setup(users)
    await signInAs(page, owner)
    await openList(page)
    const project = test.info().project.name
    if (project === 'mobile') {
      const bottom = page.getByRole('navigation', { name: 'Navigation', exact: true })
      await expect(bottom.getByRole('link', { name: 'Rechnungen' })).toHaveCount(0)
      await bottom.getByRole('button', { name: 'Mehr' }).click()
      await expect(page.getByRole('dialog').getByRole('link', { name: 'Rechnungen' })).toBeVisible()
      return
    }
    if (project === 'tablet') return
    const links = await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link').allInnerTexts()
    const names = links.map((l) => l.trim())
    expect(names.indexOf('Rechnungen')).toBe(names.indexOf('Gäste') + 1)
    expect(names.indexOf('Einstellungen')).toBe(names.indexOf('Rechnungen') + 1)
  })

  test('AC: Leere Liste – Inhaber mit Knopf, Mitarbeiter ohne Knopf', async ({ page, users }) => {
    desktopOnly()
    const { owner, staff } = await setup(users, { staff: true })
    await signInAs(page, owner)
    await openList(page)
    await expect(page.getByText('Noch keine Rechnungen')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Rechnung nacherfassen' })).toBeVisible()

    await page.context().clearCookies()
    await signInAs(page, staff!)
    await openList(page)
    await expect(page.getByText('Noch keine Rechnungen')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Rechnung nacherfassen' })).toHaveCount(0)
  })

  test('AC: Spalten, Datumsformat, negativer Betrag rot, Status, „ohne PDF“, Sortierung, Suche, Zeilenklick', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId, { last: 'Huber', first: 'Maria' })
    const booking = await addBooking(tenantId, apt, { guestId: guest })
    await addInvoice(owner, tenantId, { number: '2026-0001', date: '2026-10-28', recipient: 'Huber Maria', bookingId: booking.id })
    await addInvoice(owner, tenantId, { number: '2026-0002', date: '2026-10-28', recipient: 'Gutschrift GmbH', lines: [{ label: 'Gutschrift', cents: -5000, rate: 20 }] })
    const oldest = await addInvoice(owner, tenantId, { number: '2024/17', date: '2024-03-14', recipient: 'Altkunde' })
    await signInAs(page, owner)
    await openList(page)

    await expect(page.getByText('3 Rechnungen')).toBeVisible()
    const rows = page.getByRole('table').getByRole('row')
    await expect(rows.nth(0)).toContainText('NummerDatumEmpfängerBuchungBetragStatus')
    // Datum absteigend, bei gleichem Datum Nummer absteigend
    await expect(rows.nth(1)).toContainText('2026-0002')
    await expect(rows.nth(2)).toContainText('2026-0001')
    await expect(rows.nth(3)).toContainText('2024/17')
    expect(text(await rows.nth(1).innerText())).toContain('Mi, 28.10.2026')
    expect(text(await rows.nth(1).innerText())).toContain('-€ 50,00')
    await expect(rows.nth(1).locator('.text-destructive').first()).toBeVisible()
    expect(text(await rows.nth(2).innerText())).toContain('€ 300,00')
    await expect(rows.nth(2).getByRole('link', { name: booking.number! })).toBeVisible()
    await expect(rows.nth(1).getByRole('cell').nth(3)).toHaveText('–')
    await expect(rows.nth(1)).toContainText('nacherfasst')
    await expect(rows.nth(1)).toContainText('ohne PDF')

    // Suche nach Teil der Nummer bzw. des Empfängers; Begriff in der Adresse
    const search = page.getByRole('searchbox', { name: 'Rechnungen suchen' }).or(page.getByLabel('Rechnungen suchen'))
    await search.fill('2024/')
    await expect(page).toHaveURL(/q=2024/)
    await expect(page.getByText('1 Treffer')).toBeVisible()
    await expect(rows).toHaveCount(2)
    await search.fill('gutschr')
    await expect(page.getByText('1 Treffer')).toBeVisible()
    await expect(rows.nth(1)).toContainText('Gutschrift GmbH')
    await search.fill('xyz-nicht-da')
    await expect(page.getByText('Keine Rechnungen gefunden')).toBeVisible()

    // Klick auf die Nummer öffnet genau diese Rechnung
    await openList(page)
    await rows.nth(3).getByRole('link', { name: '2024/17' }).click()
    await expect(page).toHaveURL(new RegExp(`/rechnungen/${oldest}$`))
    await expect(page.getByRole('heading', { name: '2024/17' })).toBeVisible()
  })

  test('BUG-4: Suche findet Nummern mit „_“ und „%“ als Zeichen; Komma und Klammern im Empfänger', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    await addInvoice(owner, tenantId, { number: '2025_01', recipient: 'Huber, Maria (privat)' })
    await addInvoice(owner, tenantId, { number: '2025X01' })
    await addInvoice(owner, tenantId, { number: 'R-10%' })
    await addInvoice(owner, tenantId, { number: 'R-100' })
    await signInAs(page, owner)
    const rows = page.getByRole('table').getByRole('row')
    for (const [q, expected] of [
      ['2025_01', ['2025_01']],
      ['10%', ['R-10%']],
      ['Huber, Maria (', ['2025_01']],
      ['2025', ['2025_01', '2025X01']],
    ] as const) {
      await openList(page, `?q=${encodeURIComponent(q)}`)
      await expect(rows).toHaveCount(expected.length + 1)
      for (const n of expected) await expect(page.getByRole('link', { name: n, exact: true })).toBeVisible()
    }
  })

  test('AC: Mehr als 50 Rechnungen werden seitenweise zu je 50 geblättert', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const rows = Array.from({ length: 51 }, (_, i) => ({
      tenant_id: tenantId,
      number: `P-${String(i + 1).padStart(3, '0')}`,
      invoice_date: '2026-10-01',
      recipient: 'Blätter KG',
      total_cents: 100,
    }))
    const { error } = await service().from('invoices').insert(rows as never)
    expect(error).toBeNull()
    await signInAs(page, owner)
    await openList(page)
    await expect(page.getByText('51 Rechnungen')).toBeVisible()
    await expect(page.getByRole('table').getByRole('row')).toHaveCount(51)
    await expect(page.getByText('Seite 1 von 2')).toBeVisible()
    await page.getByRole('link', { name: 'Weiter' }).click()
    await expect(page).toHaveURL(/seite=2/)
    await expect(page.getByRole('table').getByRole('row')).toHaveCount(2)
    await expect(page.getByRole('table').getByRole('row').nth(1)).toContainText('P-001')
  })
})

test.describe('Nacherfassen', () => {
  test('AC: Pflichtangaben, Datum in der Zukunft, Nummer zu lang, Hinweis bei > 7 Jahren', async ({ page, users }) => {
    desktopOnly()
    const { owner } = await setup(users)
    await signInAs(page, owner)
    await openCreate(page)
    const p = panel(page)
    for (const label of ['Rechnungsnummer', 'Rechnungsdatum', 'Empfänger']) await expect(p.getByLabel(label, { exact: true })).toBeVisible()
    await expect(p.getByText('Buchung (optional)')).toBeVisible()
    await expect(p.getByText('Gast (optional)')).toBeVisible()
    await expect(p.getByText('PDF (optional)')).toBeVisible()

    await save(page)
    await expect(p.getByText('Bitte gib die Rechnungsnummer ein.')).toBeVisible()
    await expect(p.getByText('Bitte gib das Rechnungsdatum ein.')).toBeVisible()
    await expect(p.getByText('Bitte gib den Empfänger ein.')).toBeVisible()
    await expect(p.getByText('Bitte mindestens eine Position eintragen.')).toBeVisible()

    await p.getByLabel('Rechnungsnummer').fill('X'.repeat(31))
    await p.getByLabel('Rechnungsdatum').fill('2099-01-01')
    await save(page)
    await expect(p.getByText('Höchstens 30 Zeichen.')).toBeVisible()
    await expect(p.getByText('Das Rechnungsdatum darf nicht in der Zukunft liegen')).toBeVisible()

    await p.getByLabel('Rechnungsdatum').fill('2015-05-05')
    await expect(p.getByText('Diese Rechnung ist älter als 7 Jahre. Du kannst sie trotzdem speichern.')).toBeVisible()
    await expect(page).toHaveURL(/\/rechnungen$/)
  })

  test('AC: Ohne Buchung und Gast mit PDF speichern → Detailseite; doppelte Nummer (Leerzeichen, Groß-/Kleinschreibung) abgelehnt', async ({
    page,
    users,
  }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    await addInvoice(owner, tenantId, { number: '2025-0042', date: '2025-03-14' })
    await addInvoice(owner, tenantId, { number: 'r-1', date: '2025-04-01' })
    // Andere Kunden dürfen dieselbe Nummer haben
    const other = await setup(users)
    await addInvoice(other.owner, other.tenantId, { number: 'ALT-7' })
    await signInAs(page, owner)
    await openCreate(page)
    const p = panel(page)
    await expect(p.getByText('Noch keine Positionen.', { exact: false })).toBeVisible()

    await p.getByLabel('Rechnungsnummer').fill(' 2025-0042 ')
    await p.getByLabel('Rechnungsdatum').fill('2016-01-10')
    await p.getByLabel('Empfänger').fill('Altkunde ohne Gast')
    await addLine(page, 'Übernachtung', '200', '10')
    await addLine(page, 'Reinigung', '50', '20')
    await expect(p.getByText(/darin USt 10\s?%/)).toBeVisible()
    await p.locator('#rechnung-pdf').setInputFiles(pdf())
    await expect(p.getByText('rechnung.pdf')).toBeVisible()
    await save(page)
    await expect(p.getByText('Diese Rechnungsnummer ist bereits vergeben (Rechnung vom Fr, 14.03.2025).')).toBeVisible()

    await p.getByLabel('Rechnungsnummer').fill('R-1')
    await save(page)
    await expect(p.getByText('Diese Rechnungsnummer ist bereits vergeben (Rechnung vom Di, 01.04.2025).')).toBeVisible()

    await p.getByLabel('Rechnungsnummer').fill('ALT-7')
    await save(page)
    await expect(page).toHaveURL(/\/rechnungen\/[0-9a-f-]{36}$/)
    await expect(page.getByRole('heading', { name: 'ALT-7' })).toBeVisible()
    await expect(page.getByText('Altkunde ohne Gast')).toBeVisible()
    await expect(page.getByText('ohne PDF')).toHaveCount(0)
    const total = text(await page.locator('dl').filter({ hasText: 'Gesamtbetrag' }).innerText())
    expect(total).toContain('€ 250,00')
    // USt je Satz: 200 brutto bei 10 % → 18,18; 50 bei 20 % → 8,33
    const vat = text(await page.locator('dl[aria-labelledby="enthaltene-ust"]').innerText())
    expect(vat).toContain('€ 18,18')
    expect(vat).toContain('€ 8,33')

    // PDF: Öffnen und Herunterladen liefern das PDF
    const view = await page.getByRole('link', { name: 'PDF öffnen' }).getAttribute('href')
    const download = await page.getByRole('link', { name: 'Herunterladen' }).getAttribute('href')
    for (const url of [view!, download!]) {
      const res = await page.request.get(url)
      expect(res.status()).toBe(200)
      expect((await res.body()).subarray(0, 5).toString()).toBe('%PDF-')
    }
    const id = page.url().split('/').pop()!
    const row = await invoiceRow(id)
    expect(row).toMatchObject({ number: 'ALT-7', booking_id: null, guest_id: null, total_cents: 25000 })
    expect(row!.pdf_path).toMatch(new RegExp(`^${tenantId}/`))

    await openList(page)
    await expect(page.getByText('3 Rechnungen')).toBeVisible()
  })

  test('AC: PDF – kein PDF bzw. über 10 MB wird abgelehnt, nichts abgelegt', async ({ page, users }) => {
    desktopOnly()
    const { owner } = await setup(users)
    await signInAs(page, owner)
    await openCreate(page)
    const p = panel(page)
    await p.locator('#rechnung-pdf').setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: Buffer.from('png') })
    await expect(p.getByText('Bitte wähle eine PDF-Datei.')).toBeVisible()
    await p.locator('#rechnung-pdf').setInputFiles(pdf('gross.pdf', 10 * 1024 * 1024 + 1))
    await expect(p.getByText('Die Datei ist größer als 10 MB. Bitte wähle eine kleinere PDF-Datei.')).toBeVisible()
    await expect(p.getByRole('button', { name: 'PDF wählen' })).toBeVisible()
  })

  test('AC: Buchung suchen (Gast, Wohnung, Zeitraum), stornierte gefunden, Sperre nicht; Gast, Empfänger (Firma) und Positionen übernommen', async ({
    page,
    users,
  }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const apt = await addApartment(tenantId)
    const huber = await addGuest(tenantId, { last: 'Huber', first: 'Maria', company: 'Huber Bau GmbH' })
    const booking = await addBooking(tenantId, apt, {
      guestId: huber,
      charges: [
        { label: 'Reinigung', cents: 6000, rate: 10 },
        { label: 'Rabatt', cents: -2000, rate: 20 },
      ],
    })
    await addBooking(tenantId, apt, { guestId: huber, arrival: '2026-09-01', departure: '2026-09-03', cancelled: true, fee: 9000 })
    await addBooking(tenantId, apt, { kind: 'block', arrival: '2026-10-20', departure: '2026-10-22' })
    await signInAs(page, owner)
    await openCreate(page)
    const p = panel(page)
    const search = p.getByRole('combobox', { name: 'Buchung suchen' }).or(p.getByLabel('Buchung suchen'))

    // Zeitraum: Monat 10.2026 → aktive Buchung, aber keine Sperre
    await search.fill('10.2026')
    const options = p.getByRole('option')
    await expect(options).toHaveCount(1)
    expect(text(await options.first().innerText())).toContain('Huber Maria · Haus See · Top 3 · Mi, 14.10.2026 – Sa, 17.10.2026')
    // Gastname: aktive und stornierte Buchung
    await search.fill('Huber')
    await expect(options).toHaveCount(2)
    await expect(options.filter({ hasText: 'storniert' })).toHaveCount(1)
    await search.fill('Top 3')
    await expect(options).toHaveCount(2)

    await options.filter({ hasNotText: 'storniert' }).click()
    await expect(p.getByText('Huber, Maria')).toBeVisible()
    await expect(p.getByLabel('Empfänger')).toHaveValue('Huber Bau GmbH')
    await expect(p.getByLabel('Bezeichnung der Position 1')).toHaveValue('Übernachtung')
    await expect(p.getByLabel('Bezeichnung der Position 2')).toHaveValue('Reinigung')
    await expect(p.getByLabel('Bezeichnung der Position 3')).toHaveValue('Rabatt')
    await expect(p.getByLabel('Betrag der Position 3')).toHaveValue('-20,00')
    await expect(p.getByLabel('Umsatzsteuersatz der Position 1')).toHaveValue('10,00')
    const totalRow = p.locator('div', { hasText: /^Gesamtbetrag/ }).last()
    await expect.poll(async () => text(await totalRow.innerText())).toContain('€ 340,00')

    // Anpassen: Rabatt entfernen, Betrag ändern → sofort neu gerechnet
    await p.getByRole('button', { name: 'Position 3 entfernen' }).click()
    await p.getByLabel('Betrag der Position 1').fill('250')
    await expect.poll(async () => text(await totalRow.innerText())).toContain('€ 310,00')

    // Andere Buchung wählen → Rückfrage; „Ersetzen“ übernimmt die Stornogebühr der stornierten Buchung
    await p.getByRole('button', { name: 'Entfernen', exact: true }).first().click()
    await search.fill('Huber')
    await options.filter({ hasText: 'storniert' }).click()
    const confirm = page.getByRole('alertdialog', { name: 'Positionen ersetzen?' })
    await expect(confirm).toBeVisible()
    await confirm.getByRole('button', { name: 'Ersetzen' }).click()
    await expect(p.getByLabel('Bezeichnung der Position 1')).toHaveValue('Stornogebühr')
    await expect(p.getByLabel('Betrag der Position 1')).toHaveValue('90,00')
    await expect(p.getByLabel(/^Betrag der Position \d+$/)).toHaveCount(1)

    // Empfänger von Hand geändert bleibt beim Gastwechsel
    await p.getByLabel('Empfänger').fill('Frau Maria Huber privat')
    await p.getByRole('button', { name: 'Ändern' }).click()
    const other = await addGuest(tenantId, { last: 'Zander', first: 'Zoe' })
    await p.getByLabel('Gast suchen').fill('Zander')
    await p.getByRole('option', { name: /Zander/ }).click()
    await expect(p.getByLabel('Empfänger')).toHaveValue('Frau Maria Huber privat')

    await p.getByLabel('Rechnungsnummer').fill('2026-0100')
    await p.getByLabel('Rechnungsdatum').fill('2026-10-20')
    await save(page)
    await expect(page).toHaveURL(/\/rechnungen\/[0-9a-f-]{36}$/)
    const row = await invoiceRow(page.url().split('/').pop()!)
    expect(row).toMatchObject({ recipient: 'Frau Maria Huber privat', guest_id: other, total_cents: 9000 })
    expect(row!.booking_id).not.toBe(booking.id)
    await expect(page.getByText('ohne PDF')).toBeVisible()
  })

  test('AC: Neuer Gast im Formular; Empfänger läuft mit; Gesamtbetrag unter 0 wird gespeichert und rot angezeigt', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    await signInAs(page, owner)
    await openCreate(page)
    const p = panel(page)
    await p.getByText('Neuer Gast', { exact: true }).click()
    await p.getByLabel('Nachname', { exact: true }).fill('Neumann')
    await p.getByLabel('Vorname', { exact: true }).fill('Nora')
    await expect(p.getByLabel('Empfänger')).toHaveValue('Neumann Nora')
    await p.getByRole('combobox', { name: 'Herkunftsland' }).click()
    await page.getByPlaceholder('Land suchen').fill('Österreich')
    await page.getByRole('option', { name: 'Österreich', exact: true }).click()
    await p.getByLabel('Rechnungsnummer').fill('GS-1')
    await p.getByLabel('Rechnungsdatum').fill('2026-10-01')
    await addLine(page, 'Gutschrift', '-80')
    await save(page)
    await expect(page).toHaveURL(/\/rechnungen\/[0-9a-f-]{36}$/)
    expect(text(await page.locator('dl').filter({ hasText: 'Gesamtbetrag' }).innerText())).toContain('-€ 80,00')
    await expect(page.getByRole('link', { name: 'Nora Neumann' })).toBeVisible()
    const { data: guests } = await service().from('guests').select('id').eq('tenant_id', tenantId).eq('last_name', 'Neumann')
    expect(guests).toHaveLength(1)
  })
})

test.describe('Bearbeiten, Löschen, Buchungsdetail', () => {
  test('AC: Buchung nachträglich setzen und entfernen; Positionen bleiben bei Buchungsänderung; Abschnitt im Buchungsdetail und Kalender-Panel', async ({
    page,
    users,
  }) => {
    desktopOnly()
    const { owner, staff, tenantId } = await setup(users, { staff: true })
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId, { last: 'Huber', first: 'Maria' })
    const booking = await addBooking(tenantId, apt, { guestId: guest, nights: 30000 })
    const first = await addInvoice(owner, tenantId, { number: '2026-0011', bookingId: booking.id, lines: [{ label: 'Anzahlung', cents: 20000, rate: 10 }] })
    const second = await addInvoice(owner, tenantId, { number: '2026-0012', lines: [{ label: 'Rest', cents: 15000, rate: 10 }] })
    await signInAs(page, owner)

    // Ohne Abschnitt, solange nur eine Rechnung unter dem Gesamtpreis verknüpft ist? → Abschnitt da, kein Hinweis
    await page.goto(`/buchungen/${booking.id}`)
    await ready(page)
    const section = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Rechnungen', exact: true }) })
    await expect(section.getByRole('link', { name: '2026-0011' })).toBeVisible()
    await expect(section.getByText('Verrechnet mehr als Gesamtpreis')).toHaveCount(0)

    // Zweite Rechnung nachträglich mit der Buchung verknüpfen
    await page.goto(`/rechnungen/${second}`)
    await ready(page)
    await page.getByRole('button', { name: 'Bearbeiten' }).click()
    const p = panel(page)
    await p.getByLabel('Buchung suchen').fill('Huber')
    await p.getByRole('option').first().click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Behalten' }).click()
    await expect(p.getByLabel('Bezeichnung der Position 1')).toHaveValue('Rest')
    await save(page, 'Änderungen speichern')
    await expect(page.getByText('Änderungen gespeichert.')).toBeVisible()

    // Buchungsdetail: beide Rechnungen, Verrechnet 350 > Gesamtpreis 300 → Hinweis
    await page.goto(`/buchungen/${booking.id}`)
    await ready(page)
    await expect(section.getByRole('link', { name: '2026-0012' })).toBeVisible()
    expect(text(await section.innerText())).toMatch(/Verrechnet\s*€ 350,00/)
    expect(text(await section.innerText())).toMatch(/Gesamtpreis\s*€ 300,00/)
    await expect(section.getByText('Verrechnet mehr als Gesamtpreis')).toBeVisible()

    // Buchung ändern → Positionen der Rechnung bleiben
    await service().from('booking_amounts').update({ nights_cents: 99900 } as never).eq('id', booking.id)
    expect((await invoiceRow(first))!.total_cents).toBe(20000)

    // Kalender-Panel
    await page.goto(`/belegung?eintrag=${booking.id}`)
    await ready(page)
    await expect(panel(page).getByRole('link', { name: '2026-0011' })).toBeVisible()
    await expect(panel(page).getByRole('link', { name: '2026-0012' })).toBeVisible()

    // Mitarbeiter sieht den Abschnitt inkl. Gesamtpreis
    await page.context().clearCookies()
    await signInAs(page, staff!)
    await page.goto(`/buchungen/${booking.id}`)
    await ready(page)
    expect(text(await section.innerText())).toMatch(/Gesamtpreis\s*€ 300,00/)
    await expect(section.getByRole('link', { name: '2026-0011' })).toBeVisible()

    // Buchung wieder entfernen → verschwindet aus dem Buchungsdetail
    await page.context().clearCookies()
    await signInAs(page, owner)
    await page.goto(`/rechnungen/${second}`)
    await ready(page)
    await page.getByRole('button', { name: 'Bearbeiten' }).click()
    await p.getByRole('button', { name: 'Entfernen', exact: true }).first().click()
    await save(page, 'Änderungen speichern')
    await expect(page.getByText('Änderungen gespeichert.')).toBeVisible()
    await page.goto(`/buchungen/${booking.id}`)
    await ready(page)
    await expect(section.getByRole('link', { name: '2026-0012' })).toHaveCount(0)
    await expect(section.getByRole('link', { name: '2026-0011' })).toBeVisible()
  })

  test('AC: Buchung ohne Rechnungen hat keinen Abschnitt „Rechnungen“', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId, { last: 'Huber', first: 'Maria' })
    const booking = await addBooking(tenantId, apt, { guestId: guest })
    await signInAs(page, owner)
    await page.goto(`/buchungen/${booking.id}`)
    await ready(page)
    await expect(page.getByRole('heading', { name: 'Preis' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Rechnungen', exact: true })).toHaveCount(0)
  })

  test('AC: PDF nachreichen und ersetzen – „ohne PDF“ entfällt, altes PDF nicht mehr abrufbar', async ({ page, users }) => {
    desktopOnly()
    const { owner } = await setup(users)
    await signInAs(page, owner)
    await openCreate(page)
    const p = panel(page)
    await p.getByLabel('Rechnungsnummer').fill('PDF-1')
    await p.getByLabel('Rechnungsdatum').fill('2026-10-01')
    await p.getByLabel('Empfänger').fill('PDF Test')
    await addLine(page, 'Übernachtung', '100')
    await save(page)
    await expect(page.getByText('ohne PDF')).toBeVisible()
    await expect(page.getByText('Kein PDF hinterlegt.')).toBeVisible()
    const id = page.url().split('/').pop()!

    // Nachreichen
    await page.getByRole('button', { name: 'Bearbeiten' }).click()
    await p.locator('#rechnung-pdf').setInputFiles(pdf('erstes.pdf'))
    await expect(p.getByText('erstes.pdf')).toBeVisible()
    await save(page, 'Änderungen speichern')
    await expect(page.getByText('Änderungen gespeichert.')).toBeVisible()
    await expect(page.getByText('ohne PDF')).toHaveCount(0)
    const oldPath = (await invoiceRow(id))!.pdf_path!
    const oldUrl = (await page.getByRole('link', { name: 'PDF öffnen' }).getAttribute('href'))!

    // Ersetzen
    await page.getByRole('button', { name: 'Bearbeiten' }).click()
    await p.getByRole('button', { name: 'Ersetzen' }).click()
    await p.locator('#rechnung-pdf').setInputFiles(pdf('zweites.pdf'))
    await expect(p.getByText('zweites.pdf')).toBeVisible()
    await save(page, 'Änderungen speichern')
    // Erfolgsmeldung des ersten Speicherns kann noch sichtbar sein: auf den neuen Stand warten
    await expect.poll(async () => (await invoiceRow(id))!.pdf_path).not.toBe(oldPath)
    await expect(panel(page)).toBeHidden()
    await expect.poll(async () => (await page.request.get(oldUrl)).status()).not.toBe(200)
    const { data: left } = await service().storage.from('invoices').list(oldPath.split('/')[0])
    expect((left ?? []).map((f) => f.name)).not.toContain(oldPath.split('/')[1])
  })

  test('AC: Löschen – Abbrechen behält, Bestätigen entfernt Rechnung und PDF; Protokoll mit Person', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    await signInAs(page, owner)
    await openCreate(page)
    const p = panel(page)
    await p.getByLabel('Rechnungsnummer').fill('DEL-1')
    await p.getByLabel('Rechnungsdatum').fill('2026-10-01')
    await p.getByLabel('Empfänger').fill('Lösch Test')
    await addLine(page, 'Übernachtung', '100')
    await p.locator('#rechnung-pdf').setInputFiles(pdf())
    await expect(p.getByText('rechnung.pdf')).toBeVisible()
    await save(page)
    await expect(page.getByRole('heading', { name: 'DEL-1' })).toBeVisible()
    const id = page.url().split('/').pop()!
    const path = (await invoiceRow(id))!.pdf_path!

    await page.getByRole('button', { name: 'Löschen' }).click()
    const dialog = page.getByRole('alertdialog', { name: 'Rechnung „DEL-1“ löschen?' })
    await expect(dialog.getByText('Die Rechnung und ihr PDF werden endgültig gelöscht.', { exact: false })).toBeVisible()
    await dialog.getByRole('button', { name: 'Abbrechen' }).click()
    expect(await invoiceRow(id)).not.toBeNull()

    await page.getByRole('button', { name: 'Löschen' }).click()
    await dialog.getByRole('button', { name: 'Endgültig löschen' }).click()
    await expect(page).toHaveURL(/\/rechnungen$/)
    await expect(page.getByText('Rechnung gelöscht.')).toBeVisible()
    expect(await invoiceRow(id)).toBeNull()
    const { data: left } = await service().storage.from('invoices').list(tenantId)
    expect((left ?? []).map((f) => f.name)).not.toContain(path.split('/')[1])

    const { data: log } = await service().from('audit_log').select('action, actor_id').eq('table_name', 'invoices').eq('record_id', id).order('created_at')
    expect((log ?? []).map((l) => l.action)).toEqual(['insert', 'delete'])
    expect((log ?? []).every((l) => l.actor_id === owner.id)).toBe(true)
  })

  test('AC: Gleichzeitige Bearbeitung – der zweite wird auf die Änderung hingewiesen', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const id = await addInvoice(owner, tenantId, { number: 'K-1' })
    await signInAs(page, owner)
    await page.goto(`/rechnungen/${id}`)
    await ready(page)
    await page.getByRole('button', { name: 'Bearbeiten' }).click()
    // inzwischen ändert jemand anderes die Rechnung
    const client = await signedIn(owner)
    const row = (await invoiceRow(id))!
    const other = await client.rpc('save_invoice', {
      p_input: { id, updated_at: row.updated_at, tenant_id: tenantId, number: 'K-1', invoice_date: '2026-10-20', recipient: 'Jemand anderes', lines: [{ label: 'X', amount_cents: 100, vat_rate: '20.00' }] } as unknown as Json,
    })
    expect(other.error).toBeNull()
    await panel(page).getByLabel('Empfänger').fill('Meine Änderung')
    await save(page, 'Änderungen speichern')
    await expect(panel(page).getByText('Die Rechnung wurde inzwischen geändert. Deine Eingaben sind noch nicht gespeichert.')).toBeVisible()
    expect((await invoiceRow(id))!.recipient).toBe('Jemand anderes')
  })

  test('AC: Kleinunternehmer am Rechnungsdatum – keine Satzfelder, keine USt im Detail', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    await service().from('vat_status_changes').insert({ tenant_id: tenantId, valid_from: '2020-01-01', small_business: true } as never)
    await service().from('vat_status_changes').insert({ tenant_id: tenantId, valid_from: '2026-01-01', small_business: false } as never)
    await signInAs(page, owner)
    await openCreate(page)
    const p = panel(page)
    await p.getByLabel('Rechnungsdatum').fill('2025-06-01')
    await p.getByRole('button', { name: 'Position hinzufügen' }).click()
    await expect(p.getByLabel('Umsatzsteuersatz der Position 1')).toHaveCount(0)
    await expect(p.getByText('Keine Umsatzsteuer (Kleinunternehmer)')).toBeVisible()
    await p.getByLabel('Rechnungsdatum').fill('2026-06-01')
    await expect(p.getByLabel('Umsatzsteuersatz der Position 1')).toBeVisible()
    await p.getByLabel('Rechnungsdatum').fill('2025-06-01')
    await p.getByLabel('Rechnungsnummer').fill('KU-1')
    await p.getByLabel('Empfänger').fill('Klein Test')
    await p.getByLabel('Bezeichnung der Position 1').fill('Übernachtung')
    await p.getByLabel('Betrag der Position 1').fill('100')
    await save(page)
    await expect(page.getByRole('heading', { name: 'KU-1' })).toBeVisible()
    await expect(page.getByText('Keine Umsatzsteuer (Kleinunternehmer)')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Darin enthaltene Umsatzsteuer' })).toHaveCount(0)
  })
})

test.describe('Schalter, Rollen, Gäste', () => {
  test('AC: Schalter ein (Voreinstellung); aus → kein Knopf, Rechnungen bleiben bearbeitbar; wieder ein → Knopf da', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const id = await addInvoice(owner, tenantId, { number: 'S-1' })
    await signInAs(page, owner)
    await page.goto('/einstellungen/stammdaten')
    await ready(page)
    const toggle = page.getByRole('switch', { name: 'Rechnungen nacherfassen' })
    await expect(toggle).toBeChecked()
    await toggle.click()
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Kundendaten gespeichert.')).toBeVisible()

    await openList(page)
    await expect(page.getByRole('link', { name: 'S-1' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Rechnung nacherfassen' })).toHaveCount(0)
    await page.goto(`/rechnungen/${id}`)
    await ready(page)
    await page.getByRole('button', { name: 'Bearbeiten' }).click()
    await panel(page).getByLabel('Empfänger').fill('Geändert trotz Schalter aus')
    await save(page, 'Änderungen speichern')
    await expect(page.getByText('Änderungen gespeichert.')).toBeVisible()

    await page.goto('/einstellungen/stammdaten')
    await ready(page)
    await expect(toggle).not.toBeChecked()
    await toggle.click()
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Kundendaten gespeichert.')).toBeVisible()
    await openList(page)
    await expect(page.getByRole('button', { name: 'Rechnung nacherfassen' })).toBeVisible()
  })

  test('AC: Betreiber legt den Schalter in der Kunden-Detailseite um', async ({ page, users }) => {
    desktopOnly()
    const { tenantId } = await setup(users)
    const admin = await users({ displayName: 'Ada Admin', admin: true })
    await signInAsAdmin(page, admin)
    await page.goto(`/betreiber/kunden/${tenantId}`)
    await ready(page)
    const toggle = page.getByRole('switch', { name: 'Rechnungen nacherfassen' })
    await expect(toggle).toBeChecked()
    await toggle.click()
    await page.getByRole('button', { name: 'Speichern' }).click()
    await expect(page.getByText('Kundendaten gespeichert.')).toBeVisible()
    expect((await service().from('tenants').select('invoice_backfill_enabled').eq('id', tenantId).single()).data!.invoice_backfill_enabled).toBe(false)
  })

  test('AC: Mitarbeiter sieht Liste, Detail und PDF, aber keine Knöpfe; fremder Kunde → nicht gefunden', async ({ page, users }) => {
    desktopOnly()
    const { owner, staff, tenantId } = await setup(users, { staff: true })
    await signInAs(page, owner)
    await openCreate(page)
    const p = panel(page)
    await p.getByLabel('Rechnungsnummer').fill('M-1')
    await p.getByLabel('Rechnungsdatum').fill('2026-10-01')
    await p.getByLabel('Empfänger').fill('Mitarbeiter Test')
    await addLine(page, 'Übernachtung', '100')
    await p.locator('#rechnung-pdf').setInputFiles(pdf())
    await expect(p.getByText('rechnung.pdf')).toBeVisible()
    await save(page)
    await expect(page.getByRole('heading', { name: 'M-1' })).toBeVisible()
    const id = page.url().split('/').pop()!
    const path = (await invoiceRow(id))!.pdf_path!

    await page.context().clearCookies()
    await signInAs(page, staff!)
    await openList(page)
    await expect(page.getByRole('link', { name: 'M-1' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Rechnung nacherfassen' })).toHaveCount(0)
    await page.getByRole('link', { name: 'M-1' }).click()
    await expect(page.getByRole('heading', { name: 'M-1' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Bearbeiten' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Löschen' })).toHaveCount(0)
    const view = await page.getByRole('link', { name: 'PDF öffnen' }).getAttribute('href')
    expect((await page.request.get(view!)).status()).toBe(200)

    // Fremder Kunde: Detailseite „nicht gefunden“, PDF nicht lesbar, ohne Anmeldung ebenso
    const stranger = await setup(users)
    await page.context().clearCookies()
    await signInAs(page, stranger.owner)
    await page.goto(`/rechnungen/${id}`)
    await expect(page.getByRole('heading', { name: 'Seite nicht gefunden' })).toBeVisible()
    await expect(page.getByText('Mitarbeiter Test')).toHaveCount(0)
    const strangerClient = await signedIn(stranger.owner)
    const signed = await strangerClient.storage.from('invoices').createSignedUrl(path, 60)
    expect(signed.data).toBeNull()
    const download = await anon().storage.from('invoices').download(path)
    expect(download.data).toBeNull()
    expect(tenantId).toBeTruthy()
  })

  test('AC: Gast nur mit Rechnung wird beim Löschen anonymisiert; Rechnung unverändert, Gast „Gelöschter Gast“', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const guest = await addGuest(tenantId, { last: 'Weg', first: 'Willi' })
    const id = await addInvoice(owner, tenantId, { number: 'G-1', guestId: guest, recipient: 'Weg Willi' })
    await signInAs(page, owner)
    await page.goto(`/gaeste/${guest}`)
    await ready(page)
    await page.getByRole('button', { name: 'Gast löschen' }).click()
    const dialog = page.getByRole('alertdialog')
    await expect(dialog.getByText('Der Gast ist mit Rechnungen verknüpft, die 7 Jahre aufbewahrt werden müssen.', { exact: false })).toBeVisible()
    await dialog.getByRole('button', { name: /anonymisieren|löschen/i }).last().click()
    await expect.poll(async () => (await service().from('guests').select('anonymized_at').eq('id', guest).single()).data?.anonymized_at).not.toBeNull()

    await page.goto(`/rechnungen/${id}`)
    await ready(page)
    await expect(page.getByText('Weg Willi')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Gelöschter Gast' })).toBeVisible()
    expect((await invoiceRow(id))!.guest_id).toBe(guest)
  })
})

test.describe('Buchungsübersicht (Erweiterung)', () => {
  const bookingRows = (page: Page) => page.getByRole('table').getByRole('row')
  const rowOf = (page: Page, text: string) => bookingRows(page).filter({ hasText: text })
  async function openBookings(page: Page, search = '') {
    await page.goto(`/buchungen${search}`)
    await ready(page)
    await page.getByText(/in diesem Monat|in allen Monaten/).first().waitFor()
  }
  async function chooseInvoiceFilter(page: Page, label: string) {
    await page.getByRole('combobox', { name: 'Rechnung', exact: true }).click()
    await page.getByRole('option', { name: label, exact: true }).click()
  }

  // Kunde mit Oktober-Buchung (2 Rechnungen), Dezember-Buchung ohne, Folgejahr ohne, Anzahlung, Sperre, stornierte
  async function seed(users: Users, opts: { staff?: boolean } = {}) {
    const ctx = await setup(users, opts)
    const apt = await addApartment(ctx.tenantId)
    const huber = await addGuest(ctx.tenantId, { last: 'Huber', first: 'Maria' })
    const berger = await addGuest(ctx.tenantId, { last: 'Berger', first: 'Paul' })
    const billed = await addBooking(ctx.tenantId, apt, { guestId: huber, arrival: '2026-10-14', departure: '2026-10-17' })
    const open = await addBooking(ctx.tenantId, apt, { guestId: berger, arrival: '2026-12-01', departure: '2026-12-03' })
    const future = await addBooking(ctx.tenantId, apt, { guestId: berger, arrival: '2027-03-10', departure: '2027-03-12' })
    const deposit = await addBooking(ctx.tenantId, apt, { guestId: huber, arrival: '2026-11-05', departure: '2026-11-08' })
    const block = await addBooking(ctx.tenantId, apt, { kind: 'block', arrival: '2026-10-20', departure: '2026-10-22' })
    const cancelled = await addBooking(ctx.tenantId, apt, { guestId: berger, arrival: '2026-09-01', departure: '2026-09-03', cancelled: true, fee: 5000 })
    // Rechnungen absichtlich nicht in Datumsreihenfolge angelegt
    const second = await addInvoice(ctx.owner, ctx.tenantId, { number: '2026-0002', date: '2026-10-25', bookingId: billed.id })
    const first = await addInvoice(ctx.owner, ctx.tenantId, { number: '2026-0001', date: '2026-10-20', bookingId: billed.id })
    await addInvoice(ctx.owner, ctx.tenantId, { number: 'AZ-1', date: '2026-10-01', bookingId: deposit.id, lines: [{ label: 'Anzahlung', cents: 5000, rate: 10 }] })
    return { ...ctx, apt, billed, open, future, deposit, block, cancelled, first, second }
  }

  test('AC: Spalte „Rechnungen“ mit Nummern als Links nach Rechnungsdatum; leer ohne Rechnung und bei Sperre; auch für Mitarbeiter', async ({ page, users }) => {
    desktopOnly()
    const d = await seed(users, { staff: true })
    for (const user of [d.owner, d.staff!]) {
      await page.context().clearCookies()
      await signInAs(page, user)
      await openBookings(page, '?monat=2026-10')
      await expect(bookingRows(page).first().getByRole('columnheader', { name: 'Rechnungen' })).toBeVisible()
      const billed = rowOf(page, d.billed.number!)
      const links = billed.getByRole('cell').nth(6).getByRole('link')
      await expect(links).toHaveText(['2026-0001', '2026-0002'])
      const blockCell = rowOf(page, 'Sperre').getByRole('cell').nth(6)
      await expect(blockCell).toHaveText('')
    }
    await openBookings(page, '?monat=2026-12')
    await expect(rowOf(page, d.open.number!).getByRole('cell').nth(6)).toHaveText('')
    await openBookings(page, '?monat=2026-10')
    await rowOf(page, d.billed.number!).getByRole('link', { name: '2026-0002' }).click()
    await expect(page).toHaveURL(new RegExp(`/rechnungen/${d.second}$`))
  })

  test('AC: Handy-Karte zeigt „Rechnungen: …“ als Text, ohne Rechnung keine Zeile', async ({ page, users }) => {
    test.skip(test.info().project.name !== 'mobile', 'nur Handy')
    const d = await seed(users)
    await signInAs(page, d.owner)
    await openBookings(page, '?monat=2026-10')
    const card = page.getByRole('listitem').filter({ hasText: d.billed.number! })
    await expect(card.getByText('Rechnungen: 2026-0001, 2026-0002')).toBeVisible()
    // kein Link auf eine Rechnung in der Karte (die Karte selbst ist der Link zur Buchung)
    await expect(card.locator('a[href^="/rechnungen/"]')).toHaveCount(0)
    await expect(page.getByRole('listitem').filter({ hasText: 'Sperre' }).getByText(/^Rechnungen:/)).toHaveCount(0)
  })

  test('AC: Filter „ohne Rechnung“ über alle Monate (auch künftig), ohne Sperren und ohne Anzahlungs-Buchung; „mit Rechnung“; Hinweis, Anzahl, Adresse', async ({ page, users }) => {
    desktopOnly()
    const d = await seed(users)
    await signInAs(page, d.owner)
    // Nicht der aktuelle Monat: nur dann steht er in der Adresse
    await openBookings(page, '?monat=2026-12')
    await page.getByRole('combobox', { name: 'Rechnung', exact: true }).click()
    await expect(page.getByRole('option')).toHaveText(['Alle', 'ohne Rechnung', 'mit Rechnung'])
    await page.keyboard.press('Escape')

    await chooseInvoiceFilter(page, 'ohne Rechnung')
    await expect(page).toHaveURL(/rechnung=ohne/)
    await expect(page).toHaveURL(/monat=2026-12/)
    await expect(page.getByRole('heading', { name: 'Alle Monate' })).toBeVisible()
    await expect(page.getByRole('navigation', { name: /Monat/ })).toHaveCount(0)
    await expect(page.getByText('2 Buchungen ohne Rechnung in allen Monaten')).toBeVisible()
    // Anreise absteigend: Folgejahr vor Dezember
    await expect(bookingRows(page)).toHaveCount(3)
    await expect(bookingRows(page).nth(1)).toContainText(d.future.number!)
    await expect(bookingRows(page).nth(2)).toContainText(d.open.number!)

    await chooseInvoiceFilter(page, 'mit Rechnung')
    await expect(page).toHaveURL(/rechnung=mit/)
    await expect(page.getByText('2 Buchungen mit Rechnung in allen Monaten')).toBeVisible()
    await expect(bookingRows(page).nth(1)).toContainText(d.deposit.number!)
    await expect(bookingRows(page).nth(2)).toContainText(d.billed.number!)

    // „Alle“ führt in den zuvor gewählten Monat zurück
    await chooseInvoiceFilter(page, 'Alle')
    await expect(page).not.toHaveURL(/rechnung=/)
    await expect(page.getByRole('heading', { name: 'Alle Monate' })).toHaveCount(0)
    await expect(page).toHaveURL(/monat=2026-12/)
    await expect(page.getByText(/Dezember 2026/).first()).toBeVisible()
  })

  test('AC: Kombination mit Zustand „storniert“, Art und Suche; Leerzustand mit Zurücksetzen', async ({ page, users }) => {
    desktopOnly()
    const d = await seed(users)
    await signInAs(page, d.owner)
    await openBookings(page, '?rechnung=ohne&zustand=storniert')
    await expect(page.getByText('1 Buchung ohne Rechnung in allen Monaten')).toBeVisible()
    await expect(bookingRows(page).nth(1)).toContainText(d.cancelled.number!)
    await openBookings(page, '?rechnung=ohne&q=Berger')
    await expect(page.getByText('2 Buchungen ohne Rechnung in allen Monaten')).toBeVisible()
    await openBookings(page, '?rechnung=ohne&art=option')
    await expect(page.getByText('Keine Buchung passt zu diesem Filter.')).toBeVisible()
    await page.getByRole('link', { name: 'Suche und Filter zurücksetzen' }).click()
    await expect(page).toHaveURL(/\/buchungen(\?monat=\d{4}-\d{2})?$/)
  })

  test('AC: Neu laden behält den Filter; Rechnung zuordnen bzw. lösen wirkt sofort', async ({ page, users }) => {
    desktopOnly()
    const d = await seed(users)
    await signInAs(page, d.owner)
    await openBookings(page, '?rechnung=ohne')
    await page.reload()
    await ready(page)
    await expect(page.getByText('2 Buchungen ohne Rechnung in allen Monaten')).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Rechnung', exact: true })).toHaveText('ohne Rechnung')

    // Rechnung im Formular der Dezember-Buchung zuordnen, dann über die Navigation zurück
    const inv = await addInvoice(d.owner, d.tenantId, { number: 'NEU-1', date: '2026-10-28' })
    await page.goto(`/rechnungen/${inv}`)
    await ready(page)
    await page.getByRole('button', { name: 'Bearbeiten' }).click()
    await panel(page).getByLabel('Buchung suchen').fill('12.2026')
    await panel(page).getByRole('option').first().click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Behalten' }).click()
    const button = panel(page).getByRole('button', { name: 'Änderungen speichern', exact: true })
    await button.scrollIntoViewIfNeeded()
    await button.click()
    await expect(panel(page)).toBeHidden()
    await page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link', { name: 'Buchungen' }).click()
    await chooseInvoiceFilter(page, 'mit Rechnung')
    await expect(page.getByText('3 Buchungen mit Rechnung in allen Monaten')).toBeVisible()
    await expect(rowOf(page, d.open.number!).getByRole('link', { name: 'NEU-1' })).toBeVisible()
  })

  test('AC: Mehr als 50 Buchungen ohne Rechnung – seitenweise je 50, Anreise absteigend; BUG-5: Seite hinter dem Ende mit richtiger Anzahl', async ({ page, users }) => {
    desktopOnly()
    const { owner, tenantId } = await setup(users)
    const apt = await addApartment(tenantId)
    const guest = await addGuest(tenantId, { last: 'Viel', first: 'Gast' })
    const rows = Array.from({ length: 51 }, (_, i) => {
      const day = new Date(Date.UTC(2025, 0, 1 + i * 3)).toISOString().slice(0, 10)
      const out = new Date(Date.UTC(2025, 0, 2 + i * 3)).toISOString().slice(0, 10)
      return { tenant_id: tenantId, apartment_id: apt, kind: 'booking', arrival: day, planned_departure: out, departure: out, guest_id: guest, check_in: '15:00', check_out: '10:00', adults: 2, child_ages: [], number_year: 2025, number_seq: 500 + i }
    })
    const { error } = await service().from('bookings').insert(rows as never)
    expect(error).toBeNull()
    await signInAs(page, owner)
    await openBookings(page, '?rechnung=ohne')
    await expect(page.getByText('51 Buchungen ohne Rechnung in allen Monaten')).toBeVisible()
    await expect(bookingRows(page)).toHaveCount(51)
    await expect(bookingRows(page).nth(1)).toContainText('2025-0550')
    await expect(page.getByText('Seite 1 von 2')).toBeVisible()
    await page.getByRole('link', { name: 'Weiter' }).click()
    await expect(page).toHaveURL(/seite=2/)
    await expect(bookingRows(page)).toHaveCount(2)
    await expect(bookingRows(page).nth(1)).toContainText('2025-0500')
    // Filterwechsel beginnt wieder bei Seite 1
    await chooseInvoiceFilter(page, 'mit Rechnung')
    await expect(page).not.toHaveURL(/seite=/)
    // Seite hinter dem Ende: Hinweis mit Weg zur ersten Seite, Anzahl stimmt trotzdem (BUG-5)
    await openBookings(page, '?rechnung=ohne&seite=9')
    await expect(page.getByText('Auf dieser Seite stehen keine Buchungen.')).toBeVisible()
    await expect(page.getByText('51 Buchungen ohne Rechnung in allen Monaten')).toBeVisible()
    await page.getByRole('link', { name: 'Zur ersten Seite' }).click()
    await expect(page.getByText('51 Buchungen ohne Rechnung in allen Monaten')).toBeVisible()
  })

  test('Layout: Buchungsübersicht mit Spalte und Filter ohne seitliches Scrollen, keine WCAG-2.1-AA-Verstöße', async ({ page, users }) => {
    const d = await seed(users)
    await addInvoice(d.owner, d.tenantId, { number: '2026-SEHR-LANGE-NUMMER-0003', date: '2026-10-26', bookingId: d.billed.id })
    await signInAs(page, d.owner)
    for (const q of ['?monat=2026-10', '?rechnung=mit']) {
      await openBookings(page, q)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow, q).toBeLessThanOrEqual(0)
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      expect(results.violations, q).toEqual([])
    }
  })
})

test.describe('Layout', () => {
  test('Liste, Detail und Formular ohne seitliches Scrollen, keine automatisch erkennbaren WCAG-2.1-AA-Verstöße', async ({ page, users }) => {
    const { owner, tenantId } = await setup(users)
    const id = await addInvoice(owner, tenantId, {
      number: '2026-LAYOUT-0001',
      recipient: 'Eine sehr lange Firmenbezeichnung Gesellschaft mit beschränkter Haftung & Co KG',
      lines: [
        { label: 'Übernachtung', cents: 30000, rate: 10 },
        { label: 'Rabatt', cents: -5000, rate: 20 },
      ],
    })
    await signInAs(page, owner)
    const check = async () => {
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      expect(overflow).toBeLessThanOrEqual(0)
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      expect(results.violations).toEqual([])
    }
    await openList(page)
    await expect(page.getByText('2026-LAYOUT-0001').filter({ visible: true }).first()).toBeVisible()
    await check()
    if (test.info().project.name === 'mobile') {
      // Handy: Karte ist der Link
      await page.getByRole('link', { name: /2026-LAYOUT-0001/ }).filter({ visible: true }).click()
      await expect(page).toHaveURL(new RegExp(`/rechnungen/${id}$`))
    } else {
      await page.goto(`/rechnungen/${id}`)
    }
    await ready(page)
    await expect(page.getByRole('heading', { name: '2026-LAYOUT-0001' })).toBeVisible()
    await check()
    await page.getByRole('button', { name: 'Bearbeiten' }).click()
    await expect(panel(page).getByLabel('Bezeichnung der Position 2')).toHaveValue('Rabatt')
    // BUG-1: Buchungs- und Gastsuche mit Hinweis „Mindestens 2 Zeichen“ und ohne Treffer
    await expect(panel(page).getByText('Mindestens 2 Zeichen eingeben, z. B.', { exact: false })).toBeVisible()
    await check()
    await panel(page).getByLabel('Buchung suchen').fill('zz-keine-Buchung')
    await expect(panel(page).getByText('Keine passende Buchung gefunden.')).toBeVisible()
    await check()
  })
})
