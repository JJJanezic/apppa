'use client'

import { useTranslations } from 'next-intl'

import { PdfPreview } from '@/components/invoice-pdf/pdf-preview'
import { usePdfPreview } from '@/components/invoice-pdf/use-pdf-preview'

const URL_DRAFT = '/api/rechnungen/vorschau'

// Entwurf in der Gestaltung des Briefpapiers (PROJ-41): gespeichert ({ draftId }) oder ungespeicherter Formularstand
export function DraftPdfPreview({ body }: { body: string }) {
  const t = useTranslations('invoiceDrafts.preview')
  const state = usePdfPreview(URL_DRAFT, body, 0)
  return (
    <div className="max-w-[820px]">
      <PdfPreview state={state} label={t('label')} />
    </div>
  )
}
