import type { SupabaseClient } from '@supabase/supabase-js'

import { getSessionUser, pendingMfaStep } from '@/lib/auth/session'
import { todayIso } from '@/lib/bookings'
import { GUEST_SHEET_BUCKET, type GuestSheetSnapshot, sheetDeparture } from '@/lib/guest-sheet'
import { loadSignature, pdfAnswer, renderGuestSheet } from '@/lib/guest-sheet-pdf/respond'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext } from '@/lib/tenant'

type SheetDb = {
  id: string
  kind: 'signed' | 'uploaded'
  sheet_number: string | null
  snapshot: GuestSheetSnapshot | null
  signature_1_path: string | null
  signature_2_path: string | null
  pdf_path: string
  replaced_at: string | null
  departure: string
  departure_noted_at: string | null
  departure_noted_by_name: string | null
}

// PDF eines Gästeblatts (PROJ-26) für Mitglieder des gewählten Kunden. Hochgeladene und ersetzte Blätter sowie Blätter ohne
// Abreise-Eintrag: das abgelegte Original. Sonst wird das Blatt beim Öffnen aus der eingefrorenen Fassung neu erzeugt und die
// tatsächliche Abreise samt Vermerk eingesetzt; Unterschriften und übrige Angaben bleiben, das Original bleibt unberührt.
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user || (await pendingMfaStep(user))) return new Response(null, { status: 401 })
  const { active } = await getTenantContext()
  const { id } = await params
  if (!active || !/^[0-9a-f-]{36}$/i.test(id)) return new Response(null, { status: 404 })

  // Lesen im Namen der Person: Die Zugriffsregeln lassen nur Gästeblätter des eigenen Kunden durch
  const supabase = (await createClient()) as unknown as SupabaseClient
  const { data, error } = await supabase
    .from('guest_sheet_list')
    .select('id, kind, sheet_number, snapshot, signature_1_path, signature_2_path, pdf_path, replaced_at, departure, departure_noted_at, departure_noted_by_name')
    .eq('tenant_id', active.id)
    .eq('id', id)
    .maybeSingle()
  if (error) console.error('[gaesteblatt] Blatt nicht lesbar', error.message)
  const sheet = data as SheetDb | null
  if (!sheet) return new Response(null, { status: 404 })
  const fileName = `Gaesteblatt-${sheet.sheet_number ?? sheet.id.slice(0, 8)}.pdf`

  const departure =
    sheet.kind === 'signed' && sheet.replaced_at === null
      ? sheetDeparture({
          departure: sheet.departure,
          noted: sheet.departure_noted_at ? { at: sheet.departure_noted_at, by: sheet.departure_noted_by_name } : null,
          today: todayIso(),
        })
      : null

  if (departure && sheet.snapshot && sheet.signature_1_path && sheet.signature_2_path) {
    const [first, second] = await Promise.all([loadSignature(sheet.signature_1_path), loadSignature(sheet.signature_2_path)])
    if (first && second) {
      try {
        const { pdf } = await renderGuestSheet({ snapshot: sheet.snapshot, departure, signatures: { first, second } })
        return pdfAnswer(pdf, fileName)
      } catch (e) {
        // Dann wenigstens das Original zeigen
        console.error('[gaesteblatt] PDF mit Abreise nicht erzeugt', e instanceof Error ? e.message : e)
      }
    }
  }

  const { data: file, error: fileError } = await createAdminClient().storage.from(GUEST_SHEET_BUCKET).download(sheet.pdf_path)
  if (fileError || !file) {
    console.error('[gaesteblatt] PDF nicht lesbar', fileError?.message)
    return new Response(null, { status: 500 })
  }
  return pdfAnswer(new Uint8Array(await file.arrayBuffer()), fileName)
}
