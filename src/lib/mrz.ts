// Maschinenlesbare Zone (MRZ) von Reisedokumenten nach ICAO 9303 (PROJ-51): Pass (TD3, 2 × 44 Zeichen), Personalausweis
// (TD1, 3 × 30) und ältere Ausweise/Visa (TD2, 2 × 36). Ausgewertet werden nur Dokumentnummer, Geburtsdatum und Geschlecht
// samt Prüfziffern – damit prüft die App die von der KI gelesenen Werte (ohne KI, kostenlos, nachvollziehbar).

export type MrzData = {
  format: 'TD1' | 'TD2' | 'TD3'
  documentNumber: string
  documentNumberValid: boolean
  // JJJJ-MM-TT; null, wenn nicht als Datum lesbar
  birthDate: string | null
  birthDateValid: boolean
  sex: 'female' | 'male' | null
}

const value = (ch: string): number => {
  if (ch >= '0' && ch <= '9') return ch.charCodeAt(0) - 48
  if (ch >= 'A' && ch <= 'Z') return ch.charCodeAt(0) - 55
  return 0 // '<' und alles andere
}

// Prüfziffer: Gewichte 7, 3, 1 im Wechsel, Summe modulo 10
export function checkDigit(text: string): number {
  let sum = 0
  for (let i = 0; i < text.length; i++) sum += value(text[i]) * [7, 3, 1][i % 3]
  return sum % 10
}

const valid = (field: string, digit: string) => /^[0-9]$/.test(digit) && checkDigit(field) === Number(digit)

// JJMMTT → JJJJ-MM-TT; Jahrhundert: liegt das Jahr nach dem laufenden, gilt 19xx
export function mrzDate(yymmdd: string, today = new Date()): string | null {
  if (!/^\d{6}$/.test(yymmdd)) return null
  const yy = Number(yymmdd.slice(0, 2))
  const mm = Number(yymmdd.slice(2, 4))
  const dd = Number(yymmdd.slice(4, 6))
  const year = yy > today.getUTCFullYear() % 100 ? 1900 + yy : 2000 + yy
  const date = new Date(Date.UTC(year, mm - 1, dd))
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== mm - 1 || date.getUTCDate() !== dd) return null
  return `${year}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
}

const sexOf = (c: string): MrzData['sex'] => (c === 'F' ? 'female' : c === 'M' ? 'male' : null)
const clean = (line: string) => line.toUpperCase().replace(/[«‹]/g, '<').replace(/\s+/g, '')

// Zeilen der MRZ (wie gelesen, in Reihenfolge) → Daten; null, wenn kein bekanntes Format
export function parseMrz(lines: readonly string[], today = new Date()): MrzData | null {
  const l = lines.map(clean).filter((x) => x.length > 0)
  const number = (raw: string) => raw.replace(/<+$/, '')

  if (l.length === 3 && l.every((x) => x.length === 30)) {
    // TD1: Zeile 1 Art, Staat, Nummer, Prüfziffer; Zeile 2 Geburt, Prüfziffer, Geschlecht …
    const [a, b] = l
    return {
      format: 'TD1',
      documentNumber: number(a.slice(5, 14)),
      documentNumberValid: valid(a.slice(5, 14), a[14]),
      birthDate: mrzDate(b.slice(0, 6), today),
      birthDateValid: valid(b.slice(0, 6), b[6]),
      sex: sexOf(b[7]),
    }
  }
  if (l.length === 2 && (l.every((x) => x.length === 44) || l.every((x) => x.length === 36))) {
    // TD3/TD2: Zeile 2 Nummer, Prüfziffer, Staatsangehörigkeit, Geburt, Prüfziffer, Geschlecht …
    const b = l[1]
    return {
      format: b.length === 44 ? 'TD3' : 'TD2',
      documentNumber: number(b.slice(0, 9)),
      documentNumberValid: valid(b.slice(0, 9), b[9]),
      birthDate: mrzDate(b.slice(13, 19), today),
      birthDateValid: valid(b.slice(13, 19), b[19]),
      sex: sexOf(b[20]),
    }
  }
  return null
}
