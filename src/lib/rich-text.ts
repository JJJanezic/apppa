// Formatierter Text der Rechnungstexte (PROJ-39): Absätze und Listen, darin Text mit „fett“/„kursiv“ und Zeilenumbrüche.
// Gespeichert wird nur diese kleine Struktur, nie HTML. Sie ist eine Teilmenge des Tiptap-Formats, damit der Editor sie
// direkt laden kann. Gilt im Browser und auf dem Server; die Datenbank prüft dieselbe Struktur noch einmal.

export type RichMark = { type: 'bold' } | { type: 'italic' }
export type RichInline = { type: 'text'; text: string; marks?: RichMark[] } | { type: 'hardBreak' }
export type RichParagraph = { type: 'paragraph'; content?: RichInline[] }
export type RichListItem = { type: 'listItem'; content: RichParagraph[] }
export type RichList = { type: 'bulletList' | 'orderedList'; content: RichListItem[] }
export type RichBlock = RichParagraph | RichList
export type RichDoc = { type: 'doc'; content: RichBlock[] }

export const emptyDoc = (): RichDoc => ({ type: 'doc', content: [{ type: 'paragraph' }] })

// Text als Dokument: Leerzeilen trennen Absätze, einfache Zeilenumbrüche bleiben Umbrüche (Vorbelegung, Tests)
export function docFromText(text: string): RichDoc {
  const paragraphs = text.split(/\n{2,}/).map((p): RichParagraph => {
    const content: RichInline[] = []
    p.split('\n').forEach((line, i) => {
      if (i > 0) content.push({ type: 'hardBreak' })
      if (line) content.push({ type: 'text', text: line })
    })
    return content.length ? { type: 'paragraph', content } : { type: 'paragraph' }
  })
  return { type: 'doc', content: paragraphs }
}

type Loose = { type?: unknown; text?: unknown; marks?: unknown; content?: unknown }
const isObject = (v: unknown): v is Loose => typeof v === 'object' && v !== null && !Array.isArray(v)
const children = (v: Loose): unknown[] => (Array.isArray(v.content) ? v.content : [])

function normalizeMarks(marks: unknown): RichMark[] {
  if (!Array.isArray(marks)) return []
  const out: RichMark[] = []
  for (const m of marks) {
    if (!isObject(m)) continue
    if ((m.type === 'bold' || m.type === 'italic') && !out.some((x) => x.type === m.type)) out.push({ type: m.type })
  }
  // feste Reihenfolge, damit gleiche Formatierung gleich gespeichert wird
  return out.sort((a, b) => a.type.localeCompare(b.type))
}

function normalizeInline(nodes: unknown[]): RichInline[] {
  const out: RichInline[] = []
  for (const n of nodes) {
    if (!isObject(n)) continue
    if (n.type === 'hardBreak') out.push({ type: 'hardBreak' })
    else if (n.type === 'text' && typeof n.text === 'string' && n.text) {
      const marks = normalizeMarks(n.marks)
      const prev = out.at(-1)
      // gleich formatierte Nachbarn zusammenfassen
      if (prev?.type === 'text' && JSON.stringify(prev.marks ?? []) === JSON.stringify(marks)) prev.text += n.text
      else out.push(marks.length ? { type: 'text', text: n.text, marks } : { type: 'text', text: n.text })
    } else if (Array.isArray(n.content)) out.push(...normalizeInline(n.content))
  }
  return out
}

const paragraph = (content: RichInline[]): RichParagraph => (content.length ? { type: 'paragraph', content } : { type: 'paragraph' })

// Absätze eines Listenpunkts; verschachtelte Listen werden zu weiteren Punkten derselben Liste
function listItems(nodes: unknown[]): RichListItem[] {
  const items: RichListItem[] = []
  for (const n of nodes) {
    if (!isObject(n)) continue
    const paras: RichParagraph[] = []
    const nested: RichListItem[] = []
    for (const c of n.type === 'listItem' ? children(n) : [n]) {
      if (!isObject(c)) continue
      if (c.type === 'bulletList' || c.type === 'orderedList') nested.push(...listItems(children(c)))
      else paras.push(paragraph(normalizeInline(c.type === 'paragraph' ? children(c) : [c])))
    }
    items.push({ type: 'listItem', content: paras.length ? paras : [{ type: 'paragraph' }] }, ...nested)
  }
  return items
}

