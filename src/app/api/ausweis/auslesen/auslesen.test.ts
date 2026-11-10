// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Schnittstelle „Ausweis auslesen“ (PROJ-51): Anmeldung, Kunde, Rollen je Stelle, Bildprüfung, Tageslimit, Leser-Ergebnisse
// und das Abschließen der Auslesung. Datenbank, Speicher und KI sind ersetzt; die Datenbankfunktionen prüft
// supabase/tests/id-reading.integration.test.ts, die Aufbereitung src/lib/id-reading-normalize.test.ts.

const TENANT = '11111111-1111-4111-8111-111111111111'
const OTHER = '22222222-2222-4222-8222-222222222222'
const GUEST = '33333333-3333-4333-8333-333333333333'
const BOOKING = '44444444-4444-4444-8444-444444444444'
const FRONT = `${TENANT}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg`

vi.mock('server-only', () => ({}))
const session = { user: null as { userId: string } | null, mfa: null as string | null }
vi.mock('@/lib/auth/session', () => ({
  getSessionUser: async () => session.user,
  pendingMfaStep: async () => session.mfa,
}))
const tenant = { active: null as { id: string; name: string; role: 'owner' | 'staff' } | null }
vi.mock('@/lib/tenant', () => ({ getTenantContext: async () => ({ list: [], active: tenant.active }) }))

// Datenbank des Nutzers: Ergebnisse je Tabelle
const db = {
  booking: null as { guest_id: string | null } | null,
  guest: null as { id: string; anonymized_at: string | null } | null,
  owners: [] as { id: string }[],
}
function query(table: string) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    or: () => chain,
    maybeSingle: async () => ({ data: table === 'bookings' ? db.booking : db.guest, error: null }),
    limit: async () => ({ data: db.owners, error: null }),
  }
  return chain
}
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ from: (t: string) => query(t) }) }))

// Service-Rolle: Vormerken/Abschließen und Speicher
const rpc = vi.fn()
const download = vi.fn()
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ rpc: (name: string, args: unknown) => rpc(name, args), storage: { from: () => ({ download: (p: string) => download(p) }) } }),
}))
const fake = { active: false }
vi.mock('@/lib/id-reading-data', () => ({ fakeReaderActive: () => fake.active }))
const readIdDocument = vi.fn()
vi.mock('@/lib/id-reading-reader', () => ({ readIdDocument: (...a: unknown[]) => readIdDocument(...a) }))

import { POST } from './route'

const current = {
  lastName: 'Muster',
  firstName: 'Maria',
  birthDate: '',
  gender: '',
  country: '',
  documentType: '',
  documentNumber: '',
  documentIssuedOn: '',
  documentAuthority: '',
  documentCountry: '',
}
const body = (over: Record<string, unknown> = {}) => ({
  tenantId: TENANT,
  place: 'guestForm',
  guestId: GUEST,
  bookingId: null,
  frontPath: FRONT,
  backPath: null,
  current,
  ...over,
})
const post = (b: unknown) => POST(new Request('http://localhost/api/ausweis/auslesen', { method: 'POST', body: JSON.stringify(b) }))
const sure = (value: string) => ({ value, certain: true })
const readValues = {
  lastName: sure('MUSTER'),
  firstName: sure('MARIA THERESIA'),
  birthDate: sure('1985-03-12'),
  gender: sure('female'),
  country: sure('DE'),
  documentType: sure('passport'),
  documentNumber: sure('C01X00T47'),
  documentIssuedOn: sure('2020-05-04'),
  documentAuthority: sure('Stadt Köln'),
  documentCountry: sure('DE'),
}
const usage = { model: 'anthropic.claude-haiku-4-5', inputTokens: 1800, outputTokens: 300 }

