'use client'

import { Plus } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { BookingPicker } from '@/components/invoices/booking-picker'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { newDraftFromListHref } from '@/lib/invoices'

// „Rechnung erstellen“ in der Rechnungsliste (PROJ-43, nur Inhaber): Buchung suchen, dann dasselbe Entwurfsformular wie
// über den Knopf „Rechnung“ der Buchung (PROJ-40). „Abbrechen“ im Formular führt zurück zur Liste.
export function CreateInvoiceButton({ variant = 'default' }: { variant?: 'default' | 'outline' }) {
  const t = useTranslations('invoices.createDraft')
  const router = useRouter()
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant={variant} className="min-h-11" onClick={() => setOpen(true)}>
        <Plus size={18} weight="bold" aria-hidden="true" />
        {t('button')}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
            <DialogDescription>{t('text')}</DialogDescription>
          </DialogHeader>
          {open && (
            <BookingPicker
              mode="draft"
              label={t('searchLabel')}
              onSelect={(booking) => {
                setOpen(false)
                router.push(newDraftFromListHref(booking.id))
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
