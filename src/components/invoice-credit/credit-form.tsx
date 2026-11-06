'use client'

import { Prohibit, WarningCircle } from '@phosphor-icons/react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef, useState } from 'react'

import type { CreditResponse } from '@/app/api/rechnungen/[id]/gutschrift/route'
import { Amount } from '@/components/amount'
import { AckItem, NoteItem } from '@/components/invoice-issue/issue-form'
import { PdfPreview } from '@/components/invoice-pdf/pdf-preview'
import { usePdfPreview } from '@/components/invoice-pdf/use-pdf-preview'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cleanCreditReason, CREDIT_LIMITS } from '@/lib/invoice-credit'
import { type IssueBlock, issueAllowed, type IssuedSnapshot, isIssueDate } from '@/lib/invoice-issue'
import { nextInvoiceNumber, type NumberingSettings } from '@/lib/invoice-numbering'
import { formatDate, formatDatePlain, formatPeriod } from '@/lib/format'
import { INVOICE_LIMITS, invoiceHref } from '@/lib/invoices'
import { formatVatRate } from '@/lib/vat'

interface CreditFormProps {
  invoice: { id: string; number: string; invoiceDate: string }
  // Fassung der Rechnung mit schon gespiegelten Beträgen (nur lesen)
  mirrored: IssuedSnapshot
  recipientLines: string[]
  today: string
  numbering: NumberingSettings
  numbers: string[]
}

const PREVIEW_URL = '/api/rechnungen/vorschau'
// Über der längsten Dauer der Schnittstelle: Danach ist die Antwort verloren, nicht unterwegs
const ISSUE_TIMEOUT_MS = 65_000
const LINK = 'flex min-h-11 w-fit items-center text-sm text-ds-accent-700 underline underline-offset-[3px] sm:min-h-0'

type CreditError = Exclude<CreditResponse, { ok: true }>['error'] | 'network' | 'timeout'

