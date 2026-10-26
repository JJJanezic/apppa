'use client'

import { ImageSquare } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'

import { prepareDocumentUpload } from '@/app/(app)/gaeste/actions'
import { callAction } from '@/components/auth/form-error'
import { DocumentImageViewer } from '@/components/guests/document-image-viewer'
import { Button } from '@/components/ui/button'
import { convertDocumentImage, IMAGE_ACCEPT, ImageConvertError, type ImageErrorCode } from '@/lib/document-image'
import { DOCUMENT_BUCKET, type DocumentImage, type DocumentSide } from '@/lib/guests'
import { createClient } from '@/lib/supabase/client'
import { DOCUMENT_UPLOADING } from '@/lib/validation/guests'

interface DocumentImageFieldProps {
  side: DocumentSide
  // Speicherort im Formular: leer, DOCUMENT_UPLOADING oder <Kunde>/<zufällig>.jpg
  value: string
  onChange: (value: string) => void
  // Abruf-Links des gespeicherten Bildes (nur solange `value` der gespeicherte Speicherort ist)
  saved?: { path: string; image: DocumentImage }
  invalid?: boolean
}

type UploadError = ImageErrorCode | 'uploadFailed'

// Bildplatz „Vorderseite“ bzw. „Rückseite“ des Reisedokuments (PROJ-29).
// Das Bild wird im Browser umgewandelt und direkt in den privaten Speicher geladen; am Gast eingetragen
// wird es erst beim Speichern des Formulars. Am Handy bietet der Dateidialog Kamera und Galerie an.
export function DocumentImageField({ side, value, onChange, saved, invalid }: DocumentImageFieldProps) {
  const t = useTranslations('guests.document')
  const input = useRef<HTMLInputElement>(null)
  // Vorschau frisch hochgeladener Bilder (lokal, ohne erneuten Abruf)
  const [local, setLocal] = useState<{ path: string; url: string } | null>(null)
  const [error, setError] = useState<UploadError | null>(null)
  const [viewing, setViewing] = useState(false)
  const label = t(`side.${side}`)
  const working = value === DOCUMENT_UPLOADING

  useEffect(() => () => {
    if (local) URL.revokeObjectURL(local.url)
  }, [local])

  const preview =
    local && local.path === value
      ? { view: local.url, download: local.url }
      : saved && saved.path === value
        ? saved.image
        : null

  async function upload(file: File) {
    const previous = value
    setError(null)
    onChange(DOCUMENT_UPLOADING)
    try {
      const jpeg = await convertDocumentImage(file)
      const prepared = await callAction(() => prepareDocumentUpload())
      if (!prepared.ok || !prepared.data) throw new Error('prepare')
      const { error: uploadError } = await createClient()
        .storage.from(DOCUMENT_BUCKET)
        .uploadToSignedUrl(prepared.data.path, prepared.data.token, jpeg, { contentType: 'image/jpeg' })
      if (uploadError) throw uploadError
      setLocal({ path: prepared.data.path, url: URL.createObjectURL(jpeg) })
      onChange(prepared.data.path)
    } catch (e) {
      // Das bisherige Bild bleibt erhalten
      setError(e instanceof ImageConvertError ? e.code : 'uploadFailed')
      onChange(previous)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold" id={`document-${side}-label`}>
        {label}
      </p>
      <input
        ref={input}
        type="file"
        accept={IMAGE_ACCEPT}
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
        <div
          role="status"
          className="flex min-h-28 items-center justify-center rounded-md border border-dashed bg-ds-surface px-3 text-sm text-ds-neutral-800"
        >
          {t('uploading')}
        </div>
      ) : value ? (
        <div className="flex flex-col gap-2">
          {preview ? (
            <button
              type="button"
              onClick={() => setViewing(true)}
              className="w-fit rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-accent-700"
              aria-label={t('open', { side: label })}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={preview.view} alt="" className="h-28 w-auto max-w-full rounded-md border bg-ds-surface object-contain" />
            </button>
          ) : (
            <p className="flex min-h-11 items-center gap-2 text-sm text-ds-neutral-800">
              <ImageSquare size={18} aria-hidden="true" />
              {t('present')}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
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
        <Button
          type="button"
          variant="outline"
          className={invalid ? 'min-h-11 w-fit border-ds-accent-2-700' : 'min-h-11 w-fit'}
          aria-describedby={`document-${side}-label`}
          onClick={() => input.current?.click()}
        >
          <ImageSquare size={18} aria-hidden="true" />
          {t('add')}
        </Button>
      )}

      {error && (
        <p role="alert" className="text-sm text-ds-accent-2-800">
          {t(`errors.${error}`)}
        </p>
      )}

      {preview && viewing && (
        <DocumentImageViewer
          open
          onOpenChange={setViewing}
          title={label}
          src={preview.view}
          download={preview.download}
          fileName={preview.download === preview.view ? `${label}.jpg` : undefined}
        />
      )}
    </div>
  )
}
