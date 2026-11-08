// @vitest-environment node
import { createTranslator } from 'next-intl'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import messages from '../../../../messages/de.json'

import type { StatsApartment, StatsMonthRow, StatsOriginRow } from '@/lib/statistics'

// Download-Adressen der Auswertungen (PROJ-18): Anmeldung, Inhaber-Rolle, Filter, Dateinamen und Inhalte.
// Datenbank und PDF-Arbeitsprozess sind ersetzt; beide prüfen eigene Tests.

vi.mock('server-only', () => ({}))
const session = { user: null as { id: string } | null, mfa: null as string | null }
vi.mock('@/lib/auth/session', () => ({
  getSessionUser: async () => session.user,
  pendingMfaStep: async () => session.mfa,
}))
const tenant = { active: null as { id: string; name: string; role: 'owner' | 'staff' } | null }
vi.mock('@/lib/tenant', () => ({ getTenantContext: async () => ({ list: [], active: tenant.active }) }))
const getStatsData = vi.fn()
vi.mock('@/lib/statistics-data', () => ({ getStatsData: (f: unknown, o: unknown) => getStatsData(f, o) }))
vi.mock('@/lib/invoice-drafts-data', () => ({
  getDraftPreviewData: async () => ({
    issuer: { name: 'Muster GmbH', nameLine2: null, addressLine1: 'Seestraße 12', addressLine2: null, postalCode: '5753', city: 'Saalbach', country: 'AT', vatId: null },
    letterhead: { fontFamily: 'carlito', fontSize: 11, lineSpacing: 'normal', paragraphSpacing: 'normal', logoPosition: 'left', logoHeightMm: 25, showIssuer: true },
  }),
}))
vi.mock('@/lib/letterhead-data', () => ({ loadPdfLogo: async () => ({ logo: null, failed: false }) }))
const { PdfBusyError } = vi.hoisted(() => ({ PdfBusyError: class PdfBusyError extends Error {} }))
const renderStatsPdf = vi.fn()
vi.mock('@/lib/invoice-pdf/render', () => ({ PdfBusyError, renderStatsPdf: (v: unknown) => renderStatsPdf(v) }))
vi.mock('next-intl/server', () => ({
  getLocale: async () => 'de',
  getTranslations: async (namespace: string) => {
    const t = createTranslator({ locale: 'de', messages, namespace: namespace as never })
    return Object.assign((key: string, values?: Record<string, unknown>) => t(key as never, values as never), { raw: (key: string) => t.raw(key as never) })
  },
}))

import { GET as csv } from './csv/route'
import { GET as pdf } from './pdf/route'

const P1 = '11111111-1111-4111-8111-111111111111'
const A1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
const A2 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2'
const APARTMENTS: StatsApartment[] = [
  { id: A1, name: '=Top 1', propertyId: P1, propertyName: 'Haus Wörth', archived: false },
  { id: A2, name: 'Top 2', propertyId: P1, propertyName: 'Haus Wörth', archived: false },
]
const row = (apartmentId: string, month: string, over: Partial<StatsMonthRow> = {}): StatsMonthRow => ({
  apartmentId,
  month,
  availableNights: 31,
  occupiedNights: 10,
  blockedNights: 1,
  revenueCents: 103000,
  revenueVatCents: 9364,
  feeCents: 0,
  feeVatCents: 0,
  guestNights: 20,
  arrivals: 4,
  bookings: 2,
  stayNights: 10,
  ...over,
})
const ROWS = [row(A1, '2026-10'), row(A2, '2026-10'), row(A1, '2026-09'), row(A1, '2025-10', { occupiedNights: 5 })]
const ORIGIN: StatsOriginRow[] = [{ apartmentId: A1, country: 'DE', previous: false, arrivals: 4, guestNights: 20, revenueCents: 103000 }]
const data = (over: Record<string, unknown> = {}) => ({ ready: true, failed: false, tenantId: 't1', apartments: APARTMENTS, rows: ROWS, origin: ORIGIN, ...over })

const request = (path: string) => new Request(`http://localhost/api/auswertungen/${path}`)

