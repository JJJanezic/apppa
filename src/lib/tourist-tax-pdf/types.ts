// Ortstaxen-Bericht als fertige Daten für den PDF-Arbeitsprozess (PROJ-16): Alle Texte sind übersetzt und formatiert.
// Die Vorlage legt nur noch aus (wie bei der Rechnung, PROJ-41).

import type { PdfLine } from '@/lib/invoice-pdf/types'
import type { LetterheadValues } from '@/lib/letterhead'

export const TAX_REPORT_PDF_KIND = 'touristTaxReport'

// Zeile der Übersicht: Gemeinde bzw. „Gesamt“, drei Werte, Hinweis „inkl. N Positionen …“
export type TaxPdfSummaryRow = { label: string; cells: [string, string, string]; note: string | null; bold?: boolean }

export type TaxPdfSection = {
  // Gemeindename
  title: string
  // Übersichtszeile der Gemeinde (nur bei „Alle Gemeinden“, dort steht sie über der Liste)
  summary: TaxPdfSummaryRow | null
  // je Buchung neun Zellen in der Reihenfolge von TaxPdfView.columns
  rows: string[][]
}

export type TaxPdfView = {
  kind: typeof TAX_REPORT_PDF_KIND
  title: string
  letterhead: LetterheadValues
  logo: { data: Uint8Array; widthMm: number; heightMm: number } | null
  // null: Aussteller-Block abgeschaltet
  issuer: PdfLine[] | null
  heading: string
  // Zeitraum, Gemeinde, Kunde mit Anschrift
  meta: string[]
  // „Zeitraum noch nicht abgeschlossen …“
  notice: string | null
  summary: { title: string; columns: [string, string, string, string]; rows: TaxPdfSummaryRow[] }
  // Überschrift der Buchungsliste („Buchungen“) und Spaltenköpfe
  bookingsTitle: string
  columns: string[]
  sections: TaxPdfSection[]
  // jede Gemeinde auf neuer Seite (bei „Alle Gemeinden“)
  pagePerSection: boolean
  // „Stand: So, 08.11.2026, 14:32“
  stand: string
  // „Seite {page} von {pages}“
  pageOf: string
}

export type TaxPdfResult = { pdf: Uint8Array; pages: number }
