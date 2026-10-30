'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash, WarningCircle } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'

import { checkGuestDuplicates } from '@/app/(app)/gaeste/actions'
import { loadInvoiceBooking, saveInvoice, type SaveInvoiceResult } from '@/app/(app)/rechnungen/actions'
import { Amount } from '@/components/amount'
import { AmountInput } from '@/components/amount-input'
import { callAction, FormError } from '@/components/auth/form-error'
import { chargeMoneyCell, SortableChargeList, SortableChargeRow } from '@/components/bookings/sortable-charges'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { DetailPanel } from '@/components/detail-panel'
import { GuestFields } from '@/components/guests/guest-fields'
import { GuestPicker } from '@/components/guests/guest-picker'
import { BookingPicker, useBookingOptionLabel } from '@/components/invoices/booking-picker'
import { InvoicePdfField } from '@/components/invoices/invoice-pdf-field'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { LabelCombobox } from '@/components/vat/label-combobox'
import { useVatStatus } from '@/components/vat/vat-status-context'
import { VatRateInput } from '@/components/vat/vat-rate-input'
import { amountInput, isIsoDate, parseAmountCents } from '@/lib/bookings'
import { formatDate } from '@/lib/format'
import { countryName, type DuplicateMatch, guestSortName } from '@/lib/guests'
import {
  type Invoice,
  type InvoiceBookingOption,
  INVOICE_LIMITS as L,
  type InvoiceLine,
  isOldInvoiceDate,
  linesFromBooking,
  recipientFor,
} from '@/lib/invoices'
import { EMPTY_GUEST_INPUT, type GuestInput, guestSchema } from '@/lib/validation/guests'
import { type InvoiceInput, type InvoiceLineInput, invoiceSchema } from '@/lib/validation/invoices'
import { CHARGE_CHOICES, formatVatRate, parseVatRate, VAT_DEFAULTS, vatBreakdown, vatRateInput } from '@/lib/vat'
import { vatStatusOn } from '@/lib/vat-status'

// Gast im Formular: aus der Gastsuche, der gewählten Buchung oder der gespeicherten Rechnung
type PickedGuest = { id: string; lastName: string; firstName: string | null; titlePrefix: string | null; titleSuffix: string | null; country: string; companyName: string | null }

interface InvoicePanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  // Bearbeiten: die Rechnung; Nacherfassen: null
  invoice: Invoice | null
  // Heutiges Datum (Wien) vom Server
  today: string
}

const toLineInput = (l: InvoiceLine): InvoiceLineInput => ({ label: l.label, amount: amountInput(l.amountCents), vat: vatRateInput(l.vatBp) })

function initialValues(invoice: Invoice | null): InvoiceInput {
  return {
    number: invoice?.number ?? '',
    invoiceDate: invoice?.invoiceDate ?? '',
    bookingId: invoice?.booking?.id ?? '',
    guestMode: 'existing',
    guestId: invoice?.guest?.id ?? '',
    recipient: invoice?.recipient ?? '',
    lines: (invoice?.lines ?? []).map(toLineInput),
    pdfPath: invoice?.pdfPath ?? '',
  }
}

