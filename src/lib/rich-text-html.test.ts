import { describe, expect, it } from 'vitest'

import { docFromText, isRichDoc, normalizeDoc, type RichBlock, type RichDoc, type RichInline } from '@/lib/rich-text'
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

describe('htmlToDoc gegen Angriffe und kaputtes HTML (QA)', () => {
  const payloads = [
    '<script>alert(1)</script>',
    '<img src=x onerror=alert(1)>',
    '<svg onload=alert(1)><script>alert(1)</script></svg>',
    '<math><mi xlink:href="javascript:alert(1)">x</mi></math>',
    '<iframe src="javascript:alert(1)"></iframe>',
    '<a href="javascript:alert(1)">x</a>',
    '<p onclick="alert(1)" style="background:url(javascript:alert(1))">x</p>',
    '<div style="font-family: \'x\'; background: url(https://evil.example/a.png)"><p>x</p></div>',
    '<div style="font-family: Arimo;}body{display:none"><p>x</p></div>',
    '<div style="font-size: 12pt !important"><p>x</p></div>',
    '<div style="font-size: expression(alert(1))"><p>x</p></div>',
    '<div style="font-family: Arimo; font-family: Tinos"><p>x</p></div>',
    '<meta http-equiv="refresh" content="0;url=https://evil.example">',
    '<link rel="stylesheet" href="https://evil.example/a.css">',
    '<base href="https://evil.example/">',
    '<style>@import url(https://evil.example/a.css)</style>',
    '<html><body onload="alert(1)"><p>x</p></body></html>',
    '<html><frameset><frame src="https://evil.example"></frameset></html>',
    '<!-- <script>alert(1)</script> --><p>x</p>',
    '<template><script>alert(1)</script></template>',
    '<noscript><p>x</p></noscript>',
    '<table><tr><td><ul><li>x</table>',
    '<ul>lose<li><ol><li><ul><li>tief</li></ul></li></ol></li></ul>',
    '<li>ohne Liste</li>',
    '<p><p><p>',
    '</p></div></ul>',
    '<div><div><div><div>tief</div></div></div></div>',
    '<strong><em><strong><em>x</em></strong></em></strong>',
    '<strong><p>a</p><ul><li>b</li></ul></strong>',
    '<',
    '<<<>>>',
    '&amp;lt;script&amp;gt;',
    '\u0000\u0000',
    '<p>\u0000</p>',
    '<p>' + '<strong>'.repeat(2000) + 'x',
  ]

  it.each(payloads)('ergibt immer eine gültige Struktur ohne Aktive Inhalte: %s', (html) => {
    const { doc } = htmlToDoc(html)
    expect(isRichDoc(doc)).toBe(true)
    const json = JSON.stringify(doc)
    expect(json).not.toContain('"href"')
    expect(json).not.toContain('"src"')
    expect(json).not.toContain('onerror')
    // Was beim nächsten Öffnen als Code erscheint, enthält nur erlaubte Tags
    expect(docToHtml(doc).match(/<\/?([a-z]+)/g)?.every((t) => /^<\/?(p|br|strong|em|ul|ol|li|div)$/.test(t)) ?? true).toBe(true)
  })

  it('Aktives wird in der Hinweisliste genannt und sein Inhalt nicht zu Text', () => {
    for (const html of ['<script>alert(1)</script>', '<style>a{}</style>', '<template>geheim</template>', '<iframe>geheim</iframe>']) {
      const { doc, removed } = htmlToDoc(html)
      expect(removed.length, html).toBeGreaterThan(0)
      expect(JSON.stringify(doc), html).not.toMatch(/alert|geheim|a\{/)
    }
  })

  // BUG-1 (QA 2026-11-04): Soll grün werden; it.fails meldet, sobald es behoben ist
  it.fails('BUG-1: Listenpunkt nur aus Leerzeichen bleibt beim Wechsel erhalten', () => {
    const doc = normalizeDoc({ type: 'doc', content: [{ type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [text(' ')] }] }] }] })
    expect(htmlToDoc(docToHtml(doc)).doc).toEqual(doc)
  })

  // BUG-5 (QA 2026-11-04): Spec: „Nicht Erlaubtes wird entfernt, sein Text bleibt erhalten“
  it.fails.each(['<button>Text</button>', '<select><option>Text</option></select>', '<textarea>Text</textarea>'])('BUG-5: Text bleibt bei %s', (html) => {
    expect(JSON.stringify(htmlToDoc(html).doc)).toContain('Text')
  })

  // BUG-6 (QA 2026-11-04): fett um eine Liste geht ohne Hinweis verloren
  it.fails('BUG-6: <strong> um eine Liste bleibt erhalten oder wird genannt', () => {
    const { doc, removed } = htmlToDoc('<strong><ul><li>x</li></ul></strong>')
    expect(JSON.stringify(doc).includes('bold') || removed.length > 0).toBe(true)
  })

  it('Hin und zurück ändert zufällige Dokumente nicht', () => {
    const isBlank = (p: { content?: RichInline[] }) => (p.content ?? []).every((n) => n.type === 'text' && n.text.trim() === '')
    let seed = 42
    const rnd = (n: number) => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) % n
    const words = ['a', ' ', '  ', 'b c', '<', '>', '&', '&amp;', '{Gast}', '\u00a0', 'ä€', '"', "'", ' x ', '<p>', '</li>', '&nbsp;']
    const inline = (): RichInline[] =>
      Array.from({ length: rnd(5) }, (): RichInline => {
        if (rnd(5) === 0) return { type: 'hardBreak' }
        const marks = [{ type: 'bold' as const }, { type: 'italic' as const }].filter(() => rnd(2) === 0)
        const text = words[rnd(words.length)]
        return marks.length ? { type: 'text', text, marks } : { type: 'text', text }
      })
    const para = () => {
      const content = inline()
      return content.length ? { type: 'paragraph' as const, content } : { type: 'paragraph' as const }
    }
    // Nur aus Leerzeichen bestehende Listenpunkte: siehe BUG-1
    const item = () => ({ type: 'listItem' as const, content: Array.from({ length: 1 + rnd(2) }, para).map((p, _, all) => (all.length === 1 && isBlank(p) ? { type: 'paragraph' as const } : p)) })
    const block = (): RichBlock =>
      rnd(3) === 0
        ? {
            type: rnd(2) ? 'bulletList' : 'orderedList',
            content: Array.from({ length: 1 + rnd(3) }, item),
          }
        : para()
    const failures: string[] = []
    for (let i = 0; i < 500; i++) {
      const doc = normalizeDoc({ type: 'doc', attrs: rnd(2) ? { fontSize: 10.5, textAlign: 'center' } : undefined, content: Array.from({ length: 1 + rnd(4) }, block) })
      const back = htmlToDoc(docToHtml(doc))
      if (JSON.stringify(back.doc) !== JSON.stringify(doc) || back.removed.length) failures.push(`${JSON.stringify(doc)}\n => ${JSON.stringify(back.doc)} ${back.removed}`)
    }
    expect(failures.length, failures.slice(0, 4).join('\n\n')).toBe(0)
  })
})
