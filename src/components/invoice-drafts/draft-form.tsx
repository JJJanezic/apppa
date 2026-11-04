'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Eye, Info, WarningCircle } from '@phosphor-icons/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'

import { saveInvoiceDraft } from '@/app/(app)/rechnungen/actions'
import { Amount } from '@/components/amount'
import { AmountInput } from '@/components/amount-input'
import { callAction, FormError } from '@/components/auth/form-error'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { CountryPicker } from '@/components/guests/country-picker'
import { DraftLines } from '@/components/invoice-drafts/draft-lines'
import { DraftTextBlock } from '@/components/invoice-drafts/draft-text-block'
import { InvoicePreview } from '@/components/invoice-drafts/invoice-preview'
import { RequiredChecks } from '@/components/invoice-drafts/required-checks'
import { useAdoptEarlyInput } from '@/components/invoice-drafts/use-adopt-early-input'
import { useUnsavedGuard } from '@/components/invoice-drafts/use-unsaved-guard'
import { RichTextGuardProvider, useRichTextGuard } from '@/components/invoice-settings/rich-text-guard'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { amountInput, bookingHref, isIsoDate, parseAmountCents } from '@/lib/bookings'
import { formatNumber, formatPeriod } from '@/lib/format'
import { guestDisplayName } from '@/lib/guests'
import {
  amountFromPercent,
  billableCents,
  type BookingInvoiceSummary,
  COMPANY_SALUTATIONS,
  DEFAULT_DRAFT_PAYMENT,
  deductionCandidates,
  DRAFT_FIELD_IDS as F,
  DRAFT_LIMITS as D,
  type DraftBooking,
  type DraftLine,
  type DraftPreviewData,
  type DraftRecipient,
  defaultRecipientKind,
  draftTotals,
  GUEST_NAME_MODES,
  guestHasCompany,
  INVOICE_KINDS,
  type InvoiceDraft,
  type InvoiceKind,
  invoiceSums,
  partialLabel,
  paymentSchedule,
  percentFromAmount,
  preselectLines,
  type RecipientKind,
  recipientFromGuest,
  requiredChecks,
  splitByVat,
} from '@/lib/invoice-drafts'
import { buildPreviewModel } from '@/lib/invoice-preview'
import { DUE_BASES, INVOICE_TEXT_LIMITS as TL, type PaymentRules, type TextBlock, type TextBlockKind, textDate } from '@/lib/invoice-texts'
import { emptyDoc } from '@/lib/rich-text'
import { formatVatRate, parseVatRate, vatRateInput } from '@/lib/vat'
import { type DraftInput, type DraftLineInput, draftSchema, liveDraftPayment, parsePartialPercent } from '@/lib/validation/invoice-drafts'

interface DraftFormProps {
  booking: DraftBooking & { lines: DraftLine[] }
  // andere Rechnungen der Buchung (ohne den Entwurf selbst)
  others: BookingInvoiceSummary[]
  preview: DraftPreviewData
  // Kleinunternehmer-Status nach der Buchung (PROJ-36)
  smallBusiness: boolean
  textBlocks: TextBlock[]
  today: string
  // Bearbeiten: der Entwurf; Anlegen: null
  draft: InvoiceDraft | null
  bookingChanged: boolean
}

// Empfänger-Felder des Formulars ↔ Kopie des Empfängers
const RECIPIENT_FIELDS = {
  name: 'recipientName',
  line1: 'recipientLine1',
  line2: 'recipientLine2',
  postalCode: 'recipientPostalCode',
  city: 'recipientCity',
  country: 'recipientCountry',
  vatId: 'recipientVatId',
} as const satisfies Record<keyof DraftRecipient, keyof DraftInput>
const RECIPIENT_KEYS = Object.keys(RECIPIENT_FIELDS) as (keyof DraftRecipient)[]
type RecipientInputs = { [K in keyof DraftRecipient as (typeof RECIPIENT_FIELDS)[K]]: string }

const toLineInput = (l: DraftLine, selected = true): DraftLineInput => ({
  selected,
  source: l.source ?? '',
  label: l.label,
  amount: amountInput(l.amountCents),
  vat: vatRateInput(l.vatBp),
})

const percentInput = (value: number | null) => (value === null ? '' : formatNumber(value, { maximumFractionDigits: 2, useGrouping: false }))

function paymentInputs(rules: PaymentRules) {
  return {
    deposit: rules.depositPercent !== null,
    depositPercent: percentInput(rules.depositPercent),
    depositDays: rules.depositDays === null ? '' : String(rules.depositDays),
    dueDays: String(rules.dueDays),
    dueBasis: rules.dueBasis,
  }
}

