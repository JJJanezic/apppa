import 'server-only'

import { createAdminClient } from '@/lib/supabase/admin'
import { LOGO_BUCKET } from '@/lib/tenant-logo'

// Logos löschen (PROJ-38). Nutzer dürfen im Speicher nichts löschen; das macht nur der Server, und nur für Dateien,
// die die Datenbank nach einer gelungenen Änderung als unbenutzt meldet (ersetzt oder entfernt).
// Schlägt das Löschen fehl, räumt die tägliche Bereinigung die Datei weg (Tech Design E).
export async function removeLogoFile(path: string | null | undefined): Promise<void> {
  if (!path) return
  const { error } = await createAdminClient().storage.from(LOGO_BUCKET).remove([path])
  if (error) console.error('[stammdaten] Logo nicht gelöscht', error.message)
}

// Ganzer Logo-Ordner eines gelöschten Kunden (Betreiber, PROJ-5). Blättert in Paketen, bis der Ordner leer ist.
export async function removeTenantLogos(tenantId: string): Promise<void> {
  const storage = createAdminClient().storage.from(LOGO_BUCKET)
  for (let round = 0; round < 50; round++) {
    const { data, error } = await storage.list(tenantId, { limit: 1000 })
    if (error) {
      console.error('[betreiber] Logos des Kunden nicht lesbar', error.message)
      return
    }
    if (!data?.length) return
    const { error: removeError } = await storage.remove(data.map((f) => `${tenantId}/${f.name}`))
    if (removeError) {
      console.error('[betreiber] Logos des Kunden nicht gelöscht', removeError.message)
      return
    }
  }
}

// Tägliche Bereinigung: Logos, die älter als 24 Stunden sind und an keinem Kunden hängen (Tech Design E)
export async function removeUnusedLogos(): Promise<{ removed: number; failed: boolean }> {
  const admin = createAdminClient()
  let removed = 0
  for (let round = 0; round < 20; round++) {
    const { data, error } = await admin.rpc('unused_tenant_logos', { p_limit: 1000 })
    if (error) {
      console.error('[bereinigung] Unbenutzte Logos nicht lesbar', error.message)
      return { removed, failed: true }
    }
    if (!data?.length) break
    const { error: removeError } = await admin.storage.from(LOGO_BUCKET).remove(data)
    if (removeError) {
      console.error('[bereinigung] Logos nicht gelöscht', removeError.message)
      return { removed, failed: true }
    }
    removed += data.length
    if (data.length < 1000) break
  }
  return { removed, failed: false }
}
