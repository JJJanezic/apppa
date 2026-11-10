import { describe, expect, it } from 'vitest'

import {
  chosenValues,
  compareIdReading,
  fakeIdReading,
  type IdCurrentValues,
  type IdReadValues,
  initialChoice,
  nameCase,
} from '@/lib/id-reading'

const empty: IdCurrentValues = {
  lastName: '',
  firstName: '',
  birthDate: '',
  gender: '',
  country: '',
  documentType: '',
  documentNumber: '',
  documentIssuedOn: '',
  documentAuthority: '',
  documentCountry: '',
}

const sure = (value: string) => ({ value, certain: true })
const read = (over: Partial<IdReadValues> = {}): IdReadValues => ({
  lastName: sure('MUSTER'),
  firstName: sure('MARIA THERESIA'),
  birthDate: sure('1985-03-12'),
  gender: sure('female'),
  country: sure('DE'),
  documentType: sure('passport'),
  documentNumber: sure('C01X00T47'),
  documentIssuedOn: sure('2020-05-04'),
  documentAuthority: sure('Stadt Köln'),
  documentCountry: sure('DE'),
  ...over,
})
const row = (rows: ReturnType<typeof compareIdReading>['rows'], f: string) => rows.find((r) => r.field === f)!

describe('nameCase', () => {
  it('wandelt Großbuchstaben in übliche Schreibweise', () => {
    expect(nameCase('MARIA THERESIA')).toBe('Maria Theresia')
    expect(nameCase('MÜLLER-LÜDENSCHEIDT')).toBe('Müller-Lüdenscheidt')
    expect(nameCase("O'BRIEN")).toBe("O'Brien")
  })
  it('lässt gemischte Schreibweise unverändert', () => {
    expect(nameCase('McDonald')).toBe('McDonald')
    expect(nameCase('de la Cruz')).toBe('de la Cruz')
  })
})

describe('compareIdReading', () => {
  it('Beispiel der Spec: Vorname weicht ab, Nachname gleich, Rest wird ergänzt', () => {
    const { rows, otherPerson } = compareIdReading({ ...empty, lastName: 'Muster', firstName: 'Maria' }, read())
    expect(otherPerson).toBe(false)
    expect(row(rows, 'lastName')).toMatchObject({ state: 'same', preselect: false })
    expect(row(rows, 'firstName')).toMatchObject({ state: 'differs', read: 'Maria Theresia', preselect: true })
    expect(row(rows, 'birthDate')).toMatchObject({ state: 'fill', preselect: true })
    expect(row(rows, 'documentNumber')).toMatchObject({ state: 'fill', preselect: true })
  })

  it('unsichere Werte sind nicht vorausgewählt', () => {
    const { rows } = compareIdReading(empty, read({ documentNumber: { value: 'C01X00T47', certain: false } }))
    expect(row(rows, 'documentNumber')).toMatchObject({ state: 'uncertain', preselect: false })
  })

  it('nicht gefundene Angaben stehen als „missing“', () => {
    const { rows } = compareIdReading({ ...empty, documentAuthority: 'BH Graz' }, read({ documentAuthority: null }))
    expect(row(rows, 'documentAuthority')).toMatchObject({ state: 'missing', read: null, current: 'BH Graz', preselect: false })
  })

  it('gleicher Wert trotz anderer Schreibweise ist „same“', () => {
    const { rows } = compareIdReading({ ...empty, documentNumber: 'c01x 00t47', documentAuthority: 'stadt köln' }, read())
    expect(row(rows, 'documentNumber').state).toBe('same')
    expect(row(rows, 'documentAuthority').state).toBe('same')
  })

  it('fremder Ausweis: Name und Geburtsdatum weichen ab → Hinweis, keine Vorauswahl bei Name und Geburtsdatum', () => {
    const { rows, otherPerson } = compareIdReading({ ...empty, lastName: 'Huber', firstName: 'Anna', birthDate: '1970-01-01' }, read())
    expect(otherPerson).toBe(true)
    for (const f of ['lastName', 'firstName', 'birthDate']) expect(row(rows, f).preselect).toBe(false)
    expect(row(rows, 'documentNumber').preselect).toBe(true)
  })

  it('kein fremder Ausweis, wenn das Geburtsdatum am Gast fehlt', () => {
    expect(compareIdReading({ ...empty, lastName: 'Huber' }, read()).otherPerson).toBe(false)
  })
})

describe('chosenValues', () => {
  it('übernimmt nur gewählte, abweichende Ausweiswerte', () => {
    const { rows } = compareIdReading({ ...empty, lastName: 'Muster', firstName: 'Maria' }, read())
    const choice = { ...initialChoice(rows), firstName: false }
    const values = chosenValues(rows, choice)
    expect(values.firstName).toBeUndefined()
    expect(values.lastName).toBeUndefined()
    expect(values.birthDate).toBe('1985-03-12')
  })
})

describe('fakeIdReading', () => {
  it('wählt den Fall nach dem Nachnamen', () => {
    expect(fakeIdReading({ ...empty, lastName: 'Fehlerfall' })).toEqual({ ok: false, error: 'unavailable' })
    expect(fakeIdReading({ ...empty, lastName: 'Keinausweis' })).toEqual({ ok: false, error: 'noDocument' })
    const unsure = fakeIdReading({ ...empty, lastName: 'Unsicher' })
    expect(unsure.ok && unsure.read.documentNumber?.certain).toBe(false)
  })
})