// Beliebiges Editor-Dokument auf die erlaubte Struktur bringen: unbekannte Knoten werden zu Absätzen bzw. Text,
// Attribute, Links, Farben usw. fallen weg.
export function normalizeDoc(input: unknown): RichDoc {
  const blocks: RichBlock[] = []
  const walk = (nodes: unknown[]) => {
    for (const n of nodes) {
      if (!isObject(n)) continue
      if (n.type === 'paragraph') blocks.push(paragraph(normalizeInline(children(n))))
      else if (n.type === 'bulletList' || n.type === 'orderedList') {
        const items = listItems(children(n))
        if (items.length) blocks.push({ type: n.type, content: items })
      } else if (n.type === 'text' || n.type === 'hardBreak') blocks.push(paragraph(normalizeInline([n])))
      else {
        // z. B. Überschrift mit Text → ein Absatz; Tabelle o. Ä. → ihre Inhalte
        const c = children(n)
        if (c.some((x) => isObject(x) && (x.type === 'text' || x.type === 'hardBreak'))) blocks.push(paragraph(normalizeInline(c)))
        else walk(c)
      }
    }
  }
  walk(isObject(input) ? children(input) : [])
  return { type: 'doc', content: blocks.length ? blocks : [{ type: 'paragraph' }] }
}

// Streng: genau die erlaubte Struktur ohne zusätzliche Angaben (Prüfung auf dem Server, am Editor vorbei)
export function isRichDoc(value: unknown): value is RichDoc {
  const keys = (v: object, allowed: string[]) => Object.keys(v).every((k) => allowed.includes(k))
  const inline = (n: unknown): boolean => {
    if (!isObject(n)) return false
    if (n.type === 'hardBreak') return keys(n, ['type'])
    if (n.type !== 'text' || typeof n.text !== 'string' || !n.text || !keys(n, ['type', 'text', 'marks'])) return false
    if (n.marks === undefined) return true
    return (
      Array.isArray(n.marks) &&
      n.marks.every((m) => isObject(m) && (m.type === 'bold' || m.type === 'italic') && keys(m, ['type'])) &&
      new Set(n.marks.map((m) => (m as Loose).type)).size === n.marks.length
    )
  }
  const para = (n: unknown): boolean =>
    isObject(n) &&
    n.type === 'paragraph' &&
    keys(n, ['type', 'content']) &&
    (n.content === undefined || (Array.isArray(n.content) && n.content.every(inline)))
  const item = (n: unknown): boolean =>
    isObject(n) && n.type === 'listItem' && keys(n, ['type', 'content']) && Array.isArray(n.content) && n.content.length > 0 && n.content.every(para)
  const block = (n: unknown): boolean =>
    para(n) ||
    (isObject(n) &&
      (n.type === 'bulletList' || n.type === 'orderedList') &&
      keys(n, ['type', 'content']) &&
      Array.isArray(n.content) &&
      n.content.length > 0 &&
      n.content.every(item))
  return isObject(value) && value.type === 'doc' && keys(value, ['type', 'content']) && Array.isArray(value.content) && value.content.every(block)
}

const paragraphText = (p: RichParagraph) => (p.content ?? []).map((n) => (n.type === 'text' ? n.text : '\n')).join('')

// Textzeilen des Dokuments (Absätze und Listenpunkte), für Länge, Platzhalter und Leer-Prüfung
export function docParagraphs(doc: RichDoc): string[] {
  return doc.content.flatMap((b) => (b.type === 'paragraph' ? [paragraphText(b)] : b.content.flatMap((i) => i.content.map(paragraphText))))
}

// Reiner Text: Absätze durch Zeilenumbruch getrennt. Zählt für die Zeichengrenzen.
export const docPlainText = (doc: RichDoc): string => docParagraphs(doc).join('\n')

// Länge ohne Formatierung; Umbrüche zwischen Absätzen zählen nicht mit
export const docLength = (doc: RichDoc): number => docParagraphs(doc).reduce((sum, p) => sum + p.replaceAll('\n', '').length, 0)

// Nur Formatierung, Leerzeichen oder Leerzeilen gelten als leer (Spec, Edge Cases)
export const isDocEmpty = (doc: RichDoc): boolean => docPlainText(doc).trim() === ''
