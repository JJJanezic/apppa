'use client'

import { Plus } from '@phosphor-icons/react'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { CompanyPanel } from '@/components/companies/company-panel'
import { Button } from '@/components/ui/button'

// „Firma anlegen“ (nur Inhaber): öffnet das Firmen-Panel mit leerem Formular
export function CreateCompanyButton() {
  const t = useTranslations('companies')
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
      {open && <CompanyPanel key={key} open onOpenChange={setOpen} company={null} />}
    </>
  )
}
