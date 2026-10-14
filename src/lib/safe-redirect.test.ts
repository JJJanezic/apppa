import { describe, expect, it } from 'vitest'

import { safeRedirectPath } from './safe-redirect'

const origin = 'https://app.example'

describe('safeRedirectPath', () => {
  it.each([
    ['/', '/'],
    ['/dashboard', '/dashboard'],
    ['/buchungen?monat=2026-10#heute', '/buchungen?monat=2026-10#heute'],
    ['/a/../b', '/b'],
  ])('behält App-interne Pfade: %s', (next, expected) => {
    expect(safeRedirectPath(next, origin)).toBe(expected)
  })

  it.each([
    ['fehlt', null],
    ['leer', ''],
    ['absolute URL', 'https://evil.com'],
    ['protokoll-relativ', '//evil.com'],
    ['Backslash (BUG-1)', '/\\evil.com'],
    ['Backslash + Slash', '/\\/evil.com'],
    ['Slash + Backslash', '//\\evil.com'],
    ['Tab im Pfad', '/\t/evil.com'],
    ['Zeilenumbruch', '/\n/evil.com'],
    ['javascript:', 'javascript:alert(1)'],
    ['relativ ohne Slash', 'evil.com'],
    ['Punkt-Segment (BUG-9)', '/.//evil.com'],
    ['Doppelpunkt-Segment (BUG-9)', '/..//evil.com'],
    ['mehrere Punkt-Segmente', '/a/../..//evil.com'],
    ['kodiertes Punkt-Segment', '/%2e//evil.com'],
  ])('weist fremde Ziele ab: %s', (_, next) => {
    expect(safeRedirectPath(next, origin)).toBe('/')
  })

  it.each([
    '/\\evil.com', '/%5Cevil.com', '/%2F%2Fevil.com', '/.//evil.com', '/..//evil.com', '/@evil.com',
    '/　/evil.com', '/／／evil.com', '/;//evil.com', '/https://evil.com', '///evil.com',
  ])('Ergebnis bleibt beim erneuten Auflösen in der App: %s', (next) => {
    const result = safeRedirectPath(next, origin)
    expect(new URL(result, origin).origin).toBe(origin)
  })

  it('nutzt den angegebenen Rückfallpfad', () => {
    expect(safeRedirectPath('//evil.com', origin, '/login')).toBe('/login')
  })
})
