'use client'

import { ImageSquare } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'

import { adminPrepareLogoUpload } from '@/app/(app)/betreiber/actions'
import { prepareLogoUpload } from '@/app/(app)/einstellungen/actions'
import { callAction } from '@/components/auth/form-error'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ImageConvertError, type ImageErrorCode } from '@/lib/document-image'
import { convertLogoImage } from '@/lib/logo-image'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { isSmallLogo, LOGO_ACCEPT, LOGO_BUCKET, LOGO_UPLOADING } from '@/lib/tenant-logo'

interface TenantLogoFieldProps {
  tenantId: string
  mode: 'owner' | 'operator'
  // Speicherort im Formular: leer, LOGO_UPLOADING oder <Kunde>/<zufällig>.png
  value: string
  onChange: (value: string) => void
  // Gespeichertes Logo mit Abruf-Link (10 Minuten gültig)
  saved: { path: string | null; url: string | null }
  readOnly?: boolean
}

type UploadError = ImageErrorCode | 'uploadFailed'

// Karomuster hinter dem Logo: durchsichtige Flächen bleiben sichtbar
const CHECKER =
  'bg-ds-surface bg-[conic-gradient(var(--color-neutral-200)_25%,transparent_0_50%,var(--color-neutral-200)_0_75%,transparent_0)] bg-[length:16px_16px]'

// Feld „Logo“ der Stammdaten (PROJ-38). Das Bild wird im Browser in ein PNG umgewandelt und direkt in den privaten
// Speicher geladen; am Kunden eingetragen wird es erst beim Speichern des Formulars.
export function TenantLogoField({ tenantId, mode, value, onChange, saved, readOnly = false }: TenantLogoFieldProps) {
  const t = useTranslations('tenantData.logo')
  const input = useRef<HTMLInputElement>(null)
  // Vorschau des frisch hochgeladenen Logos (lokal, ohne Abruf vom Speicher)
  const [local, setLocal] = useState<{ path: string; url: string } | null>(null)
  const [error, setError] = useState<UploadError | null>(null)
  const [viewing, setViewing] = useState(false)
  // Größe des angezeigten Logos (für den Hinweis bei kleinen Logos)
  const [size, setSize] = useState<{ src: string; width: number; height: number } | null>(null)
  const working = value === LOGO_UPLOADING

  useEffect(() => () => {
    if (local) URL.revokeObjectURL(local.url)
  }, [local])

  const src = local && local.path === value ? local.url : saved.path && saved.path === value ? saved.url : null
  const unsaved = Boolean(value) && !working && value !== saved.path
  const removed = !value && Boolean(saved.path)
  const small = size && size.src === src && isSmallLogo(size.width, size.height)

  async function upload(file: File) {
    const previous = value
    setError(null)
    onChange(LOGO_UPLOADING)
    try {
      const logo = await convertLogoImage(file)
      const prepared = await callAction(() =>
        mode === 'operator' ? adminPrepareLogoUpload({ tenantId }) : prepareLogoUpload({ tenantId })
      )
      if (!prepared.ok || !prepared.data) throw new Error('prepare')
      const { error: uploadError } = await createClient()
        .storage.from(LOGO_BUCKET)
        .uploadToSignedUrl(prepared.data.path, prepared.data.token, logo.blob, { contentType: 'image/png' })
      if (uploadError) throw uploadError
      setLocal({ path: prepared.data.path, url: URL.createObjectURL(logo.blob) })
      onChange(prepared.data.path)
    } catch (e) {
      // Das bisherige Logo bleibt erhalten
      setError(e instanceof ImageConvertError ? e.code : 'uploadFailed')
      onChange(previous)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg" id="tenant-logo-label">
          {t('title')}
        </h3>
        {!readOnly && <p className="text-sm text-ds-neutral-800">{t('hint')}</p>}
      </div>
      <input
        ref={input}
        type="file"
        accept={LOGO_ACCEPT}
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
          className="flex min-h-28 max-w-80 items-center justify-center rounded-md border border-dashed bg-ds-surface px-3 text-sm text-ds-neutral-800"
        >
          {t('uploading')}
        </div>
      ) : value ? (
        <div className="flex flex-col gap-2">
          {src ? (
            <button
              type="button"
              onClick={() => setViewing(true)}
              className="w-fit rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-accent-700"
              aria-label={t('open')}
            >
              {/* Kurzlebige, private Links bzw. lokale Vorschau: keine Bildoptimierung über next/image */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                className={cn(CHECKER, 'h-28 w-auto max-w-full rounded-md border object-contain p-2')}
                onLoad={(e) =>
                  setSize({ src, width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight })
                }
              />
            </button>
          ) : (
            <p className="flex min-h-11 items-center gap-2 text-sm text-ds-neutral-800">
              <ImageSquare size={18} aria-hidden="true" />
              {t('present')}
            </p>
          )}
          {small && <p className="text-sm text-ds-accent-2-800">{t('small')}</p>}
          {unsaved && <p className="text-sm text-ds-neutral-800">{t('unsaved')}</p>}
          {!readOnly && (
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
          )}
        </div>
      ) : readOnly ? (
        <p className="text-sm text-ds-neutral-800">{t('none')}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {removed && <p className="text-sm text-ds-neutral-800">{t('removed')}</p>}
          <Button
            type="button"
            variant="outline"
            className="min-h-11 w-fit"
            aria-describedby="tenant-logo-label"
            onClick={() => input.current?.click()}
          >
            <ImageSquare size={18} aria-hidden="true" />
            {t('add')}
          </Button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-ds-accent-2-800">
          {t(`errors.${error}`)}
        </p>
      )}

      {src && viewing && (
        <Dialog open onOpenChange={setViewing}>
          <DialogContent className="max-h-[95vh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle className="text-2xl">{t('title')}</DialogTitle>
              <DialogDescription>{t('viewerHint')}</DialogDescription>
            </DialogHeader>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={t('title')} className={cn(CHECKER, 'mx-auto max-h-[70vh] w-auto rounded-md object-contain p-4')} />
            <DialogFooter>
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setViewing(false)}>
                {t('close')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
