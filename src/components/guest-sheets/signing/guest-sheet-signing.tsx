'use client'

import { ArrowLeft, ArrowRight, Check, CheckCircle, CloudArrowUp, WarningCircle } from '@phosphor-icons/react'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslations } from 'next-intl'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'

import { saveSheetCompanions, saveSheetGuest } from '@/app/(app)/gaesteblaetter/actions'
import { callAction } from '@/components/auth/form-error'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { initialSheetForm, sameCompanionInput, sheetCompanionsOf, type SheetForm, sheetGuestOf } from '@/components/guest-sheets/signing/sheet-form'
import { SheetPageOne } from '@/components/guest-sheets/signing/sheet-page-one'
import { SheetPageTwo } from '@/components/guest-sheets/signing/sheet-page-two'
import { SignatureField, type SignatureValue } from '@/components/guest-sheets/signing/signature-field'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { bookingHref } from '@/lib/bookings'
import { isDocumentField, SHEET_GUEST_FIELDS, sheetComplete, sheetGaps, type SheetGuestField } from '@/lib/guest-sheet'
import type { SigningData } from '@/lib/guest-sheets-data'
import type { IdField } from '@/lib/id-reading'
import { cn } from '@/lib/utils'
import { sheetCompanionSchema, sheetGuestSchema } from '@/lib/validation/guest-sheet'

// Nach der letzten Eingabe so lange warten, bevor automatisch gespeichert wird (z. B. Ort aus der PLZ)
const AUTOSAVE_MS = 1200
const DOCUMENT_FIELDS = SHEET_GUEST_FIELDS.filter(isDocumentField)

type SaveState = 'idle' | 'saving' | 'saved' | 'error'
type FinishError =
  | 'sheetExists'
  | 'staleBooking'
  | 'incomplete'
  | 'notImplemented'
  | 'network'
  | 'unknown'
  | 'sessionExpired'
  | 'tooManyCompanions'
  // keine freie Gästeblattnummer (Erweiterung 2026-11-09); die Unterschriften bleiben, „Fertig“ ist erneut möglich
  | 'noSheetNumber'

interface GuestSheetSigningProps {
  data: SigningData
  locale: string
  today: string
}

