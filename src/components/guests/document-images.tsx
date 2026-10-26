'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { DocumentImageViewer } from '@/components/guests/document-image-viewer'
import { DOCUMENT_SIDES, type DocumentSide, type Guest } from '@/lib/guests'

// Vorschauen der Ausweisbilder im Gast-Detail (PROJ-29), für alle Mitglieder: Klick öffnet das Bild groß
export function DocumentImages({ images }: { images: Guest['documentImages'] }) {
  const t = useTranslations('guests.document')
  const [open, setOpen] = useState<DocumentSide | null>(null)
  const sides = DOCUMENT_SIDES.filter((side) => images[side])
  const current = open ? images[open] : undefined

  return (
    <>
      <ul className="flex flex-wrap gap-4">
        {sides.map((side) => (
          <li key={side} className="flex flex-col gap-1">
            <button
              type="button"
              onClick={() => setOpen(side)}
              className="w-fit rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ds-accent-700"
              aria-label={t('open', { side: t(`side.${side}`) })}
            >
              {/* Kurzlebige, private Links: keine Bildoptimierung über next/image */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={images[side]!.view} alt="" className="h-28 w-auto max-w-full rounded-md border bg-ds-bg object-contain" />
            </button>
            <span className="text-[13px] text-ds-neutral-700">{t(`side.${side}`)}</span>
          </li>
        ))}
      </ul>
      {open && current && (
        <DocumentImageViewer
          open
          onOpenChange={(next) => !next && setOpen(null)}
          title={t(`side.${open}`)}
          src={current.view}
          download={current.download}
        />
      )}
    </>
  )
}
