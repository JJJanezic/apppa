// Ausweis automatisch auslesen (PROJ-51): gemeinsame Typen und die Regeln der Gegenüberstellung „Vorhanden | Vom Ausweis“.
// Die Gegenüberstellung rechnet der Server (Schnittstelle /api/ausweis/auslesen); hier stehen nur reine Funktionen.

// Ausgelesene Angaben in der Reihenfolge der Gegenüberstellung. Werte im Format der Formularfelder:
// Datum JJJJ-MM-TT, Länder als Code der Länderliste (PROJ-7), Dokumentart und Geschlecht als Schlüssel.
export const ID_FIELDS = [
  'lastName',
  'firstName',
  'birthDate',
  'gender',
  'country',
  'documentType',
  'documentNumber',
  'documentIssuedOn',
  'documentAuthority',
  'documentCountry',
] as const
export type IdField = (typeof ID_FIELDS)[number]

export const DOCUMENT_ID_FIELDS = ['documentType', 'documentNumber', 'documentIssuedOn', 'documentAuthority', 'documentCountry'] as const

// Tageslimit je Kunde (Auslesungen pro Kalendertag, Wiener Zeit), vom Betreiber einstellbar
export const ID_READING_LIMIT_MIN = 1
export const ID_READING_LIMIT_MAX = 1000

// Stelle, an der ausgelesen wird (Rechte und Protokoll unterscheiden sich)
export const ID_READING_PLACES = ['guestForm', 'guestSheet'] as const
export type IdReadingPlace = (typeof ID_READING_PLACES)[number]

// Vorhandene Werte (aktueller Stand im Formular bzw. auf dem Blatt, auch ungespeichert); leer = ''
export type IdCurrentValues = Record<IdField, string>

// Ein gelesener Wert: null = auf dem Ausweis nicht gefunden; certain = false bei schlechter Lesbarkeit oder fehlgeschlagener
// Prüfung (z. B. Prüfziffer der maschinenlesbaren Zone, Datum in der Zukunft)
export type IdReadValue = { value: string; certain: boolean } | null
export type IdReadValues = Record<IdField, IdReadValue>

// same: gleich (abgehakt); fill: Feld leer; differs: Abweichung (rot); uncertain: „Bitte prüfen“ (gelb); missing: „–“
export type IdRowState = 'same' | 'fill' | 'differs' | 'uncertain' | 'missing'

export type IdComparisonRow = {
  field: IdField
  current: string
  read: string | null
  state: IdRowState
  // Ausweiswert beim Öffnen gewählt
  preselect: boolean
}

export type IdComparison = {
  rows: IdComparisonRow[]
  // Name und Geburtsdatum weichen beide ab: „Der Ausweis passt möglicherweise nicht zu diesem Gast.“
  otherPerson: boolean
}

// Fehler der Schnittstelle → Texte idReading.errors.*
export const ID_READING_ERRORS = [
  'sessionExpired',
  'forbidden',
  'invalid',
  'notEnabled',
  'dailyLimit',
  'noImage',
  'noDocument',
  'unavailable',
  'notReady',
  'unknown',
] as const
export type IdReadingError = (typeof ID_READING_ERRORS)[number]

export type IdReadingResponse = { ok: true; comparison: IdComparison; readingId: string } | { ok: false; error: IdReadingError }

// Vergleich ohne Groß-/Kleinschreibung, Akzente bleiben (Müller ≠ Muller), Leerzeichen zusammengefasst
const norm = (v: string) => v.trim().replace(/\s+/g, ' ').toLocaleLowerCase('de')
const NAME_FIELDS: IdField[] = ['lastName', 'firstName']
const isName = (f: IdField) => NAME_FIELDS.includes(f)

function sameValue(field: IdField, current: string, read: string): boolean {
  if (field === 'documentNumber') return current.replace(/\s+/g, '').toUpperCase() === read.replace(/\s+/g, '').toUpperCase()
  return norm(current) === norm(read)
}

