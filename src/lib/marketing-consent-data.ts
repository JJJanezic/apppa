import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { todayIso } from '@/lib/bookings'
import {
  type ConsentChannel,
  type ConsentEntry,
  type ConsentKind,
  type ConsentOrigin,
  type ConsentState,
  type GuestConsent,
  receiptTypeOf,
} from '@/lib/marketing-consent'
import { createClient } from '@/lib/supabase/server'

// Stand und Verlauf der Marketing-Einwilligung eines Gastes (PROJ-19). Gelesen wird im Namen der Person; die Zugriffsregeln
// lassen nur Gäste des eigenen Kunden durch. Solange der Verlauf in der Datenbank fehlt, gilt der Vermerk aus PROJ-26
// (Einwilligung über Gästeblatt am Gast) als einziger Eintrag.

const MISSING = new Set(['42P01', '42703', '42883', 'PGRST200', 'PGRST202', 'PGRST204', 'PGRST205'])
export const isMissingRelation = (error: { code?: string } | null) => Boolean(error?.code && MISSING.has(error.code))

const untyped = async () => (await createClient()) as unknown as SupabaseClient

type HistoryDb = {
  id: string
  kind: ConsentKind
  origin: ConsentOrigin
  occurred_on: string
  channel: ConsentChannel | null
  note: string | null
  receipt_path: string | null
  guest_sheet_id: string | null
  sheet_number: string | null
  booking_id: string | null
  booking_number: string | null
  created_at: string
  created_by_name: string | null
  voided_at: string | null
  voided_by_name: string | null
  void_reason: string | null
}

const HISTORY_COLUMNS =
  'id, kind, origin, occurred_on, channel, note, receipt_path, guest_sheet_id, sheet_number, booking_id, booking_number, created_at, ' +
  'created_by_name, voided_at, voided_by_name, void_reason'

const toEntry = (r: HistoryDb): ConsentEntry => ({
  id: r.id,
  kind: r.kind,
  origin: r.origin,
  occurredOn: r.occurred_on,
  channel: r.channel,
  note: r.note,
  receipt: r.receipt_path ? { type: receiptTypeOf(r.receipt_path) } : null,
  sheet: r.guest_sheet_id ? { id: r.guest_sheet_id, number: r.sheet_number, bookingId: r.booking_id, bookingNumber: r.booking_number } : null,
  createdAt: r.created_at,
  createdBy: r.created_by_name,
  voided: r.voided_at ? { at: r.voided_at, by: r.voided_by_name, reason: r.void_reason ?? '' } : null,
})

export async function getGuestConsent(tenantId: string, guestId: string): Promise<GuestConsent> {
  const supabase = await untyped()
  const [state, history] = await Promise.all([
    supabase.from('guests').select('marketing_consent_state, marketing_consent_on').eq('id', guestId).eq('tenant_id', tenantId).maybeSingle(),
    supabase
      .from('marketing_consent_history')
      .select(HISTORY_COLUMNS)
      .eq('tenant_id', tenantId)
      .eq('guest_id', guestId)
      .order('occurred_on', { ascending: false })
      .order('created_at', { ascending: false }),
  ])

  if (state.error || history.error) {
    if (isMissingRelation(state.error) || isMissingRelation(history.error)) return legacyConsent(supabase, tenantId, guestId)
    console.error('[einwilligung] nicht lesbar', state.error?.message ?? history.error?.message)
    return { state: 'none', since: null, sheetNumber: null, entries: [], historyAvailable: false }
  }

  const row = state.data as { marketing_consent_state: ConsentState | null; marketing_consent_on: string | null } | null
  const entries = ((history.data ?? []) as unknown as HistoryDb[]).map(toEntry)
  const consentState = row?.marketing_consent_state ?? 'none'
  const since = consentState === 'none' ? null : row?.marketing_consent_on ?? null
  // Gästeblatt der maßgeblichen Erteilung: jüngster gültiger Eintrag
  const latest = entries.find((e) => !e.voided)
  const sheetNumber = consentState === 'granted' && latest?.kind === 'grant' ? (latest.sheet?.number ?? null) : null
  return { state: consentState, since, sheetNumber, entries, historyAvailable: true }
}

// Übergang bis /backend: Vermerk aus PROJ-26 (Einwilligung über Gästeblatt) als einziger Eintrag
async function legacyConsent(supabase: SupabaseClient, tenantId: string, guestId: string): Promise<GuestConsent> {
  const empty: GuestConsent = { state: 'none', since: null, sheetNumber: null, entries: [], historyAvailable: false }
  const { data, error } = await supabase
    .from('guests')
    .select('marketing_consent_at, marketing_consent_sheet_id')
    .eq('id', guestId)
    .eq('tenant_id', tenantId)
    .maybeSingle()
  const guest = data as { marketing_consent_at: string | null; marketing_consent_sheet_id: string | null } | null
  if (error || !guest?.marketing_consent_at) return empty
  let sheet: ConsentEntry['sheet'] = null
  let origin: ConsentOrigin = 'sheet'
  if (guest.marketing_consent_sheet_id) {
    const { data: s } = await supabase
      .from('guest_sheets')
      .select('id, kind, sheet_number, booking_id')
      .eq('id', guest.marketing_consent_sheet_id)
      .eq('tenant_id', tenantId)
      .maybeSingle()
    const found = s as { id: string; kind: 'signed' | 'uploaded'; sheet_number: string | null; booking_id: string } | null
    if (found) {
      sheet = { id: found.id, number: found.sheet_number, bookingId: found.booking_id, bookingNumber: null }
      origin = found.kind === 'uploaded' ? 'sheet_upload' : 'sheet'
    }
  }
  const since = todayIso(new Date(guest.marketing_consent_at))
  return {
    state: 'granted',
    since,
    sheetNumber: sheet?.number ?? null,
    historyAvailable: false,
    entries: [
      {
        id: `legacy-${guestId}`,
        kind: 'grant',
        origin,
        occurredOn: since,
        channel: null,
        note: null,
        receipt: null,
        sheet,
        createdAt: guest.marketing_consent_at,
        createdBy: null,
        voided: null,
      },
    ],
  }
}
