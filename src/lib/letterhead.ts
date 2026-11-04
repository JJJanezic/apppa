// Briefpapier (PROJ-41): Werte und Regeln für Browser, Server und den PDF-Arbeitsprozess. Die Reihenfolge der Bereiche
// auf der Rechnung ist fest, einstellbar sind nur diese Einzelwerte.

import { RICH_FONTS, type RichFont } from '@/lib/rich-text'

export const LETTERHEAD_SPACINGS = ['tight', 'normal', 'wide'] as const
export type LetterheadSpacing = (typeof LETTERHEAD_SPACINGS)[number]

export const LOGO_POSITIONS = ['left', 'center', 'right'] as const
export type LogoPosition = (typeof LOGO_POSITIONS)[number]

export type LetterheadValues = {
  fontFamily: RichFont
  fontSize: number
  lineSpacing: LetterheadSpacing
  paragraphSpacing: LetterheadSpacing
  logoPosition: LogoPosition
  logoHeightMm: number
  showIssuer: boolean
}

export const DEFAULT_LETTERHEAD: LetterheadValues = {
  fontFamily: 'carlito',
  fontSize: 11,
  lineSpacing: 'normal',
  paragraphSpacing: 'normal',
  logoPosition: 'left',
  logoHeightMm: 25,
  showIssuer: true,
}

export const LETTERHEAD_FONT_SIZE = { min: 8, max: 14, step: 0.5 } as const
export const LETTERHEAD_LOGO_HEIGHT = { min: 10, max: 35 } as const

export const isLetterheadFontSize = (v: number) =>
  v >= LETTERHEAD_FONT_SIZE.min && v <= LETTERHEAD_FONT_SIZE.max && Number.isInteger(v / LETTERHEAD_FONT_SIZE.step)
export const isLetterheadLogoHeight = (v: number) => Number.isInteger(v) && v >= LETTERHEAD_LOGO_HEIGHT.min && v <= LETTERHEAD_LOGO_HEIGHT.max

export const sameLetterhead = (a: LetterheadValues, b: LetterheadValues) =>
  (Object.keys(DEFAULT_LETTERHEAD) as (keyof LetterheadValues)[]).every((k) => a[k] === b[k])

// Gespeicherte Werte sind von der Datenbank geprüft; unbekannte Werte fallen trotzdem auf den Standard zurück
export function letterheadFromDb(row: {
  font?: unknown
  font_size?: unknown
  line_spacing?: unknown
  paragraph_spacing?: unknown
  logo_position?: unknown
  logo_height_mm?: unknown
  show_issuer?: unknown
} | null | undefined): LetterheadValues {
  const d = DEFAULT_LETTERHEAD
  const size = Number(row?.font_size)
  const height = Number(row?.logo_height_mm)
  return {
    fontFamily: RICH_FONTS.includes(row?.font as RichFont) ? (row?.font as RichFont) : d.fontFamily,
    fontSize: isLetterheadFontSize(size) ? size : d.fontSize,
    lineSpacing: LETTERHEAD_SPACINGS.includes(row?.line_spacing as LetterheadSpacing) ? (row?.line_spacing as LetterheadSpacing) : d.lineSpacing,
    paragraphSpacing: LETTERHEAD_SPACINGS.includes(row?.paragraph_spacing as LetterheadSpacing)
      ? (row?.paragraph_spacing as LetterheadSpacing)
      : d.paragraphSpacing,
    logoPosition: LOGO_POSITIONS.includes(row?.logo_position as LogoPosition) ? (row?.logo_position as LogoPosition) : d.logoPosition,
    logoHeightMm: isLetterheadLogoHeight(height) ? height : d.logoHeightMm,
    showIssuer: typeof row?.show_issuer === 'boolean' ? row.show_issuer : d.showIssuer,
  }
}

// ---- Seitenaufbau ------------------------------------------------------------------------------------
// Maße an einer Stelle. Das Adressfeld stammt vorläufig aus DIN 676 (ÖNORM A 1080 nicht belegt); Drucktest vor dem Deploy.
export const PAGE_LAYOUT = {
  marginXMm: 20,
  headTopMm: 8,
  headHeightMm: 35,
  addressTopMm: 45,
  addressHeightMm: 45,
  addressWidthMm: 85,
  // Oberer Rand ab Seite 2 (dort stehen Kopf und Adressfeld nicht mehr)
  pageTopMm: 18,
  footerBottomMm: 8,
  textWidthMm: 170,
  // Logo neben dem Aussteller-Block
  logoSideMaxWidthMm: 95,
  // Höhe des zweizeiligen Aussteller-Blocks unter einem mittigen Logo, samt Abstand
  centeredIssuerHeightMm: 9,
  issuerMaxPt: 10,
  addressMaxPt: 11,
} as const

export const LINE_HEIGHT: Record<LetterheadSpacing, number> = { tight: 1.15, normal: 1.3, wide: 1.5 }
export const PARAGRAPH_GAP_PT: Record<LetterheadSpacing, number> = { tight: 3, normal: 6, wide: 10 }

// Unter dieser Auflösung in der tatsächlichen Druckgröße gilt ein Logo als unscharf
export const LOGO_MIN_DPI = 150

export type LogoBox = { widthMm: number; heightMm: number; reduced: boolean; blurry: boolean }

// Tatsächliche Größe des Logos: Eingestellte Höhe, begrenzt durch den Platz im Kopf; Seitenverhältnis bleibt erhalten
export function logoBox(
  image: { widthPx: number; heightPx: number },
  v: Pick<LetterheadValues, 'logoPosition' | 'logoHeightMm' | 'showIssuer'>
): LogoBox {
  const p = PAGE_LAYOUT
  const centered = v.logoPosition === 'center'
  const maxHeight = centered && v.showIssuer ? p.headHeightMm - p.centeredIssuerHeightMm : p.headHeightMm
  const maxWidth = centered || !v.showIssuer ? p.textWidthMm : p.logoSideMaxWidthMm
  const ratio = image.widthPx / image.heightPx
  let heightMm = Math.min(v.logoHeightMm, maxHeight)
  let widthMm = heightMm * ratio
  if (widthMm > maxWidth) {
    widthMm = maxWidth
    heightMm = widthMm / ratio
  }
  const dpi = image.heightPx / (heightMm / 25.4)
  return { widthMm, heightMm, reduced: heightMm < v.logoHeightMm - 0.01, blurry: dpi < LOGO_MIN_DPI }
}
