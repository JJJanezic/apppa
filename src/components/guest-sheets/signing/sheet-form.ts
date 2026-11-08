import { SHEET_GUEST_FIELDS, type SheetCompanion, type SheetGuest, type SheetGuestField } from '@/lib/guest-sheet'
import type { SigningData } from '@/lib/guest-sheets-data'
import type { Gender } from '@/lib/guests'

// Formularwerte der Seite 1 (PROJ-26): Felder des Hauptgasts als Text, dazu Lfd.-Nr. und Mitreisende der Buchung.
// „Von der Ortstaxe befreit“ der Mitreisenden ist nicht sichtbar, geht aber beim Speichern unverändert mit.
export type SheetForm = Record<Exclude<SheetGuestField, 'gender'>, string> & {
  gender: Gender
  sheetNumber: string
  companions: { lastName: string; firstName: string; birthDate: string; taxExempt: boolean }[]
}

export function initialSheetForm(d: SigningData): SheetForm {
  const g = d.guest!
  const guest = Object.fromEntries(SHEET_GUEST_FIELDS.map((f) => [f, (g[f] as string | null) ?? ''])) as Record<SheetGuestField, string>
  return {
    ...guest,
    gender: g.gender,
    sheetNumber: d.booking.sheetNumber ?? '',
    companions: d.companions.map((c) => ({ lastName: c.lastName, firstName: c.firstName, birthDate: c.birthDate ?? '', taxExempt: c.taxExempt })),
  }
}

const orNull = (v: string) => (v.trim() === '' ? null : v.trim())

// Für die Pflichtangaben-Regel (sheetGaps)
export function sheetGuestOf(v: SheetForm, titles: { titlePrefix: string | null; titleSuffix: string | null }): SheetGuest {
  return {
    lastName: v.lastName.trim(),
    firstName: orNull(v.firstName),
    titlePrefix: titles.titlePrefix,
    titleSuffix: titles.titleSuffix,
    gender: v.gender,
    birthDate: orNull(v.birthDate),
    country: v.country,
    documentType: orNull(v.documentType) as SheetGuest['documentType'],
    documentNumber: orNull(v.documentNumber),
    documentIssuedOn: orNull(v.documentIssuedOn),
    documentAuthority: orNull(v.documentAuthority),
    documentCountry: orNull(v.documentCountry),
    street: orNull(v.street),
    postalCode: orNull(v.postalCode),
    city: orNull(v.city),
    addressCountry: orNull(v.addressCountry),
  }
}

export const sheetCompanionsOf = (v: SheetForm): SheetCompanion[] =>
  v.companions.map((c) => ({ lastName: c.lastName.trim(), firstName: c.firstName.trim(), birthDate: orNull(c.birthDate) }))

export const sameCompanionInput = (a: SheetForm['companions'], b: SheetForm['companions']) =>
  a.length === b.length && a.every((c, i) => c.lastName === b[i].lastName && c.firstName === b[i].firstName && c.birthDate === b[i].birthDate)
