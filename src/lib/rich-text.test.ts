import { describe, expect, it } from 'vitest'

import { docFromText, docLength, docPlainText, emptyDoc, isDocEmpty, isRichDoc, normalizeDoc } from '@/lib/rich-text'

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