// Ausweise drucken Namen in Großbuchstaben: „MARIA THERESIA“ → „Maria Theresia“, „MÜLLER-LÜDENSCHEIDT“ → „Müller-Lüdenscheidt“.
// Gemischte Schreibweise (z. B. „McDonald“, „de la Cruz“) bleibt unverändert.
export function nameCase(value: string): string {
  const v = value.trim().replace(/\s+/g, ' ')
  if (v !== v.toLocaleUpperCase('de')) return v
  return v.toLocaleLowerCase('de').replace(/(^|[\s\-'’])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toLocaleUpperCase('de'))
}

// Gegenüberstellung nach den Regeln der Spec (PROJ-51, Ablauf Schritt 2 und Edge Case „fremder Ausweis“)
export function compareIdReading(current: IdCurrentValues, read: IdReadValues): IdComparison {
  const rows: IdComparisonRow[] = ID_FIELDS.map((field) => {
    const now = current[field] ?? ''
    const got = read[field]
    if (!got || got.value.trim() === '') return { field, current: now, read: null, state: 'missing', preselect: false }
    const value = isName(field) ? nameCase(got.value) : got.value.trim()
    if (now.trim() !== '' && sameValue(field, now, value)) return { field, current: now, read: value, state: 'same', preselect: false }
    if (!got.certain) return { field, current: now, read: value, state: 'uncertain', preselect: false }
    if (now.trim() === '') return { field, current: now, read: value, state: 'fill', preselect: true }
    return { field, current: now, read: value, state: 'differs', preselect: true }
  })
  const state = (f: IdField) => rows.find((r) => r.field === f)!.state
  const otherPerson = state('lastName') === 'differs' && state('birthDate') === 'differs'
  if (otherPerson) for (const r of rows) if (r.field === 'lastName' || r.field === 'firstName' || r.field === 'birthDate') r.preselect = false
  return { rows, otherPerson }
}

// Gewählte Werte zum Übernehmen: nur Zeilen, bei denen der Ausweiswert gewählt ist und sich vom vorhandenen unterscheidet
export function chosenValues(rows: IdComparisonRow[], choice: Partial<Record<IdField, boolean>>): Partial<Record<IdField, string>> {
  const out: Partial<Record<IdField, string>> = {}
  for (const r of rows) if (r.read !== null && r.state !== 'same' && choice[r.field]) out[r.field] = r.read
  return out
}

export const initialChoice = (rows: IdComparisonRow[]): Partial<Record<IdField, boolean>> =>
  Object.fromEntries(rows.map((r) => [r.field, r.preselect]))

// Test-Leser (nur Dev/Test, Umgebungsvariable ID_READING_FAKE=1): feste Ergebnisse statt KI. Der Nachname im Formular wählt
// den Fall: enthält er „Fehler“ → Dienst nicht erreichbar, „Kein“ → kein Ausweis erkannt, „Unsicher“ → Dokument-ID unsicher.
// Sonst liest er den Muster-Personalausweis „Erika Mustermann“.
export type FakeOutcome = { ok: true; read: IdReadValues } | { ok: false; error: 'unavailable' | 'noDocument' }

export function fakeIdReading(current: IdCurrentValues): FakeOutcome {
  const name = current.lastName.toLocaleLowerCase('de')
  if (name.includes('fehler')) return { ok: false, error: 'unavailable' }
  if (name.includes('kein')) return { ok: false, error: 'noDocument' }
  const sure = (value: string) => ({ value, certain: true })
  return {
    ok: true,
    read: {
      lastName: sure('MUSTERMANN'),
      firstName: sure('ERIKA'),
      birthDate: sure('1983-08-12'),
      gender: sure('female'),
      country: sure('DE'),
      documentType: sure('id_card'),
      documentNumber: { value: 'LZ6311T47', certain: !name.includes('unsicher') },
      documentIssuedOn: sure('2021-08-02'),
      documentAuthority: sure('Stadt Köln'),
      documentCountry: sure('DE'),
    },
  }
}
