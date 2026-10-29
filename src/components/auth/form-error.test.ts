import { describe, expect, it, vi } from 'vitest'

import { callAction, redirectTarget } from './form-error'

// Weiterleitung aus einer Server-Aktion, wie Next.js sie an den Aufrufer weiterreicht
const redirectError = (target: string) => Object.assign(new Error('NEXT_REDIRECT'), { digest: `NEXT_REDIRECT;push;${target};303;` })

describe('redirectTarget', () => {
  it('liest das Ziel aus einer Next.js-Weiterleitung', () => {
    expect(redirectTarget(redirectError('/buchungen/0b6f6c1e-1d3a-4e0b-9a51-6a0f1c2d3e4f'))).toBe('/buchungen/0b6f6c1e-1d3a-4e0b-9a51-6a0f1c2d3e4f')
  })

  it('erkennt andere Fehler nicht als Weiterleitung', () => {
    expect(redirectTarget(new Error('fetch failed'))).toBeNull()
    expect(redirectTarget({ digest: 'NEXT_NOT_FOUND' })).toBeNull()
    expect(redirectTarget({ digest: 42 })).toBeNull()
    expect(redirectTarget(null)).toBeNull()
    expect(redirectTarget('NEXT_REDIRECT;push;/x;303;')).toBeNull()
  })
})

describe('callAction', () => {
  it('meldet eine Weiterleitung aus der Aktion als Erfolg mit Ziel', async () => {
    await expect(callAction(() => Promise.reject(redirectError('/buchungen/abc')))).resolves.toEqual({ ok: true, redirectTo: '/buchungen/abc' })
  })

  it('meldet andere Fehler weiterhin als Netzwerkfehler', async () => {
    await expect(callAction(() => Promise.reject(new Error('fetch failed')))).resolves.toEqual({ ok: false, error: 'network' })
  })

  it('reicht normale Ergebnisse unverändert durch', async () => {
    const fn = vi.fn().mockResolvedValue({ ok: true, data: { id: '1' } })
    await expect(callAction(fn)).resolves.toEqual({ ok: true, data: { id: '1' } })
  })
})
