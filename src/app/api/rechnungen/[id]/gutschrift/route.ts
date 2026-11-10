import { createHash, randomUUID } from 'node:crypto'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { getSessionUser, pendingMfaStep } from '@/lib/auth/session'
import { bookingHref } from '@/lib/bookings'
import { cleanCreditReason, creditSnapshot } from '@/lib/invoice-credit'
import { getCreditNotesFor } from '@/lib/invoice-credit-data'
import { removeInvoiceFiles } from '@/lib/invoice-files'
import { issueAllowed, isIssueDate } from '@/lib/invoice-issue'
import { creditChecksFor, IssueDataError, loadCreditState } from '@/lib/invoice-issue-data'
import { renderInvoice } from '@/lib/invoice-pdf/respond'
import { INVOICE_BUCKET, invoiceHref, invoiceNumberKey } from '@/lib/invoices'
import { createAdminClient } from '@/lib/supabase/admin'
import { getTenantContext } from '@/lib/tenant'
import type { Json } from '@/types/database'

const schema = z.object({
  invoiceDate: z.string().refine(isIssueDate),
  number: z.string().max(200),
  // Länge prüft die Prüfliste (Meldung statt Abbruch); hier nur eine Obergrenze für die Anfrage
  reason: z.string().max(2000),
  acks: z.array(z.string().max(250)).max(10),
})

// PDF, Ablage und Festschreiben dürfen länger dauern als die Standardgrenze
export const maxDuration = 60

export type CreditResponse =
  | { ok: true; id: string }
  | {
      ok: false
      error: 'sessionExpired' | 'forbidden' | 'invalid' | 'blocked' | 'numberTaken' | 'alreadyCredited' | 'pdfFailed' | 'unknown'
      takenNumber?: string
      creditId?: string
    }

// Gutschrift mit dieser Nummer, von dieser Person ausgestellt?
async function isOwnCredit(creditId: string, number: string, userId: string) {
  const { data } = await createAdminClient().from('invoices').select('number_key, issued_by').eq('id', creditId).maybeSingle()
  return data?.issued_by === userId && data.number_key === invoiceNumberKey(number)
}

const answer = (body: CreditResponse, status = 200) => Response.json(body, { status, headers: { 'cache-control': 'no-store' } })


