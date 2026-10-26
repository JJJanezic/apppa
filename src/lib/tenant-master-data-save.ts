import 'server-only'

import type { ActionResult, CommonErrorCode } from '@/lib/auth/result'
import type { createClient } from '@/lib/supabase/server'
import type { TenantMasterDataErrorCode } from '@/lib/tenant-master-data'
import type { TenantMasterDataValues } from '@/lib/validation/tenant'

// Speichern der Kundenstammdaten (PROJ-28), gemeinsam für Inhaber- und Betreiber-Aktion.
// Die Datenbank-Funktion prüft Rolle, Aktiv-Status und Stand selbst und schreibt das Betreiber-Protokoll.

// Fehlercodes der Datenbank-Funktion → Meldungen
const DB_ERRORS: Record<string, TenantMasterDataErrorCode | CommonErrorCode> = {
  '42501': 'sessionExpired',
  P0011: 'tenantGone',
  P0016: 'staleTenant',
  P0017: 'tenantDeactivated',
}

export async function saveTenantMasterData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  updatedAt: string,
  v: TenantMasterDataValues
): Promise<ActionResult<undefined, TenantMasterDataErrorCode>> {
  const { error } = await supabase.rpc('update_tenant_master_data', {
    p_tenant_id: tenantId,
    p_expected_updated_at: updatedAt,
    p_data: {
      name: v.name,
      name_line2: v.nameLine2,
      address_line1: v.addressLine1,
      address_line2: v.addressLine2,
      postal_code: v.postalCode,
      city: v.city,
      country: v.country,
      vat_id: v.vatId,
      tax_number: v.taxNumber,
      register_number: v.registerNumber,
    },
  })
  if (error) {
    const mapped = error.code ? DB_ERRORS[error.code] : undefined
    if (!mapped) console.error('[stammdaten] nicht gespeichert', error.code, error.message)
    return { ok: false, error: mapped ?? 'unknown' }
  }
  return { ok: true }
}
