'use client'

import { CheckCircle, WarningCircle } from '@phosphor-icons/react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'

import type { RequiredCheck } from '@/lib/invoice-drafts'

interface RequiredChecksProps {
  checks: RequiredCheck[]
  // Formular: springt zum Feld; Detailseite (Inhaber): Link ins Formular; sonst nur Text
  onJump?: (field: string) => void
  // Adresse des Formulars; der Link springt mit #feld dorthin
  formHref?: string
  // Link zu Einstellungen → Stammdaten (nur Inhaber)
  settingsLink?: boolean
}

// Liste „Pflichtangaben“ (PROJ-40) mit ✓ bzw. Fehlertext und Sprung zum Feld. Fehler verhindern nur das Ausstellen
// (PROJ-41); die fehlende Rechnungsnummer ist im Entwurf kein Fehler.
export function RequiredChecks({ checks, onJump, formHref, settingsLink }: RequiredChecksProps) {
  const t = useTranslations('invoiceDrafts.required')
  const open = checks.filter((c) => !c.ok).length

  return (
    <section aria-labelledby="pflichtangaben" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="pflichtangaben" className="text-xl">
          {t('title')}
        </h2>
        <p className="text-sm text-ds-neutral-800" aria-live="polite">
          {open ? t('openCount', { count: open }) : t('allOk')}
        </p>
      </div>
      <ul className="flex flex-col divide-y rounded-lg bg-ds-surface px-4">
        {checks.map((c) => (
          <li key={c.key} className="flex items-start gap-3 py-3">
            {c.ok ? (
              <CheckCircle size={20} weight="fill" className="mt-0.5 shrink-0 text-ds-accent-700" aria-label={t('ok')} />
            ) : (
              <WarningCircle size={20} weight="fill" className="mt-0.5 shrink-0 text-ds-accent-2-700" aria-label={t('missing')} />
            )}
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className={c.ok ? undefined : 'text-ds-accent-2-800'}>{t(`${c.key}.${c.ok ? 'ok' : 'error'}`)}</span>
              {!c.ok && c.field && onJump && (
                <button type="button" className="min-h-11 w-fit text-left text-sm text-ds-accent-700 underline underline-offset-[3px] sm:min-h-0" onClick={() => onJump(c.field!)}>
                  {t('toField')}
                </button>
              )}
              {!c.ok && c.field && !onJump && formHref && (
                <Link href={`${formHref}#${c.field}`} className="flex min-h-11 w-fit items-center text-sm text-ds-accent-700 underline underline-offset-[3px] sm:min-h-0">
                  {t('toField')}
                </Link>
              )}
              {!c.ok && c.settings && settingsLink && (
                <Link href="/einstellungen/stammdaten" className="flex min-h-11 w-fit items-center text-sm text-ds-accent-700 underline underline-offset-[3px] sm:min-h-0">
                  {t('toSettings')}
                </Link>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
