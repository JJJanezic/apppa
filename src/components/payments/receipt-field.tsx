'use client'

import { ArrowSquareOut, FileImage, FilePdf, UploadSimple } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'
import { useRef, useState } from 'react'

import { openReceipt, prepareReceiptUpload } from '@/app/(app)/zahlungen/actions'
import { callAction } from '@/components/auth/form-error'
import { Button } from '@/components/ui/button'
import { convertDocumentImage, ImageConvertError, type ImageErrorCode, looksLikeImage } from '@/lib/document-image'
import { checkReceiptPdf, isPdfFile, RECEIPT_ACCEPT, RECEIPT_BUCKET, RECEIPT_UPLOADING, type ReceiptErrorCode, receiptTypeOf } from '@/lib/payments'
import { createClient } from '@/lib/supabase/client'

interface ReceiptFieldProps {
  id: string
  // Speicherort im Formular: leer, RECEIPT_UPLOADING oder <Kunde>/<zufällig>.pdf|.jpg
  value: string
  onChange: (value: string) => void
  // Gespeicherter Beleg der Zahlung (Bearbeiten): Öffnen über einen frischen Abruf-Link
  saved?: { paymentId: string; path: string }
  describedBy?: string
}

type UploadError = ReceiptErrorCode | ImageErrorCode | 'uploadFailed' | 'notImplemented'

// Beleg einer Zahlung (PROJ-45): höchstens eine Datei, PDF bis 10 MB unverändert oder ein Bild, das wie das Reisedokument
// (PROJ-29) im Browser gedreht, verkleinert und als JPEG gespeichert wird. Am Handy lässt sich direkt fotografieren.
// Der Browser lädt die Datei direkt in den privaten Speicher; an der Zahlung eingetragen wird sie erst beim Speichern.
export function ReceiptField({ id, value, onChange, saved, describedBy }: ReceiptFieldProps) {
  const t = useTranslations('payments.receipt')
  const input = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<{ path: string; name: string } | null>(null)
  const [error, setError] = useState<UploadError | null>(null)
  const [opening, setOpening] = useState(false)
  const working = value === RECEIPT_UPLOADING
  const isSaved = Boolean(saved && saved.path === value)

  async function upload(file: File) {
    setError(null)
    const pdf = isPdfFile(file)
    if (pdf) {
      const invalid = checkReceiptPdf(file)
      if (invalid) return setError(invalid)
    } else if (!looksLikeImage(file.name, file.type)) {
      return setError('receiptUnsupported')
    }
    // Der bisherige Beleg bleibt erhalten, bis der neue hochgeladen ist
    const previous = value
    onChange(RECEIPT_UPLOADING)
    try {
      const body = pdf ? file : await convertDocumentImage(file)
      const prepared = await callAction(() => prepareReceiptUpload({ type: pdf ? 'pdf' : 'image' }))
      if (!prepared.ok || !prepared.data) {
        setError(!prepared.ok && prepared.error === 'notImplemented' ? 'notImplemented' : 'uploadFailed')
        onChange(previous)
        return
      }
      const { error: uploadError } = await createClient()
        .storage.from(RECEIPT_BUCKET)
        .uploadToSignedUrl(prepared.data.path, prepared.data.token, body, { contentType: pdf ? 'application/pdf' : 'image/jpeg' })
      if (uploadError) throw uploadError
      setFileName({ path: prepared.data.path, name: file.name })
      onChange(prepared.data.path)
    } catch (e) {
      setError(e instanceof ImageConvertError ? e.code : 'uploadFailed')
      onChange(previous)
    }
  }

  async function open() {
    if (!saved) return
    // Fenster sofort öffnen (Safari blockt Fenster nach einer Wartezeit), dann den Link setzen
    // („noopener“ würde kein Fenster zurückgeben; die Verbindung wird stattdessen gekappt)
    const win = window.open('', '_blank')
    if (win) win.opener = null
    setOpening(true)
    const result = await callAction(() => openReceipt({ paymentId: saved.paymentId }))
    setOpening(false)
    if (result.ok && result.data) {
      if (win) win.location.href = result.data.url
      else window.location.href = result.data.url
    } else {
      win?.close()
      setError('uploadFailed')
    }
  }

  const Icon = value && receiptTypeOf(value) === 'pdf' ? FilePdf : FileImage

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={input}
        id={id}
        type="file"
        accept={RECEIPT_ACCEPT}
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
            <Icon size={20} aria-hidden="true" className="shrink-0" />
            <span className="min-w-0 break-words">{fileName?.path === value ? fileName.name : isSaved ? t('saved') : t('ready')}</span>
          </p>
          {!isSaved && <p className="text-[13px] text-ds-neutral-800">{t('pendingHint')}</p>}
          <div className="flex flex-wrap gap-2">
            {isSaved && (
              <Button type="button" variant="outline" className="min-h-11" disabled={opening} onClick={() => void open()}>
                <ArrowSquareOut size={18} aria-hidden="true" />
                {t('open')}
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
