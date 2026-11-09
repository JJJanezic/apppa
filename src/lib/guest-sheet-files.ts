import 'server-only'

import { GUEST_SHEET_BUCKET } from '@/lib/guest-sheet'
import { createAdminClient } from '@/lib/supabase/admin'

// Dateien der Gästeblätter (PROJ-26): PDFs und Unterschriften. Nutzer dürfen im Speicher nichts löschen; das macht nur der
// Server. Gästeblätter selbst werden nie einzeln gelöscht, nur mit dem ganzen Kunden.

// Ganzer Ordner eines gelöschten Kunden (Betreiber, PROJ-5). Blättert in Paketen, bis der Ordner leer ist.
export async function removeTenantGuestSheets(tenantId: string): Promise<void> {
  const storage = createAdminClient().storage.from(GUEST_SHEET_BUCKET)
  for (let round = 0; round < 50; round++) {
    const { data, error } = await storage.list(tenantId, { limit: 1000 })
    if (error) {
      console.error('[betreiber] Gästeblätter des Kunden nicht lesbar', error.message)
      return
    }
    if (!data?.length) return
    const { error: removeError } = await storage.remove(data.map((f) => `${tenantId}/${f.name}`))
    if (removeError) {
      console.error('[betreiber] Gästeblätter des Kunden nicht gelöscht', removeError.message)
      return
    }
  }
}

// Tägliche Bereinigung: Dateien älter als 24 Stunden, auf die kein Gästeblatt zeigt (Hochladen ohne Eintragen,
// abgebrochenes Fertigstellen, Reste gelöschter Kunden)
export async function removeUnusedGuestSheetFiles(): Promise<{ removed: number; failed: boolean }> {
  const admin = createAdminClient()
  let removed = 0
  for (let round = 0; round < 20; round++) {
    const { data, error } = await admin.rpc('unused_guest_sheet_files', { p_limit: 1000 })
    if (error) {
      console.error('[bereinigung] Unbenutzte Gästeblatt-Dateien nicht lesbar', error.message)
      return { removed, failed: true }
    }
    if (!data?.length) break
    const { error: removeError } = await admin.storage.from(GUEST_SHEET_BUCKET).remove(data)
    if (removeError) {
      console.error('[bereinigung] Gästeblatt-Dateien nicht gelöscht', removeError.message)
      return { removed, failed: true }
    }
    removed += data.length
    if (data.length < 1000) break
  }
  return { removed, failed: false }
}
