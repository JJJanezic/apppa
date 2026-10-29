import { describe, expect, it } from 'vitest'

import {
  formatVatRate,
  parseVatRate,
  vatBpForLabel,
  vatBreakdown,
  vatRateFromDb,
  vatRateInput,
  vatRateToDb,
} from '@/lib/vat'

describe('parseVatRate', () => {
  it('liest ganze Zahlen, Komma, Punkt und Prozentzeichen', () => {
    expect(parseVatRate('13')).toBe(1300)
    expect(parseVatRate('5,5')).toBe(550)
    expect(parseVatRate('10.5')).toBe(1050)
    expect(parseVatRate('10 %')).toBe(1000)
    expect(parseVatRate(' 20% ')).toBe(2000)
    expect(parseVatRate('0')).toBe(0)
    expect(parseVatRate('100')).toBe(10000)
    expect(parseVatRate('100,00')).toBe(10000)
  })

  it('leer → null; Text, Minus, über 100, drei Nachkommastellen → ungültig', () => {
    expect(parseVatRate('')).toBeNull()
    expect(parseVatRate('  ')).toBeNull()
    for (const bad of ['abc', '-1', '100,01', '101', '10,555', '1.000', '10,']) expect(parseVatRate(bad)).toBeNaN()
  })
})

describe('Anzeige', () => {
  it('Eingabefeld mit zwei Nachkommastellen, Anzeige ohne überflüssige Nullen', () => {
    expect(vatRateInput(1300)).toBe('13,00')
    expect(vatRateInput(550)).toBe('5,50')
    expect(vatRateInput(10000)).toBe('100,00')
    expect(formatVatRate(1000)).toBe('10 %')
    expect(formatVatRate(550)).toBe('5,5 %')
    expect(formatVatRate(1025)).toBe('10,25 %')
    expect(formatVatRate(0)).toBe('0 %')
  })

  it('Datenbank: exakte Dezimalzahl hin und zurück', () => {
    expect(vatRateToDb(550)).toBe('5.50')
    expect(vatRateToDb(0)).toBe('0.00')
    expect(vatRateToDb(10000)).toBe('100.00')
    expect(vatRateFromDb(5.5)).toBe(550)
    expect(vatRateFromDb('10.00')).toBe(1000)
    expect(vatRateFromDb(0.07)).toBe(7)
  })
})

describe('vatBreakdown', () => {
  it('Beispiel der Spec: 10 % → € 32,73, 20 % → € 5,00, keine Zeile für 0 %', () => {
    expect(
      vatBreakdown([
        { amountCents: 30000, vatBp: 1000 },
        { amountCents: 6000, vatBp: 1000 },
        { amountCents: 3000, vatBp: 2000 },
        { amountCents: 1200, vatBp: 0 },
      ])
    ).toEqual([
      { vatBp: 1000, grossCents: 36000, vatCents: 3273 },
      { vatBp: 2000, grossCents: 3000, vatCents: 500 },
    ])
  })

  it('summiert je Satz zuerst und rundet danach', () => {
    const lines = [333, 333, 333].map((amountCents) => ({ amountCents, vatBp: 2000 }))
    // 9,99 × 20/120 = 1,665 → 1,67 (einzeln wären es 3 × 0,56 = 1,68)
    expect(vatBreakdown(lines)).toEqual([{ vatBp: 2000, grossCents: 999, vatCents: 167 }])
  })

  it('negative Position mindert die Summe; negative Summe ergibt negative Steuer', () => {
    expect(vatBreakdown([{ amountCents: 30000, vatBp: 1000 }, { amountCents: -5000, vatBp: 1000 }])).toEqual([
      { vatBp: 1000, grossCents: 25000, vatCents: 2273 },
    ])
    expect(vatBreakdown([{ amountCents: -5000, vatBp: 1000 }])).toEqual([{ vatBp: 1000, grossCents: -5000, vatCents: -455 }])
  })

  it('kaufmännische Rundung auch negativ symmetrisch', () => {
    // 1,10 € bei 10 % → 0,10 genau; 0,55 € bei 10 % → 0,05; -0,55 → -0,05
    expect(vatBreakdown([{ amountCents: 110, vatBp: 1000 }])[0].vatCents).toBe(10)
    expect(vatBreakdown([{ amountCents: 55, vatBp: 1000 }])[0].vatCents).toBe(5)
    expect(vatBreakdown([{ amountCents: -55, vatBp: 1000 }])[0].vatCents).toBe(-5)
    // 2,31 € bei 10 % = 0,21 genau
    expect(vatBreakdown([{ amountCents: 231, vatBp: 1000 }])[0].vatCents).toBe(21)
  })

  it('nur 0 % oder keine Positionen → leer; Sätze aufsteigend, auch krumme', () => {
    expect(vatBreakdown([{ amountCents: 1000, vatBp: 0 }])).toEqual([])
    expect(vatBreakdown([])).toEqual([])
    expect(
      vatBreakdown([
        { amountCents: 1000, vatBp: 2000 },
        { amountCents: 1000, vatBp: 550 },
        { amountCents: 1000, vatBp: 1300 },
      ]).map((s) => s.vatBp)
    ).toEqual([550, 1300, 2000])
  })
})

describe('vatBpForLabel', () => {
  const labels = { cleaning: 'Reinigung', touristTax: 'Nächtigungsabgabe' }
  it('Reinigung 10 %, Nächtigungsabgabe 0 %, sonst 20 % – ohne Groß-/Kleinschreibung und Rand-Leerzeichen', () => {
    expect(vatBpForLabel(' reinigung ', labels)).toBe(1000)
    expect(vatBpForLabel('REINIGUNG', labels)).toBe(1000)
    expect(vatBpForLabel('NÄCHTIGUNGSABGABE', labels)).toBe(0)
    expect(vatBpForLabel('Reinigung Extra', labels)).toBe(2000)
    expect(vatBpForLabel('Parkplatz', labels)).toBe(2000)
  })
})
