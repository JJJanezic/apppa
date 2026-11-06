import { createHash, randomUUID } from 'node:crypto'
import { renameSync } from 'node:fs'

import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test as base } from '@playwright/test'

import type { Json } from '../src/types/database'
import { anon, createTenant, createUser, deleteUser, type E2EUser, hasSupabaseEnv, service, signInAs, signInAsAdmin } from './support/supabase'

// PROJ-42: Seite „Rechnung ausstellen“ bis zur ausgestellten Rechnung. Regeln: src/lib/invoice-issue.test.ts. Datenbank:
// supabase/tests/invoice-issue.integration.test.ts.

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
const previewText = (page: Page) => page.getByTestId('pdf-text')
const submit = (page: Page) => page.getByRole('button', { name: 'Rechnung ausstellen', exact: true })

let seq = 7000

async function pdfText(pdf: Uint8Array) {
  const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const doc = await getDocument({ data: pdf }).promise
  const out: string[] = []
  for (let n = 1; n <= doc.numPages; n++) {
    const content = await (await doc.getPage(n)).getTextContent()
    out.push(content.items.map((i) => ('str' in i ? i.str : '')).join(''))
  }
  return out.join(' ')
}

async function setup(users: Users, { kind = 'booking' as 'booking' | 'option', staff = false } = {}) {
  const owner = await users()
  const staffUser = staff ? await users() : undefined
  const members: { user: E2EUser; role: 'owner' | 'staff' }[] = [{ user: owner, role: 'owner' }]
  if (staffUser) members.push({ user: staffUser, role: 'staff' })
  const tenantId = await createTenant(`QA42 Testkunde ${randomUUID().slice(0, 8)}`, members)
  const db = service()
  await db.from('tenants').update({ address_line1: 'Seeweg 12', postal_code: '5340', city: 'St. Gilgen', country: 'AT', vat_id: 'ATU12345678' } as never).eq('id', tenantId)
  const { data: property, error: pe } = await db
    .from('properties')
    .insert({ tenant_id: tenantId, name: 'Haus See', street: 'Seeweg 12', postal_code: '5340', city: 'St. Gilgen', municipality_code: '50330' })
    .select('id')
    .single()
  if (pe) throw pe
  const { data: apartment, error: ae } = await db
    .from('apartments')
    .insert({ tenant_id: tenantId, property_id: property.id, name: 'Top 3', max_guests: 4, price_cents: 10000 } as never)
    .select('id')
    .single()
  if (ae) throw ae
  const { data: guest, error: ge } = await db
    .from('guests')
    .insert({ tenant_id: tenantId, country: 'AT', last_name: 'Huber', first_name: 'Maria', gender: 'female', street: 'Gartenweg 3', postal_code: '5020', city: 'Salzburg', address_country: 'AT' } as never)
    .select('id')
    .single()
  if (ge) throw ge
  const { data: booking, error: be } = await db
    .from('bookings')
    .insert({
      tenant_id: tenantId,
      apartment_id: (apartment as { id: string }).id,
      kind,
      arrival: '2026-10-14',
      planned_departure: '2026-10-17',
      departure: '2026-10-17',
      guest_id: (guest as { id: string }).id,
      check_in: '15:00',
      check_out: '10:00',
      adults: 2,
      child_ages: [],
      number_year: 2026,
      number_seq: ++seq,
      option_until: kind === 'option' ? '2026-12-31' : null,
    } as never)
    .select('id')
    .single()
  if (be) throw be
  const bookingId = (booking as { id: string }).id
  const { error: me } = await db
    .from('booking_amounts')
    .insert({ id: bookingId, tenant_id: tenantId, nights_cents: 90000, nights_vat_rate: 10, cancellation_fee_cents: null, cancellation_fee_vat_rate: 0 } as never)
  if (me) throw me
  return { owner, staff: staffUser, tenantId, bookingId }
}

