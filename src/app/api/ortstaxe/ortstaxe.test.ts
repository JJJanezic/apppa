// @vitest-environment node
import { createTranslator } from 'next-intl'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import messages from '../../../../messages/de.json'

import type { TaxReportRow } from '@/lib/tourist-tax-report'

// Download-Adressen der Ortstaxen-Berichte (PROJ-16): Anmeldung, Inhaber-Rolle, Filter, Dateinamen und Inhalte.
// Datenbank und PDF-Arbeitsprozess sind ersetzt; beide prüfen eigene Tests.

vi.mock('server-only', () => ({}))
const session = { user: null as { id: string } | null, mfa: null as string | null }
vi.mock('@/lib/auth/session', () => ({
  getSessionUser: async () => session.user,
  pendingMfaStep: async () => session.mfa,
}))
const tenant = { active: null as { id: string; name: string; role: 'owner' | 'staff' } | null }
vi.mock('@/lib/tenant', () => ({ getTenantContext: async () => ({ list: [], active: tenant.active }) }))
const getTouristTaxReport = vi.fn()
vi.mock('@/lib/tourist-tax-report-data', () => ({ getTouristTaxReport: (f: unknown) => getTouristTaxReport(f) }))
vi.mock('@/lib/invoice-drafts-data', () => ({
  getDraftPreviewData: async () => ({
    issuer: { name: 'Muster GmbH', nameLine2: null, addressLine1: 'Seestraße 12', addressLine2: null, postalCode: '5753', city: 'Saalbach', country: 'AT', vatId: null },
    letterhead: { fontFamily: 'carlito', fontSize: 11, lineSpacing: 'normal', paragraphSpacing: 'normal', logoPosition: 'left', logoHeightMm: 25, showIssuer: true },
  }),
}))
vi.mock('@/lib/letterhead-data', () => ({ loadPdfLogo: async () => ({ logo: null, failed: false }) }))
const { PdfBusyError } = vi.hoisted(() => ({ PdfBusyError: class PdfBusyError extends Error {} }))
const renderTaxReportPdf = vi.fn()
vi.mock('@/lib/invoice-pdf/render', () => ({ PdfBusyError, renderTaxReportPdf: (v: unknown) => renderTaxReportPdf(v) }))
vi.mock('next-intl/server', () => ({
  getLocale: async () => 'de',
  getTranslations: async (namespace: string) => {
    const t = createTranslator({ locale: 'de', messages, namespace: namespace as never })
    return Object.assign((key: string, values?: Record<string, unknown>) => t(key as never, values as never), { raw: (key: string) => t.raw(key as never) })
  },
}))

import { GET as csv } from './csv/route'
import { GET as pdf } from './pdf/route'

const row = (over: Partial<TaxReportRow> = {}): TaxReportRow => ({
  bookingId: 'b1',
  bookingNumber: '2026-0001',
  guestName: '=Huber Anna',
  anonymized: false,
  apartment: 'Haus · Top 1',
  municipalityId: '50618',
  municipalityName: 'Saalbach-Hinterglemm',
  arrival: '2026-10-02',
  departure: '2026-10-05',
  persons: 3,
  amountCents: 1500,
  taxableNights: 6,
  knownTaxableNights: 6,
  exemptNights: 3,
  unknownPositions: 0,
  partial: false,
  legacy: false,
  percent: false,
  ...over,
})

const request = (path: string) => new Request(`http://localhost/api/ortstaxe/${path}`)

