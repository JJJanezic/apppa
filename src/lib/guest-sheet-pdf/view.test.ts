import { describe, expect, it } from 'vitest'

import { defaultMarketingDoc, defaultPrivacyDoc, type GuestSheetSnapshot } from '@/lib/guest-sheet'
import { buildGuestSheetPdfView } from '@/lib/guest-sheet-pdf/view'

const snapshot: GuestSheetSnapshot = {
  version: 1,
  tenantName: 'Pichler Ferienwohnungen',
  sheetNumber: '2026/17',
  guest: {
    lastName: 'Rossi',
    firstName: 'Giulia',
    titlePrefix: 'Dott.',
    titleSuffix: null,
    gender: 'female',
    birthDate: '1985-04-03',
    country: 'IT',
    documentType: 'passport',
    documentNumber: 'YA1234567',
    documentIssuedOn: '2020-02-01',
    documentAuthority: 'Questura di Bolzano',
    documentCountry: 'IT',
    street: 'Via Roma 1',
    postalCode: '39100',
    city: 'Bolzano',
    addressCountry: 'IT',
    documentFrontPath: null,
    documentBackPath: null,
  },
  companions: [{ lastName: 'Rossi', firstName: 'Luca', birthDate: '2016-07-09' }],
  stay: { arrival: '2026-11-02', plannedDeparture: '2026-11-09', persons: 2 },
  privacyText: defaultPrivacyDoc(),
  marketingText: defaultMarketingDoc(),
  marketingConsent: true,
  signedAt1: '2026-11-02T14:05:00Z',
  signedAt2: '2026-11-02T14:06:00Z',
}

// Übersetzung zum Prüfen: Schlüssel und Werte
const t = (key: string, values?: Record<string, string | number>) => (values ? `${key} ${JSON.stringify(values)}` : key)

const build = (departure: Parameters<typeof buildGuestSheetPdfView>[0]['departure']) =>
  buildGuestSheetPdfView({
    snapshot,
    departure,
    signatures: { first: 'data:image/png;base64,AAA', second: 'data:image/png;base64,BBB' },
    t,
    genderLabel: (g) => `g:${g}`,
    documentTypeLabel: (d) => `d:${d}`,
    locale: 'de',
  })

describe('PDF-Vorlage des Gästeblatts', () => {
  it('übernimmt die eingefrorene Fassung', () => {
    const v = build(null)
    expect(v.establishment).toBe('Pichler Ferienwohnungen')
    expect(v.guest.firstNames).toBe('Dott. Giulia')
    expect(v.guest.birthDate).toBe('03.04.1985')
    expect(v.guest.nationality).toBe('Italien')
    expect(v.guest.document).toBe('d:passport; documentNumber {"number":"YA1234567"}; documentIssuedOn {"date":"01.02.2020"}; Questura di Bolzano; Italien')
    expect(v.companions).toEqual([{ lastName: 'Rossi', firstNames: 'Luca', birthDate: '09.07.2016' }])
    expect(v.arrival).toEqual({ day: '02', month: '11', year: '2026' })
    expect(v.actualDeparture).toBeNull()
    expect(v.departureNote).toBeNull()
    expect(v.consent).toBe(true)
    expect(v.genders.map((g) => g.value)).toEqual(['male', 'female', 'diverse', 'inter', 'open', 'unspecified'])
  })

  it('Inländer ohne Reisedokument', () => {
    const v = buildGuestSheetPdfView({
      snapshot: { ...snapshot, guest: { ...snapshot.guest, country: 'AT', documentType: null } },
      departure: null,
      signatures: { first: '', second: '' },
      t,
      genderLabel: (g) => g,
      documentTypeLabel: (d) => d,
      locale: 'de',
    })
    expect(v.guest.document).toBe('')
  })

  it('setzt die tatsächliche Abreise mit Vermerk ein', () => {
    expect(build({ date: '2026-11-09', noted: null, automatic: true }).actualDeparture).toEqual({ day: '09', month: '11', year: '2026' })
    expect(build({ date: '2026-11-09', noted: null, automatic: true }).departureNote).toBe('departureAutomatic {"date":"09.11.2026"}')
    expect(build({ date: '2026-11-11', noted: { at: '2026-11-10T08:00:00Z', by: 'Eva' }, automatic: false }).departureNote).toContain('departureNoted')
  })
})
