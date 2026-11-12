import 'server-only'

import { CONSENT_RECEIPT_BUCKET } from '@/lib/marketing-consent'
import { createAdminClient } from '@/lib/supabase/admin'

// Belege der Marketing-Einwilligung (PROJ-19). Nutzer dürfen im Speicher nichts löschen; das macht nur der Server: nach dem
// Anonymisieren oder Löschen eines Gastes, beim Löschen eines Kunden und in der täglichen Bereinigung.

export async function removeConsentReceiptFiles(paths: (string | null | undefined)[]): Promise<void> {
  const unique = [...new Set(paths.filter((p): p is string => Boolean(p)))]
  if (!unique.length) return
  const { error } = await createAdminClient().storage.from(CONSENT_RECEIPT_BUCKET).remove(unique)
  if (error) console.error('[einwilligung] Beleg nicht gelöscht', error.message)
}

// Ganzer Beleg-Ordner eines gelöschten Kunden (Betreiber, PROJ-5). Blättert in Paketen, bis der Ordner leer ist.
export async function removeTenantConsentReceipts(tenantId: string): Promise<void> {
  const storage = createAdminClient().storage.from(CONSENT_RECEIPT_BUCKET)
  for (let round = 0; round < 50; round++) {
    const { data, error } = await storage.list(tenantId, { limit: 1000 })
    if (error) {
      console.error('[betreiber] Einwilligungsbelege des Kunden nicht lesbar', error.message)
      return
    }
    if (!data?.length) return
    const { error: removeError } = await storage.remove(data.map((f) => `${tenantId}/${f.name}`))
    if (removeError) {
      console.error('[betreiber] Einwilligungsbelege des Kunden nicht gelöscht', removeError.message)
      return
    }
  }
}

// Tägliche Bereinigung: Belege älter als 24 Stunden ohne Eintrag (Hochladen ohne Speichern, Anonymisieren, gelöschte Gäste)
export async function removeUnusedConsentReceipts(): Promise<{ removed: number; failed: boolean }> {
  const admin = createAdminClient()
  let removed = 0
  for (let round = 0; round < 20; round++) {
    const { data, error } = await admin.rpc('unused_marketing_consent_receipts', { p_limit: 1000 })
    if (error) {
      console.error('[bereinigung] Unbenutzte Einwilligungsbelege nicht lesbar', error.message)
      return { removed, failed: true }
    }
    if (!data?.length) break
    const { error: removeError } = await admin.storage.from(CONSENT_RECEIPT_BUCKET).remove(data)
    if (removeError) {
      console.error('[bereinigung] Einwilligungsbelege nicht gelöscht', removeError.message)
      return { removed, failed: true }
    }
    removed += data.length
    if (data.length < 1000) break
  }
  return { removed, failed: false }
}
