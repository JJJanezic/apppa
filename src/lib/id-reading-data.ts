import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { cache } from 'react'

import { isMissingRelation } from '@/lib/guest-sheets-data'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext } from '@/lib/tenant'

// Lesefunktionen für „Ausweis automatisch auslesen“ (PROJ-51). Einstellungen je Kunde in einer eigenen Tabelle (wie
// „Gästeblätter nacherfassen“, QA BUG-6 aus PROJ-26: Umschalten ändert nicht den Stand der Stammdaten); keine Zeile = aus.
// Rechte prüft die Datenbank (RLS: Mitglieder lesen die Zeile ihres Kunden, der Betreiber alle).
// Fehlt die Tabelle (Umgebung ohne Migration), ist die Funktion aus – außer der Test-Leser ist aktiv (Vorschau in Dev).

export const ID_READING_DEFAULT_LIMIT = 50

export type IdReadingSettings = {
  enabled: boolean
  dailyLimit: number
  // Inhaber hat den Hinweis „Datenschutz-Text prüfen“ bestätigt
  privacyHintSeen: boolean
  // Tabelle vorhanden (sonst Speichern „wird gerade eingerichtet“)
  ready: boolean
}

export type IdReadingUsage = { thisMonth: number; lastMonth: number }

const untyped = async () => (await createClient()) as unknown as SupabaseClient
const isId = (v: string) => /^[0-9a-f-]{36}$/i.test(v)

// Test-Leser statt KI: nur außerhalb der Produktion und nur mit ID_READING_FAKE=1
export const fakeReaderActive = () => process.env.ID_READING_FAKE === '1' && process.env.VERCEL_ENV !== 'production'

type SettingsDb = { enabled: boolean; daily_limit: number; privacy_hint_seen_at: string | null }

export async function loadIdReadingSettings(tenantId: string): Promise<IdReadingSettings> {
  const off: IdReadingSettings = { enabled: false, dailyLimit: ID_READING_DEFAULT_LIMIT, privacyHintSeen: true, ready: false }
  if (!isId(tenantId)) return off
  const supabase = await untyped()
  const { data, error } = await supabase
    .from('id_reading_settings')
    .select('enabled, daily_limit, privacy_hint_seen_at')
    .eq('tenant_id', tenantId)
    .maybeSingle()
  if (error) {
    if (!isMissingRelation(error)) console.error('[ausweis] Einstellungen nicht lesbar', error.code, error.message)
    return { ...off, enabled: isMissingRelation(error) && fakeReaderActive() }
  }
  const row = data as SettingsDb | null
  return {
    enabled: row?.enabled ?? false,
    dailyLimit: row?.daily_limit ?? ID_READING_DEFAULT_LIMIT,
    privacyHintSeen: row ? row.privacy_hint_seen_at !== null : true,
    ready: true,
  }
}

// Für das App-Layout: Ist das Auslesen beim gewählten Kunden eingeschaltet?
export const getIdReadingEnabled = cache(async (): Promise<boolean> => {
  const { active } = await getTenantContext()
  if (!active) return false
  return (await loadIdReadingSettings(active.id)).enabled
})

// Betreiber: Auslesungen im laufenden und im letzten Monat (Wiener Zeit), gezählt wie das Tageslimit
export async function loadIdReadingUsage(tenantId: string): Promise<IdReadingUsage> {
  if (!isId(tenantId)) return { thisMonth: 0, lastMonth: 0 }
  const supabase = await untyped()
  const { data, error } = await supabase.rpc('id_reading_usage', { p_tenant_id: tenantId })
  if (error) {
    if (!isMissingRelation(error)) console.error('[ausweis] Verbrauch nicht lesbar', error.code, error.message)
    return { thisMonth: 0, lastMonth: 0 }
  }
  const row = (Array.isArray(data) ? data[0] : data) as { this_month?: number; last_month?: number } | null
  return { thisMonth: row?.this_month ?? 0, lastMonth: row?.last_month ?? 0 }
}
