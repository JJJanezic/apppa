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
