'use client'

import { DownloadSimple } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface DocumentImageViewerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  // Abruf-Link (10 Minuten gültig) oder lokales Vorschaubild direkt nach dem Hochladen
  src: string
  // Link zum Herunterladen; bei lokalen Vorschaubildern derselbe Link mit Dateinamen
  download: string
  fileName?: string
}

// Ausweisbild groß ansehen und herunterladen (PROJ-29)
export function DocumentImageViewer({ open, onOpenChange, title, src, download, fileName }: DocumentImageViewerProps) {
  const t = useTranslations('guests.document')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[95vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-2xl">{title}</DialogTitle>
          <DialogDescription>{t('viewerHint')}</DialogDescription>
        </DialogHeader>
        {/* Kurzlebige, private Links: keine Bildoptimierung über next/image */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={title} className="mx-auto max-h-[70vh] w-auto rounded-md bg-ds-surface object-contain" />
        <DialogFooter className="gap-3 sm:gap-2">
          <Button type="button" variant="outline" className="min-h-11" onClick={() => onOpenChange(false)}>
            {t('close')}
          </Button>
          <Button asChild className="min-h-11">
            <a href={download} download={fileName ?? true}>
              <DownloadSimple size={18} aria-hidden="true" />
              {t('download')}
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
