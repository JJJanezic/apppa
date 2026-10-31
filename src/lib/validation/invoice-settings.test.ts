import { describe, expect, it } from 'vitest'

import de from '../../../messages/de.json'
import { docFromText, emptyDoc } from '@/lib/rich-text'
import { fixedTextsSchema, numberingSchema, previewPaymentRules, textBlockSchema } from '@/lib/validation/invoice-settings'

const v = de.invoiceSettings.validation
// Meldung mit eingesetzten Werten wie next-intl („{max}“ → 10)
const t = (key: string, values?: Record<string, string | number>) => {
  const raw = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)[k], v) as string
  return raw.replace(/\{(\w+)\}/g, (_, k: string) => String(values?.[k] ?? `{${k}}`))
}
const firstError = (r: { success: boolean; error?: { issues: { message: string }[] } }) => r.error?.issues[0]?.message

describe('numberingSchema', () => {
  const schema = numberingSchema(t)
  const base = { prefix: '', withYear: true, separator: '-' as const, digits: '4', yearlyReset: true, startNumber: '1' }

  it('Voreinstellung ist gültig; leeres Präfix erlaubt', () => {
    expect(schema.parse(base)).toEqual({ ...base, digits: 4, startNumber: 1 })
  })

  it('Präfix: höchstens 10 Zeichen, keine Leerzeichen oder #', () => {
    expect(firstError(schema.safeParse({ ...base, prefix: 'ABCDEFGHIJK' }))).toBe(t('prefixTooLong', { max: 10 }))
    expect(firstError(schema.safeParse({ ...base, prefix: 'R 1' }))).toBe(t('prefixInvalid'))
    expect(firstError(schema.safeParse({ ...base, prefix: 'R#' }))).toBe(t('prefixInvalid'))
    expect(schema.safeParse({ ...base, prefix: 'R-2/_.' }).success).toBe(true)
  })

  it('jährlich neu nur mit Jahreszahl', () => {
    expect(firstError(schema.safeParse({ ...base, withYear: false }))).toBe(t('yearlyNeedsYear'))
    expect(schema.safeParse({ ...base, withYear: false, yearlyReset: false }).success).toBe(true)
  })

  it('Startnummer: ganze Zahl ab 1', () => {
    for (const startNumber of ['0', '-1', '1,5', '', 'x']) {
      expect(firstError(schema.safeParse({ ...base, startNumber }))).toBe(t('startInvalid'))
    }
  })
})

describe('fixedTextsSchema', () => {
  const schema = fixedTextsSchema(t)
  it('Kleinunternehmer-Hinweis Pflicht; leere Fußzeile wird null', () => {
    expect(firstError(schema.safeParse({ smallBusinessNote: docFromText('  '), footer: emptyDoc() }))).toBe(t('smallBusinessNoteRequired'))
    expect(schema.parse({ smallBusinessNote: docFromText('Hinweis'), footer: emptyDoc() }).footer).toBeNull()
  })

  it('Grenzen 500 bzw. 2.000 Zeichen', () => {
    expect(firstError(schema.safeParse({ smallBusinessNote: docFromText('x'.repeat(501)), footer: emptyDoc() }))).toBe(
      t('textTooLong', { max: '500', length: '501' })
    )
    expect(schema.safeParse({ smallBusinessNote: docFromText('x'), footer: docFromText('y'.repeat(2001)) }).success).toBe(false)
  })

  it('keine Platzhalter; kein HTML am Editor vorbei', () => {
    expect(firstError(schema.safeParse({ smallBusinessNote: docFromText('{Wohnung}'), footer: emptyDoc() }))).toBe(
      t('placeholder.unknown', { token: '{Wohnung}' })
    )
    expect(firstError(schema.safeParse({ smallBusinessNote: '<script>x</script>', footer: emptyDoc() }))).toBe(t('textInvalid'))
  })
})

