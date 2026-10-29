import { describe, expect, it } from 'vitest'

import { EMPTY_GUEST_INPUT, guestSchema } from './guests'

const schema = guestSchema((key) => key)
const valid = { ...EMPTY_GUEST_INPUT, lastName: 'Huber', country: 'AT' }
const errors = (input: Partial<typeof valid>) => {
  const result = schema.safeParse({ ...valid, ...input })
  return result.success ? [] : result.error.issues.map((i) => i.message)
}

describe('guestSchema', () => {
  it('verlangt nur Nachname und Herkunftsland', () => {
    const result = schema.parse(valid)
    expect(result.lastName).toBe('Huber')
    expect(result.firstName).toBeNull()
    expect(result.email).toBeNull()
    expect(result.marketingSource).toBeNull()
    expect(result.marketingCustom).toBeNull()
  })

  it('meldet fehlenden Nachnamen und fehlendes Land', () => {
    expect(errors({ lastName: '  ', country: '' })).toEqual(['lastNameRequired', 'countryRequired'])
  })

  it('lehnt unbekannte Ländercodes ab', () => {
    expect(errors({ country: 'XX' })).toEqual(['countryRequired'])
  })

  it('prüft das E-Mail-Format und speichert Kleinbuchstaben', () => {
    expect(errors({ email: 'keine-adresse' })).toEqual(['emailInvalid'])
    expect(schema.parse({ ...valid, email: ' Anna@Example.AT ' }).email).toBe('anna@example.at')
  })

  it('prüft die Telefonnummer grob', () => {
    expect(errors({ phone: 'abc' })).toEqual(['phoneInvalid'])
    expect(errors({ phone: '+43 (664) 123-45 67' })).toEqual([])
  })

  it('lehnt Geburtsdaten in der Zukunft ab', () => {
    expect(errors({ birthDate: '2999-01-01' })).toEqual(['birthDateFuture'])
    expect(errors({ birthDate: '1988-04-17' })).toEqual([])
    expect(errors({ birthDate: '1800-01-01' })).toEqual(['birthDateInvalid'])
  })

  it('übernimmt eine Standard-Quelle ohne Freitext', () => {
    const result = schema.parse({ ...valid, marketing: 'instagram', marketingCustom: 'egal' })
    expect(result.marketingSource).toBe('instagram')
    expect(result.marketingCustom).toBeNull()
  })

  it('übernimmt eine eigene Angabe; leerer Freitext gilt als keine Angabe', () => {
    expect(schema.parse({ ...valid, marketing: 'custom', marketingCustom: ' Messe Graz 2026 ' }).marketingCustom).toBe('Messe Graz 2026')
    const empty = schema.parse({ ...valid, marketing: 'custom', marketingCustom: '' })
    expect(empty.marketingSource).toBeNull()
    expect(empty.marketingCustom).toBeNull()
  })

  it('begrenzt die Notiz auf 2.000 Zeichen', () => {
    expect(errors({ note: 'x'.repeat(2001) })).toEqual(['tooLong'])
  })

  describe('Firmenanschrift (PROJ-33)', () => {
    it('lässt alle Felder leer zu und speichert leer bzw. nur Leerzeichen als null', () => {
      const result = schema.parse({ ...valid, companyAddressLine1: '   ' })
      expect(result.companyAddressLine1).toBeNull()
      expect(result.companyAddressLine2).toBeNull()
      expect(result.companyPostalCode).toBeNull()
      expect(result.companyCity).toBeNull()
      expect(result.companyCountry).toBeNull()
    })

    it('erlaubt PLZ und Ort ohne Adresszeile, auch ausländische PLZ', () => {
      const result = schema.parse({ ...valid, companyPostalCode: ' SW1A 1AA ', companyCity: 'London', companyCountry: 'GB' })
      expect(result.companyPostalCode).toBe('SW1A 1AA')
      expect(result.companyCity).toBe('London')
      expect(result.companyCountry).toBe('GB')
    })

    it('begrenzt Adresszeilen auf 200, PLZ auf 10 und Ort auf 100 Zeichen', () => {
      expect(errors({ companyAddressLine1: 'x'.repeat(200), companyAddressLine2: 'x'.repeat(200), companyPostalCode: 'x'.repeat(10), companyCity: 'x'.repeat(100) })).toEqual([])
      expect(errors({ companyAddressLine1: 'x'.repeat(201) })).toEqual(['tooLong'])
      expect(errors({ companyAddressLine2: 'x'.repeat(201) })).toEqual(['tooLong'])
      expect(errors({ companyPostalCode: 'x'.repeat(11) })).toEqual(['tooLong'])
      expect(errors({ companyCity: 'x'.repeat(101) })).toEqual(['tooLong'])
    })

    it('lehnt unbekannte Ländercodes beim Staat ab', () => {
      expect(errors({ companyCountry: 'XX' })).toEqual(['unknown'])
    })
  })

  describe('Titel und Geschlecht (PROJ-29)', () => {
    it('setzt das Geschlecht standardmäßig auf „keine Angabe“ und Titel auf leer', () => {
      const result = schema.parse(valid)
      expect(result.gender).toBe('unspecified')
      expect(result.titlePrefix).toBeNull()
      expect(result.titleSuffix).toBeNull()
    })

    it('begrenzt Titel auf 50 Zeichen und lehnt unbekannte Geschlechtswerte ab', () => {
      expect(errors({ titlePrefix: 'x'.repeat(51) })).toEqual(['tooLong'])
      expect(errors({ titleSuffix: ' LL.M. ' })).toEqual([])
      expect(schema.parse({ ...valid, titleSuffix: ' LL.M. ' }).titleSuffix).toBe('LL.M.')
      expect(errors({ gender: 'x' as never })).toEqual(['unknown'])
    })
  })

  describe('Reisedokument (PROJ-29)', () => {
    const path = '11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.jpg'

    it('ist ohne Angaben kein Dokument', () => {
      const result = schema.parse(valid)
      expect(result.documentType).toBeNull()
      expect(result.documentFrontPath).toBeNull()
    })

    it('verlangt Art und Nummer, sobald etwas erfasst ist', () => {
      expect(errors({ documentAuthority: 'BH Graz-Umgebung' })).toEqual(['documentTypeRequired', 'documentNumberRequired'])
      expect(errors({ documentFrontPath: path })).toEqual(['documentTypeRequired', 'documentNumberRequired'])
      expect(errors({ documentType: 'passport' })).toEqual(['documentNumberRequired'])
      expect(errors({ documentType: 'passport', documentNumber: 'P1234567', documentBackPath: path })).toEqual([])
    })

    it('lehnt Ausstellungsdaten in der Zukunft ab', () => {
      const doc = { documentType: 'id_card', documentNumber: '123' }
      expect(errors({ ...doc, documentIssuedOn: '2999-01-01' })).toEqual(['issuedOnFuture'])
      expect(errors({ ...doc, documentIssuedOn: '2020-05-04' })).toEqual([])
    })

    it('lehnt unbekannte Arten, Staaten und Speicherorte ab', () => {
      const doc = { documentType: 'passport', documentNumber: '1' }
      expect(errors({ ...doc, documentType: 'visa' })).toContain('unknown')
      expect(errors({ ...doc, documentCountry: 'XX' })).toEqual(['unknown'])
      expect(errors({ ...doc, documentFrontPath: '../fremd.jpg' })).toEqual(['unknown'])
    })

    it('blockiert das Speichern, solange ein Bild hochgeladen wird', () => {
      expect(errors({ documentType: 'passport', documentNumber: '1', documentBackPath: 'uploading' })).toEqual(['documentUploading'])
    })
  })
})
