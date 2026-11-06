// Rechnung als fertige Daten für den PDF-Arbeitsprozess (PROJ-41): Alle Texte sind übersetzt und formatiert, Platzhalter
// ersetzt. Die Vorlage legt nur noch aus; so kommt der Arbeitsprozess ohne Datenbank, Sitzung und Übersetzungen aus.

import type { IssueChecks } from '@/lib/invoice-issue'
import type { LetterheadValues } from '@/lib/letterhead'
import type { RichDoc } from '@/lib/rich-text'

export type PdfLine = { text: string; bold?: boolean }
export type PdfRow = { label: string; amount: string; bold?: boolean; indent?: boolean; note?: string }

export type PdfView = {
  title: string
  letterhead: LetterheadValues
  // Aufdruck auf jeder Seite („Entwurf“, „Muster“); null bei der ausgestellten Rechnung (PROJ-42)
  mark: string | null
  logo: { data: Uint8Array; widthMm: number; heightMm: number } | null
  // null: Aussteller-Block abgeschaltet
  issuer: PdfLine[] | null
  recipient: PdfLine[]
  placeDate: string
  heading: string
  numberLine: string
  // Gutschrift (PROJ-44): „zu Rechnung … vom …“ und „Grund: …“ unter der Nummer
  references?: string[]
  periodLine: string
  guestsLine: string | null
  intro: RichDoc | null
  services: {
    rows: PdfRow[]
    // bleiben zusammen mit der letzten Zeile auf einer Seite
    totals: PdfRow[]
    note: string | null
    vatTitle: string | null
    vatRows: { label: string; amount: string }[]
  }
  smallBusinessNote: RichDoc | null
  payment: RichDoc | null
  closing: RichDoc | null
  footer: RichDoc | null
  // „Seite {page} von {pages}“
  pageOf: string
}

export type PdfResult = {
  pdf: Uint8Array
  pages: number
  footerShare: number
  footerReduced: boolean
  footerCut: boolean
  issuerOverflow: boolean
  // Zeichen, die die gewählte Schrift nicht darstellen kann
  missingChars: string[]
}

export type PdfMeta = {
  pages: number
  // Anteil der Fußzeile an der Seitenhöhe (0–1)
  footerShare: number
  logoReduced: boolean
  logoBlurry: boolean
  logoFailed: boolean
  // Fußzeile verkleinert, damit Platz für den Inhalt bleibt
  footerReduced: boolean
  // Fußzeile passt auch in der kleinsten Größe nicht und wurde gekürzt (sperrt das Ausstellen, PROJ-42)
  footerCut: boolean
  // Aussteller-Block passt auch in der kleinsten Größe nicht ganz in den Kopf
  issuerOverflow: boolean
  missingChars: string[]
  // Prüfliste der Seite „Rechnung ausstellen“ (PROJ-42)
  issue?: IssueChecks
}

export const PDF_META_HEADER = 'x-pdf-meta'