const recipientInputs = (r: DraftRecipient) => Object.fromEntries(RECIPIENT_KEYS.map((k) => [RECIPIENT_FIELDS[k], r[k]])) as RecipientInputs

function initialValues({ booking, others, textBlocks, today, draft }: Pick<DraftFormProps, 'booking' | 'others' | 'textBlocks' | 'today' | 'draft'>): DraftInput {
  const preselected = preselectLines(booking.lines, others, draft?.id).map((l) => toLineInput(l, l.selected))
  const candidates = deductionCandidates(others, draft?.id)
  if (draft) {
    const inDraft = new Set<string>(draft.lines.flatMap((l) => (l.source ? [l.source] : [])))
    const lines =
      draft.kind === 'partial'
        ? preselected
        : // gespeicherte Positionen, dazu die übrigen Buchungspositionen abgewählt (wieder anwählbar)
          [...draft.lines.map((l) => toLineInput(l)), ...preselected.filter((l) => l.source && !inDraft.has(l.source)).map((l) => ({ ...l, selected: false }))]
    const text = (k: TextBlockKind) => ({ blockId: draft.texts[k].blockId ?? '', body: draft.texts[k].body ?? emptyDoc() })
    return {
      kind: draft.kind,
      recipientKind: draft.recipientKind,
      companySalutation: draft.companySalutation,
      ...recipientInputs(draft.recipient),
      invoiceDate: draft.invoiceDate,
      guestNames: draft.guestNames,
      lines,
      partialMode: draft.partial?.mode ?? 'percent',
      partialPercent: draft.partial?.mode === 'percent' ? percentInput(draft.partial.percentBp === null ? null : draft.partial.percentBp / 100) : '',
      partialAmount: draft.partial?.mode === 'amount' ? amountInput(draft.partial.amountCents) : '',
      deductionIds: draft.kind === 'final' ? draft.deductionIds : candidates.filter((c) => c.preselected).map((c) => c.id),
      intro: text('intro'),
      payment: text('payment'),
      closing: text('closing'),
      ...paymentInputs(draft.payment),
    }
  }
  // Standard je Block vorausgewählt; ohne Standard beginnt der Block leer
  const standard = (k: TextBlockKind) => textBlocks.find((b) => b.kind === k && b.isDefault)
  const text = (k: TextBlockKind) => ({ blockId: standard(k)?.id ?? '', body: standard(k)?.body ?? emptyDoc() })
  const recipientKind = defaultRecipientKind(booking.guest)
  return {
    kind: 'invoice',
    recipientKind,
    companySalutation: 'generic',
    ...recipientInputs(recipientFromGuest(booking.guest, recipientKind)),
    invoiceDate: today,
    guestNames: 'none',
    lines: preselected,
    partialMode: 'percent',
    partialPercent: '',
    partialAmount: '',
    deductionIds: candidates.filter((c) => c.preselected).map((c) => c.id),
    intro: text('intro'),
    payment: text('payment'),
    closing: text('closing'),
    ...paymentInputs(standard('payment')?.payment ?? DEFAULT_DRAFT_PAYMENT),
  }
}

