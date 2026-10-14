import { afterEach, describe, expect, it, vi } from 'vitest'

import { getClientEnv, getServerEnv } from './env'

const valid = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_test',
  SUPABASE_SECRET_KEY: 'sb_secret_test',
}

function setEnv(values: Partial<typeof valid>) {
  for (const key of Object.keys(valid) as (keyof typeof valid)[]) {
    vi.stubEnv(key, values[key] ?? '')
  }
}

describe('env', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('liefert die Werte, wenn alle Variablen gesetzt sind', () => {
    setEnv(valid)
    expect(getClientEnv().NEXT_PUBLIC_SUPABASE_URL).toBe(valid.NEXT_PUBLIC_SUPABASE_URL)
    expect(getServerEnv().SUPABASE_SECRET_KEY).toBe(valid.SUPABASE_SECRET_KEY)
  })

  it('nennt die fehlende Variable', () => {
    setEnv({ ...valid, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined })
    expect(() => getClientEnv()).toThrow('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY fehlt')
  })

  it('verlangt den geheimen Schlüssel nur auf dem Server', () => {
    setEnv({ ...valid, SUPABASE_SECRET_KEY: undefined })
    expect(() => getClientEnv()).not.toThrow()
    expect(() => getServerEnv()).toThrow('SUPABASE_SECRET_KEY fehlt')
  })

  it('meldet eine ungültige URL', () => {
    setEnv({ ...valid, NEXT_PUBLIC_SUPABASE_URL: 'keine-url' })
    expect(() => getClientEnv()).toThrow('NEXT_PUBLIC_SUPABASE_URL ist ungültig')
  })
})
