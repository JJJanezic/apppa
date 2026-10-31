import { describe, expect, it } from 'vitest'

import { tablesToBlocks } from '@/lib/paste-html'

describe('tablesToBlocks', () => {
  it('lässt HTML ohne Tabelle unverändert', () => {
    const html = '<p>Hallo <b>Welt</b></p>'
    expect(tablesToBlocks(html)).toBe(html)
  })

  it('macht aus jeder Zelle einen eigenen Block, in Lesereihenfolge', () => {
    const html = '<p>Vor</p><table><thead><tr><th>Kopf</th></tr></thead><tbody><tr><td>Zelle A</td><td><b>Zelle B</b></td></tr></tbody></table><p>Nach</p>'
    expect(tablesToBlocks(html)).toBe('<p>Vor</p><div>Kopf</div><div>Zelle A</div><div><b>Zelle B</b></div><p>Nach</p>')
  })

  it('löst verschachtelte Tabellen von innen nach außen auf', () => {
    const html = '<table><tr><td>Außen<table><tr><td>Innen 1</td><td>Innen 2</td></tr></table></td><td>Rechts</td></tr></table>'
    expect(tablesToBlocks(html)).toBe('<div>Außen<div>Innen 1</div><div>Innen 2</div></div><div>Rechts</div>')
  })

  it('behält Absätze innerhalb einer Zelle', () => {
    expect(tablesToBlocks('<table><tr><td><p>Eins</p><p>Zwei</p></td></tr></table>')).toBe('<div><p>Eins</p><p>Zwei</p></div>')
  })
})
