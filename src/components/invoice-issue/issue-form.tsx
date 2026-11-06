'use client'

import { Info, Prohibit, WarningCircle } from '@phosphor-icons/react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { IssueResponse } from '@/app/api/rechnungen/[id]/ausstellen/route'
import { PdfPreview } from '@/components/invoice-pdf/pdf-preview'
import { usePdfPreview } from '@/components/invoice-pdf/use-pdf-preview'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatDatePlain } from '@/lib/format'
import { invoiceEditHref } from '@/lib/invoice-drafts'
import { type IssueAck, type IssueBlock, issueAllowed, type IssueNote, isIssueDate } from '@/lib/invoice-issue'
import { nextInvoiceNumber, type NumberingSettings } from '@/lib/invoice-numbering'
import { INVOICE_LIMITS, invoiceHref } from '@/lib/invoices'

interface IssueFormProps {
  id: string
  updatedAt: string
  initialDate: string
  today: string
  numbering: NumberingSettings
  numbers: string[]
}

const PREVIEW_URL = '/api/rechnungen/vorschau'
// Über der längsten Dauer der Schnittstelle: Danach ist die Antwort verloren, nicht unterwegs (BUG-3)
const ISSUE_TIMEOUT_MS = 65_000
const LINK = 'flex min-h-11 w-fit items-center text-sm text-ds-accent-700 underline underline-offset-[3px] sm:min-h-0'

