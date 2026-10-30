'use client'

import { ArrowSquareOut, FilePdf, UploadSimple } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'
import { useRef, useState } from 'react'

import { prepareInvoiceUpload } from '@/app/(app)/rechnungen/actions'
import { callAction } from '@/components/auth/form-error'
import { Button } from '@/components/ui/button'
import { checkPdfFile, INVOICE_BUCKET, type InvoicePdfLinks, PDF_UPLOADING, type PdfErrorCode } from '@/lib/invoices'
import { createClient } from '@/lib/supabase/client'

interface InvoicePdfFieldProps {
  id: string
  // Speicherort im Formular: leer, PDF_UPLOADING oder <Kunde>/<zufällig>.pdf
  value: string
  onChange: (value: string) => void
  // Abruf-Links des gespeicherten PDFs (nur solange `value` der gespeicherte Speicherort ist)
  saved?: { path: string; links: InvoicePdfLinks | null }
  describedBy?: string
}

type UploadError = PdfErrorCode | 'uploadFailed'

// PDF einer nacherfassten Rechnung (PROJ-37): eine Datei, nur PDF, bis 10 MB. Der Browser lädt die Datei direkt in
// den privaten Speicher; an der Rechnung eingetragen wird sie erst beim Speichern. Wird das Formular ohne Speichern
// geschlossen, räumt die tägliche Bereinigung die Datei weg.
export function InvoicePdfField({ id, value, onChange, saved, describedBy }: InvoicePdfFieldProps) {
  const t = useTranslations('invoices.pdf')
  const input = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<{ path: string; name: string } | null>(null)
  const [error, setError] = useState<UploadError | null>(null)
  const working = value === PDF_UPLOADING
  const isSaved = Boolean(saved && saved.path === value)

  async function upload(file: File) {
    setError(null)
    const invalid = checkPdfFile(file)
    if (invalid) {
      setError(invalid)
      return
    }
    // Das bisherige PDF bleibt erhalten, bis das neue hochgeladen ist
    const previous = value
    onChange(PDF_UPLOADING)
    try {
      const prepared = await callAction(() => prepareInvoiceUpload())
      if (!prepared.ok || !prepared.data) throw new Error('prepare')
      const { error: uploadError } = await createClient()
        .storage.from(INVOICE_BUCKET)
        .uploadToSignedUrl(prepared.data.path, prepared.data.token, file, { contentType: 'application/pdf' })
      if (uploadError) throw uploadError
      setFileName({ path: prepared.data.path, name: file.name })
      onChange(prepared.data.path)
    } catch {
      setError('uploadFailed')
      onChange(previous)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={input}
        id={id}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void upload(file)
        }}
      />

      {working ? (
        <p role="status" className="flex min-h-11 items-center rounded-md border border-dashed bg-ds-surface px-3 text-sm text-ds-neutral-800">
          {t('uploading')}
        </p>
      ) : value ? (
        <div className="flex flex-col gap-2 rounded-lg bg-ds-surface px-4 py-3">
          <p className="flex min-w-0 items-center gap-2">
            <FilePdf size={20} aria-hidden="true" className="shrink-0" />
            <span className="min-w-0 break-words">{fileName?.path === value ? fileName.name : isSaved ? t('saved') : t('ready')}</span>
          </p>
          {!isSaved && <p className="text-[13px] text-ds-neutral-800">{t('pendingHint')}</p>}
          <div className="flex flex-wrap gap-2">
            {isSaved && saved?.links && (
              <Button asChild variant="outline" className="min-h-11">
                <a href={saved.links.view} target="_blank" rel="noopener noreferrer">
                  <ArrowSquareOut size={18} aria-hidden="true" />
                  {t('open')}
                </a>
              </Button>
            )}
            <Button type="button" variant="outline" className="min-h-11" onClick={() => input.current?.click()}>
              {t('replace')}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="min-h-11"
              onClick={() => {
                setError(null)
                onChange('')
              }}
            >
              {t('remove')}
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" className="min-h-11 w-fit" aria-describedby={describedBy} onClick={() => input.current?.click()}>
          <UploadSimple size={18} aria-hidden="true" />
          {t('choose')}
        </Button>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {t(`errors.${error}`)}
        </p>
      )}
    </div>
  )
}
