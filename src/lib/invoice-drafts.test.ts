import { describe, expect, it } from 'vitest'

import { formatCents } from '@/lib/format'

import {
  amountFromPercent,
  type BookingInvoiceSummary,
  bookingDraftLines,
  bookingFingerprint,
  deductionCandidates,
  draftPlaceholderValues,
  draftSalutation,
  draftTotals,
  type DraftBooking,
  type DraftGuest,
  type DraftLine,
  EMPTY_RECIPIENT,
  guestNames,
  invoiceButtonState,
  invoiceSums,
  isLineSource,
  lineSourceFromDb,
  lineSourceToDb,
  partialLabel,
  paymentSchedule,
  percentFromAmount,
  preselectLines,
  recipientFromGuest,
  requiredChecks,
  splitByVat,
} from '@/lib/invoice-drafts'

const CHARGE = '11111111-2222-3333-4444-555555555555'

const guest: DraftGuest = {
  id: 'g',
  lastName: 'Huber',
  firstName: 'Maria',
  titlePrefix: 'Dr.',
  titleSuffix: null,
  gender: 'female',
  anonymized: false,
  street: 'Hauptstraße 1',
  postalCode: '1010',
  city: 'Wien',
  addressCountry: 'AT',
  companyName: 'Huber GmbH',
  companyVatId: 'ATU12345678',
  companyAddressLine1: 'Ring 2',
  companyAddressLine2: null,
  companyPostalCode: '8010',
  companyCity: 'Graz',
  companyCountry: 'AT',
}

const lines: DraftLine[] = [
  { source: 'nights', label: 'Übernachtung', amountCents: 90_000, vatBp: 1000 },
  { source: `charge:${CHARGE}`, label: 'Reinigung', amountCents: 10_000, vatBp: 2000 },
]

const booking: DraftBooking = {
  id: 'b',
  kind: 'booking',
  number: '2026-0001',
  arrival: '2026-10-14',
  departure: '2026-10-17',
  cancelledAt: null,
  apartmentLabel: 'Haus A · Top 1',
  guest,
  companions: [{ firstName: 'Paul', lastName: 'Huber' }],
  lines,
}

const invoice = (o: Partial<BookingInvoiceSummary>): BookingInvoiceSummary => ({
  id: 'x',
  number: null,
  origin: 'draft',
  kind: 'invoice',
  invoiceDate: '2026-10-01',
  totalCents: 0,
  lines: [],
  ...o,
})

describe('Herkunft der Positionen', () => {
  it('wandelt in Spalten und zurück', () => {
    expect(lineSourceToDb(`charge:${CHARGE}`)).toEqual({ source_kind: 'charge', source_charge_id: CHARGE })
    expect(lineSourceToDb('nights')).toEqual({ source_kind: 'nights', source_charge_id: null })
    expect(lineSourceToDb(null)).toEqual({ source_kind: null, source_charge_id: null })
    expect(lineSourceFromDb('charge', CHARGE)).toBe(`charge:${CHARGE}`)
    expect(lineSourceFromDb('cancellation_fee', null)).toBe('cancellation_fee')
    expect(lineSourceFromDb(null, null)).toBeNull()
  })

  it('erkennt gültige Kennungen', () => {
    expect(isLineSource('nights')).toBe(true)
    expect(isLineSource(`charge:${CHARGE}`)).toBe(true)
    expect(isLineSource('charge:abc')).toBe(false)
    expect(isLineSource('')).toBe(false)
  })
})

describe('bookingDraftLines', () => {
  const amounts = {
    cancelled: false,
    billedNightsCents: 90_000,
    nightsVatBp: 1000,
    charges: [{ id: CHARGE, label: 'Reinigung', amountCents: 10_000, vatBp: 2000 }],
    cancellationFeeCents: 12_000,
    cancellationFeeVatBp: 0,
  }
  const labels = { nights: 'Übernachtung', cancellationFee: 'Stornogebühr' }

  it('aktiv: Übernachtung und Zusatzkosten mit Herkunft', () => {
    expect(bookingDraftLines(amounts, labels)).toEqual(lines)
  })

  it('storniert: nur die Stornogebühr bzw. nichts', () => {
    expect(bookingDraftLines({ ...amounts, cancelled: true }, labels)).toEqual([
      { source: 'cancellation_fee', label: 'Stornogebühr', amountCents: 12_000, vatBp: 0 },
    ])
    expect(bookingDraftLines({ ...amounts, cancelled: true, cancellationFeeCents: null }, labels)).toEqual([])
  })
})

