import { describe, expect, it } from 'vitest'

import type { PaymentSchedule } from '@/lib/invoice-drafts'
import {
  canRecordPayment,
  canRecordRefund,
  checkReceiptPdf,
  computePaymentState,
  dueByToday,
  isOverdue,
  isPlatformSource,
  overpaidByCents,
  parsePaymentFilters,
  paymentListHref,
  paymentRange,
  receiptTypeOf,
  refundLabel,
  settledOf,
  signedCents,
  statusOf,
  suggestedAmountCents,
} from '@/lib/payments'

const TODAY = '2026-11-06'
const pay = (amountCents: number, commissionCents = 0, feeCents = 0) => ({ amountCents, commissionCents, feeCents })
const schedule = (s: Partial<PaymentSchedule> = {}): PaymentSchedule => ({
  due: '2026-11-15',
  depositCents: null,
  depositDue: null,
  remainderCents: null,
  dueClamped: false,
  depositClamped: false,
  ...s,
})

describe('statusOf', () => {
  it('unterscheidet offen, teilweise, bezahlt und überzahlt', () => {
    expect(statusOf(45000, 0)).toBe('open')
    expect(statusOf(45000, 10000)).toBe('partial')
    expect(statusOf(45000, 45000)).toBe('paid')
    expect(statusOf(45000, 50000)).toBe('overpaid')
  })
})

describe('Fälligkeit', () => {
  it('ist am Fälligkeitstag noch nicht überfällig, danach schon', () => {
    expect(dueByToday(schedule(), 45000, '2026-11-15')).toBe(0)
    expect(dueByToday(schedule(), 45000, '2026-11-16')).toBe(45000)
    expect(isOverdue(schedule(), 45000, 0, '2026-11-16')).toBe(true)
    expect(isOverdue(schedule(), 45000, 45000, '2026-11-16')).toBe(false)
  })

  it('rechnet mit Anzahlung erst die Anzahlung, dann den ganzen Betrag', () => {
    const s = schedule({ depositCents: 9000, depositDue: '2026-11-04', remainderCents: 36000, due: '2026-12-01' })
    expect(dueByToday(s, 45000, TODAY)).toBe(9000)
    expect(isOverdue(s, 45000, 5000, TODAY)).toBe(true)
    expect(isOverdue(s, 45000, 9000, TODAY)).toBe(false)
    expect(dueByToday(s, 45000, '2026-12-02')).toBe(45000)
  })

  it('ohne Zahlungsplan (nacherfasst) nie überfällig', () => {
    expect(isOverdue(null, 45000, 0, '2030-01-01')).toBe(false)
  })
})

describe('computePaymentState', () => {
  const issued = { origin: 'issued' as const, kind: 'invoice' as const, totalCents: 50000, cancelled: false, today: TODAY }

  it('zahlbare Rechnung mit Provisionsabzug ist bezahlt, der Rechnungsbetrag bleibt', () => {
    const s = computePaymentState({ ...issued, payments: [pay(42500, 7000, 500)] })
    expect(s).toMatchObject({ mode: 'payable', status: 'paid', totalCents: 50000, receivedCents: 42500, commissionCents: 7000, feeCents: 500, settledCents: 50000, openCents: 0 })
    expect(canRecordPayment(s)).toBe(true)
  })

  it('Überzahlung ergibt negativen Offen-Betrag', () => {
    const s = computePaymentState({ ...issued, payments: [pay(40000), pay(15000)] })
    expect(s.status).toBe('overpaid')
    expect(s.openCents).toBe(-5000)
  })

  it('überfällig nur bei ausgestellten Rechnungen', () => {
    expect(computePaymentState({ ...issued, payments: [], schedule: schedule({ due: '2026-11-01' }) }).overdue).toBe(true)
    expect(computePaymentState({ ...issued, origin: 'backfilled', payments: [], schedule: schedule({ due: '2026-11-01' }) }).overdue).toBe(false)
  })

  it('Entwurf und nacherfasste Rechnung mit Betrag ≤ 0 haben keinen Status', () => {
    expect(computePaymentState({ ...issued, origin: 'draft', payments: [] }).mode).toBe('none')
    const backfilled = computePaymentState({ ...issued, origin: 'backfilled', kind: null, totalCents: -5000, payments: [] })
    expect(backfilled.mode).toBe('none')
    expect(canRecordPayment(backfilled)).toBe(false)
  })

  it('stornierte Rechnung: Guthaben nur aus eingegangenem Geld, ohne Provision', () => {
    const s = computePaymentState({ ...issued, cancelled: true, payments: [pay(42500, 7500)], linkedCents: 0 })
    expect(s).toMatchObject({ mode: 'cancelled', balanceCents: 42500 })
    expect(canRecordPayment(s)).toBe(false)
  })

  it('Gutschrift: Rückzahlung offen, dann erstattet', () => {
    const credit = { origin: 'issued' as const, kind: 'credit_note' as const, totalCents: -50000, cancelled: false, today: TODAY }
    const open = computePaymentState({ ...credit, payments: [], linkedCents: 42500 })
    expect(open.balanceCents).toBe(42500)
    expect(refundLabel(open)).toBe('refundOpen')
    expect(canRecordRefund(open)).toBe(true)
    const done = computePaymentState({ ...credit, payments: [pay(42500)], linkedCents: 42500 })
    expect(refundLabel(done)).toBe('refunded')
    expect(canRecordRefund(done)).toBe(false)
    expect(refundLabel(computePaymentState({ ...credit, payments: [], linkedCents: 0 }))).toBeNull()
  })
})

