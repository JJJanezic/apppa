// Bankkonten des Kunden und booking.com Hotel-ID der Wohnung (PROJ-46): Grenzen, Prüf- und Anzeigeregeln.
// Gilt im Browser und auf dem Server. IBAN/BIC prüft ibantools (Länderlängen, Prüfziffer, BIC-Format).

import { isValidBIC, validateIBAN, ValidationErrorsIBAN } from 'ibantools'

export const BANK_ACCOUNT_LIMITS = {
  labelMax: 100,
  holderMax: 200,
  bankNameMax: 100,
  noteMax: 500,
  // Konten je Kunde (aktiv und archiviert); gleicher Wert in der Datenbank-Funktion
  accountsMax: 20,
} as const

// Auswahl „Primäres Konto“ bei der Wohnung; gespeichert wird dafür kein Verweis (null)
export const PRIMARY_ACCOUNT = 'primary'

export type BankAccount = {
  id: string
  label: string | null
  accountHolder: string
  // ohne Leerzeichen, Großbuchstaben
  iban: string
  bic: string | null
  bankName: string | null
  note: string | null
  primary: boolean
  archived: boolean
  // Wohnungen, die das Konto fest verwenden („Objekt · Wohnung“), auch archivierte
  usedBy: string[]
}

export type BankAccountRow = {
  id: string
  label: string | null
  account_holder: string
  iban: string
  bic: string | null
  bank_name: string | null
  note: string | null
  is_primary: boolean
  archived_at: string | null
  position: number
  apartments: { name: string; property: { name: string } | null }[]
}

// Reihenfolge der Anzeige: primär oben, dann aktive in der Reihenfolge des Anlegens, archivierte unten
const rank = (a: { primary: boolean; archived: boolean }) => (a.primary ? 0 : a.archived ? 2 : 1)

export function bankAccountsFromRows(rows: BankAccountRow[]): BankAccount[] {
  return [...rows]
    .sort((a, b) => a.position - b.position)
    .map((r) => ({
      id: r.id,
      label: r.label,
      accountHolder: r.account_holder,
      iban: r.iban,
      bic: r.bic,
      bankName: r.bank_name,
      note: r.note,
      primary: r.is_primary,
      archived: r.archived_at !== null,
      usedBy: r.apartments
        .map((a) => (a.property ? `${a.property.name} · ${a.name}` : a.name))
        .sort((x, y) => x.localeCompare(y, 'de', { numeric: true })),
    }))
    .sort((a, b) => rank(a) - rank(b))
}

// IBAN und BIC: Leerzeichen raus, Großbuchstaben
export const normalizeIban = (value: string) => value.replace(/\s+/g, '').toUpperCase()
export const normalizeBic = normalizeIban

export type IbanProblem = 'country' | 'length' | 'checksum' | 'format'

// null = gültig; sonst der wichtigste Fehler für eine verständliche Meldung
export function ibanProblem(value: string): IbanProblem | null {
  const iban = normalizeIban(value)
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(iban)) return 'format'
  const { valid, errorCodes } = validateIBAN(iban)
  if (valid) return null
  if (errorCodes.includes(ValidationErrorsIBAN.NoIBANCountry)) return 'country'
  if (errorCodes.includes(ValidationErrorsIBAN.WrongBBANLength)) return 'length'
  if (errorCodes.includes(ValidationErrorsIBAN.WrongIBANChecksum)) return 'checksum'
  return 'format'
}

// 8 oder 11 Zeichen, Format und Länderkürzel; kein Abgleich mit der IBAN
export const isBic = (value: string) => /^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(value) && isValidBIC(value)

// „AT61 1904 3002 3457 3201“
export const formatIban = (iban: string) => normalizeIban(iban).replace(/(.{4})(?=.)/g, '$1 ')

// „AT61 1904 … 3201“ für die Auswahl „Primäres Konto“
export function shortIban(iban: string): string {
  const v = normalizeIban(iban)
  if (v.length <= 12) return formatIban(v)
  return `${v.slice(0, 4)} ${v.slice(4, 8)} … ${v.slice(-4)}`
}

// Bezeichnung, sonst Name der Bank, sonst IBAN
export const accountDisplayName = (a: { label: string | null; bankName: string | null; iban: string }) =>
  a.label?.trim() || a.bankName?.trim() || formatIban(a.iban)

// booking.com Hotel-ID (PROJ-46): außen getrimmt; Buchstaben, Ziffern, Bindestrich; 1–30 Zeichen (gleiche Regel in der Datenbank)
export const HOTEL_ID_MAX = 30
export const isHotelId = (value: string) => /^[A-Za-z0-9-]{1,30}$/.test(value)

// Konto für die Auswahl bei der Wohnung (nur aktive)
export type BankAccountOption = { id: string; iban: string; label: string | null; bankName: string | null; primary: boolean }
