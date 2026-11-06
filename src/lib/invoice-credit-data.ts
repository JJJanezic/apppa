import 'server-only'

import type { DocLink } from '@/lib/invoices'
import { createClient } from '@/lib/supabase/server'

// Lesefunktionen zum Rechnungsstorno (PROJ-44). „Storniert“ ist kein Feld an der Rechnung: Es gibt eine Gutschrift, die auf
// sie verweist. Rechte prüft die Datenbank (RLS wie bei allen Rechnungen).

const CHUNK = 100

// Gutschriften zu den angegebenen Rechnungen: Rechnung → Gutschrift
export async function getCreditNotesFor(tenantId: string, invoiceIds: readonly string[]): Promise<Map<string, DocLink>> {
  const result = new Map<string, DocLink>()
  const ids = [...new Set(invoiceIds)]
  if (!ids.length) return result
  const supabase = await createClient()
  for (let i = 0; i < ids.length; i += CHUNK) {
    const { data, error } = await supabase
      .from('invoices')
      .select('id, number, credited_invoice_id')
      .eq('tenant_id', tenantId)
      .in('credited_invoice_id', ids.slice(i, i + CHUNK))
    if (error) {
      console.error('[rechnungsstorno] Gutschriften nicht lesbar', error.message)
      return result
    }
    for (const r of data ?? []) if (r.credited_invoice_id) result.set(r.credited_invoice_id, { id: r.id, number: r.number ?? '' })
  }
  return result
}

type DeductingDb = {
  final: { id: string; number: string | null; origin: string } | null
}

// Gültige Schlussrechnung, die die Rechnung abzieht: ausgestellt und nicht storniert. Abzüge einer stornierten Schlussrechnung
// bleiben als Geschichte stehen, zählen aber nicht mehr.
export async function getValidFinalDeducting(tenantId: string, invoiceId: string): Promise<DocLink | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('invoice_deductions')
    .select('final:invoices!invoice_deductions_invoice_fkey(id, number, origin)')
    .eq('tenant_id', tenantId)
    .eq('deducted_invoice_id', invoiceId)
  if (error) {
    console.error('[rechnungsstorno] Abzüge nicht lesbar', error.message)
    return null
  }
  const finals = ((data ?? []) as unknown as DeductingDb[]).map((r) => r.final).filter((f): f is NonNullable<DeductingDb['final']> => f !== null && f.origin === 'issued')
  if (!finals.length) return null
  const credited = await getCreditNotesFor(
    tenantId,
    finals.map((f) => f.id),
  )
  const valid = finals.filter((f) => !credited.has(f.id)).sort((a, b) => (a.number ?? '').localeCompare(b.number ?? '', 'de', { numeric: true }))
  return valid.length ? { id: valid[0].id, number: valid[0].number ?? '' } : null
}
