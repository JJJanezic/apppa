import { describe, expect, it } from 'vitest'

import { assertTestableProject, projectRef } from './projects'

describe('projectRef', () => {
  it('liest die Ref aus der Supabase-URL', () => {
    expect(projectRef('https://nizgfmvjplhegoosanmu.supabase.co')).toBe('nizgfmvjplhegoosanmu')
  })

  it('liefert bei fehlender oder ungültiger URL einen Leerstring', () => {
    expect(projectRef(undefined)).toBe('')
    expect(projectRef('keine-url')).toBe('')
  })
})

describe('assertTestableProject', () => {
  it('lässt Dev, lokale Instanzen und fehlende Werte zu', () => {
    expect(() => assertTestableProject('https://nizgfmvjplhegoosanmu.supabase.co')).not.toThrow()
    expect(() => assertTestableProject('http://127.0.0.1:54321')).not.toThrow()
    expect(() => assertTestableProject(undefined)).not.toThrow()
  })

  it('bricht bei Staging ab', () => {
    expect(() => assertTestableProject('https://iikzjqjjxoznrkkixfqa.supabase.co')).toThrow('Staging')
  })

  it('bricht bei Produktion ab', () => {
    expect(() => assertTestableProject('https://ahclrqbhfpidxjzbpfgb.supabase.co')).toThrow('Produktion')
  })
})
