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
