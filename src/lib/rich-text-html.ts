// HTML-Ansicht der Rechnungstexte (PROJ-39, nur im Browser). Das HTML gibt es nur, solange das Code-Feld offen ist:
// Gespeichert und angezeigt wird immer die geprüfte Struktur aus rich-text.ts. DOMParser führt nichts aus und lädt nichts
// nach. Was die Struktur nicht kennt, fällt weg und wird benannt; der Text darin bleibt, außer bei Skripten u. Ä.
import {
  isRichAlign,
  isRichFontSize,
  normalizeDoc,
  RICH_FONTS,
  type RichAttrs,
  type RichBlock,
  type RichDoc,
  type RichFont,
  type RichInline,
  type RichListItem,
  type RichParagraph,
} from '@/lib/rich-text'

export const RICH_FONT_NAMES: Record<RichFont, string> = {
  arimo: 'Arimo',
  tinos: 'Tinos',
  carlito: 'Carlito',
  'source-sans': 'Source Sans 3',
  'source-serif': 'Source Serif 4',
  'open-sans': 'Open Sans',
}

export const RICH_HTML_TAGS = '<p>, <br>, <strong>, <em>, <ul>, <ol>, <li>'
export const RICH_CODE_MAX = 20_000

const escapeText = (text: string) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll(' ', '&nbsp;')

function inlineHtml(node: RichInline): string {
  if (node.type === 'hardBreak') return '<br>'
  let html = escapeText(node.text)
  const marks = node.marks ?? []
  if (marks.some((m) => m.type === 'italic')) html = `<em>${html}</em>`
  if (marks.some((m) => m.type === 'bold')) html = `<strong>${html}</strong>`
  return html
}

const paragraphInner = (p: RichParagraph) => (p.content ?? []).map(inlineHtml).join('')

function blockHtml(block: RichBlock): string {
  if (block.type === 'paragraph') return `<p>${paragraphInner(block)}</p>`
  const tag = block.type === 'bulletList' ? 'ul' : 'ol'
  const items = block.content.map((item) => {
    const inner = item.content.length === 1 ? paragraphInner(item.content[0]) : item.content.map((p) => `<p>${paragraphInner(p)}</p>`).join('')
    return `  <li>${inner}</li>`
  })
  return [`<${tag}>`, ...items, `</${tag}>`].join('\n')
}

function attrsStyle(attrs: RichAttrs): string {
  const parts: string[] = []
  if (attrs.fontFamily) {
    const name = RICH_FONT_NAMES[attrs.fontFamily]
    parts.push(`font-family: ${name.includes(' ') ? `'${name}'` : name}`)
  }
  if (attrs.fontSize) parts.push(`font-size: ${attrs.fontSize}pt`)
  if (attrs.textAlign) parts.push(`text-align: ${attrs.textAlign}`)
  return parts.join('; ')
}

export function docToHtml(doc: RichDoc): string {
  const body = doc.content.map(blockHtml).join('\n')
  return doc.attrs ? `<div style="${attrsStyle(doc.attrs)}">\n${body}\n</div>` : body
}

// Inhalt wird mitsamt dem Tag verworfen
const DROP = new Set(
  'script style template noscript iframe object embed applet svg math head title meta link base audio video canvas img picture source track map area input select textarea button hr wbr'.split(' ')
)
const BLOCK = new Set(
  'address article aside blockquote caption center dd details dialog dir dl dt fieldset figcaption figure footer form h1 h2 h3 h4 h5 h6 header hgroup legend main menu nav pre section summary table tbody td tfoot th thead tr'.split(' ')
)

// Zeilenumbruch samt Einrückung im Code: wie in HTML ein Leerzeichen, am Rand einer Zeile nichts. Andere Leerzeichen
// bleiben, damit ein Wechsel in den Code und zurück den Text nicht ändert.
const LINE_BREAK = '\u0000'

type Mark = 'bold' | 'italic'
type Walk = { blocks: RichBlock[]; run: RichInline[] }

function finishRun(run: RichInline[]): RichInline[] {
  return run
    .map((node, i) => {
      if (node.type !== 'text') return node
      let text = node.text
      const prev = run[i - 1]
      const next = run[i + 1]
      if (!prev || prev.type === 'hardBreak') text = text.replace(new RegExp(`^${LINE_BREAK}`), '')
      if (!next || next.type === 'hardBreak') text = text.replace(new RegExp(`${LINE_BREAK}$`), '')
      return { ...node, text: text.replaceAll(LINE_BREAK, ' ') }
    })
    .filter((node) => node.type !== 'text' || node.text !== '')
}

