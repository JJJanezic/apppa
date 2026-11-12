import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { getLocale, getTranslations } from 'next-intl/server'

import { getSessionUser, pendingMfaStep } from '@/lib/auth/session'
import { buildMarketingCsv, filtersOf, marketingFileName, parseMarketingView } from '@/lib/marketing'
import { cleanPlaces, filtersPayload, getMarketingPlaces, queryMarketingGuests, toMarketingRow } from '@/lib/marketing-data'
import { createClient } from '@/lib/supabase/server'
import { getTenantContext } from '@/lib/tenant'

// CSV-Export der Seite „Marketing“ (PROJ-52) für den gewählten Kunden, nur Inhaber. Gleiche Filter und dieselbe
// Datenbank-Abfrage wie die Seite, alle Treffer. Jeder Export wird vorher protokolliert (ohne Gastdaten); scheitert das
// Protokoll, gibt es keine Datei. Enthält Gästedaten: nie zwischenspeichern, die App legt keine Kopie ab.

const NO_STORE = { 'cache-control': 'no-store' }
const status = (code: number) => new Response(null, { status: code, headers: NO_STORE })

// „attachment“ mit ASCII-Ersatznamen und dem vollen Namen in UTF-8 (Umlaute im Kundennamen)
function disposition(fileName: string): string {
  const ascii = fileName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`
}

export async function marketingCsvResponse(request: Request): Promise<Response> {
  const user = await getSessionUser()
  if (!user) return status(401)
  if (await pendingMfaStep(user)) return status(403)
  const { active } = await getTenantContext()
  if (!active || active.role !== 'owner') return status(403)

  const places = await getMarketingPlaces(active.id)
  const { view } = cleanPlaces(parseMarketingView(Object.fromEntries(new URL(request.url).searchParams)), places)
  const filters = filtersOf(view)
  const supabase = (await createClient()) as unknown as SupabaseClient
  const result = await queryMarketingGuests(supabase, active.id, filters, { limit: null, offset: 0 })
  if (!result.ok) return status(result.missing ? 503 : 500)
  const rows = (result.data.rows ?? []).map(toMarketingRow)
  if (rows.length === 0) return status(404)

  const { error } = await supabase.rpc('log_marketing_export', {
    p_tenant_id: active.id,
    p_filters: filtersPayload(filters),
    p_segment_id: view.segment,
    p_count: rows.length,
  })
  if (error) {
    console.error('[marketing] Export nicht protokolliert', error.code, error.message)
    return status(500)
  }

  const t = await getTranslations('marketing.csv')
  const csv = buildMarketingCsv(rows, t.raw('columns') as string[], await getLocale())
  return new Response(csv, {
    headers: {
      ...NO_STORE,
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': disposition(marketingFileName(active.name)),
    },
  })
}
