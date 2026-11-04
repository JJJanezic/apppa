import { describe, expect, it } from 'vitest'

import { DEFAULT_LETTERHEAD, isLetterheadFontSize, isLetterheadLogoHeight, letterheadFromDb, logoBox } from '@/lib/letterhead'
import { letterheadSchema } from '@/lib/validation/letterhead'

const v = (over: Partial<typeof DEFAULT_LETTERHEAD> = {}) => ({ ...DEFAULT_LETTERHEAD, ...over })

describe('Standardwerte', () => {
  it('entsprechen der Spec', () => {
    expect(DEFAULT_LETTERHEAD).toEqual({
      fontFamily: 'carlito',
      fontSize: 11,
      lineSpacing: 'normal',
      paragraphSpacing: 'normal',
      logoPosition: 'left',
      logoHeightMm: 25,
      showIssuer: true,
    })
  })
  it('ersetzen unbekannte gespeicherte Werte', () => {
    expect(letterheadFromDb({ font: 'comic', font_size: 99, logo_height_mm: 3, line_spacing: 'x', show_issuer: 'ja' })).toEqual(DEFAULT_LETTERHEAD)
    expect(letterheadFromDb(null)).toEqual(DEFAULT_LETTERHEAD)
    expect(letterheadFromDb({ font: 'tinos', font_size: '12.5', logo_height_mm: 30, show_issuer: false })).toMatchObject({ fontFamily: 'tinos', fontSize: 12.5, logoHeightMm: 30, showIssuer: false })
  })
})

describe('Grenzen', () => {
  it('Schriftgröße 8 bis 14 in 0,5er-Schritten', () => {
    expect([8, 8.5, 14].every(isLetterheadFontSize)).toBe(true)
    expect([7.5, 14.5, 11.3].some(isLetterheadFontSize)).toBe(false)
  })
  it('Logo-Höhe 10 bis 35 in ganzen mm', () => {
    expect([10, 25, 35].every(isLetterheadLogoHeight)).toBe(true)
    expect([9, 36, 20.5].some(isLetterheadLogoHeight)).toBe(false)
  })
  it('Formular nimmt Komma an und lehnt ungültige Werte ab', () => {
    const s = letterheadSchema((k) => k)
    const base = { fontFamily: 'carlito', lineSpacing: 'normal', paragraphSpacing: 'normal', logoPosition: 'left', showIssuer: true }
    expect(s.parse({ ...base, fontSize: '11,5', logoHeightMm: '25' })).toMatchObject({ fontSize: 11.5, logoHeightMm: 25 })
    expect(s.safeParse({ ...base, fontSize: '7', logoHeightMm: '25' }).success).toBe(false)
    expect(s.safeParse({ ...base, fontSize: '11', logoHeightMm: '25,5' }).success).toBe(false)
    expect(s.safeParse({ ...base, fontSize: 'x', logoHeightMm: '25' }).success).toBe(false)
  })
})

describe('Logogröße', () => {
  const square = { widthPx: 1000, heightPx: 1000 }
  it('Standard links: eingestellte Höhe', () => {
    expect(logoBox(square, v())).toMatchObject({ widthMm: 25, heightMm: 25, reduced: false, blurry: false })
  })
  it('mittig mit Aussteller-Block: 25 mm passen, 35 mm werden kleiner', () => {
    expect(logoBox(square, v({ logoPosition: 'center' }))).toMatchObject({ heightMm: 25, reduced: false })
    expect(logoBox(square, v({ logoPosition: 'center', logoHeightMm: 35 }))).toMatchObject({ heightMm: 26, reduced: true })
    expect(logoBox(square, v({ logoPosition: 'center', logoHeightMm: 35, showIssuer: false }))).toMatchObject({ heightMm: 35, reduced: false })
  })
  it('sehr breites Logo: durch die Breite begrenzt, Seitenverhältnis bleibt', () => {
    const box = logoBox({ widthPx: 1000, heightPx: 100 }, v({ logoHeightMm: 25 }))
    expect(box.widthMm).toBe(95)
    expect(box.heightMm).toBeCloseTo(9.5)
    expect(box.reduced).toBe(true)
  })
  it('unscharf unter 150 dpi in der Druckgröße', () => {
    expect(logoBox({ widthPx: 100, heightPx: 100 }, v()).blurry).toBe(true)
    expect(logoBox({ widthPx: 200, heightPx: 200 }, v()).blurry).toBe(false)
  })
})
