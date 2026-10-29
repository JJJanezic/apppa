import 'server-only'

import { cache } from 'react'

import { createClient } from '@/lib/supabase/server'
import { getTenantContext } from '@/lib/tenant'
import { type VatStatusChange, vatStatusFromRows } from '@/lib/vat-status'

// Kleinunternehmer-Verlauf des gewählten Kunden (PROJ-36) – nur für Inhaber, sonst leer (Mitarbeiter sehen keine Preise).
// Einmal je Anfrage; das App-Layout reicht ihn an die Buchungsansichten weiter (PROJ-35).
export const getVatStatusHistory = cache(async (): Promise<VatStatusChange[]> => {
  const { active } = await getTenantContext()
  if (!active || active.role !== 'owner') return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('vat_status_changes')
    .select('valid_from, small_business')
    .eq('tenant_id', active.id)
    .limit(100)
  if (error) console.error('[ust] Kleinunternehmer-Status nicht lesbar', error.message)
  return vatStatusFromRows(data ?? [])
})
