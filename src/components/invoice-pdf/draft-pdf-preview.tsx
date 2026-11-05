'use client'

import { WarningCircle } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'

import { PdfPreview } from '@/components/invoice-pdf/pdf-preview'
import { usePdfPreview } from '@/components/invoice-pdf/use-pdf-preview'
import { Alert, AlertDescription } from '@/components/ui/alert'

const URL_DRAFT = '/api/rechnungen/vorschau'

// Entwurf in der Gestaltung des Briefpapiers (PROJ-41): gespeichert ({ draftId }) oder ungespeicherter Formularstand
export function DraftPdfPreview({ body }: { body: string }) {
  const t = useTranslations('invoiceDrafts.preview')
  const tl = useTranslations('letterhead')
  const state = usePdfPreview(URL_DRAFT, body, 0)
  const meta = state.meta
  const notes = [
    meta?.logoFailed && tl('logoFailed'),
    meta?.issuerOverflow && tl('issuerOverflow'),
    meta?.footerReduced && tl('footerReduced'),
    meta?.missingChars.length && tl('missingChars', { chars: meta.missingChars.join(' ') }),
  ].filter((n): n is string => typeof n === 'string')
  return (
    <div className="flex max-w-[820px] flex-col gap-3">
      {notes.map((note) => (
        <Alert key={note} className="border-ds-accent-2-700/40 bg-ds-accent-2-100 text-ds-accent-2-800">
          <WarningCircle size={18} weight="duotone" aria-hidden="true" />
          <AlertDescription>{note}</AlertDescription>
        </Alert>
      ))}
      <PdfPreview state={state} label={t('label')} />
    </div>
  )
}
