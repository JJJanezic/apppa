import { describe, expect, it } from 'vitest'

import { RECEIPT_UPLOADING } from '@/lib/payments'
import { alreadyPaidSchema, paymentMethodNameSchema, paymentSchema } from '@/lib/validation/payments'

const t = (k: string) => k
const TODAY = '2026-11-06'
const ID = '11111111-1111-1111-1111-111111111111'
const valid = { invoiceId: ID, paidOn: '2026-11-05', amount: '425,00', commission: '70', fee: '', methodId: ID, note: ' Auszahlung ', receiptPath: '' }

const messages = (input: Record<string, unknown>) => {
  const r = paymentSchema(t, { today: TODAY }).safeParse({ ...valid, ...input })
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}:${i.message}`)
}

describe('paymentSchema', () => {
  it('liest Beträge in Cent, leere Abzüge als 0, Notiz getrimmt, ohne Beleg null', () => {
    expect(paymentSchema(t, { today: TODAY }).parse(valid)).toEqual({
      invoiceId: ID,
      paidOn: '2026-11-05',
      amount: 42500,
      commission: 7000,
      fee: 0,
      methodId: ID,
      note: 'Auszahlung',
      receiptPath: null,
    })
  })

  it('Pflichtfelder: Rechnung, Datum, Betrag, Zahlungsart', () => {
    expect(messages({ invoiceId: '', paidOn: '', amount: '', methodId: '' })).toEqual([
      'invoiceId:invoiceRequired',
      'paidOn:dateRequired',
      'amount:amountRequired',
      'methodId:methodRequired',
    ])
  })

  it('Datum nicht in der Zukunft, heute erlaubt', () => {
    expect(messages({ paidOn: '2026-11-07' })).toEqual(['paidOn:dateInFuture'])
    expect(messages({ paidOn: TODAY })).toEqual([])
    expect(messages({ paidOn: '2026-02-30' })).toEqual(['paidOn:dateInvalid'])
  })

  it('Betrag größer als 0; Abzüge nicht negativ; ungültige Eingaben', () => {
    expect(messages({ amount: '0' })).toEqual(['amount:amountPositive'])
    expect(messages({ amount: 'abc' })).toEqual(['amount:amountInvalid'])
    // Das Formular zeigt die erste Meldung je Feld
    expect(messages({ commission: '-5' })[0]).toBe('commission:notNegative')
    expect(messages({ fee: '1,234' })).toEqual(['fee:amountInvalid'])
    expect(messages({ amount: '99.999.999,99' })).toEqual(['amount:amountInvalid'])
  })

  it('Notiz höchstens 300 Zeichen; Beleg noch im Hochladen', () => {
    expect(messages({ note: 'x'.repeat(301) })).toEqual(['note:noteTooLong'])
    expect(messages({ note: 'x'.repeat(300) })).toEqual([])
    expect(messages({ receiptPath: RECEIPT_UPLOADING })).toEqual(['receiptPath:receiptUploading'])
  })
})

describe('alreadyPaidSchema und Name der Zahlungsart', () => {
  it('„Bereits bezahlt“: Datum und Zahlungsart Pflicht, Abzüge optional', () => {
    expect(alreadyPaidSchema(t, { today: TODAY }).parse({ paidOn: '2026-09-01', methodId: ID, commission: '60', fee: '' })).toEqual({
      paidOn: '2026-09-01',
      methodId: ID,
      commission: 6000,
      fee: 0,
    })
    expect(alreadyPaidSchema(t, { today: TODAY }).safeParse({ paidOn: '', methodId: '', commission: '', fee: '' }).success).toBe(false)
  })

  it('Name: Pflicht, getrimmt, höchstens 50 Zeichen', () => {
    expect(paymentMethodNameSchema(t).parse('  Gutschein ')).toBe('Gutschein')
    expect(paymentMethodNameSchema(t).safeParse('   ').success).toBe(false)
    expect(paymentMethodNameSchema(t).safeParse('x'.repeat(51)).success).toBe(false)
  })
})
