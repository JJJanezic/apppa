import { describe, expect, it } from 'vitest'

import { defaultMarketingDoc, defaultPrivacyDoc } from '@/lib/guest-sheet'
import { docFromText, emptyDoc } from '@/lib/rich-text'
import { guestSheetTextsSchema, sheetCompanionSchema, sheetGuestSchema, sheetUploadSchema } from '@/lib/validation/guest-sheet'

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
  it('Lfd.-Nr. bis 30 Zeichen, Datum nicht in der Zukunft', () => {
    expect(sheetUploadSchema(t).safeParse({ sheetNumber: ' 17 ', signedOn: '2025-08-12', marketingConsent: true }).data).toEqual({
      sheetNumber: '17',
      signedOn: '2025-08-12',
      marketingConsent: true,
    })
    expect(sheetUploadSchema(t).safeParse({ sheetNumber: 'x'.repeat(31), signedOn: '', marketingConsent: false }).success).toBe(false)
    expect(sheetUploadSchema(t).safeParse({ sheetNumber: '', signedOn: '2999-01-01', marketingConsent: false }).success).toBe(false)
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