describe('Summen und Knopf „Rechnung“', () => {
  it('trennt Verrechnet und In Entwürfen, ohne den eigenen Entwurf', () => {
    const list = [invoice({ id: 'a', origin: 'backfilled', totalCents: 20_000 }), invoice({ id: 'b', totalCents: 10_000 }), invoice({ id: 'c', totalCents: 5_000 })]
    expect(invoiceSums(list)).toEqual({ billedCents: 20_000, draftCents: 15_000 })
    expect(invoiceSums(list, 'c')).toEqual({ billedCents: 20_000, draftCents: 10_000 })
  })

  const state = (o: Partial<Parameters<typeof invoiceButtonState>[0]>) =>
    invoiceButtonState({ cancelled: false, hasFee: false, billableCents: 50_000, billedCents: 0, draftCents: 0, ...o })

  it('aktiv, solange Verrechnet + Entwürfe unter dem Gesamtpreis liegen', () => {
    expect(state({}).enabled).toBe(true)
    expect(state({ billedCents: 20_000, draftCents: 10_000 }).enabled).toBe(true)
  })

  it('inaktiv mit Begründung', () => {
    expect(state({ draftCents: 50_000 })).toEqual({ enabled: false, reason: 'fullyBilled' })
    expect(state({ billedCents: 60_000 })).toEqual({ enabled: false, reason: 'overBilled' })
    expect(state({ billableCents: 0 })).toEqual({ enabled: false, reason: 'nothingToBill' })
    expect(state({ billableCents: -500 })).toEqual({ enabled: false, reason: 'nothingToBill' })
    expect(state({ cancelled: true, billableCents: 0 })).toEqual({ enabled: false, reason: 'cancelledNoFee' })
  })

  it('stornierte Buchung mit Stornogebühr', () => {
    expect(state({ cancelled: true, hasFee: true, billableCents: 12_000 }).enabled).toBe(true)
    expect(state({ cancelled: true, hasFee: true, billableCents: 12_000, draftCents: 12_000 }).enabled).toBe(false)
  })
})

describe('preselectLines', () => {
  it('ohne andere Rechnungen sind alle angewählt', () => {
    expect(preselectLines(lines, []).map((l) => l.selected)).toEqual([true, true])
  })

  it('Positionen aus einem anderen Entwurf sind abgewählt mit Hinweis', () => {
    const others = [invoice({ id: 'd', invoiceDate: '2026-10-05', lines: [{ source: 'nights', amountCents: 90_000, vatBp: 1000 }] })]
    const result = preselectLines(lines, others)
    expect(result[0]).toMatchObject({ selected: false, usedBy: { draft: true, number: null, date: '2026-10-05' } })
    expect(result[1]).toMatchObject({ selected: true, usedBy: null })
  })

  it('ausgestellte Rechnung geht im Hinweis vor', () => {
    const others = [
      invoice({ id: 'd', invoiceDate: '2026-10-01', lines: [{ source: 'nights', amountCents: 1, vatBp: 0 }] }),
      invoice({ id: 'i', origin: 'issued', number: '2026-0012', invoiceDate: '2026-10-03', lines: [{ source: 'nights', amountCents: 1, vatBp: 0 }] }),
    ]
    expect(preselectLines(lines, others)[0].usedBy).toEqual({ draft: false, number: '2026-0012', date: '2026-10-03' })
  })

  it('Teilrechnungen, nacherfasste Rechnungen und der eigene Entwurf zählen nicht', () => {
    const used = [{ source: 'nights' as const, amountCents: 1, vatBp: 0 }]
    const others = [
      invoice({ id: 'p', kind: 'partial', lines: used }),
      invoice({ id: 'n', origin: 'backfilled', kind: null, lines: used }),
      invoice({ id: 'self', lines: used }),
    ]
    expect(preselectLines(lines, others, 'self').every((l) => l.selected)).toBe(true)
  })
})