// Formular-Panel „Rechnung nacherfassen“ / „Rechnung bearbeiten“ (PROJ-37, nur Inhaber).
// Buchung optional (übernimmt Gast, Empfänger und Positionen als Kopie), Gast optional (Suche oder Neuanlage wie im
// Buchungsformular), Empfänger Pflicht (vorbelegt, bleibt nach Änderung von Hand), Positionen mit USt-Satz, PDF.
export function InvoicePanel({ open, onOpenChange, invoice, today }: InvoicePanelProps) {
  const t = useTranslations('invoices')
  const tv = useTranslations('invoices.validation')
  const tb = useTranslations('bookings')
  const tgv = useTranslations('guests.validation')
  const tg = useTranslations('guests')
  const locale = useLocale()
  const router = useRouter()
  const bookingLabel = useBookingOptionLabel()
  const vatHistory = useVatStatus()
  const [error, setError] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const [booking, setBooking] = useState<InvoiceBookingOption | null>(invoice?.booking ?? null)
  const [bookingLoading, setBookingLoading] = useState(false)
  const [picked, setPicked] = useState<PickedGuest | null>(invoice?.guest ?? null)
  // Empfänger von Hand geändert (bzw. gespeichert): Gastwechsel überschreibt ihn nicht mehr
  const [recipientTouched, setRecipientTouched] = useState(Boolean(invoice))
  // Positionen der gewählten Buchung, solange die Rückfrage „ersetzen?“ offen ist
  const [replaceWith, setReplaceWith] = useState<InvoiceLine[] | null>(null)
  const [duplicates, setDuplicates] = useState<{ matches: DuplicateMatch[]; values: string } | null>(null)
  // Während eine Position verschoben wird bzw. die Bezeichnungsauswahl offen ist, schließt Escape nicht das Panel
  const sortingLine = useRef(false)
  const labelListOpen = useRef(false)

  const form = useForm<InvoiceInput>({
    resolver: zodResolver(invoiceSchema(tv, { today }), undefined, { raw: true }),
    defaultValues: initialValues(invoice),
  })
  const guestForm = useForm<GuestInput>({
    resolver: zodResolver(guestSchema(tgv), undefined, { raw: true }),
    defaultValues: EMPTY_GUEST_INPUT,
  })
  const lines = useFieldArray({ control: form.control, name: 'lines' })
  const [invoiceDate, guestMode, lineRows] = useWatch({ control: form.control, name: ['invoiceDate', 'guestMode', 'lines'] })
  const [newLastName, newFirstName, newCompanyName] = useWatch({ control: guestForm.control, name: ['lastName', 'firstName', 'companyName'] })
  const guestValues = JSON.stringify(useWatch({ control: guestForm.control }))
  const visibleDuplicates = duplicates && duplicates.values === guestValues ? duplicates.matches : null

  // Kleinunternehmer am Rechnungsdatum (PROJ-36; solange keines eingetragen ist: heute) → keine USt-Angaben;
  // die Sätze bleiben im Formular und werden gespeichert
  const showVat = !vatStatusOn(vatHistory, isIsoDate(invoiceDate) ? invoiceDate : today).smallBusiness
  const chargeChoices = CHARGE_CHOICES.map((c) => ({ key: c.key, label: tb(`chargeSuggestions.${c.key}`) }))
  const parsedLines = lineRows.map((l) => ({ amountCents: parseAmountCents(l.amount ?? '', { negative: true }), vatBp: parseVatRate(l.vat ?? '') }))
  const valid = parsedLines.every((l) => l.amountCents !== null && !Number.isNaN(l.amountCents))
  const total = valid ? parsedLines.reduce((sum, l) => sum + (l.amountCents ?? 0), 0) : null
  const vatShares =
    showVat && valid && parsedLines.every((l) => l.vatBp !== null && !Number.isNaN(l.vatBp))
      ? vatBreakdown(parsedLines.map((l) => ({ amountCents: l.amountCents ?? 0, vatBp: l.vatBp ?? 0 })))
      : []
  const linesError = form.formState.errors.lines?.message ?? form.formState.errors.lines?.root?.message

  const validate = () => ({ shouldValidate: form.formState.isSubmitted })
  const suggestRecipient = (g: { lastName: string; firstName: string | null; companyName: string | null }) => {
    if (!recipientTouched) form.setValue('recipient', recipientFor(g), validate())
  }

  // Neuer Gast: Empfänger läuft mit Name bzw. Firma mit, solange er nicht von Hand geändert wurde
  useEffect(() => {
    if (guestMode !== 'new' || recipientTouched) return
    if (!newLastName?.trim() && !newCompanyName?.trim()) return
    form.setValue('recipient', recipientFor({ lastName: newLastName?.trim() ?? '', firstName: newFirstName?.trim() || null, companyName: newCompanyName ?? null }))
  }, [guestMode, recipientTouched, newLastName, newFirstName, newCompanyName, form])

  function pickGuest(g: PickedGuest) {
    setPicked(g)
    form.setValue('guestMode', 'existing')
    form.setValue('guestId', g.id, validate())
    suggestRecipient(g)
  }

  const hasLineInput = () => form.getValues('lines').some((l) => l.label.trim() || l.amount.trim())
  const replaceLines = (next: InvoiceLine[]) => lines.replace(next.map(toLineInput))

  async function pickBooking(option: InvoiceBookingOption) {
    setBooking(option)
    form.setValue('bookingId', option.id, validate())
    setBookingLoading(true)
    const result = await callAction(() => loadInvoiceBooking({ id: option.id }))
    setBookingLoading(false)
    if (!result.ok || !result.data) {
      if (result.ok === false && result.error !== 'sessionExpired') toast.error(t(`errors.${result.error}`))
      return
    }
    const { guest, amounts } = result.data
    // Hauptgast der Buchung vorbelegen (anonymisierte Gäste nicht)
    if (guest && !guest.anonymized) pickGuest(guest)
    if (!amounts) return
    const next = linesFromBooking(amounts, { nights: t('form.nightsLabel'), cancellationFee: t('form.cancellationFeeLabel') })
    // Schon Positionen eingetragen? Dann erst fragen
    if (hasLineInput()) setReplaceWith(next)
    else replaceLines(next)
  }

  async function save(values: InvoiceInput, forceNewGuest = false) {
    setError(null)
    let newGuest: GuestInput | undefined
    if (values.guestMode === 'new') {
      if (!(await guestForm.trigger())) return
      newGuest = guestForm.getValues()
      // Möglicher Doppeleintrag? (Prüfung aus PROJ-7; „Trotzdem neu anlegen“ speichert ohne erneute Prüfung)
      if (!forceNewGuest) {
        const check = await callAction(() => checkGuestDuplicates(newGuest!))
        if (check.ok && check.data && check.data.length > 0) {
          setDuplicates({ matches: check.data, values: JSON.stringify(newGuest) })
          return
        }
      }
    }
    const result: SaveInvoiceResult = await callAction(() => saveInvoice({ id: invoice?.id, updatedAt: invoice?.updatedAt, values, newGuest }))
    if (!result.ok) {
      if (result.error === 'staleInvoice') setStale(true)
      else if (result.error === 'numberTaken') {
        const date = (result as SaveInvoiceResult).takenDate
        form.setError('number', { message: date ? tv('numberTakenOn', { date: formatDate(date) }) : tv('numberTaken') }, { shouldFocus: true })
      } else if (result.error === 'dateInFuture') form.setError('invoiceDate', { message: tv('dateInFuture') }, { shouldFocus: true })
      else setError(result.error)
      return
    }
    toast.success(invoice ? t('done.saved') : t('done.created'))
    onOpenChange(false)
    // Nach dem Anlegen leitet die Aktion selbst zur Detailseite weiter (redirectTo), sonst Seite erneuern
    if (!result.redirectTo) router.refresh()
  }

  const submitting = form.formState.isSubmitting

  return (
    <DetailPanel
      open={open}
      onOpenChange={onOpenChange}
      onEscapeKeyDown={(e) => {
        if (sortingLine.current || labelListOpen.current) e.preventDefault()
      }}
      title={invoice ? t('form.editTitle') : t('form.createTitle')}
      eyebrow={invoice ? invoice.number : undefined}
      description={invoice ? undefined : t('form.description')}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit((v) => save(v))} noValidate className="flex flex-col gap-6">
          <FormError error={error} namespace="invoices.errors" />
          {stale && (
            <Alert role="alert" className="border-ds-accent-2-700/40 bg-ds-accent-2-100 text-ds-accent-2-800">
              <WarningCircle size={18} weight="duotone" aria-hidden="true" />
              <AlertDescription className="flex flex-col items-start gap-3">
                {t('stale.text')}
                <Button type="button" variant="outline" className="min-h-11" onClick={() => router.refresh()}>
                  {t('stale.reload')}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.number')}</FormLabel>
                  <FormControl>
                    {/* Ohne maxLength: zu lange Nummern meldet die Prüfung (Spec) */}
                    <Input autoComplete="off" className="min-h-11" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="invoiceDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('form.date')}</FormLabel>
                  <FormControl>
                    <Input type="date" max={today} className="min-h-11" {...field} />
                  </FormControl>
                  {isOldInvoiceDate(invoiceDate, today) && <FormDescription className="text-ds-text">{t('form.dateOld', { years: L.oldYears })}</FormDescription>}
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-sm font-semibold">{t('form.booking')}</legend>
            {booking ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-ds-surface px-4 py-3">
                <span className="flex min-w-0 flex-col">
                  <span className="break-words font-medium">{bookingLabel(booking)}</span>
                  <span className="text-[13px] text-ds-neutral-700">
                    {[tb(`kind.${booking.kind}`), booking.number, booking.cancelled && tb('state.cancelled')].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  onClick={() => {
                    setBooking(null)
                    form.setValue('bookingId', '')
                  }}
                >
                  {t('form.bookingRemove')}
                </Button>
              </div>
            ) : (
              <BookingPicker label={t('form.bookingSearch')} onSelect={pickBooking} />
            )}
            <p className="text-[13px] text-ds-neutral-800" aria-live="polite">
              {bookingLoading ? t('form.bookingLoadingLines') : t('form.bookingHint')}
            </p>
          </fieldset>

          <fieldset className="flex flex-col gap-4">
            <legend className="mb-2 text-sm font-semibold">{t('form.guest')}</legend>
            <FormField
              control={form.control}
              name="guestMode"
              render={({ field }) => (
                <RadioGroup value={field.value} onValueChange={field.onChange} className="grid grid-cols-2 gap-3" aria-label={t('form.guest')}>
                  {(['existing', 'new'] as const).map((m) => (
                    <Label key={m} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 font-normal has-[[data-state=checked]]:border-ds-accent-700">
                      <RadioGroupItem value={m} />
                      {m === 'existing' ? t('form.guestExisting') : t('form.guestNew')}
                    </Label>
                  ))}
                </RadioGroup>
              )}
            />
            {guestMode === 'existing' ? (
              <div className="flex flex-col gap-2">
                {picked ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-ds-surface px-4 py-3">
                    <span className="flex min-w-0 flex-col">
                      <span className="break-words font-medium">{guestSortName(picked)}</span>
                      <span className="text-[13px] text-ds-neutral-700">
                        {[picked.companyName, countryName(picked.country, locale)].filter(Boolean).join(' · ')}
                      </span>
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      className="min-h-11"
                      onClick={() => {
                        setPicked(null)
                        form.setValue('guestId', '')
                      }}
                    >
                      {t('form.guestChange')}
                    </Button>
                  </div>
                ) : (
                  <GuestPicker label={t('form.guestSearch')} onSelect={(row) => pickGuest(row)} />
                )}
                <p className="text-[13px] text-ds-neutral-800">{t('form.guestHint')}</p>
              </div>
            ) : (
              <div className="flex flex-col gap-4 rounded-lg border p-4">
                {/* Eigenes Formular für die Gast-Felder (PROJ-7), ohne eigenes <form>-Element */}
                <Form {...guestForm}>
                  <GuestFields />
                </Form>
                {visibleDuplicates && (
                  <Alert role="alert" className="border-ds-accent-700/40 bg-ds-accent-100">
                    <WarningCircle size={18} weight="duotone" aria-hidden="true" />
                    <AlertTitle>{tg('duplicateWarning.title')}</AlertTitle>
                    <AlertDescription className="flex flex-col gap-3">
                      <p>{tg('duplicateWarning.text')}</p>
                      <ul className="flex flex-col gap-2">
                        {visibleDuplicates.map((m) => (
                          <li key={m.guest.id} className="flex flex-wrap items-center justify-between gap-2">
                            <span className="flex flex-col">
                              <span className="font-medium">{guestSortName(m.guest)}</span>
                              <span className="text-[13px] text-ds-neutral-800">
                                {countryName(m.guest.country, locale)} · {m.reasons.map((r) => tg(`reason.${r}`)).join(', ')}
                              </span>
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              className="min-h-11"
                              onClick={() => {
                                pickGuest(m.guest)
                                setDuplicates(null)
                              }}
                            >
                              {t('form.guestExisting')}
                            </Button>
                          </li>
                        ))}
                      </ul>
                      <Button type="button" className="min-h-11 self-start" disabled={submitting} onClick={form.handleSubmit((v) => save(v, true))}>
                        {tg('duplicateWarning.createAnyway')}
                      </Button>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
          </fieldset>

          <FormField
            control={form.control}
            name="recipient"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('form.recipient')}</FormLabel>
                <FormControl>
                  <Input
                    autoComplete="off"
                    maxLength={L.recipientMax}
                    className="min-h-11"
                    {...field}
                    onChange={(e) => {
                      setRecipientTouched(true)
                      field.onChange(e)
                    }}
                  />
                </FormControl>
                <FormDescription>{t('form.recipientHint')}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <fieldset className="flex flex-col gap-3">
            <legend className="mb-2 text-sm font-semibold">{t('form.lines')}</legend>
            {lines.fields.length === 0 && <p className="rounded-lg bg-ds-surface px-4 py-3 text-sm text-ds-neutral-800">{t('form.linesEmpty')}</p>}
            <SortableChargeList
              ids={lines.fields.map((l) => l.id)}
              labelAt={(i) => form.getValues(`lines.${i}.label`) ?? ''}
              onMove={lines.move}
              onDraggingChange={(d) => {
                sortingLine.current = d
              }}
            >
              {lines.fields.map((line, i) => (
                <SortableChargeRow
                  key={line.id}
                  id={line.id}
                  sortable={lines.fields.length > 1}
                  withVat={showVat}
                  handleLabel={tb('panel.moveCharge', { label: lineRows[i]?.label?.trim() || tb('panel.chargeFallback', { n: i + 1 }) })}
                >
                  <FormField
                    control={form.control}
                    name={`lines.${i}.label`}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="sr-only">{t('form.lineLabel', { n: i + 1 })}</FormLabel>
                        <FormControl>
                          {/* Auswahl setzt Bezeichnung und Satz; freies Tippen ändert den Satz nie (PROJ-35) */}
                          <LabelCombobox
                            maxLength={L.lineLabelMax}
                            placeholder={t('form.lineLabelPlaceholder')}
                            className="min-h-11"
                            choices={chargeChoices}
                            listLabel={tb('panel.chargeChoices')}
                            onListOpenChange={(o) => {
                              labelListOpen.current = o
                            }}
                            {...field}
                            onValueChange={field.onChange}
                            onChoose={(choice) => {
                              const bp = CHARGE_CHOICES.find((c) => c.key === choice.key)?.vatBp
                              if (bp !== undefined) form.setValue(`lines.${i}.vat`, vatRateInput(bp), validate())
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className={chargeMoneyCell(lines.fields.length > 1, showVat)}>
                    <FormField
                      control={form.control}
                      name={`lines.${i}.amount`}
                      render={({ field }) => (
                        <FormItem className={showVat ? 'w-28 shrink-0' : undefined}>
                          <FormLabel className="sr-only">{t('form.lineAmount', { n: i + 1 })}</FormLabel>
                          <FormControl>
                            <AmountInput negative placeholder={t('form.lineAmountPlaceholder')} className="min-h-11 w-28" {...field} onValueChange={field.onChange} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {showVat && (
                      <FormField
                        control={form.control}
                        name={`lines.${i}.vat`}
                        render={({ field }) => (
                          <FormItem className="w-32 shrink-0">
                            <FormLabel className="sr-only">{t('form.lineVat', { n: i + 1 })}</FormLabel>
                            <div className="flex items-center gap-1.5">
                              <FormControl>
                                <VatRateInput className="min-h-11 w-20" {...field} onValueChange={field.onChange} />
                              </FormControl>
                              <span className="text-sm text-ds-neutral-800" aria-hidden="true">
                                {tb('panel.vatSuffix')}
                              </span>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>
                  <Button type="button" variant="ghost" size="icon" className="size-11" aria-label={t('form.lineRemove', { n: i + 1 })} onClick={() => lines.remove(i)}>
                    <Trash size={18} aria-hidden="true" />
                  </Button>
                </SortableChargeRow>
              ))}
            </SortableChargeList>
            {linesError && (
              <p role="alert" className="text-sm text-destructive">
                {linesError}
              </p>
            )}
            {lines.fields.length < L.linesMax && (
              <Button
                type="button"
                variant="outline"
                className="min-h-11 self-start"
                onClick={() => lines.append({ label: '', amount: '', vat: vatRateInput(VAT_DEFAULTS.charge) }, { shouldFocus: true })}
              >
                <Plus size={16} aria-hidden="true" />
                {t('form.lineAdd')}
              </Button>
            )}

            <div className="flex items-baseline justify-between gap-3 border-t pt-3" aria-live="polite">
              <span>{t('form.total')}</span>
              {total === null ? <span className="text-lg font-semibold tabular-nums">–</span> : <Amount cents={total} className="text-lg font-semibold" />}
            </div>
            {!showVat && <p className="text-[13px] text-ds-neutral-800">{t('detail.noVat')}</p>}
            {vatShares.length > 0 && (
              <dl className="flex flex-col gap-1 text-sm" aria-label={t('detail.vatIncluded')}>
                {vatShares.map((s) => (
                  <div key={s.vatBp} className="flex items-baseline justify-between gap-4">
                    <dt className="text-ds-neutral-800">{t('form.vatShare', { rate: formatVatRate(s.vatBp) })}</dt>
                    <dd>
                      <Amount cents={s.vatCents} />
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </fieldset>

          <FormField
            control={form.control}
            name="pdfPath"
            render={({ field }) => (
              <FormItem>
                <p className="text-sm font-medium">{t('form.pdf')}</p>
                <InvoicePdfField
                  id="rechnung-pdf"
                  value={field.value}
                  onChange={field.onChange}
                  saved={invoice?.pdfPath ? { path: invoice.pdfPath, links: invoice.pdf } : undefined}
                  describedBy="rechnung-pdf-hinweis"
                />
                <FormDescription id="rechnung-pdf-hinweis">{t('form.pdfHint')}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {!visibleDuplicates && (
            <Button type="submit" disabled={submitting || bookingLoading} aria-busy={submitting} className="min-h-11">
              {invoice ? t('form.saveChanges') : t('form.save')}
            </Button>
          )}
        </form>
      </Form>

      {replaceWith && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setReplaceWith(null)}
          title={t('form.replaceTitle')}
          text={t('form.replaceText', { count: replaceWith.length })}
          confirmLabel={t('form.replaceConfirm')}
          cancelLabel={t('form.replaceKeep')}
          onConfirm={() => {
            replaceLines(replaceWith)
            setReplaceWith(null)
          }}
        />
      )}
    </DetailPanel>
  )
}