describe('Auswertungen: Downloads', () => {
  beforeEach(() => {
    session.user = { id: 'u1' }
    session.mfa = null
    tenant.active = { id: 't1', name: 'Muster GmbH', role: 'owner' }
    getStatsData.mockReset().mockResolvedValue(data())
    renderStatsPdf.mockReset().mockResolvedValue({ pdf: new Uint8Array([37, 80, 68, 70]), pages: 1 })
  })

  it('ohne Anmeldung 401, mit offener Zwei-Faktor-Anmeldung 403', async () => {
    session.user = null
    expect((await csv(request('csv'))).status).toBe(401)
    expect((await pdf(request('pdf'))).status).toBe(401)
    session.user = { id: 'u1' }
    session.mfa = '/2fa'
    expect((await csv(request('csv'))).status).toBe(403)
    expect(getStatsData).not.toHaveBeenCalled()
  })

  it('Mitarbeiter und Personen ohne Kunde erhalten 403 und keine Daten', async () => {
    tenant.active = { id: 't1', name: 'Muster GmbH', role: 'staff' }
    expect((await csv(request('csv'))).status).toBe(403)
    expect((await pdf(request('pdf'))).status).toBe(403)
    tenant.active = null
    expect((await csv(request('csv'))).status).toBe(403)
    expect(getStatsData).not.toHaveBeenCalled()
    expect(renderStatsPdf).not.toHaveBeenCalled()
  })

  it('CSV: Filter aus der Adresse, Dateiname, BOM, eine Zeile je Wohnung und Monat, Formelschutz, nicht zwischenspeichern', async () => {
    const res = await csv(request('csv?jahr=2026&von=10&bis=10'))
    expect(res.status).toBe(200)
    expect(getStatsData).toHaveBeenCalledWith({ year: 2026, from: 10, to: 10, property: null, apartment: null }, { origin: false })
    expect(res.headers.get('content-type')).toBe('text/csv; charset=utf-8')
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('content-disposition')).toMatch(/^attachment; filename="Auswertung_2026-10_Alle_Stand-\d{4}-\d{2}-\d{2}\.csv"; filename\*=UTF-8''/)
    const bytes = new Uint8Array(await res.arrayBuffer())
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    const lines = new TextDecoder().decode(bytes).replace(/^﻿/, '').trimEnd().split('\r\n')
    expect(lines).toEqual([
      'Monat;Objekt;Wohnung;Verfügbare Nächte;Belegte Nächte;Gesperrte Nächte;Auslastung (%);Umsatz brutto;USt;Gästenächte;Ankünfte',
      "2026-10;Haus Wörth;'=Top 1;31;10;1;32,3;1030,00;93,64;20;4",
      '2026-10;Haus Wörth;Top 2;31;10;1;32,3;1030,00;93,64;20;4',
    ])
  })

  it('Wohnungsfilter wirkt; Umlaute im Dateinamen als UTF-8; Wohnung eines anderen Kunden → alle Wohnungen', async () => {
    const res = await csv(request(`csv?jahr=2026&von=10&bis=10&wohnung=${A2}`))
    const text = await res.text()
    expect(text).not.toContain('Top 1')
    const cd = res.headers.get('content-disposition') ?? ''
    expect(cd).toContain('filename="Auswertung_2026-10_Haus-Worth-Top-2_Stand-')
    expect(cd).toContain(`filename*=UTF-8''${encodeURIComponent('Auswertung_2026-10_Haus-Wörth-Top-2_Stand-')}`)
    const other = await csv(request('csv?jahr=2026&von=10&bis=10&wohnung=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'))
    expect(other.headers.get('content-disposition')).toContain('_Alle_')
  })

  it('ohne Daten im Zeitraum 404, Funktion fehlt 503, Fehler 500', async () => {
    getStatsData.mockResolvedValue(data({ rows: [] }))
    expect((await csv(request('csv'))).status).toBe(404)
    getStatsData.mockResolvedValue(data({ ready: false }))
    expect((await pdf(request('pdf'))).status).toBe(503)
    getStatsData.mockResolvedValue(data({ failed: true }))
    expect((await csv(request('csv'))).status).toBe(500)
  })

  it('PDF: Dateiname, Inhalt für den Arbeitsprozess, nicht zwischenspeichern', async () => {
    const res = await pdf(request(`pdf?jahr=2026&von=10&bis=10&objekt=${P1}`))
    expect(res.status).toBe(200)
    expect(getStatsData).toHaveBeenCalledWith({ year: 2026, from: 10, to: 10, property: P1, apartment: null }, { origin: true })
    expect(res.headers.get('content-type')).toBe('application/pdf')
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('content-disposition')).toMatch(/filename="Auswertung_2026-10_Haus-Worth_Stand-\d{4}-\d{2}-\d{2}\.pdf"/)
    const view = renderStatsPdf.mock.calls[0][0] as { kind: string; meta: string[]; kpis: { value: string }[]; tables: { title: string }[]; stand: string }
    expect(view.kind).toBe('statistics')
    expect(view.meta).toEqual(['Zeitraum: Oktober 2026', 'Wohnungen: Haus Wörth', 'Vermieter: Muster GmbH, Seestraße 12, 5753 Saalbach, Österreich'])
    expect(view.kpis[0].value).toMatch(/^32\s%$/)
    expect(view.tables.map((t) => t.title)).toEqual(['Je Monat', 'Je Wohnung', 'Gästeherkunft'])
    expect(view.stand).toMatch(/^Stand: \w{2}, \d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}$/)
  })

  it('PDF: Arbeitsprozess ausgelastet 503, Fehler 500', async () => {
    renderStatsPdf.mockRejectedValue(new PdfBusyError('voll'))
    expect((await pdf(request('pdf'))).status).toBe(503)
    renderStatsPdf.mockRejectedValue(new Error('kaputt'))
    expect((await pdf(request('pdf'))).status).toBe(500)
  })
})
