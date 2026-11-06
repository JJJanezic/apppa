import { describe, expect, it } from 'vitest'

import {
  accountDisplayName,
  bankAccountsFromRows,
  type BankAccountRow,
  formatIban,
  ibanProblem,
  isBic,
  isHotelId,
  normalizeIban,
  shortIban,
} from '@/lib/bank-accounts'

describe('IBAN', () => {
  it('entfernt Leerzeichen und schreibt groß', () => {
    expect(normalizeIban(' at61 1904 3002 3457 3201 ')).toBe('AT611904300234573201')
  })

  it('akzeptiert gültige österreichische und deutsche IBAN', () => {
    expect(ibanProblem('at61 1904 3002 3457 3201')).toBeNull()
    expect(ibanProblem('DE89 3704 0044 0532 0130 00')).toBeNull()
  })

  it('erkennt falsche Prüfziffer, Länge, Land und Format', () => {
    expect(ibanProblem('AT62 1904 3002 3457 3201')).toBe('checksum')
    expect(ibanProblem('AT61 1904 3002 3457 320')).toBe('length')
    expect(ibanProblem('AT61 1904 3002 3457 32011')).toBe('length')
    expect(ibanProblem('XX61 1904 3002 3457 3201')).toBe('country')
    expect(ibanProblem('AT61-1904-3002-3457-3201')).toBe('format')
    expect(ibanProblem('')).toBe('format')
  })

  it('zeigt Viererblöcke und eine gekürzte Form', () => {
    expect(formatIban('AT611904300234573201')).toBe('AT61 1904 3002 3457 3201')
    expect(formatIban('DE89370400440532013000')).toBe('DE89 3704 0044 0532 0130 00')
    expect(shortIban('AT611904300234573201')).toBe('AT61 1904 … 3201')
  })
})

describe('BIC', () => {
  it('akzeptiert 8 und 11 Zeichen', () => {
    expect(isBic('RZBAATWW')).toBe(true)
    expect(isBic('RZBAATWWXXX')).toBe(true)
  })

  it('lehnt 9 Zeichen und Kleinbuchstaben ab', () => {
    expect(isBic('RZBAATWWX')).toBe(false)
    expect(isBic('rzbaatww')).toBe(false)
  })
})

describe('Hotel-ID', () => {
  it('erlaubt Buchstaben, Ziffern und Bindestrich bis 30 Zeichen', () => {
    expect(isHotelId('1234567')).toBe(true)
    expect(isHotelId('AB-12345x')).toBe(true)
    expect(isHotelId('a'.repeat(30))).toBe(true)
  })

  it('lehnt andere Zeichen, Leerzeichen und Überlänge ab', () => {
    expect(isHotelId('123/45')).toBe(false)
    expect(isHotelId('12 34')).toBe(false)
    expect(isHotelId('a'.repeat(31))).toBe(false)
    expect(isHotelId('')).toBe(false)
  })
})

describe('Anzeige', () => {
  it('nimmt Bezeichnung, sonst Bank, sonst IBAN', () => {
    expect(accountDisplayName({ label: 'Geschäftskonto', bankName: 'Raiffeisen', iban: 'AT611904300234573201' })).toBe('Geschäftskonto')
    expect(accountDisplayName({ label: null, bankName: 'Raiffeisen', iban: 'AT611904300234573201' })).toBe('Raiffeisen')
    expect(accountDisplayName({ label: ' ', bankName: null, iban: 'AT611904300234573201' })).toBe('AT61 1904 3002 3457 3201')
  })

  it('sortiert primär, aktive nach Anlage, archivierte unten', () => {
    const row = (id: string, position: number, primary = false, archived = false): BankAccountRow => ({
      id,
      label: null,
      account_holder: 'X',
      iban: 'AT611904300234573201',
      bic: null,
      bank_name: null,
      note: null,
      is_primary: primary,
      archived_at: archived ? '2026-11-06T10:00:00Z' : null,
      position,
      apartments: [],
    })
    const ids = bankAccountsFromRows([row('a', 0, false, true), row('b', 1), row('c', 2, true), row('d', 3)]).map((a) => a.id)
    expect(ids).toEqual(['c', 'b', 'd', 'a'])
  })

  it('nennt die Wohnungen als „Objekt · Wohnung“', () => {
    const [account] = bankAccountsFromRows([
      {
        id: 'a',
        label: null,
        account_holder: 'X',
        iban: 'AT611904300234573201',
        bic: null,
        bank_name: null,
        note: null,
        is_primary: true,
        archived_at: null,
        position: 0,
        apartments: [
          { name: 'Top 2', property: { name: 'Haus Seeblick' } },
          { name: 'Top 1', property: { name: 'Haus Seeblick' } },
        ],
      },
    ])
    expect(account.usedBy).toEqual(['Haus Seeblick · Top 1', 'Haus Seeblick · Top 2'])
  })
})
