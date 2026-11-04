import 'server-only'

import { Worker } from 'node:worker_threads'

import type { PdfResult, PdfView } from '@/lib/invoice-pdf/types'

const TIMEOUT_MS = 20_000

// Über ein Feld statt fester Zeichenkette: Der Next-Build soll diese Datei nicht analysieren; sie liegt fertig gebaut vor
// und wird über outputFileTracingIncludes (next.config.ts) mitgeliefert.
const workerFile = () => [process.cwd(), 'pdf-worker-build', 'render-worker.mjs'].join('/')

// Erzeugt das PDF in einem eigenen, kurzlebigen Arbeitsprozess (siehe render-worker.ts)
export function renderInvoicePdf(view: PdfView): Promise<PdfResult> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerFile(), { workerData: view, resourceLimits: { maxOldGenerationSizeMb: 256 } })
    const timer = setTimeout(() => finish(() => reject(new Error('PDF-Erzeugung dauert zu lange'))), TIMEOUT_MS)
    let done = false
    function finish(settle: () => void) {
      if (done) return
      done = true
      clearTimeout(timer)
      void worker.terminate()
      settle()
    }
    worker.once('message', (m: { ok: true; result: PdfResult } | { ok: false; message: string }) =>
      finish(() => (m.ok ? resolve(m.result) : reject(new Error(m.message))))
    )
    worker.once('error', (e) => finish(() => reject(e)))
    worker.once('exit', () => finish(() => reject(new Error('PDF-Arbeitsprozess unerwartet beendet'))))
  })
}
