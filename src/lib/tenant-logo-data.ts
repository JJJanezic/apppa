import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { LOGO_BUCKET } from '@/lib/tenant-logo'

// Abruf-Link des Kunden-Logos (PROJ-38): 10 Minuten gültig, nur für Inhaber des Kunden und Betreiber-Admin
// (Zugriffsregeln des Speichers). Ohne Logo oder bei Fehler: null.
export const LOGO_LINK_SECONDS = 600

export async function logoLink(path: string | null): Promise<string | null> {
  if (!path) return null
  const supabase = await createClient()
  const { data, error } = await supabase.storage.from(LOGO_BUCKET).createSignedUrl(path, LOGO_LINK_SECONDS)
  if (error || !data) {
    console.error('[stammdaten] Logo nicht abrufbar', error?.message)
    return null
  }
  return data.signedUrl
}

// Hochladen vorbereiten: zufälliger Speicherort im Ordner des Kunden und Upload-Schlüssel.
// Ob die Person dort hochladen darf (Inhaber bzw. Admin, aktiver Kunde), entscheiden die Zugriffsregeln des Speichers.
export async function prepareLogoUploadFor(tenantId: string): Promise<{ path: string; token: string } | null> {
  const path = `${tenantId}/${crypto.randomUUID()}.png`
  const supabase = await createClient()
  const { data, error } = await supabase.storage.from(LOGO_BUCKET).createSignedUploadUrl(path)
  if (error || !data) {
    console.error('[stammdaten] Logo-Upload nicht vorbereitet', error?.message)
    return null
  }
  return { path: data.path, token: data.token }
}
