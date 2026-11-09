import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { cache } from 'react'

import {
  type MunicipalityNumbering,
  numberingState,
  type NumberingState,
  type RangeState,
  type SheetNumberRange,
} from '@/lib/guest-sheet-numbering'
import { isMissingRelation } from '@/lib/guest-sheets-data'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext } from '@/lib/tenant'

// Lesefunktionen für Kennzahl und Gästeblattnummer je Gemeinde (PROJ-26, Erweiterung 2026-11-09). Rechte prüft die
// Datenbank (RLS: Mitglieder des Kunden und Betreiber lesen). Fehlen Tabellen oder Sichten (Umgebung ohne Migration),
// liefern die Funktionen leere Ergebnisse und „nacherfassen“ aus.

const untyped = async () => (await createClient()) as unknown as SupabaseClient
const isId = (v: string) => /^[0-9a-f-]{36}$/i.test(v)

function logError(label: string, error: { code?: string; message: string } | null) {
  if (error && !isMissingRelation(error)) console.error(`[gaesteblatt] ${label}`, error.code, error.message)
}

// ---- Kennzahlen (Einstellungen → Stammdaten) -----------------------------------------------------------

export type EstablishmentNumber = {
  code: string
  name: string
  number: string | null
}

type EstablishmentDb = { municipality_code: string; municipality_name: string; establishment_number: string | null; has_properties: boolean }

// Gemeinden, in denen der Kunde Objekte hat, mit gespeicherter Kennzahl; Gemeinden ohne Objekte bleiben gespeichert,
// werden aber nicht angezeigt
export async function loadEstablishmentNumbers(tenantId: string): Promise<{ items: EstablishmentNumber[]; ready: boolean }> {
  if (!isId(tenantId)) return { items: [], ready: false }
  const supabase = await untyped()
  const { data, error } = await supabase
    .from('establishment_number_list')
    .select('municipality_code, municipality_name, establishment_number, has_properties')
    .eq('tenant_id', tenantId)
    .eq('has_properties', true)
    .order('municipality_name')
    .limit(500)
  logError('Kennzahlen nicht lesbar', error)
  const rows = (data ?? []) as EstablishmentDb[]
  return {
    items: rows.map((r) => ({ code: r.municipality_code, name: r.municipality_name, number: r.establishment_number })),
    ready: !isMissingRelation(error),
  }
}

// ---- Nummernbereiche (Einstellungen → Gästeblatt) ------------------------------------------------------

type NumberingDb = {
  tenant_id: string
  tenant_name: string
  municipality_code: string
  municipality_name: string
  next_number: string | null
  free_count: number
  has_ranges: boolean
  has_apartments: boolean
}

type RangeDb = {
  id: string
  municipality_code: string
  range_from: string
  range_to: string
  next_number: string | null
  state: RangeState
  exhausted_at: string | null
  last_issued: string | null
  updated_at: string
}

const NUMBERING_COLUMNS = 'tenant_id, tenant_name, municipality_code, municipality_name, next_number, free_count, has_ranges, has_apartments'

const rangeOf = (r: RangeDb): SheetNumberRange => ({
  id: r.id,
  from: r.range_from,
  to: r.range_to,
  next: r.next_number,
  state: r.state,
  exhaustedAt: r.exhausted_at,
  lastIssued: r.last_issued,
  updatedAt: r.updated_at,
})

export type SheetNumberingSettings = {
  backfill: boolean
  municipalities: MunicipalityNumbering[]
  ready: boolean
}

// Je Gemeinde mit Objekten: Stand und Bereiche (Reihenfolge der Eingabe), dazu der Schalter „Gästeblätter nacherfassen“
export async function loadSheetNumbering(tenantId: string): Promise<SheetNumberingSettings> {
  if (!isId(tenantId)) return { backfill: false, municipalities: [], ready: false }
  const supabase = await untyped()
  const [numbering, ranges, backfill] = await Promise.all([
    supabase.from('guest_sheet_numbering').select(NUMBERING_COLUMNS).eq('tenant_id', tenantId).order('municipality_name').limit(500),
    supabase
      .from('guest_sheet_number_range_list')
      .select('id, municipality_code, range_from, range_to, next_number, state, exhausted_at, last_issued, updated_at')
      .eq('tenant_id', tenantId)
      .order('position')
      .limit(2000),
    loadBackfill(supabase, tenantId),
  ])
  logError('Nummernstand nicht lesbar', numbering.error)
  logError('Nummernbereiche nicht lesbar', ranges.error)
  const byCode = new Map<string, SheetNumberRange[]>()
  for (const r of (ranges.data ?? []) as RangeDb[]) byCode.set(r.municipality_code, [...(byCode.get(r.municipality_code) ?? []), rangeOf(r)])
  return {
    backfill,
    municipalities: ((numbering.data ?? []) as NumberingDb[]).map((m) => ({
      code: m.municipality_code,
      name: m.municipality_name,
      next: m.next_number,
      free: m.free_count,
      state: numberingState(m.free_count, m.has_ranges),
      ranges: byCode.get(m.municipality_code) ?? [],
    })),
    ready: !isMissingRelation(numbering.error) && !isMissingRelation(ranges.error),
  }
}