describe('textBlockSchema', () => {
  const schema = textBlockSchema(t)
  const base = {
    kind: 'intro' as const,
    name: 'Dank',
    body: docFromText('{Anrede}, danke.'),
    deposit: false,
    depositPercent: '',
    depositDays: '',
    dueDays: '',
    dueBasis: 'after_invoice' as const,
  }

  it('Name und Text Pflicht, Grenzen 60 bzw. 2.000', () => {
    expect(firstError(schema.safeParse({ ...base, name: ' ' }))).toBe(t('nameRequired'))
    expect(firstError(schema.safeParse({ ...base, name: 'x'.repeat(61) }))).toBe(t('nameTooLong', { max: 60 }))
    expect(firstError(schema.safeParse({ ...base, body: emptyDoc() }))).toBe(t('bodyRequired'))
    expect(schema.safeParse({ ...base, body: docFromText('x'.repeat(2001)) }).success).toBe(false)
  })

  it('Einleitung ohne Zahlungsregeln', () => {
    expect(schema.parse(base).payment).toBeNull()
  })

  it('unbekannte und hier unzulässige Platzhalter', () => {
    expect(firstError(schema.safeParse({ ...base, body: docFromText('{Gastname}') }))).toBe(t('placeholder.unknown', { token: '{Gastname}' }))
    expect(firstError(schema.safeParse({ ...base, body: docFromText('{Fälligkeitsdatum}') }))).toBe(
      t('placeholder.notHere', { token: '{Fälligkeitsdatum}' })
    )
  })

  const pay = { ...base, kind: 'payment' as const, body: docFromText('Bitte bis {Fälligkeitsdatum}.'), dueDays: '14' }

  it('Zahlungsmodalitäten: Fälligkeit Pflicht, 0–365 ganze Tage', () => {
    expect(firstError(schema.safeParse({ ...pay, dueDays: '' }))).toBe(t('daysRequired'))
    expect(firstError(schema.safeParse({ ...pay, dueDays: '366' }))).toBe(t('daysRange', { max: 365 }))
    expect(firstError(schema.safeParse({ ...pay, dueDays: '1,5' }))).toBe(t('daysRange', { max: 365 }))
    expect(schema.parse({ ...pay, dueDays: '0' }).payment).toEqual({ depositPercent: null, depositDays: null, dueDays: 0, dueBasis: 'after_invoice' })
  })

  it('Anzahlung: Prozent 1–100 mit 2 Nachkommastellen und Frist Pflicht', () => {
    const dep = { ...pay, deposit: true, body: docFromText('{Anzahlung} bis {Anzahlung fällig}, Rest {Restbetrag}') }
    expect(firstError(schema.safeParse({ ...dep, depositPercent: '', depositDays: '3' }))).toBe(t('percentRequired'))
    for (const depositPercent of ['0,5', '101', '20,123']) {
      expect(firstError(schema.safeParse({ ...dep, depositPercent, depositDays: '3' }))).toBe(t('percentRange', { min: 1, max: 100 }))
    }
    expect(firstError(schema.safeParse({ ...dep, depositPercent: '20', depositDays: '' }))).toBe(t('daysRequired'))
    expect(schema.parse({ ...dep, depositPercent: '12,5', depositDays: '3', dueBasis: 'before_arrival', dueDays: '1' }).payment).toEqual({
      depositPercent: 12.5,
      depositDays: 3,
      dueDays: 1,
      dueBasis: 'before_arrival',
    })
  })

  it('ohne Anzahlung: Anzahlungs-Platzhalter gesperrt, Prozent und Frist werden verworfen', () => {
    expect(firstError(schema.safeParse({ ...pay, body: docFromText('{Restbetrag}') }))).toBe(t('placeholder.depositOnly', { token: '{Restbetrag}' }))
    expect(schema.parse({ ...pay, depositPercent: '20', depositDays: '3' }).payment?.depositPercent).toBeNull()
  })
})

describe('previewPaymentRules', () => {
  it('unfertige Eingaben ergeben keine Anzahlung', () => {
    const v = { kind: 'payment' as const, deposit: true, depositPercent: '', depositDays: '3', dueDays: 'x', dueBasis: 'after_invoice' as const }
    expect(previewPaymentRules(v)).toEqual({ depositPercent: null, depositDays: null, dueDays: 0, dueBasis: 'after_invoice' })
  })
})
