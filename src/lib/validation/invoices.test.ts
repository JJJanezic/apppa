import { describe, expect, it } from 'vitest'

import { PDF_UPLOADING } from '@/lib/invoices'
import { type InvoiceInput, invoiceSchema } from '@/lib/validation/invoices'

const key = (k: string) => k
const TODAY = '2026-10-30'
const schema = invoiceSchema(key, { today: TODAY })
const ID = '11111111-2222-3333-4444-555555555555'

const VALID: InvoiceInput = {
  number: ' 2025-0042 ',
  invoiceDate: '2025-03-14',
  bookingId: '',
  guestMode: 'existing',
  guestId: '',
  recipient: ' Huber Maria ',
  lines: [{ label: 'Übernachtung', amount: '450,00', vat: '10,00' }],
  pdfPath: '',
}

const errors = (input: InvoiceInput) => {
  const r = schema.safeParse(input)
  return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [i.path.join('.'), i.message]))
}

describe('invoiceSchema', () => {
  it('bereinigt gültige Angaben und rechnet Beträge und Sätze um', () => {
    expect(schema.parse(VALID)).toEqual({
      number: '2025-0042',
      invoiceDate: '2025-03-14',
      bookingId: null,
      guestMode: 'existing',
      guestId: null,
      recipient: 'Huber Maria',
      lines: [{ label: 'Übernachtung', amountCents: 45000, vatBp: 1000 }],
      pdfPath: null,
    })
  })

  it('meldet Pflichtangaben bei leerem Formular', () => {
    const e = errors({ ...VALID, number: '', invoiceDate: '', recipient: '  ', lines: [] })
    expect(e.number).toBe('numberRequired')
    expect(e.invoiceDate).toBe('dateRequired')
    expect(e.recipient).toBe('recipientRequired')
    expect(e.lines).toBe('linesRequired')
  })

  it('lehnt Datum in der Zukunft und zu lange Nummern ab', () => {
    expect(errors({ ...VALID, invoiceDate: '2026-10-31' }).invoiceDate).toBe('dateInFuture')
    expect(schema.safeParse({ ...VALID, invoiceDate: TODAY }).success).toBe(true)
    expect(errors({ ...VALID, number: 'x'.repeat(31) }).number).toBe('numberTooLong')
    expect(schema.safeParse({ ...VALID, number: 'x'.repeat(30) }).success).toBe(true)
  })

  it('erlaubt negative Positionen und einen Gesamtbetrag unter 0', () => {
    const r = schema.parse({ ...VALID, lines: [{ label: 'Gutschrift', amount: '-50', vat: '20' }] })
    expect(r.lines).toEqual([{ label: 'Gutschrift', amountCents: -5000, vatBp: 2000 }])
  })

  it('prüft jede Position', () => {
    const e = errors({ ...VALID, lines: [{ label: '', amount: '', vat: '' }, { label: 'X', amount: 'abc', vat: '101' }] })
    expect(e['lines.0.label']).toBe('lineLabelRequired')
    expect(e['lines.0.amount']).toBe('amountRequired')
    expect(e['lines.0.vat']).toBe('vatRequired')
    expect(e['lines.1.amount']).toBe('amountInvalid')
    expect(e['lines.1.vat']).toBe('vatInvalid')
  })

  it('übernimmt Buchung und Gast; bei neuem Gast keine Gast-ID', () => {
    expect(schema.parse({ ...VALID, bookingId: ID, guestId: ID })).toMatchObject({ bookingId: ID, guestId: ID })
    expect(schema.parse({ ...VALID, guestMode: 'new', guestId: ID }).guestId).toBeNull()
    expect(schema.safeParse({ ...VALID, bookingId: 'kein-id' }).success).toBe(false)
  })

  it('wartet auf einen laufenden PDF-Upload', () => {
    expect(errors({ ...VALID, pdfPath: PDF_UPLOADING }).pdfPath).toBe('pdfUploading')
    expect(schema.parse({ ...VALID, pdfPath: 'abc/def.pdf' }).pdfPath).toBe('abc/def.pdf')
  })
})
