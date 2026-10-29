// Kleinunternehmer-Status (PROJ-36): Verlauf der Statuswechsel eines Kunden und die Regel, welcher Status
// für einen Tag bzw. eine Buchung gilt. Reine Rechenregeln für Browser und Server, ohne Datenbankzugriff.
// Genutzt von den Stammdaten (Zeile „Aktuell“, Kennzeichen „geplant“) und PROJ-35 (USt-Angaben ausblenden).

import { todayIso } from '@/lib/bookings'

// Ein Eintrag „ab validFrom gilt: Kleinunternehmer ja/nein“; validFrom ist ein Kalendertag („2026-07-01“)
export type VatStatusChange = { validFrom: string; smallBusiness: boolean }

// Werte der Statusauswahl im Formular: small = Kleinunternehmer, regular = mit Umsatzsteuer
export const VAT_STATUS_KEYS = ['small', 'regular'] as const

// Spalten der Tabelle vat_status_changes (eingebettet in die Abfrage der Kundentabelle)
export type VatStatusChangeRow = { valid_from: string; small_business: boolean }

export const vatStatusFromRows = (rows: VatStatusChangeRow[]): VatStatusChange[] =>
  sortVatStatus(rows.map((r) => ({ validFrom: r.valid_from, smallBusiness: r.small_business })))

// Neueste zuerst (Anzeige der Liste)
export const sortVatStatus = (changes: VatStatusChange[]): VatStatusChange[] =>
  [...changes].sort((a, b) => b.validFrom.localeCompare(a.validFrom))

export type VatStatus = {
  smallBusiness: boolean
  // „ab“-Datum des maßgeblichen Eintrags; null = kein Eintrag, Ausgangszustand „mit Umsatzsteuer“
  since: string | null
}

// Status an einem Kalendertag: jüngster Eintrag am oder vor dem Tag, sonst „mit Umsatzsteuer“
export function vatStatusOn(changes: VatStatusChange[], day: string): VatStatus {
  let match: VatStatusChange | null = null
  for (const c of changes) {
    if (c.validFrom <= day && (!match || c.validFrom > match.validFrom)) match = c
  }
  return match ? { smallBusiness: match.smallBusiness, since: match.validFrom } : { smallBusiness: false, since: null }
}

// Maßgeblicher Tag einer Buchung: bei Storno der Stornotag in österreichischer Zeit, sonst die Abreise.
// departure ist seit PROJ-30 die tatsächliche Abreise (bzw. die geplante, wenn nicht vorgezogen).
export function vatStatusDay(booking: { departure: string; cancelledAt?: string | null }): string {
  return booking.cancelledAt ? todayIso(new Date(booking.cancelledAt)) : booking.departure
}

export const vatStatusForBooking = (
  changes: VatStatusChange[],
  booking: { departure: string; cancelledAt?: string | null }
): VatStatus => vatStatusOn(changes, vatStatusDay(booking))

// Künftiger Wechsel (Kennzeichen „geplant“)
export const isPlannedChange = (change: { validFrom: string }, today: string = todayIso()): boolean =>
  change.validFrom > today
