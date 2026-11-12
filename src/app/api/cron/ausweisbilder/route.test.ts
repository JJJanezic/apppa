// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const removeUnusedDocuments = vi.fn()
vi.mock('@/lib/guest-documents', () => ({ removeUnusedDocuments: () => removeUnusedDocuments() }))
const removeUnusedInvoicePdfs = vi.fn()
vi.mock('@/lib/invoice-files', () => ({ removeUnusedInvoicePdfs: () => removeUnusedInvoicePdfs() }))
const removeUnusedLogos = vi.fn()
vi.mock('@/lib/tenant-logo-files', () => ({ removeUnusedLogos: () => removeUnusedLogos() }))
const removeUnusedReceipts = vi.fn()
vi.mock('@/lib/payment-files', () => ({ removeUnusedReceipts: () => removeUnusedReceipts() }))
const removeUnusedGuestSheetFiles = vi.fn()
vi.mock('@/lib/guest-sheet-files', () => ({ removeUnusedGuestSheetFiles: () => removeUnusedGuestSheetFiles() }))
const removeUnusedConsentReceipts = vi.fn()
vi.mock('@/lib/consent-files', () => ({ removeUnusedConsentReceipts: () => removeUnusedConsentReceipts() }))

import { GET } from './route'

const call = (authorization?: string) =>
  GET(new Request('http://localhost/api/cron/ausweisbilder', { headers: authorization ? { authorization } : {} }))

describe('Bereinigung der Ausweisbilder, Rechnungs-PDFs, Logos, Zahlungsbelege, Gästeblätter und Einwilligungsbelege (Cron)', () => {
  beforeEach(() => {
    vi.stubEnv('CRON_SECRET', 'geheim-1234567890')
    removeUnusedDocuments.mockReset().mockResolvedValue({ removed: 3, failed: false })
    removeUnusedInvoicePdfs.mockReset().mockResolvedValue({ removed: 2, failed: false })
    removeUnusedLogos.mockReset().mockResolvedValue({ removed: 1, failed: false })
    removeUnusedReceipts.mockReset().mockResolvedValue({ removed: 4, failed: false })
    removeUnusedGuestSheetFiles.mockReset().mockResolvedValue({ removed: 5, failed: false })
    removeUnusedConsentReceipts.mockReset().mockResolvedValue({ removed: 6, failed: false })
  })
  afterEach(() => vi.unstubAllEnvs())

  it('lehnt Aufrufe ohne oder mit falschem Schlüssel ab', async () => {
    expect((await call()).status).toBe(401)
    expect((await call('Bearer falsch')).status).toBe(401)
    expect(removeUnusedDocuments).not.toHaveBeenCalled()
    expect(removeUnusedInvoicePdfs).not.toHaveBeenCalled()
    expect(removeUnusedLogos).not.toHaveBeenCalled()
    expect(removeUnusedReceipts).not.toHaveBeenCalled()
    expect(removeUnusedGuestSheetFiles).not.toHaveBeenCalled()
    expect(removeUnusedConsentReceipts).not.toHaveBeenCalled()
  })

  it('läuft nicht, wenn kein Schlüssel eingerichtet ist', async () => {
    vi.stubEnv('CRON_SECRET', '')
    expect((await call('Bearer ')).status).toBe(401)
    expect(removeUnusedDocuments).not.toHaveBeenCalled()
  })

  it('bereinigt mit richtigem Schlüssel', async () => {
    const response = await call('Bearer geheim-1234567890')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ removed: 3, invoicePdfsRemoved: 2, logosRemoved: 1, receiptsRemoved: 4, guestSheetFilesRemoved: 5, consentReceiptsRemoved: 6, failed: false })
  })

  it('meldet Fehler mit Status 500', async () => {
    removeUnusedDocuments.mockResolvedValue({ removed: 0, failed: true })
    expect((await call('Bearer geheim-1234567890')).status).toBe(500)
  })

  it('meldet Fehler der Gästeblatt-Dateien (PROJ-26)', async () => {
    removeUnusedGuestSheetFiles.mockResolvedValue({ removed: 0, failed: true })
    expect((await call('Bearer geheim-1234567890')).status).toBe(500)
  })

  it('meldet Fehler der Einwilligungsbelege (PROJ-19) und bereinigt die übrigen Bereiche', async () => {
    removeUnusedConsentReceipts.mockResolvedValue({ removed: 0, failed: true })
    expect((await call('Bearer geheim-1234567890')).status).toBe(500)
    expect(removeUnusedReceipts).toHaveBeenCalledTimes(1)
  })

  it('bereinigt die Rechnungs-PDFs auch, wenn die Ausweisbilder scheitern, und meldet den Fehler', async () => {
    removeUnusedInvoicePdfs.mockResolvedValue({ removed: 0, failed: true })
    expect((await call('Bearer geheim-1234567890')).status).toBe(500)
    removeUnusedInvoicePdfs.mockResolvedValue({ removed: 1, failed: false })
    removeUnusedDocuments.mockResolvedValue({ removed: 0, failed: true })
    expect((await call('Bearer geheim-1234567890')).status).toBe(500)
    expect(removeUnusedInvoicePdfs).toHaveBeenCalledTimes(2)
  })

  it('bereinigt die übrigen Bereiche auch, wenn die Logos scheitern, und meldet den Fehler', async () => {
    removeUnusedLogos.mockResolvedValue({ removed: 0, failed: true })
    expect((await call('Bearer geheim-1234567890')).status).toBe(500)
    expect(removeUnusedDocuments).toHaveBeenCalledTimes(1)
    expect(removeUnusedInvoicePdfs).toHaveBeenCalledTimes(1)
  })

  it('bereinigt die übrigen Bereiche auch, wenn die Belege scheitern, und meldet den Fehler', async () => {
    removeUnusedReceipts.mockResolvedValue({ removed: 0, failed: true })
    expect((await call('Bearer geheim-1234567890')).status).toBe(500)
    expect(removeUnusedDocuments).toHaveBeenCalledTimes(1)
    expect(removeUnusedLogos).toHaveBeenCalledTimes(1)
  })
})
