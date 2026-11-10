import { describe, expect, it } from 'vitest'

import { MODEL_ANSWER_JSON_SCHEMA, type ModelAnswer, modelAnswerSchema, normalizeModelAnswer } from '@/lib/id-reading-normalize'

const today = '2026-11-10'
const f = (value: string | null, legible = true) => ({ value, legible })

// ICAO-Musterpass „Anna Maria Eriksson“ (Utopia gibt es nicht in der Länderliste → Staaten mit DE ersetzt)
const answer = (over: Partial<ModelAnswer> = {}): ModelAnswer => ({
  document_detected: true,
  document_type: 'passport',
  last_name: f('ERIKSSON'),
  first_names: f('ANNA MARIA'),
  birth_date: f('1974-08-12'),
  sex: f('F'),
  nationality: f('DE'),
  document_number: f('L898902C3'),
  issue_date: f('2012-04-16'),
  issuing_authority: f('Stadt Köln'),
  issuing_country: f('DE'),
  mrz_lines: ['P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<', 'L898902C36UTO7408122F1204159ZE184226B<<<<<10'],
  ...over,
})

describe('normalizeModelAnswer', () => {
  it('übernimmt sichere Werte und prüft sie gegen die MRZ', () => {
    const v = normalizeModelAnswer(answer(), today)
    expect(v.documentNumber).toEqual({ value: 'L898902C3', certain: true })
    expect(v.birthDate).toEqual({ value: '1974-08-12', certain: true })
    expect(v.gender).toEqual({ value: 'female', certain: true })
    expect(v.documentType).toEqual({ value: 'passport', certain: true })
    expect(v.country).toEqual({ value: 'DE', certain: true })
  })

  it('Dokumentnummer weicht von der MRZ ab → MRZ-Nummer, unsicher', () => {
    const v = normalizeModelAnswer(answer({ document_number: f('938568') }), today)
    expect(v.documentNumber).toEqual({ value: 'L898902C3', certain: false })
  })

  it('Geburtsdatum weicht von der MRZ ab → unsicher', () => {
    expect(normalizeModelAnswer(answer({ birth_date: f('1974-08-13') }), today).birthDate?.certain).toBe(false)
  })

  it('ohne MRZ (z. B. Führerschein): Nummer ohne Leerzeichen, sicher nach Lesbarkeit', () => {
    const v = normalizeModelAnswer(answer({ mrz_lines: [], document_number: f('c01 x00t47') }), today)
    expect(v.documentNumber).toEqual({ value: 'C01X00T47', certain: true })
    expect(normalizeModelAnswer(answer({ mrz_lines: [], document_number: f('C01X00T47', false) }), today).documentNumber?.certain).toBe(false)
  })

  it('MRZ mit falscher Prüfziffer → Nummer und Geburtsdatum unsicher', () => {
    const v = normalizeModelAnswer(
      answer({ mrz_lines: ['P<UTOERIKSSON<<ANNA<MARIA<<<<<<<<<<<<<<<<<<<', 'L898902C37UTO7408121F1204159ZE184226B<<<<<10'] }),
      today
    )
    expect(v.documentNumber?.certain).toBe(false)
    expect(v.birthDate?.certain).toBe(false)
  })

  it('Datum in der Zukunft oder unlesbar → unsicher', () => {
    expect(normalizeModelAnswer(answer({ issue_date: f('2030-01-01') }), today).documentIssuedOn?.certain).toBe(false)
    expect(normalizeModelAnswer(answer({ issue_date: f('01.08.2021') }), today).documentIssuedOn?.certain).toBe(false)
    expect(normalizeModelAnswer(answer({ issue_date: f('2021-08-01', false) }), today).documentIssuedOn?.certain).toBe(false)
  })

  it('Geschlecht X und anderes Dokument → kein Vorschlag', () => {
    const v = normalizeModelAnswer(answer({ sex: f('X'), mrz_lines: [], document_type: 'other' }), today)
    expect(v.gender).toBeNull()
    expect(v.documentType).toBeNull()
  })

  it('unbekannter Ländercode → kein Vorschlag', () => {
    expect(normalizeModelAnswer(answer({ nationality: f('UTO') }), today).country).toBeNull()
  })

  it('leere Felder → nicht gefunden', () => {
    const v = normalizeModelAnswer(answer({ issuing_authority: f(null), issue_date: f('  ') }), today)
    expect(v.documentAuthority).toBeNull()
    expect(v.documentIssuedOn).toBeNull()
  })
})

describe('Schemata', () => {
  it('JSON-Schema und Zod-Schema nennen dieselben Felder', () => {
    expect([...MODEL_ANSWER_JSON_SCHEMA.required].sort()).toEqual(Object.keys(modelAnswerSchema.shape).sort())
  })
})
