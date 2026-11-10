// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const actions = vi.hoisted(() => ({
  signIn: vi.fn(),
  verifyMfa: vi.fn(),
  confirmMfaEnrollment: vi.fn(),
  completeInvite: vi.fn(),
  setNewPassword: vi.fn(),
  confirmEmailLink: vi.fn(),
}))
vi.mock('@/app/(auth)/actions', () => actions)

const { POST } = await import('./route')

function request(schritt: string, body?: unknown, origin = 'https://app.example') {
  return POST(
    new NextRequest(`https://app.example/api/anmeldung/${schritt}`, {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    { params: Promise.resolve({ schritt }) }
  )
}

describe('POST /api/anmeldung/[schritt]', () => {
  beforeEach(() => {
    for (const fn of Object.values(actions)) fn.mockReset().mockResolvedValue({ ok: true, redirectTo: '/' })
  })

  it.each([
    ['anmelden', 'signIn'],
    ['code', 'verifyMfa'],
    ['einrichten', 'confirmMfaEnrollment'],
    ['einladung', 'completeInvite'],
    ['neues-passwort', 'setNewPassword'],
    ['link', 'confirmEmailLink'],
  ] as const)('„%s“ ruft %s mit den Eingaben auf und gibt das Ergebnis als JSON zurück', async (schritt, name) => {
    actions[name].mockResolvedValue({ ok: true, redirectTo: '/ziel' })
    const res = await request(schritt, { a: 1 })
    expect(actions[name]).toHaveBeenCalledWith({ a: 1 })
    expect(await res.json()).toEqual({ ok: true, redirectTo: '/ziel' })
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('Fehler der Schritte kommen unverändert zurück', async () => {
    actions.signIn.mockResolvedValue({ ok: false, error: 'locked', retryAfterMinutes: 15 })
    expect(await (await request('anmelden', {})).json()).toEqual({ ok: false, error: 'locked', retryAfterMinutes: 15 })
  })

  it.each([undefined, null, 'text', [1]])('ohne Objekt als Body (%o) bekommt der Schritt ein leeres Objekt', async (body) => {
    await request('link', body)
    expect(actions.confirmEmailLink).toHaveBeenCalledWith(Array.isArray(body) ? body : {})
  })

  it('Ausnahme im Schritt → „unknown“', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    actions.completeInvite.mockRejectedValue(new Error('kaputt'))
    expect(await (await request('einladung', {})).json()).toEqual({ ok: false, error: 'unknown' })
  })

  it.each(['abmelden', 'toString', '__proto__', 'requestPasswordReset'])('unbekannter Schritt „%s“ → 404', async (schritt) => {
    const res = await request(schritt, {})
    expect(res.status).toBe(404)
  })

  it('fremde Herkunft → 403, kein Schritt ausgeführt', async () => {
    const res = await request('anmelden', {}, 'https://evil.example')
    expect(res.status).toBe(403)
    expect(actions.signIn).not.toHaveBeenCalled()
  })
})
