import { describe, expect, it } from 'vitest'

import type { RequiredCheck } from '@/lib/invoice-drafts'
import { classifyInvoiceNumber, dateConflict, issueAllowed, issueChecks, type IssueChecksInput, isIssueDate, retentionCutoff } from '@/lib/invoice-issue'
import { DEFAULT_NUMBERING } from '@/lib/invoice-numbering'

const s = DEFAULT_NUMBERING
const numbers = ['2026-0041', '2026-0039', 'ALT-17', '2025-0118']

describe('classifyInvoiceNumber', () => {
  const cls = (n: string, date = '2026-11-05') => classifyInvoiceNumber(s, numbers, n, date)

  it('erkennt den Vorschlag', () => expect(cls('2026-0042').kind).toBe('proposal'))
  it('erkennt den Vorschlag ohne Rücksicht auf Leerzeichen', () => expect(cls(' 2026-0042 ').kind).toBe('proposal'))
  it('freie Nummer darunter ist eine Lücke', () => expect(cls('2026-0040').kind).toBe('gap'))
  it('höhere Nummer nennt die Folge', () => expect(cls('2026-9000')).toEqual({ kind: 'above', next: '2026-9001' }))
  it('anderes Format', () => expect(cls('RE/77').kind).toBe('otherFormat'))
  it('anderes Jahr als das Rechnungsdatum', () => expect(cls('2025-0200')).toEqual({ kind: 'otherYear', year: 2025 }))
  it('vergebene Nummer, auch in anderer Schreibung', () => {
    expect(cls('2026-0041').kind).toBe('taken')
    expect(cls('alt-17').kind).toBe('taken')
  })
  it('leer oder zu lang', () => {
    expect(cls('  ').kind).toBe('invalid')
    expect(cls('x'.repeat(31)).kind).toBe('invalid')
  })
  it('BUG-2: unsichtbare Zeichen und Zeilenumbrüche', () => {
    for (const n of ['2026-0041\u200b', '2026\u00ad-0041', 'Z\n1', 'Z\ufeff1', 'Z\t1']) expect(cls(n).kind, JSON.stringify(n)).toBe('invalid')
    expect(cls(' Ä/ß-1 ').kind).toBe('otherFormat')
  })
  it('das Jahr des Datums bestimmt bei „jährlich neu“ den Vorschlag', () => expect(cls('2025-0119', '2025-12-30').kind).toBe('proposal'))
  it('Nummernkreis ohne Jahr', () => {
    const plain = { ...s, withYear: false, yearlyReset: false, prefix: 'R' }
    expect(classifyInvoiceNumber(plain, ['R0005'], 'R0006', '2026-01-01').kind).toBe('proposal')
    expect(classifyInvoiceNumber(plain, ['R0005'], 'R0009', '2026-01-01')).toEqual({ kind: 'above', next: 'R0010' })
  })
})

describe('dateConflict', () => {
  const existing = [
    { number: '2026-0050', invoiceDate: '2026-10-20' },
    { number: '2026-0040', invoiceDate: '2026-09-01' },
    { number: '2025-0118', invoiceDate: '2025-12-30' },
    { number: 'ALT-17', invoiceDate: '2026-12-01' },
  ]

  it('niedrigere Nummer mit späterem Datum', () => {
    expect(dateConflict(s, existing, '2026-0051', '2026-10-14')).toEqual({ number: '2026-0050', invoiceDate: '2026-10-20', direction: 'later' })
  })
  it('höhere Nummer mit früherem Datum', () => {
    expect(dateConflict(s, existing, '2026-0045', '2026-11-01')).toEqual({ number: '2026-0050', invoiceDate: '2026-10-20', direction: 'earlier' })
  })
  it('passende Lücke ergibt keinen Hinweis', () => expect(dateConflict(s, existing, '2026-0045', '2026-10-01')).toBeNull())
  it('anderes Jahr zählt bei „jährlich neu“ nicht', () => expect(dateConflict(s, existing, '2026-0001', '2026-01-02')).toBeNull())
  it('fremdes Format hat keine Nachbarn', () => expect(dateConflict(s, existing, 'RE/77', '2020-01-01')).toBeNull())
})

const base: IssueChecksInput = {
  number: '2026-0001',
  invoiceDate: '2026-11-05',
  today: '2026-11-05',
  numbering: s,
  existing: [],
  required: [],
  bookingChanged: false,
  bookingCancelled: false,
  bookingIsOption: false,
  smallBusiness: false,
  deductions: [],
  missingDeductions: 0,
  billedCents: 0,
  totalCents: 10000,
  billableCents: 10000,
  pdf: { missingChars: [], issuerOverflow: false, footerCut: false, footerReduced: false, logoFailed: false, logoBlurry: false },
}
const keys = (c: { key: string }[]) => c.map((x) => x.key)