describe('Teilrechnung', () => {
  it('Prozent ↔ Betrag', () => {
    expect(amountFromPercent(2000, 100_000)).toBe(20_000)
    expect(amountFromPercent(1250, 33_333)).toBe(4167)
    expect(percentFromAmount(25_000, 100_000)).toBe(2500)
    expect(percentFromAmount(100, 0)).toBeNull()
  })

  it('teilt anteilig nach USt-Sätzen (Beispiel aus der Spec)', () => {
    expect(splitByVat(20_000, lines)).toEqual([
      { vatBp: 1000, amountCents: 18_000 },
      { vatBp: 2000, amountCents: 2_000 },
    ])
  })

  it('Rundungsrest beim größten Anteil, Summe stimmt genau', () => {
    const three = [
      { vatBp: 1000, amountCents: 10_000 },
      { vatBp: 2000, amountCents: 10_000 },
      { vatBp: 0, amountCents: 10_001 },
    ]
    const result = splitByVat(10_000, three)
    expect(result.reduce((s, l) => s + l.amountCents, 0)).toBe(10_000)
    expect(result.find((l) => l.vatBp === 0)?.amountCents).toBe(3_334)
  })

  it('ein Satz → eine Zeile; ohne Positionen Satz der Übernachtung', () => {
    expect(splitByVat(5_000, [{ vatBp: 1000, amountCents: 30_000 }])).toEqual([{ vatBp: 1000, amountCents: 5_000 }])
    expect(splitByVat(5_000, [])).toEqual([{ vatBp: 1000, amountCents: 5_000 }])
  })

  it('Zeile der Teilrechnung ohne Wochentag', () => {
    expect(partialLabel(booking)).toBe('Anzahlung für Aufenthalt in Haus A · Top 1 vom 14.10.2026 bis 17.10.2026')
  })
})

describe('Schlussrechnung', () => {
  it('Abzüge: Teilrechnungen vorausgewählt, nacherfasste abgewählt, Art Rechnung nicht', () => {
    const others = [
      invoice({ id: 'p', kind: 'partial', invoiceDate: '2026-10-02' }),
      invoice({ id: 'n', origin: 'backfilled', kind: null, invoiceDate: '2026-09-01' }),
      invoice({ id: 'r', kind: 'invoice' }),
    ]
    expect(deductionCandidates(others).map((c) => [c.id, c.preselected])).toEqual([
      ['n', false],
      ['p', true],
    ])
  })

  it('Rechnungsbetrag und USt je Satz nach Abzug (€ 1.000 minus Teilrechnung € 200)', () => {
    const partial = { totalCents: 20_000, lines: splitByVat(20_000, lines) }
    const totals = draftTotals({ kind: 'final', lines, deductions: [partial], smallBusiness: false })
    expect(totals.totalCents).toBe(80_000)
    expect(totals.deductionsCents).toBe(20_000)
    // 10 %: USt aus 900 (81,82) minus USt aus 180 (16,36); 20 %: aus 100 (16,67) minus aus 20 (3,33)
    expect(totals.vatShares).toEqual([
      { vatBp: 1000, grossCents: 72_000, vatCents: 8_182 - 1_636 },
      { vatBp: 2000, grossCents: 8_000, vatCents: 1_667 - 333 },
    ])
  })

  it('Abzüge höher als die Leistung → Betrag negativ', () => {
    const totals = draftTotals({ kind: 'final', lines: [lines[1]], deductions: [{ totalCents: 30_000, lines: [{ vatBp: 1000, amountCents: 30_000 }] }], smallBusiness: false })
    expect(totals.totalCents).toBe(-20_000)
  })

  it('Abzüge gelten nur bei der Schlussrechnung; Kleinunternehmer ohne USt', () => {
    const d = [{ totalCents: 20_000, lines: [{ vatBp: 1000, amountCents: 20_000 }] }]
    expect(draftTotals({ kind: 'invoice', lines, deductions: d, smallBusiness: false }).totalCents).toBe(100_000)
    expect(draftTotals({ kind: 'final', lines, deductions: d, smallBusiness: true }).vatShares).toEqual([])
  })
})