async function loadBackfill(supabase: SupabaseClient, tenantId: string): Promise<boolean> {
  const { data, error } = await supabase.from('tenants').select('guest_sheet_backfill_enabled').eq('id', tenantId).maybeSingle()
  logError('Schalter „nacherfassen“ nicht lesbar', error)
  return Boolean((data as { guest_sheet_backfill_enabled?: boolean } | null)?.guest_sheet_backfill_enabled)
}

// Schalter „Gästeblätter nacherfassen“ des gewählten Kunden (Buchungsformular, Buchungsdetail); einmal je Anfrage
export const getGuestSheetBackfill = cache(async (): Promise<boolean> => {
  const { active } = await getTenantContext()
  if (!active) return false
  return loadBackfill(await untyped(), active.id)
})

// ---- Buchung -----------------------------------------------------------------------------------------

export type BookingNumbering = {
  municipalityName: string
  state: NumberingState
  free: number
}

// Nummernstand der Gemeinde einer Buchung (Buchungsdetail, Vollbild-Seite); null ohne Daten
export const getBookingNumbering = cache(async (bookingId: string): Promise<BookingNumbering | null> => {
  const { active } = await getTenantContext()
  if (!active || !isId(bookingId)) return null
  const supabase = await untyped()
  const { data: booking, error } = await supabase
    .from('bookings')
    .select('apartment:apartments!inner(property:properties!inner(municipality_code))')
    .eq('id', bookingId)
    .eq('tenant_id', active.id)
    .maybeSingle()
  logError('Gemeinde der Buchung nicht lesbar', error)
  const code = (booking as { apartment: { property: { municipality_code: string } } } | null)?.apartment.property.municipality_code
  if (!code) return null
  const { data, error: numberingError } = await supabase
    .from('guest_sheet_numbering')
    .select(NUMBERING_COLUMNS)
    .eq('tenant_id', active.id)
    .eq('municipality_code', code)
    .maybeSingle()
  logError('Nummernstand nicht lesbar', numberingError)
  if (isMissingRelation(numberingError)) return null
  const m = data as NumberingDb | null
  if (!m) return { municipalityName: code, state: 'unset', free: 0 }
  return { municipalityName: m.municipality_name, state: numberingState(m.free_count, m.has_ranges), free: m.free_count }
})

// ---- Dashboard -----------------------------------------------------------------------------------------

export type NumberAlert = {
  tenantId: string
  tenantName: string
  municipalityCode: string
  municipalityName: string
  state: Exclude<NumberingState, 'ok'>
  free: number
}

// Gemeinden mit Hinweis über alle Kunden der Person (die Sicht zeigt nur Kunden, bei denen sie Mitglied ist);
// nur Gemeinden mit mindestens einer nicht archivierten Wohnung
export async function getNumberAlerts(tenantIds: string[]): Promise<NumberAlert[]> {
  const ids = tenantIds.filter(isId)
  if (!ids.length) return []
  const supabase = await untyped()
  const { data, error } = await supabase
    .from('guest_sheet_numbering')
    .select(NUMBERING_COLUMNS)
    .in('tenant_id', ids)
    .eq('has_apartments', true)
    .limit(1000)
  logError('Nummernhinweise nicht lesbar', error)
  return ((data ?? []) as NumberingDb[])
    .map((m) => ({
      tenantId: m.tenant_id,
      tenantName: m.tenant_name,
      municipalityCode: m.municipality_code,
      municipalityName: m.municipality_name,
      state: numberingState(m.free_count, m.has_ranges),
      free: m.free_count,
    }))
    .filter((a): a is NumberAlert => a.state !== 'ok')
    .sort((a, b) => a.tenantName.localeCompare(b.tenantName, 'de') || a.municipalityName.localeCompare(b.municipalityName, 'de'))
}
