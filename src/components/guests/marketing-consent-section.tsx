'use client'

import { ArrowSquareOut, Info } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { openConsentReceipt } from '@/app/(app)/gaeste/consent-actions'
import { ConsentDialog } from '@/components/guests/consent-dialog'
import { ConsentVoidDialog } from '@/components/guests/consent-void-dialog'
import { ReceiptLink } from '@/components/payments/receipt-link'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { formatDate, formatDateTime } from '@/lib/format'
import type { ConsentEntry, ConsentKind, GuestConsent } from '@/lib/marketing-consent'
import { cn } from '@/lib/utils'

interface MarketingConsentSectionProps {
  guestId: string
  consent: GuestConsent
  isOwner: boolean
  anonymized: boolean
  // Eingewilligt, aber keine eigene E-Mail-Adresse oder Anschrift (Plattform-Adressen zählen nicht)
  missingContact: boolean
  birthDate: string | null
  today: string
}

// Abschnitt „Marketing-Einwilligung“ auf der Gastdetailseite (PROJ-19): Stand, Hinweis, Erfassen und Widerrufen (Inhaber und
// Mitarbeiter) und der Verlauf, neueste zuerst. Von Hand erfasste Einträge markiert der Inhaber mit Grund als irrtümlich.
export function MarketingConsentSection({ guestId, consent, isOwner, anonymized, missingContact, birthDate, today }: MarketingConsentSectionProps) {
  const t = useTranslations('guests.consent')
  const [dialog, setDialog] = useState<ConsentKind | null>(null)
  const [voiding, setVoiding] = useState<ConsentEntry | null>(null)
  const latestOn = consent.entries.find((e) => !e.voided)?.occurredOn ?? null

  const stateText =
    consent.state === 'granted' && consent.since
      ? consent.sheetNumber
        ? t('stateGrantedSheet', { date: formatDate(consent.since), number: consent.sheetNumber })
        : t('stateGranted', { date: formatDate(consent.since) })
      : consent.state === 'revoked' && consent.since
        ? t('stateRevoked', { date: formatDate(consent.since) })
        : t('stateNone')

  return (
    <section className="flex flex-col gap-3" aria-labelledby="einwilligung-titel">
      <h2 id="einwilligung-titel" className="text-2xl">
        {t('title')}
      </h2>

      <div className="flex flex-col gap-3 rounded-lg bg-ds-surface px-4 py-4">
        <p className={cn('text-lg font-semibold', consent.state === 'revoked' && 'text-ds-accent-2-700')} aria-live="polite">
          {stateText}
        </p>
        {consent.state === 'granted' && missingContact && (
          <Alert className="border-ds-neutral-400 bg-ds-bg">
            <Info size={18} weight="duotone" aria-hidden="true" />
            <AlertDescription>{t('noContact')}</AlertDescription>
          </Alert>
        )}
        {!anonymized && (
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setDialog('grant')}>
              {t('recordGrant')}
            </Button>
            {consent.state === 'granted' && (
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setDialog('revoke')}>
                {t('recordRevoke')}
              </Button>
            )}
          </div>
        )}
      </div>

      {consent.entries.length === 0 ? (
        <p className="rounded-lg bg-ds-surface px-4 py-3 text-ds-neutral-800">{t('empty')}</p>
      ) : (
        <div className="flex flex-col gap-2">
          <h3 className="text-lg">{t('history')}</h3>
          <ol className="flex flex-col divide-y rounded-lg bg-ds-surface px-4">
            {consent.entries.map((entry) => (
              <ConsentEntryRow
                key={entry.id}
                entry={entry}
                canVoid={isOwner && !anonymized && consent.historyAvailable && entry.origin === 'manual' && !entry.voided}
                onVoid={() => setVoiding(entry)}
              />
            ))}
          </ol>
        </div>
      )}

      {dialog && (
        <ConsentDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          guestId={guestId}
          kind={dialog}
          birthDate={birthDate}
          today={today}
          latestOn={latestOn}
        />
      )}
      {voiding && <ConsentVoidDialog open onOpenChange={(open) => !open && setVoiding(null)} guestId={guestId} entry={voiding} />}
    </section>
  )
}

function ConsentEntryRow({ entry, canVoid, onVoid }: { entry: ConsentEntry; canVoid: boolean; onVoid: () => void }) {
  const t = useTranslations('guests.consent')
  const sheetLabel = entry.sheet?.number ?? t('sheetWithoutNumber')

  return (
    <li className="flex flex-col gap-1.5 py-3">
      <div className={cn('flex flex-col gap-1', entry.voided && 'text-ds-neutral-700 line-through decoration-1')}>
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-semibold">{t(`kind.${entry.kind}`)}</span>
          <span>{formatDate(entry.occurredOn)}</span>
        </p>
        <p className="text-sm">
          {entry.origin === 'manual' ? (
            t('viaChannel', { channel: entry.channel ? t(`channel.${entry.channel}`) : '–' })
          ) : entry.sheet ? (
            <>
              {t(entry.origin === 'sheet_upload' ? 'viaUploadedSheet' : 'viaSheet')}{' '}
              <a
                href={`/api/gaesteblatt/${entry.sheet.id}/pdf`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-ds-accent-700 underline underline-offset-[3px] hover:decoration-2"
              >
                {sheetLabel}
                <ArrowSquareOut size={14} aria-hidden="true" />
                <span className="sr-only">{t('opensPdf')}</span>
              </a>
            </>
          ) : (
            t(entry.origin === 'sheet_upload' ? 'viaUploadedSheet' : 'viaSheet')
          )}
        </p>
        {entry.note && <p className="whitespace-pre-line break-words text-sm">{entry.note}</p>}
      </div>

      {entry.voided && (
        <p className="text-sm text-ds-accent-2-700">
          {t('voided', { reason: entry.voided.reason, name: entry.voided.by ?? '–', date: formatDate(entry.voided.at) })}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <p className="text-[13px] text-ds-neutral-800">
          {entry.createdBy
            ? t('createdBy', { name: entry.createdBy, date: formatDateTime(entry.createdAt) })
            : t('createdAt', { date: formatDateTime(entry.createdAt) })}
        </p>
        {entry.receipt && (
          <ReceiptLink
            type={entry.receipt.type}
            openLink={() => openConsentReceipt({ entryId: entry.id })}
            textNamespace="guests.consent.receipt"
          />
        )}
        {canVoid && (
          <Button type="button" variant="ghost" className="min-h-11 px-2 text-ds-accent-2-700" onClick={onVoid}>
            {t('voidButton')}
          </Button>
        )}
      </div>
    </li>
  )
}