describe('Ortstaxen-Berichte: Downloads', () => {
  beforeEach(() => {
    session.user = { id: 'u1' }
    session.mfa = null
    tenant.active = { id: 't1', name: 'Muster GmbH', role: 'owner' }
    getTouristTaxReport.mockReset().mockResolvedValue({ ready: true, failed: false, tenantId: 't1', rows: [row(), row({ bookingId: 'b2', municipalityId: '50628', municipalityName: 'Zell am See' })] })
    renderTaxReportPdf.mockReset().mockResolvedValue({ pdf: new Uint8Array([37, 80, 68, 70]), pages: 1 })
  })

  it('ohne Anmeldung 401, mit offener Zwei-Faktor-Anmeldung 403', async () => {
    session.user = null
    expect((await csv(request('csv'))).status).toBe(401)
    expect((await pdf(request('pdf'))).status).toBe(401)
    session.user = { id: 'u1' }
    session.mfa = '/2fa'
    expect((await csv(request('csv'))).status).toBe(403)
    expect(getTouristTaxReport).not.toHaveBeenCalled()
  })

  it('Mitarbeiter und Personen ohne Kunde erhalten 403 und keine Daten', async () => {
    tenant.active = { id: 't1', name: 'Muster GmbH', role: 'staff' }
    expect((await csv(request('csv'))).status).toBe(403)
    expect((await pdf(request('pdf'))).status).toBe(403)
    tenant.active = null
    expect((await csv(request('csv'))).status).toBe(403)
    expect(getTouristTaxReport).not.toHaveBeenCalled()
    expect(renderTaxReportPdf).not.toHaveBeenCalled()
  })

  it('CSV: Filter aus der Adresse, Dateiname, BOM, eine Zeile je Buchung, nicht zwischenspeichern', async () => {
    const res = await csv(request('csv?jahr=2026&von=7&bis=9'))
    expect(res.status).toBe(200)
    expect(getTouristTaxReport).toHaveBeenCalledWith({ year: 2026, from: 7, to: 9, municipality: null })
    expect(res.headers.get('content-type')).toBe('text/csv; charset=utf-8')
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('content-disposition')).toMatch(/^attachment; filename="Ortstaxe_2026-07-bis-09_Alle_Stand-\d{4}-\d{2}-\d{2}\.csv"; filename\*=UTF-8''/)
    const bytes = new Uint8Array(await res.arrayBuffer())
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf])
    const lines = new TextDecoder().decode(bytes).replace(/^﻿/, '').trimEnd().split('\r\n')
    expect(lines[0]).toBe('Gemeinde;Nr.;Hauptgast;Wohnung;Anreise;Abreise;Personen;Abgabepflichtige Personennächte;Befreite Personennächte;Betrag;Hinweis')
    expect(lines).toHaveLength(3)
    // Formelschutz
    expect(lines[1]).toBe("Saalbach-Hinterglemm;2026-0001;'=Huber Anna;Haus · Top 1;02.10.2026;05.10.2026;3;6;3;15,00;")
  })

  it('Gemeindefilter wirkt; Umlaute im Dateinamen als UTF-8', async () => {
    getTouristTaxReport.mockResolvedValue({ ready: true, failed: false, tenantId: 't1', rows: [row({ municipalityId: '70101', municipalityName: 'Wörgl' }), row({ bookingId: 'b2', municipalityId: '50628', municipalityName: 'Zell am See' })] })
    const res = await csv(request('csv?jahr=2026&von=10&bis=10&gemeinde=70101'))
    const text = await res.text()
    expect(text).toContain('Wörgl')
    expect(text).not.toContain('Zell am See')
    const cd = res.headers.get('content-disposition') ?? ''
    expect(cd).toContain('filename="Ortstaxe_2026-10_Worgl_Stand-')
    expect(cd).toContain(`filename*=UTF-8''${encodeURIComponent('Ortstaxe_2026-10_Wörgl_Stand-')}`)
  })

  it('ohne Ortstaxe im Zeitraum 404, Funktion fehlt 503, Fehler 500', async () => {
    getTouristTaxReport.mockResolvedValue({ ready: true, failed: false, tenantId: 't1', rows: [] })
    expect((await csv(request('csv'))).status).toBe(404)
    getTouristTaxReport.mockResolvedValue({ ready: false, failed: false, tenantId: 't1', rows: [] })
    expect((await pdf(request('pdf'))).status).toBe(503)
    getTouristTaxReport.mockResolvedValue({ ready: true, failed: true, tenantId: 't1', rows: [] })
    expect((await csv(request('csv'))).status).toBe(500)
  })

  it('PDF: Dateiname, Inhalt für den Arbeitsprozess, nicht zwischenspeichern', async () => {
    const res = await pdf(request('pdf?jahr=2026&von=10&bis=10&gemeinde=50618'))
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/pdf')
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(res.headers.get('content-disposition')).toContain('filename="Ortstaxe_2026-10_Saalbach-Hinterglemm.pdf"')
    const view = renderTaxReportPdf.mock.calls[0][0] as { kind: string; meta: string[]; sections: { title: string }[]; pagePerSection: boolean; stand: string }
    expect(view.kind).toBe('touristTaxReport')
    expect(view.meta).toEqual(['Zeitraum: Oktober 2026', 'Gemeinde: Saalbach-Hinterglemm', 'Vermieter: Muster GmbH, Seestraße 12, 5753 Saalbach, Österreich'])
    expect(view.sections.map((s) => s.title)).toEqual(['Saalbach-Hinterglemm'])
    expect(view.pagePerSection).toBe(false)
    expect(view.stand).toMatch(/^Stand: \w{2}, \d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}$/)
  })

  it('PDF: Arbeitsprozess ausgelastet 503, Fehler 500', async () => {
    renderTaxReportPdf.mockRejectedValue(new PdfBusyError('voll'))
    expect((await pdf(request('pdf'))).status).toBe(503)
    renderTaxReportPdf.mockRejectedValue(new Error('kaputt'))
    expect((await pdf(request('pdf'))).status).toBe(500)
  })
})