// Seite „Rechnung erstellen“ bzw. „Entwurf bearbeiten“ (PROJ-40, nur Inhaber): Art, Empfänger, Rechnungsdatum,
// Gastnamen, Positionen bzw. Teilbetrag/Abzüge, Summen, Textblöcke mit Zahlungsregeln, Pflichtangaben; Vorschau ohne
// Seitenwechsel und ohne Datenverlust. Gespeichert wird ein Entwurf ohne Nummer.
export function DraftForm({ booking, others, preview, smallBusiness, textBlocks, today, draft, bookingChanged }: DraftFormProps) {
  const t = useTranslations('invoiceDrafts')
  const tv = useTranslations('invoiceDrafts.validation')
  const router = useRouter()
  const base = billableCents(booking.lines)
  const [error, setError] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const [previewing, setPreviewing] = useState(false)
  const [changedNote, setChangedNote] = useState(bookingChanged)
  const [confirm, setConfirm] = useState<
    { type: 'kind'; kind: InvoiceKind } | { type: 'recipient'; kind: RecipientKind } | { type: 'refresh' } | { type: 'cancel' } | null
  >(null)
  const sortingLine = useRef(false)

  const defaults = useMemo(() => initialValues({ booking, others, textBlocks, today, draft }), [booking, others, textBlocks, today, draft])
  const form = useForm<DraftInput>({
    resolver: zodResolver(draftSchema(tv, { partialBaseCents: base }), undefined, { raw: true }),
    defaultValues: defaults,
  })
  const lines = useFieldArray({ control: form.control, name: 'lines' })
  const v = useWatch({ control: form.control }) as DraftInput
  const guard = useUnsavedGuard(form.formState.isDirty && !form.formState.isSubmitSuccessful)
  const textGuard = useRichTextGuard()
  const formRef = useAdoptEarlyInput(form)
  const validate = () => ({ shouldDirty: true, shouldValidate: form.formState.isSubmitted })

  const blocksOf = (k: TextBlockKind) => textBlocks.filter((b) => b.kind === k)
  const candidates = useMemo(() => deductionCandidates(others, draft?.id), [others, draft?.id])
  const usedBy = useMemo(() => {
    const map = new Map<string, NonNullable<ReturnType<typeof preselectLines>[number]['usedBy']>>()
    for (const l of preselectLines(booking.lines, others, draft?.id)) if (l.source && l.usedBy) map.set(l.source, l.usedBy)
    return map
  }, [booking.lines, others, draft?.id])

  // ---- Laufende Berechnung (Summen, Fristen, Pflichtangaben, Vorschau) ----
  const kind = v.kind
  const invoiceDate = isIsoDate(v.invoiceDate) ? v.invoiceDate : today
  const liveLines: DraftLine[] = (v.lines ?? []).flatMap((l) => {
    if (!l.selected) return []
    const cents = parseAmountCents(l.amount ?? '', { negative: true })
    const bp = parseVatRate(l.vat ?? '')
    if (cents === null || Number.isNaN(cents) || bp === null || Number.isNaN(bp)) return []
    return [{ source: null, label: l.label ?? '', amountCents: cents, vatBp: bp }]
  })
  const percentBp = parsePartialPercent(v.partialPercent ?? '')
  const amountCents = parseAmountCents(v.partialAmount ?? '')
  const partialCents =
    v.partialMode === 'percent'
      ? percentBp !== null && !Number.isNaN(percentBp)
        ? amountFromPercent(percentBp, base)
        : 0
      : amountCents !== null && !Number.isNaN(amountCents)
        ? amountCents
        : 0
  const partialLines: DraftLine[] = partialCents > 0 ? splitByVat(partialCents, booking.lines).map((l) => ({ ...l, label: partialLabel(booking), source: null })) : []
  const effectiveLines = kind === 'partial' ? partialLines : liveLines
  const selectedDeductions = candidates.filter((c) => (v.deductionIds ?? []).includes(c.id))
  const totals = draftTotals({ kind, lines: effectiveLines, deductions: selectedDeductions, smallBusiness })
  const payment = liveDraftPayment(v)
  const schedule = paymentSchedule(payment, totals.totalCents, invoiceDate, booking.arrival)
  const sums = invoiceSums(others)
  const overBilled = totals.totalCents > 0 && sums.billedCents + sums.draftCents + totals.totalCents > base
  const recipient: DraftRecipient = {
    name: v.recipientName ?? '',
    line1: v.recipientLine1 ?? '',
    line2: v.recipientLine2 ?? '',
    postalCode: v.recipientPostalCode ?? '',
    city: v.recipientCity ?? '',
    country: v.recipientCountry ?? '',
    vatId: v.recipientVatId ?? '',
  }
  const checks = requiredChecks({
    issuer: preview.issuer,
    smallBusiness,
    kind,
    invoiceDate: v.invoiceDate ?? '',
    booking,
    lineCount: liveLines.length,
    partialCents,
    totalCents: totals.totalCents,
    recipient,
  })
  const model = previewing
    ? buildPreviewModel({
        kind,
        invoiceDate,
        recipientKind: v.recipientKind,
        recipient,
        companySalutation: v.companySalutation,
        guestNameMode: v.guestNames,
        lines: effectiveLines,
        deductionIds: v.deductionIds ?? [],
        texts: { intro: v.intro?.body ?? null, payment: v.payment?.body ?? null, closing: v.closing?.body ?? null },
        payment,
        booking,
        others,
        preview,
        smallBusiness,
        deductionRemoved: draft?.deductionRemoved,
      })
    : null

  // ---- Sprung zum Feld (Pflichtangaben, Link von der Detailseite mit #feld) ----
  function focusField(field: string) {
    requestAnimationFrame(() => {
      const el = document.getElementById(field)
      if (!el) return
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      const target = el.matches('input, button, textarea') ? el : el.querySelector<HTMLElement>('input:not([disabled]), button, textarea, [contenteditable="true"]')
      target?.focus({ preventScroll: true })
    })
  }
  function jump(field: string) {
    setPreviewing(false)
    focusField(field)
  }
  useEffect(() => {
    const hash = window.location.hash.slice(1)
    if (hash) focusField(hash)
  }, [])

  // ---- Wechsel mit Rückfrage ----
  const linesFromBooking = () => preselectLines(booking.lines, others, draft?.id).map((l) => toLineInput(l, l.selected))

  function applyKind(next: InvoiceKind) {
    if (kind === 'partial' && next !== 'partial') {
      form.setValue('partialPercent', '', validate())
      form.setValue('partialAmount', '', validate())
      if (form.getValues('lines').length === 0) lines.replace(linesFromBooking())
    }
    form.setValue('kind', next, validate())
  }
  function changeKind(next: InvoiceKind) {
    if (next === kind) return
    const hasPartial = Boolean((v.partialPercent ?? '').trim() || (v.partialAmount ?? '').trim())
    if (kind === 'partial' && hasPartial) setConfirm({ type: 'kind', kind: next })
    else applyKind(next)
  }

  function applyRecipient(next: RecipientKind) {
    form.setValue('recipientKind', next, validate())
    const r = recipientFromGuest(booking.guest, next)
    for (const k of RECIPIENT_KEYS) form.setValue(RECIPIENT_FIELDS[k], r[k], validate())
  }
  function changeRecipient(next: RecipientKind) {
    if (next === v.recipientKind) return
    const prefill = recipientFromGuest(booking.guest, v.recipientKind)
    const edited = RECIPIENT_KEYS.some((k) => (recipient[k] ?? '').trim() !== prefill[k].trim())
    if (edited) setConfirm({ type: 'recipient', kind: next })
    else applyRecipient(next)
  }

  function applyPaymentBlock(block: TextBlock | null) {
    const rules = paymentInputs(block?.payment ?? DEFAULT_DRAFT_PAYMENT)
    for (const [k, value] of Object.entries(rules)) form.setValue(k as keyof typeof rules, value as never, validate())
  }

  // Prozent ↔ Betrag: das jeweils andere wird angezeigt
  const otherPartial =
    v.partialMode === 'percent'
      ? partialCents > 0
        ? t('partial.equalsAmount', { amount: amountInput(partialCents) })
        : null
      : partialCents > 0 && base > 0
        ? t('partial.equalsPercent', { percent: formatNumber((percentFromAmount(partialCents, base) ?? 0) / 100, { maximumFractionDigits: 2 }) })
        : null

  async function save(values: DraftInput) {
    setError(null)
    guard.release()
    const result = await callAction(() => saveInvoiceDraft({ id: draft?.id, updatedAt: draft?.updatedAt, bookingId: booking.id, values }))
    if (!result.ok) {
      guard.release(false)
      if (result.error === 'staleInvoice') setStale(true)
      else if (result.error !== 'sessionExpired') setError(result.error)
      return
    }
    // Die Aktion leitet selbst zur Detailseite des Entwurfs weiter
    toast.success(draft ? t('done.saved') : t('done.created'))
  }

  const submitting = form.formState.isSubmitting
  const cancelHref = draft ? `/rechnungen/${draft.id}` : bookingHref(booking.id)
  const guestName = booking.guest ? (booking.guest.anonymized ? t('header.deletedGuest') : guestDisplayName(booking.guest)) : null

  return (
    <>
      {previewing && model && (
        <div className="flex flex-col gap-6">
          <Button type="button" variant="outline" className="min-h-11 self-start" onClick={() => setPreviewing(false)}>
            <ArrowLeft size={18} aria-hidden="true" />
            {t('form.backToDraft')}
          </Button>
          <InvoicePreview model={model} />
          <RequiredChecks checks={checks} onJump={jump} settingsLink />
          <Button type="button" variant="outline" className="min-h-11 self-start" onClick={() => setPreviewing(false)}>
            <ArrowLeft size={18} aria-hidden="true" />
            {t('form.backToDraft')}
          </Button>
        </div>
      )}

      {/* Das Formular bleibt während der Vorschau erhalten (nur ausgeblendet): keine Eingabe geht verloren */}
      <Form {...form}>
        <RichTextGuardProvider value={textGuard.checks}>
          <form ref={formRef} onSubmit={textGuard.guardSubmit(form.handleSubmit(save))} noValidate className={previewing ? 'hidden' : 'flex min-w-0 max-w-[760px] flex-col gap-10'}>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1 rounded-lg bg-ds-surface px-4 py-3">
                <Link href={bookingHref(booking.id)} className="flex min-h-11 w-fit items-center font-medium text-ds-accent-700 underline-offset-[3px] hover:underline">
                  {t('header.booking', { number: booking.number ?? '' })}
                </Link>
                <span className="break-words text-sm text-ds-neutral-800">
                  {[guestName, booking.apartmentLabel, formatPeriod(booking.arrival, booking.departure)].filter(Boolean).join(' · ')}
                </span>
              </div>
              {booking.kind === 'option' && <Note>{t('header.option')}</Note>}
              {booking.cancelledAt && <Note>{t('header.cancelled')}</Note>}
              {changedNote && (
                <Alert role="status" className="border-ds-accent-700/40 bg-ds-accent-100">
                  <Info size={18} weight="duotone" aria-hidden="true" />
                  <AlertDescription className="flex flex-col items-start gap-3">
                    {t('changed.text')}
                    <Button type="button" variant="outline" className="min-h-11" onClick={() => setConfirm({ type: 'refresh' })}>
                      {t('changed.reload')}
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
              <FormError error={error} namespace="invoices.errors" />
              {stale && (
                <Alert role="alert" className="border-ds-accent-2-700/40 bg-ds-accent-2-100 text-ds-accent-2-800">
                  <WarningCircle size={18} weight="duotone" aria-hidden="true" />
                  <AlertDescription className="flex flex-col items-start gap-3">
                    {t('stale.text')}
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      onClick={() => {
                        guard.release()
                        router.refresh()
                      }}
                    >
                      {t('stale.reload')}
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
            </div>

            {/* Art */}
            <Fieldset legend={t('kind.title')}>
              <RadioGroup value={kind} onValueChange={(k) => changeKind(k as InvoiceKind)} className="grid gap-3 sm:grid-cols-3" aria-label={t('kind.title')}>
                {INVOICE_KINDS.map((k) => (
                  <Label key={k} className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border px-3 py-3 font-normal has-[[data-state=checked]]:border-ds-accent-700">
                    <RadioGroupItem value={k} className="mt-0.5" />
                    <span className="flex flex-col gap-0.5">
                      <span className="font-medium">{t(`kind.${k}`)}</span>
                      <span className="text-[13px] text-ds-neutral-800">{t(`kind.${k}Hint`)}</span>
                    </span>
                  </Label>
                ))}
              </RadioGroup>
            </Fieldset>

            {/* Empfänger (Block 1) */}
            <Fieldset legend={t('recipient.title')}>
              <RadioGroup
                value={v.recipientKind}
                onValueChange={(k) => changeRecipient(k as RecipientKind)}
                className="grid grid-cols-2 gap-3"
                aria-label={t('recipient.title')}
              >
                {(['guest', 'company'] as const).map((k) => {
                  const disabled = k === 'company' && !guestHasCompany(booking.guest)
                  return (
                    <Label
                      key={k}
                      className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 font-normal has-[[data-state=checked]]:border-ds-accent-700 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60"
                    >
                      <RadioGroupItem value={k} disabled={disabled} />
                      {t(`recipient.${k}`)}
                    </Label>
                  )
                })}
              </RadioGroup>
              {!guestHasCompany(booking.guest) && <p className="text-[13px] text-ds-neutral-800">{t('recipient.noCompany')}</p>}
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField name="recipientName" id={F.recipientName} label={t('recipient.name')} max={D.recipientNameMax} className="sm:col-span-2" />
                <TextField name="recipientLine1" id={F.recipientLine1} label={t('recipient.line1')} max={D.recipientLineMax} className="sm:col-span-2" />
                <TextField name="recipientLine2" label={t('recipient.line2')} max={D.recipientLineMax} className="sm:col-span-2" />
                <TextField name="recipientPostalCode" id={F.recipientPostalCode} label={t('recipient.postalCode')} max={D.postalCodeMax} />
                <TextField name="recipientCity" id={F.recipientCity} label={t('recipient.city')} max={D.cityMax} />
                <FormField
                  control={form.control}
                  name="recipientCountry"
                  render={({ field, fieldState }) => (
                    <FormItem id={F.recipientCountry}>
                      <FormLabel>{t('recipient.country')}</FormLabel>
                      <FormControl>
                        <CountryPicker value={field.value} onChange={field.onChange} clearable invalid={Boolean(fieldState.error)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <TextField name="recipientVatId" id={F.recipientVatId} label={t('recipient.vatId')} max={D.vatIdMax} />
              </div>
              <p className="text-[13px] text-ds-neutral-800">{t('recipient.copyHint')}</p>
              {v.recipientKind === 'company' && (
                <FormField
                  control={form.control}
                  name="companySalutation"
                  render={({ field }) => (
                    <FormItem className="flex flex-col gap-2">
                      <FormLabel>{t('recipient.salutation')}</FormLabel>
                      <RadioGroup value={field.value} onValueChange={field.onChange} className="flex flex-col gap-2" aria-label={t('recipient.salutation')}>
                        {COMPANY_SALUTATIONS.map((s) => (
                          <Label key={s} className="flex min-h-11 cursor-pointer items-center gap-3 font-normal">
                            <RadioGroupItem value={s} />
                            {t(`recipient.salutation_${s}`)}
                          </Label>
                        ))}
                      </RadioGroup>
                    </FormItem>
                  )}
                />
              )}
            </Fieldset>

            {/* Rechnungsdatum (Block 2b) und Gastnamen (Block 3) */}
            <div className="grid gap-6 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="invoiceDate"
                render={({ field }) => (
                  <FormItem id={F.invoiceDate}>
                    <FormLabel>{t('date.label')}</FormLabel>
                    <FormControl>
                      <Input type="date" className="min-h-11" {...field} />
                    </FormControl>
                    {isIsoDate(field.value) && field.value < today && <FormDescription className="text-ds-text">{t('date.past')}</FormDescription>}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="guestNames"
                render={({ field }) => (
                  <FormItem className="flex flex-col gap-2">
                    <FormLabel>{t('guestNames.label')}</FormLabel>
                    <RadioGroup value={field.value} onValueChange={field.onChange} className="flex flex-col gap-1" aria-label={t('guestNames.label')}>
                      {GUEST_NAME_MODES.map((m) => (
                        <Label key={m} className="flex min-h-11 cursor-pointer items-center gap-3 font-normal">
                          <RadioGroupItem value={m} />
                          {t(`guestNames.${m}`)}
                        </Label>
                      ))}
                    </RadioGroup>
                  </FormItem>
                )}
              />
            </div>

            {/* Positionen bzw. Teilbetrag, Abzüge, Summen (Block 5) */}
            {kind === 'partial' ? (
              <fieldset id={F.partial} className="flex min-w-0 flex-col gap-4">
                <legend className="mb-2 text-xl">{t('partial.title')}</legend>
                <p className="break-words text-sm text-ds-neutral-800">{t('partial.line', { label: partialLabel(booking) })}</p>
                <FormField
                  control={form.control}
                  name="partialMode"
                  render={({ field }) => (
                    <RadioGroup value={field.value} onValueChange={field.onChange} className="grid grid-cols-2 gap-3" aria-label={t('partial.mode')}>
                      {(['percent', 'amount'] as const).map((m) => (
                        <Label key={m} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 font-normal has-[[data-state=checked]]:border-ds-accent-700">
                          <RadioGroupItem value={m} />
                          {t(`partial.${m}`)}
                        </Label>
                      ))}
                    </RadioGroup>
                  )}
                />
                {/* Eigener Schlüssel je Feld: sonst verwendet React dieselbe Feld-Instanz mit neuem Namen weiter, und der Wert
                    des ausgeblendeten Felds geht verloren (QA BUG-2: Speichern ohne Meldung blockiert) */}
                {v.partialMode === 'percent' ? (
                  <FormField
                    key="partialPercent"
                    control={form.control}
                    name="partialPercent"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('partial.percentLabel', { total: amountInput(base) })}</FormLabel>
                        <div className="flex items-center gap-2">
                          <FormControl>
                            <Input inputMode="decimal" autoComplete="off" className="min-h-11 w-28" {...field} />
                          </FormControl>
                          <span aria-hidden="true">%</span>
                        </div>
                        {otherPartial && <FormDescription>{otherPartial}</FormDescription>}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <FormField
                    key="partialAmount"
                    control={form.control}
                    name="partialAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('partial.amountLabel')}</FormLabel>
                        <FormControl>
                          <AmountInput className="min-h-11 w-40" {...field} onValueChange={field.onChange} />
                        </FormControl>
                        {otherPartial && <FormDescription>{otherPartial}</FormDescription>}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                {partialLines.length > 0 && !smallBusiness && (
                  <dl className="flex flex-col gap-1 text-sm" aria-label={t('partial.split')}>
                    {partialLines.map((l) => (
                      <div key={l.vatBp} className="flex items-baseline justify-between gap-4">
                        <dt className="text-ds-neutral-800">{t('partial.share', { rate: formatVatRate(l.vatBp) })}</dt>
                        <dd>
                          <Amount cents={l.amountCents} />
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
              </fieldset>
            ) : (
              <fieldset id={F.lines} className="flex min-w-0 flex-col gap-3">
                <legend className="mb-2 text-xl">{t('lines.title')}</legend>
                <p className="text-sm text-ds-neutral-800">{t('lines.hint')}</p>
                <DraftLines lines={lines} showVat={!smallBusiness} usedBy={usedBy} sortingRef={sortingLine} />
              </fieldset>
            )}

            {kind === 'final' && (
              <fieldset className="flex min-w-0 flex-col gap-3">
                <legend className="mb-2 text-xl">{t('deductions.title')}</legend>
                {candidates.length === 0 ? (
                  <p className="rounded-lg bg-ds-surface px-4 py-3 text-sm text-ds-neutral-800">{t('deductions.none')}</p>
                ) : (
                  <FormField
                    control={form.control}
                    name="deductionIds"
                    render={({ field }) => (
                      <ul className="flex flex-col divide-y rounded-lg bg-ds-surface px-4">
                        {candidates.map((c) => {
                          const id = `abzug-${c.id}`
                          const checked = field.value.includes(c.id)
                          return (
                            <li key={c.id} className="flex items-start gap-3 py-3">
                              <Checkbox
                                id={id}
                                checked={checked}
                                className="mt-1"
                                onCheckedChange={(on) => field.onChange(on === true ? [...field.value, c.id] : field.value.filter((x) => x !== c.id))}
                              />
                              <Label htmlFor={id} className="flex min-w-0 flex-1 cursor-pointer flex-col gap-0.5 font-normal">
                                <span className="flex items-baseline justify-between gap-3">
                                  <span className="break-words font-medium">
                                    {c.origin === 'backfilled'
                                      ? t('deductions.backfilled', { number: c.number ?? '–' })
                                      : c.number
                                        ? t('deductions.partial', { number: c.number })
                                        : t('deductions.partialDraft')}
                                  </span>
                                  <Amount cents={c.totalCents} className="shrink-0" />
                                </span>
                                <span className="text-[13px] text-ds-neutral-800">{textDate(c.invoiceDate)}</span>
                              </Label>
                            </li>
                          )
                        })}
                      </ul>
                    )}
                  />
                )}
                {draft?.deductionRemoved && <Note>{t('deductions.removed')}</Note>}
              </fieldset>
            )}

            <section aria-label={t('totals.title')} className="flex flex-col gap-2" aria-live="polite">
              <dl className="flex flex-col divide-y rounded-lg bg-ds-surface px-4">
                {kind === 'final' && selectedDeductions.length > 0 && (
                  <>
                    <TotalRow label={t('totals.lines')} cents={totals.linesCents} />
                    <TotalRow label={t('totals.deductions')} cents={-totals.deductionsCents} />
                  </>
                )}
                <TotalRow label={t('totals.total')} cents={totals.totalCents} strong />
              </dl>
              {smallBusiness ? (
                <p className="text-[13px] text-ds-neutral-800">{t('totals.noVat')}</p>
              ) : (
                totals.vatShares.length > 0 && (
                  <dl className="flex flex-col gap-1 text-sm" aria-label={t('totals.vatIncluded')}>
                    {totals.vatShares.map((s) => (
                      <div key={s.vatBp} className="flex items-baseline justify-between gap-4">
                        <dt className="text-ds-neutral-800">{t('totals.vatShare', { rate: formatVatRate(s.vatBp) })}</dt>
                        <dd>
                          <Amount cents={s.vatCents} />
                        </dd>
                      </div>
                    ))}
                  </dl>
                )
              )}
              {kind === 'final' && totals.totalCents <= 0 && selectedDeductions.length > 0 && <Note>{t('totals.notPositive')}</Note>}
              {overBilled && <Note>{t('totals.overBilled')}</Note>}
            </section>

            {/* Textblöcke 4, 6 (mit Zahlungsregeln), 7 */}
            <DraftTextBlock kind="intro" blocks={blocksOf('intro')} />
            {v.recipientKind !== 'company' && <p className="-mt-6 text-[13px] text-ds-neutral-800">{t('texts.salutationGuest')}</p>}

            <DraftTextBlock kind="payment" blocks={blocksOf('payment')} deposit={v.deposit} onApplied={applyPaymentBlock}>
              <PaymentRulesFields schedule={schedule} />
            </DraftTextBlock>

            <DraftTextBlock kind="closing" blocks={blocksOf('closing')} />

            <RequiredChecks checks={checks} onJump={jump} settingsLink />

            <div className="flex flex-wrap gap-3 border-t pt-6">
              <Button type="submit" disabled={submitting} aria-busy={submitting} className="min-h-11">
                {t('form.save')}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => {
                  setPreviewing(true)
                  window.scrollTo({ top: 0 })
                }}
              >
                <Eye size={18} aria-hidden="true" />
                {t('form.preview')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="min-h-11"
                onClick={() => (form.formState.isDirty ? setConfirm({ type: 'cancel' }) : guard.leave(cancelHref))}
              >
                {t('form.cancel')}
              </Button>
            </div>
          </form>
        </RichTextGuardProvider>
      </Form>

      {confirm?.type === 'kind' && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setConfirm(null)}
          title={t('kind.confirmTitle')}
          text={t('kind.confirmText')}
          confirmLabel={t('kind.confirm')}
          cancelLabel={t('form.keep')}
          onConfirm={() => {
            applyKind(confirm.kind)
            setConfirm(null)
          }}
        />
      )}
      {confirm?.type === 'recipient' && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setConfirm(null)}
          title={t('recipient.confirmTitle')}
          text={t('recipient.confirmText')}
          confirmLabel={t('recipient.confirm')}
          cancelLabel={t('form.keep')}
          onConfirm={() => {
            applyRecipient(confirm.kind)
            setConfirm(null)
          }}
        />
      )}
      {confirm?.type === 'refresh' && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setConfirm(null)}
          title={t('changed.confirmTitle')}
          text={t('changed.confirmText')}
          confirmLabel={t('changed.confirm')}
          cancelLabel={t('form.keep')}
          onConfirm={() => {
            lines.replace(linesFromBooking())
            setChangedNote(false)
            setConfirm(null)
          }}
        />
      )}
      {(confirm?.type === 'cancel' || guard.pendingHref) && (
        <ConfirmDialog
          open
          onOpenChange={(o) => {
            if (o) return
            setConfirm(null)
            guard.cancelLeave()
          }}
          title={t('leave.title')}
          text={t('leave.text')}
          confirmLabel={t('leave.confirm')}
          cancelLabel={t('leave.stay')}
          onConfirm={() => {
            const href = guard.pendingHref ?? cancelHref
            setConfirm(null)
            guard.leave(href)
          }}
        />
      )}
    </>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <Alert className="border-ds-neutral-400 bg-ds-surface">
      <Info size={18} weight="duotone" aria-hidden="true" />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  )
}

function Fieldset({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex min-w-0 flex-col gap-4">
      <legend className="mb-2 text-xl">{legend}</legend>
      {children}
    </fieldset>
  )
}

function TotalRow({ label, cents, strong }: { label: string; cents: number; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-3 ${strong ? 'text-lg font-semibold' : ''}`}>
      <dt>{label}</dt>
      <dd>
        <Amount cents={cents} />
      </dd>
    </div>
  )
}

type TextFieldName = 'recipientName' | 'recipientLine1' | 'recipientLine2' | 'recipientPostalCode' | 'recipientCity' | 'recipientVatId'

function TextField({ name, id, label, max, className }: { name: TextFieldName; id?: string; label: string; max: number; className?: string }) {
  return (
    <FormField
      name={name}
      render={({ field }) => (
        <FormItem id={id} className={className}>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input autoComplete="off" maxLength={max} className="min-h-11" {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

// Zahlungsregeln dieser Rechnung (vom Baustein gesetzt, je Rechnung änderbar) mit berechneten Fristen und Rückfall-Hinweisen
function PaymentRulesFields({ schedule }: { schedule: ReturnType<typeof paymentSchedule> }) {
  const t = useTranslations('invoiceDrafts.payment')
  const deposit = useWatch<DraftInput, 'deposit'>({ name: 'deposit' })
  return (
    <div className="flex flex-col gap-4 rounded-lg border p-4">
      <FormField
        name="deposit"
        render={({ field }) => (
          <FormItem className="flex flex-row items-center gap-3 space-y-0">
            <FormControl>
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </FormControl>
            <FormLabel className="font-normal">{t('deposit')}</FormLabel>
          </FormItem>
        )}
      />
      {deposit && (
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            name="depositPercent"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('depositPercent')}</FormLabel>
                <div className="flex items-center gap-2">
                  <FormControl>
                    <Input inputMode="decimal" autoComplete="off" className="min-h-11 w-24" {...field} />
                  </FormControl>
                  <span aria-hidden="true">%</span>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            name="depositDays"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('depositDays')}</FormLabel>
                <FormControl>
                  <Input inputMode="numeric" autoComplete="off" maxLength={3} className="min-h-11 w-24" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          name="dueDays"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('dueDays')}</FormLabel>
              <FormControl>
                <Input inputMode="numeric" autoComplete="off" maxLength={3} className="min-h-11 w-24" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          name="dueBasis"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('dueBasis')}</FormLabel>
              <Select value={field.value} onValueChange={field.onChange}>
                <FormControl>
                  <SelectTrigger className="min-h-11">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {DUE_BASES.map((b) => (
                    <SelectItem key={b} value={b} className="min-h-11">
                      {t(`basis.${b}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormItem>
          )}
        />
      </div>
      <div className="flex flex-col gap-1 text-sm" aria-live="polite">
        {schedule.depositCents !== null && schedule.depositDue && schedule.remainderCents !== null && (
          <p>{t('depositResult', { amount: amountInput(schedule.depositCents), date: textDate(schedule.depositDue), rest: amountInput(schedule.remainderCents) })}</p>
        )}
        <p>{t('dueResult', { date: textDate(schedule.due) })}</p>
        {schedule.dueClamped && <p className="text-ds-accent-2-800">{t('dueClamped')}</p>}
        {schedule.depositClamped && <p className="text-ds-accent-2-800">{t('depositClamped')}</p>}
      </div>
      <p className="text-[13px] text-ds-neutral-800">{t('hint', { max: TL.daysMax })}</p>
    </div>
  )
}
