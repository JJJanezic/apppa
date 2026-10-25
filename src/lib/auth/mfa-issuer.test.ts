import { describe, expect, it } from 'vitest'

import { mfaIssuer } from './mfa-issuer'

describe('mfaIssuer', () => {
  it('heißt in der Produktion schlicht „apppa“', () => {
    expect(mfaIssuer('https://ahclrqbhfpidxjzbpfgb.supabase.co')).toBe('apppa')
  })

  it('kennzeichnet Staging', () => {
    expect(mfaIssuer('https://iikzjqjjxoznrkkixfqa.supabase.co')).toBe('apppa Staging')
  })

  it('kennzeichnet die Entwicklung und unbekannte Projekte als Dev', () => {
    expect(mfaIssuer('https://nizgfmvjplhegoosanmu.supabase.co')).toBe('apppa Dev')
    expect(mfaIssuer('http://127.0.0.1:54321')).toBe('apppa Dev')
  })

  it('fällt bei fehlender oder ungültiger URL auf Dev zurück', () => {
    expect(mfaIssuer(undefined)).toBe('apppa Dev')
    expect(mfaIssuer('keine-url')).toBe('apppa Dev')
  })
})
