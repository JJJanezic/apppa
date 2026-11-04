'use client'

import { ArrowClockwise, ArrowSquareOut, WarningCircle } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { PdfPages } from '@/components/invoice-pdf/pdf-pages'
import type { PdfPreviewState } from '@/components/invoice-pdf/use-pdf-preview'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

// PDF-Vorschau mit Hinweis „wird aktualisiert“, Fehlermeldung samt „Erneut versuchen“ und „PDF öffnen“ (PROJ-41)
export function PdfPreview({ state, label }: { state: PdfPreviewState; label: string }) {
  const t = useTranslations('letterhead.preview')
  const [drawFailed, setDrawFailed] = useState<Uint8Array | null>(null)
  const { bytes, loading, retry } = state
  const failed = state.failed || (bytes !== null && drawFailed === bytes)

  function open() {
    if (!bytes) return
    const url = URL.createObjectURL(new Blob([bytes.slice()], { type: 'application/pdf' }))
    window.open(url, '_blank', 'noopener')
    // Der neue Reiter braucht die Adresse nur zum Laden
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="text-[13px] text-ds-neutral-800">
          {loading ? t('updating') : ''}
        </p>
        <Button type="button" variant="outline" className="min-h-11" disabled={!bytes} onClick={open}>
          <ArrowSquareOut size={18} aria-hidden="true" />
          {t('open')}
        </Button>
      </div>
      {failed && (
        <Alert role="alert" className="border-ds-accent-2-700/40 bg-ds-accent-2-100 text-ds-accent-2-800">
          <WarningCircle size={18} weight="duotone" aria-hidden="true" />
          <AlertDescription className="flex flex-col items-start gap-3">
            {t('failed')}
            <Button type="button" variant="outline" className="min-h-11" onClick={retry}>
              <ArrowClockwise size={18} aria-hidden="true" />
              {t('retry')}
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {bytes ? (
        <PdfPages bytes={bytes} label={label} onFailed={() => setDrawFailed(bytes)} />
      ) : (
        !failed && <Skeleton className="aspect-[210/297] w-full" />
      )}
    </div>
  )
}
