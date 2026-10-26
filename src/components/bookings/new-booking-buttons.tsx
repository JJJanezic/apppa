'use client'

import { LockSimple, Plus } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { BlockPanel } from '@/components/bookings/block-panel'
import { BookingPanel } from '@/components/bookings/booking-panel'
import { Button } from '@/components/ui/button'
import type { BookableApartment } from '@/lib/bookings'

interface NewBookingButtonsProps {
  apartments: BookableApartment[]
  owner: boolean
  today: string
  // Belegungskalender (PROJ-9): nach dem Anlegen im Kalender bleiben
  afterCreate?: 'open' | 'refresh'
}

// „Neue Buchung“ und „Neue Sperre“ im Kopf der Buchungsliste und des Belegungskalenders (alle Mitglieder)
export function NewBookingButtons({ apartments, owner, today, afterCreate = 'open' }: NewBookingButtonsProps) {
  const t = useTranslations('bookings')
  const [open, setOpen] = useState<'booking' | 'block' | null>(null)
  const close = (o: boolean) => !o && setOpen(null)

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <Button className="min-h-11" onClick={() => setOpen('booking')}>
          <Plus size={18} weight="bold" aria-hidden="true" />
          {t('newBooking')}
        </Button>
        <Button variant="outline" className="min-h-11" onClick={() => setOpen('block')}>
          <LockSimple size={18} aria-hidden="true" />
          {t('newBlock')}
        </Button>
      </div>
      {open === 'booking' && <BookingPanel open onOpenChange={close} apartments={apartments} booking={null} owner={owner} today={today} afterCreate={afterCreate} />}
      {open === 'block' && <BlockPanel open onOpenChange={close} apartments={apartments} block={null} owner={owner} today={today} afterCreate={afterCreate} />}
    </>
  )
}
