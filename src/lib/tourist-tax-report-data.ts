import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { apartmentLabel } from '@/lib/apartments'
import { isMissingRelation } from '@/lib/payments-data'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext } from '@/lib/tenant'
import { type TaxReportFilters, type TaxReportRow, taxReportRange } from '@/lib/tourist-tax-report'

// Lesefunktionen der Ortstaxen-Berichte (PROJ-16) für den gewählten Kunden. Nur Inhaber; die Datenbankfunktion prüft die
// Rolle zusätzlich selbst. Fehlt sie (Umgebung ohne Migration), meldet der Abruf „ready: false“.

const untyped = async () => (await createClient()) as unknown as SupabaseClient

type ReportDb = {
  booking_id: string
  booking_number: string | null
  guest_last_name: string | null
  guest_first_name: string | null
  guest_anonymized: boolean | null
  property_name: string
  apartment_name: string
  municipality_id: string
  municipality_name: string
  arrival: string
  departure: string
  persons: number
  amount_cents: number | string
  taxable_person_nights: number | null
  known_taxable_person_nights: number | null
  exempt_person_nights: number | null
  unknown_positions: number | null
  partial: boolean
  legacy: boolean
  percent: boolean
}

export type TaxReportResult = { ready: boolean; failed: boolean; tenantId: string | null; rows: TaxReportRow[] }

const guestName = (r: ReportDb) => [r.guest_last_name, r.guest_first_name].filter(Boolean).join(' ') || null

export const mapReportRow = (r: ReportDb): TaxReportRow => ({
  bookingId: r.booking_id,
  bookingNumber: r.booking_number,
  guestName: guestName(r),
  anonymized: Boolean(r.guest_anonymized),
  apartment: apartmentLabel(r.property_name, r.apartment_name),
  municipalityId: r.municipality_id,
  municipalityName: r.municipality_name,
  arrival: r.arrival,
  departure: r.departure,
  persons: r.persons,
  amountCents: Number(r.amount_cents),
  taxableNights: r.taxable_person_nights,
  knownTaxableNights: r.known_taxable_person_nights ?? 0,
  exemptNights: r.exempt_person_nights,
  unknownPositions: r.unknown_positions ?? 0,
  partial: r.partial,
  legacy: r.legacy,
  percent: r.percent,
})

// Zeilen je Buchung und Gemeinde im Zeitraum; Gemeindefilter wendet buildTaxReport an (Auswahl braucht alle Gemeinden)
export async function getTouristTaxReport(filters: TaxReportFilters): Promise<TaxReportResult> {
  const { active } = await getTenantContext()
  if (!active || active.role !== 'owner') return { ready: true, failed: false, tenantId: null, rows: [] }
  const { from, to } = taxReportRange(filters)
  const supabase = await untyped()
  const { data, error } = await supabase.rpc('tourist_tax_report', { p_tenant_id: active.id, p_from: from, p_to: to })
  if (error) {
    if (isMissingRelation(error)) return { ready: false, failed: false, tenantId: active.id, rows: [] }
    console.error('[ortstaxe] Bericht nicht lesbar', error.message)
    return { ready: true, failed: true, tenantId: active.id, rows: [] }
  }
  return { ready: true, failed: false, tenantId: active.id, rows: ((data ?? []) as ReportDb[]).map(mapReportRow) }
}

// Hat der Kunde überhaupt Ortstaxe-Tarife? (Hinweis im leeren Zustand)
export async function hasTouristTaxRates(tenantId: string): Promise<boolean> {
  const supabase = await createClient()
  const { count, error } = await supabase.from('apartment_tourist_tax_rates').select('id', { count: 'exact', head: true }).eq('tenant_id', tenantId)
  if (error) return true
  return (count ?? 0) > 0
}