// Gutschrift zu einer ausgestellten Rechnung ausstellen (PROJ-44). Aufbau wie das Ausstellen einer Rechnung (PROJ-42): alle
// Prüfungen laufen hier neu → PDF → Ablage → ein Datenbankschritt legt die Gutschrift samt Nummer an. Die Rechnung selbst bleibt
// unverändert; „storniert“ ergibt sich aus der Gutschrift, die auf sie verweist (höchstens eine je Rechnung).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser()
  if (!user || (await pendingMfaStep(user))) return answer({ ok: false, error: 'sessionExpired' }, 401)
  const { active } = await getTenantContext()
  if (!active || active.role !== 'owner') return answer({ ok: false, error: 'forbidden' }, 403)
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return answer({ ok: false, error: 'invalid' }, 400)
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return answer({ ok: false, error: 'invalid' }, 400)
  const { invoiceDate, reason, acks } = parsed.data
  const number = parsed.data.number.trim()

  let state
  try {
    state = await loadCreditState(active.id, id, {
      creditDate: invoiceDate,
      number,
      reason,
    })
  } catch (e) {
    if (!(e instanceof IssueDataError)) throw e
    console.error('[gutschrift-ausstellen] Stand nicht lesbar', e.message)
    return answer({ ok: false, error: 'unknown' }, 500)
  }
  if (!state) return answer({ ok: false, error: 'blocked' }, 409)
  // Schon storniert. Zweiter Versuch derselben Anfrage (Antwort unterwegs verloren, QA BUG-3): dieselbe Person mit derselben Nummer
  // landet bei ihrer Gutschrift; sonst die Meldung „inzwischen storniert“ mit Link
  if (state.invoice.cancelledBy) {
    const creditId = state.invoice.cancelledBy.id
    if (await isOwnCredit(creditId, number, user.userId)) return answer({ ok: true, id: creditId })
    return answer({ ok: false, error: 'alreadyCredited', creditId }, 409)
  }

  let rendered
  try {
    rendered = await renderInvoice({
      tenantId: active.id,
      model: state.model,
      letterhead: state.letterhead,
      number,
      mark: null,
    })
  } catch (e) {
    console.error('[gutschrift-ausstellen] PDF nicht erzeugt', e instanceof Error ? e.message : e)
    return answer({ ok: false, error: 'pdfFailed' }, 500)
  }
  const checks = creditChecksFor(state, number, rendered.meta)
  if (checks.blocks.some((b) => b.key === 'numberTaken')) return answer({ ok: false, error: 'numberTaken', takenNumber: number }, 409)
  if (!issueAllowed(checks, acks)) return answer({ ok: false, error: 'blocked' }, 409)

  // Ablegen und festschreiben: Erst der Datenbankschritt vergibt die Nummer. Scheitert er, wird die Datei wieder entfernt;
  // bleibt sie bei einem Abbruch liegen, entfernt sie die tägliche Bereinigung, weil kein Beleg auf sie zeigt.
  const admin = createAdminClient()
  const path = `${active.id}/${randomUUID()}.pdf`
  const { error: uploadError } = await admin.storage.from(INVOICE_BUCKET).upload(path, rendered.pdf, {
    contentType: 'application/pdf',
    upsert: false,
  })
  if (uploadError) {
    console.error('[gutschrift-ausstellen] PDF nicht abgelegt', uploadError.message)
    return answer({ ok: false, error: 'pdfFailed' }, 500)
  }
  const snapshot = creditSnapshot(state.credit, {
    smallBusinessNote: rendered.view.smallBusinessNote,
    footer: rendered.view.footer,
  })
  const { data, error } = await admin.rpc('issue_credit_note', {
    p_input: {
      invoice_id: id,
      tenant_id: active.id,
      actor_id: user.userId,
      number,
      invoice_date: invoiceDate,
      reason: cleanCreditReason(reason) || null,
      total_cents: state.model.totals.totalCents,
      pdf_path: path,
      pdf_sha256: createHash('sha256').update(rendered.pdf).digest('hex'),
      without_logo: rendered.meta.logoFailed,
      snapshot,
    } as unknown as Json,
  })
  if (error) {
    await removeInvoiceFiles([path])
    switch (error.code) {
      case 'P0904':
        return answer({ ok: false, error: 'numberTaken', takenNumber: number }, 409)
      case 'P0934': {
        const credits = await getCreditNotesFor(active.id, [id])
        const creditId = credits.get(id)?.id
        if (creditId && (await isOwnCredit(creditId, number, user.userId))) return answer({ ok: true, id: creditId })
        return answer(
          {
            ok: false,
            error: 'alreadyCredited',
            creditId: credits.get(id)?.id,
          },
          409,
        )
      }
      case 'P0902':
      case 'P0906':
      case 'P0935':
        return answer({ ok: false, error: 'blocked' }, 409)
      case 'P0901':
      case 'P0016':
        return answer({ ok: false, error: 'forbidden' }, 403)
    }
    console.error('[gutschrift-ausstellen] Nicht festgeschrieben', error.code, error.message)
    return answer({ ok: false, error: 'unknown' }, 500)
  }
  const creditId = data as string
  revalidatePath('/rechnungen')
  revalidatePath(invoiceHref(id))
  revalidatePath(invoiceHref(creditId))
  if (state.invoice.booking) revalidatePath(bookingHref(state.invoice.booking.id))
  revalidatePath('/buchungen')
  revalidatePath('/')
  revalidatePath('/einstellungen/rechnungen')
  return answer({ ok: true, id: creditId })
}
