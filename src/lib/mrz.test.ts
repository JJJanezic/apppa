import { describe, expect, it } from 'vitest'

import { checkDigit, mrzDate, parseMrz } from '@/lib/mrz'

const today = new Date(Date.UTC(2026, 10, 10))

describe('checkDigit', () => {
  it('rechnet nach ICAO 9303', () => {
    // Beispiele aus ICAO 9303 Teil 3
    expect(checkDigit('L898902C3')).toBe(6)
    expect(checkDigit('740812')).toBe(2)
    expect(checkDigit('120415')).toBe(9)
  })
})

describe('mrzDate', () => {
  it('wählt das Jahrhundert nach dem laufenden Jahr', () => {
    expect(mrzDate('830812', today)).toBe('1983-08-12')
    expect(mrzDate('210802', today)).toBe('2021-08-02')
  })
  it('lehnt ungültige Daten ab', () => {
    expect(mrzDate('830231', today)).toBeNull()
    expect(mrzDate('83AB12', today)).toBeNull()
  })
})

describe('parseMrz', () => {
  it('liest den ICAO-Musterpass (TD3)', () => {
    const mrz = parseMrz(['P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<', 'L898902C36UTO7408122F1204159ZE184226B<<<<<10'], today)
    expect(mrz).toEqual({
      format: 'TD3',
      documentNumber: 'L898902C3',
      documentNumberValid: true,
      birthDate: '1974-08-12',
      birthDateValid: true,
      sex: 'female',
    })
  })

  it('liest den ICAO-Musterausweis (TD1)', () => {
    const mrz = parseMrz(['I<UTOD231458907<<<<<<<<<<<<<<<', '7408122F1204159UTO<<<<<<<<<<<6', 'ERIKSSON<<ANNA<MARIA<<<<<<<<<<'], today)
    expect(mrz).toMatchObject({ format: 'TD1', documentNumber: 'D23145890', documentNumberValid: true, birthDateValid: true })
  })

  it('erkennt eine falsche Prüfziffer', () => {
    const mrz = parseMrz(['P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<', 'L898902C37UTO7408121F1204159ZE184226B<<<<<10'], today)
    expect(mrz?.documentNumberValid).toBe(false)
    expect(mrz?.birthDateValid).toBe(false)
  })

  it('verträgt Leerzeichen und Kleinbuchstaben', () => {
    const mrz = parseMrz(['p<uto eriksson<<anna<maria<<<<<<<<<<<<<<<<<<<', 'L898902C36UTO7408122F1204159ZE184226B<<<<< 10'], today)
    expect(mrz?.documentNumber).toBe('L898902C3')
  })

  it('liefert null bei unbekanntem Format', () => {
    expect(parseMrz(['ABC', 'DEF'], today)).toBeNull()
    expect(parseMrz([], today)).toBeNull()
  })
})