describe('issueChecks', () => {
  it('der Normalfall ist frei', () => {
    const c = issueChecks(base)
    expect(c).toMatchObject({ blocks: [], acks: [], notes: [] })
    expect(issueAllowed(c, [])).toBe(true)
  })

  it('fehlende Pflichtangaben sperren, vorhandene nicht', () => {
    const required: RequiredCheck[] = [
      { key: 'issuer', ok: false, settings: true },
      { key: 'period', ok: true },
    ]
    expect(keys(issueChecks({ ...base, required }).blocks)).toEqual(['required'])
  })

  it('Datum in der Zukunft sperrt', () => expect(keys(issueChecks({ ...base, invoiceDate: '2026-11-06' }).blocks)).toEqual(['futureDate']))

  it('vergebene und ungültige Nummer sperren', () => {
    expect(keys(issueChecks({ ...base, existing: [{ number: '2026-0001', invoiceDate: '2026-01-01' }] }).blocks)).toEqual(['numberTaken'])
    expect(keys(issueChecks({ ...base, number: ' ' }).blocks)).toEqual(['numberInvalid'])
  })

  it('auffällige Nummern brauchen ein Häkchen, das nur für diese Nummer gilt', () => {
    const c = issueChecks({ ...base, number: '2026-9000' })
    expect(c.acks).toEqual([{ id: 'number:2026-9000', key: 'numberAbove', next: '2026-9001' }])
    expect(issueAllowed(c, [])).toBe(false)
    expect(issueAllowed(c, ['number:2026-9000'])).toBe(true)
    expect(issueAllowed(issueChecks({ ...base, number: '2026-9001' }), ['number:2026-9000'])).toBe(false)
  })

  it('Lücke und Datumskonflikt sind nur Hinweise', () => {
    const existing = [{ number: '2026-0050', invoiceDate: '2026-10-20' }]
    const c = issueChecks({ ...base, number: '2026-0020', existing, invoiceDate: '2026-11-01' })
    expect(keys(c.notes)).toEqual(['gap', 'dateEarlier'])
    expect(issueAllowed(c, [])).toBe(true)
  })

  it('Buchung geändert: Häkchen; storniert: Sperre ohne Häkchen', () => {
    expect(keys(issueChecks({ ...base, bookingChanged: true }).acks)).toEqual(['bookingChanged'])
    const cancelled = issueChecks({ ...base, bookingChanged: true, bookingCancelled: true })
    expect(keys(cancelled.blocks)).toEqual(['bookingCancelled'])
    expect(cancelled.acks).toEqual([])
  })

  it('schon vor dem Speichern stornierte Buchung sperrt nicht', () => expect(issueChecks({ ...base, bookingCancelled: true }).blocks).toEqual([]))

  it('Option braucht ein Häkchen', () => expect(keys(issueChecks({ ...base, bookingIsOption: true }).acks)).toEqual(['option']))

  it('Abzüge: Teilrechnungs-Entwurf und fehlende Rechnung sperren, ausgestellte nicht', () => {
    const c = issueChecks({
      ...base,
      deductions: [
        { id: 'a', origin: 'draft', number: null },
        { id: 'b', origin: 'issued', number: '2026-0002' },
      ],
      missingDeductions: 1,
    })
    expect(c.blocks).toEqual([{ key: 'deductionDraft', id: 'a' }, { key: 'deductionRemoved' }])
  })

  it('abweichender Kleinunternehmer-Status ist ein Hinweis', () => {
    const c = issueChecks({ ...base, deductions: [{ id: 'b', origin: 'issued', number: 'x', smallBusiness: true }] })
    expect(keys(c.notes)).toEqual(['smallBusinessDiffers'])
  })

  it('PDF-Mängel: Inhalt sperrt, Logo mit Häkchen, verkleinerte Fußzeile nur Hinweis', () => {
    const pdf = base.pdf
    expect(issueChecks({ ...base, pdf: { ...pdf, missingChars: ['✓', '☃'] } }).blocks).toEqual([{ key: 'missingChars', chars: '✓ ☃' }])
    expect(keys(issueChecks({ ...base, pdf: { ...pdf, issuerOverflow: true } }).blocks)).toEqual(['issuerOverflow'])
    const cut = issueChecks({ ...base, pdf: { ...pdf, footerReduced: true, footerCut: true } })
    expect(keys(cut.blocks)).toEqual(['footerCut'])
    expect(cut.notes).toEqual([])
    const reduced = issueChecks({ ...base, pdf: { ...pdf, footerReduced: true } })
    expect(reduced.blocks).toEqual([])
    expect(keys(reduced.notes)).toEqual(['footerReduced'])
    expect(keys(issueChecks({ ...base, pdf: { ...pdf, logoFailed: true } }).acks)).toEqual(['logo'])
    expect(keys(issueChecks({ ...base, pdf: { ...pdf, logoBlurry: true } }).notes)).toEqual(['logoBlurry'])
  })

  it('Betrag 0 oder negativ und Summe über dem Gesamtpreis sind Hinweise', () => {
    expect(keys(issueChecks({ ...base, totalCents: -100 }).notes)).toEqual(['totalNotPositive'])
    const over = issueChecks({ ...base, billedCents: 5000 })
    expect(keys(over.notes)).toEqual(['overBilled'])
    expect(issueAllowed(over, [])).toBe(true)
  })
})

describe('Hilfen', () => {
  it('isIssueDate', () => {
    expect(isIssueDate('2026-11-05')).toBe(true)
    expect(isIssueDate('')).toBe(false)
    expect(isIssueDate('1989-12-31')).toBe(false)
  })
  it('Frist: 7 Jahre ab Ende des Kalenderjahres', () => {
    expect(retentionCutoff('2026-11-05')).toBe('2019-01-01')
    expect(retentionCutoff('2027-01-01')).toBe('2020-01-01')
  })
})
