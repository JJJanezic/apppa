import 'server-only'

import type { ActionResult, CommonErrorCode } from '@/lib/auth/result'
import type { createClient } from '@/lib/supabase/server'
import type { TenantMasterDataErrorCode } from '@/lib/tenant-master-data'
import { removeLogoFile } from '@/lib/tenant-logo-files'
import type { TenantMasterDataValues } from '@/lib/validation/tenant'

// Speichern der Kundenstammdaten (PROJ-28), gemeinsam für Inhaber- und Betreiber-Aktion.
// Die Datenbank-Funktion prüft Rolle, Aktiv-Status und Stand selbst und schreibt das Betreiber-Protokoll.
// Sie meldet ein ersetztes oder entferntes Logo (PROJ-38), das der Server danach löscht.

// Fehlercodes der Datenbank-Funktion → Meldungen
const DB_ERRORS: Record<string, TenantMasterDataErrorCode | CommonErrorCode> = {
  '42501': 'sessionExpired',
  P0011: 'tenantGone',
  // P0016 kommt aus private.lock_tenant (wie im Betreiber-Bereich)
  P0016: 'tenantDeactivated',
  P0017: 'staleTenant',
  // zwei Statuswechsel am selben Tag (PROJ-36); doppelte IBAN unterscheidet die Meldung (PROJ-46)
  '23505': 'vatDateDuplicate',
  // Konto wird inzwischen von einer Wohnung verwendet (PROJ-46)
  '23503': 'bankAccountInUse',
  // Primär-Regeln oder Höchstzahl der Bankkonten verletzt (PROJ-46)
  P0019: 'bankAccountsInvalid',
  // Logo fehlt im Speicher oder liegt nicht im Ordner des Kunden (PROJ-38)
  P0018: 'logoMissing',
}

export async function saveTenantMasterData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tenantId: string,
  updatedAt: string,
  v: TenantMasterDataValues
): Promise<ActionResult<undefined, TenantMasterDataErrorCode>> {
  const { data, error } = await supabase.rpc('update_tenant_master_data', {
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
      // PROJ-26
      email: v.email,
      phone: v.phone,
      vat_status: v.vatStatus.map((c) => ({ valid_from: c.validFrom, small_business: c.smallBusiness })),
      // PROJ-38: null entfernt das Logo
      logo_path: v.logoPath,
      // PROJ-46: Abgleich je Konto über die Kennung; neue Konten hängt die Datenbank hinten an (Reihenfolge des Anlegens)
      bank_accounts: v.bankAccounts.map((a) => ({
        id: a.id,
        label: a.label,
        account_holder: a.accountHolder,
        iban: a.iban,
        bic: a.bic,
        bank_name: a.bankName,
        note: a.note,
        is_primary: a.primary,
        archived: a.archived,
      })),
    },
  })
  if (error) {
    const duplicateIban = error.code === '23505' && (error.message ?? '').includes('bank_accounts')
    const mapped = duplicateIban ? 'ibanDuplicate' : error.code ? DB_ERRORS[error.code] : undefined
    if (!mapped) console.error('[stammdaten] nicht gespeichert', error.code, error.message)
    return { ok: false, error: mapped ?? 'unknown' }
  }
  // Ersetztes bzw. entferntes Logo (PROJ-38) gleich löschen; Reste entfernt die tägliche Bereinigung
  const unused = (data as { unused_logo?: string | null } | null)?.unused_logo
  await removeLogoFile(unused)
  return { ok: true }
}
