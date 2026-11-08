import 'server-only'

import { Worker } from 'node:worker_threads'

import type { PdfResult, PdfView } from '@/lib/invoice-pdf/types'
import type { StatsPdfResult, StatsPdfView } from '@/lib/statistics-pdf/types'
import type { TaxPdfResult, TaxPdfView } from '@/lib/tourist-tax-pdf/types'

const TIMEOUT_MS = 20_000

// Über ein Feld statt fester Zeichenkette: Der Next-Build soll diese Datei nicht analysieren; sie liegt fertig gebaut vor
// und wird über outputFileTracingIncludes (next.config.ts) mitgeliefert.
const workerFile = () => [process.cwd(), 'pdf-worker-build', 'render-worker.mjs'].join('/')

// Höchstens so viele Arbeitsprozesse je Server-Instanz, weitere warten; ist auch die Warteschlange voll, wird abgelehnt.
// Jeder Prozess braucht bis zu 256 MB. Das begrenzt die Last, keine einzelne Person (BUG-6 aus PROJ-42).
const MAX_RUNNING = 3
const MAX_WAITING = 12
let running = 0
const waiting: (() => void)[] = []

export class PdfBusyError extends Error {}

async function acquire() {
  if (running < MAX_RUNNING) {
    running++
    return
  }
  if (waiting.length >= MAX_WAITING) throw new PdfBusyError('PDF-Erzeugung ausgelastet')
  // Der Platz geht direkt vom endenden Prozess auf den wartenden über
  await new Promise<void>((resolve) => waiting.push(resolve))
}

function release() {
  const next = waiting.shift()
  if (next) next()
  else running--
}

// Erzeugt das PDF in einem eigenen, kurzlebigen Arbeitsprozess (siehe render-worker.ts)
export async function renderInvoicePdf(view: PdfView): Promise<PdfResult> {
  await acquire()
  try {
    return await runWorker<PdfResult>(view)
  } finally {
    release()
  }
}

// Ortstaxen-Bericht (PROJ-16): derselbe Arbeitsprozess, dieselbe Lastgrenze
export async function renderTaxReportPdf(view: TaxPdfView): Promise<TaxPdfResult> {
  await acquire()
  try {
    return await runWorker<TaxPdfResult>(view)
  } finally {
    release()
  }
}

// Auswertung (PROJ-18): derselbe Arbeitsprozess, dieselbe Lastgrenze
export async function renderStatsPdf(view: StatsPdfView): Promise<StatsPdfResult> {
  await acquire()
  try {
    return await runWorker<StatsPdfResult>(view)
  } finally {
    release()
  }
}

function runWorker<R>(view: PdfView | TaxPdfView | StatsPdfView): Promise<R> {
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
    worker.once('message', (m: { ok: true; result: R } | { ok: false; message: string }) =>
      finish(() => (m.ok ? resolve(m.result) : reject(new Error(m.message))))
    )
    worker.once('error', (e) => finish(() => reject(e)))
    worker.once('exit', () => finish(() => reject(new Error('PDF-Arbeitsprozess unerwartet beendet'))))
  })
}
