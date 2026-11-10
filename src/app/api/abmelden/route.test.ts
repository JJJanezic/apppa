// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const signOut = vi.fn()
const clearSessionLimits = vi.fn()
const getSessionUser = vi.fn()
const pendingMfaStep = vi.fn()

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { signOut } }) }))
vi.mock('@/lib/auth/session', () => ({ clearSessionLimits, getSessionUser, pendingMfaStep }))

const { POST } = await import('./route')

function request(body?: unknown, origin = 'https://app.example') {
  return POST(
    new NextRequest('https://app.example/api/abmelden', {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  )
}

describe('POST /api/abmelden', () => {
  beforeEach(() => {
    signOut.mockReset().mockResolvedValue({ error: null })
    clearSessionLimits.mockReset()
    getSessionUser.mockReset().mockResolvedValue({ userId: 'u1' })
    pendingMfaStep.mockReset().mockResolvedValue(null)
  })

  it('meldet nur dieses Gerät ab und löscht die Sitzungsgrenzen', async () => {
    const res = await request({})
    expect(await res.json()).toEqual({ ok: true })
    expect(res.headers.get('cache-control')).toBe('no-store')
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
    expect(clearSessionLimits).toHaveBeenCalled()
  })

  it('ohne Body ebenso nur dieses Gerät', async () => {
    await request()
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' })
  })

  it('„alle“ beendet alle Sitzungen', async () => {
    const res = await request({ alle: true })
    expect(await res.json()).toEqual({ ok: true })
    expect(signOut).toHaveBeenCalledWith({ scope: 'global' })
  })

  it.each([
    ['ohne Sitzung', () => getSessionUser.mockResolvedValue(null)],
    ['mit offenem 2FA-Schritt', () => pendingMfaStep.mockResolvedValue('/2fa')],
  ])('„alle“ %s → sessionExpired, nichts abgemeldet', async (_, arrange) => {
    arrange()
    const res = await request({ alle: true })
    expect(await res.json()).toEqual({ ok: false, error: 'sessionExpired' })
    expect(signOut).not.toHaveBeenCalled()
    expect(clearSessionLimits).not.toHaveBeenCalled()
  })

  it('„alle“ mit Fehler von Supabase → unknown, Sitzungsgrenzen bleiben', async () => {
    signOut.mockResolvedValue({ error: { message: 'kaputt' } })
    const res = await request({ alle: true })
    expect(await res.json()).toEqual({ ok: false, error: 'unknown' })
    expect(clearSessionLimits).not.toHaveBeenCalled()
  })

  it('fremde Herkunft → 403, nichts abgemeldet', async () => {
    const res = await request({}, 'https://evil.example')
    expect(res.status).toBe(403)
    expect(signOut).not.toHaveBeenCalled()
  })
})
