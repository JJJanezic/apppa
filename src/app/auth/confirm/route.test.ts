// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const verifyOtp = vi.fn()
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { verifyOtp } }),
}))

const { GET } = await import('./route')

function confirm(params: Record<string, string>) {
  const url = new URL('https://app.example/auth/confirm')
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  return GET(new NextRequest(url))
}

describe('GET /auth/confirm', () => {
  beforeEach(() => {
    verifyOtp.mockReset()
    verifyOtp.mockResolvedValue({ error: null })
  })

  it('leitet nach gültigem Token auf das interne Ziel weiter', async () => {
    const res = await confirm({ token_hash: 'abc', type: 'invite', next: '/willkommen' })
    expect(verifyOtp).toHaveBeenCalledWith({ type: 'invite', token_hash: 'abc' })
    expect(res.headers.get('location')).toBe('https://app.example/willkommen')
  })

  it.each(['/\\evil.com', '//evil.com', 'https://evil.com'])(
    'leitet bei fremdem Ziel %s auf die Startseite (BUG-1)',
    async (next) => {
      const res = await confirm({ token_hash: 'abc', type: 'recovery', next })
      expect(res.headers.get('location')).toBe('https://app.example/')
    }
  )

  it('ungültiger Token führt zur Fehlermeldung', async () => {
    verifyOtp.mockResolvedValue({ error: new Error('expired') })
    const res = await confirm({ token_hash: 'abc', type: 'invite', next: '/willkommen' })
    expect(res.headers.get('location')).toBe('https://app.example/?auth_error=link_invalid')
  })

  it('nicht erlaubter Typ wird ohne Prüfung abgewiesen', async () => {
    const res = await confirm({ token_hash: 'abc', type: 'signup' })
    expect(verifyOtp).not.toHaveBeenCalled()
    expect(res.headers.get('location')).toBe('https://app.example/?auth_error=link_invalid')
  })
})