async function addDraft(owner: E2EUser, tenantId: string, bookingId: string, over: Record<string, unknown> = {}) {
  const client = anon()
  await client.auth.signInWithPassword({ email: owner.email, password: owner.password })
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
      lines: [{ label: 'Übernachtung', amount_cents: 90000, vat_rate: '10.00', source_kind: 'nights', source_charge_id: null }],
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

async function addBackfilled(owner: E2EUser, tenantId: string, number: string, date: string) {
  const client = anon()
  await client.auth.signInWithPassword({ email: owner.email, password: owner.password })
  const { error } = await client.rpc('save_invoice', {
    p_input: { tenant_id: tenantId, number, invoice_date: date, recipient: 'Huber Maria', lines: [{ label: 'Alt', amount_cents: 1000, vat_rate: '10.00' }] } as unknown as Json,
  })
  if (error) throw error
}

async function open(page: Page, id: string) {
  await page.goto(`/rechnungen/${id}/ausstellen`)
  await ready(page)
  await expect(previewText(page)).toContainText('Rechnungsbetrag', { timeout: 20_000 })
}

test.describe('Seite „Rechnung ausstellen“', () => {
  test('AC: Knopf auf dem Entwurf; Seite zeigt Datum, Vorschlag und Vorschau mit Aufdruck; Mitarbeiter hat keinen Zugang', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users, { staff: true })
    await addBackfilled(s.owner, s.tenantId, '2026-0041', '2026-09-01')
    const id = await addDraft(s.owner, s.tenantId, s.bookingId)
    await signInAs(page, s.owner)
    await page.goto(`/rechnungen/${id}`)
    await page.getByRole('link', { name: 'Ausstellen', exact: true }).click()
    await expect(page).toHaveURL(new RegExp(`/rechnungen/${id}/ausstellen$`))
    await ready(page)
    await expect(page.getByLabel('Rechnungsdatum')).toHaveValue('2026-10-20')
    await expect(page.getByLabel('Rechnungsnummer')).toHaveValue('2026-0042')
    await expect(previewText(page)).toContainText('2026-0042', { timeout: 20_000 })
    await expect(previewText(page)).toContainText('Entwurf')
    await expect(submit(page)).toBeEnabled()
    await page.getByRole('link', { name: 'Zurück zum Entwurf' }).first().click()
    await expect(page).toHaveURL(new RegExp(`/rechnungen/${id}$`))

    await page.context().clearCookies()
    await signInAs(page, s.staff!)
    await page.goto(`/rechnungen/${id}`)
    await ready(page)
    await expect(page.getByRole('link', { name: 'Ausstellen', exact: true })).toHaveCount(0)
    await page.goto(`/rechnungen/${id}/ausstellen`)
    await expect(page.getByLabel('Rechnungsnummer')).toHaveCount(0)
    await expect(page.getByRole('heading', { name: 'Seite nicht gefunden' })).toBeVisible()
    const post = await page.request.post(`/api/rechnungen/${id}/ausstellen`, { data: { invoiceDate: '2026-10-20', number: '2026-0042', updatedAt: 'x', acks: [] } })
    expect(post.status()).toBe(403)
  })

  test('AC: Nummer: Lücke, höher mit Häkchen und Folge, vergeben, Vorschlag übernehmen; Datum: Zukunft sperrt', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    await addBackfilled(s.owner, s.tenantId, '2026-0041', '2026-09-01')
    await addBackfilled(s.owner, s.tenantId, '2026-0039', '2026-08-01')
    const id = await addDraft(s.owner, s.tenantId, s.bookingId)
    await signInAs(page, s.owner)
    await open(page, id)
    const number = page.getByLabel('Rechnungsnummer')

    await number.fill('2026-0040')
    await expect(page.getByText('Füllt eine Lücke')).toBeVisible()
    await expect(submit(page)).toBeEnabled()

    await number.fill('2026-9000')
    await expect(page.getByText('Die nächste Nummer wäre danach 2026-9001.')).toBeVisible()
    await expect(submit(page)).toBeDisabled()
    const ack = page.getByRole('checkbox', { name: 'Diese Nummer trotzdem verwenden' })
    await ack.click()
    await expect(submit(page)).toBeEnabled()
    // Anderer Fall: Häkchen wieder leer
    await number.fill('2026-9001')
    await expect(page.getByText('Die nächste Nummer wäre danach 2026-9002.')).toBeVisible()
    await expect(page.getByRole('checkbox', { name: 'Diese Nummer trotzdem verwenden' })).not.toBeChecked()

    await number.fill('2026-0041')
    await expect(page.getByText('Die Nummer 2026-0041 ist schon vergeben.')).toBeVisible()
    await expect(submit(page)).toBeDisabled()

    await page.getByRole('button', { name: /Vorschlag übernehmen/ }).click()
    await expect(number).toHaveValue('2026-0042')

    await page.getByLabel('Rechnungsdatum').fill('2099-01-01')
    await expect(page.getByText('Das Rechnungsdatum liegt in der Zukunft.')).toBeVisible()
    await expect(submit(page)).toBeDisabled()
    // Der Entwurf bleibt unverändert
    const { data } = await service().from('invoices').select('invoice_date, number, origin').eq('id', id).single()
    expect(data).toMatchObject({ invoice_date: '2026-10-20', number: null, origin: 'draft' })
  })

  test('AC: Datum passt nicht zur Folge: Hinweis, „auf heute“ ändert Datum; Option braucht Häkchen; Fremdformat nur mit Häkchen', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users, { kind: 'option' })
    await addBackfilled(s.owner, s.tenantId, '2026-0050', '2026-10-25')
    const id = await addDraft(s.owner, s.tenantId, s.bookingId)
    await signInAs(page, s.owner)
    await open(page, id)
    await expect(page.getByText(/Die Rechnung 2026-0050 trägt ein späteres Datum \(25\.10\.2026\)/)).toBeVisible()
    const option = page.getByRole('checkbox', { name: 'Buchung ist noch eine Option, trotzdem ausstellen' })
    await expect(submit(page)).toBeDisabled()
    await option.click()
    await expect(submit(page)).toBeEnabled()

    await page.getByLabel('Rechnungsnummer').fill('RE/77')
    await expect(page.getByText('zählt nicht zur Folge')).toBeVisible()
    await expect(submit(page)).toBeDisabled()
  })

  test('AC: Abzug eines Teilrechnungs-Entwurfs und unbekannte Zeichen sperren, mit Link zur Abhilfe', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const part = await addDraft(s.owner, s.tenantId, s.bookingId, {
      kind: 'partial',
      partial: { mode: 'amount', percent: null, amount_cents: 20000 },
      lines: [{ label: 'Anteil', amount_cents: 20000, vat_rate: '10.00' }],
    })
    const final = await addDraft(s.owner, s.tenantId, s.bookingId, {
      kind: 'final',
      deduction_ids: [part],
      recipient: { name: 'Maria ✓ Huber', line1: 'Gartenweg 3', line2: '', postal_code: '5020', city: 'Salzburg', country: 'AT', vat_id: '' },
    })
    await signInAs(page, s.owner)
    await open(page, final)
    await expect(page.getByText('Die abgezogene Teilrechnung ist noch ein Entwurf.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Zur Teilrechnung' })).toHaveAttribute('href', `/rechnungen/${part}`)
    await expect(page.getByText(/Diese Zeichen kann die Schrift nicht darstellen: ✓/)).toBeVisible()
    await expect(submit(page)).toBeDisabled()
  })

  test('AC: Ausstellen bis zur Detailseite: PDF ohne Aufdruck, Liste, Buchung, Sperren; Mitarbeiter öffnet das PDF; Doppelversuch', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users, { staff: true })
    const id = await addDraft(s.owner, s.tenantId, s.bookingId)
    await signInAs(page, s.owner)
    await open(page, id)
    const number = await page.getByLabel('Rechnungsnummer').inputValue()
    await expect(submit(page)).toBeEnabled()
    const { data: before } = await service().from('invoices').select('updated_at').eq('id', id).single()
    await submit(page).click()
    await expect(page).toHaveURL(new RegExp(`/rechnungen/${id}\\?ausgestellt=1$`), { timeout: 30_000 })
    await ready(page)

    await expect(page.getByRole('heading', { name: number })).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Die Rechnung wurde ausgestellt.')).toBeVisible()
    await expect(page.getByText('Rechnung falsch?')).toBeVisible()
    await expect(page.getByText('ausgestellt', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Bearbeiten' })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Löschen' })).toHaveCount(0)
    await expect(page.getByRole('link', { name: 'Ausstellen', exact: true })).toHaveCount(0)
    await expect(page.getByText('Maria Huber').first()).toBeVisible()

    // Datenbank und Datei
    const { data: row } = await service().from('invoices').select('origin, number, pdf_path, pdf_sha256, issued_by, issued_snapshot').eq('id', id).single()
    expect(row).toMatchObject({ origin: 'issued', number, issued_by: s.owner.id })
    const { data: file } = await service().storage.from('invoices').download(row!.pdf_path as string)
    const bytes = Buffer.from(await file!.arrayBuffer())
    expect(bytes.subarray(0, 4).toString()).toBe('%PDF')
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(row!.pdf_sha256)
    // Die Fassung enthält keine zusätzlichen Gästedaten der Buchung
    expect(JSON.stringify(row!.issued_snapshot)).not.toContain('companions')

    // Erneuter Aufruf der Schnittstelle: dieselbe Rechnung, kein zweites PDF
    const again = await page.request.post(`/api/rechnungen/${id}/ausstellen`, { data: { invoiceDate: '2026-10-20', number: 'ANDERE', updatedAt: before!.updated_at, acks: [] } })
    expect(await again.json()).toEqual({ ok: true, id })
    const { data: same } = await service().from('invoices').select('number').eq('id', id).single()
    expect(same!.number).toBe(number)

    // Die Seite führt zur Rechnung
    await page.goto(`/rechnungen/${id}/ausstellen`)
    await expect(page).toHaveURL(new RegExp(`/rechnungen/${id}$`))

    // Liste
    await page.goto('/rechnungen')
    await expect(page.getByRole('link', { name: number }).first()).toBeVisible()

    // Mitarbeiter sieht Rechnung und PDF, kann nichts ändern
    await page.context().clearCookies()
    await signInAs(page, s.staff!)
    await page.goto(`/rechnungen/${id}`)
    await ready(page)
    await expect(page.getByRole('link', { name: 'PDF öffnen' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Herunterladen' })).toBeVisible()
    await expect(page.getByText('Die Rechnung wurde ausgestellt.')).toHaveCount(0)
    const staffPost = await page.request.post(`/api/rechnungen/${id}/ausstellen`, { data: { invoiceDate: '2026-10-20', number: 'X', updatedAt: 'x', acks: [] } })
    expect(staffPost.status()).toBe(403)
  })

  test('AC: Nummer inzwischen vergeben: Meldung und neuer Vorschlag; Entwurf in anderem Fenster geändert: nicht ausgestellt', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const id = await addDraft(s.owner, s.tenantId, s.bookingId, { kind: 'partial', partial: { mode: 'amount', percent: null, amount_cents: 20000 }, lines: [{ label: 'Anteil', amount_cents: 20000, vat_rate: '10.00' }] })
    await signInAs(page, s.owner)
    await open(page, id)
    const number = page.getByLabel('Rechnungsnummer')
    await expect(number).toHaveValue('2026-0001')
    await expect(submit(page)).toBeEnabled()
    await addBackfilled(s.owner, s.tenantId, '2026-0001', '2026-01-02')
    await submit(page).click()
    await expect(page.getByRole('alert').filter({ hasText: 'inzwischen vergeben' })).toBeVisible()
    await expect(number).toHaveValue('2026-0002')
    await expect(submit(page)).toBeEnabled({ timeout: 20_000 })
    expect((await service().from('invoices').select('origin').eq('id', id).single()).data).toMatchObject({ origin: 'draft' })

    await service().from('invoices').update({ updated_at: '2026-01-01T00:00:00Z' } as never).eq('id', id)
    await submit(page).click()
    await expect(page.getByRole('alert').filter({ hasText: 'inzwischen geändert' })).toBeVisible()
    expect((await service().from('invoices').select('origin').eq('id', id).single()).data).toMatchObject({ origin: 'draft' })
  })

  test('AC: Betreiber: Kunde mit ausgestellter Rechnung nicht löschbar', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const id = await addDraft(s.owner, s.tenantId, s.bookingId)
    await signInAs(page, s.owner)
    await open(page, id)
    await expect(submit(page)).toBeEnabled()
    await submit(page).click()
    await expect(page).toHaveURL(/ausgestellt=1/, { timeout: 30_000 })
    await service().from('tenants').update({ status: 'deactivated' } as never).eq('id', s.tenantId)
    await page.context().clearCookies()
    await signInAsAdmin(page, await users({ admin: true }))
    await page.goto(`/betreiber/kunden/${s.tenantId}`)
    await ready(page)
    await expect(page.getByText(/1 ausgestellte Rechnung fällt noch unter die Aufbewahrungspflicht/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Endgültig löschen' })).toHaveCount(0)
  })

  test('QA: Abgelegtes PDF: ohne Aufdruck, mit Nummer und ersetztem Platzhalter, Vorschau mit Aufdruck', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const doc = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nummer: ' }, { type: 'placeholder', attrs: { name: 'Rechnungsnummer' } }] }] }
    const id = await addDraft(s.owner, s.tenantId, s.bookingId, { texts: { intro: { block_id: null, body: doc }, payment: { block_id: null, body: null }, closing: { block_id: null, body: null } } }).catch(async () =>
      addDraft(s.owner, s.tenantId, s.bookingId, { texts: { intro: { block_id: null, body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Nummer: {Rechnungsnummer}' }] }] } }, payment: { block_id: null, body: null }, closing: { block_id: null, body: null } } })
    )
    await signInAs(page, s.owner)
    await open(page, id)
    await expect(previewText(page)).toContainText('Nummer: 2026-0001', { timeout: 20_000 })
    await expect(previewText(page)).toContainText('Entwurf')
    await submit(page).click()
    await expect(page).toHaveURL(/ausgestellt=1/, { timeout: 30_000 })
    const { data: row } = await service().from('invoices').select('pdf_path, issued_snapshot').eq('id', id).single()
    const { data: file } = await service().storage.from('invoices').download(row!.pdf_path as string)
    const text = await pdfText(new Uint8Array(await file!.arrayBuffer()))
    expect(text).toContain('2026-0001')
    expect(text).toContain('Nummer: 2026-0001')
    expect(text).not.toContain('Entwurf')
    // PROJ-40 refine 2026-11-06: neue Schreibweise auch im abgelegten PDF
    expect(text.replace(/\s+/g, ' ')).toMatch(/· \(inkl\. 10 % USt\.\)/)
    expect(text.replace(/\s+/g, ' ')).toMatch(/Rechnungsbetrag \(inkl\. USt\.\)/)
    expect(text.replace(/\s+/g, ' ')).toMatch(/10 % aus € [\d.]+,\d{2}/)
    expect(JSON.stringify(row!.issued_snapshot)).toContain('2026-0001')
  })

  test('QA: Summen, Buchungsübersicht, neuer Entwurf, Nummernkreis und Nummernvorschau nach dem Ausstellen', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const part = await addDraft(s.owner, s.tenantId, s.bookingId, { kind: 'partial', partial: { mode: 'amount', percent: null, amount_cents: 50000 }, lines: [{ label: 'Anteil', amount_cents: 50000, vat_rate: '10.00' }] })
    await signInAs(page, s.owner)
    await page.goto(`/buchungen/${s.bookingId}`)
    await expect(page.locator('main')).toContainText(/In Entwürfen\s*€\s*500,00/)
    await open(page, part)
    await submit(page).click()
    await expect(page).toHaveURL(/ausgestellt=1/, { timeout: 30_000 })
    await page.goto(`/buchungen/${s.bookingId}`)
    await expect(page.locator('main')).toContainText(/Verrechnet\s*€\s*500,00/)
    await expect(page.getByText(/In Entwürfen/)).toHaveCount(0)
    await page.goto(`/buchungen?rechnung=mit&monat=alle`)
    await expect(page.getByRole('link', { name: '2026-0001' }).first()).toBeVisible()
    await page.goto('/einstellungen/rechnungen')
    await ready(page)
    await expect(page.getByText('2026-0002').first()).toBeVisible()
    await page.getByRole('combobox', { name: 'Stellen' }).click()
    await page.getByRole('option', { name: /^5 / }).click()
    await page.getByRole('button', { name: 'Speichern' }).first().click()
    await expect(page.getByText(/Es wurden bereits Rechnungen mit diesem Nummernkreis ausgestellt/)).toBeVisible()
  })

  test('QA: Neuer Entwurf zeigt verrechnete Position „bereits in Rechnung“, abgewählt', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    await service().from('booking_charges').insert({ booking_id: s.bookingId, tenant_id: s.tenantId, label: 'Reinigung', amount_cents: 10000, position: 1, vat_rate: 20 } as never)
    const id = await addDraft(s.owner, s.tenantId, s.bookingId)
    await signInAs(page, s.owner)
    await open(page, id)
    await submit(page).click()
    await expect(page).toHaveURL(/ausgestellt=1/, { timeout: 30_000 })
    await page.goto(`/rechnungen/neu?buchung=${s.bookingId}`)
    await ready(page)
    await expect(page.getByText(/bereits in Rechnung 2026-0001/)).toBeVisible()
    await expect(page.getByRole('checkbox', { name: '„Übernachtung“ auf die Rechnung' })).not.toBeChecked()
    await expect(page.getByRole('checkbox', { name: '„Reinigung“ auf die Rechnung' })).toBeChecked()
  })

  test('QA: Buchung geändert braucht Häkchen; storniert sperrt, bis der Entwurf gespeichert ist', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    await signInAs(page, s.owner)
    await page.goto(`/rechnungen/neu?buchung=${s.bookingId}`)
    await ready(page)
    await expect(page.locator('.ProseMirror').first()).toBeVisible()
    await page.getByRole('button', { name: 'Entwurf speichern', exact: true }).click()
    await expect(page).toHaveURL(/\/rechnungen\/[0-9a-f-]{36}$/)
    const id = page.url().split('/').pop()!
    await open(page, id)
    await expect(submit(page)).toBeEnabled()

    const changed = await service().from('booking_amounts').update({ nights_cents: 80000, billed_nights_cents: 80000 } as never).eq('id', s.bookingId).select('nights_cents')
    expect(changed.error).toBeNull()
    expect(changed.data).toHaveLength(1)
    await open(page, id)
    const ack = page.getByRole('checkbox', { name: /Entwurf trotzdem unverändert ausstellen/ })
    await expect(ack).toBeVisible()
    await expect(submit(page)).toBeDisabled()
    await ack.click()
    await expect(submit(page)).toBeEnabled()

    await service().from('bookings').update({ cancelled_at: new Date().toISOString() } as never).eq('id', s.bookingId)
    await open(page, id)
    await expect(page.getByText(/Die Buchung wurde storniert/)).toBeVisible()
    await expect(page.getByRole('checkbox', { name: /Entwurf trotzdem/ })).toHaveCount(0)
    await expect(submit(page)).toBeDisabled()
    const post = await page.request.post(`/api/rechnungen/${id}/ausstellen`, { data: { invoiceDate: '2026-10-20', number: '2026-0001', updatedAt: (await service().from('invoices').select('updated_at').eq('id', id).single()).data!.updated_at, acks: ['bookingChanged'] } })
    expect(await post.json()).toMatchObject({ ok: false, error: 'blocked' })
  })

  test('QA: Datum ins Vorjahr ändert den Vorschlag, eigene Nummer bleibt; Fristen folgen', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    await addBackfilled(s.owner, s.tenantId, '2025-0118', '2025-12-01')
    const id = await addDraft(s.owner, s.tenantId, s.bookingId)
    await signInAs(page, s.owner)
    await open(page, id)
    const number = page.getByLabel('Rechnungsnummer')
    await page.getByLabel('Rechnungsdatum').fill('2025-12-30')
    await expect(number).toHaveValue('2025-0119')
    await expect(previewText(page)).toContainText('30.12.2025', { timeout: 20_000 })
    await number.fill('2025-0120')
    await page.getByLabel('Rechnungsdatum').fill('2025-12-31')
    await expect(number).toHaveValue('2025-0120')
    await page.getByLabel('Rechnungsdatum').fill('')
    await expect(page.getByText('Bitte gib ein gültiges Datum')).toBeVisible()
    await expect(submit(page)).toBeDisabled()
  })

  test('QA: Logo nicht ladbar braucht Häkchen und wird vermerkt; gekürzte Fußzeile sperrt', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const id = await addDraft(s.owner, s.tenantId, s.bookingId, { kind: 'partial', partial: { mode: 'amount', percent: null, amount_cents: 20000 }, lines: [{ label: 'Anteil', amount_cents: 20000, vat_rate: '10.00' }] })
    await service().from('tenants').update({ logo_path: `${s.tenantId}/${randomUUID()}.png` } as never).eq('id', s.tenantId)
    await signInAs(page, s.owner)
    await open(page, id)
    await expect(submit(page)).toBeDisabled()
    await page.getByRole('checkbox', { name: /Ohne Logo ausstellen/ }).click()
    await expect(submit(page)).toBeEnabled()

    const long = Array.from({ length: 900 }, () => ({ type: 'paragraph', content: [{ type: 'text', text: 'x' }] }))
    const footer = await service().from('invoice_settings').update({ footer: { type: 'doc', content: long } } as never).eq('tenant_id', s.tenantId).select('tenant_id')
    expect(footer.error).toBeNull()
    await open(page, id)
    await expect(page.getByText(/Die Fußzeile ist zu lang und würde gekürzt/)).toBeVisible({ timeout: 30_000 })
    await expect(submit(page)).toBeDisabled()
    await service().from('invoice_settings').update({ footer: null } as never).eq('tenant_id', s.tenantId)

    await open(page, id)
    await page.getByRole('checkbox', { name: /Ohne Logo ausstellen/ }).click()
    await submit(page).click()
    await expect(page).toHaveURL(/ausgestellt=1/, { timeout: 30_000 })
    await expect(page.getByText('Ohne Logo ausgestellt')).toBeVisible()
  })

  test('QA: Schnittstellen: ohne Anmeldung, Mitarbeiter, fremder Inhaber, ungültige Eingaben, XSS', async ({ page, users, request }) => {
    desktopOnly()
    const s = await setup(users, { staff: true })
    const xss = '<img src=x onerror="window.__xss=1">'
    const id = await addDraft(s.owner, s.tenantId, s.bookingId, { recipient: { name: xss, line1: xss, line2: '', postal_code: '5020', city: 'Salzburg', country: 'AT', vat_id: '' } })
    const body = { invoiceDate: '2026-10-20', number: 'X-1', updatedAt: 'x', acks: [] }
    const anon = await request.post(`/api/rechnungen/${id}/ausstellen`, { data: body, headers: { cookie: '' } })
    expect(anon.status()).toBe(401)
    expect((await request.post('/api/rechnungen/vorschau', { data: { draftId: id, issue: { invoiceDate: '2026-10-20', number: 'X' } } })).status()).toBe(403)

    await signInAs(page, s.staff!)
    expect((await page.request.post('/api/rechnungen/vorschau', { data: { draftId: id, issue: { invoiceDate: '2026-10-20', number: 'X' } } })).status()).toBe(403)
    await page.context().clearCookies()

    const stranger = await users()
    await createTenant(`QA42 Fremd ${randomUUID().slice(0, 8)}`, [{ user: stranger, role: 'owner' }])
    await signInAs(page, stranger)
    expect((await page.request.post(`/api/rechnungen/${id}/ausstellen`, { data: body })).status()).toBe(404)
    expect((await page.request.post('/api/rechnungen/vorschau', { data: { draftId: id, issue: { invoiceDate: '2026-10-20', number: 'X' } } })).status()).toBe(404)
    await page.goto(`/rechnungen/${id}/ausstellen`)
    await expect(page.getByRole('heading', { name: /nicht gefunden/i })).toBeVisible()
    await page.context().clearCookies()

    await signInAs(page, s.owner)
    for (const data of [{ ...body, invoiceDate: 'gestern' }, { ...body, invoiceDate: '1980-01-01' }, { ...body, number: 'x'.repeat(201) }, { ...body, acks: 'alle' }, {}]) {
      expect((await page.request.post(`/api/rechnungen/${id}/ausstellen`, { data })).status(), JSON.stringify(data)).toBe(400)
    }
    const nonsense = await page.request.post(`/api/rechnungen/${id}/ausstellen`, { data: { ...body, invoiceDate: '2026-13-45' } })
    expect(nonsense.ok()).toBe(false)
    expect((await service().from('invoices').select('origin').eq('id', id).single()).data).toMatchObject({ origin: 'draft' })

    await open(page, id)
    const row = (await service().from('invoices').select('updated_at').eq('id', id).single()).data!
    await page.getByLabel('Rechnungsnummer').fill('<b>7</b>')
    await page.getByRole('checkbox', { name: 'Diese Nummer trotzdem verwenden' }).click()
    await expect(submit(page)).toBeEnabled()
    await submit(page).click()
    await expect(page).toHaveURL(/ausgestellt=1/, { timeout: 30_000 })
    await expect(page.getByRole('heading', { name: '<b>7</b>' })).toBeVisible()
    expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined()
    expect(row.updated_at).toBeTruthy()
  })

  test('QA: Schlussrechnung: Detail mit Abzug und Kleinunternehmer aus der Fassung; nacherfasste Abzüge gesperrt; Korrekturhinweis nennt den Schalter', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const client = anon()
    await client.auth.signInWithPassword({ email: s.owner.email, password: s.owner.password })
    const { data: saved, error } = await client.rpc('save_invoice', {
      p_input: { tenant_id: s.tenantId, number: 'AR-1', invoice_date: '2026-09-30', booking_id: s.bookingId, recipient: 'Huber Maria', small_business: false, lines: [{ label: 'Anzahlung', amount_cents: 20000, vat_rate: '10.00' }] } as unknown as Json,
    })
    if (error) throw error
    const old = (saved as { id: string }).id
    const final = await addDraft(s.owner, s.tenantId, s.bookingId, { kind: 'final', deduction_ids: [old] })
    await signInAs(page, s.owner)
    await open(page, final)
    await submit(page).click()
    await expect(page).toHaveURL(/ausgestellt=1/, { timeout: 30_000 })
    await expect(page.getByText('abzüglich Rechnung AR-1')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Schlussrechnung').first()).toBeVisible()
    await expect(page.getByText(/€\s*700,00/).first()).toBeVisible()
    await page.screenshot({ path: 'test-results/proj42-detail.png', fullPage: true })

    await page.goto(`/rechnungen/${old}`)
    await ready(page)
    await page.getByRole('button', { name: 'Löschen' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: /löschen/i }).click()
    await expect(page.getByText(/Schlussrechnung 2026-0001 zieht diese Rechnung ab/)).toBeVisible({ timeout: 20_000 })

    await service().from('invoice_settings').update({ backfill_enabled: false } as never).eq('tenant_id', s.tenantId)
    await page.goto(`/rechnungen/${final}`)
    await expect(page.getByText(/Schalter „Rechnungen nacherfassen“/)).toBeVisible()
    await expect(page.getByRole('link', { name: 'Zu den Rechnungseinstellungen' })).toBeVisible()
  })

  test('BUG-4: Vorschlag inzwischen vergeben: nach einer Änderung erscheint die nächste freie Nummer', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const id = await addDraft(s.owner, s.tenantId, s.bookingId)
    await signInAs(page, s.owner)
    await open(page, id)
    const number = page.getByLabel('Rechnungsnummer')
    await expect(number).toHaveValue('2026-0001')
    await addBackfilled(s.owner, s.tenantId, '2026-0001', '2026-01-02')
    await page.getByLabel('Rechnungsdatum').fill('2026-10-21')
    await expect(number).toHaveValue('2026-0002', { timeout: 20_000 })
    await expect(submit(page)).toBeEnabled({ timeout: 20_000 })
  })

  test('BUG-3: Antwort bleibt aus: Meldung mit „Seite neu laden“; nichts bleibt gesperrt', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const id = await addDraft(s.owner, s.tenantId, s.bookingId)
    await signInAs(page, s.owner)
    await open(page, id)
    await expect(submit(page)).toBeEnabled()
    await page.evaluate(() => {
      // Zeitgrenze des Knopfs verkürzen statt eine Minute zu warten
      const orig = AbortSignal.timeout.bind(AbortSignal)
      AbortSignal.timeout = () => orig(300)
    })
    await page.route('**/ausstellen', async (route) => {
      if (route.request().method() !== 'POST') return route.continue()
      await new Promise((r) => setTimeout(r, 3000))
      await route.abort().catch(() => {})
    })
    await submit(page).click()
    await expect(page.getByRole('alert').filter({ hasText: 'ungewöhnlich lange' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Seite neu laden' })).toBeVisible()
    await expect(submit(page)).toBeEnabled()
  })

  test('BUG-5: Hinweise sind keine Alarme; „Datum auf heute setzen“ nur einmal', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    await addBackfilled(s.owner, s.tenantId, '2026-0050', '2026-10-25')
    const id = await addDraft(s.owner, s.tenantId, s.bookingId)
    await signInAs(page, s.owner)
    await open(page, id)
    await expect(page.getByText(/trägt ein späteres Datum/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Datum auf heute setzen' })).toHaveCount(1)
    await expect(page.getByRole('alert').filter({ hasText: 'späteres Datum' })).toHaveCount(0)
    await submit(page).click()
    await expect(page).toHaveURL(/ausgestellt=1/, { timeout: 30_000 })
    await expect(page.getByText('Rechnung falsch?')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByRole('alert').filter({ hasText: 'Rechnung falsch?' })).toHaveCount(0)
  })

  test('Runde 2: BUG-1 in der Oberfläche: Zusatzkosten aus der Buchung entfernen; Rechnung bleibt unverändert', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const { data: charge, error } = await service().from('booking_charges').insert({ booking_id: s.bookingId, tenant_id: s.tenantId, label: 'Reinigung', amount_cents: 10000, position: 1, vat_rate: 20 } as never).select('id').single()
    if (error) throw error
    const id = await addDraft(s.owner, s.tenantId, s.bookingId, {
      lines: [
        { label: 'Übernachtung', amount_cents: 90000, vat_rate: '10.00', source_kind: 'nights', source_charge_id: null },
        { label: 'Reinigung', amount_cents: 10000, vat_rate: '20.00', source_kind: 'charge', source_charge_id: (charge as { id: string }).id },
      ],
    })
    await signInAs(page, s.owner)
    await open(page, id)
    await submit(page).click()
    await expect(page).toHaveURL(/ausgestellt=1/, { timeout: 30_000 })
    const { data: before } = await service().from('invoices').select('total_cents, pdf_sha256, issued_snapshot').eq('id', id).single()

    await page.goto(`/buchungen/${s.bookingId}`)
    await ready(page)
    await page.getByRole('button', { name: 'Bearbeiten', exact: true }).click()
    const panel = page.getByRole('dialog')
    await panel.getByRole('button', { name: 'Position 1 entfernen' }).click()
    await panel.getByRole('button', { name: 'Änderungen speichern', exact: true }).click()
    await expect(panel).toHaveCount(0, { timeout: 20_000 })
    expect((await service().from('booking_charges').select('id').eq('booking_id', s.bookingId)).data).toHaveLength(0)

    const { data: after } = await service().from('invoices').select('total_cents, pdf_sha256, issued_snapshot').eq('id', id).single()
    expect(after).toEqual(before)
    await page.goto(`/rechnungen/${id}`)
    await expect(page.getByText(/^Reinigung/)).toBeVisible({ timeout: 20_000 })
  })

  test('Runde 2: BUG-2 in der Oberfläche: unsichtbares Zeichen sperrt, auch am Knopf vorbei', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const id = await addDraft(s.owner, s.tenantId, s.bookingId)
    await signInAs(page, s.owner)
    await open(page, id)
    await page.getByLabel('Rechnungsnummer').fill('2026-0001​')
    await expect(page.getByText(/ohne unsichtbare Zeichen/)).toBeVisible()
    await expect(submit(page)).toBeDisabled()
    const { data: row } = await service().from('invoices').select('updated_at').eq('id', id).single()
    const post = await page.request.post(`/api/rechnungen/${id}/ausstellen`, { data: { invoiceDate: '2026-10-20', number: '2026-0001​', updatedAt: row!.updated_at, acks: [] } })
    expect(await post.json()).toMatchObject({ ok: false, error: 'blocked' })
  })

  test('Runde 2: PDF-Erzeugung scheitert: Meldung, Entwurf ohne Nummer, neuer Versuch gelingt', async ({ page, users }) => {
    desktopOnly()
    test.skip(test.info().project.name === 'safari', 'gebauter Server nötig')
    const s = await setup(users)
    const id = await addDraft(s.owner, s.tenantId, s.bookingId)
    await signInAs(page, s.owner)
    await open(page, id)
    await expect(submit(page)).toBeEnabled()
    const worker = 'pdf-worker-build/render-worker.mjs'
    renameSync(worker, `${worker}.weg`)
    try {
      await submit(page).click()
      await expect(page.getByRole('alert').filter({ hasText: 'Das PDF konnte nicht erzeugt werden' })).toBeVisible({ timeout: 30_000 })
    } finally {
      renameSync(`${worker}.weg`, worker)
    }
    const { data: draft } = await service().from('invoices').select('origin, number, pdf_path').eq('id', id).single()
    expect(draft).toEqual({ origin: 'draft', number: null, pdf_path: null })
    const { data: files } = await service().storage.from('invoices').list(s.tenantId)
    expect(files ?? []).toHaveLength(0)
    await expect(submit(page)).toBeEnabled()
    await submit(page).click()
    await expect(page).toHaveURL(/ausgestellt=1/, { timeout: 30_000 })
  })

  test('Runde 2: Nach dem Ausstellen ändern sich Stammdaten, Fußzeile, Briefpapier und Gast: Fassung und PDF bleiben; Kleinunternehmer festgehalten', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    await service().from('vat_status_changes').insert({ tenant_id: s.tenantId, valid_from: '2020-01-01', small_business: true } as never)
    const id = await addDraft(s.owner, s.tenantId, s.bookingId)
    await signInAs(page, s.owner)
    await open(page, id)
    await expect(previewText(page)).not.toContainText('Darin enthaltene')
    await submit(page).click()
    await expect(page).toHaveURL(/ausgestellt=1/, { timeout: 30_000 })
    const read = async () => (await service().from('invoices').select('small_business, recipient, recipient_name, pdf_path, pdf_sha256, issued_snapshot, invoice_date, total_cents').eq('id', id).single()).data!
    const before = await read()
    expect(before.small_business).toBe(true)
    const file = async () => createHash('sha256').update(Buffer.from(await (await service().storage.from('invoices').download(before.pdf_path as string)).data!.arrayBuffer())).digest('hex')
    expect(await file()).toBe(before.pdf_sha256)

    const { data: invoice } = await service().from('invoices').select('guest_id').eq('id', id).single()
    await service().from('tenants').update({ address_line1: 'Andere Gasse 1', city: 'Wien' } as never).eq('id', s.tenantId)
    await service().from('invoice_settings').update({ footer: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Neue Fußzeile' }] }] } } as never).eq('tenant_id', s.tenantId)
    await service().from('vat_status_changes').insert({ tenant_id: s.tenantId, valid_from: '2021-01-01', small_business: false } as never)
    const { data: booking } = await service().from('bookings').select('guest_id').eq('id', s.bookingId).single()
    const client = anon()
    await client.auth.signInWithPassword({ email: s.owner.email, password: s.owner.password })
    expect((await client.rpc('delete_guest', { p_guest_id: (booking as { guest_id: string }).guest_id })).error).toBeNull()
    expect(invoice).toBeTruthy()

    expect(await read()).toEqual(before)
    expect(await file()).toBe(before.pdf_sha256)
    await page.goto(`/rechnungen/${id}`)
    await expect(page.getByText('Seeweg 12')).toBeVisible({ timeout: 20_000 })
    await expect(page.getByText('Andere Gasse 1')).toHaveCount(0)
    await expect(page.getByText('Maria Huber').first()).toBeVisible()
    await expect(page.getByText(/Darin enthaltene/)).toHaveCount(0)
  })

  test('Runde 2: Pflichtangaben sperren mit Link zur Abhilfe, auch am Knopf vorbei; deaktivierter Kunde', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const id = await addDraft(s.owner, s.tenantId, s.bookingId, { recipient: { name: '', line1: '', line2: '', postal_code: '', city: '', country: '', vat_id: '' } })
    await service().from('tenants').update({ address_line1: null } as never).eq('id', s.tenantId)
    await signInAs(page, s.owner)
    await open(page, id)
    await expect(page.getByRole('link', { name: 'Zu den Stammdaten' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Zum Entwurf', exact: true }).first()).toHaveAttribute('href', new RegExp(`/rechnungen/${id}/bearbeiten#rechnung-empfaenger`))
    await expect(submit(page)).toBeDisabled()
    const { data: row } = await service().from('invoices').select('updated_at').eq('id', id).single()
    const body = { invoiceDate: '2026-10-20', number: '2026-0001', updatedAt: row!.updated_at, acks: [] }
    expect(await (await page.request.post(`/api/rechnungen/${id}/ausstellen`, { data: body })).json()).toMatchObject({ ok: false, error: 'blocked' })
    await service().from('tenants').update({ status: 'deactivated' } as never).eq('id', s.tenantId)
    expect((await page.request.post(`/api/rechnungen/${id}/ausstellen`, { data: body })).status()).toBe(403)
    await service().from('tenants').update({ status: 'active' } as never).eq('id', s.tenantId)
  })

  test('Runde 2: Viele gleichzeitige Vorschauen: Server bleibt erreichbar, danach geht es normal weiter', async ({ page, users }) => {
    desktopOnly()
    const s = await setup(users)
    const id = await addDraft(s.owner, s.tenantId, s.bookingId)
    await signInAs(page, s.owner)
    await open(page, id)
    const results = await Promise.all(
      Array.from({ length: 30 }, (_, i) => page.request.post('/api/rechnungen/vorschau', { data: { draftId: id, issue: { invoiceDate: '2026-10-20', number: `L-${i}` } }, timeout: 60_000 }))
    )
    const statuses = results.map((r) => r.status())
    console.log('STATUS', JSON.stringify(statuses.reduce<Record<number, number>>((a, c) => ({ ...a, [c]: (a[c] ?? 0) + 1 }), {})))
    expect(statuses.filter((c) => c === 200).length).toBeGreaterThan(0)
    expect(statuses.every((c) => c === 200 || c === 500)).toBe(true)
    await open(page, id)
    await expect(submit(page)).toBeEnabled()
  })

  test('Layout: Ausstellen mit Sperren und Häkchen, Detailseite: ohne seitliches Scrollen, keine WCAG-2.1-AA-Verstöße', async ({ page, users }) => {
    const s = await setup(users, { kind: 'option' })
    await addBackfilled(s.owner, s.tenantId, '2026-0050', '2026-10-25')
    const id = await addDraft(s.owner, s.tenantId, s.bookingId)
    await signInAs(page, s.owner)
    await open(page, id)
    await page.getByLabel('Rechnungsnummer').fill('2026-9000')
    await expect(page.getByText('Die nächste Nummer wäre danach 2026-9001.')).toBeVisible()
    const check = async (where: string) => {
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), where).toBeLessThanOrEqual(0)
      const a11y = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
      expect(a11y.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(', ')}`), where).toEqual([])
    }
    await check('Ausstellen')
    for (const box of await page.getByRole('checkbox').all()) await box.click()
    await expect(submit(page)).toBeEnabled({ timeout: 20_000 })
    await submit(page).click()
    await expect(page).toHaveURL(/ausgestellt=1/, { timeout: 30_000 })
    await ready(page)
    // Erst die fertige Seite prüfen, nicht die Ladeansicht
    await expect(page.getByRole('heading', { name: '2026-9000' })).toBeVisible({ timeout: 20_000 })
    await expect(page).toHaveTitle(/2026-9000/)
    await check('Detail')
    await page.screenshot({ path: `test-results/proj42-detail-${test.info().project.name}.png`, fullPage: true })
  })

  test('Layout: ohne seitliches Scrollen', async ({ page, users }) => {
    const s = await setup(users)
    const id = await addDraft(s.owner, s.tenantId, s.bookingId)
    await signInAs(page, s.owner)
    await open(page, id)
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(0)
    await expect(submit(page)).toBeVisible()
    await page.screenshot({ path: `test-results/proj42-${test.info().project.name}.png`, fullPage: true })
  })
})
