'use client'

import { Plus } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { GuestPanel } from '@/components/guests/guest-panel'
import { Button } from '@/components/ui/button'

// „Gast anlegen“ (nur Inhaber): öffnet das Gast-Panel mit leerem Formular
export function CreateGuestButton() {
  const t = useTranslations('guests')
  const [open, setOpen] = useState(false)
  // Neuer Schlüssel je Öffnen: Formular startet leer
  const [key, setKey] = useState(0)

  return (
    <>
      <Button
        className="min-h-11"
        onClick={() => {
          setKey((k) => k + 1)
          setOpen(true)
        }}
      >
        <Plus size={18} weight="bold" aria-hidden="true" />
        {t('create')}
      </Button>
      {open && <GuestPanel key={key} open onOpenChange={setOpen} guest={null} />}
    </>
  )
}
