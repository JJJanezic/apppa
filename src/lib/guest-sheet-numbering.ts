// Gästeblattnummer und Kennzahl je Gemeinde (PROJ-26, Erweiterung 2026-11-09). Eine Stelle für die Regeln, die
// Formulare, Vorschau und Hinweise brauchen; maßgeblich beim Speichern und bei der Vergabe ist die gleiche Regel in der
// Datenbank (gemeinsame Testfälle in guest-sheet-numbering.test.ts).
//
// Nummer: Text aus Buchstaben, Ziffern, „-“, „/“, „.“, höchstens 30 Zeichen. Weitergezählt werden die Ziffern am Ende,
// die Stellenzahl mit führenden Nullen bleibt: 0042 → 0043, A-0099 → A-0100, 9999 → 10000.

export const SHEET_CODE_MAX = 30
export const SHEET_CODE_PATTERN = /^[A-Za-z0-9\-/.]+$/
// Ab so wenigen freien Nummern (über alle Bereiche einer Gemeinde) erscheint die Frühwarnung
export const NUMBERS_LOW_AT = 10

export type ParsedSheetNumber = { prefix: string; digits: string; value: bigint }

// Vorsatz und Ziffern am Ende; null, wenn die Nummer nicht mit einer Ziffer endet oder Zeichen außerhalb der Regel hat
export function parseSheetNumber(raw: string): ParsedSheetNumber | null {
  const s = raw.trim()
  if (!s || s.length > SHEET_CODE_MAX || !SHEET_CODE_PATTERN.test(s)) return null
  const m = /^(.*?)(\d+)$/.exec(s)
  if (!m) return null
  return { prefix: m[1], digits: m[2], value: BigInt(m[2]) }
}

// Gleicher Vorsatz ohne Rücksicht auf Groß-/Kleinschreibung
export const samePrefix = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

// Gleiche Nummer: Groß-/Kleinschreibung zählt gleich, führende Nullen zählen mit
export const sameSheetNumber = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

// Nummer mit gegebenem Zahlenwert in der Stellenzahl von digits (wächst bei Bedarf)
export function formatSheetNumber(prefix: string, value: bigint, width: number): string {
  return `${prefix}${value.toString().padStart(width, '0')}`
}

// Nächste Nummer nach raw (Vorsatz und Stellenzahl bleiben); null bei ungültiger Nummer
export function incrementSheetNumber(raw: string): string | null {
  const p = parseSheetNumber(raw)
  return p ? formatSheetNumber(p.prefix, p.value + BigInt(1), p.digits.length) : null
}

export type NumberRange = { from: string; to: string }

// Liegt die Nummer im Bereich? Gleicher Vorsatz, Zahlenwert zwischen „von“ und „bis“
export function inRange(number: string, range: NumberRange): boolean {
  const n = parseSheetNumber(number)
  const f = parseSheetNumber(range.from)
  const t = parseSheetNumber(range.to)
  if (!n || !f || !t || !samePrefix(n.prefix, f.prefix)) return false
  return n.value >= f.value && n.value <= t.value
}

export type RangeIssue = 'fromInvalid' | 'toInvalid' | 'prefixDiffers' | 'fromAfterTo' | 'overlaps' | 'nextInvalid' | 'nextOutside' | 'toBelowUsed'

// Prüfung eines Bereichs gegen die anderen Bereiche derselben Gemeinde; next nur beim Bereich in Verwendung,
// lastIssued = zuletzt vergebene Nummer dieses Bereichs („bis“ darf nicht darunter)
export function checkRange(
  range: NumberRange & { next?: string | null },
  others: NumberRange[],
  lastIssued: string | null = null
): { field: 'from' | 'to' | 'next'; issue: RangeIssue } | null {
  const f = parseSheetNumber(range.from)
  if (!f) return { field: 'from', issue: 'fromInvalid' }
  const t = parseSheetNumber(range.to)
  if (!t) return { field: 'to', issue: 'toInvalid' }
  if (!samePrefix(f.prefix, t.prefix)) return { field: 'to', issue: 'prefixDiffers' }
  if (f.value > t.value) return { field: 'to', issue: 'fromAfterTo' }
  for (const o of others) {
    const of = parseSheetNumber(o.from)
    const ot = parseSheetNumber(o.to)
    if (!of || !ot || !samePrefix(of.prefix, f.prefix)) continue
    if (f.value <= ot.value && of.value <= t.value) return { field: 'from', issue: 'overlaps' }
  }
  if (lastIssued) {
    const l = parseSheetNumber(lastIssued)
    if (l && samePrefix(l.prefix, t.prefix) && t.value < l.value) return { field: 'to', issue: 'toBelowUsed' }
  }
  if (range.next !== undefined && range.next !== null && range.next.trim() !== '') {
    if (!parseSheetNumber(range.next)) return { field: 'next', issue: 'nextInvalid' }
    if (!inRange(range.next, range)) return { field: 'next', issue: 'nextOutside' }
  }
  return null
}

// Anzahl Nummern von a bis b (beide eingeschlossen); 0, wenn a > b
export function countBetween(from: string, to: string): number {
  const f = parseSheetNumber(from)
  const t = parseSheetNumber(to)
  if (!f || !t || f.value > t.value) return 0
  return Number(t.value - f.value + BigInt(1))
}

// ---- Stand je Gemeinde (aus der Lesesicht der Datenbank) -------------------------------------------------

export type RangeState = 'active' | 'queued' | 'exhausted'

export type SheetNumberRange = {
  id: string
  from: string
  to: string
  // nur beim Bereich in Verwendung; folgende Bereiche beginnen mit „von“
  next: string | null
  state: RangeState
  exhaustedAt: string | null
  // zuletzt vergebene Nummer dieses Bereichs (Grenze für „bis“)
  lastIssued: string | null
  updatedAt: string
}

export type NumberingState = 'ok' | 'low' | 'exhausted' | 'unset'

export type MunicipalityNumbering = {
  code: string
  name: string
  // nächste Nummer, die beim „Fertig“ vergeben würde (belegte übersprungen); null ohne freie Nummer
  next: string | null
  free: number
  state: NumberingState
  ranges: SheetNumberRange[]
}

// Zustand aus der Zahl freier Nummern und ob es je einen Bereich gab
export function numberingState(free: number, hasRanges: boolean): NumberingState {
  if (!hasRanges) return 'unset'
  if (free <= 0) return 'exhausted'
  return free <= NUMBERS_LOW_AT ? 'low' : 'ok'
}

// Hinweis nötig (Einstellungen, Buchungsdetail, Dashboard)?
export const needsNumberNotice = (s: NumberingState) => s !== 'ok'

// Kann für eine Buchung ein Gästeblatt fertiggestellt werden? Mit vorhandener Nummer immer, sonst nur mit freier Nummer
export const canIssueSheet = (bookingNumber: string | null, state: NumberingState | null) =>
  Boolean(bookingNumber) || state === 'ok' || state === 'low'