// Gästeblatt am Tablet (PROJ-26): Seite 1 Meldedaten mit Unterschrift 1, „Weiter“, Seite 2 Datenschutz mit Unterschrift 2,
// „Fertig“. Ergänzte Felder werden beim Verlassen (bzw. kurz nach der letzten Eingabe) einzeln gespeichert; die Unterschrift 1
// ist erst möglich, wenn alles vollständig und gespeichert ist. Ändert sich danach etwas auf Seite 1, gilt sie nicht mehr.
export function GuestSheetSigning({ data }: GuestSheetSigningProps) {
  const t = useTranslations('guestSheets.signing')
  const te = useTranslations('guestSheets.errors')
  const tv = useTranslations('guestSheets.validation')
  const guest = data.guest!
  const initial = useMemo(() => initialSheetForm(data), [data])
  const guestSchema = useMemo(() => sheetGuestSchema(tv), [tv])
  const formSchema = useMemo(
    () =>
      guestSchema.extend({
        companions: z.array(sheetCompanionSchema(tv).extend({ taxExempt: z.boolean() })),
      }),
    [guestSchema, tv]
  )
  const form = useForm<SheetForm>({ resolver: zodResolver(formSchema, undefined, { raw: true }) as never, defaultValues: initial, mode: 'onTouched' })

  const [step, setStep] = useState<1 | 2>(1)
  const [sig1, setSig1] = useState<SignatureValue>(null)
  const [sig2, setSig2] = useState<SignatureValue>(null)
  const [consent, setConsent] = useState(false)
  const [sig1Cleared, setSig1Cleared] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)
  const [documentWaiting, setDocumentWaiting] = useState(false)
  // Gespeicherter Stand je Feld (Vergleich für „ungespeichert“) und Stände von Gast und Buchung
  const saved = useRef<SheetForm>(initial)
  const stamps = useRef({ guest: guest.updatedAt, booking: data.booking.updatedAt })
  const queue = useRef<Promise<void>>(Promise.resolve())
  // Werte aus „Ausweis auslesen“ übernommen (PROJ-51): die nächsten Speicherungen tragen den Vermerk im Protokoll
  const fromIdDocument = useRef(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const sig1Ref = useRef<SignatureValue>(null)
  useEffect(() => {
    sig1Ref.current = sig1
  }, [sig1])

  const [abort, setAbort] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const [finishError, setFinishError] = useState<FinishError | null>(null)
  const [conflict, setConflict] = useState<string | null>(null)

  const values = useWatch({ control: form.control }) as SheetForm
  const gaps = sheetGaps(sheetGuestOf(values, guest), sheetCompanionsOf(values), data.booking.persons)
  const complete = sheetComplete(gaps)

  // ---- Speichern einzelner Felder ------------------------------------------------------------------

  const saveDirty = useCallback(async () => {
    const v = form.getValues()
    const s = saved.current
    const failures: string[] = []
    const valid = (field: SheetGuestField) => guestSchema.pick({ [field]: true } as never).safeParse({ [field]: v[field] }).success

    // Hauptgast: einfache Felder einzeln geprüft; das Reisedokument nur zusammen und erst mit Art und Nummer (Regel der Datenbank)
    const plain = SHEET_GUEST_FIELDS.filter((f) => !isDocumentField(f) && v[f] !== s[f] && valid(f))
    const documentDirty = DOCUMENT_FIELDS.some((f) => v[f] !== s[f])
    const documentEmpty = DOCUMENT_FIELDS.every((f) => !v[f])
    const documentReady = documentDirty && (documentEmpty || (Boolean(v.documentType) && Boolean(v.documentNumber.trim()))) && DOCUMENT_FIELDS.every(valid)
    setDocumentWaiting(documentDirty && !documentReady)
    const guestFields = [...plain, ...(documentReady ? DOCUMENT_FIELDS : [])]
    const companionsDirty =
      !sameCompanionInput(v.companions, s.companions) && v.companions.every((c) => sheetCompanionSchema(tv).safeParse(c).success)
    if (!guestFields.length && !companionsDirty) return

    setSaveState('saving')
    if (guestFields.length) {
      const result = await callAction(() =>
        saveSheetGuest({
          tenantId: data.tenantId,
          bookingId: data.booking.id,
          updatedAt: stamps.current.guest,
          values: Object.fromEntries(guestFields.map((f) => [f, v[f]])),
          fromIdDocument: fromIdDocument.current,
        })
      )
      if (result.ok && result.data) {
        stamps.current.guest = result.data.updatedAt
        saved.current = { ...saved.current, ...Object.fromEntries(guestFields.map((f) => [f, v[f]])) }
        // Vermerk gilt, bis auch das Reisedokument gespeichert ist (es wartet auf Art und Nummer)
        if (!(documentDirty && !documentReady)) fromIdDocument.current = false
      } else failures.push(result.ok ? 'unknown' : result.error)
    }
    if (companionsDirty) {
      const companions = v.companions.map((c) => ({ ...c }))
      const result = await callAction(() =>
        saveSheetCompanions({ tenantId: data.tenantId, bookingId: data.booking.id, updatedAt: stamps.current.booking, companions })
      )
      if (result.ok && result.data) {
        stamps.current.booking = result.data.updatedAt
        saved.current = { ...saved.current, companions }
      } else failures.push(result.ok ? 'unknown' : result.error)
    }
    setSaveError(failures[0] ?? null)
    setSaveState(failures.length ? 'error' : 'saved')
  }, [data.booking.id, data.tenantId, form, guestSchema, tv])

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    queue.current = queue.current.then(saveDirty, saveDirty)
    return queue.current
  }, [saveDirty])

  // Ausweisbilder, die beim Öffnen schon hinterlegt waren, werden auf dem Blatt nicht angeboten
  const [imagesOnFile] = useState(() => ({ front: Boolean(guest.documentFrontPath), back: Boolean(guest.documentBackPath) }))

  // E-Mail auf Seite 2, nur wenn der Gast beim Öffnen keine hatte; gespeichert in derselben Warteschlange wie Seite 1
  const [askEmail] = useState(() => !guest.email)
  const saveEmail = useCallback(
    (email: string): Promise<string | null> => {
      let outcome: string | null = null
      queue.current = queue.current.then(async () => {
        const result = await callAction(() =>
          saveSheetGuest({ tenantId: data.tenantId, bookingId: data.booking.id, updatedAt: stamps.current.guest, values: { email } })
        )
        if (result.ok && result.data) stamps.current.guest = result.data.updatedAt
        else outcome = result.ok ? 'unknown' : result.error
      })
      return queue.current.then(() => outcome)
    },
    [data.booking.id, data.tenantId]
  )

  // Jede Änderung auf Seite 1: Unterschrift 1 gilt nicht mehr; nach kurzer Pause speichern. Das Formular meldet sich auch
  // ohne geänderte Werte (z. B. Prüfung beim Verlassen eines Felds, wenn der Stift die Fläche berührt); darum werden die
  // Werte selbst verglichen (BUG-1 aus QA)
  const seenValues = useRef(JSON.stringify(initial))
  useEffect(() => {
    const unsubscribe = form.subscribe({
      formState: { values: true },
      callback: () => {
        const now = JSON.stringify(form.getValues())
        if (now === seenValues.current) return
        seenValues.current = now
        if (sig1Ref.current) {
          setSig1(null)
          setSig1Cleared(true)
        }
        if (timer.current) clearTimeout(timer.current)
        timer.current = setTimeout(() => void flush(), AUTOSAVE_MS)
      },
    })
    return () => {
      unsubscribe()
      if (timer.current) clearTimeout(timer.current)
    }
  }, [flush, form])

  // Weicht die Eingabe vom gespeicherten Stand ab?
  const differs = (v: SheetForm, s: SheetForm) =>
    SHEET_GUEST_FIELDS.some((f) => v[f] !== s[f]) || !sameCompanionInput(v.companions ?? [], s.companions)

  // Unterschreiben, sobald alle Pflichtangaben eingetragen sind. Ein laufendes Speichern sperrt die Fläche nicht: Wer direkt
  // vom Feld zum Stift wechselt, verlor sonst den ersten Strich (BUG-1 aus QA). „Weiter“ wartet, bis alles gespeichert ist.
  const canSign1 = complete
  const sig1Hint = gaps.companionsTooMany ? te('tooManyCompanions') : !complete ? t('completeFirst') : undefined
  const [advancing, setAdvancing] = useState(false)

  async function next() {
    setAdvancing(true)
    await flush()
    setAdvancing(false)
    // Was jetzt noch abweicht, ließ sich nicht speichern (ungültige Eingabe, Verbindung, Stand)
    if (differs(form.getValues(), saved.current)) {
      setSaveError((e) => e ?? 'notSaved')
      window.scrollTo({ top: 0 })
      return
    }
    setStep(2)
    window.scrollTo({ top: 0 })
  }

  // ---- Fertigstellen ---------------------------------------------------------------------------------

  async function finish(previousSheetId: string | null) {
    if (!sig1 || !sig2) return
    setFinishing(true)
    setFinishError(null)
    await flush()
    try {
      const response = await fetch('/api/gaesteblatt/fertig', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          tenantId: data.tenantId,
          bookingId: data.booking.id,
          bookingUpdatedAt: stamps.current.booking,
          guestUpdatedAt: stamps.current.guest,
          previousSheetId,
          marketingConsent: consent,
          signature1: sig1,
          signature2: sig2,
        }),
      })
      const body = (await response.json().catch(() => ({}))) as { error?: FinishError; currentSheetId?: string; bookingUpdatedAt?: string }
      // Nummer schon vergeben, danach gescheitert: neuer Stand der Buchung für das erneute „Fertig“
      if (body.bookingUpdatedAt) stamps.current.booking = body.bookingUpdatedAt
      if (response.ok) {
        // Vollständiger Seitenaufruf: zurück zur Buchung mit frischem Stand
        window.location.href = `${bookingHref(data.booking.id)}?gaesteblatt=gespeichert`
        return
      }
      if (body.error === 'sheetExists' && body.currentSheetId) setConflict(body.currentSheetId)
      else if (body.error === 'staleBooking') {
        setSig1(null)
        setSig2(null)
        setStep(1)
        setFinishError('staleBooking')
      } else setFinishError(body.error ?? 'unknown')
    } catch {
      setFinishError('network')
    }
    setFinishing(false)
  }

  const leave = () => {
    window.location.href = bookingHref(data.booking.id)
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-20 border-b bg-ds-bg shadow-sm">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 flex-col">
            <span className="text-[13px] uppercase tracking-wide text-ds-neutral-800">{t('title')}</span>
            <span className="break-words font-semibold">{data.tenantName}</span>
          </div>
          <ol className="flex items-center gap-2 text-sm" aria-label={t('progress')}>
            {[1, 2].map((n) => (
              <li
                key={n}
                aria-current={step === n ? 'step' : undefined}
                className={cn('flex items-center gap-1.5 rounded-full px-3 py-1', step === n ? 'bg-ds-accent-700 text-white' : 'bg-ds-surface text-ds-neutral-800')}
              >
                {n === 1 && step === 2 ? <Check size={14} weight="bold" aria-hidden="true" /> : <span>{n}</span>}
                {t(n === 1 ? 'step1' : 'step2')}
              </li>
            ))}
          </ol>
          <SaveStatus state={saveState} />
        </div>
      </header>

      <form
        noValidate
        onSubmit={(e) => e.preventDefault()}
        // Feld verlassen → sofort speichern
        onBlur={() => void flush()}
        className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6"
      >
        {data.currentSheetId && step === 1 && (
          <Alert className="border-ds-accent-700/40 bg-ds-accent-100">
            <AlertDescription>{t('replacesExisting')}</AlertDescription>
          </Alert>
        )}
        {saveError && (
          <Alert role="alert" className="border-ds-accent-2-700/40 bg-ds-accent-2-100 text-ds-accent-2-800">
            <WarningCircle size={18} weight="duotone" aria-hidden="true" />
            <AlertDescription className="flex flex-col items-start gap-2 text-ds-accent-2-800">
              {te(saveError as never)}
              {saveError === 'staleGuest' || saveError === 'staleBooking' ? (
                <Button type="button" variant="outline" className="min-h-11 bg-white" onClick={() => window.location.reload()}>
                  {t('reload')}
                </Button>
              ) : (
                <Button type="button" variant="outline" className="min-h-11 bg-white" onClick={() => void flush()}>
                  {t('retrySave')}
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )}
        {finishError && (
          <Alert role="alert" className="border-ds-accent-2-700/40 bg-ds-accent-2-100 text-ds-accent-2-800">
            <WarningCircle size={18} weight="duotone" aria-hidden="true" />
            <AlertDescription className="text-ds-accent-2-800">{finishError === 'unknown' ? t('finishFailed') : te(finishError)}</AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <div className={cn(step !== 1 && 'hidden')}>
            <SheetPageOne
              tenantName={data.tenantName}
              sheetNumber={data.booking.sheetNumber}
              establishmentNumber={data.establishmentNumber}
              stay={{ arrival: data.booking.arrival, plannedDeparture: data.booking.plannedDeparture, persons: data.booking.persons }}
              gaps={gaps}
              onCommit={() => void flush()}
              documentWaiting={documentWaiting}
              imagesOnFile={imagesOnFile}
              idReading={{
                tenantId: data.tenantId,
                guestId: guest.id,
                bookingId: data.booking.id,
                onApply: (values) => {
                  for (const [field, value] of Object.entries(values) as [IdField, string][]) {
                    form.setValue(field, value as never, { shouldDirty: true, shouldValidate: true })
                  }
                  fromIdDocument.current = true
                  void flush()
                },
              }}
            />
          </div>
        </Form>

        {step === 1 && (
          <section className="flex flex-col gap-3 rounded-lg border bg-ds-surface p-4">
            {sig1Cleared && !sig1 && <p className="text-sm text-ds-accent-2-800">{t('signatureCleared')}</p>}
            <SignatureField
              id="unterschrift-1"
              label={t('signature1')}
              value={sig1}
              onChange={(v) => {
                setSig1(v)
                if (v) setSig1Cleared(false)
              }}
              disabled={!canSign1}
              hint={canSign1 ? undefined : sig1Hint}
            />
          </section>
        )}

        {step === 2 && (
          <SheetPageTwo
            texts={data.texts}
            consent={consent}
            onConsent={setConsent}
            signature={sig2}
            onSignature={setSig2}
            email={askEmail ? { save: saveEmail } : null}
          />
        )}

        <div className="sticky bottom-0 -mx-4 mt-auto flex flex-wrap items-center justify-between gap-3 z-20 border-t bg-ds-bg px-4 py-3 shadow-[0_-1px_3px_rgba(0,0,0,0.08)]">
          <Button type="button" variant="ghost" className="min-h-11" onClick={() => setAbort(true)}>
            {t('abort')}
          </Button>
          <div className="flex flex-wrap gap-2">
            {step === 2 && (
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setStep(1)}>
                <ArrowLeft size={18} aria-hidden="true" />
                {t('back')}
              </Button>
            )}
            {step === 1 ? (
              <Button
                type="button"
                className="min-h-11"
                disabled={!sig1 || advancing}
                aria-busy={advancing}
                onClick={() => void next()}
              >
                {t('next')}
                <ArrowRight size={18} aria-hidden="true" />
              </Button>
            ) : (
              <Button type="button" className="min-h-11" disabled={!sig1 || !sig2 || finishing} aria-busy={finishing} onClick={() => void finish(data.currentSheetId)}>
                <CheckCircle size={18} aria-hidden="true" />
                {finishing ? t('finishing') : t('finish')}
              </Button>
            )}
          </div>
        </div>
      </form>

      <ConfirmDialog
        open={abort}
        onOpenChange={setAbort}
        title={t('abortTitle')}
        text={t('abortText')}
        confirmLabel={t('abortConfirm')}
        cancelLabel={t('abortCancel')}
        onConfirm={leave}
      />
      <AlertDialog open={conflict !== null} onOpenChange={(open) => !open && setConflict(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('conflictTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('conflictText')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="min-h-11" onClick={leave}>
              {t('conflictDiscard')}
            </AlertDialogCancel>
            <AlertDialogAction
              className="min-h-11"
              onClick={() => {
                const current = conflict
                setConflict(null)
                void finish(current)
              }}
            >
              {t('conflictReplace')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function SaveStatus({ state }: { state: SaveState }) {
  const t = useTranslations('guestSheets.signing')
  if (state === 'idle') return <span className="text-sm text-ds-neutral-800" />
  return (
    <span role="status" className={cn('flex items-center gap-1.5 text-sm', state === 'error' ? 'text-ds-accent-2-800' : 'text-ds-neutral-800')}>
      {state === 'error' ? <WarningCircle size={16} aria-hidden="true" /> : <CloudArrowUp size={16} aria-hidden="true" />}
      {t(`save.${state}`)}
    </span>
  )
}
