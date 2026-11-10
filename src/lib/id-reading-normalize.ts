import { z } from 'zod'

import { isCountry, LIMITS } from '@/lib/guests'
import { type IdField, type IdReadValue, type IdReadValues } from '@/lib/id-reading'
import { parseMrz } from '@/lib/mrz'

// Antwort der KI beim Ausweis-Auslesen (PROJ-51) und ihre Aufbereitung zu IdReadValues. Rein, ohne KI-Aufruf, testbar.

// Ein gelesenes Feld: Text wie auf dem Ausweis (im verlangten Format) und ob er sicher lesbar war
const field = z.object({ value: z.string().max(300).nullable(), legible: z.boolean() })

export const modelAnswerSchema = z.object({
  document_detected: z.boolean(),
  document_type: z.enum(['passport', 'id_card', 'driving_licence', 'other']).nullable(),
  last_name: field,
  first_names: field,
  birth_date: field,
  sex: field,
  nationality: field,
  document_number: field,
  issue_date: field,
  issuing_authority: field,
  issuing_country: field,
  mrz_lines: z.array(z.string().max(60)).max(3),
})
export type ModelAnswer = z.infer<typeof modelAnswerSchema>

// Dasselbe als JSON-Schema für die strukturierte Ausgabe (alle Felder Pflicht, keine weiteren)
const fieldJson = {
  type: 'object',
  properties: { value: { type: ['string', 'null'] }, legible: { type: 'boolean' } },
  required: ['value', 'legible'],
  additionalProperties: false,
} as const

export const MODEL_ANSWER_JSON_SCHEMA = {
  type: 'object',
  properties: {
    document_detected: { type: 'boolean', description: 'Zeigt mindestens ein Bild ein Reisedokument (Pass, Ausweis, Führerschein)?' },
    document_type: {
      type: ['string', 'null'],
      enum: ['passport', 'id_card', 'driving_licence', 'other', null],
      description: 'passport = Reisepass; id_card = Personalausweis oder Identitätskarte; driving_licence = Führerschein; other = anderes Dokument',
    },
    last_name: { ...fieldJson, description: 'Nachname(n) in lateinischer Schrift wie auf dem Dokument' },
    first_names: { ...fieldJson, description: 'Alle Vornamen in lateinischer Schrift wie auf dem Dokument' },
    birth_date: { ...fieldJson, description: 'Geburtsdatum als JJJJ-MM-TT' },
    sex: { ...fieldJson, description: 'F, M oder X wie aufgedruckt' },
    nationality: { ...fieldJson, description: 'Staatsangehörigkeit als ISO-3166-1-Alpha-2-Code, z. B. DE' },
    document_number: { ...fieldJson, description: 'Dokumentnummer ohne Leerzeichen' },
    issue_date: { ...fieldJson, description: 'Ausstellungsdatum als JJJJ-MM-TT' },
    issuing_authority: { ...fieldJson, description: 'Ausstellende Behörde wie aufgedruckt, lateinische Schrift' },
    issuing_country: { ...fieldJson, description: 'Ausstellender Staat als ISO-3166-1-Alpha-2-Code' },
    mrz_lines: {
      type: 'array',
      items: { type: 'string' },
      description: 'Zeilen der maschinenlesbaren Zone (mit <<<) wörtlich, sonst leer',
    },
  },
  required: [
    'document_detected',
    'document_type',
    'last_name',
    'first_names',
    'birth_date',
    'sex',
    'nationality',
    'document_number',
    'issue_date',
    'issuing_authority',
    'issuing_country',
    'mrz_lines',
  ],
  additionalProperties: false,
} as const

const DATE = /^\d{4}-\d{2}-\d{2}$/
const isDate = (v: string) => DATE.test(v) && !Number.isNaN(Date.parse(v))

const text = (f: ModelAnswer['last_name']): string | null => {
  const v = f.value?.trim().replace(/\s+/g, ' ')
  return v ? v : null
}
const read = (value: string | null, certain: boolean): IdReadValue => (value === null ? null : { value, certain })

// KI-Antwort → gelesene Werte mit „sicher/unsicher“. today: JJJJ-MM-TT (Wien)
export function normalizeModelAnswer(a: ModelAnswer, today: string): IdReadValues {
  const mrz = a.mrz_lines.length ? parseMrz(a.mrz_lines, new Date(`${today}T12:00:00Z`)) : null

  // Datum: Format, nicht in der Zukunft, nicht vor 1900; sonst unsicher
  const date = (f: ModelAnswer['birth_date']): IdReadValue => {
    const v = text(f)
    if (v === null) return null
    return read(v, f.legible && isDate(v) && v <= today && v >= '1900-01-01')
  }
  const country = (f: ModelAnswer['nationality']): IdReadValue => {
    const v = text(f)?.toUpperCase() ?? null
    return v !== null && isCountry(v) ? read(v, f.legible) : null
  }
  const limited = (f: ModelAnswer['last_name'], max: number): IdReadValue => {
    const v = text(f)
    return v === null ? null : read(v, f.legible && v.length <= max)
  }

  // Dokumentnummer: mit gültiger MRZ gilt deren Nummer; weicht die KI ab, steht die MRZ-Nummer mit „Bitte prüfen“
  let documentNumber: IdReadValue = null
  const number = text(a.document_number)?.replace(/\s+/g, '').toUpperCase() ?? null
  if (mrz?.documentNumberValid) {
    documentNumber = read(mrz.documentNumber, number === mrz.documentNumber && a.document_number.legible)
  } else if (number !== null) {
    documentNumber = read(number, a.document_number.legible && !mrz && number.length <= LIMITS.documentNumberMax)
  }

  // Geburtsdatum: mit gültiger MRZ abgleichen; fehlt es bei der KI, gilt das der MRZ
  let birthDate = date(a.birth_date)
  if (mrz?.birthDateValid && mrz.birthDate) {
    if (birthDate === null) birthDate = read(mrz.birthDate, true)
    else if (birthDate.value !== mrz.birthDate) birthDate = { value: birthDate.value, certain: false }
  } else if (mrz && !mrz.birthDateValid && birthDate) {
    birthDate = { value: birthDate.value, certain: false }
  }

  // Geschlecht: nur weiblich/männlich („X“ oder fehlend → kein Vorschlag), ersatzweise aus der MRZ
  const sex = text(a.sex)?.toUpperCase()
  const gender: IdReadValue =
    sex === 'F' ? read('female', a.sex.legible) : sex === 'M' ? read('male', a.sex.legible) : mrz?.sex ? read(mrz.sex, true) : null

  const type = a.document_type && a.document_type !== 'other' ? a.document_type : null

  const values: Record<IdField, IdReadValue> = {
    lastName: limited(a.last_name, LIMITS.nameMax),
    firstName: limited(a.first_names, LIMITS.nameMax),
    birthDate,
    gender,
    country: country(a.nationality),
    documentType: read(type, true),
    documentNumber,
    documentIssuedOn: date(a.issue_date),
    documentAuthority: limited(a.issuing_authority, LIMITS.documentAuthorityMax),
    documentCountry: country(a.issuing_country),
  }
  return values
}
