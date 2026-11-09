import { describe, expect, it } from 'vitest'

import { defaultMarketingDoc, defaultPrivacyDoc } from '@/lib/guest-sheet'
import { docFromText, emptyDoc } from '@/lib/rich-text'
import {
  establishmentNumberSchema,
  guestSheetTextsSchema,
  sheetCompanionSchema,
  sheetGuestSchema,
  sheetRangeSchema,
  sheetUploadSchema,
} from '@/lib/validation/guest-sheet'

const t = (key: string) => key

describe('Felder des Gästeblatts', () => {
  const field = (name: 'birthDate' | 'country' | 'lastName' | 'documentIssuedOn', value: string) =>
    sheetGuestSchema(t).pick({ [name]: true } as never).safeParse({ [name]: value })

  it('einzelne Felder wie im Gastformular', () => {
    expect(field('birthDate', '1980-05-01').success).toBe(true)
    expect(field('birthDate', '').success).toBe(true)
    expect(field('birthDate', '2999-01-01').success).toBe(false)
    expect(field('documentIssuedOn', '1899-12-31').success).toBe(false)
    expect(field('country', 'XX').success).toBe(false)
    expect(field('lastName', '  ').success).toBe(false)
  })

  it('Mitreisende brauchen Familien- und Vornamen', () => {
    expect(sheetCompanionSchema(t).safeParse({ lastName: 'Huber', firstName: 'Max', birthDate: '' }).success).toBe(true)
    expect(sheetCompanionSchema(t).safeParse({ lastName: 'Huber', firstName: '', birthDate: '' }).success).toBe(false)
  })
})

describe('Hochladen', () => {
  it('Datum nicht in der Zukunft; die Lfd.-Nr. kommt aus der Buchung', () => {
    expect(sheetUploadSchema(t).safeParse({ signedOn: '2025-08-12', marketingConsent: true }).data).toEqual({
      signedOn: '2025-08-12',
      marketingConsent: true,
    })
    expect(sheetUploadSchema(t).safeParse({ signedOn: '2999-01-01', marketingConsent: false }).success).toBe(false)
  })
})

describe('Kennzahl und Nummernbereiche', () => {
  it('Kennzahl optional, mit führenden Nullen, nur erlaubte Zeichen', () => {
    expect(establishmentNumberSchema(t).safeParse(' 00123 ').data).toBe('00123')
    expect(establishmentNumberSchema(t).safeParse('').data).toBeNull()
    expect(establishmentNumberSchema(t).safeParse('12 3').success).toBe(false)
    expect(establishmentNumberSchema(t).safeParse('1'.repeat(31)).success).toBe(false)
  })

  it('Bereich mit Meldung am betroffenen Feld', () => {
    expect(sheetRangeSchema(t).safeParse({ from: '0001', to: '0500', next: '0042' }).success).toBe(true)
    const overlap = sheetRangeSchema(t, [{ from: '0001', to: '0500' }]).safeParse({ from: '0400', to: '0600', next: '' })
    expect(overlap.error?.issues[0]).toMatchObject({ path: ['from'], message: 'rangeOverlaps' })
    const outside = sheetRangeSchema(t).safeParse({ from: '0001', to: '0500', next: '0501' })
    expect(outside.error?.issues[0]).toMatchObject({ path: ['next'], message: 'rangeNextOutside' })
  })
})

describe('Einstellungen → Gästeblatt', () => {
  it('Standardtexte sind gültig', () => {
    expect(guestSheetTextsSchema(t).safeParse({ privacy: defaultPrivacyDoc(), marketing: defaultMarketingDoc() }).success).toBe(true)
  })

  it('leerer Text und unbekannter Platzhalter werden abgelehnt', () => {
    const empty = guestSheetTextsSchema(t).safeParse({ privacy: emptyDoc(), marketing: defaultMarketingDoc() })
    expect(empty.error?.issues.map((i) => i.message)).toEqual(['textRequired'])
    const unknown = guestSheetTextsSchema(t).safeParse({ privacy: docFromText('Hallo {Gastname}'), marketing: defaultMarketingDoc() })
    expect(unknown.error?.issues.map((i) => i.message)).toEqual(['placeholder.unknown'])
  })
})
