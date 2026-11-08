// Auswertung als fertige Daten für den PDF-Arbeitsprozess (PROJ-18): Alle Texte sind übersetzt und formatiert, die
// Vorlage legt nur noch aus (wie beim Ortstaxen-Bericht, PROJ-16).

import type { PdfLine } from '@/lib/invoice-pdf/types'
import type { LetterheadValues } from '@/lib/letterhead'

export const STATS_PDF_KIND = 'statistics'

export type StatsPdfKpi = { label: string; value: string; sub: string | null; previous: string }

// Diagramm: Balkenhöhen als Anteil der Achse (0–1), wie am Bildschirm (chartModel)
export type StatsPdfChart = {
  title: string
  legend: { current: string; previous: string | null }
  ticks: { share: number; label: string }[]
  bars: { label: string; current: number; previous: number | null }[]
}

// Zelle: Wert, darunter klein weitere Zeilen (USt, Vorjahr)
export type StatsPdfCell = { main: string; small: string[] }
export type StatsPdfRow = { cells: StatsPdfCell[]; bold?: boolean }
export type StatsPdfTable = {
  title: string
  note: string | null
  columns: string[]
  // Breite der ersten Spalte in pt; die übrigen teilen sich den Rest
  firstWidth: number
  // Zwischenüberschriften (Objekt) vor einzelnen Zeilen: Index der Zeile → Text
  groups: Record<number, string>
  rows: StatsPdfRow[]
}

export type StatsPdfView = {
  kind: typeof STATS_PDF_KIND
  title: string
  letterhead: LetterheadValues
  logo: { data: Uint8Array; widthMm: number; heightMm: number } | null
  // null: Aussteller-Block abgeschaltet
  issuer: PdfLine[] | null
  heading: string
  // Zeitraum, Wohnungen, Kunde
  meta: string[]
  notice: string | null
  kpis: StatsPdfKpi[]
  charts: StatsPdfChart[]
  tables: StatsPdfTable[]
  stand: string
  // „Seite {page} von {pages}“
  pageOf: string
}

export type StatsPdfResult = { pdf: Uint8Array; pages: number }
