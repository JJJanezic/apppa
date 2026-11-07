import { describe, expect, it } from 'vitest'

import {
  bookingGuestName,
  checkPdfFile,
  cleanInvoiceQuery,
  activeInvoiceFilterCount,
  EMPTY_INVOICE_FILTERS,
  INVOICE_LIMITS,
  invoiceListHref,
  invoiceNumberKey,
  invoiceSearchPattern,
  invoiceVatShares,
  isOldInvoiceDate,
  linesFromBooking,
  linesTotal,
  parseInvoiceFilters,
  parseInvoiceYear,
  invoiceYearOptions,
  recipientFor,
} from '@/lib/invoices'

const labels = { nights: 'Übernachtung', cancellationFee: 'Stornogebühr' }
const amounts = {
  cancelled: false,
  billedNightsCents: 45000,
  nightsVatBp: 1000,
  charges: [
    { label: 'Reinigung', amountCents: 6000, vatBp: 1000 },
    { label: 'Rabatt', amountCents: -5000, vatBp: 2000 },
  ],
  cancellationFeeCents: null,
  cancellationFeeVatBp: 0,
}

describe('invoiceNumberKey', () => {
  it('vergleicht ohne Rand-Leerzeichen und Groß-/Kleinschreibung', () => {
    expect(invoiceNumberKey(' 2025-0042 ')).toBe('2025-0042')
    expect(invoiceNumberKey('R-1')).toBe(invoiceNumberKey('r-1'))
    expect(invoiceNumberKey('2024/17')).toBe('2024/17')
  })
})

describe('recipientFor', () => {
  it('nimmt die Firma, sonst „Nachname Vorname“', () => {
    expect(recipientFor({ lastName: 'Huber', firstName: 'Maria', companyName: 'Huber GmbH' })).toBe('Huber GmbH')
    expect(recipientFor({ lastName: 'Huber', firstName: 'Maria', companyName: '  ' })).toBe('Huber Maria')
    expect(recipientFor({ lastName: 'Familie Berger', firstName: null, companyName: null })).toBe('Familie Berger')
  })

  it('schreibt Treffer der Buchungssuche als „Nachname Vorname“', () => {
    expect(bookingGuestName({ lastName: 'Huber', firstName: 'Maria' })).toBe('Huber Maria')
    expect(bookingGuestName(null)).toBeNull()
  })
})

describe('linesFromBooking', () => {
  it('übernimmt abgerechnete Übernachtung und Zusatzkosten in der Reihenfolge der Buchung', () => {
    expect(linesFromBooking(amounts, labels)).toEqual([
      { label: 'Übernachtung', amountCents: 45000, vatBp: 1000 },
      { label: 'Reinigung', amountCents: 6000, vatBp: 1000 },
      { label: 'Rabatt', amountCents: -5000, vatBp: 2000 },
    ])
  })

  it('nimmt bei stornierten Buchungen nur die Stornogebühr', () => {
    expect(linesFromBooking({ ...amounts, cancelled: true, cancellationFeeCents: 9000, cancellationFeeVatBp: 0 }, labels)).toEqual([
      { label: 'Stornogebühr', amountCents: 9000, vatBp: 0 },
    ])
    expect(linesFromBooking({ ...amounts, cancelled: true }, labels)).toEqual([])
  })
})

describe('Summen', () => {
  const lines = linesFromBooking(amounts, labels)

  it('rechnet den Gesamtbetrag, auch unter 0', () => {
    expect(linesTotal(lines)).toBe(46000)
    expect(linesTotal([{ amountCents: -5000 }])).toBe(-5000)
  })

  it('weist die USt je Satz aus, bei Kleinunternehmern keine', () => {
    expect(invoiceVatShares(lines, false)).toEqual([
      { vatBp: 1000, grossCents: 51000, vatCents: 4636 },
      { vatBp: 2000, grossCents: -5000, vatCents: -833 },
    ])
    expect(invoiceVatShares(lines, true)).toEqual([])
  })
})

describe('isOldInvoiceDate', () => {
  it('meldet Rechnungsdaten, die älter als 7 Jahre sind', () => {
    expect(isOldInvoiceDate('2019-10-29', '2026-10-30')).toBe(true)
    expect(isOldInvoiceDate('2019-10-30', '2026-10-30')).toBe(false)
    expect(isOldInvoiceDate('2025-01-01', '2026-10-30')).toBe(false)
    expect(isOldInvoiceDate('', '2026-10-30')).toBe(false)
  })

  it('rechnet vom 29. Februar aus mit dem 1. März', () => {
    expect(isOldInvoiceDate('2021-02-28', '2028-02-29')).toBe(true)
    expect(isOldInvoiceDate('2021-03-01', '2028-02-29')).toBe(false)
  })
})

