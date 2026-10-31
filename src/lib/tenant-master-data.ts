// Kundenstammdaten (PROJ-28): Felder, Grenzen und UID-Regeln. Gilt im Browser und auf dem Server.

import { type VatStatusChange, type VatStatusChangeRow, vatStatusFromRows } from '@/lib/vat-status'

export type TenantMasterDataErrorCode = 'staleTenant' | 'tenantDeactivated' | 'tenantGone' | 'vatDateDuplicate'

export const MASTER_DATA_LIMITS = {
  nameMax: 200,
  lineMax: 200,
  postalCodeMax: 10,
  cityMax: 100,
  numberMax: 30,
} as const

// Neu angezeigter Staat, solange keiner gespeichert ist
export const DEFAULT_TENANT_COUNTRY = 'AT'

export type TenantMasterData = {
  id: string
  name: string
  nameLine2: string | null
  addressLine1: string | null
  addressLine2: string | null
  postalCode: string | null
  city: string | null
  country: string | null
  vatId: string | null
  taxNumber: string | null
  registerNumber: string | null
  // Kleinunternehmer-Status (PROJ-36), neueste zuerst
  vatStatus: VatStatusChange[]
  // Schalter „Rechnungen nacherfassen“ (PROJ-37), Voreinstellung ein
  invoiceBackfill: boolean
  // Logo (PROJ-38): Speicherort <Kunde>/<zufällig>.png und kurzlebiger Abruf-Link (vom Server beim Laden erzeugt)
  logoPath: string | null
  logoUrl: string | null
  // Stand beim Laden; Schutz vor Überschreiben bei gleichzeitiger Bearbeitung
  updatedAt: string
}

// Spalten der Tabelle tenants (inkl. Schalter „Rechnungen nacherfassen“, PROJ-37, und Logo, PROJ-38), dazu der Verlauf des
// Kleinunternehmer-Status (PROJ-36)
export const MASTER_DATA_COLUMNS =
  'id, name, name_line2, address_line1, address_line2, postal_code, city, country, vat_id, tax_number, register_number, invoice_backfill_enabled, logo_path, updated_at, vat_status_changes(valid_from, small_business)'

export type TenantMasterDataRow = {
  id: string
  name: string
  name_line2: string | null
  address_line1: string | null
  address_line2: string | null
  postal_code: string | null
  city: string | null
  country: string | null
  vat_id: string | null
  tax_number: string | null
  register_number: string | null
  invoice_backfill_enabled: boolean
  logo_path: string | null
  updated_at: string
  vat_status_changes: VatStatusChangeRow[]
}

// logoUrl: Abruf-Link des Logos, falls vorhanden (tenant-logo-data.ts)
export const masterDataFromRow = (row: TenantMasterDataRow, logoUrl: string | null = null): TenantMasterData => ({
  id: row.id,
  name: row.name,
  nameLine2: row.name_line2,
  addressLine1: row.address_line1,
  addressLine2: row.address_line2,
  postalCode: row.postal_code,
  city: row.city,
  country: row.country,
  vatId: row.vat_id,
  taxNumber: row.tax_number,
  registerNumber: row.register_number,
  vatStatus: vatStatusFromRows(row.vat_status_changes),
  invoiceBackfill: row.invoice_backfill_enabled,
  logoPath: row.logo_path,
  logoUrl: row.logo_path ? logoUrl : null,
  updatedAt: row.updated_at,
})

// UID: Leerzeichen raus, Großbuchstaben
export const normalizeVatId = (value: string) => value.replace(/\s+/g, '').toUpperCase()

// Nur Format: Österreich „ATU“ + 8 Ziffern, sonst Länderkürzel + 2–13 Buchstaben/Ziffern (gleiche Regel in der Datenbank)
export function isVatId(value: string): boolean {
  if (value.startsWith('AT')) return /^ATU\d{8}$/.test(value)
  return /^[A-Z]{2}[A-Z0-9]{2,13}$/.test(value)
}
