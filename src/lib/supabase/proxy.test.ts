// @vitest-environment node
import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { SESSION_COOKIE, startSession } from '@/lib/auth/session-limits'

// Supabase-Client nachgestellt: getUser liefert die Person bzw. null (widerrufen / nicht angemeldet)
const getUser = vi.fn()
const signOut = vi.fn()
vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getUser, signOut } }),
}))
vi.mock('@/lib/env', () => ({
  getServerEnv: () => ({
    NEXT_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'pk',
    SUPABASE_SECRET_KEY: 'geheim',
  }),
}))

const { updateSession } = await import('./proxy')

const USER = '7f9a3c1e-0000-4000-8000-000000000001'
const authCookie = 'sb-x-auth-token=base64-abc'

function call(path: string, init: { method?: string; headers?: Record<string, string> } = {}) {
  return updateSession(new NextRequest(new URL(path, 'https://app.example'), init))
}

describe('Vorschaltung (proxy)', () => {
  beforeEach(() => {
    getUser.mockReset()
    signOut.mockReset()
  })

  it('ohne Sitzung: App-Seite → Anmeldung mit Rücksprung', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    const res = await call('/konto')
    expect(res.headers.get('location')).toBe('https://app.example/anmelden?next=%2Fkonto')
  })

  it('BUG-1: widerrufene Sitzung (Supabase kennt sie nicht mehr) → Anmeldung mit Hinweis', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    const res = await call('/konto', { headers: { cookie: authCookie } })
    expect(res.headers.get('location')).toBe('https://app.example/anmelden?next=%2Fkonto&grund=sitzung-abgelaufen')
  })

  it('gültige Sitzung mit Grenzen-Cookie → Seite wird ausgeliefert', async () => {
    getUser.mockResolvedValue({ data: { user: { id: USER } } })
    const limits = startSession(USER, 'geheim')
    const res = await call('/konto', { headers: { cookie: `${authCookie}; ${SESSION_COOKIE}=${limits}` } })
    expect(res.headers.get('location')).toBeNull()
  })

  it('BUG-4: GET mit gefälschtem next-action-Header wird trotzdem umgeleitet', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    const res = await call('/einladung/abschliessen', { headers: { 'next-action': 'x' } })
    expect(res.headers.get('location')).toBe('https://app.example/anmelden?next=%2Feinladung%2Fabschliessen')
  })

  it('POST einer Server-Aktion wird nicht umgeleitet (die Aktion meldet „sessionExpired“)', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    const res = await call('/konto', { method: 'POST', headers: { 'next-action': 'abc' } })
    expect(res.headers.get('location')).toBeNull()
  })

  it('öffentliche Seiten ohne Sitzung bleiben erreichbar', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    for (const path of ['/anmelden', '/passwort-vergessen', '/bestaetigen', '/auth/confirm']) {
      expect((await call(path)).headers.get('location')).toBeNull()
    }
  })
})
