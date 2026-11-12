// @vitest-environment node
import { createTranslator } from 'next-intl'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import messages from '../../../../messages/de.json'

// Download-Adresse des Marketing-Exports (PROJ-52): Anmeldung, Inhaber-Rolle, Filter an die Datenbank, Protokoll vor der
// Datei, Dateiname und Inhalt. Die Datenbank ist ersetzt; ihre Regeln prüft supabase/tests/marketing.integration.test.ts.

vi.mock('server-only', () => ({}))
const session = { user: null as { id: string } | null, mfa: null as string | null }
vi.mock('@/lib/auth/session', () => ({
  getSessionUser: async () => session.user,
  pendingMfaStep: async () => session.mfa,
}))
const tenant = { active: null as { id: string; name: string; role: 'owner' | 'staff' } | null }
vi.mock('@/lib/tenant', () => ({ getTenantContext: async () => ({ list: [], active: tenant.active }) }))
vi.mock('@/lib/marketing-data', async (importActual) => ({
  ...(await importActual<typeof import('@/lib/marketing-data')>()),
  getMarketingPlaces: async () => [{ id: '11111111-1111-4111-8111-111111111111', name: 'Haus See', apartments: [] }],
}))
const rpc = vi.fn()
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ rpc: (name: string, args: unknown) => rpc(name, args) }) }))
vi.mock('next-intl/server', () => ({
  getLocale: async () => 'de',
  getTranslations: async (namespace: string) => {
    const t = createTranslator({ locale: 'de', messages, namespace: namespace as never })
    return Object.assign((key: string, values?: Record<string, unknown>) => t(key as never, values as never), { raw: (key: string) => t.raw(key as never) })
  },
}))

import { GET } from './csv/route'

const SEG = '22222222-2222-4222-8222-222222222222'
const row = {
  id: '33333333-3333-4333-8333-333333333333',
  last_name: 'Huber',
  first_name: 'Anna',
  title_prefix: 'Dr.',
  title_suffix: null,
  gender: 'female',
  company_name: '=Firma;GmbH',
  email: 'anna@example.at',
  phone: null,
  street: 'Seeweg 12',
  postal_code: '5340',
  city: 'St. Gilgen',
  address_country: 'AT',
  language: 'de',
  stay_count: 2,
  last_stay: '2026-07-10',
  consent_on: '2026-08-12',
}
const call = (query = '') => GET(new Request(`http://localhost/api/marketing/csv${query}`))

describe('GET /api/marketing/csv', () => {
  beforeEach(() => {
    session.user = { id: 'u1' }
    session.mfa = null
    tenant.active = { id: 't1', name: 'Pichler Ferienwohnungen', role: 'owner' }
    rpc.mockReset().mockImplementation(async (name: string) =>
      name === 'marketing_guest_list' ? { data: { total: 1, without_contact: 0, rows: [row] }, error: null } : { data: null, error: null }
    )
  })

  it('ohne Anmeldung 401, mit offener 2FA und für Mitarbeiter 403; ohne Daten kein Protokoll', async () => {
    session.user = null
    expect((await call()).status).toBe(401)
    session.user = { id: 'u1' }
    session.mfa = 'verify'
    expect((await call()).status).toBe(403)
    session.mfa = null
    tenant.active = { id: 't1', name: 'X', role: 'staff' }
    expect((await call()).status).toBe(403)
    expect(rpc).not.toHaveBeenCalled()
  })

  it('übergibt die Filter, protokolliert vor der Datei und liefert Dateiname und Spalten', async () => {
    const res = await call(`?land=DE&aufenthalte=2&objekt=11111111-1111-4111-8111-111111111111,44444444-4444-4444-8444-444444444444&segment=${SEG}&seite=3`)
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('content-disposition')).toMatch(/filename\*=UTF-8''gaeste_Pichler-Ferienwohnungen_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}\.csv/)
    const [listCall, logCall] = rpc.mock.calls
    expect(listCall[0]).toBe('marketing_guest_list')
    // unbekanntes Objekt fällt weg, alle Zeilen ohne Blättern
    expect(listCall[1]).toMatchObject({ p_tenant_id: 't1', p_limit: null, p_offset: 0, p_filters: { countries: ['DE'], minStays: 2, properties: ['11111111-1111-4111-8111-111111111111'] } })
    expect(logCall).toEqual(['log_marketing_export', expect.objectContaining({ p_tenant_id: 't1', p_segment_id: SEG, p_count: 1 })])

    const bytes = new Uint8Array(await res.arrayBuffer())
    // UTF-8 mit BOM für Excel
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    const [head, line] = new TextDecoder().decode(bytes).split('\r\n')
    expect(head).toBe('Anrede;Titel vor;Vorname;Nachname;Titel nach;Firma;E-Mail;Telefon;Straße;PLZ;Ort;Land;Sprache;Anzahl Aufenthalte;Letzter Aufenthalt;Eingewilligt seit')
    // Formel entschärft und Strichpunkt eingefasst
    expect(line).toBe(`Frau;Dr.;Anna;Huber;;"'=Firma;GmbH";anna@example.at;;Seeweg 12;5340;St. Gilgen;Österreich;Deutsch;2;10.07.2026;12.08.2026`)
  })

  it('ohne Treffer 404, fehlende Datenbank 503, gescheitertes Protokoll 500 ohne Datei', async () => {
    rpc.mockResolvedValueOnce({ data: { total: 0, without_contact: 0, rows: [] }, error: null })
    expect((await call()).status).toBe(404)
    rpc.mockResolvedValueOnce({ data: null, error: { code: 'PGRST202', message: 'missing' } })
    expect((await call()).status).toBe(503)
    rpc.mockImplementation(async (name: string) =>
      name === 'marketing_guest_list' ? { data: { total: 1, without_contact: 0, rows: [row] }, error: null } : { data: null, error: { code: '42501', message: 'no' } }
    )
    const res = await call()
    expect(res.status).toBe(500)
    expect(await res.text()).toBe('')
  })
})
