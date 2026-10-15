// @vitest-environment node
import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'

import { GET } from './route'

function confirm(params: Record<string, string>) {
  const url = new URL('https://app.example/auth/confirm')
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  return GET(new NextRequest(url))
}

describe('GET /auth/confirm', () => {
  it.each(['invite', 'recovery'])('leitet %s-Links auf die Bestätigungsseite, ohne einzulösen', (type) => {
    const res = confirm({ token_hash: 'abc', type })
    expect(res.headers.get('location')).toBe(`https://app.example/bestaetigen?token_hash=abc&type=${type}`)
  })

  it.each(['/\\evil.com', '//evil.com', 'https://evil.com'])('übernimmt kein Rücksprung-Ziel (%s)', (next) => {
    const res = confirm({ token_hash: 'abc', type: 'invite', next })
    expect(res.headers.get('location')).toBe('https://app.example/bestaetigen?token_hash=abc&type=invite')
  })

  it.each([{ token_hash: 'abc', type: 'signup' }, { type: 'invite' }, {}])(
    'unvollständige oder fremde Links zeigen die Meldung „nicht mehr gültig“ (%o)',
    (params) => {
      const res = confirm(params as Record<string, string>)
      expect(res.headers.get('location')).toBe('https://app.example/bestaetigen')
    }
  )
})
