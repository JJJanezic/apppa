'use client'

import { useEffect, useRef, useState } from 'react'

// Zeichnet die Seiten eines PDFs (PROJ-41). Einbetten verbieten die Sicherheitsheader der App, und eingebettete PDFs
// erscheinen auf Handys uneinheitlich. pdf.js wird erst hier geladen. Der Text steht zusätzlich unsichtbar im Dokument,
// für Bildschirmleser und Tests.
type Page = { width: number; height: number; draw: (canvas: HTMLCanvasElement, cssWidth: number) => Promise<void> }

export function PdfPages({ bytes, label, onFailed }: { bytes: Uint8Array; label: string; onFailed: () => void }) {
  const [pages, setPages] = useState<Page[]>([])
  const [text, setText] = useState<string[]>([])
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    if (!box.current) return
    const observer = new ResizeObserver((entries) => setWidth(Math.floor(entries[0].contentRect.width)))
    observer.observe(box.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false
    let destroy: (() => void) | undefined
    void (async () => {
      try {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
        pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString()
        // pdf.js übernimmt die Bytes: Kopie, damit dieselbe Fassung nochmals gezeichnet oder geöffnet werden kann
        const task = pdfjs.getDocument({ data: bytes.slice() })
        destroy = () => void task.destroy()
        const doc = await task.promise
        const loaded: Page[] = []
        const texts: string[] = []
        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n)
          const base = page.getViewport({ scale: 1 })
          const content = await page.getTextContent()
          texts.push(content.items.map((i) => ('str' in i ? i.str + (i.hasEOL ? '\n' : ' ') : '')).join(''))
          loaded.push({
            width: base.width,
            height: base.height,
            draw: async (canvas, cssWidth) => {
              const ratio = window.devicePixelRatio || 1
              const viewport = page.getViewport({ scale: (cssWidth / base.width) * ratio })
              canvas.width = viewport.width
              canvas.height = viewport.height
              await page.render({ canvas, viewport }).promise
            },
          })
        }
        if (!cancelled) {
          setPages(loaded)
          setText(texts)
        }
      } catch (e) {
        if (!cancelled) {
          console.error('[rechnung-pdf] Anzeige fehlgeschlagen', e)
          onFailed()
        }
      }
    })()
    return () => {
      cancelled = true
      destroy?.()
    }
    // onFailed ändert nichts an der Darstellung
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bytes])

  return (
    <div ref={box} role="article" aria-label={label} className="flex w-full min-w-0 flex-col gap-3">
      <div className="sr-only" data-testid="pdf-text">
        {text.map((t, i) => (
          <p key={i}>{t}</p>
        ))}
      </div>
      {width > 0 && pages.map((p, i) => <PageCanvas key={i} page={p} width={width} />)}
    </div>
  )
}

function PageCanvas({ page, width }: { page: Page; width: number }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    if (!ref.current) return
    page.draw(ref.current, width).catch(() => undefined)
  }, [page, width])
  return <canvas ref={ref} aria-hidden="true" className="h-auto w-full rounded border border-ds-neutral-400 bg-white" />
}