describe('POST /api/ausweis/auslesen', () => {
  beforeEach(() => {
    session.user = { userId: 'u1' }
    session.mfa = null
    tenant.active = { id: TENANT, name: 'Muster', role: 'owner' }
    db.booking = { guest_id: GUEST }
    db.guest = { id: GUEST, anonymized_at: null }
    db.owners = [{ id: GUEST }]
    fake.active = false
    rpc.mockReset().mockImplementation(async (name: string) => (name === 'reserve_id_reading' ? { data: 'r1', error: null } : { data: null, error: null }))
    download.mockReset().mockResolvedValue({ data: new Blob([new Uint8Array([0xff, 0xd8, 0xff])]), error: null })
    readIdDocument.mockReset().mockResolvedValue({ ok: true, read: readValues, usage })
  })

  it('liefert die Gegenüberstellung und schließt die Auslesung mit Verbrauch ab', async () => {
    const res = await post(body())
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.ok).toBe(true)
    expect(json.comparison.rows.find((r: { field: string }) => r.field === 'firstName')).toMatchObject({ state: 'differs', read: 'Maria Theresia' })
    expect(rpc).toHaveBeenCalledWith('reserve_id_reading', { p_tenant_id: TENANT, p_user_id: 'u1', p_guest_id: GUEST, p_place: 'guestForm' })
    expect(rpc).toHaveBeenCalledWith('finish_id_reading', {
      p_id: 'r1',
      p_outcome: 'read',
      p_model: usage.model,
      p_input_tokens: 1800,
      p_output_tokens: 300,
    })
    expect(readIdDocument).toHaveBeenCalledWith([{ side: 'front', jpeg: expect.any(Buffer) }], expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/))
  })

  it('401 ohne Sitzung, 400 bei ungültiger Eingabe, 403 bei anderem Kunden', async () => {
    session.user = null
    expect((await post(body())).status).toBe(401)
    session.user = { userId: 'u1' }
    expect((await post({ ...body(), place: 'irgendwo' })).status).toBe(400)
    expect((await post(body({ tenantId: OTHER }))).status).toBe(403)
  })

  it('Bilder nur aus dem Ordner des eigenen Kunden; ohne Bild „noImage“', async () => {
    expect((await post(body({ frontPath: `${OTHER}/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg` }))).status).toBe(403)
    expect((await post(body({ frontPath: '../geheim.jpg' }))).status).toBe(400)
    const res = await post(body({ frontPath: null }))
    expect(await res.json()).toEqual({ ok: false, error: 'noImage' })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('Gastformular: Mitarbeiter nur beim neuen Gast', async () => {
    tenant.active = { id: TENANT, name: 'Muster', role: 'staff' }
    expect((await post(body())).status).toBe(403)
    db.owners = []
    expect((await post(body({ guestId: null }))).status).toBe(200)
  })

  it('Gästeblatt: nur der Hauptgast der Buchung des Kunden', async () => {
    tenant.active = { id: TENANT, name: 'Muster', role: 'staff' }
    expect((await post(body({ place: 'guestSheet', bookingId: BOOKING }))).status).toBe(200)
    db.booking = { guest_id: OTHER }
    expect((await post(body({ place: 'guestSheet', bookingId: BOOKING }))).status).toBe(403)
    db.booking = null
    expect((await post(body({ place: 'guestSheet', bookingId: BOOKING }))).status).toBe(403)
    expect((await post(body({ place: 'guestSheet', bookingId: null }))).status).toBe(400)
  })

  it('anonymisierter oder fremder Gast, Bild eines anderen Gastes → 403', async () => {
    db.guest = { id: GUEST, anonymized_at: '2026-01-01T00:00:00Z' }
    expect((await post(body())).status).toBe(403)
    db.guest = null
    expect((await post(body())).status).toBe(403)
    db.guest = { id: GUEST, anonymized_at: null }
    db.owners = [{ id: OTHER }]
    expect((await post(body())).status).toBe(403)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('nicht freigeschaltet und Tageslimit kommen aus der Datenbank', async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'P0990', message: '' } })
    expect(await (await post(body())).json()).toEqual({ ok: false, error: 'notEnabled' })
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'P0991', message: '' } })
    const res = await post(body())
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ ok: false, error: 'dailyLimit' })
    expect(readIdDocument).not.toHaveBeenCalled()
  })

  it('Bild im Speicher nicht lesbar → „noImage“, nichts gezählt', async () => {
    download.mockResolvedValue({ data: null, error: { message: 'not found' } })
    expect(await (await post(body())).json()).toEqual({ ok: false, error: 'noImage' })
    expect(rpc).not.toHaveBeenCalled()
  })

  it('Leser-Ergebnisse: kein Ausweis, nicht erreichbar, nicht eingerichtet', async () => {
    readIdDocument.mockResolvedValueOnce({ ok: false, reason: 'noDocument', usage })
    expect(await (await post(body())).json()).toEqual({ ok: false, error: 'noDocument' })
    expect(rpc).toHaveBeenLastCalledWith('finish_id_reading', expect.objectContaining({ p_outcome: 'no_document' }))

    readIdDocument.mockResolvedValueOnce({ ok: false, reason: 'unreachable', usage: null })
    const res = await post(body())
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ ok: false, error: 'unavailable' })
    expect(rpc).toHaveBeenLastCalledWith('finish_id_reading', expect.objectContaining({ p_outcome: 'unreachable', p_model: null }))

    readIdDocument.mockResolvedValueOnce({ ok: false, reason: 'failed', usage: null })
    expect(await (await post(body())).json()).toEqual({ ok: false, error: 'unavailable' })
    expect(rpc).toHaveBeenLastCalledWith('finish_id_reading', expect.objectContaining({ p_outcome: 'failed' }))

    readIdDocument.mockResolvedValueOnce({ ok: false, reason: 'notConfigured', usage: null })
    expect(await (await post(body())).json()).toEqual({ ok: false, error: 'notReady' })
  })

  it('Test-Leser: liest keine Bilder und ruft die KI nicht', async () => {
    fake.active = true
    const res = await post(body())
    expect(res.status).toBe(200)
    expect(download).not.toHaveBeenCalled()
    expect(readIdDocument).not.toHaveBeenCalled()
    expect(rpc).toHaveBeenLastCalledWith('finish_id_reading', expect.objectContaining({ p_outcome: 'read', p_model: 'test-leser' }))
  })
})
