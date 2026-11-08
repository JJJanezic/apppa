// Gästeblatt als fertige Daten für den PDF-Arbeitsprozess (PROJ-26): Alle Texte sind übersetzt und formatiert, die Vorlage
// legt nur noch aus (wie Rechnung und Ortstaxen-Bericht).

import type { Gender } from '@/lib/guests'
import type { RichDoc } from '@/lib/rich-text'

export const GUEST_SHEET_PDF_KIND = 'guestSheet'

// Datum in den drei Kästchen „Tag Monat Jahr“ wie auf dem Formular
export type PdfDay = { day: string; month: string; year: string }

export type GuestSheetPdfView = {
  kind: typeof GUEST_SHEET_PDF_KIND
  title: string
  // Beschriftungen in der Reihenfolge des Formulars (übersetzt)
  labels: Record<string, string>
  // Geschlecht: Beschriftungen je Wert und gewählter Wert
  genders: { value: Gender; label: string }[]
  sheetNumber: string
  establishment: string
  guest: {
    lastName: string
    firstNames: string
    gender: Gender
    birthDate: string
    nationality: string
    // eine Zeile „Reisepass; Nr. …; ausgestellt …; Behörde; Staat“ oder leer (Inländer)
    document: string
    street: string
    postalCode: string
    city: string
    country: string
  }
  companions: { lastName: string; firstNames: string; birthDate: string }[]
  arrival: PdfDay
  plannedDeparture: PdfDay
  // leer bis zur Abreise bzw. bis zum Nachtrag
  actualDeparture: PdfDay | null
  // „Abreise nachgetragen am … von …“ bzw. „(automatisch)“
  departureNote: string | null
  // PNG als data:-Adresse und „Unterschrieben am …“
  signature1: { image: string; signedAt: string }
  privacyTitle: string
  privacy: RichDoc
  marketingTitle: string
  marketing: RichDoc
  consentLabel: string
  consent: boolean
  signature2: { image: string; signedAt: string; label: string }
  // „Gästeblatt · Lfd.-Nr. … · Seite {page} von {pages}“
  footer: string
}

export type GuestSheetPdfResult = { pdf: Uint8Array; pages: number }
