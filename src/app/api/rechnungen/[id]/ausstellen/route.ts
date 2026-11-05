import { z } from 'zod'

import { getSessionUser, pendingMfaStep } from '@/lib/auth/session'
import { issueAllowed, isIssueDate } from '@/lib/invoice-issue'
import { checksFor, IssueDataError, loadIssueState } from '@/lib/invoice-issue-data'
import { renderInvoice } from '@/lib/invoice-pdf/respond'
import { getInvoiceOrigin } from '@/lib/invoices-data'
import { getTenantContext } from '@/lib/tenant'

const schema = z.object({
  invoiceDate: z.string().refine(isIssueDate),
  number: z.string().max(200),
  updatedAt: z.string().max(40),
  acks: z.array(z.string().max(250)).max(10),
})

export type IssueResponse =
  | { ok: true; id: string }
  | { ok: false; error: 'sessionExpired' | 'forbidden' | 'invalid' | 'conflict' | 'blocked' | 'numberTaken' | 'pdfFailed' | 'notReady' | 'unknown'; takenNumber?: string }

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

  // Ablegen und Festschreiben kommen mit /backend (Offen für /backend in der Spec)
  return answer({ ok: false, error: 'notReady' }, 503)
}
