import { describe, expect, it } from 'vitest'

import { docFromText, docLength, docPlainText, emptyDoc, isDocEmpty, isRichDoc, normalizeDoc, parseFontSize, withAttrs } from '@/lib/rich-text'

describe('normalizeDoc', () => {
  it('behält nur fett, kursiv, Absätze, Umbrüche und Listen', () => {
    const doc = normalizeDoc({
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Titel' }] },
        {
          type: 'paragraph',
          attrs: { textAlign: 'center' },
          content: [
            { type: 'text', text: 'fett', marks: [{ type: 'bold' }, { type: 'link', attrs: { href: 'https://x' } }] },
            { type: 'hardBreak' },
            { type: 'text', text: 'rot', marks: [{ type: 'textStyle', attrs: { color: 'red' } }] },
            { type: 'image', attrs: { src: 'x.png' } },
          ],
        },
        { type: 'orderedList', attrs: { start: 3 }, content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'eins' }] }] }] },
      ],
    })
    expect(doc).toEqual({
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Titel' }] },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'fett', marks: [{ type: 'bold' }] }, { type: 'hardBreak' }, { type: 'text', text: 'rot' }],
        },
        { type: 'orderedList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'eins' }] }] }] },
      ],
    })
    expect(isRichDoc(doc)).toBe(true)
  })

  it('flacht verschachtelte Listen ab und fasst gleich formatierten Text zusammen', () => {
    const doc = normalizeDoc({
      type: 'doc',
      content: [
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                { type: 'paragraph', content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] },
                { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'c' }] }] }] },
              ],
            },
          ],
        },
      ],
    })
    expect(doc.content[0]).toEqual({
      type: 'bulletList',
      content: [
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'ab' }] }] },
        { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'c' }] }] },
      ],
    })
  })

  it('leere oder kaputte Eingabe ergibt einen leeren Absatz', () => {
    expect(normalizeDoc(null)).toEqual(emptyDoc())
    expect(normalizeDoc('<b>x</b>')).toEqual(emptyDoc())
  })
})

describe('isRichDoc', () => {
  it('lehnt HTML, Attribute und fremde Formate ab', () => {
    expect(isRichDoc('<p>Hallo</p>')).toBe(false)
    expect(isRichDoc({ type: 'doc', content: [{ type: 'paragraph', attrs: { style: 'color:red' } }] })).toBe(false)
    expect(isRichDoc({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'x', marks: [{ type: 'link' }] }] }] })).toBe(false)
    expect(isRichDoc({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: '' }] }] })).toBe(false)
    expect(isRichDoc({ type: 'doc', content: [{ type: 'bulletList', content: [] }] })).toBe(false)
    expect(isRichDoc(docFromText('Hallo\nWelt\n\nZweiter'))).toBe(true)
  })
})

describe('Länge und leer', () => {
  it('zählt Zeichen ohne Formatierung; Umbrüche zählen nicht', () => {
    const doc = docFromText('abc\nde\n\nfg')
    expect(docPlainText(doc)).toBe('abc\nde\nfg')
    expect(docLength(doc)).toBe(7)
  })

  it('nur Leerzeichen und Leerzeilen gelten als leer', () => {
    expect(isDocEmpty(emptyDoc())).toBe(true)
    expect(isDocEmpty(docFromText('  \n\n   '))).toBe(true)
    expect(isDocEmpty(docFromText(' x '))).toBe(false)
  })
})

describe('Einstellungen je Text', () => {
  const content = [{ type: 'paragraph' }]

  it('isRichDoc nimmt nur gültige Werte an', () => {
    expect(isRichDoc({ type: 'doc', attrs: { fontFamily: 'arimo', fontSize: 10.5, textAlign: 'justify' }, content })).toBe(true)
    expect(isRichDoc({ type: 'doc', content })).toBe(true)
    for (const attrs of [
      {},
      { fontFamily: 'comic' },
      { fontSize: 5.5 },
      { fontSize: 24.5 },
      { fontSize: 10.3 },
      { fontSize: '10' },
      { textAlign: 'left' },
      { textAlign: 'middle' },
      { color: 'red' },
    ]) {
      expect(isRichDoc({ type: 'doc', attrs, content })).toBe(false)
    }
  })

  it('normalizeDoc behält gültige Werte in fester Reihenfolge und entfernt ungültige', () => {
    const a = normalizeDoc({ type: 'doc', attrs: { textAlign: 'center', color: 'red', fontSize: 40, fontFamily: 'tinos' }, content })
    expect(a.attrs).toEqual({ fontFamily: 'tinos', textAlign: 'center' })
    const b = normalizeDoc({ content, attrs: { fontFamily: 'tinos', textAlign: 'center' }, type: 'doc' })
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    expect(normalizeDoc({ type: 'doc', attrs: { textAlign: 'left' }, content }).attrs).toBeUndefined()
    expect('attrs' in normalizeDoc({ type: 'doc', attrs: {}, content })).toBe(false)
  })

  it('withAttrs entfernt leere Angaben', () => {
    expect('attrs' in withAttrs(emptyDoc(), { fontSize: undefined })).toBe(false)
    expect(withAttrs(emptyDoc(), { fontSize: 9 }).attrs).toEqual({ fontSize: 9 })
  })

  it('parseFontSize: Komma oder Punkt, leer = Standard, sonst ungültig', () => {
    expect(parseFontSize('10,5')).toBe(10.5)
    expect(parseFontSize(' 11.0 ')).toBe(11)
    expect(parseFontSize('6')).toBe(6)
    expect(parseFontSize('24')).toBe(24)
    expect(parseFontSize('')).toBeUndefined()
    for (const bad of ['5', '25', '10,3', '-8', 'abc', '1e1']) expect(parseFontSize(bad)).toBeNull()
  })
})