describe('paymentSchedule', () => {
  const rules = { depositPercent: 20, depositDays: 3, dueDays: 1, dueBasis: 'before_arrival' as const }

  it('Beispiel aus der Spec: Anzahlung € 90 am 04.10., Rest € 360 am 13.10.', () => {
    expect(paymentSchedule(rules, 45_000, '2026-10-01', '2026-10-14')).toEqual({
      due: '2026-10-13',
      depositCents: 9_000,
      depositDue: '2026-10-04',
      remainderCents: 36_000,
      dueClamped: false,
      depositClamped: false,
    })
  })

  it('ohne Baustein: am Rechnungsdatum fällig', () => {
    expect(paymentSchedule({ depositPercent: null, depositDays: null, dueDays: 0, dueBasis: 'after_invoice' }, 100, '2026-10-01', '2026-10-14').due).toBe('2026-10-01')
  })

  it('Fälligkeit vor dem Rechnungsdatum → sofort fällig', () => {
    const s = paymentSchedule({ ...rules, depositPercent: null, depositDays: null }, 100, '2026-10-20', '2026-10-14')
    expect(s).toMatchObject({ due: '2026-10-20', dueClamped: true })
  })

  it('Anzahlung fällig nie nach dem Rest', () => {
    const s = paymentSchedule({ ...rules, depositDays: 10 }, 100, '2026-10-10', '2026-10-14')
    expect(s).toMatchObject({ due: '2026-10-13', depositDue: '2026-10-13', depositClamped: true })
  })
})

describe('Empfänger, Gastnamen, Anrede, Platzhalter', () => {
  it('Empfänger aus Gast bzw. Firma', () => {
    expect(recipientFromGuest(guest, 'guest')).toEqual({ name: 'Dr. Maria Huber', line1: 'Hauptstraße 1', line2: '', postalCode: '1010', city: 'Wien', country: 'AT', vatId: '' })
    expect(recipientFromGuest(guest, 'company')).toMatchObject({ name: 'Huber GmbH', line1: 'Ring 2', city: 'Graz', vatId: 'ATU12345678' })
    expect(recipientFromGuest({ ...guest, anonymized: true }, 'guest')).toEqual(EMPTY_RECIPIENT)
  })

  it('Gastnamen nach Auswahl; anonymisiert „Gelöschter Gast“', () => {
    expect(guestNames('none', booking)).toEqual([])
    expect(guestNames('main', booking)).toEqual(['Dr. Maria Huber'])
    expect(guestNames('all', booking)).toEqual(['Dr. Maria Huber', 'Paul Huber'])
    expect(guestNames('main', { ...booking, guest: { ...guest, anonymized: true } })).toEqual(['Gelöschter Gast'])
  })

  it('Anrede: Firma allgemein oder Hauptgast, Gast nach PROJ-39', () => {
    expect(draftSalutation(booking, 'company', 'generic')).toBe('Sehr geehrte Damen und Herren')
    expect(draftSalutation(booking, 'company', 'guest')).toBe('Sehr geehrte Frau Dr. Huber')
    expect(draftSalutation(booking, 'guest', 'generic')).toBe('Sehr geehrte Frau Dr. Huber')
  })

  it('Platzhalter: Rechnungsnummer „Entwurf“, Fristen nach Rückfallregel', () => {
    const v = draftPlaceholderValues({
      booking,
      recipientKind: 'guest',
      companySalutation: 'generic',
      invoiceDate: '2026-10-01',
      totalCents: 45_000,
      payment: { depositPercent: 20, depositDays: 3, dueDays: 1, dueBasis: 'before_arrival' },
    })
    expect(v.Rechnungsnummer).toBe('Entwurf')
    expect(v.Nächte).toBe('3')
    expect(v.Anzahlung).toBe(formatCents(9_000))
    expect(v['Anzahlung fällig']).toBe('04.10.2026')
    expect(v.Restbetrag).toBe(formatCents(36_000))
    expect(v['Fälligkeitsdatum']).toBe('13.10.2026')
  })
})