function readDivStyle(style: string, note: (s: string) => void): RichAttrs {
  const attrs: RichAttrs = {}
  for (const part of style.split(';')) {
    const decl = part.trim()
    if (!decl) continue
    const colon = decl.indexOf(':')
    const prop = (colon < 0 ? decl : decl.slice(0, colon)).trim().toLowerCase()
    const value = colon < 0 ? '' : decl.slice(colon + 1).trim()
    if (prop === 'font-family') {
      const name = value.replace(/^['"]|['"]$/g, '').toLowerCase()
      const font = RICH_FONTS.find((f) => RICH_FONT_NAMES[f].toLowerCase() === name)
      if (font) attrs.fontFamily = font
      else note(decl)
    } else if (prop === 'font-size') {
      const m = /^(\d+(?:[.,]\d+)?)\s*pt$/i.exec(value)
      const size = m ? Number(m[1].replace(',', '.')) : NaN
      if (isRichFontSize(size)) attrs.fontSize = size
      else note(decl)
    } else if (prop === 'text-align') {
      const align = value.toLowerCase()
      if (isRichAlign(align)) attrs.textAlign = align
      else if (align !== 'left') note(decl)
    } else note(decl)
  }
  return attrs
}

// Liest Code; removed nennt alles, was nicht übernommen wurde
export function htmlToDoc(html: string): { doc: RichDoc; removed: string[] } {
  const parsed = new DOMParser().parseFromString(html, 'text/html')
  const removed = new Set<string>()
  const note = (item: string) => removed.add(item)

  const noteAttrs = (el: Element, tag: string, skip?: string) => {
    for (const a of Array.from(el.attributes)) if (a.name !== skip) note(`${a.name} an <${tag}>`)
  }

  const flush = (w: Walk, force = false) => {
    const content = finishRun(w.run)
    w.run = []
    const blank = content.every((n) => n.type === 'text' && n.text.trim() === '')
    if (blank && !force) return
    w.blocks.push(content.length ? { type: 'paragraph', content } : { type: 'paragraph' })
  }

  const walkChildren = (el: Element, w: Walk, marks: Mark[]) => {
    for (const child of Array.from(el.childNodes)) walk(child, w, marks)
  }

  const listItems = (list: Element): RichListItem[] => {
    const items: RichListItem[] = []
    for (const child of Array.from(list.childNodes)) {
      if (child.nodeType === Node.COMMENT_NODE) note('Kommentar')
      if (child.nodeType === Node.TEXT_NODE && !child.textContent?.trim()) continue
      if (child.nodeType !== Node.TEXT_NODE && child.nodeType !== Node.ELEMENT_NODE) continue
      const inner: Walk = { blocks: [], run: [] }
      if (child.nodeType === Node.ELEMENT_NODE && (child as Element).localName === 'li') {
        noteAttrs(child as Element, 'li')
        walkChildren(child as Element, inner, [])
      } else walk(child, inner, [])
      flush(inner)
      const paragraphs = inner.blocks.filter((b): b is RichParagraph => b.type === 'paragraph')
      items.push({ type: 'listItem', content: paragraphs.length ? paragraphs : [{ type: 'paragraph' }] })
      // Verschachtelte Listen werden wie beim Einfügen zu weiteren Punkten derselben Liste
      for (const b of inner.blocks) {
        if (b.type !== 'paragraph') {
          note(`<${b.type === 'bulletList' ? 'ul' : 'ol'}> in <li>`)
          items.push(...b.content)
        }
      }
    }
    return items
  }

  function walk(node: ChildNode, w: Walk, marks: Mark[]) {
    if (node.nodeType === Node.COMMENT_NODE) {
      note('Kommentar')
      return
    }
    if (node.nodeType === Node.TEXT_NODE) {
      const text = (node.textContent ?? '').replace(/[ \t\r]*\n[ \t\r\n]*/g, LINE_BREAK)
      if (text) w.run.push(marks.length ? { type: 'text', text, marks: marks.map((type) => ({ type })) } : { type: 'text', text })
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return
    const el = node as Element
    const tag = el.localName
    if (tag === 'br') {
      noteAttrs(el, tag)
      w.run.push({ type: 'hardBreak' })
    } else if (tag === 'strong' || tag === 'b' || tag === 'em' || tag === 'i') {
      // <b> und <i> bedeuten dasselbe wie <strong> und <em> und gehen nicht verloren
      noteAttrs(el, tag)
      walkChildren(el, w, [...marks, tag === 'strong' || tag === 'b' ? 'bold' : 'italic'])
    } else if (tag === 'p') {
      noteAttrs(el, tag)
      flush(w)
      walkChildren(el, w, marks)
      flush(w, true)
    } else if (tag === 'ul' || tag === 'ol') {
      noteAttrs(el, tag)
      flush(w)
      const items = listItems(el)
      if (items.length) w.blocks.push({ type: tag === 'ul' ? 'bulletList' : 'orderedList', content: items })
    } else if (DROP.has(tag)) {
      note(`<${tag}>`)
    } else if (tag === 'div' || tag === 'li' || BLOCK.has(tag)) {
      note(`<${tag}>`)
      flush(w)
      walkChildren(el, w, marks)
      flush(w)
    } else {
      note(`<${tag}>`)
      walkChildren(el, w, marks)
    }
  }

  for (const child of Array.from(parsed.head.children)) note(`<${child.localName}>`)
  const typedRoot = /<(html|head|body)\b/i.exec(html)
  if (typedRoot) note(`<${typedRoot[1].toLowerCase()}>`)

  // Genau ein äußeres <div> trägt die Einstellungen
  const top = Array.from(parsed.body.childNodes).filter((n) => n.nodeType !== Node.TEXT_NODE || n.textContent?.trim())
  const elements = top.filter((n) => n.nodeType !== Node.COMMENT_NODE)
  const wrapper = elements.length === 1 && (elements[0] as Element).localName === 'div' ? (elements[0] as Element) : null
  const w: Walk = { blocks: [], run: [] }
  let attrs: RichAttrs | undefined
  if (wrapper) {
    noteAttrs(wrapper, 'div', 'style')
    attrs = readDivStyle(wrapper.getAttribute('style') ?? '', note)
    for (const n of top) if (n.nodeType === Node.COMMENT_NODE) note('Kommentar')
    walkChildren(wrapper, w, [])
  } else {
    walkChildren(parsed.body, w, [])
  }
  flush(w)
  return { doc: normalizeDoc({ type: 'doc', attrs, content: w.blocks }), removed: Array.from(removed) }
}