// Seite „Gutschrift ausstellen“ (PROJ-44): Inhalt der Rechnung gespiegelt (nur lesen), dazu Datum, Grund und Nummer, Prüfungen
// und PDF-Vorschau. Es wird nichts gespeichert, bis „Gutschrift ausstellen“ alles in einem Schritt erledigt.
export function CreditForm({ invoice, mirrored, recipientLines, today, numbering, numbers }: CreditFormProps) {
  const t = useTranslations('invoiceCredit')
  const ti = useTranslations('invoiceIssue')
  const [date, setDate] = useState(today)
  const [reason, setReason] = useState('')
  // null: Vorschlag; sonst von Hand eingegeben
  const [typed, setTyped] = useState<string | null>(null)
  // Während die Seite offen war vergebene Nummern
  const [taken, setTaken] = useState<string[]>([])
  const [acked, setAcked] = useState<ReadonlySet<string>>(new Set())
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<{
    code: CreditError
    creditId?: string
  } | null>(null)
  const dateRef = useRef<HTMLInputElement>(null)
  const reasonRef = useRef<HTMLInputElement>(null)
  const numberRef = useRef<HTMLInputElement>(null)

  const dateValid = isIssueDate(date)
  // Sperren am Datum (die Prüfliste meldet sie ebenfalls; dort werden sie nicht doppelt gezeigt)
  const dateError = !dateValid ? 'invalid' : date < invoice.invoiceDate ? 'beforeInvoice' : date > today ? 'future' : null
  const proposal = useMemo(() => (dateValid ? nextInvoiceNumber(numbering, [...numbers, ...taken], date).number : ''), [numbering, numbers, taken, date, dateValid])
  const number = typed ?? proposal
  const reasonLength = cleanCreditReason(reason).length
  const reasonTooLong = reasonLength > CREDIT_LIMITS.reasonMax

  // Eingaben übernehmen, die vor dem Aktivwerden der Seite gemacht wurden (wie useAdoptEarlyInput)
  useEffect(() => {
    if (dateRef.current && dateRef.current.value !== today) setDate(dateRef.current.value)
    if (reasonRef.current?.value) setReason(reasonRef.current.value)
    if (numberRef.current && numberRef.current.value !== nextInvoiceNumber(numbering, numbers, today).number) setTyped(numberRef.current.value)
    // Nur einmal: danach läuft jede Eingabe über den Zustand
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const body = useMemo(
    () =>
      dateValid
        ? JSON.stringify({
            creditFor: invoice.id,
            credit: { invoiceDate: date, number, reason },
          })
        : null,
    [invoice.id, date, number, reason, dateValid],
  )
  const state = usePdfPreview(PREVIEW_URL, body, 400)
  const checks = state.meta?.issue ?? null
  // Die Liste gilt nur für genau diesen Stand
  const current = checks !== null && checks.invoiceDate === date && checks.number === number.trim() && !state.loading && !state.failed
  const canIssue = current && dateError === null && !reasonTooLong && !pending && issueAllowed(checks, acked)

  // Der Vorschlag wurde inzwischen vergeben: nächste freie Nummer vorschlagen
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
    let result: CreditResponse
    try {
      const res = await fetch(`/api/rechnungen/${invoice.id}/gutschrift`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          invoiceDate: date,
          number: number.trim(),
          reason,
          acks: checks.acks.filter((a) => acked.has(a.id)).map((a) => a.id),
        }),
        signal: AbortSignal.timeout(ISSUE_TIMEOUT_MS),
      })
      result = (await res.json()) as CreditResponse
    } catch (e) {
      setPending(false)
      setError({
        code: e instanceof DOMException && e.name === 'TimeoutError' ? 'timeout' : 'network',
      })
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
    setError({ code: result.error, creditId: result.creditId })
    if (result.error === 'numberTaken' && result.takenNumber) {
      setTaken((prev) => [...prev, result.takenNumber as string])
      setTyped(null)
    }
    if (result.error === 'blocked') state.retry()
  }

  const blocks = checks?.blocks.filter((b) => b.key !== 'dateBeforeInvoice' && b.key !== 'futureDate' && b.key !== 'reasonTooLong') ?? []

  return (
    <div className="-mt-4 grid gap-8 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start">
      <div className="contents lg:flex lg:flex-col lg:gap-6">
        <CreditSummary invoice={invoice} mirrored={mirrored} recipientLines={recipientLines} />

        <section aria-labelledby="gutschrift-angaben" className="order-2 flex flex-col gap-6">
          <h2 id="gutschrift-angaben" className="text-2xl">
            {t('dataTitle')}
          </h2>
          <div className="flex flex-col gap-2">
            <Label htmlFor="gutschrift-datum">{t('date.label')}</Label>
            <Input
              ref={dateRef}
              id="gutschrift-datum"
              name="creditDate"
              type="date"
              value={date}
              min={invoice.invoiceDate}
              max={today}
              onChange={(e) => setDate(e.target.value)}
              aria-invalid={dateError !== null}
              aria-describedby={dateError ? 'gutschrift-datum-fehler' : undefined}
              className="min-h-11"
            />
            {dateError && (
              <p id="gutschrift-datum-fehler" className="text-sm text-ds-accent-2-800">
                {dateError === 'invalid'
                  ? ti('date.invalid')
                  : t(`date.${dateError}`, {
                      date: formatDatePlain(invoice.invoiceDate),
                    })}
              </p>
            )}
            {date !== today && (
              <Button type="button" variant="link" className="min-h-11 w-fit p-0 text-ds-accent-700 sm:min-h-0" onClick={() => setDate(today)}>
                {ti('date.today')}
              </Button>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="gutschrift-grund">{t('reason.label')}</Label>
            <Input
              ref={reasonRef}
              id="gutschrift-grund"
              name="reason"
              value={reason}
              autoComplete="off"
              placeholder={t('reason.placeholder')}
              onChange={(e) => setReason(e.target.value)}
              aria-invalid={reasonTooLong}
              aria-describedby="gutschrift-grund-hinweis"
              className="min-h-11"
            />
            <p id="gutschrift-grund-hinweis" className={`text-sm ${reasonTooLong ? 'text-ds-accent-2-800' : 'text-ds-neutral-800'}`}>
              {reasonTooLong
                ? t('reason.tooLong', {
                    max: CREDIT_LIMITS.reasonMax,
                    count: reasonLength,
                  })
                : t('reason.hint', {
                    count: reasonLength,
                    max: CREDIT_LIMITS.reasonMax,
                  })}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="gutschrift-nummer">{t('number.label')}</Label>
            <Input
              ref={numberRef}
              id="gutschrift-nummer"
              name="number"
              value={number}
              maxLength={INVOICE_LIMITS.numberMax}
              autoComplete="off"
              onChange={(e) => setTyped(e.target.value)}
              aria-describedby="gutschrift-nummer-hinweis"
              className="min-h-11"
            />
            <p id="gutschrift-nummer-hinweis" className="text-sm text-ds-neutral-800">
              {t('number.hint')}
            </p>
            {typed !== null && typed.trim() !== proposal && (
              <Button type="button" variant="link" className="min-h-11 w-fit p-0 text-ds-accent-700 sm:min-h-0" onClick={() => setTyped(null)}>
                {ti('number.useProposal', { number: proposal })}
              </Button>
            )}
          </div>

          <div aria-live="polite" className="flex flex-col gap-3">
            {blocks.map((b, i) => (
              <BlockItem key={i} block={b} />
            ))}
            {checks?.notes.map((n, i) => (
              <NoteItem key={i} note={n} />
            ))}
            {checks && checks.blocks.length === 0 && checks.notes.length === 0 && checks.acks.length === 0 && <p className="text-sm text-ds-neutral-800">{ti('allOk')}</p>}
          </div>
          {checks && checks.acks.length > 0 && (
            <fieldset className="flex flex-col gap-1">
              <legend className="mb-1 text-sm font-semibold">{ti('acks.title')}</legend>
              {checks.acks.map((a) => (
                <AckItem key={a.id} ack={a} checked={acked.has(a.id)} onChange={(on) => toggle(a.id, on)} />
              ))}
            </fieldset>
          )}
        </section>

        <section aria-labelledby="gutschrift-abschluss" className="order-4 flex flex-col gap-3">
          <h2 id="gutschrift-abschluss" className="sr-only">
            {t('submitTitle')}
          </h2>
          {error && <ErrorAlert error={error.code} creditId={error.creditId} />}
          <p className="text-sm text-ds-neutral-800">{t('final')}</p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" className="min-h-11" disabled={!canIssue} aria-busy={pending} onClick={issue}>
              {t(pending ? 'submitting' : 'submit')}
            </Button>
            <Button asChild variant="outline" className="min-h-11">
              <Link href={invoiceHref(invoice.id)}>{t('back')}</Link>
            </Button>
          </div>
        </section>
      </div>
      <section aria-label={t('previewLabel')} className="order-3 min-w-0 lg:max-w-[820px]">
        <PdfPreview state={state} label={t('previewLabel')} />
      </section>
    </div>
  )
}

// Inhalt der Gutschrift aus der Rechnung, gespiegelt und nicht änderbar
function CreditSummary({ invoice, mirrored: s, recipientLines }: Pick<CreditFormProps, 'invoice' | 'mirrored' | 'recipientLines'>) {
  const t = useTranslations('invoiceCredit.summary')
  const td = useTranslations('invoiceDrafts')
  const rate = (bp: number) => (s.smallBusiness ? null : formatVatRate(bp))
  return (
    <section aria-labelledby="gutschrift-inhalt" className="order-1 flex flex-col gap-3">
      <h2 id="gutschrift-inhalt" className="text-2xl">
        {t('title')}
      </h2>
      <p className="text-sm text-ds-neutral-800">{t('lead')}</p>
      <dl className="flex flex-col divide-y rounded-lg bg-ds-surface px-4">
        <Fact label={t('reference')}>
          <Link href={invoiceHref(invoice.id)} className="text-ds-accent-700 underline-offset-[3px] hover:underline">
            {t('invoiceRef', {
              number: invoice.number,
              date: formatDate(invoice.invoiceDate),
            })}
          </Link>
        </Fact>
        <Fact label={t('recipient')}>
          <span className="flex flex-col break-words">
            <span className="font-medium">{s.recipient.name || '–'}</span>
            {recipientLines.map((line) => (
              <span key={line}>{line}</span>
            ))}
            {s.recipient.vatId && <span>{td('detail.vatId', { id: s.recipient.vatId })}</span>}
          </span>
        </Fact>
        <Fact label={t('period')}>
          <span className="break-words">
            {s.period.apartmentLabel} · {formatPeriod(s.period.arrival, s.period.departure)}
          </span>
        </Fact>
        {s.guestNames.length > 0 && (
          <Fact label={t('guestNames')}>
            <span className="break-words">{s.guestNames.join(', ')}</span>
          </Fact>
        )}
      </dl>
      <h3 className="mt-2 text-lg font-semibold">{t('lines')}</h3>
      <dl className="flex flex-col divide-y rounded-lg bg-ds-surface px-4">
        {s.partialLabel && <div className="break-words py-3 font-medium">{s.partialLabel}</div>}
        {s.lines.map((l, i) => (
          <Row
            key={i}
            label={s.partialLabel ? td('partial.share', { rate: formatVatRate(l.vatBp) }) : [l.label, rate(l.vatBp)].filter(Boolean).join(' · ')}
            cents={l.amountCents}
          />
        ))}
        {s.deductions.length > 0 && <Row label={t('linesTotal')} cents={s.totals.linesCents} />}
        {s.deductions.map((d, i) => (
          <Row key={`d${i}`} label={t(d.origin === 'backfilled' ? 'deductionBackfilled' : 'deductionPartial', { number: d.number ?? '–' })} cents={-d.totalCents} />
        ))}
        <Row label={t('total')} cents={s.totals.totalCents} strong />
      </dl>
      {s.smallBusiness && <p className="text-[13px] text-ds-neutral-800">{t('noVat')}</p>}
      {s.totals.vatShares.length > 0 && (
        <dl aria-label={t('vatIncluded')} className="flex flex-col divide-y rounded-lg bg-ds-surface px-4 text-sm">
          {s.totals.vatShares.map((v) => (
            <div key={v.vatBp} className="flex items-baseline justify-between gap-4 py-2">
              <dt>{t('vatShare', { rate: formatVatRate(v.vatBp) })}</dt>
              <dd>
                <Amount cents={v.vatCents} />
              </dd>
            </div>
          ))}
        </dl>
      )}
    </section>
  )
}

function BlockItem({ block }: { block: IssueBlock }) {
  const t = useTranslations('invoiceCredit.blocks')
  const ti = useTranslations('invoiceIssue.blocks')
  let text: string
  let link: React.ReactNode = null
  switch (block.key) {
    case 'alreadyCredited':
      text = t('alreadyCredited', { number: block.number })
      link = (
        <Link href={invoiceHref(block.id)} className={LINK}>
          {t('toCredit')}
        </Link>
      )
      break
    case 'deductedByFinal':
      text = t('deductedByFinal', { number: block.number })
      link = (
        <Link href={invoiceHref(block.id)} className={LINK}>
          {t('toFinal')}
        </Link>
      )
      break
    case 'numberTaken':
      text = ti('numberTaken', { number: block.number })
      break
    case 'missingChars':
      text = ti('missingChars', { chars: block.chars })
      link = (
        <Link href="/einstellungen/briefpapier" className={LINK}>
          {ti('toLetterhead')}
        </Link>
      )
      break
    case 'issuerOverflow':
      text = ti('issuerOverflow')
      link = (
        <span className="flex flex-wrap gap-x-4">
          <Link href="/einstellungen/stammdaten" className={LINK}>
            {ti('toMasterData')}
          </Link>
          <Link href="/einstellungen/briefpapier" className={LINK}>
            {ti('toLetterhead')}
          </Link>
        </span>
      )
      break
    case 'footerCut':
      text = ti('footerCut')
      link = (
        <Link href="/einstellungen/rechnungen" className={LINK}>
          {ti('toFooter')}
        </Link>
      )
      break
    default:
      text = ti(block.key as 'numberInvalid')
  }
  return (
    <Alert role="note" className="border-ds-accent-2-700/40 bg-ds-accent-2-100 text-ds-accent-2-800">
      <Prohibit size={18} weight="duotone" aria-hidden="true" />
      <AlertDescription className="flex flex-col items-start gap-1">
        {text}
        {link}
      </AlertDescription>
    </Alert>
  )
}

function ErrorAlert({ error, creditId }: { error: CreditError; creditId?: string }) {
  const t = useTranslations('invoiceCredit.errors')
  return (
    <Alert role="alert" className="border-ds-accent-2-700/40 bg-ds-accent-2-100 text-ds-accent-2-800">
      <WarningCircle size={18} weight="duotone" aria-hidden="true" />
      <AlertDescription className="flex flex-col items-start gap-3">
        {t(error)}
        {error === 'alreadyCredited' && creditId && (
          <Link href={invoiceHref(creditId)} className={LINK}>
            {t('toCredit')}
          </Link>
        )}
        {error === 'timeout' && (
          <Button type="button" variant="outline" className="min-h-11" onClick={() => window.location.reload()}>
            {t('reload')}
          </Button>
        )}
      </AlertDescription>
    </Alert>
  )
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[8rem_1fr] sm:gap-4">
      <dt className="text-[13px] text-ds-neutral-700 sm:text-sm">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  )
}

function Row({ label, cents, strong }: { label: string; cents: number; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-3 ${strong ? 'font-semibold' : ''}`}>
      <dt className="min-w-0 break-words">{label}</dt>
      <dd className="shrink-0">
        <Amount cents={cents} />
      </dd>
    </div>
  )
}