describe('requiredChecks', () => {
  const issuer = { name: 'Vermietung', nameLine2: null, addressLine1: 'Weg 1', addressLine2: null, postalCode: '5020', city: 'Salzburg', country: 'AT', vatId: 'ATU99999999' }
  const base = {
    issuer,
    smallBusiness: false,
    kind: 'invoice' as const,
    invoiceDate: '2026-10-31',
    booking,
    lineCount: 2,
    partialCents: 0,
    totalCents: 30_000,
    recipient: EMPTY_RECIPIENT,
  }
  const failing = (checks: ReturnType<typeof requiredChecks>) => checks.filter((c) => !c.ok).map((c) => c.key)

  it('unter € 400 keine Anschrift nötig', () => {
    expect(failing(requiredChecks(base))).toEqual([])
  })

  it('ab € 400 fehlt die PLZ mit Sprung zum Feld', () => {
    const checks = requiredChecks({ ...base, totalCents: 50_000, recipient: { ...recipientFromGuest(guest, 'guest'), postalCode: '' } })
    expect(checks.find((c) => !c.ok)).toEqual({ key: 'recipientPostalCode', ok: false, field: 'rechnung-empfaenger-plz' })
  })

  it('UID des Ausstellers ab € 400 nur ohne Kleinunternehmer-Status', () => {
    const noVat = { ...issuer, vatId: null }
    const recipient = recipientFromGuest(guest, 'guest')
    expect(failing(requiredChecks({ ...base, totalCents: 50_000, recipient, issuer: noVat }))).toEqual(['issuerVatId'])
    expect(failing(requiredChecks({ ...base, totalCents: 50_000, recipient, issuer: noVat, smallBusiness: true }))).toEqual([])
  })

  it('UID des Empfängers ab € 10.000', () => {
    const recipient = { ...recipientFromGuest(guest, 'company'), vatId: '' }
    expect(failing(requiredChecks({ ...base, totalCents: 1_200_000, recipient }))).toEqual(['recipientVatId'])
  })

  it('Grenzen genau: € 399,99 ohne, € 400,00 mit Anschrift; € 9.999,99 ohne, € 10.000,00 mit UID des Empfängers (QA)', () => {
    const noVatId = { ...recipientFromGuest(guest, 'guest'), vatId: '' }
    expect(failing(requiredChecks({ ...base, totalCents: 39_999 }))).toEqual([])
    expect(failing(requiredChecks({ ...base, totalCents: 40_000 }))).toContain('recipientName')
    expect(failing(requiredChecks({ ...base, totalCents: 999_999, recipient: noVatId }))).toEqual([])
    expect(failing(requiredChecks({ ...base, totalCents: 1_000_000, recipient: noVatId }))).toEqual(['recipientVatId'])
    // negativer Betrag (Schlussrechnung) wie ein kleiner Betrag
    expect(failing(requiredChecks({ ...base, kind: 'final', totalCents: -50_000 }))).toEqual([])
  })

  it('keine Position bzw. Teilbetrag 0', () => {
    expect(failing(requiredChecks({ ...base, lineCount: 0 }))).toEqual(['lines'])
    expect(failing(requiredChecks({ ...base, kind: 'partial', partialCents: 0 }))).toEqual(['partial'])
  })

  it('Aussteller ohne Anschrift verweist auf die Stammdaten', () => {
    expect(requiredChecks({ ...base, issuer: { ...issuer, city: null } })[0]).toEqual({ key: 'issuer', ok: false, settings: true })
  })
})

describe('bookingFingerprint', () => {
  it('gleich bei gleichen Daten, anders bei Preis- oder Stornoänderung', () => {
    const a = bookingFingerprint({ cancelled: false, lines })
    expect(bookingFingerprint({ cancelled: false, lines: lines.map((l) => ({ ...l })) })).toBe(a)
    expect(bookingFingerprint({ cancelled: false, lines: [{ ...lines[0], amountCents: 1 }, lines[1]] })).not.toBe(a)
    expect(bookingFingerprint({ cancelled: true, lines })).not.toBe(a)
    expect(a).toMatch(/^[0-9a-f]{8}$/)
  })
})
