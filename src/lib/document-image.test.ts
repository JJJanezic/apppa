import { describe, expect, it } from 'vitest'

import { fitWithin, isHeicFile, looksLikeImage } from './document-image'

describe('fitWithin', () => {
  it('verkleinert auf 2.000 Pixel an der längsten Seite', () => {
    expect(fitWithin(8000, 6000)).toEqual({ width: 2000, height: 1500 })
    expect(fitWithin(3000, 4000)).toEqual({ width: 1500, height: 2000 })
  })

  it('vergrößert kleine Bilder nicht', () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 })
  })
})

describe('isHeicFile', () => {
  it('erkennt HEIC am Typ', () => {
    expect(isHeicFile('IMG_0001.HEIC', 'image/heic')).toBe(true)
    expect(isHeicFile('foto', 'image/heif')).toBe(true)
  })

  it('erkennt HEIC an der Endung, wenn der Browser keinen Typ kennt', () => {
    expect(isHeicFile('IMG_0001.heic', '')).toBe(true)
    expect(isHeicFile('IMG_0001.HEIF', 'application/octet-stream')).toBe(true)
  })

  it('hält JPEG nicht für HEIC', () => {
    expect(isHeicFile('IMG_0001.jpg', 'image/jpeg')).toBe(false)
  })
})

describe('looksLikeImage', () => {
  it('akzeptiert Bilder und HEIC ohne Typ, lehnt PDF ab', () => {
    expect(looksLikeImage('a.png', 'image/png')).toBe(true)
    expect(looksLikeImage('a.heic', '')).toBe(true)
    expect(looksLikeImage('ausweis.pdf', 'application/pdf')).toBe(false)
  })
})
