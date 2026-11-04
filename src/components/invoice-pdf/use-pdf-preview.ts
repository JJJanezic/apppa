'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { PDF_META_HEADER, type PdfMeta } from '@/lib/invoice-pdf/types'

export type PdfPreviewState = {
  bytes: Uint8Array | null
  meta: PdfMeta | null
  loading: boolean
  failed: boolean
  retry: () => void
}

// Lädt die PDF-Vorschau vom Server (PROJ-41). Eine neue Anfrage bricht die laufende ab: Eine ältere Fassung kann die neuere
// nie ersetzen. Bis die neue fertig ist, bleibt die alte sichtbar. body null: nichts anfordern (z. B. ungültige Eingabe).
export function usePdfPreview(url: string, body: string | null, debounceMs: number): PdfPreviewState {
  const [state, setState] = useState<Omit<PdfPreviewState, 'retry'>>({ bytes: null, meta: null, loading: body !== null, failed: false })
  const [attempt, setAttempt] = useState(0)
  const controller = useRef<AbortController | null>(null)

  useEffect(() => {
    if (body === null) {
      controller.current?.abort()
      setState((s) => ({ ...s, loading: false }))
      return
    }
    const timer = setTimeout(async () => {
      controller.current?.abort()
      const c = new AbortController()
      controller.current = c
      setState((s) => ({ ...s, loading: true, failed: false }))
      try {
        const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body, signal: c.signal })
        if (!res.ok) throw new Error(String(res.status))
        const bytes = new Uint8Array(await res.arrayBuffer())
        const meta = JSON.parse(res.headers.get(PDF_META_HEADER) ?? 'null') as PdfMeta | null
        if (!c.signal.aborted) setState({ bytes, meta, loading: false, failed: false })
      } catch {
        if (!c.signal.aborted) setState((s) => ({ ...s, loading: false, failed: true }))
      }
    }, debounceMs)
    return () => clearTimeout(timer)
  }, [url, body, debounceMs, attempt])

  useEffect(() => () => controller.current?.abort(), [])

  const retry = useCallback(() => setAttempt((a) => a + 1), [])
  return { ...state, retry }
}
