// Eingefügtes HTML für den Rechnungstext-Editor vorbereiten (PROJ-39, nur im Browser).
// Der Editor kennt keine Tabellen. Zellen und Zeilen zählen für ProseMirror nicht als Blöcke, ihr Text liefe deshalb
// ohne Trennung zusammen („Zelle AZelle B“, BUG-4 aus QA). Jede Tabelle wird durch ihre Zellen als eigene Blöcke
// ersetzt (je Zelle ein Absatz), verschachtelte Tabellen von innen nach außen.
export function tablesToBlocks(html: string): string {
  if (!/<table[\s>]/i.test(html)) return html
  const doc = new DOMParser().parseFromString(html, 'text/html')
  for (;;) {
    const table = Array.from(doc.querySelectorAll('table')).find((t) => !t.querySelector('table'))
    if (!table) break
    const blocks = Array.from(table.querySelectorAll('td, th')).map((cell) => {
      const block = doc.createElement('div')
      block.append(...Array.from(cell.childNodes))
      return block
    })
    table.replaceWith(...blocks)
  }
  return doc.body.innerHTML
}
