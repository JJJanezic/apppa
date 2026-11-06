import 'server-only'

import { RECEIPT_BUCKET } from '@/lib/payments'
import { createAdminClient } from '@/lib/supabase/admin'

// Belege der Zahlungen löschen (PROJ-45). Nutzer dürfen im Speicher nichts löschen; das macht nur der Server, und nur für
// Dateien, die die Datenbank nach einer gelungenen Änderung als unbenutzt meldet (ersetzt, entfernt, Zahlung gelöscht).
// Schlägt das Löschen fehl, räumt die tägliche Bereinigung die Dateien weg.
export async function removeReceiptFiles(paths: (string | null | undefined)[]): Promise<void> {
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p)))]
  if (!unique.length) return
  const { error } = await createAdminClient().storage.from(RECEIPT_BUCKET).remove(unique)
  if (error) console.error('[zahlungen] Beleg nicht gelöscht', error.message)
}