describe('checkPdfFile', () => {
  it('nimmt nur PDF bis 10 MB', () => {
    expect(checkPdfFile({ name: 'r.pdf', type: 'application/pdf', size: 1000 })).toBeNull()
    expect(checkPdfFile({ name: 'R.PDF', type: '', size: 1000 })).toBeNull()
    expect(checkPdfFile({ name: 'r.pdf', type: 'application/pdf', size: INVOICE_LIMITS.pdfMaxBytes })).toBeNull()
    expect(checkPdfFile({ name: 'r.pdf', type: 'application/pdf', size: INVOICE_LIMITS.pdfMaxBytes + 1 })).toBe('pdfTooLarge')
    expect(checkPdfFile({ name: 'foto.jpg', type: 'image/jpeg', size: 1000 })).toBe('pdfNotPdf')
    expect(checkPdfFile({ name: 'r.docx', type: '', size: 1000 })).toBe('pdfNotPdf')
  })
})

describe('Adresse der Liste', () => {
  it('liest Suchbegriff und Seite und schreibt sie zurück', () => {
    expect(parseInvoiceFilters({ q: ' 2025 ', seite: '3' })).toEqual({ ...EMPTY_INVOICE_FILTERS, query: '2025', page: 3 })
    expect(parseInvoiceFilters({ seite: 'x' })).toEqual(EMPTY_INVOICE_FILTERS)
    expect(invoiceListHref({ query: '2025/1', page: 2 })).toBe('/rechnungen?q=2025%2F1&seite=2')
    expect(invoiceListHref({ query: '', page: 1 })).toBe('/rechnungen')
  })

  it('liest und schreibt Jahr, Status, Zahlung und Betrag (PROJ-43)', () => {
    const filters = parseInvoiceFilters({ jahr: '2026', status: 'cancelled', zahlung: 'unpaid', von: '-450', bis: '1200.5', seite: '2' })
    expect(filters).toEqual({ query: '', page: 2, year: 2026, status: 'cancelled', payment: 'unpaid', minCents: -45000, maxCents: 120050 })
    expect(invoiceListHref(filters)).toBe('/rechnungen?jahr=2026&status=cancelled&zahlung=unpaid&von=-450&bis=1200.50&seite=2')
    expect(invoiceListHref({ ...EMPTY_INVOICE_FILTERS, minCents: 0 })).toBe('/rechnungen?von=0')
  })

  it('ignoriert ungültige Werte in der Adresse', () => {
    expect(parseInvoiceFilters({ jahr: 'abc', status: 'x', zahlung: 'xyz', von: '1,5', bis: '1.234' })).toEqual(EMPTY_INVOICE_FILTERS)
    expect(parseInvoiceFilters({ jahr: '1989' }).year).toBeNull()
    expect(parseInvoiceFilters({ jahr: '2100' }).year).toBeNull()
    // „von“ größer als „bis“: beide Grenzen fallen weg
    expect(parseInvoiceFilters({ von: '500', bis: '100' })).toMatchObject({ minCents: null, maxCents: null })
    expect(parseInvoiceFilters({ von: '100', bis: '100' })).toMatchObject({ minCents: 10000, maxCents: 10000 })
  })

  it('bietet Jahre von 7 zurück bis 5 voraus und prüft freie Eingaben', () => {
    const years = invoiceYearOptions('2026-11-07')
    expect(years[0]).toBe(2031)
    expect(years.at(-1)).toBe(2019)
    expect(years).toHaveLength(13)
    expect(parseInvoiceYear(' 2012 ')).toBe(2012)
    expect(parseInvoiceYear('20x6')).toBeNull()
    expect(parseInvoiceYear('12')).toBeNull()
    expect(parseInvoiceYear('1989')).toBeNull()
  })

  it('zählt gesetzte Filter (Betrag von/bis als einer)', () => {
    expect(activeInvoiceFilterCount(EMPTY_INVOICE_FILTERS)).toBe(0)
    expect(activeInvoiceFilterCount({ ...EMPTY_INVOICE_FILTERS, year: 2026, minCents: 0, maxCents: 100 })).toBe(2)
  })

  it('entfernt Steuerzeichen der Datenbank-Abfrage aus dem Suchbegriff', () => {
    expect(cleanInvoiceQuery('2025/0042')).toBe('2025/0042')
    expect(cleanInvoiceQuery('a,b(c)"%_*')).toBe('a b c')
  })

  it('Suchmuster der Liste: „%“ und „_“ als Zeichen, Anführungszeichen/Backslash/„*“ entfernt (BUG-4)', () => {
    expect(invoiceSearchPattern('2025/0042')).toBe('%2025/0042%')
    expect(invoiceSearchPattern('2025_01')).toBe('%2025\\\\_01%')
    expect(invoiceSearchPattern('10%')).toBe('%10\\\\%%')
    expect(invoiceSearchPattern('Huber, Maria (GmbH)')).toBe('%Huber, Maria (GmbH)%')
    expect(invoiceSearchPattern(' a"b\\c*d ')).toBe('%a b c d%')
    expect(invoiceSearchPattern('  "*  ')).toBeNull()
  })
})
