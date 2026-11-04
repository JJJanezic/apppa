import { describe, expect, it } from 'vitest'

import { docFromText, normalizeDoc, type RichDoc } from '@/lib/rich-text'
import { docToHtml, htmlToDoc } from '@/lib/rich-text-html'

const text = (t: string) => ({ type: 'text' as const, text: t })
const full: RichDoc = {
  type: 'doc',
  attrs: { fontFamily: 'source-sans', fontSize: 10.5, textAlign: 'justify' },
  content: [
    {
      type: 'paragraph',
      content: [
        text('Sehr  geehrte {Anrede} a < b & c > d e '),
        { type: 'text', text: 'fett', marks: [{ type: 'bold' }] },
        { type: 'hardBreak' },
        { type: 'text', text: 'beides', marks: [{ type: 'bold' }, { type: 'italic' }] },
      ],
    },
    { type: 'paragraph' },
    { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [text('eins')] }] }] },
    {
      type: 'orderedList',
      content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [text('a')] }, { type: 'paragraph', content: [text('b')] }] }],
    },
  ],
}

describe('docToHtml und htmlToDoc', () => {
  it('Hin und zurück ändert nichts, auch Leerzeichen und Sonderzeichen', () => {
    const result = htmlToDoc(docToHtml(full))
    expect(result.removed).toEqual([])
    expect(result.doc).toEqual(normalizeDoc(full))
  })

  it('ohne Einstellungen kein <div>', () => {
    const html = docToHtml(docFromText('Hallo'))
    expect(html).toBe('<p>Hallo</p>')
    expect(htmlToDoc(html).doc).toEqual(docFromText('Hallo'))
  })

  it('schreibt Sonderzeichen und Schriftnamen lesbar', () => {
    const html = docToHtml(full)
    expect(html).toContain(`font-family: 'Source Sans 3'; font-size: 10.5pt; text-align: justify`)
    expect(html).toContain('a &lt; b &amp; c &gt; d&nbsp;e')
  })

  it('liest die drei Einstellungen aus dem äußeren <div>', () => {
    const { doc, removed } = htmlToDoc('<div style="font-size: 9pt; text-align: right; font-family: arimo"><p>x</p></div>')
    expect(removed).toEqual([])
    expect(doc.attrs).toEqual({ fontFamily: 'arimo', fontSize: 9, textAlign: 'right' })
  })

  it('text-align: left ist die Vorgabe und wird nicht gespeichert', () => {
    const { doc, removed } = htmlToDoc('<div style="text-align: left"><p>x</p></div>')
    expect(removed).toEqual([])
    expect(doc.attrs).toBeUndefined()
  })

  it('ungültige Werte fallen auf Standard und werden genannt', () => {
    const { doc, removed } = htmlToDoc('<div style="font-size: 40pt; font-family: Comic Sans; color: red; text-align: middle" class="x"><p>x</p></div>')
    expect(doc.attrs).toBeUndefined()
    expect(removed).toEqual(['class an <div>', 'font-size: 40pt', 'font-family: Comic Sans', 'color: red', 'text-align: middle'])
    expect(htmlToDoc('<div style="font-size: 10.3pt"><p>x</p></div>').removed).toEqual(['font-size: 10.3pt'])
    expect(htmlToDoc('<div style="font-size: 12px"><p>x</p></div>').removed).toEqual(['font-size: 12px'])
  })

  it('entfernt Tags und Attribute, der Text bleibt', () => {
    const { doc, removed } = htmlToDoc('<p style="color:red">a <a href="https://x">Link</a> <span style="color:red">rot</span></p><h1>Titel</h1>')
    expect(doc.content).toEqual([
      { type: 'paragraph', content: [text('a Link rot')] },
      { type: 'paragraph', content: [text('Titel')] },
    ])
    expect(removed).toEqual(['style an <p>', '<a>', '<span>', '<h1>'])
  })

  it('Skripte und Stile laufen nicht und ihr Inhalt wird nicht zu Text', () => {
    const { doc, removed } = htmlToDoc('<script>alert(1)</script><style>p{}</style><p>Text<img src=x onerror="alert(1)"><script>alert(2)</script></p>')
    expect(doc.content).toEqual([{ type: 'paragraph', content: [text('Text')] }])
    expect(removed).toEqual(expect.arrayContaining(['<script>', '<style>', '<img>']))
  })

  it('Tabellen: jede Zelle ein Absatz', () => {
    const { doc } = htmlToDoc('<table><tr><td>A</td><td>B</td></tr></table>')
    expect(doc.content).toEqual([
      { type: 'paragraph', content: [text('A')] },
      { type: 'paragraph', content: [text('B')] },
    ])
  })

  it('Text außerhalb eines Absatzes, mehrere <div>: Absätze und Hinweis', () => {
    const { doc, removed } = htmlToDoc('lose<div style="color:red">eins</div><div>zwei</div>')
    expect(doc.content.map((b) => (b.type === 'paragraph' ? b.content : null))).toEqual([[text('lose')], [text('eins')], [text('zwei')]])
    expect(doc.attrs).toBeUndefined()
    expect(removed).toEqual(['<div>'])
  })

  it('<b> und <i> bleiben als fett und kursiv, ohne Hinweis', () => {
    const { doc, removed } = htmlToDoc('<p><b>f</b><i>k</i></p>')
    expect(removed).toEqual([])
    expect(doc).toEqual(htmlToDoc('<p><strong>f</strong><em>k</em></p>').doc)
  })

  it('fehlerhaftes HTML wird gelesen, Zeilenumbrüche im Code sind Leerzeichen', () => {
    expect(htmlToDoc('<p>offen <strong>fett').doc.content).toEqual([
      { type: 'paragraph', content: [text('offen '), { type: 'text', text: 'fett', marks: [{ type: 'bold' }] }] },
    ])
    expect(htmlToDoc('<p>\n  eins\n  zwei\n</p>').doc.content).toEqual([{ type: 'paragraph', content: [text('eins zwei')] }])
  })

  it('verschachtelte Listen werden flach und genannt', () => {
    const { doc, removed } = htmlToDoc('<ul><li>a<ul><li>b</li></ul></li></ul>')
    expect(doc.content).toHaveLength(1)
    expect(doc.content[0].type === 'bulletList' && doc.content[0].content).toHaveLength(2)
    expect(removed).toEqual(['<ul> in <li>'])
  })

  it('leerer Code ergibt einen leeren Text', () => {
    expect(htmlToDoc('').doc).toEqual({ type: 'doc', content: [{ type: 'paragraph' }] })
    expect(htmlToDoc('<p> </p>').removed).toEqual([])
  })
})
