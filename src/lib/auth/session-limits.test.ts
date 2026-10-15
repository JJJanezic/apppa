// @vitest-environment node
import { describe, expect, it } from 'vitest'

import { checkSession, SESSION_IDLE_MS, SESSION_MAX_AGE_MS, startSession } from './session-limits'

const secret = 'test-secret'
const user = '7f9a3c1e-0000-4000-8000-000000000001'
const t0 = Date.UTC(2026, 9, 15, 8)
const hours = (h: number) => h * 60 * 60_000

describe('Sitzungsgrenzen', () => {
  it('frische Sitzung ist gültig, ohne das Cookie sofort neu zu schreiben', () => {
    expect(checkSession(startSession(user, secret, t0), user, secret, t0 + 1000)).toEqual({ status: 'ok' })
  })

  it('Aktivität verlängert die Inaktivitätsfrist', () => {
    const first = checkSession(startSession(user, secret, t0), user, secret, t0 + hours(7))
    expect(first.status).toBe('ok')
    const value = first.status === 'ok' ? first.value : undefined
    expect(value).toBeDefined()
    expect(checkSession(value, user, secret, t0 + hours(14)).status).toBe('ok')
  })

  it('nach 8 Stunden ohne Aktivität abgelaufen', () => {
    expect(checkSession(startSession(user, secret, t0), user, secret, t0 + SESSION_IDLE_MS + 1)).toEqual({ status: 'expired' })
  })

  it('nach 30 Tagen abgelaufen, auch bei laufender Aktivität', () => {
    let value: string | undefined = startSession(user, secret, t0)
    for (let t = t0 + hours(6); t < t0 + SESSION_MAX_AGE_MS; t += hours(6)) {
      const result = checkSession(value, user, secret, t)
      expect(result.status).toBe('ok')
      if (result.status === 'ok' && result.value) value = result.value
    }
    expect(checkSession(value, user, secret, t0 + SESSION_MAX_AGE_MS + 1)).toEqual({ status: 'expired' })
  })

  it.each([
    ['fehlendes Cookie', undefined],
    ['beliebiger Text', 'abc'],
    ['manipulierter Beginn', startSession(user, secret, t0).replace(`.${t0}.`, `.${t0 + hours(1)}.`)],
    ['fremder Schlüssel', startSession(user, 'anderer-schluessel', t0)],
    ['anderes Konto', startSession('8f9a3c1e-0000-4000-8000-000000000002', secret, t0)],
  ])('%s gilt als abgelaufen', (_, value) => {
    expect(checkSession(value, user, secret, t0 + 1000)).toEqual({ status: 'expired' })
  })
})
