import { getTranslations } from 'next-intl/server'
import { z } from 'zod'

import { getSessionUser, pendingMfaStep } from '@/lib/auth/session'
import { COMPANY_SALUTATIONS, DRAFT_NUMBER_TEXT, GUEST_NAME_MODES, INVOICE_KINDS, RECIPIENT_KINDS } from '@/lib/invoice-drafts'
import {
  draftSmallBusiness,
  getBookingInvoiceSummaries,
  getDraftBooking,
  getDraftPreviewData,
  getInvoiceDraftView,
} from '@/lib/invoice-drafts-data'
import { isIssueDate } from '@/lib/invoice-issue'
import { checksFor, IssueDataError, loadIssueState } from '@/lib/invoice-issue-data'
import { pdfResponse } from '@/lib/invoice-pdf/respond'
import { buildPreviewModel } from '@/lib/invoice-preview'
import { normalizeDoc, type RichDoc } from '@/lib/rich-text'
import { getTenantContext } from '@/lib/tenant'

const text = (max: number) => z.string().max(max)
const doc = z.unknown().transform((v): RichDoc | null => (v ? normalizeDoc(v) : null))

// Ungespeicherter Stand aus dem Formular „Rechnung erstellen“. Buchung, andere Rechnungen und Stammdaten lädt der Server.
const unsavedSchema = z.object({
  bookingId: z.string().uuid(),
  draftId: z.string().uuid().nullable(),
  kind: z.enum(INVOICE_KINDS),
  invoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  recipientKind: z.enum(RECIPIENT_KINDS),
  recipient: z.object({ name: text(200), line1: text(200), line2: text(200), postalCode: text(20), city: text(200), country: text(2), vatId: text(40) }),
  companySalutation: z.enum(COMPANY_SALUTATIONS),
  guestNames: z.enum(GUEST_NAME_MODES),
  lines: z.array(z.object({ label: text(300), amountCents: z.number().int(), vatBp: z.number().int() })).max(200),
  deductionIds: z.array(z.string().uuid()).max(50),
  texts: z.object({ intro: doc, payment: doc, closing: doc }),
  payment: z.object({
    depositPercent: z.number().nullable(),
    depositDays: z.number().int().nullable(),
    dueDays: z.number().int(),
    dueBasis: z.enum(['after_invoice', 'before_arrival']),
  }),
  deductionRemoved: z.boolean().optional(),
})

const issueSchema = z.object({
  draftId: z.string().uuid(),
  issue: z.object({ invoiceDate: z.string().refine(isIssueDate), number: z.string().max(200) }),
})

// Gestaltete Entwurfsvorschau (PROJ-41). Gespeichert ({ draftId }): Inhaber und Mitarbeiter. Ungespeichert: nur Inhaber.
// getInvoiceDraftView und getDraftBooking antworten bei fremden Daten mit „nicht gefunden“. Der Betreiber hat keine
// aktive Mitgliedschaft und damit keinen Zugriff auf Entwürfe.
export async function POST(request: Request) {
  const user = await getSessionUser()
  if (!user || (await pendingMfaStep(user))) return new Response(null, { status: 403 })
  const { active } = await getTenantContext()
  if (!active) return new Response(null, { status: 403 })
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null
  const t = await getTranslations('invoiceDrafts.preview')
  const mark = t('draftMark')

  // Seite „Rechnung ausstellen“ (PROJ-42): gespeicherter Entwurf mit vorgesehenem Datum und vorgesehener Nummer, samt Prüfliste.
  // Nur Inhaber, nichts wird gespeichert.
  const issue = issueSchema.safeParse(body)
  if (issue.success) {
    if (active.role !== 'owner') return new Response(null, { status: 403 })
    const { draftId, issue: v } = issue.data
    const number = v.number.trim()
    const state = await loadIssueState(active.id, draftId, v).catch((e: unknown) => {
      if (!(e instanceof IssueDataError)) throw e
      console.error('[rechnung-pdf] Stand nicht lesbar', e.message)
      return null
    })
    if (!state) return new Response(null, { status: 500 })
    return pdfResponse({ tenantId: active.id, model: state.model, letterhead: state.view.preview.letterhead, number: number || DRAFT_NUMBER_TEXT, mark }, (meta) => ({
      ...meta,
      issue: checksFor(state, state.model, number, meta),
    }))
  }

  if (typeof body?.draftId === 'string' && !('bookingId' in body) && !('issue' in body)) {
    const { draft, booking, others, preview, smallBusiness } = await getInvoiceDraftView(body.draftId)
    const model = buildPreviewModel({
      kind: draft.kind,
      invoiceDate: draft.invoiceDate,
      recipientKind: draft.recipientKind,
      recipient: draft.recipient,
      companySalutation: draft.companySalutation,
      guestNameMode: draft.guestNames,
      lines: draft.lines,
      deductionIds: draft.deductionIds,
      texts: { intro: draft.texts.intro.body, payment: draft.texts.payment.body, closing: draft.texts.closing.body },
      payment: draft.payment,
      booking,
      others,
      preview,
      smallBusiness,
      deductionRemoved: draft.deductionRemoved,
    })
    return pdfResponse({ tenantId: active.id, model, letterhead: preview.letterhead, number: DRAFT_NUMBER_TEXT, mark })
  }

  if (active.role !== 'owner') return new Response(null, { status: 403 })
  const parsed = unsavedSchema.safeParse(body)
  if (!parsed.success) return new Response(null, { status: 400 })
  const v = parsed.data
  const booking = await getDraftBooking(v.bookingId)
  if (!booking) return new Response(null, { status: 404 })
  const [all, preview] = await Promise.all([getBookingInvoiceSummaries(booking.id), getDraftPreviewData()])
  const model = buildPreviewModel({
    kind: v.kind,
    invoiceDate: v.invoiceDate,
    recipientKind: v.recipientKind,
    recipient: v.recipient,
    companySalutation: v.companySalutation,
    guestNameMode: v.guestNames,
    lines: v.lines.map((l) => ({ ...l, source: null })),
    deductionIds: v.deductionIds,
    texts: v.texts,
    payment: v.payment,
    booking,
    others: all.filter((o) => o.id !== v.draftId),
    preview,
    smallBusiness: draftSmallBusiness(preview, booking),
    deductionRemoved: v.deductionRemoved,
  })
  return pdfResponse({ tenantId: active.id, model, letterhead: preview.letterhead, number: DRAFT_NUMBER_TEXT, mark })
}
