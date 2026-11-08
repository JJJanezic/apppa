'use client'

import { FilePdf, Signature, UploadSimple } from '@phosphor-icons/react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { GuestSheetUploadDialog } from '@/components/guest-sheets/guest-sheet-upload-dialog'
import { Button } from '@/components/ui/button'
import { guestSheetSignHref } from '@/lib/guest-sheet'

interface GuestSheetButtonsProps {
  bookingId: string
  // aktuelles Blatt (Kennung und Abruf des PDFs)
  current: { id: string; pdfHref: string } | null
  // Unterschreiben: Blatt vorgesehen, Gast verknüpft und nicht anonymisiert
  canSign: boolean
  canUpload: boolean
  // Gästeblattnummer der Buchung (Vorbelegung der Lfd.-Nr. beim Hochladen)
  sheetNumber: string | null
  // Marketing-Häkchen beim Hochladen nur mit verknüpftem, nicht anonymisiertem Gast
  canConsent: boolean
}

// Knöpfe im Abschnitt „Gästeblatt“ (PROJ-26). Gibt es schon ein Blatt, fragen „Neu unterschreiben lassen“ und
// „Gästeblatt hochladen“ zuerst nach; das bisherige Blatt bleibt als „ersetzt“ erhalten.
export function GuestSheetButtons({ bookingId, current, canSign, canUpload, sheetNumber, canConsent }: GuestSheetButtonsProps) {
  const t = useTranslations('guestSheets.booking')
  const router = useRouter()
  const [confirm, setConfirm] = useState<'sign' | 'upload' | null>(null)
  const [upload, setUpload] = useState(false)
  const signHref = guestSheetSignHref(bookingId)

  return (
    <div className="flex flex-wrap gap-2">
      {current && (
        <Button asChild variant="outline" className="min-h-11">
          <a href={current.pdfHref} target="_blank" rel="noopener noreferrer">
            <FilePdf size={18} aria-hidden="true" />
            {t('view')}
          </a>
        </Button>
      )}
      {canSign &&
        (current ? (
          <Button type="button" variant="outline" className="min-h-11" onClick={() => setConfirm('sign')}>
            <Signature size={18} aria-hidden="true" />
            {t('resign')}
          </Button>
        ) : (
          <Button asChild className="min-h-11">
            <Link href={signHref}>
              <Signature size={18} aria-hidden="true" />
              {t('sign')}
            </Link>
          </Button>
        ))}
      {!canSign && !current && (
        <Button type="button" className="min-h-11" disabled>
          <Signature size={18} aria-hidden="true" />
          {t('sign')}
        </Button>
      )}
      {canUpload && (
        <Button type="button" variant="outline" className="min-h-11" onClick={() => (current ? setConfirm('upload') : setUpload(true))}>
          <UploadSimple size={18} aria-hidden="true" />
          {t('upload')}
        </Button>
      )}

      <ConfirmDialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={confirm === 'upload' ? t('replaceTitle') : t('resignTitle')}
        text={t('replaceText')}
        confirmLabel={confirm === 'upload' ? t('replaceConfirm') : t('resignConfirm')}
        cancelLabel={t('cancel')}
        onConfirm={() => {
          if (confirm === 'sign') router.push(signHref)
          else setUpload(true)
          setConfirm(null)
        }}
      />
      <GuestSheetUploadDialog
        open={upload}
        onOpenChange={setUpload}
        bookingId={bookingId}
        previousSheetId={current?.id ?? null}
        sheetNumber={sheetNumber}
        canConsent={canConsent}
      />
    </div>
  )
}
