import 'server-only'

import { DOCUMENT_BUCKET } from '@/lib/guests'
import { createAdminClient } from '@/lib/supabase/admin'

// Ausweisbilder löschen (PROJ-29). Nutzer dürfen im Speicher nichts löschen; das macht nur der Server,
// und nur für Dateien, die nach einer gelungenen Änderung an keinem Gast mehr hängen.
// Schlägt das Löschen fehl, räumt die tägliche Bereinigung die Dateien weg (Tech Design E).
export async function removeDocumentFiles(paths: (string | null | undefined)[]): Promise<void> {
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p)))]
  if (!unique.length) return
  const { error } = await createAdminClient().storage.from(DOCUMENT_BUCKET).remove(unique)
  if (error) console.error('[gaeste] Ausweisbilder nicht gelöscht', error.message)
}

// Bilder, die vorher verwendet wurden und jetzt nicht mehr
export function unusedPaths(before: (string | null)[], after: (string | null)[]): string[] {
  const kept = new Set(after.filter(Boolean))
  return before.filter((p): p is string => Boolean(p) && !kept.has(p))
}

// Ganzer Ordner eines gelöschten Kunden (Betreiber, PROJ-5). Blättert in Paketen, bis der Ordner leer ist.
export async function removeTenantDocuments(tenantId: string): Promise<void> {
  const storage = createAdminClient().storage.from(DOCUMENT_BUCKET)
  for (let round = 0; round < 50; round++) {
    const { data, error } = await storage.list(tenantId, { limit: 1000 })
    if (error) {
      console.error('[betreiber] Ausweisbilder des Kunden nicht lesbar', error.message)
      return
    }
    if (!data?.length) return
    const { error: removeError } = await storage.remove(data.map((f) => `${tenantId}/${f.name}`))
    if (removeError) {
      console.error('[betreiber] Ausweisbilder des Kunden nicht gelöscht', removeError.message)
      return
    }
  }
}

// Tägliche Bereinigung: Dateien, die älter als 24 Stunden sind und an keinem Gast hängen (Tech Design E)
export async function removeUnusedDocuments(): Promise<{ removed: number; failed: boolean }> {
  const admin = createAdminClient()
  let removed = 0
  for (let round = 0; round < 20; round++) {
    const { data, error } = await admin.rpc('unused_guest_documents', { p_limit: 1000 })
    if (error) {
      console.error('[bereinigung] Unbenutzte Ausweisbilder nicht lesbar', error.message)
      return { removed, failed: true }
    }
    if (!data?.length) break
    const { error: removeError } = await admin.storage.from(DOCUMENT_BUCKET).remove(data)
    if (removeError) {
      console.error('[bereinigung] Ausweisbilder nicht gelöscht', removeError.message)
      return { removed, failed: true }
    }
    removed += data.length
    if (data.length < 1000) break
  }
  return { removed, failed: false }
}