// Seite „Rechnung ausstellen“ (PROJ-42): Datum, Nummer, Prüfungen und Häkchen neben der PDF-Vorschau. Datum und Nummer gelten
// erst mit dem Ausstellen, der Entwurf bleibt bis dahin unverändert. Die Prüfliste kommt mit dem PDF vom Server.
export function IssueForm({ id, updatedAt, initialDate, today, numbering, numbers }: IssueFormProps) {
  const t = useTranslations('invoiceIssue')
  const [date, setDate] = useState(initialDate)
  // null: Vorschlag; sonst von Hand eingegeben
  const [typed, setTyped] = useState<string | null>(null)
  // Während die Seite offen war vergebene Nummern (Meldung „inzwischen vergeben“)
  const [taken, setTaken] = useState<string[]>([])
  const [acked, setAcked] = useState<ReadonlySet<string>>(new Set())
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<Exclude<IssueResponse, { ok: true }>['error'] | 'network' | 'timeout' | null>(null)
  const dateRef = useRef<HTMLInputElement>(null)
  const numberRef = useRef<HTMLInputElement>(null)

  const dateValid = isIssueDate(date)
  const proposal = useMemo(() => (dateValid ? nextInvoiceNumber(numbering, [...numbers, ...taken], date).number : ''), [numbering, numbers, taken, date, dateValid])
  const number = typed ?? proposal

  // Eingaben übernehmen, die vor dem Aktivwerden der Seite gemacht wurden (wie useAdoptEarlyInput)
  useEffect(() => {
    if (dateRef.current && dateRef.current.value !== initialDate) setDate(dateRef.current.value)
    if (numberRef.current && numberRef.current.value !== nextInvoiceNumber(numbering, numbers, initialDate).number) setTyped(numberRef.current.value)
    // Nur einmal: danach läuft jede Eingabe über den Zustand
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const body = useMemo(() => (dateValid ? JSON.stringify({ draftId: id, issue: { invoiceDate: date, number } }) : null), [id, date, number, dateValid])
  const state = usePdfPreview(PREVIEW_URL, body, 400)
  const checks = state.meta?.issue ?? null
  // Die Liste gilt nur für genau diesen Stand
  const current = checks !== null && checks.invoiceDate === date && checks.number === number.trim() && !state.loading && !state.failed
  const canIssue = current && dateValid && !pending && issueAllowed(checks, acked)

  // Der Vorschlag wurde inzwischen von jemand anderem vergeben: nächste freie Nummer vorschlagen (BUG-4)
  const takenProposal = typed === null && checks?.blocks.some((b) => b.key === 'numberTaken' && b.number === proposal) ? proposal : null
  useEffect(() => {
    if (takenProposal) setTaken((prev) => [...prev, takenProposal])
  }, [takenProposal])

  function toggle(ackId: string, on: boolean) {
    setAcked((prev) => {
      const next = new Set(prev)
      if (on) next.add(ackId)
      else next.delete(ackId)
      return next
    })
  }

  async function issue() {
    if (!canIssue || !checks) return
    setPending(true)
    setError(null)
    let result: IssueResponse
    try {
      const res = await fetch(`/api/rechnungen/${id}/ausstellen`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ invoiceDate: date, number: number.trim(), updatedAt, acks: checks.acks.filter((a) => acked.has(a.id)).map((a) => a.id) }),
        signal: AbortSignal.timeout(ISSUE_TIMEOUT_MS),
      })
      result = (await res.json()) as IssueResponse
    } catch (e) {
      setPending(false)
      setError(e instanceof DOMException && e.name === 'TimeoutError' ? 'timeout' : 'network')
      return
    }
    if (result.ok) {
      // Vollständiger Seitenaufruf: zeigt sicher den frischen Stand, der Knopf bleibt bis dahin gesperrt
      window.location.assign(`${invoiceHref(result.id)}?ausgestellt=1`)
      return
    }
    setPending(false)
    if (result.error === 'sessionExpired') {
      window.location.href = `/anmelden?grund=sitzung-abgelaufen&next=${encodeURIComponent(window.location.pathname)}`
      return
    }
    setError(result.error)
    if (result.error === 'numberTaken' && result.takenNumber) {
      setTaken((prev) => [...prev, result.takenNumber as string])
      setTyped(null)
    }
    if (result.error === 'blocked') state.retry()
  }

  return (
    <div className="-mt-4 grid gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start">
      <div className="contents lg:flex lg:flex-col lg:gap-6">
        <section aria-labelledby="ausstellen-angaben" className="order-1 flex flex-col gap-6">
          <h2 id="ausstellen-angaben" className="sr-only">
            {t('dataTitle')}
          </h2>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ausstellen-datum">{t('date.label')}</Label>
            <Input
              ref={dateRef}
              id="ausstellen-datum"
              name="invoiceDate"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              aria-invalid={!dateValid}
              aria-describedby={dateValid ? undefined : 'ausstellen-datum-fehler'}
              className="min-h-11"
            />
            {!dateValid && (
              <p id="ausstellen-datum-fehler" className="text-sm text-ds-accent-2-800">
                {t('date.invalid')}
              </p>
            )}
            {date !== today && (
              <Button type="button" variant="link" className="min-h-11 w-fit p-0 text-ds-accent-700 sm:min-h-0" onClick={() => setDate(today)}>
                {t('date.today')}
              </Button>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ausstellen-nummer">{t('number.label')}</Label>
            <Input
              ref={numberRef}
              id="ausstellen-nummer"
              name="number"
              value={number}
              maxLength={INVOICE_LIMITS.numberMax}
              autoComplete="off"
              onChange={(e) => setTyped(e.target.value)}
              className="min-h-11"
            />
            {typed !== null && typed.trim() !== proposal && (
              <Button type="button" variant="link" className="min-h-11 w-fit p-0 text-ds-accent-700 sm:min-h-0" onClick={() => setTyped(null)}>
                {t('number.useProposal', { number: proposal })}
              </Button>
            )}
          </div>

          <div aria-live="polite" className="flex flex-col gap-3">
            {checks?.blocks.map((b, i) => <BlockItem key={i} block={b} id={id} />)}
            {checks?.notes.map((n, i) => <NoteItem key={i} note={n} />)}
            {checks && checks.blocks.length === 0 && checks.notes.length === 0 && checks.acks.length === 0 && <p className="text-sm text-ds-neutral-800">{t('allOk')}</p>}
          </div>
          {checks && checks.acks.length > 0 && (
            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1 text-sm font-semibold">{t('acks.title')}</legend>
              {checks.acks.map((a) => (
                <AckItem key={a.id} ack={a} checked={acked.has(a.id)} onChange={(on) => toggle(a.id, on)} />
              ))}
            </fieldset>
          )}
        </section>

        <section aria-labelledby="ausstellen-abschluss" className="order-3 flex flex-col gap-3">
          <h2 id="ausstellen-abschluss" className="sr-only">
            {t('submitTitle')}
          </h2>
          {error && <IssueError error={error} />}
          <p className="text-sm text-ds-neutral-800">{t('final')}</p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" className="min-h-11" disabled={!canIssue} aria-busy={pending} onClick={issue}>
              {t(pending ? 'submitting' : 'submit')}
            </Button>
            <Button asChild variant="outline" className="min-h-11">
              <Link href={invoiceHref(id)}>{t('back')}</Link>
            </Button>
          </div>
        </section>
      </div>
      <section aria-label={t('previewLabel')} className="order-2 min-w-0 lg:max-w-[820px]">
        <PdfPreview state={state} label={t('previewLabel')} />
      </section>
    </div>
  )
}

function BlockItem({ block, id }: { block: IssueBlock; id: string }) {
  const t = useTranslations('invoiceIssue.blocks')
  const tr = useTranslations('invoiceDrafts.required')
  const links = (): React.ReactNode => {
    switch (block.key) {
      case 'required':
        if (block.check.settings) return <Link href="/einstellungen/stammdaten" className={LINK}>{t('toMasterData')}</Link>
        return block.check.field ? <Link href={`${invoiceEditHref(id)}#${block.check.field}`} className={LINK}>{t('toDraft')}</Link> : null
      case 'deductionDraft':
        return <Link href={invoiceHref(block.id)} className={LINK}>{t('toPartial')}</Link>
      case 'deductionRemoved':
      case 'bookingCancelled':
      case 'missingChars':
        return <Link href={invoiceEditHref(id)} className={LINK}>{t('toDraft')}</Link>
      case 'issuerOverflow':
        return (
          <span className="flex flex-wrap gap-x-4">
            <Link href="/einstellungen/stammdaten" className={LINK}>{t('toMasterData')}</Link>
            <Link href="/einstellungen/briefpapier" className={LINK}>{t('toLetterhead')}</Link>
          </span>
        )
      case 'footerCut':
        return <Link href="/einstellungen/rechnungen" className={LINK}>{t('toFooter')}</Link>
      default:
        return null
    }
  }
  const text =
    block.key === 'required' ? tr(`${block.check.key}.error` as never) : block.key === 'numberTaken' ? t('numberTaken', { number: block.number }) : block.key === 'missingChars' ? t('missingChars', { chars: block.chars }) : t(block.key)
  return (
    <Alert role="note" className="border-ds-accent-2-700/40 bg-ds-accent-2-100 text-ds-accent-2-800">
      <Prohibit size={18} weight="duotone" aria-hidden="true" />
      <AlertDescription className="flex flex-col items-start gap-1">
        {text}
        {links()}
      </AlertDescription>
    </Alert>
  )
}

export function NoteItem({ note }: { note: IssueNote }) {
  const t = useTranslations('invoiceIssue.notes')
  return (
    <Alert role="note" className="border-ds-neutral-400 bg-ds-surface">
      <Info size={18} weight="duotone" aria-hidden="true" />
      <AlertDescription>{note.key === 'dateLater' || note.key === 'dateEarlier' ? t(note.key, { number: note.number, date: formatDatePlain(note.date) }) : t(note.key)}</AlertDescription>
    </Alert>
  )
}

export function AckItem({ ack, checked, onChange }: { ack: IssueAck; checked: boolean; onChange: (on: boolean) => void }) {
  const t = useTranslations('invoiceIssue.acks')
  const reason =
    ack.key === 'numberAbove' ? t('numberAbove', { next: ack.next }) : ack.key === 'numberOtherFormat' ? t('numberOtherFormat') : ack.key === 'numberOtherYear' ? t('numberOtherYear', { year: String(ack.year) }) : null
  const label = reason ? t('numberConfirm') : t(ack.key as 'bookingChanged' | 'option' | 'logo')
  const inputId = `ausstellen-haekchen-${ack.key}`
  return (
    <div className="flex flex-col gap-0.5">
      {reason && <p className="text-sm text-ds-neutral-800">{reason}</p>}
      <div className="flex min-h-11 items-center gap-3">
        <Checkbox id={inputId} checked={checked} onCheckedChange={(v) => onChange(v === true)} />
        <Label htmlFor={inputId} className="py-2 font-normal">
          {label}
        </Label>
      </div>
    </div>
  )
}

function IssueError({ error }: { error: string }) {
  const t = useTranslations('invoiceIssue.errors')
  return (
    <Alert role="alert" className="border-ds-accent-2-700/40 bg-ds-accent-2-100 text-ds-accent-2-800">
      <WarningCircle size={18} weight="duotone" aria-hidden="true" />
      <AlertDescription className="flex flex-col items-start gap-3">
        {t(error as never)}
        {(error === 'conflict' || error === 'timeout') && (
          <Button type="button" variant="outline" className="min-h-11" onClick={() => window.location.reload()}>
            {t('reload')}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  )
}
