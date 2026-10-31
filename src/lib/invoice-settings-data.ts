import 'server-only'

import { notFound } from 'next/navigation'

import { getSessionUser } from '@/lib/auth/session'
import {
  INVOICE_SETTINGS_COLUMNS,
  type InvoiceSettingsData,
  invoiceSettingsFromRows,
  TEXT_BLOCK_COLUMNS,
} from '@/lib/invoice-settings'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext } from '@/lib/tenant'

// Lesefunktionen für Einstellungen → Rechnungen (PROJ-39). Lesen dürfen nur Inhaber des Kunden und der Betreiber;
// die Datenbank (RLS) prüft das zusätzlich, Mitarbeiter sehen keine Zeile.

// null: Einstellungen nicht lesbar (z. B. Migration fehlt); die Seite zeigt dann einen Hinweis
export async function loadInvoiceSettings(tenantId: string): Promise<InvoiceSettingsData | null> {
  if (!/^[0-9a-f-]{36}$/i.test(tenantId)) return null
  const supabase = await createClient()
  const [settings, blocks, numbers, issued] = await Promise.all([
    supabase.from('invoice_settings').select(INVOICE_SETTINGS_COLUMNS).eq('tenant_id', tenantId).maybeSingle(),
    supabase.from('invoice_text_blocks').select(TEXT_BLOCK_COLUMNS).eq('tenant_id', tenantId).limit(100),
    // alle Nummern als ein Wert: Zeilenabfragen kappt PostgREST bei 1.000 (BUG-3 aus QA)
    supabase.rpc('invoice_numbers', { p_tenant_id: tenantId }),
    // nur in der App ausgestellte Rechnungen; Entwürfe (PROJ-40) lösen die Warnung nicht aus
    supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId).eq('origin', 'issued'),
  ])
  for (const [label, r] of [
    ['Einstellungen', settings],
    ['Bausteine', blocks],
    ['Nummern', numbers],
    ['ausgestellte', issued],
  ] as const) {
    if (r.error) console.error(`[rechnungseinstellungen] ${label} nicht lesbar`, r.error.message)
  }
  if (!settings.data) return null
  return invoiceSettingsFromRows(
    settings.data,
    blocks.data ?? [],
    numbers.data ?? [],
    (issued.count ?? 0) > 0
  )
}

// Einstellungen → Rechnungen des gewählten Kunden – nur für Inhaber
export async function getOwnInvoiceSettings(): Promise<{ tenantId: string; data: InvoiceSettingsData | null }> {
  const [user, { active }] = await Promise.all([getSessionUser(), getTenantContext()])
  if (!user || !active || active.role !== 'owner') notFound()
  return { tenantId: active.id, data: await loadInvoiceSettings(active.id) }
}