describe('Vorschläge und Hinweise', () => {
  it('Vorschlag sinkt mit Provision und Gebühr, leer ohne Offen-Betrag', () => {
    expect(suggestedAmountCents(50000)).toBe(50000)
    expect(suggestedAmountCents(50000, 7000, 500)).toBe(42500)
    expect(suggestedAmountCents(0)).toBeNull()
    expect(suggestedAmountCents(-5000)).toBeNull()
  })

  it('Überzahlung um den Betrag über dem Offen-Betrag', () => {
    expect(overpaidByCents(5000, 10000)).toBe(5000)
    expect(overpaidByCents(5000, 5000)).toBe(0)
    expect(overpaidByCents(-2000, 1000)).toBe(1000)
  })

  it('beglichen = Betrag + Provision + Gebühr', () => {
    expect(settledOf(pay(42500, 7000, 500))).toBe(50000)
    expect(signedCents('refund', 1000)).toBe(-1000)
    expect(signedCents('payment', 1000)).toBe(1000)
  })

  it('Plattform-Buchungen: booking.com und Airbnb', () => {
    expect(isPlatformSource('booking_com')).toBe(true)
    expect(isPlatformSource('airbnb')).toBe(true)
    expect(isPlatformSource('website')).toBe(false)
    expect(isPlatformSource(null)).toBe(false)
  })
})

describe('Zahlungsliste: Filter in der Adresse', () => {
  it('Standard ist der aktuelle Monat, „alle“ alle Monate', () => {
    expect(parsePaymentFilters({}, TODAY)).toEqual({ month: '2026-11', methodId: null, query: '', page: 1 })
    expect(parsePaymentFilters({ monat: 'alle' }, TODAY).month).toBeNull()
    expect(parsePaymentFilters({ monat: '2026-13' }, TODAY).month).toBe('2026-11')
    expect(parsePaymentFilters({ art: 'kein-id', seite: '0' }, TODAY)).toMatchObject({ methodId: null, page: 1 })
  })

  it('schreibt nur abweichende Werte', () => {
    expect(paymentListHref({ month: '2026-11' }, TODAY)).toBe('/zahlungen')
    expect(paymentListHref({ month: null, query: 'Huber', page: 2 }, TODAY)).toBe('/zahlungen?monat=alle&q=Huber&seite=2')
    expect(paymentListHref({ month: '2026-10', methodId: '11111111-1111-1111-1111-111111111111' }, TODAY)).toBe(
      '/zahlungen?monat=2026-10&art=11111111-1111-1111-1111-111111111111'
    )
  })

  it('Zeitraum je Monat, ohne Monat keiner', () => {
    expect(paymentRange({ month: '2026-12' })).toEqual({ from: '2026-12-01', to: '2027-01-01' })
    expect(paymentRange({ month: null })).toBeNull()
  })
})

describe('Belege', () => {
  it('PDF bis 10 MB, andere Dateien abgelehnt', () => {
    expect(checkReceiptPdf({ name: 'a.pdf', type: 'application/pdf', size: 1000 })).toBeNull()
    expect(checkReceiptPdf({ name: 'a.pdf', type: '', size: 11 * 1024 * 1024 })).toBe('receiptTooLarge')
    expect(checkReceiptPdf({ name: 'a.docx', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: 10 })).toBe('receiptUnsupported')
    expect(receiptTypeOf('t/x.pdf')).toBe('pdf')
    expect(receiptTypeOf('t/x.jpg')).toBe('image')
  })
})
