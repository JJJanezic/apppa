import { createHash, randomUUID } from 'node:crypto'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { getSessionUser, pendingMfaStep } from '@/lib/auth/session'
import { bookingHref } from '@/lib/bookings'
import { removeInvoiceFiles } from '@/lib/invoice-files'
import { issueAllowed, isIssueDate } from '@/lib/invoice-issue'
import { checksFor, getBookingUpdatedAt, IssueDataError, issuedSnapshot, loadIssueState } from '@/lib/invoice-issue-data'
import { renderInvoice } from '@/lib/invoice-pdf/respond'
import { INVOICE_BUCKET, invoiceHref } from '@/lib/invoices'
import { getInvoiceOrigin } from '@/lib/invoices-data'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTenantContext } from '@/lib/tenant'
import type { Json } from '@/types/database'

const schema = z.object({
  invoiceDate: z.string().refine(isIssueDate),
  number: z.string().max(200),
  updatedAt: z.string().max(40),
  acks: z.array(z.string().max(250)).max(10),
})

// PDF, Ablage und Festschreiben dürfen länger dauern als die Standardgrenze
export const maxDuration = 60

export type IssueResponse =
  | { ok: true; id: string }
  | { ok: false; error: 'sessionExpired' | 'forbidden' | 'invalid' | 'conflict' | 'blocked' | 'numberTaken' | 'pdfFailed' | 'unknown'; takenNumber?: string }

const answer = (body: IssueResponse, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } })

// Rechnung ausstellen (PROJ-42): alle Prüfungen laufen hier neu, unabhängig von dem, was die Seite zuletzt gezeigt hat.
// Eigene Schnittstelle statt Server-Aktion: Arbeitsprozess und Schriften werden nur für /api mitgeliefert.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user || (await pendingMfaStep(user))) return answer({ ok: false, error: 'sessionExpired' }, 401)
  const { active } = await getTenantContext()
  if (!active || active.role !== 'owner') return answer({ ok: false, error: 'forbidden' }, 403)
  const { id } = await params
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return answer({ ok: false, error: 'invalid' }, 400)
  const { invoiceDate, updatedAt, acks } = parsed.data
  const number = parsed.data.number.trim()

  // Zweiter Versuch derselben Anfrage (Antwort unterwegs verloren): Die Rechnung gibt es schon
  if ((await getInvoiceOrigin(id)) === 'issued') return answer({ ok: true, id })

  const bookingUpdatedAt = await getBookingUpdatedAt(active.id, id)
  let state
  try {
    state = await loadIssueState(active.id, id, { invoiceDate, number })
  } catch (e) {
    if (!(e instanceof IssueDataError)) throw e
    console.error('[rechnung-ausstellen] Stand nicht lesbar', e.message)
    return answer({ ok: false, error: 'unknown' }, 500)
  }
  if (state.view.draft.updatedAt !== updatedAt) return answer({ ok: false, error: 'conflict' }, 409)

  let rendered
  try {
    rendered = await renderInvoice({ tenantId: active.id, model: state.model, letterhead: state.view.preview.letterhead, number, mark: null })
  } catch (e) {
    console.error('[rechnung-ausstellen] PDF nicht erzeugt', e instanceof Error ? e.message : e)
    return answer({ ok: false, error: 'pdfFailed' }, 500)
  }
  const checks = checksFor(state, state.model, number, rendered.meta)
  if (checks.blocks.some((b) => b.key === 'numberTaken')) return answer({ ok: false, error: 'numberTaken', takenNumber: number }, 409)
  if (!issueAllowed(checks, acks)) return answer({ ok: false, error: 'blocked' }, 409)

  // Ablegen und festschreiben: Erst der Datenbankschritt vergibt die Nummer. Scheitert er, wird die Datei wieder entfernt;
  // bleibt sie bei einem Abbruch liegen, entfernt sie die tägliche Bereinigung, weil keine Rechnung auf sie zeigt.
  const admin = createAdminClient()
  const path = `${active.id}/${randomUUID()}.pdf`
  const { error: uploadError } = await admin.storage.from(INVOICE_BUCKET).upload(path, rendered.pdf, { contentType: 'application/pdf', upsert: false })
  if (uploadError) {
    console.error('[rechnung-ausstellen] PDF nicht abgelegt', uploadError.message)
    return answer({ ok: false, error: 'pdfFailed' }, 500)
  }
  const { data, error } = await admin.rpc('issue_invoice', {
    p_input: {
      id,
      tenant_id: active.id,
      actor_id: user.userId,
      updated_at: updatedAt,
      booking_updated_at: bookingUpdatedAt,
      number,
      invoice_date: invoiceDate,
      small_business: state.view.smallBusiness,
      total_cents: state.model.totals.totalCents,
      pdf_path: path,
      pdf_sha256: createHash('sha256').update(rendered.pdf).digest('hex'),
      without_logo: rendered.meta.logoFailed,
      snapshot: issuedSnapshot(state, rendered.view),
    } as unknown as Json,
  })
  if (error) {
    await removeInvoiceFiles([path])
    switch (error.code) {
      case 'P0904':
        return answer({ ok: false, error: 'numberTaken', takenNumber: number }, 409)
      case 'P0903':
        return answer({ ok: false, error: 'conflict' }, 409)
      case 'P0906':
      case 'P0930':
        return answer({ ok: false, error: 'blocked' }, 409)
      case 'P0901':
      case 'P0016':
        return answer({ ok: false, error: 'forbidden' }, 403)
    }
    console.error('[rechnung-ausstellen] Nicht festgeschrieben', error.code, error.message)
    return answer({ ok: false, error: 'unknown' }, 500)
  }
  // Eine schon ausgestellte Rechnung (zweiter Versuch im selben Moment) behält ihre eigene Datei
  const { data: stored } = await admin.from('invoices').select('pdf_path').eq('id', id).maybeSingle()
  if (stored?.pdf_path !== path) await removeInvoiceFiles([path])
  revalidatePath('/rechnungen')
  revalidatePath(invoiceHref(id))
  revalidatePath(bookingHref(state.view.booking.id))
  revalidatePath('/buchungen')
  revalidatePath('/belegung')
  revalidatePath('/einstellungen/rechnungen')
  return answer({ ok: true, id: data as string })
}
