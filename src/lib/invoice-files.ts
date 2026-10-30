import 'server-only'

import { INVOICE_BUCKET } from '@/lib/invoices'
import { createAdminClient } from '@/lib/supabase/admin'

// Rechnungs-PDFs löschen (PROJ-37). Nutzer dürfen im Speicher nichts löschen; das macht nur der Server, und nur für
// Dateien, die die Datenbank nach einer gelungenen Änderung als unbenutzt meldet (ersetzt, entfernt, Rechnung gelöscht).
// Schlägt das Löschen fehl, räumt die tägliche Bereinigung die Dateien weg (Tech Design E).
export async function removeInvoiceFiles(paths: (string | null | undefined)[]): Promise<void> {
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p)))]
  if (!unique.length) return
  const { error } = await createAdminClient().storage.from(INVOICE_BUCKET).remove(unique)
  if (error) console.error('[rechnungen] PDF nicht gelöscht', error.message)
}

// Ganzer PDF-Ordner eines gelöschten Kunden (Betreiber, PROJ-5). Blättert in Paketen, bis der Ordner leer ist.
export async function removeTenantInvoices(tenantId: string): Promise<void> {
  const storage = createAdminClient().storage.from(INVOICE_BUCKET)
  for (let round = 0; round < 50; round++) {
    const { data, error } = await storage.list(tenantId, { limit: 1000 })
    if (error) {
      console.error('[betreiber] Rechnungs-PDFs des Kunden nicht lesbar', error.message)
      return
    }
    if (!data?.length) return
    const { error: removeError } = await storage.remove(data.map((f) => `${tenantId}/${f.name}`))
    if (removeError) {
      console.error('[betreiber] Rechnungs-PDFs des Kunden nicht gelöscht', removeError.message)
      return
    }
  }
}

// Tägliche Bereinigung: PDFs, die älter als 24 Stunden sind und an keiner Rechnung hängen (Tech Design E)
export async function removeUnusedInvoicePdfs(): Promise<{ removed: number; failed: boolean }> {
  const admin = createAdminClient()
  let removed = 0
  for (let round = 0; round < 20; round++) {
    const { data, error } = await admin.rpc('unused_invoice_pdfs', { p_limit: 1000 })
    if (error) {
      console.error('[bereinigung] Unbenutzte Rechnungs-PDFs nicht lesbar', error.message)
      return { removed, failed: true }
    }
    if (!data?.length) break
    const { error: removeError } = await admin.storage.from(INVOICE_BUCKET).remove(data)
    if (removeError) {
      console.error('[bereinigung] Rechnungs-PDFs nicht gelöscht', removeError.message)
      return { removed, failed: true }
    }
    removed += data.length
    if (data.length < 1000) break
  }
  return { removed, failed: false }
}
