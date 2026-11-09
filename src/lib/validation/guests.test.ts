import { describe, expect, it } from 'vitest'

import { companySchema } from './companies'
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

  it('meldet fehlenden Nachnamen; Staatsangehörigkeit ist optional (refine 2026-11-09)', () => {
    expect(errors({ lastName: '  ', country: '' })).toEqual(['lastNameRequired'])
    expect(schema.parse({ ...valid, country: '' }).country).toBeNull()
  })

  it('lehnt unbekannte Ländercodes ab', () => {
    expect(errors({ country: 'XX' })).toEqual(['unknown'])
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

  describe('Firma (PROJ-50)', () => {
    const companyId = '00000000-0000-4000-8000-0000000000c1'

    it('speichert ohne Firma, auch wenn noch Firmenfelder im Formular stehen', () => {
      expect(schema.parse({ ...valid, companyName: 'Rest GmbH' }).company).toEqual({ mode: 'none' })
    })

    it('verlangt bei „Bestehende Firma“ eine gewählte Firma', () => {
      expect(errors({ companyMode: 'existing' })).toEqual(['companyPick'])
      expect(schema.parse({ ...valid, companyMode: 'existing', companyId, companyName: 'Muster GmbH' }).company).toEqual({ mode: 'existing', id: companyId })
    })

    it('verlangt bei „Neue Firma“ den Firmennamen und prüft die Firmenfelder', () => {
      expect(errors({ companyMode: 'new' })).toEqual(['companyNameRequired'])
      expect(errors({ companyMode: 'new', companyName: 'A', companyEmail: 'info@firma' })).toEqual(['emailInvalid'])
      expect(errors({ companyMode: 'new', companyName: 'A', companyAddressLine1: 'x'.repeat(201) })).toEqual(['tooLong'])
    })

    it('liefert bei „Neue Firma“ die geprüften Werte, leere Felder als null', () => {
      const result = schema.parse({ ...valid, companyMode: 'new', companyName: ' Muster GmbH ', companyPostalCode: '1010', companyCity: 'Wien', companyCountry: 'AT' })
      expect(result.company).toEqual({
        mode: 'new',
        values: { name: 'Muster GmbH', vatId: null, addressLine1: null, addressLine2: null, postalCode: '1010', city: 'Wien', country: 'AT', email: null, website: null, contact: null },
      })
    })

    it('enthält keine Firmenfelder am Gast', () => {
      expect(Object.keys(schema.parse(valid)).filter((k) => k.startsWith('company') && k !== 'company')).toEqual([])
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

describe('companySchema (PROJ-50)', () => {
  const company = companySchema((key) => key)
  const base = {
    companyName: 'Muster GmbH',
    companyVatId: '',
    companyAddressLine1: '',
    companyAddressLine2: '',
    companyPostalCode: '',
    companyCity: '',
    companyCountry: '',
    companyEmail: '',
    companyWebsite: '',
    companyContact: '',
  }
  const errs = (over: Partial<typeof base>) => {
    const result = company.safeParse({ ...base, ...over })
    return result.success ? [] : result.error.issues.map((i) => i.message)
  }

  it('verlangt den Firmennamen', () => {
    expect(errs({ companyName: '  ' })).toEqual(['companyNameRequired'])
  })

  it('erlaubt Webadressen mit und ohne https://', () => {
    expect(errs({ companyWebsite: 'www.firma.at' })).toEqual([])
    expect(errs({ companyWebsite: 'https://firma.at/kontakt' })).toEqual([])
    expect(errs({ companyWebsite: 'firma' })).toEqual(['websiteInvalid'])
    expect(errs({ companyWebsite: 'www.fir ma.at' })).toEqual(['websiteInvalid'])
    expect(errs({ companyWebsite: 'javascript:alert(1).at' })).toEqual(['websiteInvalid'])
  })

  it('begrenzt Ansprechpartner auf 200 Zeichen und schreibt die E-Mail klein', () => {
    expect(errs({ companyContact: 'x'.repeat(201) })).toEqual(['tooLong'])
    expect(company.parse({ ...base, companyEmail: ' Office@Firma.AT ' }).email).toBe('office@firma.at')
  })

  it('lehnt unbekannte Ländercodes beim Staat ab', () => {
    expect(errs({ companyCountry: 'XX' })).toEqual(['unknown'])
  })
})
