import { describe, expect, it } from 'vitest'

import { fitWithin } from './document-image'
import { isLogoFile, isLogoPath, isLogoPathOf, isSmallLogo, LOGO_MAX_EDGE } from './tenant-logo'

const A = '11111111-2222-4333-8444-555555555555'
const B = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'

describe('isLogoFile', () => {
  it('akzeptiert PNG, JPEG, WebP, GIF und HEIC', () => {
    expect(isLogoFile('logo.png', 'image/png')).toBe(true)
    expect(isLogoFile('logo.jpg', 'image/jpeg')).toBe(true)
    expect(isLogoFile('logo.webp', 'image/webp')).toBe(true)
    expect(isLogoFile('logo.gif', 'image/gif')).toBe(true)
    expect(isLogoFile('IMG_0001.HEIC', 'image/heic')).toBe(true)
  })

  it('erkennt erlaubte Dateien an der Endung, wenn der Browser keinen Typ kennt', () => {
    expect(isLogoFile('IMG_0001.heic', '')).toBe(true)
    expect(isLogoFile('logo.PNG', 'application/octet-stream')).toBe(true)
  })

  it('lehnt SVG, PDF, BMP und TIFF ab', () => {
    expect(isLogoFile('logo.svg', 'image/svg+xml')).toBe(false)
    expect(isLogoFile('logo.pdf', 'application/pdf')).toBe(false)
    expect(isLogoFile('logo.bmp', 'image/bmp')).toBe(false)
    expect(isLogoFile('logo.tif', 'image/tiff')).toBe(false)
    expect(isLogoFile('logo.svg', '')).toBe(false)
  })
})

describe('Logo-Größe', () => {
  it('verkleinert auf 1.000 Pixel an der längsten Seite, Seitenverhältnis bleibt', () => {
    expect(fitWithin(4000, 300, LOGO_MAX_EDGE)).toEqual({ width: 1000, height: 75 })
    expect(fitWithin(1200, 2400, LOGO_MAX_EDGE)).toEqual({ width: 500, height: 1000 })
  })

  it('vergrößert kleine Logos nicht', () => {
    expect(fitWithin(200, 80, LOGO_MAX_EDGE)).toEqual({ width: 200, height: 80 })
  })

  it('meldet ein kleines Logo nur nach der längeren Seite', () => {
    expect(isSmallLogo(299, 100)).toBe(true)
    expect(isSmallLogo(300, 40)).toBe(false)
    expect(isSmallLogo(1000, 75)).toBe(false)
  })
})

describe('Speicherort', () => {
  it('akzeptiert <Kunde>/<zufällig>.png', () => {
    expect(isLogoPath(`${A}/${B}.png`)).toBe(true)
  })

  it('lehnt andere Formate ab', () => {
    expect(isLogoPath(`${A}/${B}.jpg`)).toBe(false)
    expect(isLogoPath(`${B}.png`)).toBe(false)
    expect(isLogoPath(`${A}/../${B}.png`)).toBe(false)
  })

  it('prüft den Ordner des Kunden', () => {
    expect(isLogoPathOf(`${A}/${B}.png`, A)).toBe(true)
    expect(isLogoPathOf(`${B}/${A}.png`, A)).toBe(false)
  })
})
