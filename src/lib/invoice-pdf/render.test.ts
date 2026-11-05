import { describe, expect, it, vi } from 'vitest'

import type { PdfView } from '@/lib/invoice-pdf/types'

// Arbeitsprozesse sind hier Attrappen: geprüft wird nur die Begrenzung (BUG-6 aus PROJ-42)
const state = vi.hoisted(() => ({ running: 0, peak: 0, started: 0 }))

vi.mock('server-only', () => ({}))
vi.mock('node:worker_threads', async () => {
  const { EventEmitter } = await import('node:events')
  class Worker extends EventEmitter {
    constructor() {
      super()
      state.started++
      state.running++
      state.peak = Math.max(state.peak, state.running)
      setTimeout(() => {
        state.running--
        this.emit('message', { ok: true, result: { pdf: new Uint8Array(), pages: 1 } })
      }, 5)
    }
    terminate() {}
  }
  return { Worker, default: { Worker } }
})

describe('renderInvoicePdf', () => {
  it('begrenzt die Arbeitsprozesse, lässt weitere warten, lehnt darüber hinaus ab und arbeitet danach weiter', async () => {
    const { renderInvoicePdf, PdfBusyError } = await import('@/lib/invoice-pdf/render')
    const results = await Promise.allSettled(Array.from({ length: 17 }, () => renderInvoicePdf({} as PdfView)))
    const rejected = results.filter((r) => r.status === 'rejected')
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(15)
    expect(rejected).toHaveLength(2)
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(PdfBusyError)
    expect(state.peak).toBe(3)
    expect(state.started).toBe(15)
    await expect(renderInvoicePdf({} as PdfView)).resolves.toMatchObject({ pages: 1 })
  })
})
