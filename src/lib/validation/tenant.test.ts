import { describe, expect, it } from 'vitest'

import messages from '../../../messages/de.json'
import { tenantMasterDataSchema } from './tenant'

const v = messages.tenantData.validation
const t = (key: string) => v[key as keyof typeof v]
const schema = tenantMasterDataSchema(t)

const EMPTY = {
  name: 'Pichler Ferienwohnungen',
  nameLine2: '',
  addressLine1: '',
  addressLine2: '',
  postalCode: '',
  city: '',
  country: '',
  vatId: '',
  taxNumber: '',
  registerNumber: '',
  vatStatus: [] as { validFrom: string; status: string }[],
  invoiceBackfill: true,
}

const firstError = (r: { success: boolean; error?: { issues: { message: string }[] } }) => r.error?.issues[0]?.message

describe('tenantMasterDataSchema', () => {
  it('akzeptiert nur den Namen; leere Felder werden zu null', () => {
    expect(schema.parse(EMPTY)).toEqual({
      name: 'Pichler Ferienwohnungen',
      nameLine2: null,
      addressLine1: null,
      addressLine2: null,
      postalCode: null,
      city: null,
      country: null,
      vatId: null,
      taxNumber: null,
      registerNumber: null,
      vatStatus: [],
      invoiceBackfill: true,
    })
  })

  it('verlangt einen Namen und behandelt nur Leerzeichen als leer', () => {
    expect(firstError(schema.safeParse({ ...EMPTY, name: '   ' }))).toBe(v.nameRequired)
    expect(schema.parse({ ...EMPTY, city: '   ' }).city).toBeNull()
  })

  it('trimmt Eingaben und behält Sonderzeichen', () => {
    const r = schema.parse({ ...EMPTY, nameLine2: '  Müller-Öztürk & Söhne ', registerNumber: ' FN 123456a ' })
    expect(r.nameLine2).toBe('Müller-Öztürk & Söhne')
    expect(r.registerNumber).toBe('FN 123456a')
  })

  it('prüft Höchstlängen', () => {
    expect(firstError(schema.safeParse({ ...EMPTY, name: 'a'.repeat(201) }))).toBe(v.tooLong)
    expect(firstError(schema.safeParse({ ...EMPTY, addressLine1: 'a'.repeat(201) }))).toBe(v.tooLong)
    expect(firstError(schema.safeParse({ ...EMPTY, postalCode: '1'.repeat(11) }))).toBe(v.tooLong)
    expect(firstError(schema.safeParse({ ...EMPTY, city: 'a'.repeat(101) }))).toBe(v.tooLong)
    expect(firstError(schema.safeParse({ ...EMPTY, taxNumber: '1'.repeat(31) }))).toBe(v.tooLong)
    expect(schema.safeParse({ ...EMPTY, registerNumber: '1'.repeat(30) }).success).toBe(true)
  })

  it('normalisiert die UID und prüft das Format', () => {
    expect(schema.parse({ ...EMPTY, vatId: 'atu 1234 5678' }).vatId).toBe('ATU12345678')
    expect(schema.parse({ ...EMPTY, vatId: 'DE123456789' }).vatId).toBe('DE123456789')
    expect(firstError(schema.safeParse({ ...EMPTY, vatId: 'ATU1234567' }))).toBe(v.vatIdInvalid)
    expect(firstError(schema.safeParse({ ...EMPTY, vatId: 'AT12345678' }))).toBe(v.vatIdInvalid)
    expect(firstError(schema.safeParse({ ...EMPTY, vatId: '123456789' }))).toBe(v.vatIdInvalid)
    expect(firstError(schema.safeParse({ ...EMPTY, vatId: 'DE1' }))).toBe(v.vatIdInvalid)
    expect(schema.parse({ ...EMPTY, vatId: '  ' }).vatId).toBeNull()
  })

  it('nimmt nur bekannte Ländercodes', () => {
    expect(schema.parse({ ...EMPTY, country: 'AT' }).country).toBe('AT')
    expect(firstError(schema.safeParse({ ...EMPTY, country: 'XX' }))).toBe(v.unknown)
  })

  it('Kleinunternehmer-Status: wandelt die Auswahl in ja/nein (PROJ-36)', () => {
    const r = schema.parse({
      ...EMPTY,
      vatStatus: [
        { validFrom: '2026-08-15', status: 'regular' },
        { validFrom: '2026-01-01', status: 'small' },
      ],
    })
    expect(r.vatStatus).toEqual([
      { validFrom: '2026-08-15', smallBusiness: false },
      { validFrom: '2026-01-01', smallBusiness: true },
    ])
  })

  it('Kleinunternehmer-Status: Datum und Status sind Pflicht', () => {
    expect(firstError(schema.safeParse({ ...EMPTY, vatStatus: [{ validFrom: '', status: 'small' }] }))).toBe(v.vatDateRequired)
    expect(firstError(schema.safeParse({ ...EMPTY, vatStatus: [{ validFrom: '2026-02-30', status: 'small' }] }))).toBe(
      v.vatDateRequired
    )
    expect(firstError(schema.safeParse({ ...EMPTY, vatStatus: [{ validFrom: '1999-12-31', status: 'small' }] }))).toBe(
      v.vatDateRange
    )
    expect(firstError(schema.safeParse({ ...EMPTY, vatStatus: [{ validFrom: '2026-07-01', status: '' }] }))).toBe(
      v.vatStatusRequired
    )
  })

  it('Kleinunternehmer-Status: ein Datum nur einmal, Fehler an der zweiten Zeile', () => {
    const r = schema.safeParse({
      ...EMPTY,
      vatStatus: [
        { validFrom: '2026-07-01', status: 'small' },
        { validFrom: '2026-07-01', status: 'regular' },
      ],
    })
    expect(r.success).toBe(false)
    expect(r.error?.issues[0]).toMatchObject({ message: v.vatDateDuplicate, path: ['vatStatus', 1, 'validFrom'] })
  })

  it('Kleinunternehmer-Status: höchstens 50 Einträge, mit Meldung', () => {
    const rows = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ validFrom: `20${String(i + 10).padStart(2, '0')}-01-01`, status: 'small' }))
    expect(schema.safeParse({ ...EMPTY, vatStatus: rows(50) }).success).toBe(true)
    expect(firstError(schema.safeParse({ ...EMPTY, vatStatus: rows(51) }))).toBe(v.vatStatusTooMany)
  })

  it('Kleinunternehmer-Status: gleicher Status hintereinander ist erlaubt', () => {
    const rows = [
      { validFrom: '2026-01-01', status: 'small' },
      { validFrom: '2026-05-01', status: 'small' },
    ]
    expect(schema.safeParse({ ...EMPTY, vatStatus: rows }).success).toBe(true)
  })
})
